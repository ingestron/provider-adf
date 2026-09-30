import { runner } from "./deployment-runner.mjs";
const require = (v, m) => {
  if (!v) throw new Error(m);
};
const id = (v) =>
  typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v);
const ref = (name, type) => ({ referenceName: name, type });
export const sourceTypes = {
  "azure-sql": ["AzureSqlTable", "AzureSqlSource", "sqlReaderQuery"],
  "sql-server": ["SqlServerTable", "SqlSource", "sqlReaderQuery"],
  postgresql: ["PostgreSqlV2Table", "PostgreSqlV2Source", "query"],
  mysql: ["MySqlTable", "MySqlSource", "query"],
  oracle: ["OracleTable", "OracleSource", "oracleReaderQuery"],
};
export function metadataQuery(kind, schemas, tables = []) {
  require(Array.isArray(tables) &&
    tables.length <= 100 &&
    tables.every(
      (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_ ]{0,127}$/.test(v),
    ), "Invalid explicit table selection");
  const tableScope = tables.map((t) => `'${t}'`).join(",");
  require(sourceTypes[kind], "Unsupported discovery source kind");
  require(Array.isArray(schemas) &&
    schemas.length > 0 &&
    schemas.length <= 20 &&
    schemas.every(id), "Supply 1–20 explicit simple schema names");
  const scope = schemas.map((s) => `'${s}'`).join(",");
  // Every dialect returns the same columns: schema_name, table_name,
  // column_name, ordinal_position, data_type, numeric_precision/precision,
  // numeric_scale/scale, max_length, nullable and primary_key.
  if (kind === "mysql")
    return `SELECT c.TABLE_SCHEMA AS schema_name, c.TABLE_NAME AS table_name, c.COLUMN_NAME AS column_name,
 c.ORDINAL_POSITION AS ordinal_position, c.DATA_TYPE AS data_type, c.NUMERIC_PRECISION AS numeric_precision,
 c.NUMERIC_SCALE AS numeric_scale, c.CHARACTER_MAXIMUM_LENGTH AS max_length,
 (c.IS_NULLABLE = 'YES') AS nullable, (c.COLUMN_KEY = 'PRI') AS primary_key
 FROM information_schema.COLUMNS c JOIN information_schema.TABLES t
 ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
 WHERE t.TABLE_TYPE = 'BASE TABLE' AND c.TABLE_SCHEMA IN (${scope})${tables.length ? ` AND c.TABLE_NAME IN (${tableScope})` : ""}
 ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`;
  if (kind === "oracle")
    return `SELECT c.owner AS schema_name, c.table_name AS table_name, c.column_name AS column_name,
 c.column_id AS ordinal_position, c.data_type AS data_type, c.data_precision AS numeric_precision,
 c.data_scale AS numeric_scale, c.data_length AS max_length,
 CASE WHEN c.nullable = 'Y' THEN 1 ELSE 0 END AS nullable,
 CASE WHEN EXISTS (SELECT 1 FROM all_constraints k JOIN all_cons_columns kc
 ON kc.owner = k.owner AND kc.constraint_name = k.constraint_name
 WHERE k.constraint_type = 'P' AND k.owner = c.owner AND k.table_name = c.table_name
 AND kc.column_name = c.column_name) THEN 1 ELSE 0 END AS primary_key
 FROM all_tab_columns c JOIN all_tables t ON t.owner = c.owner AND t.table_name = c.table_name
 WHERE c.owner IN (${scope})${tables.length ? ` AND c.table_name IN (${tableScope})` : ""}
 ORDER BY c.owner, c.table_name, c.column_id`;
  if (kind === "postgresql")
    return `SELECT c.table_schema AS schema_name, c.table_name, c.column_name,
 c.ordinal_position, c.udt_name AS data_type, c.numeric_precision AS precision,
 c.numeric_scale AS scale, c.character_maximum_length AS max_length,
 (c.is_nullable = 'YES') AS nullable,
 EXISTS (SELECT 1 FROM information_schema.table_constraints tc
 JOIN information_schema.key_column_usage k ON k.constraint_catalog=tc.constraint_catalog
 AND k.constraint_schema=tc.constraint_schema AND k.constraint_name=tc.constraint_name
 AND k.table_schema=tc.table_schema AND k.table_name=tc.table_name
 WHERE tc.constraint_type='PRIMARY KEY' AND k.table_schema=c.table_schema
 AND k.table_name=c.table_name AND k.column_name=c.column_name) AS primary_key
 FROM information_schema.columns c JOIN information_schema.tables t
 ON t.table_schema=c.table_schema AND t.table_name=c.table_name
 WHERE t.table_type='BASE TABLE' AND c.table_schema IN (${scope})${tables.length ? ` AND c.table_name IN (${tableScope})` : ""}
 ORDER BY c.table_schema,c.table_name,c.ordinal_position`;
  return `SELECT s.name AS schema_name, t.name AS table_name, c.name AS column_name,
 c.column_id AS ordinal_position, ty.name AS data_type, c.precision AS precision,
 c.scale AS scale, c.max_length AS max_length, c.is_nullable AS nullable,
 CAST(CASE WHEN EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic
 ON ic.object_id=i.object_id AND ic.index_id=i.index_id
 WHERE i.is_primary_key=1 AND ic.object_id=t.object_id AND ic.column_id=c.column_id)
 THEN 1 ELSE 0 END AS bit) AS primary_key
 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
 JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
 WHERE t.is_ms_shipped=0 AND s.name IN (${scope})${tables.length ? ` AND t.name IN (${tableScope})` : ""}
 ORDER BY s.name,t.name,c.column_id`;
}
export function discoveryPrepare(input) {
  const {
    useCase,
    factoryName,
    location,
    sourceKind,
    sourceLinkedService,
    sinkLinkedService,
    fileSystem,
    schemas,
  } = input;
  require(id(useCase) &&
    useCase.length <=
      32, "Use a simple useCase identifier up to 32 characters");
  require(typeof factoryName === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9-]{1,61}[A-Za-z0-9]$/.test(
      factoryName,
    ), "Invalid factory name");
  require(typeof location === "string" &&
    /^[a-z0-9]+$/.test(location), "Supply an Azure location");
  require(id(sourceLinkedService) &&
    id(sinkLinkedService), "Use simple linked-service names");
  require(typeof fileSystem === "string" &&
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(
      fileSystem,
    ), "Invalid ADLS filesystem");
  require(["new-factory", "existing-factory"].includes(
    input.mode,
  ), "Select new-factory or existing-factory mode");
  const query = metadataQuery(sourceKind, schemas, input.tables),
    prefix = `ingestron_${useCase}`,
    annotations = [`ingestron:${useCase}`];
  const resource = (kind, name, properties) => ({
    type: `Microsoft.DataFactory/factories/${kind}`,
    apiVersion: "2018-06-01",
    name: `${factoryName}/${name}`,
    properties: { ...properties, annotations },
  });
  const sourceName = `${prefix}_source`,
    sinkName = `${prefix}_metadata`,
    pipelineName = `${prefix}_discover`;
  const [datasetType, copyType, queryKey] = sourceTypes[sourceKind];
  const resources = [
    resource("datasets", sourceName, {
      type: datasetType,
      linkedServiceName: ref(sourceLinkedService, "LinkedServiceReference"),
      typeProperties: {},
    }),
    resource("datasets", sinkName, {
      type: "Json",
      linkedServiceName: ref(sinkLinkedService, "LinkedServiceReference"),
      parameters: { runId: { type: "String" } },
      typeProperties: {
        location: {
          type: "AzureBlobFSLocation",
          fileSystem,
          folderPath: {
            type: "Expression",
            value: `@concat('discovery/${useCase}/',dataset().runId)`,
          },
          fileName: "metadata.json",
        },
      },
    }),
    resource("pipelines", pipelineName, {
      concurrency: 1,
      activities: [
        {
          name: "Export_catalogue_metadata",
          type: "Copy",
          policy: {
            timeout: "0.00:10:00",
            retry: 2,
            retryIntervalInSeconds: 30,
            secureInput: true,
            secureOutput: true,
          },
          inputs: [ref(sourceName, "DatasetReference")],
          outputs: [
            {
              ...ref(sinkName, "DatasetReference"),
              parameters: {
                runId: { type: "Expression", value: "@pipeline().RunId" },
              },
            },
          ],
          typeProperties: {
            source: {
              type: copyType,
              [queryKey]: query,
              queryTimeout: "00:05:00",
            },
            sink: {
              type: "JsonSink",
              storeSettings: { type: "AzureBlobFSWriteSettings" },
              formatSettings: {
                type: "JsonWriteSettings",
                filePattern: "arrayOfObjects",
              },
            },
            enableStaging: false,
          },
        },
      ],
    }),
  ];
  const factoryId = `[resourceId('Microsoft.DataFactory/factories','${factoryName}')]`;
  resources[2].dependsOn = [sourceName, sinkName].map(
    (n) =>
      `[resourceId('Microsoft.DataFactory/factories/datasets','${factoryName}','${n}')]`,
  );
  // Existing shared linked services are references, never deployment resources.
  if (input.mode === "new-factory") {
    for (const r of resources)
      r.dependsOn = [...(r.dependsOn ?? []), factoryId];
    resources.unshift({
      type: "Microsoft.DataFactory/factories",
      apiVersion: "2018-06-01",
      name: factoryName,
      location,
      identity: { type: "SystemAssigned" },
      tags: { "ingestron-use-case": useCase },
      properties: {},
    });
  }
  const template = {
    $schema:
      "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    resources,
  };
  const deployment = {
    apiVersion: "ingestron.adf-deployment/v1",
    factoryName,
    location,
    useCase,
    mode: input.mode,
    pipelineName,
    sourceKind,
    sourceLinkedService,
    sinkLinkedService,
    fileSystem,
    resourceNames: [sourceName, sinkName, pipelineName],
    deploymentMode: "Incremental",
  };
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts: {
      "template.json": JSON.stringify(template, null, 2),
      "deployment.json": JSON.stringify(deployment, null, 2),
      "metadata-query.sql": query,
      "deploy.py": runner,
    },
    review: [
      "Catalogue visibility can hide objects; verify source permissions and schema scope",
      "Configure the referenced linked services and required integration runtime before deployment",
      "Grant the factory metadata-output permissions; no automatic RBAC or firewall changes",
      "No schedules are created; trigger discovery explicitly after reviewing connections",
    ],
    deployed: false,
  };
}
function boolean(v, name) {
  require(typeof v === "boolean" ||
    v === 0 ||
    v === 1, `Explicit ${name} boolean required`);
  return v === true || v === 1;
}
function mappedType(row, kind) {
  const type = row.data_type.toLowerCase();
  if (["numeric", "decimal"].includes(type)) {
    require(Number.isInteger(row.precision) &&
      row.precision >= 1 &&
      row.precision <= 38 &&
      Number.isInteger(row.scale) &&
      row.scale >= 0 &&
      row.scale <=
        row.precision, "Unbounded or unsupported decimal precision/scale; review mapping");
    return ["number", `DECIMAL(${row.precision},${row.scale})`];
  }
  const map = {
    money: ["number", "DECIMAL(19,4)"],
    smallmoney: ["number", "DECIMAL(10,4)"],
    image: ["string", "BINARY"],
    bigint: ["integer", "BIGINT"],
    int8: ["integer", "BIGINT"],
    int: ["integer", "INT"],
    integer: ["integer", "INT"],
    int4: ["integer", "INT"],
    smallint: ["integer", "SMALLINT"],
    int2: ["integer", "SMALLINT"],
    tinyint: ["integer", "SMALLINT"],
    bit: ["boolean", "BOOLEAN"],
    bool: ["boolean", "BOOLEAN"],
    boolean: ["boolean", "BOOLEAN"],
    date: ["date", "DATE"],
    datetime: ["timestamp", "TIMESTAMP"],
    datetime2: ["timestamp", "TIMESTAMP"],
    smalldatetime: ["timestamp", "TIMESTAMP"],
    float: ["number", "DOUBLE"],
    float8: ["number", "DOUBLE"],
    "double precision": ["number", "DOUBLE"],
    real: ["number", "FLOAT"],
    float4: ["number", "FLOAT"],
  };
  if (type === "timestamp")
    return kind === "postgresql"
      ? ["timestamp", "TIMESTAMP"]
      : ["string", "BINARY"];
  if (["binary", "varbinary", "rowversion", "bytea"].includes(type))
    return ["string", "BINARY"];
  // Preserve timezone-bearing values as strings until an explicit conversion is reviewed.
  if (
    [
      "varchar",
      "nvarchar",
      "char",
      "nchar",
      "text",
      "ntext",
      "bpchar",
      "uuid",
      "uniqueidentifier",
      "timestamptz",
      "datetimeoffset",
      "json",
      "jsonb",
    ].includes(type)
  )
    return ["string", "STRING"];
  require(Object.hasOwn(
    map,
    type,
  ), `Unsupported source type ${type}; no silent mapping`);
  return map[type];
}
export function discoveryContracts(input) {
  require(id(input.sourceId) &&
    sourceTypes[input.sourceKind], "Supply sourceId and supported sourceKind");
  require(Array.isArray(input.rows) &&
    input.rows.length > 0 &&
    input.rows.length <= 10000, "Supply 1–10000 metadata rows");
  const tables = new Map();
  for (const row of input.rows) {
    require(id(row.schema_name) &&
      typeof row.table_name === "string" &&
      /^[A-Za-z_][A-Za-z0-9_ ]{0,127}$/.test(row.table_name) &&
      id(
        row.column_name,
      ), "Identifiers require explicit simple names; review unsupported names");
    require(typeof row.data_type === "string" &&
      row.data_type.length <= 128, "Supply a source type");
    require(Number.isInteger(row.ordinal_position) &&
      row.ordinal_position > 0, "Column ordinal must be positive");
    const key = `${input.sourceId}__${row.schema_name}__${row.table_name.replaceAll(" ", "_")}`;
    require(!tables.has(key) ||
      tables.get(key)[0].table_name ===
        row.table_name, "Contract identifier collision; narrow scope or rename explicitly");
    if (!tables.has(key)) tables.set(key, []);
    const columns = tables.get(key);
    require(!columns.some(
      (c) =>
        c.column_name === row.column_name ||
        c.ordinal_position === row.ordinal_position,
    ), "Duplicate column name or ordinal");
    columns.push(row);
  }
  require(tables.size <= 100, "At most 100 tables per import");
  const artifacts = {},
    review = [];
  for (const [key, rows] of [...tables].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    rows.sort((a, b) => a.ordinal_position - b.ordinal_position);
    const properties = rows.map((row) => {
      const [logicalType, physicalType] = mappedType(row, input.sourceKind),
        nullable = boolean(row.nullable, "nullability"),
        primary = boolean(row.primary_key, "primary-key evidence");
      require(!primary || !nullable, "Declared primary key cannot be nullable");
      return {
        name: row.column_name,
        logicalType,
        physicalType,
        required: !nullable,
        ...(primary && input.acceptDeclaredKeys === true
          ? { primaryKey: true }
          : {}),
        description: `Source type: ${row.data_type}; precision: ${row.precision ?? "unspecified"}; scale: ${row.scale ?? "unspecified"}; max length: ${row.max_length ?? "unspecified"}; declared primary key: ${primary}`,
      };
    });
    const contract = {
      apiVersion: "v3.1.0",
      kind: "DataContract",
      id: key,
      name: key,
      version: "1.0.0",
      status: "draft",
      schema: [
        {
          name: key,
          physicalName: `${rows[0].schema_name}.${rows[0].table_name}`,
          logicalType: "object",
          physicalType: "table",
          properties,
        },
      ],
    };
    artifacts[`${key}.odcs.json`] = JSON.stringify(contract, null, 2);
    review.push({
      contract: key,
      declaredKeyColumns: rows
        .filter((r) => boolean(r.primary_key, "primary-key evidence"))
        .map((r) => r.column_name),
      keysAccepted: input.acceptDeclaredKeys === true,
    });
  }
  artifacts["review.json"] = JSON.stringify(
    {
      evidence: "supplied-catalogue-metadata",
      sourceId: input.sourceId,
      sourceKind: input.sourceKind,
      tables: review,
      checks: [
        "Verify catalogue completeness and source identity",
        "Confirm business keys separately from source primary keys",
        "Review timestamp/timezone, strings and source length constraints",
        "Drafts do not imply ingestion semantics or production acceptance",
      ],
    },
    null,
    2,
  );
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts,
    applied: false,
  };
}
const str = { type: "string", minLength: 1, maxLength: 128 };
export const discoveryDefinitions = [
  {
    name: "discover prepare",
    description:
      "Generate a metadata-only ADF Copy pipeline and runnable deployment bundle; no Azure calls.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "useCase",
        "factoryName",
        "location",
        "mode",
        "sourceKind",
        "sourceLinkedService",
        "sinkLinkedService",
        "fileSystem",
        "schemas",
      ],
      properties: {
        useCase: str,
        factoryName: str,
        location: str,
        mode: { enum: ["new-factory", "existing-factory"] },
        sourceKind: { enum: Object.keys(sourceTypes) },
        sourceLinkedService: str,
        sinkLinkedService: str,
        fileSystem: str,
        tables: { type: "array", maxItems: 100, items: str },
        schemas: { type: "array", minItems: 1, maxItems: 20, items: str },
      },
    },
  },
  {
    name: "discover contracts",
    description:
      "Convert exported catalogue rows into draft ODCS files for review; keys require explicit acceptance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sourceId", "sourceKind", "rows"],
      properties: {
        sourceId: str,
        sourceKind: { enum: Object.keys(sourceTypes) },
        acceptDeclaredKeys: { type: "boolean" },
        rows: {
          type: "array",
          minItems: 1,
          maxItems: 10000,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "schema_name",
              "table_name",
              "column_name",
              "ordinal_position",
              "data_type",
              "nullable",
              "primary_key",
            ],
            properties: {
              schema_name: str,
              table_name: str,
              column_name: str,
              ordinal_position: { type: "integer" },
              data_type: str,
              nullable: { enum: [true, false, 0, 1] },
              primary_key: { enum: [true, false, 0, 1] },
              precision: { type: ["integer", "null"] },
              scale: { type: ["integer", "null"] },
              max_length: { type: ["integer", "null"] },
            },
          },
        },
      },
    },
  },
];

/** Discovery for a native connection flow (PB-064 phase 6): the metadata
 * pipeline for the connection's linked service, exporting to the flow's
 * landing storage. Core calls this when the source is not reachable from
 * the machine running Ingestron. */
export function discoveryRoute(input) {
  const { flow, source, tables, target, binding } = input;
  const kind = source?.kind;
  require(Object.hasOwn(
    sourceTypes,
    kind,
  ), "ADF metadata discovery covers SQL Server, Azure SQL, PostgreSQL, MySQL and Oracle; use a portable connector for other sources");
  require(target &&
    id(target.linkedService) &&
    typeof target.fileSystem ===
      "string", "Discovery exports to the flow's landing storage; set ingestion.target (or the bridge landing)");
  const entries = Object.values(tables ?? {});
  require(entries.length > 0 &&
    entries.every(
      (t) => id(t.schema) && typeof t.table === "string",
    ), "Each table needs a source schema and table");
  const useCase = String(flow)
    .replace(/[^A-Za-z0-9_]/g, "_")
    .slice(0, 32);
  const prepared = discoveryPrepare({
    useCase,
    factoryName: binding?.factoryName,
    location: "existing",
    mode: "existing-factory",
    sourceKind: kind,
    sourceLinkedService: source.linkedService,
    sinkLinkedService: target.linkedService,
    fileSystem: target.fileSystem,
    schemas: [...new Set(entries.map((t) => t.schema))],
    tables: [...new Set(entries.map((t) => t.table))],
  });
  return {
    ...prepared,
    next: `Deploy template.json to factory ${binding?.factoryName} (deploy.py), trigger ingestron_${useCase}_discover once, then download ${target.fileSystem}/discovery/${useCase}/<run id>/metadata.json.`,
  };
}
