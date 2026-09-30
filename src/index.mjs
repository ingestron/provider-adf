import {
  metadataStandard,
  metadataNames,
  metadataGroups,
  renderMetadata,
} from "./metadata.mjs";
import { validatePublication, publicationPipeline } from "./publication.mjs";
import { sqlSources, sqlKinds, selectQuery } from "./sql-sources.mjs";
import { qualityRules, qualityQuery, passingExpression } from "./quality.mjs";
import { appSources } from "./app-sources.mjs";
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
    sources: sqlKinds,
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery:
      "verified Parquet and atomically updated delivery index via a native Databricks notebook",
  },
  {
    id: "snapshot-land@v1",
    sources: sqlKinds,
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "isolated snapshot files; downstream publication required",
  },
  {
    id: "sharepoint-list-land@v1",
    sources: ["sharepoint-list"],
    dataFlow: "forbidden",
    consistency: "live list read; no point-in-time guarantee",
    delivery: "one Parquet snapshot of the list per run",
  },
  {
    id: "app-land@v1",
    sources: Object.keys(appSources),
    dataFlow: "forbidden",
    consistency: "live API read; no point-in-time guarantee",
    delivery: "one Parquet snapshot of the object per run",
  },
  {
    id: "immutable-file-copy@v1",
    sources: ["adls", "s3", "gcs", "sftp"],
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
    if (w.standard === "app-land@v1") {
      strict(s, ["kind", "linkedService", "object"], "application source");
      const app = appSources[s.kind];
      check(
        app && resource(s.linkedService),
        `Application copies read ${Object.keys(appSources).join(", ")} through an existing linked service`,
      );
      check(app.valid(s.object), `${app.label} object must be ${app.hint}`);
      check(
        n.columns.length > 0 && n.columns.every((c) => ident(c.name)),
        "Explicit reviewed contract columns are required",
      );
      check(
        w.allowEmpty === undefined,
        "allowEmpty applies to SQL snapshots only",
      );
    } else if (w.standard === "sharepoint-list-land@v1") {
      strict(
        s,
        ["kind", "linkedService", "listName", "path", "entity"],
        "SharePoint list source",
      );
      check(
        (s.entity ?? "list") === "list",
        "ADF reads SharePoint lists natively; SharePoint files need another route",
      );
      check(
        s.kind === "sharepoint-list" && resource(s.linkedService),
        "SharePoint lists need a SharePoint Online List linked service",
      );
      const listName = sharePointList(s);
      check(
        typeof listName === "string" &&
          listName.length > 0 &&
          listName.length <= 255 &&
          !listName.includes("'"),
        "Name the list with listName or path Lists/<name>; it cannot contain an apostrophe",
      );
      check(
        n.columns.length > 0 && n.columns.every((c) => ident(c.name)),
        "Explicit reviewed contract columns are required",
      );
      check(
        w.allowEmpty === undefined,
        "allowEmpty applies to SQL snapshots only",
      );
    } else if (
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
        w.standard === metadataStandard
          ? ["azure-sql", "sql-server"].includes(s.kind)
          : sqlKinds.includes(s.kind),
        w.standard === metadataStandard
          ? "Metadata snapshots support Azure SQL and SQL Server only"
          : `Snapshots support ${sqlKinds.join(", ")}`,
      );
      check(
        !w.quality?.some((q) => q.pattern !== undefined) ||
          sqlSources[s.kind].dialect !== "tsql",
        "Pattern quality rules need a source with regular expressions; SQL Server has none that are portable. Use arguments.validValues or another source",
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
          "bucket",
          "folder",
          "fileName",
          "path",
          "completion",
          "format",
        ],
        "file source",
      );
      check(
        s.path === undefined ||
          (s.folder === undefined && s.fileName === undefined),
        "Name the file with path, or with folder and fileName, not both",
      );
      check(
        ["adls", "s3", "gcs", "sftp"].includes(s.kind) &&
          resource(s.linkedService),
        "Files support ADLS, S3, Google Cloud Storage and SFTP only",
      );
      check(
        s.format === undefined ||
          ["csv", "tsv", "json", "jsonl", "parquet", "xml", "xlsx"].includes(
            s.format,
          ),
        "Unsupported source file format",
      );
      const { folder, fileName } = fileLocation(s);
      check(
        s.completion === "immutable" &&
          (folder === undefined || path(folder)) &&
          path(fileName) &&
          !fileName.includes("/") &&
          (s.path === undefined || /\.[A-Za-z0-9]+$/.test(fileName)),
        "Specify one completed immutable file (a path ends with the file name); folders, wildcards and mutable files are unsupported on ADF",
      );
      check(
        s.kind === "adls"
          ? /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(s.fileSystem)
          : s.fileSystem === undefined,
        "fileSystem applies to ADLS only",
      );
      check(
        ["s3", "gcs"].includes(s.kind)
          ? /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(s.bucket)
          : s.bucket === undefined,
        "bucket applies to S3 and Google Cloud Storage and must be a valid bucket name",
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
/** A file named by the portable path (shared with connectors and Databricks), or by folder and fileName. */
const fileLocation = (s) => {
  if (s.path === undefined) return { folder: s.folder, fileName: s.fileName };
  const cut = String(s.path).lastIndexOf("/");
  return cut < 0
    ? { folder: undefined, fileName: s.path }
    : { folder: s.path.slice(0, cut), fileName: s.path.slice(cut + 1) };
};
/** A list named directly, or by the portable path Lists/<name>. */
const sharePointList = (s) =>
  s.listName ??
  (typeof s.path === "string" && s.path.startsWith("Lists/")
    ? decodeURIComponent(s.path.slice("Lists/".length))
    : undefined);
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
        ].includes(w.standard),
        list = w.standard === "sharepoint-list-land@v1",
        app = w.standard === "app-land@v1" ? appSources[s.kind] : undefined,
        // Tabular reads land typed Parquet through the reviewed column mapping.
        tabular = snapshot || list || app !== undefined;
      const name = `${plan.project}_${n.flow}_${n.table}`,
        src = `${name}_source`,
        sink = `${name}_landing`;
      const { folder, fileName } = fileLocation(s);
      const sourceLocation =
        s.kind === "sftp"
          ? {
              type: "SftpLocation",
              ...(folder ? { folderPath: folder } : {}),
              fileName,
            }
          : s.kind === "s3" || s.kind === "gcs"
            ? {
                type:
                  s.kind === "s3"
                    ? "AmazonS3Location"
                    : "GoogleCloudStorageLocation",
                bucketName: s.bucket,
                ...(folder ? { folderPath: folder } : {}),
                fileName,
              }
            : {
                type: "AzureBlobFSLocation",
                fileSystem: s.fileSystem,
                ...(folder ? { folderPath: folder } : {}),
                fileName,
              };
      const sql = snapshot ? sqlSources[s.kind] : undefined;
      add("datasets", src, {
        type: snapshot
          ? sql.dataset
          : list
            ? "SharePointOnlineListResource"
            : app
              ? app.dataset
              : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: s.linkedService,
        },
        typeProperties: snapshot
          ? sql.table(s)
          : list
            ? { listName: sharePointList(s) }
            : app
              ? app.table(s)
              : { location: sourceLocation },
      });
      add("datasets", sink, {
        type: tabular ? "Parquet" : "Binary",
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
            ...(!tabular ? { fileName: fileLocation(s).fileName } : {}),
          },
          ...(tabular ? { compressionCodec: "snappy" } : {}),
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
                type: sql.source,
                [sql.query]: selectQuery(s.kind, n.columns, s.schema, s.table),
                ...sql.options,
              }
            : list
              ? {
                  type: "SharePointOnlineListSource",
                  query: `$select=${n.columns.map((c) => c.name).join(",")}`,
                }
              : app
                ? app.source(s, n.columns)
                : {
                    type: "BinarySource",
                    storeSettings: {
                      type:
                        s.kind === "sftp"
                          ? "SftpReadSettings"
                          : s.kind === "s3"
                            ? "AmazonS3ReadSettings"
                            : s.kind === "gcs"
                              ? "GoogleCloudStorageReadSettings"
                              : "AzureBlobFSReadSettings",
                      recursive: false,
                    },
                  },
          sink: tabular
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
          ...(tabular
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
              type: sql.source,
              [sql.query]: qualityQuery(
                w.quality,
                n.columns,
                s.schema,
                s.table,
                sql.dialect,
              ),
              ...sql.options,
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
