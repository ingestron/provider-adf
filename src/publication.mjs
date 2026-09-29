const check = (ok, message) => {
  if (!ok) throw new Error(message);
};
const expression = (value) => ({ type: "Expression", value });
export const publicationLibraries = [
  { pypi: { package: "azure-storage-blob==12.30.1" } },
  { pypi: { package: "azure-identity==1.25.3" } },
];
export function validatePublication(n) {
  const value = n.with.publication;
  check(
    value &&
      typeof value === "object" &&
      Object.keys(value).every((k) =>
        ["linkedService", "notebookPath", "protocol"].includes(k),
      ),
    "Declare publication linkedService, notebookPath and protocol",
  );
  check(
    /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value.linkedService),
    "Use an existing Databricks linked service",
  );
  check(
    typeof value.notebookPath === "string" &&
      /^\/Workspace\/[A-Za-z0-9_./-]+$/.test(value.notebookPath) &&
      value.notebookPath.split("/").every((p) => p !== "." && p !== ".."),
    "Supply the reviewed deployed publication notebookPath",
  );
  check(
    value.protocol === "ingestron.snapshot-publication/v1",
    "Unsupported publication protocol",
  );
  check(
    typeof n.with.target.storageAccount === "string" &&
      /^[a-z0-9]{3,24}$/.test(n.with.target.storageAccount),
    "Publication requires the actual landing storageAccount",
  );
  check(
    typeof n.contract?.version === "string" && n.contract.version,
    "Publication requires a contract version",
  );
}
export function publicationPipeline(plan, n, name) {
  validatePublication(n);
  const t = n.with.target;
  const identity = {
    dataset: `${plan.project}.${n.flow}.${n.table}`,
    sourceRoot: `abfss://${t.fileSystem}@${t.storageAccount}.dfs.core.windows.net/${t.path}/${n.flow}/${n.table}`,
    contractVersion: n.contract.version,
    protocol: n.with.publication.protocol,
    contractShape: JSON.stringify(n.columns),
  };
  const parameters = {
    deliveryId: { type: "String" },
    version: { type: "Int" },
    capturedAt: { type: "String" },
    expectedRowCount: { type: "Int" },
    runId: { type: "String" },
    initialiseIndex: { type: "Bool", defaultValue: false },
  };
  const baseParameters = {
    ...identity,
    ...Object.fromEntries(
      Object.keys(parameters).map((key) => [
        key,
        expression(`@string(pipeline().parameters.${key})`),
      ]),
    ),
  };
  return {
    name: name + "_publish",
    properties: {
      description:
        "Retry this pipeline with the original receipt to recover publication without rerunning Copy",
      concurrency: 1,
      parameters,
      activities: [
        {
          name: "PublishVerifiedSnapshot",
          type: "DatabricksNotebook",
          linkedServiceName: {
            type: "LinkedServiceReference",
            referenceName: n.with.publication.linkedService,
          },
          policy: {
            timeout: n.runtime.options?.timeout ?? "00.01:00:00",
            retry: 2,
            retryIntervalInSeconds: 30,
            secureInput: true,
            secureOutput: true,
          },
          typeProperties: {
            notebookPath: n.with.publication.notebookPath,
            baseParameters,
            libraries: publicationLibraries,
          },
        },
      ],
    },
    identity,
  };
}
