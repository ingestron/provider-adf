import { qualityQuery, passingExpression } from "./quality.mjs";
import { watermarkControlSql } from "./watermark-control.mjs";
export const watermarkStandard = "watermark-append-land@v1";
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const ident = (value) =>
  typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
const resource = (value) =>
  typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value);
const strict = (value, keys, label) =>
  check(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((key) => keys.includes(key)),
    `Unsupported ${label} settings`,
  );
const quote = (value) => `[${value}]`;
const expression = (value) => ({ type: "Expression", value });
const reference = (name, type = "DatasetReference") => ({
  referenceName: name,
  type,
});
const depends = (name) => [
  { activity: name, dependencyConditions: ["Succeeded"] },
];
const fail = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { errorCode: "IngestronCheckpoint", message },
});
const condition = (name, value, yes, no, message) => ({
  name,
  type: "IfCondition",
  dependsOn: depends(no),
  typeProperties: {
    expression: expression(value),
    ifTrueActivities: yes,
    ifFalseActivities: [fail(name + "Rejected", message)],
  },
});
const maximum = "9223372036854775807";
export function validateWatermark(plan, node) {
  const source = node.source,
    settings = node.with.watermark;
  check(
    [
      `${plan.project}_${node.flow}_${node.table}_source`,
      `${plan.project}_${node.flow}_${node.table}_landing`,
      `${plan.project}_${node.flow}_${node.table}_control`,
      `${plan.project}_${node.flow}_${node.table}_batch`,
    ].every(resource),
    "Generated native watermark resource names exceed the supported bound",
  );
  strict(
    settings,
    [
      "column",
      "initial",
      "batchSize",
      "namespace",
      "consistency",
      "controlLinkedService",
    ],
    "watermark",
  );
  strict(
    source,
    ["kind", "linkedService", "schema", "table", "consistency"],
    "watermark SQL source",
  );
  check(
    ["sql-server", "azure-sql"].includes(source.kind),
    "Native append watermark supports SQL Server and Azure SQL",
  );
  check(
    resource(source.linkedService) &&
      ident(source.schema) &&
      ident(source.table),
    "Use explicit safe SQL source identifiers",
  );
  check(
    settings.consistency === "ordered-committed-append" &&
      source.consistency === "ordered-committed-append",
    "A committed ordered immutable append source promise is required",
  );
  check(
    ident(settings.column) &&
      resource(settings.namespace) &&
      resource(settings.controlLinkedService),
    "A safe watermark column, explicit state namespace and existing control linked service are required",
  );
  check(
    typeof settings.initial === "string" &&
      /^(0|[1-9][0-9]{0,18})$/.test(settings.initial) &&
      (settings.initial.length < maximum.length || settings.initial <= maximum),
    "Initial watermark must be a canonical non-negative signed int64 string",
  );
  check(
    Number.isInteger(settings.batchSize) &&
      settings.batchSize >= 1 &&
      settings.batchSize <= 1000000,
    "Batch size must be an integer between 1 and 1000000",
  );
  const keys = node.columns.filter((column) => column.key);
  check(
    keys.length === 1 &&
      keys[0].name === settings.column &&
      keys[0].required &&
      ["BIGINT", "INT", "INTEGER", "SMALLINT"].includes(keys[0].type),
    "Select the sole required integer contract primary key as watermark",
  );
  check(
    node.columns.every(
      (column) =>
        ident(column.name) &&
        ident(column.target ?? column.name) &&
        column.type !== "BINARY",
    ),
    "Reviewed native contract columns are required",
  );
  check(
    !node.with.quality?.some(
      (rule) => rule.metric === "sql" || rule.pattern !== undefined,
    ),
    "Native append quality uses bounded library rules; custom SQL and pattern rules are unsupported",
  );
  check(
    node.with.allowEmpty === undefined &&
      node.with.handover === undefined &&
      node.with.publication === undefined,
    "Watermark publication uses its committed delivery journal",
  );
  check(
    /^[a-f0-9]{64}$/.test(plan.digest ?? ""),
    "A reviewed exact plan digest is required for checkpoint fencing",
  );
  const key = [
    settings.namespace,
    plan.project,
    plan.environment,
    node.flow,
    node.table,
  ].join(".");
  check(
    key.length <= 400 && /^[A-Za-z0-9_.-]+$/.test(key),
    "Checkpoint dataset identity exceeds its supported bound",
  );
  return key;
}
/** Build expressions from literal reviewed SQL and canonical control-procedure cursor strings. */
function sqlExpression(sql, worker = false) {
  const parts = sql
    .split(/(\{LOW\}|\{HIGH\})/)
    .filter(Boolean)
    .map((part) =>
      part === "{LOW}"
        ? worker
          ? "activity('ValidateBatch').output.firstRow.lowerWatermark"
          : "activity('ReadWatermark').output.firstRow.watermark"
        : part === "{HIGH}"
          ? worker
            ? "activity('ValidateBatch').output.firstRow.upperWatermark"
            : "activity('ChooseUpper').output.firstRow.watermark"
          : `'${part.replaceAll("'", "''")}'`,
    );
  return expression(`@concat(${parts.join(", ")})`);
}
export function renderWatermark(plan, node, add, assets) {
  const key = validateWatermark(plan, node),
    s = node.source,
    w = node.with,
    state = w.watermark,
    target = w.target;
  const name = `${plan.project}_${node.flow}_${node.table}`,
    src = name + "_source",
    sink = name + "_landing",
    control = name + "_control",
    worker = name + "_batch";
  const policy = {
    timeout: node.runtime.options?.timeout ?? "00.01:00:00",
    retry: 0,
    secureInput: true,
    secureOutput: true,
  };
  const sqlType = s.kind === "azure-sql" ? "AzureSqlSource" : "SqlSource";
  const table = `${quote(s.schema)}.${quote(s.table)}`;
  const cursor = quote(state.column);
  const window = `${cursor} > CAST({LOW} AS BIGINT) AND ${cursor} <= CAST({HIGH} AS BIGINT)`;
  const scoped = `(SELECT * FROM ${table} WHERE ${window}) AS [ingestron_batch]`;
  const lookup = (name, dataset, query, after, sourceType = sqlType) => ({
    name,
    type: "Lookup",
    ...(after ? { dependsOn: depends(after) } : {}),
    policy,
    typeProperties: {
      source: {
        type: sourceType,
        sqlReaderQuery: query,
        partitionOption: "None",
      },
      dataset: reference(dataset),
      firstRowOnly: true,
    },
  });
  add("datasets", src, {
    type: s.kind === "azure-sql" ? "AzureSqlTable" : "SqlServerTable",
    linkedServiceName: reference(s.linkedService, "LinkedServiceReference"),
    typeProperties: { schema: s.schema, table: s.table },
  });
  add("datasets", control, {
    type: "AzureSqlTable",
    linkedServiceName: reference(
      state.controlLinkedService,
      "LinkedServiceReference",
    ),
    typeProperties: { schema: "dbo", table: "IngestronWatermarkV1" },
  });
  add("datasets", sink, {
    type: "Parquet",
    linkedServiceName: reference(
      target.linkedService,
      "LinkedServiceReference",
    ),
    parameters: { runId: { type: "String" } },
    typeProperties: {
      location: {
        type: "AzureBlobFSLocation",
        fileSystem: target.fileSystem,
        folderPath: expression(
          `@concat('${target.path}/${node.flow}/${node.table}/', dataset().runId)`,
        ),
      },
      compressionCodec: "snappy",
    },
  });
  const read = lookup(
    "ReadWatermark",
    control,
    `EXEC dbo.IngestronReadWatermarkV1 @Dataset = N'${key}', @PlanDigest = '${plan.digest}', @Initial = '${state.initial}'`,
    undefined,
    "AzureSqlSource",
  );
  const pkQuery = `SELECT CASE WHEN (SELECT COUNT(*) FROM sys.index_columns ic JOIN sys.indexes i ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE i.is_primary_key=1 AND ic.object_id=OBJECT_ID(N'${table}') AND ic.key_ordinal>0)=1 AND EXISTS(SELECT 1 FROM sys.columns c JOIN sys.index_columns ic ON ic.object_id=c.object_id AND ic.column_id=c.column_id JOIN sys.indexes i ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE c.object_id=OBJECT_ID(N'${table}') AND c.name=N'${state.column}' AND c.is_nullable=0 AND c.system_type_id IN(48,52,56,127) AND i.is_primary_key=1 AND ic.key_ordinal=1) THEN 1 ELSE 0 END AS valid`;
  const pk = lookup("ValidateSourceKey", src, pkQuery, "ReadWatermark");
  const pkGate = condition(
    "RequireSourceKey",
    "@equals(activity('ValidateSourceKey').output.firstRow.valid, 1)",
    [],
    "ValidateSourceKey",
    "The physical source must have the sole non-null integer primary key selected by the reviewed contract",
  );
  const upper = lookup(
    "ChooseUpper",
    src,
    sqlExpression(
      `SELECT COALESCE(CONVERT(varchar(20),MAX(${cursor})), '{LOW}') AS watermark FROM (SELECT TOP (${state.batchSize}) ${cursor} FROM ${table} WHERE ${cursor} > CAST({LOW} AS BIGINT) ORDER BY ${cursor}) AS [ordered_batch]`,
    ),
    "RequireSourceKey",
  );
  const quality = w.quality ?? [];
  const parameter = (value, type = "String") => ({ value, type });
  const validateBatch = lookup(
    "ValidateBatch",
    control,
    undefined,
    undefined,
    "AzureSqlSource",
  );
  delete validateBatch.typeProperties.source.sqlReaderQuery;
  Object.assign(validateBatch.typeProperties.source, {
    sqlReaderStoredProcedureName: "dbo.IngestronValidateBatchV1",
    storedProcedureParameters: {
      Dataset: parameter(key),
      PlanDigest: parameter(plan.digest),
      Expected: parameter(expression("@pipeline().parameters.lowerWatermark")),
      Next: parameter(expression("@pipeline().parameters.upperWatermark")),
      RunId: parameter(expression("@pipeline().parameters.runId")),
    },
  });
  const workerPk = lookup("ValidateSourceKey", src, pkQuery, "ValidateBatch");
  const qualitySql = quality.length
    ? qualityQuery(quality, node.columns, s.schema, s.table)
        .slice("SELECT ".length)
        .replaceAll(table, scoped)
    : "";
  const metrics = lookup(
    "CheckQuality",
    src,
    sqlExpression(
      `SELECT COUNT(*) AS [rowCount]${qualitySql ? ", " + qualitySql : ""} FROM ${scoped}`,
      true,
    ),
    "RequireSourceKey",
  );
  const passes = passingExpression(quality);
  const qualityGate = condition(
    "RequireQuality",
    `@and(and(greater(activity('CheckQuality').output.firstRow.rowCount, 0), lessOrEquals(activity('CheckQuality').output.firstRow.rowCount, ${state.batchSize})), ${passes ? passes.slice(1) : "equals(1, 1)"})`,
    [],
    "CheckQuality",
    "Source batch failed the reviewed quality rules",
  );
  const copy = {
    name: "Copy",
    type: "Copy",
    dependsOn: depends("RequireQuality"),
    policy,
    typeProperties: {
      source: {
        type: sqlType,
        sqlReaderQuery: sqlExpression(
          `SELECT ${node.columns.map((c) => quote(c.name)).join(", ")} FROM ${table} WHERE ${window}`,
          true,
        ),
        partitionOption: "None",
      },
      sink: {
        type: "ParquetSink",
        storeSettings: { type: "AzureBlobFSWriteSettings" },
        formatSettings: { type: "ParquetWriteSettings" },
      },
      enableStaging: false,
      validateDataConsistency: true,
      enableSkipIncompatibleRow: false,
      translator: {
        type: "TabularTranslator",
        typeConversion: false,
        mappings: node.columns.map((c) => ({
          source: { name: c.name },
          sink: { name: c.target ?? c.name },
        })),
      },
    },
    inputs: [reference(src)],
    outputs: [
      {
        ...reference(sink),
        parameters: {
          runId: expression("@activity('ValidateBatch').output.firstRow.runId"),
        },
      },
    ],
  };
  const commit = {
    name: "CommitWatermark",
    type: "SqlServerStoredProcedure",
    policy,
    linkedServiceName: reference(
      state.controlLinkedService,
      "LinkedServiceReference",
    ),
    typeProperties: {
      storedProcedureName: "dbo.IngestronCommitWatermarkV1",
      storedProcedureParameters: {
        Dataset: parameter(key),
        RunId: parameter(
          expression("@activity('ValidateBatch').output.firstRow.runId"),
        ),
        PlanDigest: parameter(plan.digest),
        Expected: parameter(
          expression(
            "@activity('ValidateBatch').output.firstRow.lowerWatermark",
          ),
        ),
        Next: parameter(
          expression(
            "@activity('ValidateBatch').output.firstRow.upperWatermark",
          ),
        ),
        RowCount: parameter(
          expression("@activity('CheckQuality').output.firstRow.rowCount"),
          "Int32",
        ),
        LandingPath: parameter(
          expression(
            `@concat('${target.fileSystem}/${target.path}/${node.flow}/${node.table}/', activity('ValidateBatch').output.firstRow.runId)`,
          ),
        ),
      },
    },
  };
  const copied = condition(
    "VerifyCount",
    "@and(equals(activity('Copy').output.rowsRead, activity('CheckQuality').output.firstRow.rowCount), equals(activity('Copy').output.rowsCopied, activity('CheckQuality').output.firstRow.rowCount))",
    [commit],
    "Copy",
    "Copied rows differ from the bounded source batch; checkpoint and publication are unchanged",
  );
  const batch = {
    name: "IfBatch",
    type: "IfCondition",
    dependsOn: depends("ChooseUpper"),
    typeProperties: {
      expression: expression(
        "@not(equals(activity('ChooseUpper').output.firstRow.watermark, activity('ReadWatermark').output.firstRow.watermark))",
      ),
      ifTrueActivities: [
        {
          name: "RunBatch",
          type: "ExecutePipeline",
          policy: { secureInput: true },
          typeProperties: {
            pipeline: reference(worker, "PipelineReference"),
            waitOnCompletion: true,
            parameters: {
              lowerWatermark: expression(
                "@activity('ReadWatermark').output.firstRow.watermark",
              ),
              upperWatermark: expression(
                "@activity('ChooseUpper').output.firstRow.watermark",
              ),
              runId: expression("@pipeline().RunId"),
            },
          },
        },
      ],
      ifFalseActivities: [],
    },
  };
  add(
    "pipelines",
    worker,
    {
      concurrency: 1,
      parameters: {
        lowerWatermark: { type: "String" },
        upperWatermark: { type: "String" },
        runId: { type: "String" },
      },
      activities: [
        validateBatch,
        workerPk,
        pkGate,
        metrics,
        qualityGate,
        copy,
        copied,
      ],
    },
    [src, sink, control],
  );
  add(
    "pipelines",
    name,
    { concurrency: 1, activities: [read, pk, pkGate, upper, batch] },
    [src, sink, control],
    [worker],
  );
  assets["sql/ingestron-watermark-control-v1.sql"] = {
    format: "text",
    value: watermarkControlSql,
  };
  assets[`handover/${name}.json`] = {
    format: "json",
    value: {
      apiVersion: "ingestron.native-watermark-delivery/v1",
      dataset: key,
      planDigest: plan.digest,
      consistency: state.consistency,
      control: {
        linkedService: state.controlLinkedService,
        table: "dbo.IngestronWatermarkV1",
        journal: "dbo.IngestronDeliveryV1",
      },
      landing: {
        linkedService: target.linkedService,
        fileSystem: target.fileSystem,
        prefix: `${target.path}/${node.flow}/${node.table}`,
      },
      publication:
        "Only committed journal entries are published; failed or competing landing folders are unpublished",
      checkpoint:
        "Atomic watermark and journal compare-and-swap commit; changed plans require a reviewed separate namespace or explicit migration",
      execution: "not-run",
    },
  };
}
