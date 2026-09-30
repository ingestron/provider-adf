// src/metadata.mjs
var metadataStandard = "metadata-snapshot-land@v1";
var expr = (value) => ({ type: "Expression", value });
var after = (activity) => [{ activity, dependencyConditions: ["Succeeded"] }];
var fail = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { message, errorCode: "INGESTRON_METADATA_INVALID" }
});
var gate = (name, condition, message, dependency) => ({
  name,
  type: "IfCondition",
  ...dependency ? { dependsOn: after(dependency) } : {},
  typeProperties: {
    expression: expr(condition),
    ifTrueActivities: [],
    ifFalseActivities: [fail(`${name}Failed`, message)]
  }
});
function metadataNames(project, group) {
  const base = `${project}_md_${group}`;
  return {
    coordinator: `${base}_run`,
    worker: `${base}_worker`,
    source: `${base}_sql`,
    sink: `${base}_parquet`
  };
}
function metadataGroups(plan) {
  const groups = /* @__PURE__ */ new Map();
  for (const node of plan.nodes) {
    const group = node.with.group;
    const settings = JSON.stringify([
      node.source.kind,
      node.source.linkedService,
      node.with.target.linkedService,
      node.runtime.options?.timeout ?? "00.01:00:00",
      node.with.parallelism ?? 2
    ]);
    if (groups.has(group) && groups.get(group).settings !== settings)
      throw new Error(
        `Metadata group ${group} requires matching source kind, linked services, timeout and parallelism; choose separate groups`
      );
    if (!groups.has(group)) groups.set(group, { settings, nodes: [] });
    groups.get(group).nodes.push(node);
  }
  return [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}
function renderMetadata(plan, add, assets) {
  for (const [group, { nodes }] of metadataGroups(plan)) {
    nodes.sort(
      (a, b) => `${a.flow}/${a.table}` < `${b.flow}/${b.table}` ? -1 : 1
    );
    if (nodes.length > 100)
      throw new Error("Metadata groups support at most 100 tables");
    const first = nodes[0], names = metadataNames(plan.project, group);
    const catalogue = Object.fromEntries(
      nodes.map((n) => [
        `${n.flow}/${n.table}`,
        {
          schema: n.source.schema,
          table: n.source.table,
          query: `SELECT ${n.columns.map((c) => `[${c.name}]`).join(", ")} FROM [${n.source.schema}].[${n.source.table}]`,
          translator: {
            type: "TabularTranslator",
            mappings: n.columns.map((c) => ({
              source: { name: c.name },
              sink: { name: c.target ?? c.name }
            })),
            typeConversion: false
          },
          fileSystem: n.with.target.fileSystem,
          folder: `${n.with.target.path}/${n.flow}/${n.table}`,
          minimumRows: n.with.allowEmpty ? 0 : 1
        }
      ])
    );
    const encoded = JSON.stringify(catalogue);
    if (encoded.length > 2e5)
      throw new Error(
        "Metadata catalogue exceeds 200,000 characters; split the group"
      );
    const variables = { catalogue: { type: "String", defaultValue: encoded } };
    const lookup = "json(variables('catalogue'))[pipeline().parameters.tableId]";
    const policy = {
      timeout: first.runtime.options?.timeout ?? "00.01:00:00",
      retry: 0,
      secureInput: true,
      secureOutput: true
    };
    add("datasets", names.source, {
      type: first.source.kind === "azure-sql" ? "AzureSqlTable" : "SqlServerTable",
      linkedServiceName: {
        type: "LinkedServiceReference",
        referenceName: first.source.linkedService
      },
      parameters: { schema: { type: "String" }, table: { type: "String" } },
      typeProperties: {
        schema: expr("@dataset().schema"),
        table: expr("@dataset().table")
      }
    });
    add("datasets", names.sink, {
      type: "Parquet",
      linkedServiceName: {
        type: "LinkedServiceReference",
        referenceName: first.with.target.linkedService
      },
      parameters: {
        fileSystem: { type: "String" },
        folder: { type: "String" },
        runId: { type: "String" }
      },
      typeProperties: {
        compressionCodec: "snappy",
        location: {
          type: "AzureBlobFSLocation",
          fileSystem: expr("@dataset().fileSystem"),
          folderPath: expr("@concat(dataset().folder, '/', dataset().runId)")
        }
      }
    });
    add(
      "pipelines",
      names.worker,
      {
        description: "Reviewed metadata snapshot worker; consume only successful worker runs",
        concurrency: first.with.parallelism ?? 2,
        variables,
        parameters: {
          tableId: { type: "String" },
          expectedRowCount: { type: "Int" }
        },
        activities: [
          gate(
            "ValidateTable",
            "@contains(json(variables('catalogue')), pipeline().parameters.tableId)",
            "Unknown reviewed table ID"
          ),
          gate(
            "ValidateCount",
            `@and(greaterOrEquals(pipeline().parameters.expectedRowCount, ${lookup}.minimumRows), lessOrEquals(pipeline().parameters.expectedRowCount, 2147483647))`,
            "Invalid expected count or empty-table policy",
            "ValidateTable"
          ),
          {
            name: "Copy",
            type: "Copy",
            dependsOn: after("ValidateCount"),
            policy,
            typeProperties: {
              source: {
                type: first.source.kind === "azure-sql" ? "AzureSqlSource" : "SqlSource",
                sqlReaderQuery: expr(`@${lookup}.query`),
                partitionOption: "None"
              },
              sink: {
                type: "ParquetSink",
                storeSettings: { type: "AzureBlobFSWriteSettings" },
                formatSettings: { type: "ParquetWriteSettings" }
              },
              translator: expr(`@${lookup}.translator`),
              enableStaging: false,
              validateDataConsistency: true,
              enableSkipIncompatibleRow: false
            },
            inputs: [
              {
                type: "DatasetReference",
                referenceName: names.source,
                parameters: {
                  schema: expr(`@${lookup}.schema`),
                  table: expr(`@${lookup}.table`)
                }
              }
            ],
            outputs: [
              {
                type: "DatasetReference",
                referenceName: names.sink,
                parameters: {
                  fileSystem: expr(`@${lookup}.fileSystem`),
                  folder: expr(`@${lookup}.folder`),
                  runId: expr("@pipeline().RunId")
                }
              }
            ]
          },
          gate(
            "VerifyCount",
            "@equals(activity('Copy').output.rowsCopied, pipeline().parameters.expectedRowCount)",
            "Snapshot row count mismatch; do not consume this run",
            "Copy"
          )
        ]
      },
      [names.source, names.sink]
    );
    const filter = (name, condition, dependency) => ({
      name,
      type: "Filter",
      ...dependency ? { dependsOn: after(dependency) } : {},
      typeProperties: {
        items: expr("@pipeline().parameters.tables"),
        condition: expr(condition)
      }
    });
    add(
      "pipelines",
      names.coordinator,
      {
        description: "Select reviewed table IDs and independently established counts; no runtime SQL or destination overrides",
        concurrency: 1,
        variables,
        parameters: {
          tables: { type: "Array", defaultValue: Object.keys(catalogue) },
          expectedCounts: { type: "Object" }
        },
        activities: [
          filter(
            "UnknownTables",
            "@not(contains(json(variables('catalogue')), item()))"
          ),
          gate(
            "ValidateSelection",
            "@and(and(greater(length(pipeline().parameters.tables), 0), lessOrEquals(length(pipeline().parameters.tables), 100)), and(equals(length(activity('UnknownTables').output.value), 0), equals(length(union(pipeline().parameters.tables, pipeline().parameters.tables)), length(pipeline().parameters.tables))))",
            "Select 1\u2013100 unique reviewed table IDs",
            "UnknownTables"
          ),
          filter(
            "MissingCounts",
            "@not(contains(pipeline().parameters.expectedCounts, item()))",
            "ValidateSelection"
          ),
          gate(
            "ValidateCountsPresent",
            "@equals(length(activity('MissingCounts').output.value), 0)",
            "Every selected table requires an independently established count",
            "MissingCounts"
          ),
          filter(
            "InvalidCounts",
            "@not(and(equals(string(int(pipeline().parameters.expectedCounts[item()])), string(pipeline().parameters.expectedCounts[item()])), and(greaterOrEquals(int(pipeline().parameters.expectedCounts[item()]), json(variables('catalogue'))[item()].minimumRows), lessOrEquals(int(pipeline().parameters.expectedCounts[item()]), 2147483647))))",
            "ValidateCountsPresent"
          ),
          gate(
            "ValidateCounts",
            "@equals(length(activity('InvalidCounts').output.value), 0)",
            "Counts must be integers within the table policy and 32-bit positive range",
            "InvalidCounts"
          ),
          {
            name: "RunTables",
            type: "ForEach",
            dependsOn: after("ValidateCounts"),
            typeProperties: {
              items: expr("@pipeline().parameters.tables"),
              isSequential: false,
              batchCount: first.with.parallelism ?? 2,
              activities: [
                {
                  name: "RunTable",
                  type: "ExecutePipeline",
                  policy: { secureInput: true },
                  typeProperties: {
                    pipeline: {
                      type: "PipelineReference",
                      referenceName: names.worker
                    },
                    waitOnCompletion: true,
                    parameters: {
                      tableId: expr("@item()"),
                      expectedRowCount: expr(
                        "@int(pipeline().parameters.expectedCounts[item()])"
                      )
                    }
                  }
                }
              ]
            }
          }
        ]
      },
      [],
      [names.worker]
    );
    assets[`metadata/${group}.json`] = {
      format: "json",
      value: {
        apiVersion: "ingestron.adf-metadata/v1",
        group,
        ...names,
        catalogue
      }
    };
    assets[`metadata/${group}.parameters.example.json`] = {
      format: "json",
      value: {
        tables: Object.keys(catalogue),
        expectedCounts: Object.fromEntries(
          Object.keys(catalogue).map((k) => [k, null])
        )
      }
    };
  }
}

// src/publication.mjs
var check = (ok, message) => {
  if (!ok) throw new Error(message);
};
var expression = (value) => ({ type: "Expression", value });
var publicationLibraries = [
  { pypi: { package: "azure-storage-blob==12.30.1" } },
  { pypi: { package: "azure-identity==1.25.3" } }
];
function validatePublication(n) {
  const value = n.with.publication;
  check(
    value && typeof value === "object" && Object.keys(value).every(
      (k) => ["linkedService", "notebookPath", "protocol"].includes(k)
    ),
    "Declare publication linkedService, notebookPath and protocol"
  );
  check(
    /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value.linkedService),
    "Use an existing Databricks linked service"
  );
  check(
    typeof value.notebookPath === "string" && /^\/Workspace\/[A-Za-z0-9_./-]+$/.test(value.notebookPath) && value.notebookPath.split("/").every((p) => p !== "." && p !== ".."),
    "Supply the reviewed deployed publication notebookPath"
  );
  check(
    value.protocol === "ingestron.snapshot-publication/v1",
    "Unsupported publication protocol"
  );
  check(
    typeof n.with.target.storageAccount === "string" && /^[a-z0-9]{3,24}$/.test(n.with.target.storageAccount),
    "Publication requires the actual landing storageAccount"
  );
  check(
    typeof n.contract?.version === "string" && n.contract.version,
    "Publication requires a contract version"
  );
}
function publicationPipeline(plan, n, name) {
  validatePublication(n);
  const t = n.with.target;
  const identity = {
    dataset: `${plan.project}.${n.flow}.${n.table}`,
    sourceRoot: `abfss://${t.fileSystem}@${t.storageAccount}.dfs.core.windows.net/${t.path}/${n.flow}/${n.table}`,
    contractVersion: n.contract.version,
    protocol: n.with.publication.protocol,
    contractShape: JSON.stringify(n.columns)
  };
  const parameters = {
    deliveryId: { type: "String" },
    version: { type: "Int" },
    capturedAt: { type: "String" },
    expectedRowCount: { type: "Int" },
    runId: { type: "String" },
    initialiseIndex: { type: "Bool", defaultValue: false }
  };
  const baseParameters = {
    ...identity,
    ...Object.fromEntries(
      Object.keys(parameters).map((key) => [
        key,
        expression(`@string(pipeline().parameters.${key})`)
      ])
    )
  };
  return {
    name: name + "_publish",
    properties: {
      description: "Retry this pipeline with the original receipt to recover publication without rerunning Copy",
      concurrency: 1,
      parameters,
      activities: [
        {
          name: "PublishVerifiedSnapshot",
          type: "DatabricksNotebook",
          linkedServiceName: {
            type: "LinkedServiceReference",
            referenceName: n.with.publication.linkedService
          },
          policy: {
            timeout: n.runtime.options?.timeout ?? "00.01:00:00",
            retry: 2,
            retryIntervalInSeconds: 30,
            secureInput: true,
            secureOutput: true
          },
          typeProperties: {
            notebookPath: n.with.publication.notebookPath,
            baseParameters,
            libraries: publicationLibraries
          }
        }
      ]
    },
    identity
  };
}

// src/quality.mjs
var METRICS = [
  "nullValues",
  "missingValues",
  "invalidValues",
  "duplicateValues",
  "rowCount"
];
var OPERATORS = [
  "mustBe",
  "mustNotBe",
  "mustBeGreaterThan",
  "mustBeGreaterOrEqualTo",
  "mustBeLessThan",
  "mustBeLessOrEqualTo",
  "mustBeBetween",
  "mustNotBeBetween"
];
var fail2 = (message) => {
  throw new Error(message);
};
function sqlShape(id, text) {
  const stripped = String(text).replace(/N?'(?:[^']|'')*'/g, "''").replace(/\[[^\]]*\]/g, "[]").replace(/`[^`]*`/g, "``").replace(/"[^"]*"/g, '""');
  if (/--|\/\*|;/.test(stripped))
    fail2(`${id}: query must be one statement without comments or semicolons`);
  if (/\b(INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|DENY|EXEC|EXECUTE|CALL|USE|SET|INTO|BACKUP|RESTORE|DBCC|OPENROWSET|OPENQUERY|OPENDATASOURCE|WAITFOR|SHUTDOWN|BULK)\b/i.test(
    stripped
  ))
    fail2(`${id}: query must only read the source table`);
  if (!/^\s*(SELECT|WITH)\b/i.test(stripped))
    fail2(`${id}: a sql rule query must start with SELECT or WITH`);
  return text;
}
function parse(rule, table, column) {
  if (!rule || typeof rule !== "object") return void 0;
  const where = table + (column ? "." + column : "");
  if (rule.type === "sql") {
    const present2 = OPERATORS.filter((o) => rule[o] !== void 0);
    if (present2.length !== 1)
      fail2(`${where}: a sql rule needs exactly one comparison`);
    return {
      id: String(rule.id ?? `${where}.sql`),
      table,
      ...column ? { column } : {},
      metric: "sql",
      query: rule.query,
      operator: present2[0],
      threshold: rule[present2[0]],
      arguments: {},
      unit: "rows",
      outcome: /^error$/i.test(String(rule.severity ?? "")) ? "fail" : "warn",
      source: "contract"
    };
  }
  if ((rule.type ?? "library") !== "library") return void 0;
  if (!METRICS.includes(rule.metric))
    fail2(`${where}: unsupported library metric ${rule.metric}`);
  const present = OPERATORS.filter((o) => rule[o] !== void 0);
  if (present.length !== 1)
    fail2(`${where}: a library rule needs exactly one comparison`);
  return {
    id: String(rule.id ?? `${where}.${rule.metric}`),
    table,
    ...column ? { column } : {},
    metric: rule.metric,
    operator: present[0],
    threshold: rule[present[0]],
    arguments: rule.arguments ?? {},
    unit: rule.unit ?? "rows",
    outcome: /^error$/i.test(String(rule.severity ?? "")) ? "fail" : "warn",
    source: "contract"
  };
}
function contractRules(contract) {
  const object = contract.schema?.[0] ?? {};
  const table = String(object.name ?? "table");
  const rules = [];
  const add = (r) => r && rules.push(r);
  for (const q of contract.quality ?? []) add(parse(q, "*"));
  for (const q of object.quality ?? []) add(parse(q, table));
  const keys = [];
  for (const p of object.properties ?? []) {
    for (const q of p.quality ?? []) add(parse(q, table, p.name));
    if (p.primaryKey === true) keys.push(p.name);
  }
  for (const column of keys)
    if (!rules.some((r) => r.column === column && r.metric === "nullValues"))
      rules.push({
        id: `${table}.${column}.key-not-null`,
        table,
        column,
        metric: "nullValues",
        operator: "mustBe",
        threshold: 0,
        arguments: {},
        unit: "rows",
        outcome: "fail",
        source: "primary-key"
      });
  if (keys.length && !rules.some((r) => !r.column && r.metric === "duplicateValues"))
    rules.push({
      id: `${table}.key-unique`,
      table,
      metric: "duplicateValues",
      operator: "mustBe",
      threshold: 0,
      arguments: { properties: keys },
      unit: "rows",
      outcome: "fail",
      source: "primary-key"
    });
  return rules;
}
var dialects = {
  tsql: {
    quote: (n) => "[" + n.replaceAll("]", "]]") + "]",
    count: "COUNT_BIG",
    ifNull: "ISNULL",
    text: (v) => `N'${v.replaceAll("'", "''")}'`,
    alias: " AS d",
    dual: "",
    regex: void 0
  },
  postgres: {
    quote: (n) => `"${n.replaceAll('"', '""')}"`,
    count: "COUNT",
    ifNull: "COALESCE",
    text: (v) => `'${v.replaceAll("'", "''")}'`,
    alias: " AS d",
    dual: "",
    regex: (c, p) => `CAST(${c} AS TEXT) !~ ${p}`
  },
  mysql: {
    quote: (n) => "`" + n.replaceAll("`", "``") + "`",
    count: "COUNT",
    ifNull: "COALESCE",
    text: (v) => `'${v.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`,
    alias: " AS d",
    dual: "",
    regex: (c, p) => `NOT REGEXP_LIKE(${c}, ${p})`
  },
  oracle: {
    quote: (n) => `"${n.replaceAll('"', '""')}"`,
    count: "COUNT",
    ifNull: "COALESCE",
    text: (v) => `'${v.replaceAll("'", "''")}'`,
    // Oracle rejects AS before a table alias and needs a FROM clause.
    alias: " d",
    dual: " FROM DUAL",
    regex: (c, p) => `NOT REGEXP_LIKE(${c}, ${p})`
  }
};
var numeric = (type) => /^(BIGINT|INT|INTEGER|SMALLINT|DOUBLE|FLOAT|DECIMAL)/.test(type);
function literals(values, type, d) {
  return (Array.isArray(values) ? values : []).flatMap(
    (v) => type === "STRING" && typeof v === "string" ? [d.text(v)] : numeric(type) && typeof v === "number" && Number.isFinite(v) ? [String(v)] : type === "BOOLEAN" && typeof v === "boolean" ? [v ? "1" : "0"] : []
  );
}
function measure(rule, column, properties, from, d) {
  const sum = (condition) => `${d.ifNull}(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END), 0)`;
  if (rule.metric === "rowCount") return `${d.count}(*)`;
  if (rule.metric === "duplicateValues") {
    if (column) return `${d.count}(${column}) - ${d.count}(DISTINCT ${column})`;
    return `${d.count}(*) - (SELECT ${d.count}(*) FROM (SELECT DISTINCT ${properties.join(", ")} FROM ${from})${d.alias})`;
  }
  const { name, type } = column;
  const c = d.quote(name);
  if (rule.metric === "nullValues") return sum(`${c} IS NULL`);
  if (rule.metric === "missingValues") {
    const missing = literals(
      rule.arguments.missingValues ?? [null, ""],
      type,
      d
    );
    return sum(
      missing.length ? `${c} IS NULL OR ${c} IN (${missing.join(", ")})` : `${c} IS NULL`
    );
  }
  if (typeof rule.arguments.pattern === "string") {
    if (!d.regex)
      fail2(
        `${rule.id}: SQL Server has no portable regular expressions; use arguments.validValues or a Databricks standard`
      );
    return sum(
      `${c} IS NOT NULL AND ${d.regex(c, d.text(`^(${rule.arguments.pattern})$`).replace(/^N/, ""))}`
    );
  }
  const valid = literals(rule.arguments.validValues, type, d);
  return sum(
    valid.length ? `${c} IS NOT NULL AND ${c} NOT IN (${valid.join(", ")})` : `${c} IS NOT NULL`
  );
}
function qualityRules(contract, columns) {
  const object = contract.schema?.[0] ?? {};
  const physical = new Map(
    (object.properties ?? []).map((p) => [p.name, p.physicalName ?? p.name])
  );
  const byName = new Map(columns.map((c) => [c.name, c]));
  const column = (rule, name) => byName.get(physical.get(name) ?? name) ?? fail2(`${rule.id}: unknown contract column ${name}`);
  return contractRules(contract).map((rule) => {
    if (rule.metric === "sql") {
      passing(rule);
      return {
        id: rule.id,
        metric: "sql",
        query: sqlShape(rule.id, rule.query),
        ...rule.column ? { column: column(rule, rule.column).name } : {},
        operator: rule.operator,
        threshold: rule.threshold,
        unit: "rows",
        outcome: rule.outcome
      };
    }
    if (["nullValues", "missingValues", "invalidValues"].includes(rule.metric) && !rule.column)
      fail2(`${rule.id}: ${rule.metric} needs a column`);
    const properties = (rule.arguments.properties ?? []).map(
      (p) => column(rule, p).name
    );
    if (rule.metric === "duplicateValues" && !rule.column && !properties.length)
      fail2(`${rule.id}: table duplicateValues needs arguments.properties`);
    passing(rule);
    return {
      id: rule.id,
      metric: rule.metric,
      ...rule.column ? { column: column(rule, rule.column).name } : {},
      ...properties.length ? { properties } : {},
      ...rule.arguments.validValues !== void 0 ? { validValues: rule.arguments.validValues } : {},
      ...rule.arguments.missingValues !== void 0 ? { missingValues: rule.arguments.missingValues } : {},
      ...typeof rule.arguments.pattern === "string" ? { pattern: rule.arguments.pattern } : {},
      operator: rule.operator,
      threshold: rule.threshold,
      unit: rule.unit,
      outcome: rule.outcome
    };
  });
}
function qualityQuery(rules, columns, schema, table, dialect = "tsql") {
  const d = dialects[dialect] ?? fail2(`Unsupported SQL dialect ${dialect}`);
  const types = new Map(columns.map((c) => [c.name, c.type]));
  const from = `${d.quote(schema)}.${d.quote(table)}`;
  const selected = rules.map((rule, i) => {
    if (rule.metric === "sql")
      return `(${rule.query.replaceAll("${table}", from).replaceAll(
        "${column}",
        rule.column ? d.quote(rule.column) : "${column}"
      )}) AS q${i}`;
    const target = rule.column ? { name: rule.column, type: types.get(rule.column) } : void 0;
    let value = measure(
      {
        ...rule,
        arguments: {
          validValues: rule.validValues,
          missingValues: rule.missingValues,
          pattern: rule.pattern
        }
      },
      rule.metric === "duplicateValues" && target ? d.quote(target.name) : target,
      (rule.properties ?? []).map(d.quote),
      from,
      d
    );
    if (rule.unit === "percent" && rule.metric !== "rowCount")
      value = `${d.ifNull}(CAST(100.0 * (${value}) / NULLIF(${d.count}(*), 0) AS DECIMAL(9, 4)), 0)`;
    return `(SELECT ${value} FROM ${from}) AS q${i}`;
  });
  return `SELECT ${selected.join(", ")}${d.dual}`;
}
var passing = (c, value = "x") => {
  const t = c.threshold;
  if (c.operator === "mustBeBetween" || c.operator === "mustNotBeBetween") {
    if (!Array.isArray(t) || t.length !== 2 || !t.every(Number.isFinite))
      fail2(`${c.id}: between comparisons need two numeric bounds`);
    const inside = `and(greaterOrEquals(${value}, ${t[0]}), lessOrEquals(${value}, ${t[1]}))`;
    return c.operator === "mustBeBetween" ? inside : `not(${inside})`;
  }
  if (!Number.isFinite(t))
    fail2(`${c.id}: comparison needs a numeric threshold`);
  return {
    mustBe: `equals(${value}, ${t})`,
    mustNotBe: `not(equals(${value}, ${t}))`,
    mustBeGreaterThan: `greater(${value}, ${t})`,
    mustBeGreaterOrEqualTo: `greaterOrEquals(${value}, ${t})`,
    mustBeLessThan: `less(${value}, ${t})`,
    mustBeLessOrEqualTo: `lessOrEquals(${value}, ${t})`
  }[c.operator];
};
function passingExpression(rules) {
  const conditions = rules.flatMap(
    (c, i) => c.outcome === "fail" ? [passing(c, `activity('CheckQuality').output.firstRow.q${i}`)] : []
  );
  if (!conditions.length) return void 0;
  return conditions.length === 1 ? `@${conditions[0]}` : `@and(${conditions.join(", ")})`;
}

// src/sql-sources.mjs
var sqlSources = {
  "azure-sql": {
    dataset: "AzureSqlTable",
    source: "AzureSqlSource",
    query: "sqlReaderQuery",
    dialect: "tsql",
    options: { partitionOption: "None" },
    table: (s) => ({ schema: s.schema, table: s.table })
  },
  "sql-server": {
    dataset: "SqlServerTable",
    source: "SqlSource",
    query: "sqlReaderQuery",
    dialect: "tsql",
    options: { partitionOption: "None" },
    table: (s) => ({ schema: s.schema, table: s.table })
  },
  postgresql: {
    dataset: "PostgreSqlV2Table",
    source: "PostgreSqlV2Source",
    query: "query",
    dialect: "postgres",
    options: {},
    table: (s) => ({ schema: s.schema, table: s.table })
  },
  mysql: {
    dataset: "MySqlTable",
    source: "MySqlSource",
    query: "query",
    dialect: "mysql",
    options: {},
    // MySQL has no schema below the database; `schema` names the database.
    table: (s) => ({ tableName: s.table })
  },
  oracle: {
    dataset: "OracleTable",
    source: "OracleSource",
    query: "oracleReaderQuery",
    dialect: "oracle",
    options: {},
    table: (s) => ({ schema: s.schema, table: s.table })
  }
};
var sqlKinds = Object.keys(sqlSources);
function selectQuery(kind, columns, schema, table) {
  const { quote } = dialects[sqlSources[kind].dialect];
  return `SELECT ${columns.map((c) => quote(c.name)).join(", ")} FROM ${quote(schema)}.${quote(table)}`;
}

// src/index.mjs
var check2 = (ok, message) => {
  if (!ok) throw new Error(message);
};
var ident = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);
var sqlTable = (v) => typeof v === "string" && v.length <= 128 && /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z0-9_]+)*$/.test(v);
var resource = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(v);
var path = (v) => typeof v === "string" && v.length <= 512 && v.split("/").every(
  (x) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(x) && x !== "." && x !== ".."
);
var strict = (v, keys, label) => check2(
  v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => keys.includes(k)),
  `Unsupported ${label} settings`
);
var standards = [
  {
    id: metadataStandard,
    sources: ["azure-sql", "sql-server"],
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "reviewed metadata-driven snapshots with per-worker count receipts"
  },
  {
    id: "snapshot-to-databricks@v1",
    sources: sqlKinds,
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "verified Parquet and atomically updated delivery index via a native Databricks notebook"
  },
  {
    id: "snapshot-land@v1",
    sources: sqlKinds,
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "isolated snapshot files; downstream publication required"
  },
  {
    id: "immutable-file-copy@v1",
    sources: ["adls", "s3", "sftp"],
    dataFlow: "forbidden",
    consistency: "completed immutable file",
    delivery: "one preserved binary file per run"
  }
];
var checked = /* @__PURE__ */ new Set(["snapshot-land@v1", "snapshot-to-databricks@v1"]);
function expand({ flow, providerSource, columns = {} }) {
  check2(flow.kind === "ingestion", "ADF standards require ingestion flows");
  strict(
    flow.ingestion,
    [
      "standard",
      "target",
      "allowEmpty",
      "publication",
      "handover",
      "group",
      "parallelism"
    ],
    "ingestion"
  );
  const standard = standards.find((s) => s.id === flow.ingestion.standard);
  check2(standard, "Unsupported ADF standard; Data Flow fallback is forbidden");
  check2(
    !flow.steps && !Object.keys(flow.defaults.with ?? {}).length,
    "ADF standards own steps"
  );
  const steps = Object.entries(flow.tables ?? {}).map(([table, value]) => {
    check2(
      !value.ingestion && !Object.keys(value.steps ?? {}).length,
      "ADF table ingestion/step overrides are not supported"
    );
    const quality = checked.has(standard.id) && value.contract ? qualityRules(value.contract, columns[table] ?? []) : [];
    return {
      id: `copy_${table}`,
      uses: "copy@v1",
      select: [table],
      with: quality.length ? { ...flow.ingestion, quality } : flow.ingestion
    };
  });
  return {
    steps,
    recovery: {
      standard: standard.id,
      provider: providerSource,
      dataFlow: "forbidden",
      actualCompleteness: "unverified",
      replaySource: "source-owner-retention",
      detail: standard.id === "snapshot-to-databricks@v1" ? "Copy, count gate, then versioned native Databricks publication. Recover publication with the original run receipt; never recopy an already committed delivery." : "Each run creates an isolated landing directory. Failed runs are unpublished. No automatic deduplication, watermark or cumulative delivery-index publication.",
      assumptions: [
        standard.consistency,
        "Existing linked services and runtime connectivity are separately accepted."
      ]
    }
  };
}
function validate(plan) {
  check2(plan.nodes.length > 0, "ADF export requires nodes");
  const names = /* @__PURE__ */ new Set();
  for (const n of plan.nodes) {
    check2(
      n.platform === "adf" && n.uses.split("@")[0] === "copy",
      "ADF exports accept only Copy standards"
    );
    check2(
      n.needs.length === 0,
      "Cross-table dependencies require a future ADF orchestration standard"
    );
    check2(
      !Object.keys(plan.flows.find((f) => f.id === n.flow)?.requires ?? {}).length,
      "Cross-provider handover is an external delivery boundary"
    );
    const name = `${plan.project}_${n.flow}_${n.table}`;
    check2(
      resource(name) && !names.has(name),
      "Invalid or colliding ADF resource name"
    );
    names.add(name);
    const binding = plan.bindings[n.binding];
    strict(binding, ["kind", "factoryName"], "ADF binding");
    check2(
      binding.kind === "adf" && resource(binding.factoryName),
      "Reference an existing ADF factoryName"
    );
    strict(n.runtime.options ?? {}, ["timeout"], "provider");
    const s = n.source, w = n.with, t = w.target;
    check2(s, "Source is required");
    strict(
      w,
      [
        "standard",
        "target",
        "allowEmpty",
        "publication",
        "handover",
        "group",
        "parallelism",
        "quality"
      ],
      "standard"
    );
    check2(
      w.quality === void 0 || checked.has(w.standard),
      "Contract quality checks apply to SQL snapshot standards only"
    );
    strict(
      t,
      ["linkedService", "fileSystem", "path", "storageAccount"],
      "target"
    );
    check2(
      resource(t.linkedService) && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(t.fileSystem) && path(t.path),
      "Target requires existing ADLS linkedService, fileSystem and safe path"
    );
    check2(
      w.allowEmpty === void 0 || typeof w.allowEmpty === "boolean",
      "allowEmpty must be boolean"
    );
    if (w.standard === metadataStandard) {
      check2(ident(w.group), "Metadata snapshots require a safe named group");
      check2(
        w.parallelism === void 0 || Number.isInteger(w.parallelism) && w.parallelism >= 1 && w.parallelism <= 16,
        "Metadata parallelism must be an integer from 1 to 16"
      );
      check2(
        w.handover === void 0,
        "Metadata snapshots do not yet expose a handover protocol"
      );
      check2(
        Object.values(metadataNames(plan.project, w.group)).every(resource),
        "Metadata resource names exceed the supported length"
      );
    } else
      check2(
        w.group === void 0 && w.parallelism === void 0,
        "group and parallelism require metadata-snapshot-land@v1"
      );
    if (w.standard === "snapshot-to-databricks@v1") validatePublication(n);
    else
      check2(
        w.publication === void 0 && t.storageAccount === void 0,
        "Publication settings require snapshot-to-databricks@v1"
      );
    if ([
      "snapshot-land@v1",
      "snapshot-to-databricks@v1",
      metadataStandard
    ].includes(w.standard)) {
      strict(
        s,
        ["kind", "linkedService", "schema", "table", "consistency"],
        "SQL source"
      );
      check2(
        w.standard === metadataStandard ? ["azure-sql", "sql-server"].includes(s.kind) : sqlKinds.includes(s.kind),
        w.standard === metadataStandard ? "Metadata snapshots support Azure SQL and SQL Server only" : `Snapshots support ${sqlKinds.join(", ")}`
      );
      check2(
        !w.quality?.some((q) => q.pattern !== void 0) || sqlSources[s.kind].dialect !== "tsql",
        "Pattern quality rules need a source with regular expressions; SQL Server has none that are portable. Use arguments.validValues or another source"
      );
      check2(
        s.consistency === "frozen-extract",
        "Snapshot source must remain immutable throughout extraction and retries; mutable live-table reads are not complete snapshots"
      );
      check2(
        resource(s.linkedService) && ident(s.schema) && sqlTable(s.table),
        "SQL source identifiers are required"
      );
      check2(
        n.columns.length > 0 && n.columns.every((c) => ident(c.name)),
        "Explicit reviewed contract columns are required"
      );
      check2(
        !n.columns.some((c) => c.type === "BINARY"),
        "BINARY SQL columns require a separately tested mapping"
      );
    } else {
      check2(
        w.standard === "immutable-file-copy@v1",
        "Unsupported standard; Data Flow is forbidden"
      );
      strict(
        s,
        [
          "kind",
          "linkedService",
          "fileSystem",
          "bucket",
          "folder",
          "fileName",
          "completion",
          "format"
        ],
        "file source"
      );
      check2(
        ["adls", "s3", "sftp"].includes(s.kind) && resource(s.linkedService),
        "Files support ADLS, S3 and SFTP only"
      );
      check2(
        s.format === void 0 || ["csv", "tsv", "json", "jsonl", "parquet", "xml", "xlsx"].includes(
          s.format
        ),
        "Unsupported source file format"
      );
      check2(
        s.completion === "immutable" && path(s.folder) && path(s.fileName) && !s.fileName.includes("/"),
        "Specify one completed immutable file; wildcards and mutable files are unsupported"
      );
      check2(
        s.kind === "adls" ? /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(s.fileSystem) : s.fileSystem === void 0,
        "fileSystem applies to ADLS only"
      );
      check2(
        s.kind === "s3" ? /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(s.bucket) : s.bucket === void 0,
        "bucket applies to S3 only and must be a valid bucket name"
      );
      check2(w.allowEmpty === void 0, "allowEmpty applies to snapshots only");
    }
  }
  if (plan.nodes.some((n) => n.with.standard === metadataStandard)) {
    check2(
      plan.nodes.every((n) => n.with.standard === metadataStandard),
      "Metadata snapshots require a separate export from legacy standards"
    );
    metadataGroups(plan);
  }
  check2(
    new Set(plan.nodes.map((n) => plan.bindings[n.binding].factoryName)).size === 1,
    "One existing factory per export"
  );
}
var expression2 = (value) => ({ type: "Expression", value });
function render(plan) {
  validate(plan);
  const assets = {}, resources = [];
  const add = (kind, name, properties, dependencies = [], pipelineDependencies = []) => {
    assets[`${kind}/${name}.json`] = {
      format: "json",
      value: { name, properties }
    };
    resources.push({
      type: `Microsoft.DataFactory/factories/${kind}`,
      apiVersion: "2018-06-01",
      name: `[concat(parameters('factoryName'), '/${name}')]`,
      properties,
      dependsOn: [
        ...dependencies.map(
          (d) => `[resourceId('Microsoft.DataFactory/factories/datasets', parameters('factoryName'), '${d}')]`
        ),
        ...pipelineDependencies.map(
          (d) => `[resourceId('Microsoft.DataFactory/factories/pipelines', parameters('factoryName'), '${d}')]`
        )
      ]
    });
  };
  if (plan.nodes[0].with.standard === metadataStandard)
    renderMetadata(plan, add, assets);
  else
    for (const n of plan.nodes) {
      const s = n.source, w = n.with, t = w.target, snapshot = [
        "snapshot-land@v1",
        "snapshot-to-databricks@v1",
        metadataStandard
      ].includes(w.standard);
      const name = `${plan.project}_${n.flow}_${n.table}`, src = `${name}_source`, sink = `${name}_landing`;
      const sourceLocation = s.kind === "sftp" ? { type: "SftpLocation", folderPath: s.folder, fileName: s.fileName } : s.kind === "s3" ? {
        type: "AmazonS3Location",
        bucketName: s.bucket,
        folderPath: s.folder,
        fileName: s.fileName
      } : {
        type: "AzureBlobFSLocation",
        fileSystem: s.fileSystem,
        folderPath: s.folder,
        fileName: s.fileName
      };
      const sql = snapshot ? sqlSources[s.kind] : void 0;
      add("datasets", src, {
        type: snapshot ? sql.dataset : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: s.linkedService
        },
        typeProperties: snapshot ? sql.table(s) : { location: sourceLocation }
      });
      add("datasets", sink, {
        type: snapshot ? "Parquet" : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: t.linkedService
        },
        parameters: { runId: { type: "String" } },
        typeProperties: {
          location: {
            type: "AzureBlobFSLocation",
            fileSystem: t.fileSystem,
            folderPath: expression2(
              `@concat('${t.path}/${n.flow}/${n.table}/', dataset().runId)`
            ),
            ...!snapshot ? { fileName: s.fileName } : {}
          },
          ...snapshot ? { compressionCodec: "snappy" } : {}
        }
      });
      const policy = {
        timeout: n.runtime.options?.timeout ?? "00.01:00:00",
        retry: 0,
        secureInput: true,
        secureOutput: true
      };
      const copy = {
        name: "Copy",
        type: "Copy",
        policy,
        typeProperties: {
          source: snapshot ? {
            type: sql.source,
            [sql.query]: selectQuery(s.kind, n.columns, s.schema, s.table),
            ...sql.options
          } : {
            type: "BinarySource",
            storeSettings: {
              type: s.kind === "sftp" ? "SftpReadSettings" : s.kind === "s3" ? "AmazonS3ReadSettings" : "AzureBlobFSReadSettings",
              recursive: false
            }
          },
          sink: snapshot ? {
            type: "ParquetSink",
            storeSettings: { type: "AzureBlobFSWriteSettings" },
            formatSettings: { type: "ParquetWriteSettings" }
          } : {
            type: "BinarySink",
            storeSettings: { type: "AzureBlobFSWriteSettings" }
          },
          enableStaging: false,
          validateDataConsistency: true,
          ...snapshot ? {
            enableSkipIncompatibleRow: false,
            translator: {
              type: "TabularTranslator",
              mappings: n.columns.map((c) => ({
                source: { name: c.name },
                sink: { name: c.target ?? c.name }
              })),
              typeConversion: false
            }
          } : {}
        },
        inputs: [{ type: "DatasetReference", referenceName: src }],
        outputs: [
          {
            type: "DatasetReference",
            referenceName: sink,
            parameters: { runId: expression2("@pipeline().RunId") }
          }
        ]
      };
      const activities = [copy];
      if (w.quality?.length) {
        activities.unshift({
          name: "CheckQuality",
          type: "Lookup",
          policy,
          typeProperties: {
            source: {
              type: sql.source,
              [sql.query]: qualityQuery(
                w.quality,
                n.columns,
                s.schema,
                s.table,
                sql.dialect
              ),
              ...sql.options
            },
            dataset: { type: "DatasetReference", referenceName: src },
            firstRowOnly: true
          }
        });
        const passes = passingExpression(w.quality);
        if (passes)
          activities.splice(1, 0, {
            name: "VerifyQuality",
            type: "IfCondition",
            dependsOn: [
              { activity: "CheckQuality", dependencyConditions: ["Succeeded"] }
            ],
            typeProperties: {
              expression: expression2(passes),
              ifTrueActivities: [],
              ifFalseActivities: [
                {
                  name: "RejectContractQuality",
                  type: "Fail",
                  typeProperties: {
                    message: `Contract quality rules failed; nothing was copied. Error rules: ${w.quality.filter((q) => q.outcome === "fail").map((q) => q.id).join(", ")}. Counts are in the CheckQuality output.`,
                    errorCode: "INGESTRON_QUALITY_FAILED"
                  }
                }
              ]
            }
          });
        copy.dependsOn = [
          {
            activity: passes ? "VerifyQuality" : "CheckQuality",
            dependencyConditions: ["Succeeded"]
          }
        ];
      }
      if (snapshot)
        activities.push({
          name: "VerifyCount",
          type: "IfCondition",
          dependsOn: [
            { activity: "Copy", dependencyConditions: ["Succeeded"] }
          ],
          typeProperties: {
            expression: expression2(
              `@and(equals(activity('Copy').output.rowsCopied, pipeline().parameters.expectedRowCount), greaterOrEquals(pipeline().parameters.expectedRowCount, ${w.allowEmpty ? 0 : 1}))`
            ),
            ifTrueActivities: [],
            ifFalseActivities: [
              {
                name: "RejectIncompleteSnapshot",
                type: "Fail",
                typeProperties: {
                  message: "Snapshot count or empty-delivery policy failed. Do not publish this run.",
                  errorCode: "INGESTRON_SNAPSHOT_INCOMPLETE"
                }
              }
            ]
          }
        });
      let parameters = snapshot ? { expectedRowCount: { type: "Int" } } : {};
      const pipelineDependencies = [];
      if (w.standard === "snapshot-to-databricks@v1") {
        const publication = publicationPipeline(plan, n, name);
        add("pipelines", publication.name, publication.properties);
        pipelineDependencies.push(publication.name);
        parameters = { ...publication.properties.parameters };
        delete parameters.runId;
        activities.push({
          name: "Publish",
          type: "ExecutePipeline",
          dependsOn: [
            { activity: "VerifyCount", dependencyConditions: ["Succeeded"] }
          ],
          typeProperties: {
            pipeline: {
              type: "PipelineReference",
              referenceName: publication.name
            },
            waitOnCompletion: true,
            parameters: {
              ...Object.fromEntries(
                Object.keys(parameters).map((key) => [
                  key,
                  expression2(`@pipeline().parameters.${key}`)
                ])
              ),
              runId: expression2("@pipeline().RunId")
            }
          }
        });
        assets[`handover/${name}.json`] = {
          format: "json",
          value: {
            apiVersion: publication.identity.protocol,
            ...publication.identity,
            deliveryIndex: publication.identity.sourceRoot + "/_ingestron/deliveries.json",
            publicationNotebook: w.publication.notebookPath,
            recoveryPipeline: publication.name,
            dataFlow: "forbidden"
          }
        };
      }
      add(
        "pipelines",
        name,
        {
          description: `${w.standard}; no Data Flow; publish only after the entire pipeline succeeds`,
          concurrency: 1,
          parameters,
          activities
        },
        [src, sink],
        pipelineDependencies
      );
    }
  assets["adf-template.json"] = {
    format: "json",
    value: {
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      contentVersion: "1.0.0.0",
      parameters: { factoryName: { type: "string" } },
      resources
    }
  };
  assets["adf-parameters.json"] = {
    format: "json",
    value: {
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      contentVersion: "1.0.0.0",
      parameters: {
        factoryName: {
          value: plan.bindings[plan.nodes[0].binding].factoryName
        }
      }
    }
  };
  assets["README.md"] = {
    format: "text",
    value: "# ADF landing export\n\nOffline candidate. Use incremental ARM deployment into the existing factory after review.\nDo not use complete-mode deployment. Existing linked services, identities, runtime\nnetworking, monitoring and storage retention are customer-owned.\n\nEach run writes a new RunId folder. Copy retries are disabled: restart the pipeline\nto get a fresh folder after failure. Never consume a folder merely because it exists.\nSnapshot pipelines require an independently determined expectedRowCount for the\nfrozen source. Only successful whole pipelines are eligible for publication.\n\nsnapshot-to-databricks@v1 invokes a separately deployed Databricks 1.3.0+ publisher\nusing the declared v1 protocol. Supply source-sequenced versions starting at one,\ndeliveryId/capturedAt and expectedRowCount. Initialise the index explicitly once.\nUse the generated _publish pipeline with the original runId to retry publication\nwithout copying again. The publisher verifies contracts/keys/counts and uses\nconditional Blob writes. Other landing standards do not publish delivery indexes.\nThe ADF linked-service identity governs notebook execution; verify its privileges\nseparately from any Databricks job run_as identity. File copy preserves bytes without validating content.\nNo CDC, delete capture, automatic deduplication or source cleanup is generated.\n"
  };
  if (plan.nodes[0].with.standard === metadataStandard)
    assets["README.md"].value = "# Metadata-driven ADF snapshots\n\nDeploy adf-template.json incrementally into the existing factory after review.\nEach named compatible group has a coordinator, worker and two datasets.\nmetadata/*.json records the compiler-reviewed catalogue; the deployed worker embeds\nit and accepts only tableId and expectedRowCount. Call the coordinator with tables\nand expectedCounts, or retry one failed table with a fresh worker run. Fill every\nselected count from an independently frozen source; null example values must be\nreplaced. Tables default to the compiled group. Shared linked services and identities\nremain externally owned. No schedules, control database or Data Flow are created.\n\nUse the worker runId from the ExecutePipeline activity output, not the coordinator\nrunId, to locate folder/<worker runId>/. Only Succeeded workers passing VerifyCount\nare eligible for consumption. A failed coordinator may contain successful workers;\nthere is no atomic group commit or cumulative publication index. Do not replay already\nconsumed tables without downstream duplicate handling. Failed folders are retained;\ncopy retries are zero and recovery uses fresh run folders. Source consistency,\nretention, keys/null checks, cross-table consistency and downstream publication remain\noperator responsibilities. See the provider docs/metadata-pipelines.md for limits.\n";
  return assets;
}
export {
  expand,
  render,
  standards,
  validate
};
