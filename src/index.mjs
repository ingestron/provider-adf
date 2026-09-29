import {
  metadataStandard,
  metadataNames,
  metadataGroups,
  renderMetadata,
} from "./metadata.mjs";
import { validatePublication, publicationPipeline } from "./publication.mjs";
import { qualityRules, qualityQuery, passingExpression } from "./quality.mjs";
const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const ident = (v) =>
  typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);
const sqlTable = (v) =>
  typeof v === "string" &&
  v.length <= 128 &&
  /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z0-9_]+)*$/.test(v);
const resource = (v) =>
  typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(v);
const path = (v) =>
  typeof v === "string" &&
  v.length <= 512 &&
  v
    .split("/")
    .every(
      (x) =>
        /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(x) && x !== "." && x !== "..",
    );
const strict = (v, keys, label) =>
  check(
    v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v).every((k) => keys.includes(k)),
    `Unsupported ${label} settings`,
  );
export const standards = [
  {
    id: metadataStandard,
    sources: ["azure-sql", "sql-server"],
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery:
      "reviewed metadata-driven snapshots with per-worker count receipts",
  },
  {
    id: "snapshot-to-databricks@v1",
    sources: ["azure-sql", "sql-server"],
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery:
      "verified Parquet and atomically updated delivery index via a native Databricks notebook",
  },
  {
    id: "snapshot-land@v1",
    sources: ["azure-sql", "sql-server"],
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "isolated snapshot files; downstream publication required",
  },
  {
    id: "immutable-file-copy@v1",
    sources: ["adls", "sftp"],
    dataFlow: "forbidden",
    consistency: "completed immutable file",
    delivery: "one preserved binary file per run",
  },
];
const checked = new Set(["snapshot-land@v1", "snapshot-to-databricks@v1"]);
export function expand({ flow, providerSource, columns = {} }) {
  check(flow.kind === "ingestion", "ADF standards require ingestion flows");
  strict(
    flow.ingestion,
    [
      "standard",
      "target",
      "allowEmpty",
      "publication",
      "handover",
      "group",
      "parallelism",
    ],
    "ingestion",
  );
  const standard = standards.find((s) => s.id === flow.ingestion.standard);
  check(standard, "Unsupported ADF standard; Data Flow fallback is forbidden");
  check(
    !flow.steps && !Object.keys(flow.defaults.with ?? {}).length,
    "ADF standards own steps",
  );
  const steps = Object.entries(flow.tables ?? {}).map(([table, value]) => {
    check(
      !value.ingestion && !Object.keys(value.steps ?? {}).length,
      "ADF table ingestion/step overrides are not supported",
    );
    // SQL snapshots check contract rules on the frozen source before Copy.
    const quality =
      checked.has(standard.id) && value.contract
        ? qualityRules(value.contract, columns[table] ?? [])
        : [];
    return {
      id: `copy_${table}`,
      uses: "copy@v1",
      select: [table],
      with: quality.length ? { ...flow.ingestion, quality } : flow.ingestion,
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
      detail:
        standard.id === "snapshot-to-databricks@v1"
          ? "Copy, count gate, then versioned native Databricks publication. Recover publication with the original run receipt; never recopy an already committed delivery."
          : "Each run creates an isolated landing directory. Failed runs are unpublished. No automatic deduplication, watermark or cumulative delivery-index publication.",
      assumptions: [
        standard.consistency,
        "Existing linked services and runtime connectivity are separately accepted.",
      ],
    },
  };
}
export function validate(plan) {
  check(plan.nodes.length > 0, "ADF export requires nodes");
  const names = new Set();
  for (const n of plan.nodes) {
    check(
      n.platform === "adf" && n.uses.split("@")[0] === "copy",
      "ADF exports accept only Copy standards",
    );
    check(
      n.needs.length === 0,
      "Cross-table dependencies require a future ADF orchestration standard",
    );
    check(
      !Object.keys(plan.flows.find((f) => f.id === n.flow)?.requires ?? {})
        .length,
      "Cross-provider handover is an external delivery boundary",
    );
    const name = `${plan.project}_${n.flow}_${n.table}`;
    check(
      resource(name) && !names.has(name),
      "Invalid or colliding ADF resource name",
    );
    names.add(name);
    const binding = plan.bindings[n.binding];
    strict(binding, ["kind", "factoryName"], "ADF binding");
    check(
      binding.kind === "adf" && resource(binding.factoryName),
      "Reference an existing ADF factoryName",
    );
    strict(n.runtime.options ?? {}, ["timeout"], "provider");
    const s = n.source,
      w = n.with,
      t = w.target;
    check(s, "Source is required");
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
        "quality",
      ],
      "standard",
    );
    check(
      w.quality === undefined || checked.has(w.standard),
      "Contract quality checks apply to SQL snapshot standards only",
    );
    strict(
      t,
      ["linkedService", "fileSystem", "path", "storageAccount"],
      "target",
    );
    check(
      resource(t.linkedService) &&
        /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(t.fileSystem) &&
        path(t.path),
      "Target requires existing ADLS linkedService, fileSystem and safe path",
    );
    check(
      w.allowEmpty === undefined || typeof w.allowEmpty === "boolean",
      "allowEmpty must be boolean",
    );
    if (w.standard === metadataStandard) {
      check(ident(w.group), "Metadata snapshots require a safe named group");
      check(
        w.parallelism === undefined ||
          (Number.isInteger(w.parallelism) &&
            w.parallelism >= 1 &&
            w.parallelism <= 16),
        "Metadata parallelism must be an integer from 1 to 16",
      );
      check(
        w.handover === undefined,
        "Metadata snapshots do not yet expose a handover protocol",
      );
      check(
        Object.values(metadataNames(plan.project, w.group)).every(resource),
        "Metadata resource names exceed the supported length",
      );
    } else
      check(
        w.group === undefined && w.parallelism === undefined,
        "group and parallelism require metadata-snapshot-land@v1",
      );
    if (w.standard === "snapshot-to-databricks@v1") validatePublication(n);
    else
      check(
        w.publication === undefined && t.storageAccount === undefined,
        "Publication settings require snapshot-to-databricks@v1",
      );
    if (
      [
        "snapshot-land@v1",
        "snapshot-to-databricks@v1",
        metadataStandard,
      ].includes(w.standard)
    ) {
      strict(
        s,
        ["kind", "linkedService", "schema", "table", "consistency"],
        "SQL source",
      );
      check(
        ["azure-sql", "sql-server"].includes(s.kind),
        "Snapshots support Azure SQL and SQL Server only",
      );
      check(
        s.consistency === "frozen-extract",
        "Snapshot source must remain immutable throughout extraction and retries; mutable live-table reads are not complete snapshots",
      );
      check(
        resource(s.linkedService) && ident(s.schema) && sqlTable(s.table),
        "SQL source identifiers are required",
      );
      check(
        n.columns.length > 0 && n.columns.every((c) => ident(c.name)),
        "Explicit reviewed contract columns are required",
      );
      check(
        !n.columns.some((c) => c.type === "BINARY"),
        "BINARY SQL columns require a separately tested mapping",
      );
    } else {
      check(
        w.standard === "immutable-file-copy@v1",
        "Unsupported standard; Data Flow is forbidden",
      );
      strict(
        s,
        [
          "kind",
          "linkedService",
          "fileSystem",
          "folder",
          "fileName",
          "completion",
          "format",
        ],
        "file source",
      );
      check(
        ["adls", "sftp"].includes(s.kind) && resource(s.linkedService),
        "Files support ADLS and SFTP only",
      );
      check(
        s.format === undefined ||
          ["csv", "tsv", "json", "jsonl", "parquet", "xml", "xlsx"].includes(
            s.format,
          ),
        "Unsupported source file format",
      );
      check(
        s.completion === "immutable" &&
          path(s.folder) &&
          path(s.fileName) &&
          !s.fileName.includes("/"),
        "Specify one completed immutable file; wildcards and mutable files are unsupported",
      );
      check(
        s.kind === "adls"
          ? /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(s.fileSystem)
          : s.fileSystem === undefined,
        "fileSystem applies to ADLS only",
      );
      check(w.allowEmpty === undefined, "allowEmpty applies to snapshots only");
    }
  }
  if (plan.nodes.some((n) => n.with.standard === metadataStandard)) {
    check(
      plan.nodes.every((n) => n.with.standard === metadataStandard),
      "Metadata snapshots require a separate export from legacy standards",
    );
    metadataGroups(plan);
  }
  check(
    new Set(plan.nodes.map((n) => plan.bindings[n.binding].factoryName))
      .size === 1,
    "One existing factory per export",
  );
}
const expression = (value) => ({ type: "Expression", value });
export function render(plan) {
  validate(plan);
  const assets = {},
    resources = [];
  const add = (
    kind,
    name,
    properties,
    dependencies = [],
    pipelineDependencies = [],
  ) => {
    assets[`${kind}/${name}.json`] = {
      format: "json",
      value: { name, properties },
    };
    resources.push({
      type: `Microsoft.DataFactory/factories/${kind}`,
      apiVersion: "2018-06-01",
      name: `[concat(parameters('factoryName'), '/${name}')]`,
      properties,
      dependsOn: [
        ...dependencies.map(
          (d) =>
            `[resourceId('Microsoft.DataFactory/factories/datasets', parameters('factoryName'), '${d}')]`,
        ),
        ...pipelineDependencies.map(
          (d) =>
            `[resourceId('Microsoft.DataFactory/factories/pipelines', parameters('factoryName'), '${d}')]`,
        ),
      ],
    });
  };
  if (plan.nodes[0].with.standard === metadataStandard)
    renderMetadata(plan, add, assets);
  else
    for (const n of plan.nodes) {
      const s = n.source,
        w = n.with,
        t = w.target,
        snapshot = [
          "snapshot-land@v1",
          "snapshot-to-databricks@v1",
          metadataStandard,
        ].includes(w.standard);
      const name = `${plan.project}_${n.flow}_${n.table}`,
        src = `${name}_source`,
        sink = `${name}_landing`;
      const sourceLocation =
        s.kind === "sftp"
          ? { type: "SftpLocation", folderPath: s.folder, fileName: s.fileName }
          : {
              type: "AzureBlobFSLocation",
              fileSystem: s.fileSystem,
              folderPath: s.folder,
              fileName: s.fileName,
            };
      add("datasets", src, {
        type: snapshot
          ? s.kind === "azure-sql"
            ? "AzureSqlTable"
            : "SqlServerTable"
          : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: s.linkedService,
        },
        typeProperties: snapshot
          ? { schema: s.schema, table: s.table }
          : { location: sourceLocation },
      });
      add("datasets", sink, {
        type: snapshot ? "Parquet" : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: t.linkedService,
        },
        parameters: { runId: { type: "String" } },
        typeProperties: {
          location: {
            type: "AzureBlobFSLocation",
            fileSystem: t.fileSystem,
            folderPath: expression(
              `@concat('${t.path}/${n.flow}/${n.table}/', dataset().runId)`,
            ),
            ...(!snapshot ? { fileName: s.fileName } : {}),
          },
          ...(snapshot ? { compressionCodec: "snappy" } : {}),
        },
      });
      const policy = {
        timeout: n.runtime.options?.timeout ?? "00.01:00:00",
        retry: 0,
        secureInput: true,
        secureOutput: true,
      };
      const copy = {
        name: "Copy",
        type: "Copy",
        policy,
        typeProperties: {
          source: snapshot
            ? {
                type: s.kind === "azure-sql" ? "AzureSqlSource" : "SqlSource",
                sqlReaderQuery: `SELECT ${n.columns.map((c) => "[" + c.name + "]").join(", ")} FROM [${s.schema}].[${s.table}]`,
                partitionOption: "None",
              }
            : {
                type: "BinarySource",
                storeSettings: {
                  type:
                    s.kind === "sftp"
                      ? "SftpReadSettings"
                      : "AzureBlobFSReadSettings",
                  recursive: false,
                },
              },
          sink: snapshot
            ? {
                type: "ParquetSink",
                storeSettings: { type: "AzureBlobFSWriteSettings" },
                formatSettings: { type: "ParquetWriteSettings" },
              }
            : {
                type: "BinarySink",
                storeSettings: { type: "AzureBlobFSWriteSettings" },
              },
          enableStaging: false,
          validateDataConsistency: true,
          ...(snapshot
            ? {
                enableSkipIncompatibleRow: false,
                translator: {
                  type: "TabularTranslator",
                  mappings: n.columns.map((c) => ({
                    source: { name: c.name },
                    sink: { name: c.target ?? c.name },
                  })),
                  typeConversion: false,
                },
              }
            : {}),
        },
        inputs: [{ type: "DatasetReference", referenceName: src }],
        outputs: [
          {
            type: "DatasetReference",
            referenceName: sink,
            parameters: { runId: expression("@pipeline().RunId") },
          },
        ],
      };
      const activities = [copy];
      if (w.quality?.length) {
        // Counts only: one aggregate over the frozen source, before any copy.
        activities.unshift({
          name: "CheckQuality",
          type: "Lookup",
          policy,
          typeProperties: {
            source: {
              type: s.kind === "azure-sql" ? "AzureSqlSource" : "SqlSource",
              sqlReaderQuery: qualityQuery(
                w.quality,
                n.columns,
                s.schema,
                s.table,
              ),
              partitionOption: "None",
            },
            dataset: { type: "DatasetReference", referenceName: src },
            firstRowOnly: true,
          },
        });
        const passes = passingExpression(w.quality);
        if (passes)
          activities.splice(1, 0, {
            name: "VerifyQuality",
            type: "IfCondition",
            dependsOn: [
              { activity: "CheckQuality", dependencyConditions: ["Succeeded"] },
            ],
            typeProperties: {
              expression: expression(passes),
              ifTrueActivities: [],
              ifFalseActivities: [
                {
                  name: "RejectContractQuality",
                  type: "Fail",
                  typeProperties: {
                    message: `Contract quality rules failed; nothing was copied. Error rules: ${w.quality
                      .filter((q) => q.outcome === "fail")
                      .map((q) => q.id)
                      .join(", ")}. Counts are in the CheckQuality output.`,
                    errorCode: "INGESTRON_QUALITY_FAILED",
                  },
                },
              ],
            },
          });
        copy.dependsOn = [
          {
            activity: passes ? "VerifyQuality" : "CheckQuality",
            dependencyConditions: ["Succeeded"],
          },
        ];
      }
      if (snapshot)
        activities.push({
          name: "VerifyCount",
          type: "IfCondition",
          dependsOn: [
            { activity: "Copy", dependencyConditions: ["Succeeded"] },
          ],
          typeProperties: {
            expression: expression(
              `@and(equals(activity('Copy').output.rowsCopied, pipeline().parameters.expectedRowCount), greaterOrEquals(pipeline().parameters.expectedRowCount, ${w.allowEmpty ? 0 : 1}))`,
            ),
            ifTrueActivities: [],
            ifFalseActivities: [
              {
                name: "RejectIncompleteSnapshot",
                type: "Fail",
                typeProperties: {
                  message:
                    "Snapshot count or empty-delivery policy failed. Do not publish this run.",
                  errorCode: "INGESTRON_SNAPSHOT_INCOMPLETE",
                },
              },
            ],
          },
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
            { activity: "VerifyCount", dependencyConditions: ["Succeeded"] },
          ],
          typeProperties: {
            pipeline: {
              type: "PipelineReference",
              referenceName: publication.name,
            },
            waitOnCompletion: true,
            parameters: {
              ...Object.fromEntries(
                Object.keys(parameters).map((key) => [
                  key,
                  expression(`@pipeline().parameters.${key}`),
                ]),
              ),
              runId: expression("@pipeline().RunId"),
            },
          },
        });
        assets[`handover/${name}.json`] = {
          format: "json",
          value: {
            apiVersion: publication.identity.protocol,
            ...publication.identity,
            deliveryIndex:
              publication.identity.sourceRoot + "/_ingestron/deliveries.json",
            publicationNotebook: w.publication.notebookPath,
            recoveryPipeline: publication.name,
            dataFlow: "forbidden",
          },
        };
      }
      add(
        "pipelines",
        name,
        {
          description: `${w.standard}; no Data Flow; publish only after the entire pipeline succeeds`,
          concurrency: 1,
          parameters,
          activities,
        },
        [src, sink],
        pipelineDependencies,
      );
    }
  assets["adf-template.json"] = {
    format: "json",
    value: {
      $schema:
        "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      contentVersion: "1.0.0.0",
      parameters: { factoryName: { type: "string" } },
      resources,
    },
  };
  assets["adf-parameters.json"] = {
    format: "json",
    value: {
      $schema:
        "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      contentVersion: "1.0.0.0",
      parameters: {
        factoryName: {
          value: plan.bindings[plan.nodes[0].binding].factoryName,
        },
      },
    },
  };
  assets["README.md"] = {
    format: "text",
    value:
      "# ADF landing export\n\nOffline candidate. Use incremental ARM deployment into the existing factory after review.\nDo not use complete-mode deployment. Existing linked services, identities, runtime\nnetworking, monitoring and storage retention are customer-owned.\n\nEach run writes a new RunId folder. Copy retries are disabled: restart the pipeline\nto get a fresh folder after failure. Never consume a folder merely because it exists.\nSnapshot pipelines require an independently determined expectedRowCount for the\nfrozen source. Only successful whole pipelines are eligible for publication.\n\nsnapshot-to-databricks@v1 invokes a separately deployed Databricks 1.3.0+ publisher\nusing the declared v1 protocol. Supply source-sequenced versions starting at one,\ndeliveryId/capturedAt and expectedRowCount. Initialise the index explicitly once.\nUse the generated _publish pipeline with the original runId to retry publication\nwithout copying again. The publisher verifies contracts/keys/counts and uses\nconditional Blob writes. Other landing standards do not publish delivery indexes.\nThe ADF linked-service identity governs notebook execution; verify its privileges\nseparately from any Databricks job run_as identity. File copy preserves bytes without validating content.\nNo CDC, delete capture, automatic deduplication or source cleanup is generated.\n",
  };
  if (plan.nodes[0].with.standard === metadataStandard)
    assets["README.md"].value =
      "# Metadata-driven ADF snapshots\n\nDeploy adf-template.json incrementally into the existing factory after review.\nEach named compatible group has a coordinator, worker and two datasets.\nmetadata/*.json records the compiler-reviewed catalogue; the deployed worker embeds\nit and accepts only tableId and expectedRowCount. Call the coordinator with tables\nand expectedCounts, or retry one failed table with a fresh worker run. Fill every\nselected count from an independently frozen source; null example values must be\nreplaced. Tables default to the compiled group. Shared linked services and identities\nremain externally owned. No schedules, control database or Data Flow are created.\n\nUse the worker runId from the ExecutePipeline activity output, not the coordinator\nrunId, to locate folder/<worker runId>/. Only Succeeded workers passing VerifyCount\nare eligible for consumption. A failed coordinator may contain successful workers;\nthere is no atomic group commit or cumulative publication index. Do not replay already\nconsumed tables without downstream duplicate handling. Failed folders are retained;\ncopy retries are zero and recovery uses fresh run folders. Source consistency,\nretention, keys/null checks, cross-table consistency and downstream publication remain\noperator responsibilities. See the provider docs/metadata-pipelines.md for limits.\n";
  return assets;
}
