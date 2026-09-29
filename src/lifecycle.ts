import { metadataStandard, metadataNames } from "./metadata.mjs";
import { stringify, parseDocument } from "yaml";
import { command } from "./commands.mjs";
const check = (ok: any, message: string) => {
  if (!ok) throw new Error(message);
};
export function model(request: any) {
  const n = request.node,
    w = n.with,
    binding = request.bindings[n.binding];
  const name = `${request.project}_${n.flow}_${n.table}`;
  let resources = [
    name,
    ...(w.standard === "snapshot-to-databricks@v1" ? [name + "_publish"] : []),
  ].map((name) => ({ scope: binding.factoryName, kind: "pipeline", name }));
  resources.push(
    ...["_source", "_landing"].map((suffix) => ({
      scope: binding.factoryName,
      kind: "dataset",
      name: name + suffix,
    })),
  );
  if (w.standard === metadataStandard) {
    const names = metadataNames(request.project, w.group);
    resources = [names.coordinator, names.worker].map((name) => ({
      scope: binding.factoryName,
      kind: "pipeline",
      name,
    }));
    resources.push(
      ...[names.source, names.sink].map((name) => ({
        scope: binding.factoryName,
        kind: "dataset",
        name,
      })),
    );
  }
  const datasets: any = {};
  if (w.handover) {
    check(
      w.standard === "snapshot-land@v1",
      "File handovers require snapshot-land@v1",
    );
    check(
      Object.keys(w.handover).length === 1 &&
        typeof w.handover.binding === "string",
      "Handover requires only an ADLS binding",
    );
    const landing = request.bindings[w.handover.binding];
    check(
      landing?.kind === "adls" && /^[a-z0-9]{3,24}$/.test(landing.accountName),
      "Handover requires an ADLS account binding",
    );
    datasets.snapshot = {
      contract: n.contract,
      location: {
        kind: "files",
        binding: w.handover.binding,
        name: `abfss://${w.target.fileSystem}@${landing.accountName}.dfs.core.windows.net/${w.target.path}/${n.flow}/${n.table}`,
        format: "parquet",
        protocol: "ingestron.snapshot-landing/v1",
        dataset: `${request.project}.${n.flow}.${n.table}`,
        completion: "requires-successful-adf-run",
        pipeline: name,
      },
    };
  }
  return { with: w, datasets, targets: [], resources };
}
export function validateOutput(request: any) {
  check(
    request.files["adf-template.json"],
    "ADF export requires adf-template.json",
  );
  command({
    apiVersion: "ingestron.provider-command-request/v1",
    command: "deploy inspect",
    context: {},
    input: { artifact: JSON.parse(request.files["adf-template.json"]) },
  });
  return { documents: [] };
}
export function author(request: any) {
  const { options } = request;
  if (request.operation === "initialise") {
    const files: any = {
      "project.yaml": stringify({
        apiVersion: "ingestron.project/v1",
        id: options.id,
        providers: {
          packages: { native: request.provider },
          configurations: {
            default: { package: "native", binding: "platform" },
          },
        },
        defaults: { provider: "default" },
        environments: Object.fromEntries(
          options.environments.map((e: string) => [
            e,
            { $resolve: `./environments/${e}.yaml` },
          ]),
        ),
        flows: [],
      }),
      "README.md": `# ${options.id}\n\nConfigure existing ADF resources in environments/*.yaml. Add a snapshot-land@v1 or immutable-file-copy@v1 ingestion flow, then add reviewed contracts. Generation does not deploy or connect to a source. Data Flow is forbidden.\n`,
      ".gitignore":
        "generated/\nbuild/\n.ingestron/\n*.local.yaml\n.env\n.env.*\n",
    };
    for (const environment of options.environments)
      files[`environments/${environment}.yaml`] = stringify({
        apiVersion: "ingestron.environment/v1",
        environment,
        values: {},
        bindings: {
          platform: { kind: "adf", factoryName: { $env: "ADF_FACTORY_NAME" } },
        },
      });
    return { files };
  }
  check(
    request.operation === "flow" && options.kind === "ingestion",
    "ADF currently authors ingestion flows only",
  );
  const standard = options.standard ?? "snapshot-land@v1",
    file = standard === "immutable-file-copy@v1";
  check(
    [
      "snapshot-land@v1",
      "snapshot-to-databricks@v1",
      "immutable-file-copy@v1",
    ].includes(standard),
    "Choose a supported ADF standard",
  );
  const sourceKind = options.sourceKind ?? (file ? "adls" : "azure-sql");
  check(
    (file ? ["adls", "sftp"] : ["azure-sql", "sql-server"]).includes(
      sourceKind,
    ),
    "Source kind does not match the selected ADF standard",
  );
  const values: any = {
    source_linked_service: { $env: "ADF_SOURCE_LINKED_SERVICE" },
    landing_linked_service: { $env: "ADF_LANDING_LINKED_SERVICE" },
    landing_filesystem: { $env: "ADF_LANDING_FILESYSTEM" },
  };
  if (file) {
    values.source_folder = { $env: "ADF_SOURCE_FOLDER" };
    values.source_file = { $env: "ADF_SOURCE_FILE" };
    if (sourceKind === "adls")
      values.source_filesystem = { $env: "ADF_SOURCE_FILESYSTEM" };
  }
  check(
    !options.sourceBinding,
    "ADF authoring uses linked-service environment values, not --source-binding",
  );
  check(
    options.format === undefined ||
      (file
        ? ["csv", "tsv", "json", "jsonl", "parquet", "xml", "xlsx"].includes(
            options.format,
          )
        : options.format === "parquet"),
    "Choose a supported source file format; SQL landing uses Parquet",
  );
  const ingestion: any = {
    standard,
    target: {
      linkedService: "{{values.landing_linked_service}}",
      fileSystem: "{{values.landing_filesystem}}",
      path: request.project.id,
    },
  };
  if (standard === "snapshot-to-databricks@v1") {
    values.storage_account = { $env: "ADF_STORAGE_ACCOUNT" };
    values.publisher_linked_service = { $env: "ADF_PUBLISHER_LINKED_SERVICE" };
    values.publisher_notebook = { $env: "ADF_PUBLISHER_NOTEBOOK" };
    ingestion.target.storageAccount = "{{values.storage_account}}";
    ingestion.publication = {
      linkedService: "{{values.publisher_linked_service}}",
      notebookPath: "{{values.publisher_notebook}}",
      protocol: "ingestron.snapshot-publication/v1",
    };
  }
  const source: any = {
    kind: sourceKind,
    linkedService: "{{values.source_linked_service}}",
    ...(file
      ? {
          folder: "{{values.source_folder}}",
          fileName: "{{values.source_file}}",
          completion: "immutable",
          ...(options.format ? { format: options.format } : {}),
          ...(sourceKind === "adls"
            ? { fileSystem: "{{values.source_filesystem}}" }
            : {}),
        }
      : {
          schema: "dbo",
          table: "{{table.id}}",
          consistency: "frozen-extract",
        }),
  };
  const files: any = {
    [`flows/${options.id}/flow.yaml`]: stringify({
      apiVersion: "ingestron.flow/v1",
      kind: "ingestion",
      id: options.id,
      provider: request.configuration,
      ingestion,
      defaults: { source },
      tables: {},
    }),
  };
  for (const env of request.environments) {
    const doc = parseDocument(env.text);
    for (const [key, value] of Object.entries(values))
      if (!doc.hasIn(["values", key])) doc.setIn(["values", key], value);
    files[env.path] = doc.toString();
  }
  return { files };
}
