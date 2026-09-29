import { assemble } from "./project-assembly.mjs";
import { projectConnectionPrepare } from "./project-connections.mjs";
import { connectorContracts } from "./connectors.mjs";
import { computePrepare, poolPrepare } from "./compute.mjs";
import { sourcePrepare, fileContracts } from "./source-discovery.mjs";
import { discoveryPrepare, discoveryContracts } from "./discovery.mjs";
const require = (condition, message) => {
  if (!condition) throw new Error(message);
};
const safeName = (value) =>
  typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
const types = {
  string: "STRING",
  varchar: "STRING",
  nvarchar: "STRING",
  bigint: "BIGINT",
  int: "INT",
  integer: "INT",
  smallint: "SMALLINT",
  boolean: "BOOLEAN",
  bit: "BOOLEAN",
  date: "DATE",
  timestamp: "BINARY",
  datetime2: "TIMESTAMP",
  double: "DOUBLE",
  binary: "BINARY",
};
function discovery(input, context) {
  require(Array.isArray(input.tables) &&
    input.tables.length > 0, "Supply table metadata");
  const names = new Set();
  const tables = input.tables.map((table) => {
    require(safeName(table.name) &&
      !names.has(table.name), "Table names must be unique simple identifiers");
    names.add(table.name);
    const columns = new Set();
    require(Array.isArray(table.columns) &&
      table.columns.length > 0, "Supply columns");
    return {
      name: table.name,
      columns: table.columns.map((column) => {
        require(safeName(column.name) &&
          !columns.has(
            column.name,
          ), "Column names must be unique simple identifiers");
        columns.add(column.name);
        require(typeof column.type === "string" &&
          Object.hasOwn(
            types,
            column.type.toLowerCase(),
          ), "Unsupported source type; review the mapping before importing");
        require(typeof column.nullable ===
          "boolean", "Column nullability must be explicit");
        return {
          name: column.name,
          type: types[column.type.toLowerCase()],
          required: !column.nullable,
        };
      }),
    };
  });
  return {
    apiVersion: "ingestron.discovery-proposal/v1",
    platform: PLATFORM,
    project: context.project,
    environment: context.environment,
    evidence: "supplied-metadata",
    tables,
    review: [
      "Verify source identity and metadata freshness",
      "Review type mappings, precision and timezone semantics",
      "Select keys and contract versions; no keys are inferred",
    ],
    applied: false,
  };
}
export function command(request) {
  require(request.apiVersion ===
    "ingestron.provider-command-request/v1", "Unsupported command protocol");
  if (request.command === "project assemble") return assemble(request.input);
  if (request.command === "connection prepare")
    return projectConnectionPrepare(request.input);
  if (request.command === "connector contracts")
    return connectorContracts(request.input);

  if (request.command === "compute pool prepare")
    return poolPrepare(request.input);
  if (request.command === "compute prepare")
    return computePrepare(request.input);
  if (
    request.command === "discover prepare" ||
    request.command === "deploy prepare"
  )
    return discoveryPrepare(request.input);
  if (request.command === "discover source prepare")
    return sourcePrepare(request.input);
  if (request.command === "discover contracts")
    return request.input.apiVersion === "ingestron.file-metadata/v1"
      ? fileContracts(request.input)
      : discoveryContracts(request.input);
  if (request.command === "discover import")
    return discovery(request.input, request.context);
  if (request.command === "deploy inspect")
    return inspect(request.input.artifact, request.context);
  throw new Error("Unsupported provider command");
}
const PLATFORM = "adf";
function inspect(artifact, context) {
  require(artifact &&
    Array.isArray(artifact.resources), "Supply an ARM template with resources");
  const resources = [],
    names = new Set();
  const walk = (items, depth = 0) => {
    require(depth < 8 &&
      items.length <= 1000, "Resource nesting/count exceeds inspection limits");
    for (const resource of items) {
      require(resource &&
        typeof resource.name === "string" &&
        typeof resource.type ===
          "string", "Each resource requires a name and type");
      require([
        "Microsoft.DataFactory/factories/pipelines",
        "Microsoft.DataFactory/factories/datasets",
        "Microsoft.DataFactory/factories/linkedservices",
      ].includes(
        resource.type,
      ), "Only explicit ADF pipeline, dataset and linked-service resources are supported");
      const identity = resource.type + ":" + resource.name;
      require(!names.has(identity), "Duplicate resource identity");
      names.add(identity);
      const scan = (value) => {
        if (!value || typeof value !== "object") return;
        require(value.type !==
          "ExecuteDataFlow", "Data Flow is forbidden by these standards");
        for (const child of Object.values(value)) scan(child);
      };
      scan(resource.properties);
      resources.push({ name: resource.name, type: resource.type });
      if (resource.resources) walk(resource.resources, depth + 1);
    }
  };
  walk(artifact.resources);
  require(resources.length > 0 &&
    resources.length <= 1000, "Supply at most 1000 resources");
  return {
    apiVersion: "ingestron.deployment-inspection/v1",
    platform: PLATFORM,
    project: context.project,
    environment: context.environment,
    resources,
    evidence: "supplied-artifact",
    deployed: false,
    limitations: [
      "No target identity, permissions or remote state verified",
      "Not ARM validation or a deployment change plan",
      "Review shared-resource ownership before deploying",
    ],
  };
}
