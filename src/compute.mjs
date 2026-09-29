import { batchRest } from "./batch-rest.mjs";
const check = (v, m) => {
  if (!v) throw new Error(m);
};
const safe = (v) =>
  typeof v === "string" && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,100}$/.test(v);
export function computePrepare(input) {
  const keys = [
    "factoryName",
    "pipelineName",
    "batchAccountUrl",
    "poolName",
    "workerIdentityResourceId",
    "storageAccount",
    "resourceFolder",
    "files",
    "pythonExecutable",
    "entryPoint",
    "configFile",
    "timeout",
    "pollIntervalSeconds",
    "recovery",
  ];
  check(
    input && Object.keys(input).every((k) => keys.includes(k)),
    "Unsupported compute setting",
  );
  check(
    typeof input.factoryName === "string" &&
      /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(input.factoryName) &&
      input.factoryName.length >= 3 &&
      input.factoryName.length <= 63,
    "Invalid factory",
  );
  check(
    safe(input.pipelineName) &&
      safe(input.poolName) &&
      input.poolName.length <= 64,
    "Invalid pipeline or pool",
  );
  check(
    /^https:\/\/[a-z0-9]+\.[a-z0-9]+\.batch\.azure\.com$/.test(
      input.batchAccountUrl,
    ),
    "Invalid Batch endpoint",
  );
  check(
    /^\/subscriptions\/[a-f0-9-]{36}\/resourcegroups\/[A-Za-z0-9_.()-]+\/providers\/Microsoft.ManagedIdentity\/userAssignedIdentities\/[A-Za-z0-9_-]+$/i.test(
      input.workerIdentityResourceId,
    ),
    "Use an existing worker identity",
  );
  check(
    /^[a-z0-9]{3,24}$/.test(input.storageAccount) &&
      typeof input.resourceFolder === "string" &&
      input.resourceFolder.split("/").every(safe),
    "Invalid asset location",
  );
  check(
    Array.isArray(input.files) &&
      input.files.length > 0 &&
      input.files.length <= 100 &&
      input.files.every(safe) &&
      new Set(input.files).size === input.files.length,
    "Invalid resource files",
  );
  check(
    input.recovery === "idempotent-checkpoint-commit-v1",
    "Workload must implement reviewed checkpoint/commit recovery before Spot use",
  );
  check(
    Number.isInteger(input.pollIntervalSeconds) &&
      input.pollIntervalSeconds >= 15 &&
      input.pollIntervalSeconds <= 900,
    "Explicit polling interval required (15–900 seconds)",
  );
  check(typeof input.timeout === "string", "Explicit timeout required");
  const properties = batchRest(
    input,
    input.storageAccount,
    input.files,
    input.timeout,
    {
      entryPoint: input.entryPoint,
      configFile: input.configFile,
      taskId: "work",
      ...(input.pythonExecutable
        ? { pythonExecutable: input.pythonExecutable }
        : {}),
    },
  );
  return {
    apiVersion: "ingestron.adf-compute/v1",
    applied: false,
    pipeline: { name: input.pipelineName, properties },
    template: {
      $schema:
        "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      contentVersion: "1.0.0.0",
      resources: [
        {
          type: "Microsoft.DataFactory/factories/pipelines",
          apiVersion: "2018-06-01",
          name: input.factoryName + "/" + input.pipelineName,
          properties,
        },
      ],
    },
    recovery: {
      contract: input.recovery,
      verified: false,
      detail:
        "Declaration requires workload-specific interruption tests. Stable RunId within one ADF run; a new ADF run starts a new snapshot. No automatic OAuth lock recovery.",
    },
  };
}
export const computeDefinition = {
  name: "compute prepare",
  description:
    "Prepare a bounded managed-identity Batch pipeline for a reviewed Python workload; no deployment or pool changes.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "factoryName",
      "pipelineName",
      "batchAccountUrl",
      "poolName",
      "workerIdentityResourceId",
      "storageAccount",
      "resourceFolder",
      "files",
      "entryPoint",
      "configFile",
      "timeout",
      "pollIntervalSeconds",
      "recovery",
    ],
    properties: Object.fromEntries(
      [
        "pythonExecutable",
        "factoryName",
        "pipelineName",
        "batchAccountUrl",
        "poolName",
        "workerIdentityResourceId",
        "storageAccount",
        "resourceFolder",
        "files",
        "entryPoint",
        "configFile",
        "timeout",
        "pollIntervalSeconds",
        "recovery",
      ].map((k) => [
        k,
        k === "files"
          ? {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 100,
            }
          : k === "pollIntervalSeconds"
            ? { type: "integer" }
            : { type: "string", minLength: 1 },
      ]),
    ),
  },
};
// Pool-wide policy is separately owned by the shared infrastructure operator.
export function spotPoolPolicy(maxNodes) {
  check(
    Number.isInteger(maxNodes) && maxNodes >= 1 && maxNodes <= 100,
    "Explicit maximum Spot nodes required",
  );
  return {
    autoScaleEvaluationInterval: "PT5M",
    autoScaleFormula: `$samples = $PendingTasks.GetSamplePercent(TimeInterval_Minute * 10);\n$work = $samples < 70 ? ${maxNodes} : max($PendingTasks.GetSample(TimeInterval_Minute * 10, 70));\n$TargetDedicatedNodes = 0;\n$TargetLowPriorityNodes = min(${maxNodes}, max(0, ceil($work / $TaskSlotsPerNode)));\n$NodeDeallocationOption = taskcompletion;`,
  };
}
export const poolDefinition = {
  name: "compute pool prepare",
  description:
    "Prepare a shared pool Spot autoscale policy; operator review and Azure evaluation required before applying.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["maxNodes"],
    properties: { maxNodes: { type: "integer" } },
  },
};
export function poolPrepare(input) {
  check(
    input &&
      Object.keys(input).length === 1 &&
      Object.hasOwn(input, "maxNodes"),
    "Supply only maxNodes",
  );
  return {
    apiVersion: "ingestron.batch-pool-policy/v1",
    applied: false,
    ...spotPoolPolicy(input.maxNodes),
    review: [
      "Apply once by the pool owner, not by individual workloads.",
      "Evaluate in Azure before enabling; no dedicated fallback.",
      "Missing metrics preserve bounded capacity; monitor scale failures and idle spend.",
      "This policy is for single-instance tasks without job-release tasks.",
    ],
  };
}
