// Pure compiler helpers: no runtime code, credentials or platform access.
export const metadataStandard = "metadata-snapshot-land@v1";
const expr = (value) => ({ type: "Expression", value });
const after = (activity) => [{ activity, dependencyConditions: ["Succeeded"] }];
const fail = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { message, errorCode: "INGESTRON_METADATA_INVALID" },
});
const gate = (name, condition, message, dependency) => ({
  name,
  type: "IfCondition",
  ...(dependency ? { dependsOn: after(dependency) } : {}),
  typeProperties: {
    expression: expr(condition),
    ifTrueActivities: [],
    ifFalseActivities: [fail(`${name}Failed`, message)],
  },
});
export function metadataNames(project, group) {
  const base = `${project}_md_${group}`;
  return {
    coordinator: `${base}_run`,
    worker: `${base}_worker`,
    source: `${base}_sql`,
    sink: `${base}_parquet`,
  };
}
export function metadataGroups(plan) {
  const groups = new Map();
  for (const node of plan.nodes) {
    const group = node.with.group;
    const settings = JSON.stringify([
      node.source.kind,
      node.source.linkedService,
      node.with.target.linkedService,
      node.runtime.options?.timeout ?? "00.01:00:00",
      node.with.parallelism ?? 2,
    ]);
    if (groups.has(group) && groups.get(group).settings !== settings)
      throw new Error(
        `Metadata group ${group} requires matching source kind, linked services, timeout and parallelism; choose separate groups`,
      );
    if (!groups.has(group)) groups.set(group, { settings, nodes: [] });
    groups.get(group).nodes.push(node);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
export function renderMetadata(plan, add, assets) {
  for (const [group, { nodes }] of metadataGroups(plan)) {
    nodes.sort((a, b) =>
      `${a.flow}/${a.table}` < `${b.flow}/${b.table}` ? -1 : 1,
    );
    if (nodes.length > 100)
      throw new Error("Metadata groups support at most 100 tables");
    const first = nodes[0],
      names = metadataNames(plan.project, group);
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
              sink: { name: c.target ?? c.name },
            })),
            typeConversion: false,
          },
          fileSystem: n.with.target.fileSystem,
          folder: `${n.with.target.path}/${n.flow}/${n.table}`,
          minimumRows: n.with.allowEmpty ? 0 : 1,
        },
      ]),
    );
    const encoded = JSON.stringify(catalogue);
    if (encoded.length > 200000)
      throw new Error(
        "Metadata catalogue exceeds 200,000 characters; split the group",
      );
    const variables = { catalogue: { type: "String", defaultValue: encoded } };
    const lookup =
      "json(variables('catalogue'))[pipeline().parameters.tableId]";
    const policy = {
      timeout: first.runtime.options?.timeout ?? "00.01:00:00",
      retry: 0,
      secureInput: true,
      secureOutput: true,
    };
    add("datasets", names.source, {
      type:
        first.source.kind === "azure-sql" ? "AzureSqlTable" : "SqlServerTable",
      linkedServiceName: {
        type: "LinkedServiceReference",
        referenceName: first.source.linkedService,
      },
      parameters: { schema: { type: "String" }, table: { type: "String" } },
      typeProperties: {
        schema: expr("@dataset().schema"),
        table: expr("@dataset().table"),
      },
    });
    add("datasets", names.sink, {
      type: "Parquet",
      linkedServiceName: {
        type: "LinkedServiceReference",
        referenceName: first.with.target.linkedService,
      },
      parameters: {
        fileSystem: { type: "String" },
        folder: { type: "String" },
        runId: { type: "String" },
      },
      typeProperties: {
        compressionCodec: "snappy",
        location: {
          type: "AzureBlobFSLocation",
          fileSystem: expr("@dataset().fileSystem"),
          folderPath: expr("@concat(dataset().folder, '/', dataset().runId)"),
        },
      },
    });
    add(
      "pipelines",
      names.worker,
      {
        description:
          "Reviewed metadata snapshot worker; consume only successful worker runs",
        concurrency: first.with.parallelism ?? 2,
        variables,
        parameters: {
          tableId: { type: "String" },
          expectedRowCount: { type: "Int" },
        },
        activities: [
          gate(
            "ValidateTable",
            "@contains(json(variables('catalogue')), pipeline().parameters.tableId)",
            "Unknown reviewed table ID",
          ),
          gate(
            "ValidateCount",
            `@and(greaterOrEquals(pipeline().parameters.expectedRowCount, ${lookup}.minimumRows), lessOrEquals(pipeline().parameters.expectedRowCount, 2147483647))`,
            "Invalid expected count or empty-table policy",
            "ValidateTable",
          ),
          {
            name: "Copy",
            type: "Copy",
            dependsOn: after("ValidateCount"),
            policy,
            typeProperties: {
              source: {
                type:
                  first.source.kind === "azure-sql"
                    ? "AzureSqlSource"
                    : "SqlSource",
                sqlReaderQuery: expr(`@${lookup}.query`),
                partitionOption: "None",
              },
              sink: {
                type: "ParquetSink",
                storeSettings: { type: "AzureBlobFSWriteSettings" },
                formatSettings: { type: "ParquetWriteSettings" },
              },
              translator: expr(`@${lookup}.translator`),
              enableStaging: false,
              validateDataConsistency: true,
              enableSkipIncompatibleRow: false,
            },
            inputs: [
              {
                type: "DatasetReference",
                referenceName: names.source,
                parameters: {
                  schema: expr(`@${lookup}.schema`),
                  table: expr(`@${lookup}.table`),
                },
              },
            ],
            outputs: [
              {
                type: "DatasetReference",
                referenceName: names.sink,
                parameters: {
                  fileSystem: expr(`@${lookup}.fileSystem`),
                  folder: expr(`@${lookup}.folder`),
                  runId: expr("@pipeline().RunId"),
                },
              },
            ],
          },
          gate(
            "VerifyCount",
            "@equals(activity('Copy').output.rowsCopied, pipeline().parameters.expectedRowCount)",
            "Snapshot row count mismatch; do not consume this run",
            "Copy",
          ),
        ],
      },
      [names.source, names.sink],
    );
    const filter = (name, condition, dependency) => ({
      name,
      type: "Filter",
      ...(dependency ? { dependsOn: after(dependency) } : {}),
      typeProperties: {
        items: expr("@pipeline().parameters.tables"),
        condition: expr(condition),
      },
    });
    add(
      "pipelines",
      names.coordinator,
      {
        description:
          "Select reviewed table IDs and independently established counts; no runtime SQL or destination overrides",
        concurrency: 1,
        variables,
        parameters: {
          tables: { type: "Array", defaultValue: Object.keys(catalogue) },
          expectedCounts: { type: "Object" },
        },
        activities: [
          filter(
            "UnknownTables",
            "@not(contains(json(variables('catalogue')), item()))",
          ),
          gate(
            "ValidateSelection",
            "@and(and(greater(length(pipeline().parameters.tables), 0), lessOrEquals(length(pipeline().parameters.tables), 100)), and(equals(length(activity('UnknownTables').output.value), 0), equals(length(union(pipeline().parameters.tables, pipeline().parameters.tables)), length(pipeline().parameters.tables))))",
            "Select 1–100 unique reviewed table IDs",
            "UnknownTables",
          ),
          filter(
            "MissingCounts",
            "@not(contains(pipeline().parameters.expectedCounts, item()))",
            "ValidateSelection",
          ),
          gate(
            "ValidateCountsPresent",
            "@equals(length(activity('MissingCounts').output.value), 0)",
            "Every selected table requires an independently established count",
            "MissingCounts",
          ),
          filter(
            "InvalidCounts",
            "@not(and(equals(string(int(pipeline().parameters.expectedCounts[item()])), string(pipeline().parameters.expectedCounts[item()])), and(greaterOrEquals(int(pipeline().parameters.expectedCounts[item()]), json(variables('catalogue'))[item()].minimumRows), lessOrEquals(int(pipeline().parameters.expectedCounts[item()]), 2147483647))))",
            "ValidateCountsPresent",
          ),
          gate(
            "ValidateCounts",
            "@equals(length(activity('InvalidCounts').output.value), 0)",
            "Counts must be integers within the table policy and 32-bit positive range",
            "InvalidCounts",
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
                      referenceName: names.worker,
                    },
                    waitOnCompletion: true,
                    parameters: {
                      tableId: expr("@item()"),
                      expectedRowCount: expr(
                        "@int(pipeline().parameters.expectedCounts[item()])",
                      ),
                    },
                  },
                },
              ],
            },
          },
        ],
      },
      [],
      [names.worker],
    );
    assets[`metadata/${group}.json`] = {
      format: "json",
      value: {
        apiVersion: "ingestron.adf-metadata/v1",
        group,
        ...names,
        catalogue,
      },
    };
    assets[`metadata/${group}.parameters.example.json`] = {
      format: "json",
      value: {
        tables: Object.keys(catalogue),
        expectedCounts: Object.fromEntries(
          Object.keys(catalogue).map((k) => [k, null]),
        ),
      },
    };
  }
}
