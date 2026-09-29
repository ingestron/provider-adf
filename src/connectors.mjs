import { computePrepare } from "./compute.mjs";
const check = (v, m) => {
  if (!v) throw Error(m);
};
const safe = (v) =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(v);
export function connectorPrepare(input, projectFiles = [], runtimeAssets) {
  check(
    input &&
      Object.keys(input).every((k) =>
        [
          "connector",
          "sourceId",
          "tenantId",
          "configEnv",
          "timeoutSeconds",
          "mode",
          "azure",
          "compute",
        ].includes(k),
      ),
    "Unsupported connector setting",
  );
  check(
    runtimeAssets && typeof runtimeAssets === "object",
    "Select an exact prepared connector; unresolved catalogue entries cannot be packaged",
  );
  check(
    input.mode === "customer-operated",
    "Only customer-operated mode is implemented",
  );
  check(
    safe(input.sourceId) && safe(input.tenantId),
    "Explicit source and tenant identities required",
  );
  check(
    typeof input.configEnv === "string" &&
      /^[A-Z][A-Z0-9_]{0,100}$/.test(input.configEnv),
    "Use an environment variable reference, never credentials",
  );
  check(
    Number.isInteger(input.timeoutSeconds) &&
      input.timeoutSeconds >= 1 &&
      input.timeoutSeconds <= 604800,
    "Explicit bounded timeout required",
  );
  const config = {
    apiVersion: "ingestron.singer/v1",
    mode: input.mode,
    connector: input.connector,
    sourceId: input.sourceId,
    tenantId: input.tenantId,
    configEnv: input.configEnv,
    timeoutSeconds: input.timeoutSeconds,
    reviewFile: "review.json",
  };
  const artifacts = { ...runtimeAssets };
  check(
    JSON.parse(artifacts["runtime.lock.json"]).connector === input.connector,
    "Runtime connector mismatch",
  );
  let compute;
  {
    check(
      input.azure && input.compute,
      "Azure execution requires destination and compute references",
    );
    const a = input.azure;
    check(
      Object.keys(a).sort().join(",") ===
        [
          "storageAccount",
          "container",
          "prefix",
          "vaultUrl",
          "configSecret",
          "identityClientId",
        ]
          .sort()
          .join(","),
      "Unsupported Azure setting",
    );
    check(
      /^[a-z0-9]{3,24}$/.test(a.storageAccount) &&
        /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(a.container),
      "Invalid storage destination",
    );
    check(
      typeof a.prefix === "string" && a.prefix.split("/").every(safe),
      "Unsafe Blob prefix",
    );
    check(
      /^https:\/\/[a-zA-Z0-9-]+\.vault\.azure\.net$/.test(a.vaultUrl) &&
        /^[A-Za-z0-9-]{1,127}$/.test(a.configSecret),
      "Use a Key Vault secret reference",
    );
    check(
      /^[a-fA-F0-9-]{36}$/.test(a.identityClientId),
      "Explicit managed identity client ID required",
    );
    config.azure = a;
    check(
      !["files", "entryPoint", "configFile", "recovery"].some(
        (k) => k in input.compute,
      ),
      "Connector wrapper owns workload files and entry point",
    );
    check(
      typeof input.compute.pythonExecutable === "string",
      "Select a preinstalled isolated Python environment for this connector",
    );
    compute = computePrepare({
      ...input.compute,
      files: [
        ...Object.keys(artifacts),
        "connector.json",
        "review.json",
        ...projectFiles,
      ],
      entryPoint: "singer_azure.py",
      configFile: "connector.json",
      recovery: "idempotent-checkpoint-commit-v1",
    });
    check(
      input.compute.storageAccount === a.storageAccount,
      "Asset and data storage account must match in this preview",
    );
    artifacts["pipeline.arm.json"] = JSON.stringify(compute.template, null, 2);
  }
  artifacts["connector.json"] = JSON.stringify(config, null, 2);
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    applied: false,
    artifacts,
    connector: input.connector,
    execution: "adf-batch-candidate",
    review: [
      "Prepare a separate Python 3.12 environment with the hash-locked requirements before execution.",
      "Discover in the customer network; explicitly select fields and approve review.json before running.",
      "Only full snapshots. Retrying the same run returns the first verified commit; a new run is a new snapshot.",
      "Read upstream licence notices. No managed-service rights or public distribution clearance is asserted.",
      "Native ADF/Batch acceptance remains open; this command creates assets without deployment.",
    ],
    ...(compute ? { recovery: compute.recovery } : {}),
  };
}
const text = { type: "string", minLength: 1, maxLength: 512 };
export const connectorDefinitions = [
  {
    name: "connector contracts",
    description: "Export reviewed ODCS contracts",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["review"],
      properties: { review: { type: "object" } },
    },
  },
];
export { connectorContracts } from "./vendor/connectors/connector-contract-export.mjs";
