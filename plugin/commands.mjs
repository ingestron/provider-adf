// src/project-assembly.mjs
var check = (v, m) => {
  if (!v) throw Error(m);
};
var prefix = (i) => [
  i.project,
  i.environment,
  i.configuration,
  ...i.scope.partial ? [i.scope.id] : []
].join("_");
function assemble(input) {
  const name = prefix(input);
  if (input.phase === "configure") {
    check(
      input.execution.mode === "adf-batch",
      "ADF external execution requires Batch"
    );
    check(
      !input.execution.compute.factoryName || input.binding?.factoryName === input.execution.compute.factoryName,
      "Execution factory must match the configured provider binding"
    );
    return {
      execution: {
        ...input.execution,
        compute: {
          ...input.execution.compute,
          factoryName: input.binding.factoryName,
          pipelineName: name + "_" + input.flow,
          resourceFolder: input.execution.compute.resourceFolder + "/" + name + "/" + input.flow
        }
      }
    };
  }
  check(input.phase === "assemble", "Unknown project assembly phase");
  const artifacts = { ...input.nativeFiles };
  const put = (file, value) => {
    check(
      !Object.hasOwn(artifacts, file) || artifacts[file] === value,
      "Conflicting project asset: " + file
    );
    artifacts[file] = value;
  };
  const template = artifacts["adf-template.json"] ? JSON.parse(artifacts["adf-template.json"]) : {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    resources: []
  };
  const resources = /* @__PURE__ */ new Map();
  const key = (r) => {
    const match = /^\[concat\(parameters\('factoryName'\), '\/([^']+)'\)\]$/.exec(r.name);
    return r.type + "/" + (match ? input.binding.factoryName + "/" + match[1] : r.name);
  };
  const add = (r) => {
    const old = resources.get(key(r));
    check(
      !old || JSON.stringify(old) === JSON.stringify(r),
      "Conflicting shared ADF resource: " + r.name
    );
    resources.set(key(r), r);
  };
  template.resources.forEach(add);
  const groups = /* @__PURE__ */ new Map(), staging = [];
  for (const c of input.connections) {
    const config = JSON.parse(c.artifacts["connector.json"]);
    const compute = config.projectLock.execution.compute;
    check(
      compute.factoryName === input.binding.factoryName,
      "Mixed factories in one target"
    );
    const pipeline = JSON.parse(c.artifacts["pipeline.arm.json"]).resources[0];
    const base = JSON.parse(JSON.stringify(pipeline.properties));
    const submit = base.activities.find((a) => a.name === "SubmitBatchTask");
    const body = submit.typeProperties.body;
    submit.typeProperties.body = null;
    const identity = JSON.stringify(base);
    if (!groups.has(identity)) groups.set(identity, { base, entries: [] });
    groups.get(identity).entries.push({ flow: c.flow, pipeline, body });
    for (const [file, value] of Object.entries(c.artifacts))
      if (file !== "pipeline.arm.json") put(`flows/${c.flow}/${file}`, value);
    staging.push({
      flow: c.flow,
      localDirectory: `flows/${c.flow}`,
      storageAccount: compute.storageAccount,
      resourceFolder: compute.resourceFolder,
      reviewRequired: true
    });
  }
  let index = 0;
  for (const { base, entries } of groups.values()) {
    check(
      entries.length <= 25,
      "A shared Batch worker supports at most 25 compiled workloads; split execution configurations"
    );
    const worker = name + "_batch_worker_" + ++index;
    const factory = input.binding.factoryName;
    base.parameters = { workload: { type: "String" } };
    const submit = base.activities.find((a) => a.name === "SubmitBatchTask");
    const choices = entries.map((e) => ({
      value: e.flow,
      activities: [
        {
          ...JSON.parse(JSON.stringify(submit)),
          name: "Submit_" + e.flow,
          dependsOn: [],
          typeProperties: { ...submit.typeProperties, body: e.body }
        }
      ]
    }));
    base.activities[base.activities.indexOf(submit)] = {
      name: "SubmitBatchTask",
      type: "Switch",
      dependsOn: submit.dependsOn,
      typeProperties: {
        on: { type: "Expression", value: "@pipeline().parameters.workload" },
        cases: choices,
        defaultActivities: [
          {
            name: "UnknownWorkload",
            type: "Fail",
            typeProperties: {
              message: "Workload was not compiled into this project package",
              errorCode: "INGESTRON_WORKLOAD"
            }
          }
        ]
      }
    };
    add({
      type: "Microsoft.DataFactory/factories/pipelines",
      apiVersion: "2018-06-01",
      name: factory + "/" + worker,
      properties: base
    });
    for (const e of entries)
      add({
        ...e.pipeline,
        dependsOn: [
          `[resourceId('Microsoft.DataFactory/factories/pipelines', '${factory}', '${worker}')]`
        ],
        properties: {
          activities: [
            {
              name: "ExecuteReviewedWorkload",
              type: "ExecutePipeline",
              typeProperties: {
                pipeline: { referenceName: worker, type: "PipelineReference" },
                waitOnCompletion: true,
                parameters: { workload: e.flow }
              }
            }
          ]
        }
      });
  }
  template.resources = [...resources.values()];
  template.metadata = {
    ...template.metadata ?? {},
    _generator: { name: "Ingestron ADF provider" },
    comments: `Generated by Ingestron for project ${input.project}, target ${input.configuration}. Do not edit; change the project and rebuild. See ingestron-manifest.json.`
  };
  artifacts["adf-template.json"] = JSON.stringify(template, null, 2);
  if (!artifacts["adf-parameters.json"])
    artifacts["adf-parameters.json"] = JSON.stringify(
      {
        $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        contentVersion: "1.0.0.0",
        parameters: {}
      },
      null,
      2
    );
  artifacts["staging.json"] = JSON.stringify(staging, null, 2);
  artifacts["deployment.json"] = JSON.stringify(
    {
      mode: "Incremental",
      factoryName: input.binding.factoryName,
      scope: input.scope,
      omissionMeansDeletion: false,
      resources: [...resources.keys()],
      infrastructure: "existing customer-owned resources only"
    },
    null,
    2
  );
  artifacts["PROJECT.md"] = "# ADF project package\n\nReview and deploy adf-template.json with adf-parameters.json using Incremental mode only. No deletion or complete-mode deployment is provided. Stage each flows directory to its exact staging.json destination after discovery, review and approval. The shared worker accepts only compiled workload selectors; its RunId is the snapshot retry identity. Existing storage, pools, identities and factory are referenced, not provisioned. Generation does not deploy or execute.\n";
  return {
    apiVersion: "ingestron.project-package/v1",
    artifacts,
    details: {
      entryPoint: "adf-template.json",
      deploymentMode: "Incremental",
      omissionMeansDeletion: false,
      sharedWorkers: groups.size,
      resources: [...resources.keys()],
      staging
    }
  };
}

// src/batch-rest.mjs
var expression = (value) => ({ type: "Expression", value });
var after = (activity) => [{ activity, dependencyConditions: ["Succeeded"] }];
var dynamic = (value) => {
  const text2 = typeof value === "string" ? value : JSON.stringify(value);
  return text2.includes("__RUN_ID__") ? expression(
    "@concat(" + text2.split("__RUN_ID__").map((s) => "'" + s.replaceAll("'", "''") + "'").join(", pipeline().RunId, ") + ")"
  ) : text2;
};
function batchRest(b, storageAccount, files, timeout = "00.01:00:00", workload = {
  entryPoint: "azure_runner.py",
  configFile: "config.json",
  taskId: "extract"
}) {
  for (const key of ["entryPoint", "configFile", "taskId"])
    if (typeof workload[key] !== "string" || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,100}$/.test(workload[key]))
      throw new Error("Unsafe workload file or task ID");
  if (!files.includes(workload.entryPoint) || !files.includes(workload.configFile))
    throw new Error("Workload files are missing");
  if (workload.pythonExecutable !== void 0 && !/^\/opt\/ingestron\/[A-Za-z0-9_-]+\/bin\/python$/.test(
    workload.pythonExecutable
  ))
    throw new Error(
      "Python executable must be a prepared environment under /opt/ingestron"
    );
  const match = /^(\d+)\.(\d{2}):(\d{2}):(\d{2})$/.exec(timeout);
  if (!match || +match[2] > 23 || +match[3] > 59 || +match[4] > 59)
    throw new Error("Invalid Batch timeout");
  const seconds = +match[1] * 86400 + +match[2] * 3600 + +match[3] * 60 + +match[4];
  if (seconds < 60 || seconds > 604800)
    throw new Error("Batch timeout must be one minute to seven days");
  const untilSeconds = seconds + 300;
  const untilTimeout = Math.floor(untilSeconds / 86400) + "." + [
    Math.floor(untilSeconds % 86400 / 3600),
    Math.floor(untilSeconds % 3600 / 60),
    untilSeconds % 60
  ].map((n) => String(n).padStart(2, "0")).join(":");
  const api = "?api-version=2024-07-01.20.0";
  const web = (name, method, url, body, dependsOn = []) => ({
    name,
    type: "WebActivity",
    dependsOn,
    policy: {
      timeout: "00.00:02:00",
      retry: 0,
      secureInput: true,
      secureOutput: true
    },
    typeProperties: {
      method,
      url: dynamic(url),
      headers: { "Content-Type": "application/json;odata=minimalmetadata" },
      authentication: {
        type: "MSI",
        resource: "https://batch.core.windows.net/"
      },
      turnOffAsync: true,
      ...body ? { body: dynamic(body) } : {}
    }
  });
  const jobs = b.batchAccountUrl + "/jobs", job = jobs + "/__RUN_ID__";
  return {
    variables: {
      batchState: { type: "String", defaultValue: "active" },
      batchExit: { type: "String", defaultValue: "-1" }
    },
    activities: [
      web("CreateBatchJob", "POST", jobs + api, {
        id: "__RUN_ID__",
        poolInfo: { poolId: b.poolName },
        constraints: {
          maxWallClockTime: "PT" + untilSeconds + "S",
          maxTaskRetryCount: 0
        }
      }),
      web(
        "SubmitBatchTask",
        "POST",
        job + "/tasks" + api,
        {
          id: workload.taskId,
          commandLine: (workload.pythonExecutable ?? "python") + " " + workload.entryPoint + " --config " + workload.configFile + " --run-id __RUN_ID__",
          constraints: {
            maxTaskRetryCount: 0,
            maxWallClockTime: "PT" + seconds + "S"
          },
          resourceFiles: files.map((name) => ({
            filePath: name,
            httpUrl: "https://" + storageAccount + ".blob.core.windows.net/" + b.resourceFolder + "/" + name,
            identityReference: { resourceId: b.workerIdentityResourceId }
          }))
        },
        after("CreateBatchJob")
      ),
      {
        name: "WaitForBatchTask",
        type: "Until",
        dependsOn: after("SubmitBatchTask"),
        typeProperties: {
          timeout: untilTimeout,
          expression: expression(
            "@equals(variables('batchState'), 'completed')"
          ),
          activities: [
            web(
              "ReadBatchTask",
              "GET",
              job + "/tasks/" + workload.taskId + api + "&$select=state,executionInfo"
            ),
            {
              name: "RememberState",
              type: "SetVariable",
              dependsOn: after("ReadBatchTask"),
              typeProperties: {
                variableName: "batchState",
                value: expression("@activity('ReadBatchTask').output.state")
              }
            },
            {
              name: "RememberExit",
              type: "SetVariable",
              dependsOn: after("RememberState"),
              typeProperties: {
                variableName: "batchExit",
                value: expression(
                  "@if(equals(variables('batchState'), 'completed'), string(if(contains(activity('ReadBatchTask').output.executionInfo, 'exitCode'), coalesce(activity('ReadBatchTask').output.executionInfo.exitCode, -1), -1)), '-1')"
                )
              }
            },
            {
              name: "PollDelay",
              type: "Wait",
              dependsOn: after("RememberExit"),
              typeProperties: {
                waitTimeInSeconds: b.pollIntervalSeconds ?? 300
              }
            }
          ]
        }
      },
      web(
        "TerminateBatchJob",
        "POST",
        job + "/terminate" + api,
        { terminateReason: "ADF task completed" },
        [{ activity: "WaitForBatchTask", dependencyConditions: ["Completed"] }]
      ),
      {
        name: "CheckBatchResult",
        type: "IfCondition",
        dependsOn: after("TerminateBatchJob"),
        typeProperties: {
          expression: expression("@equals(variables('batchExit'), '0')"),
          ifTrueActivities: [],
          ifFalseActivities: [
            {
              name: "BatchTaskFailed",
              type: "Fail",
              typeProperties: {
                message: "Batch task failed. Inspect job state and credential recovery before retrying.",
                errorCode: "BatchTaskFailed"
              }
            }
          ]
        }
      }
    ]
  };
}

// src/compute.mjs
var check2 = (v, m) => {
  if (!v) throw new Error(m);
};
var safe = (v) => typeof v === "string" && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,100}$/.test(v);
function computePrepare(input) {
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
    "recovery"
  ];
  check2(
    input && Object.keys(input).every((k) => keys.includes(k)),
    "Unsupported compute setting"
  );
  check2(
    typeof input.factoryName === "string" && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(input.factoryName) && input.factoryName.length >= 3 && input.factoryName.length <= 63,
    "Invalid factory"
  );
  check2(
    safe(input.pipelineName) && safe(input.poolName) && input.poolName.length <= 64,
    "Invalid pipeline or pool"
  );
  check2(
    /^https:\/\/[a-z0-9]+\.[a-z0-9]+\.batch\.azure\.com$/.test(
      input.batchAccountUrl
    ),
    "Invalid Batch endpoint"
  );
  check2(
    /^\/subscriptions\/[a-f0-9-]{36}\/resourcegroups\/[A-Za-z0-9_.()-]+\/providers\/Microsoft.ManagedIdentity\/userAssignedIdentities\/[A-Za-z0-9_-]+$/i.test(
      input.workerIdentityResourceId
    ),
    "Use an existing worker identity"
  );
  check2(
    /^[a-z0-9]{3,24}$/.test(input.storageAccount) && typeof input.resourceFolder === "string" && input.resourceFolder.split("/").every(safe),
    "Invalid asset location"
  );
  check2(
    Array.isArray(input.files) && input.files.length > 0 && input.files.length <= 100 && input.files.every(safe) && new Set(input.files).size === input.files.length,
    "Invalid resource files"
  );
  check2(
    input.recovery === "idempotent-checkpoint-commit-v1",
    "Workload must implement reviewed checkpoint/commit recovery before Spot use"
  );
  check2(
    Number.isInteger(input.pollIntervalSeconds) && input.pollIntervalSeconds >= 15 && input.pollIntervalSeconds <= 900,
    "Explicit polling interval required (15\u2013900 seconds)"
  );
  check2(typeof input.timeout === "string", "Explicit timeout required");
  const properties = batchRest(
    input,
    input.storageAccount,
    input.files,
    input.timeout,
    {
      entryPoint: input.entryPoint,
      configFile: input.configFile,
      taskId: "work",
      ...input.pythonExecutable ? { pythonExecutable: input.pythonExecutable } : {}
    }
  );
  return {
    apiVersion: "ingestron.adf-compute/v1",
    applied: false,
    pipeline: { name: input.pipelineName, properties },
    template: {
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      contentVersion: "1.0.0.0",
      resources: [
        {
          type: "Microsoft.DataFactory/factories/pipelines",
          apiVersion: "2018-06-01",
          name: input.factoryName + "/" + input.pipelineName,
          properties
        }
      ]
    },
    recovery: {
      contract: input.recovery,
      verified: false,
      detail: "Declaration requires workload-specific interruption tests. Stable RunId within one ADF run; a new ADF run starts a new snapshot. No automatic OAuth lock recovery."
    }
  };
}
var computeDefinition = {
  name: "compute prepare",
  description: "Prepare a bounded managed-identity Batch pipeline for a reviewed Python workload; no deployment or pool changes.",
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
      "recovery"
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
        "recovery"
      ].map((k) => [
        k,
        k === "files" ? {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 100
        } : k === "pollIntervalSeconds" ? { type: "integer" } : { type: "string", minLength: 1 }
      ])
    )
  }
};
function spotPoolPolicy(maxNodes) {
  check2(
    Number.isInteger(maxNodes) && maxNodes >= 1 && maxNodes <= 100,
    "Explicit maximum Spot nodes required"
  );
  return {
    autoScaleEvaluationInterval: "PT5M",
    autoScaleFormula: `$samples = $PendingTasks.GetSamplePercent(TimeInterval_Minute * 10);
$work = $samples < 70 ? ${maxNodes} : max($PendingTasks.GetSample(TimeInterval_Minute * 10, 70));
$TargetDedicatedNodes = 0;
$TargetLowPriorityNodes = min(${maxNodes}, max(0, ceil($work / $TaskSlotsPerNode)));
$NodeDeallocationOption = taskcompletion;`
  };
}
function poolPrepare(input) {
  check2(
    input && Object.keys(input).length === 1 && Object.hasOwn(input, "maxNodes"),
    "Supply only maxNodes"
  );
  return {
    apiVersion: "ingestron.batch-pool-policy/v1",
    applied: false,
    ...spotPoolPolicy(input.maxNodes),
    review: [
      "Apply once by the pool owner, not by individual workloads.",
      "Evaluate in Azure before enabling; no dedicated fallback.",
      "Missing metrics preserve bounded capacity; monitor scale failures and idle spend.",
      "This policy is for single-instance tasks without job-release tasks."
    ]
  };
}

// src/vendor/connectors/connector-contract-export.mjs
var check3 = (value, message) => {
  if (!value) throw Error(message);
};
var safe2 = (v) => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(v);
function connectorContracts(input) {
  check3(
    input && Object.keys(input).length === 1 && input.review?.apiVersion === "ingestron.singer-review/v1",
    "Supply one Singer review bundle"
  );
  check3(
    input.review.status === "approved",
    "Approve the reviewed projection first"
  );
  const entries = Object.entries(input.review.contracts ?? {});
  check3(entries.length >= 1 && entries.length <= 100, "Select 1\u2013100 contracts");
  const artifacts = {};
  for (const [name, contract] of entries) {
    check3(
      safe2(name) && contract?.apiVersion === "v3.1.0" && typeof contract.id === "string",
      "Invalid ODCS contract identity"
    );
    artifacts[name + ".odcs.json"] = JSON.stringify(contract, null, 2);
  }
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    applied: false,
    artifacts,
    review: [
      "The host validates ODCS on export. The runtime independently checks agreement with the selected source projection.",
      "Source contracts require deliberate mappings before a common model or report pack can consume them."
    ]
  };
}

// src/connectors.mjs
var check4 = (v, m) => {
  if (!v) throw Error(m);
};
var safe3 = (v) => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(v);
function connectorPrepare(input, projectFiles = [], runtimeAssets) {
  check4(
    input && Object.keys(input).every(
      (k) => [
        "connector",
        "sourceId",
        "tenantId",
        "configEnv",
        "timeoutSeconds",
        "mode",
        "azure",
        "compute"
      ].includes(k)
    ),
    "Unsupported connector setting"
  );
  check4(
    runtimeAssets && typeof runtimeAssets === "object",
    "Select an exact prepared connector; unresolved catalogue entries cannot be packaged"
  );
  check4(
    input.mode === "customer-operated",
    "Only customer-operated mode is implemented"
  );
  check4(
    safe3(input.sourceId) && safe3(input.tenantId),
    "Explicit source and tenant identities required"
  );
  check4(
    typeof input.configEnv === "string" && /^[A-Z][A-Z0-9_]{0,100}$/.test(input.configEnv),
    "Use an environment variable reference, never credentials"
  );
  check4(
    Number.isInteger(input.timeoutSeconds) && input.timeoutSeconds >= 1 && input.timeoutSeconds <= 604800,
    "Explicit bounded timeout required"
  );
  const config = {
    apiVersion: "ingestron.singer/v1",
    mode: input.mode,
    connector: input.connector,
    sourceId: input.sourceId,
    tenantId: input.tenantId,
    configEnv: input.configEnv,
    timeoutSeconds: input.timeoutSeconds,
    reviewFile: "review.json"
  };
  const artifacts = { ...runtimeAssets };
  check4(
    JSON.parse(artifacts["runtime.lock.json"]).connector === input.connector,
    "Runtime connector mismatch"
  );
  let compute;
  {
    check4(
      input.azure && input.compute,
      "Azure execution requires destination and compute references"
    );
    const a = input.azure;
    check4(
      Object.keys(a).sort().join(",") === [
        "storageAccount",
        "container",
        "prefix",
        "vaultUrl",
        "configSecret",
        "identityClientId"
      ].sort().join(","),
      "Unsupported Azure setting"
    );
    check4(
      /^[a-z0-9]{3,24}$/.test(a.storageAccount) && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(a.container),
      "Invalid storage destination"
    );
    check4(
      typeof a.prefix === "string" && a.prefix.split("/").every(safe3),
      "Unsafe Blob prefix"
    );
    check4(
      /^https:\/\/[a-zA-Z0-9-]+\.vault\.azure\.net$/.test(a.vaultUrl) && /^[A-Za-z0-9-]{1,127}$/.test(a.configSecret),
      "Use a Key Vault secret reference"
    );
    check4(
      /^[a-fA-F0-9-]{36}$/.test(a.identityClientId),
      "Explicit managed identity client ID required"
    );
    config.azure = a;
    check4(
      !["files", "entryPoint", "configFile", "recovery"].some(
        (k) => k in input.compute
      ),
      "Connector wrapper owns workload files and entry point"
    );
    check4(
      typeof input.compute.pythonExecutable === "string",
      "Select a preinstalled isolated Python environment for this connector"
    );
    compute = computePrepare({
      ...input.compute,
      files: [
        ...Object.keys(artifacts),
        "connector.json",
        "review.json",
        ...projectFiles
      ],
      entryPoint: "singer_azure.py",
      configFile: "connector.json",
      recovery: "idempotent-checkpoint-commit-v1"
    });
    check4(
      input.compute.storageAccount === a.storageAccount,
      "Asset and data storage account must match in this preview"
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
      "Native ADF/Batch acceptance remains open; this command creates assets without deployment."
    ],
    ...compute ? { recovery: compute.recovery } : {}
  };
}

// src/vendor/connectors/shape.mjs
var object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false
});
var text = { type: "string", minLength: 1 };

// src/vendor/connectors/connection-contract.mjs
var runtimeContract = "ingestron.snapshot/python/v1";
var field = object(
  {
    type: {
      type: "string",
      enum: ["integer", "string", "boolean", "number", "decimal", "json"]
    },
    nullable: { type: "boolean" },
    precision: { type: "integer" },
    scale: { type: "integer" }
  },
  ["type", "nullable"]
);
var selectionSchema = {
  type: "object",
  additionalProperties: object({
    name: text,
    fields: { type: "object", additionalProperties: field }
  })
};
function validateProjectConnection(input, descriptor) {
  if (input.apiVersion !== "ingestron.connection-request/v1" || !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*@\d+\.\d+\.\d+$/.test(input.connector) || input.runtimeContract !== runtimeContract || !input.specificationSha256)
    throw Error("Invalid project connection request");
  if (Object.keys(input).some(
    (k) => ![
      "apiVersion",
      "project",
      "environment",
      "flow",
      "connection",
      "connector",
      "sourceId",
      "tenantId",
      "settings",
      "selection",
      "tables",
      "execution",
      "timeoutSeconds",
      "sourcePackage",
      "executionPackage",
      "specificationSha256",
      "runtimeAssetSha256",
      "runtimeContract"
    ].includes(k)
  ))
    throw Error("Unknown project connection setting");
  if (input.tables && input.selection)
    throw Error("Use ODCS tables or legacy selection, never both");
  const selection = input.tables ? selectionFromTables(input.tables) : input.selection;
  if (!conforms(descriptor.settingsSchema, input.settings) || !conforms(descriptor.selectionSchema, selection) || !conforms(descriptor.executionSchema, input.execution))
    throw Error("Invalid connector settings, selection or execution");
  const values = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (value.$secret) values.push(value);
    else Object.values(value).forEach(visit);
  }
  visit(input.settings);
  if (input.execution.mode === "adf-batch" && values.some((v) => v.$secret.env))
    throw Error("Batch execution requires Key Vault secret references");
  for (const value of values)
    if (value?.$secret) {
      const ref2 = value.$secret;
      if (ref2.env ? !/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref2.env) : !(/^https:\/\/[a-zA-Z0-9-]+\.vault\.azure\.net$/.test(
        ref2.vaultUrl
      ) && /^[A-Za-z0-9-]{1,127}$/.test(ref2.name) && /^[a-fA-F0-9-]{36}$/.test(ref2.identityClientId)))
        throw Error("Invalid runtime secret reference");
    }
  const names = Object.values(selection).map((table) => table.name);
  if (new Set(names).size !== names.length || names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)))
    throw Error("Invalid or duplicate selected table name");
  if (!Object.keys(selection).length)
    throw Error("Select at least one source stream");
  for (const [stream, table] of Object.entries(selection)) {
    if (!/^[A-Za-z0-9_-]+$/.test(stream) || !Object.keys(table.fields).length)
      throw Error("Select safe stream IDs and fields");
  }
  for (const table of Object.values(selection))
    for (const [name, field2] of Object.entries(table.fields)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
        throw Error("Invalid selected field");
      if (field2.type === "decimal" ? !(Number.isInteger(field2.precision) && field2.precision >= 1 && field2.precision <= 38 && Number.isInteger(field2.scale) && field2.scale >= 0 && field2.scale <= field2.precision) : field2.precision !== void 0 || field2.scale !== void 0)
        throw Error("Invalid decimal precision/scale");
    }
  return selection;
}
function conforms(schema, value) {
  const allowed = /* @__PURE__ */ new Set([
    "type",
    "oneOf",
    "properties",
    "items",
    "required",
    "additionalProperties",
    "enum",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum"
  ]);
  if (!schema || typeof schema !== "object" || Object.keys(schema).some((k) => !allowed.has(k)))
    throw Error("Unsupported connector schema keyword");
  if (schema.oneOf && schema.oneOf.filter((s) => conforms(s, value)).length !== 1)
    return false;
  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(value)))
    return false;
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const types2 = {
    object: isObject,
    array: Array.isArray(value),
    integer: Number.isInteger(value),
    number: typeof value === "number" && Number.isFinite(value),
    string: typeof value === "string",
    boolean: typeof value === "boolean",
    null: value === null
  };
  if (schema.type && !types2[schema.type]) return false;
  if (typeof value === "number" && (schema.minimum !== void 0 && value < schema.minimum || schema.maximum !== void 0 && value > schema.maximum))
    return false;
  if (typeof value === "string" && (Array.from(value).length < (schema.minLength ?? 0) || Array.from(value).length > (schema.maxLength ?? Infinity)))
    return false;
  if (Array.isArray(value) && (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity) || schema.items && !value.every((v) => conforms(schema.items, v))))
    return false;
  if (isObject) {
    if (!(schema.required ?? []).every((k) => Object.hasOwn(value, k)))
      return false;
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties && Object.hasOwn(schema.properties, key)) {
        if (!conforms(schema.properties[key], child)) return false;
      } else if (schema.additionalProperties === false) return false;
      else if (typeof schema.additionalProperties === "object" && !conforms(schema.additionalProperties, child))
        return false;
    }
  }
  return true;
}
function selectionFromTables(tables) {
  if (!tables || typeof tables !== "object" || Array.isArray(tables))
    throw Error("Invalid ODCS table map");
  const selected = {};
  for (const [name, table] of Object.entries(tables)) {
    if (!table.contract || !Array.isArray(table.columns) || !table.columns.length || !table.source?.stream || selected[table.source.stream])
      throw Error("Invalid or duplicate contracted stream");
    const fields = {};
    for (const column of table.columns) {
      const type = column.type.toUpperCase();
      const mapped = {
        STRING: "string",
        BIGINT: "integer",
        INT: "integer",
        INTEGER: "integer",
        SMALLINT: "integer",
        DOUBLE: "number",
        FLOAT: "number",
        BOOLEAN: "boolean"
      }[type];
      const decimal = /^DECIMAL\((\d+),\s*(\d+)\)$/.exec(type);
      if (!mapped && !decimal)
        throw Error(
          `Snapshot projection does not support ODCS physical type ${type}`
        );
      fields[column.name] = decimal ? {
        type: "decimal",
        precision: Number(decimal[1]),
        scale: Number(decimal[2]),
        nullable: !column.required
      } : { type: mapped, nullable: !column.required };
    }
    selected[table.source.stream] = { name, fields };
  }
  return selected;
}

// src/project-connections.mjs
var executionSchema = {
  ...object({
    mode: { type: "string", enum: ["adf-batch"] },
    azure: object({
      storageAccount: text,
      container: text,
      prefix: text,
      vaultUrl: text,
      identityClientId: text
    }),
    compute: { type: "object", additionalProperties: true }
  })
};
var connectorRuntimes = {
  [runtimeContract]: {
    selectionSchema,
    executionSchema,
    prepareCommand: "connection prepare",
    contractsCommand: "connector contracts",
    executionPlatforms: ["adf"]
  }
};
function projectConnectionPrepare(request) {
  const { runtimeAssets, ...input } = request;
  if (!runtimeAssets || !input.runtimeAssetSha256)
    throw Error("Install a connector package with runtime assets");
  const selection = validateProjectConnection(input, {
    ...connectorRuntimes[runtimeContract],
    settingsSchema: JSON.parse(runtimeAssets["settings.schema.json"])
  });
  const result = connectorPrepare(
    {
      connector: input.connector.split(":")[1],
      mode: "customer-operated",
      sourceId: input.sourceId,
      tenantId: input.tenantId,
      configEnv: "INGESTRON_TAP_CONFIG",
      timeoutSeconds: input.timeoutSeconds,
      azure: {
        ...input.execution.azure,
        configSecret: "project-field-secrets"
      },
      compute: input.execution.compute
    },
    ["selection.json", "project-connection.lock.json"],
    runtimeAssets
  );
  const config = JSON.parse(result.artifacts["connector.json"]);
  config.sourceSettings = input.settings;
  config.projectLock = input;
  if (config.azure) delete config.azure.configSecret;
  result.artifacts["connector.json"] = JSON.stringify(config, null, 2);
  result.artifacts["selection.json"] = JSON.stringify(selection, null, 2);
  result.artifacts["project-connection.lock.json"] = JSON.stringify(
    input,
    null,
    2
  );
  return result;
}

// plugin/runtime-assets.mjs
var fileRunner = `"""Bounded source discovery. Reads explicit files locally or with a private Blob SAS handout."""
import argparse, csv, datetime, decimal, hashlib, io, json, pathlib, re, sys, urllib.request, urllib.parse, zipfile
MAX_BYTES=20*1024*1024
MAX_TOTAL=100*1024*1024
class DiscoveryError(ValueError): pass
def fail(message): raise DiscoveryError(message)
def unique(pairs):
    out={}
    for k,v in pairs:
        if k in out: fail('Duplicate JSON property')
        out[k]=v
    return out
def parse_json(raw):
    return json.loads(raw,parse_float=decimal.Decimal,object_pairs_hook=unique,parse_constant=lambda _:fail('Non-finite JSON number'))
def name(value):
    if not isinstance(value,str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,62}',value): fail('Column names require reviewed simple identifiers')
    return value

def infer(values, field, missing=0, depth=0):
    if depth>8: fail('Nested schema depth exceeds 8')
    present=[v for v in values if v is not None]
    kinds=set('boolean' if isinstance(v,bool) else 'integer' if isinstance(v,int) else 'number' if isinstance(v,(float,decimal.Decimal)) else 'timestamp' if isinstance(v,datetime.datetime) else 'date' if isinstance(v,datetime.date) else 'object' if isinstance(v,dict) else 'array' if isinstance(v,list) else 'string' if isinstance(v,str) else 'unknown' for v in present)
    if kinds=={'integer','number'}: kinds={'number'}
    if len(kinds)>1 or 'unknown' in kinds: fail('Incompatible observed types for '+field)
    kind=next(iter(kinds),'string')
    col={'name':name(field),'logicalType':kind,'physicalType':{'string':'STRING','integer':'BIGINT','number':'DOUBLE','boolean':'BOOLEAN','timestamp':'TIMESTAMP','date':'DATE','object':'STRUCT','array':'ARRAY'}[kind], 'nullable':True,'evidence':'sampled-values','observedNulls':len(values)-len(present),'observedMissing':missing}
    if not present: col['warning']='All sampled values are null; type is unresolved, STRING is a draft placeholder'
    if kind=='integer' and any(v<-(2**63) or v>=2**63 for v in present): fail('Integer exceeds BIGINT for '+field)
    if kind=='number' and all(isinstance(v,(int,decimal.Decimal)) for v in present):
        numbers=[decimal.Decimal(v) for v in present]
        scale=max(max(0,-v.as_tuple().exponent) for v in numbers)
        integral=max(max(0,len(v.as_tuple().digits)+v.as_tuple().exponent) for v in numbers)
        precision=max(1,integral+scale)
        if precision>38: fail('Decimal precision exceeds 38')
        col['physicalType']=f'DECIMAL({precision},{scale})'
    if kind=='object': col['properties']=columns(present,depth+1)
    if kind=='array':
        elements=[v for row in present for v in row]
        if len(elements)>10000: fail('Array sample exceeds 10000 elements')
        col['items']=infer(elements,'item',depth=depth+1)
    return col

def columns(rows,depth=0):
    if not rows: fail('Empty dataset needs an explicit schema; no columns invented')
    if not all(isinstance(r,dict) for r in rows): fail('Expected object records')
    keys=list(dict.fromkeys(k for r in rows for k in r))
    if not keys or len(keys)>200: fail('Expected 1\u2013200 columns')
    return [infer([r[k] for r in rows if k in r],k,sum(k not in r for r in rows),depth) for k in keys]

def arrow_column(f):
    import pyarrow as pa
    t=f.type
    if pa.types.is_dictionary(t): t=t.value_type
    if pa.types.is_struct(t):
        c={'logicalType':'object','physicalType':'STRUCT','properties':[arrow_column(x) for x in t]}
    elif pa.types.is_list(t) or pa.types.is_large_list(t):
        c={'logicalType':'array','physicalType':'ARRAY','items':arrow_column(pa.field('item',t.value_type))}
    elif pa.types.is_decimal(t):
        if t.precision>38 or t.scale<0 or t.scale>t.precision: fail('Unsupported Parquet decimal')
        c={'logicalType':'number','physicalType':f'DECIMAL({t.precision},{t.scale})'}
    elif pa.types.is_integer(t):
        if pa.types.is_uint64(t): fail('uint64 requires a reviewed decimal mapping')
        c={'logicalType':'integer','physicalType':'BIGINT'}
    elif pa.types.is_floating(t): c={'logicalType':'number','physicalType':'DOUBLE'}
    elif pa.types.is_boolean(t): c={'logicalType':'boolean','physicalType':'BOOLEAN'}
    elif pa.types.is_date(t): c={'logicalType':'date','physicalType':'DATE'}
    elif pa.types.is_timestamp(t):
        if t.tz: fail('Timezone-bearing Parquet timestamps need explicit conversion')
        c={'logicalType':'timestamp','physicalType':'TIMESTAMP'}
    elif pa.types.is_string(t) or pa.types.is_large_string(t): c={'logicalType':'string','physicalType':'STRING'}
    elif pa.types.is_binary(t) or pa.types.is_large_binary(t): c={'logicalType':'string','physicalType':'BINARY'}
    else: fail('Unsupported Parquet type')
    return dict(c,name=name(f.name),nullable=f.nullable,evidence='declared-parquet-schema')

def parse_file(raw,fmt,spec,limit):
    if fmt=='parquet':
        import pyarrow.parquet as pq
        p=pq.ParquetFile(io.BytesIO(raw))
        return [arrow_column(f) for f in p.schema_arrow], {'rowCount':p.metadata.num_rows,'sampledRows':0,'truncated':False}
    rows=[]
    if fmt in ['csv','tsv']:
        reader=csv.reader(io.StringIO(raw.decode('utf-8-sig'),newline=''),delimiter=',' if fmt=='csv' else '\\t',strict=True)
        header=next(reader,[])
        if not header or len(header)!=len(set(header)): fail('Missing or duplicate delimited header')
        for h in header: name(h)
        for row in reader:
            if len(row)!=len(header): fail('Delimited row width differs from header')
            rows.append(dict(zip(header,[None if v=='' else v for v in row])))
            if len(rows)>limit: break
    elif fmt=='json':
        rows=parse_json(raw.decode('utf-8-sig'))
        if not isinstance(rows,list): fail('JSON discovery requires an explicit top-level record array')
    elif fmt=='jsonl':
        for line in raw.decode('utf-8-sig').splitlines():
            if line.strip(): rows.append(parse_json(line))
            if len(rows)>limit: break
    elif fmt=='xml':
        from defusedxml import ElementTree as ET
        root=ET.fromstring(raw,forbid_dtd=True,forbid_entities=True,forbid_external=True)
        for element in root:
            if element.tag!='row' or element.attrib: fail('XML requires simple root/row records')
            row={}
            for c in element:
                if c.tag in row or len(c) or set(c.attrib)-{'null'}: fail('Unsupported or duplicate XML field')
                if c.get('null') not in [None,'true']: fail('Unsupported XML null marker')
                if c.get('null')=='true' and c.text: fail('Null XML field contains text')
                row[name(c.tag)]=None if c.get('null')=='true' else (c.text or '')
            rows.append(row)
            if len(rows)>limit: break
    elif fmt=='xlsx':
        import openpyxl
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if len(z.infolist())>2000 or sum(v.file_size for v in z.infolist())>32*1024*1024: fail('Workbook expanded size exceeds limit')
            if any('vbaproject' in v.filename.lower() or 'externallinks/' in v.filename.lower() for v in z.infolist()): fail('Macro/external-link workbook unsupported')
        wb=openpyxl.load_workbook(io.BytesIO(raw),read_only=True,data_only=False,keep_links=False)
        try:
            if spec.get('sheet') not in wb.sheetnames: fail('Select an existing explicit worksheet')
            iterator=wb[spec['sheet']].iter_rows()
            first=next(iterator,[])
            header=[c.value for c in first]
            if not header or len(header)!=len(set(header)): fail('Workbook header missing or duplicated')
            for h in header: name(h)
            for cells in iterator:
                if any(c.data_type=='f' for c in cells): fail('Formula cells require reviewed values; formulas are not evaluated')
                row=[c.value for c in cells]
                if not any(v is not None for v in row): continue
                rows.append(dict(zip(header,row)))
                if len(rows)>limit: break
        finally: wb.close()
    else: fail('Unsupported file format')
    sampled=rows[:limit]
    return columns(sampled), {'sampledRows':len(sampled),'truncated':len(rows)>limit}

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): fail('Storage redirects are not permitted')

def discover(config,read):
    if config.get('sourceKind')!='adls' or config.get('format') not in ['csv','tsv','json','jsonl','parquet','xml','xlsx']: fail('Unsupported source kind/format')
    if not isinstance(config.get('datasets'),list) or not 1<=len(config['datasets'])<=100 or not isinstance(config.get('sampleRows'),int) or not 1<=config['sampleRows']<=10000: fail('Invalid bounded source selection')
    names=set(); file_count=0
    for spec in config['datasets']:
        name(spec['name'])
        if spec['name'] in names: fail('Duplicate dataset name')
        names.add(spec['name'])
        if not isinstance(spec.get('paths'),list) or not 1<=len(spec['paths'])<=100: fail('Expected 1\u2013100 paths per dataset')
        file_count+=len(spec['paths'])
        if len(set(spec['paths']))!=len(spec['paths']) or file_count>200: fail('Duplicate paths or more than 200 selected file reads')
    results=[]; total=0
    for spec in config['datasets']:
        found=[]; schemas=[]; sampled=0; truncated=False; row_count=0
        for path in spec['paths']:
            if not isinstance(path,str) or not re.fullmatch(r'[A-Za-z0-9_./= -]+',path) or any(p in ['', '.', '..'] for p in path.split('/')): fail('Unsafe source path')
            raw=read(path); total+=len(raw)
            if len(raw)>MAX_BYTES or total>MAX_TOTAL: fail('Source bytes exceed limit')
            cols,counts=parse_file(raw,config['format'],spec,config['sampleRows'])
            # Multiple files are accepted only with equal schemas; drift needs a new review.
            signature=[{k:v for k,v in c.items() if k not in ['observedNulls','observedMissing']} for c in cols]
            if schemas and signature!=schemas[0]: fail('Schema drift across explicitly selected files')
            schemas.append(signature)
            sampled+=counts['sampledRows']; truncated|=counts['truncated']; row_count+=counts.get('rowCount',0)
            found.append({'path':path,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),**counts})
        partitions=spec.get('partitionColumns',[])
        for key in partitions:
            name(key)
            if any(c['name']==key for c in schemas[0]): fail('Partition column already exists in file schema')
            for path in spec['paths']:
                if not any(part.startswith(key+'=') and len(part)>len(key)+1 for part in path.split('/')[:-1]): fail('Missing declared path partition')
            schemas[0].append({'name':key,'logicalType':'string','physicalType':'STRING','nullable':True,'evidence':'declared-path-partition'})
        results.append({'name':spec['name'],'format':config['format'],'files':found,'sheet':spec.get('sheet'),'columns':schemas[0],'sampledRows':sampled,'truncated':truncated,**({'rowCount':row_count} if config['format']=='parquet' else {})})
    return {'apiVersion':'ingestron.file-metadata/v1','sourceId':config['sourceId'],'sourceKind':'adls','format':config['format'],'datasets':results}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--config',default=str(pathlib.Path(__file__).with_name('discovery.json')))
    g=p.add_mutually_exclusive_group(required=True); g.add_argument('--local-root'); g.add_argument('--connections')
    p.add_argument('--out',required=True)
    args=p.parse_args(); out=pathlib.Path(args.out)
    if out.exists(): fail('Metadata destination exists')
    config=json.loads(pathlib.Path(args.config).read_text())
    if config.get('sourceKind')!='adls' or not 1<=len(config.get('datasets',[]))<=100 or not 1<=config.get('sampleRows',0)<=10000: fail('Invalid bounded discovery configuration')
    if args.local_root:
        root=pathlib.Path(args.local_root).resolve()
        def read(path):
            resolved=(root/path).resolve()
            if not resolved.is_relative_to(root): fail('Source escapes local root')
            with resolved.open('rb') as f: return f.read(MAX_BYTES+1)
    else:
        c=json.loads(pathlib.Path(args.connections).read_text())['storage']
        base=c['blobUrl'].rstrip('/'); token=c['sasToken'].lstrip('?')
        if not re.fullmatch(r'https://[a-z0-9]{3,24}\\.blob\\.core\\.windows\\.net/[a-z0-9-]{3,63}',base): fail('Expected an Azure Blob container HTTPS endpoint')
        opener=urllib.request.build_opener(NoRedirect())
        def read(path):
            try:
                url=base+'/'+urllib.parse.quote(path,safe='/=')+'?'+token
                with opener.open(url,timeout=60) as r: return r.read(MAX_BYTES+1)
            except Exception: fail('Blob read failed; check access, expiry and source path (credential URL suppressed)')
    result=discover(config,read)
    payload=json.dumps(result,indent=2)
    if len(payload.encode())>1900000: fail('Metadata exceeds CLI input bound; narrow source selection')
    with out.open('x',encoding='utf-8') as f: f.write(payload+'\\n')
    print(json.dumps({'metadata':str(out),'datasets':len(result['datasets']),'format':config['format']}))
if __name__=='__main__':
    try: main()
    except Exception as exc:
        # Parser/HTTP exceptions can include source values or credential URLs.
        print(str(exc) if isinstance(exc,DiscoveryError) else 'Discovery failed; inspect format/settings and installed parser dependencies',file=sys.stderr)
        sys.exit(1)
`;
var sqlRunner = '// Explicit customer-side catalogue reader; never runs inside the compiler.\nimport sql from "mssql";\nimport { readFileSync, writeFileSync, existsSync } from "node:fs";\nimport { parseArgs } from "node:util";\nconst { values } = parseArgs({\n  options: { connections: { type: "string" }, out: { type: "string" } },\n});\nlet pool;\ntry {\n  if (!values.connections || !values.out || existsSync(values.out))\n    throw Error("Supply --connections and a new --out path");\n  const config = JSON.parse(\n    readFileSync(new URL("./discovery.json", import.meta.url), "utf8"),\n  );\n  const c = JSON.parse(readFileSync(values.connections, "utf8")).sql;\n  if (\n    !/^[a-z0-9-]+\\.database\\.windows\\.net$/.test(c.server) ||\n    c.encrypt !== true ||\n    c.trustServerCertificate !== false\n  )\n    throw Error("Expected encrypted Azure SQL connection");\n  for (let attempt = 0; attempt < 3; attempt++) {\n    try {\n      pool = await new sql.ConnectionPool({\n        server: c.server,\n        port: c.port ?? 1433,\n        database: c.database,\n        user: c.user,\n        password: c.password,\n        options: { encrypt: true, trustServerCertificate: false },\n        connectionTimeout: 120000,\n        requestTimeout: 120000,\n        pool: { min: 0, max: 1, idleTimeoutMillis: 1000 },\n      }).connect();\n      break;\n    } catch {\n      if (attempt === 2)\n        throw Error(\n          "SQL connection failed; check access or free-offer availability",\n        );\n      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));\n    }\n  }\n  const rows = (\n    await pool\n      .request()\n      .query(\n        readFileSync(new URL("./metadata-query.sql", import.meta.url), "utf8"),\n      )\n  ).recordset;\n  if (!rows.length || rows.length > 10000)\n    throw Error("Catalogue empty or exceeds 10000 columns; narrow scope");\n  const payload = JSON.stringify(\n    { sourceId: config.sourceId, sourceKind: "azure-sql", rows },\n    null,\n    2,\n  );\n  if (Buffer.byteLength(payload) > 1900000)\n    throw Error("Metadata exceeds CLI input size");\n  writeFileSync(values.out, payload + "\\n", { flag: "wx" });\n  console.log(\n    JSON.stringify({\n      metadata: values.out,\n      columns: rows.length,\n      tables: new Set(rows.map((r) => r.schema_name + "." + r.table_name)).size,\n    }),\n  );\n} catch {\n  console.error(\n    "SQL discovery failed; verify connection, database availability, catalogue scope and output path. Credentials suppressed.",\n  );\n  process.exitCode = 1;\n} finally {\n  if (pool) await pool.close();\n}\n';
var requirements = "pyarrow==21.0.0\nopenpyxl==3.1.5\ndefusedxml==0.7.1\n";

// src/deployment-runner.mjs
var runner = String.raw`#!/usr/bin/env python3
"""Reviewable ADF deployment. Uses an existing Azure CLI login, never stored credentials."""
import argparse, hashlib, json, pathlib, subprocess, sys, re
ROOT = pathlib.Path(__file__).resolve().parent

def az(*args):
    result = subprocess.run(['az', *args, '--only-show-errors', '--output', 'json'], capture_output=True, text=True, timeout=600)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or 'Azure CLI command failed')
    return json.loads(result.stdout) if result.stdout.strip() else None

def digest(template, config, subscription, group):
    return hashlib.sha256(json.dumps([template, config, subscription, group], sort_keys=True).encode()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'plan', 'apply', 'run', 'status', 'download'])
    parser.add_argument('--subscription', required=True)
    parser.add_argument('--resource-group', required=True)
    parser.add_argument('--approve', help='Reviewed digest printed by plan; required for apply')
    parser.add_argument('--approve-init', action='store_true', help='Explicitly approve new factory creation')
    parser.add_argument('--run-id')
    parser.add_argument('--storage-account')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-fA-F-]{36}', args.subscription) or not re.fullmatch(r'[A-Za-z0-9_.()-]{1,90}', args.resource_group):
        raise RuntimeError('Supply an explicit subscription UUID and resource group')
    if args.run_id and not re.fullmatch(r'[0-9a-fA-F-]{36}', args.run_id):
        raise RuntimeError('Invalid run ID')
    config = json.loads((ROOT/'deployment.json').read_text())
    template = json.loads((ROOT/'template.json').read_text())
    base = ['--subscription', args.subscription, '--resource-group', args.resource_group]
    factory = config['factoryName']
    scope = '/subscriptions/'+args.subscription+'/resourceGroups/'+args.resource_group+'/providers/Microsoft.DataFactory/factories/'+factory
    factories = az('resource', 'list', *base, '--resource-type', 'Microsoft.DataFactory/factories')
    found = next((f for f in factories if f['name'].lower()==factory.lower()), None)
    if args.action=='init':
        if config['mode']!='new-factory' or found or not args.approve_init:
            raise RuntimeError('init requires new-factory mode, an unused factory name and --approve-init')
        factory_template = dict(template, resources=[r for r in template['resources'] if r['type']=='Microsoft.DataFactory/factories'])
        path = ROOT/'factory-init.json'
        path.write_text(json.dumps(factory_template, indent=2))
        print(json.dumps(az('deployment', 'group', 'create', *base, '--name', 'ingestron-'+config['useCase']+'-init', '--mode', 'Incremental', '--template-file', str(path)), indent=2))
        return
    if not found:
        raise RuntimeError('Factory does not exist. Review and run init first for a new factory.')
    if config['mode']=='new-factory' and found.get('tags',{}).get('ingestron-use-case')!=config['useCase']:
        raise RuntimeError('Existing factory is not owned by this new-factory use case')
    if args.action in ['plan','apply']:
        # Ignore factory resource after init: never reset existing factory configuration.
        effective = dict(template, resources=[dict(r, dependsOn=[d for d in r.get('dependsOn',[]) if "/factories'," not in d]) for r in template['resources'] if r['type']!='Microsoft.DataFactory/factories'])
        expected_ls={'azure-sql':'AzureSqlDatabase','sql-server':'SqlServer','postgresql':'PostgreSqlV2'}[config['sourceKind']]
        links = az('rest','--method','get','--url',scope+'/linkedservices?api-version=2018-06-01')['value']
        for name, kind in [(config['sourceLinkedService'],expected_ls),(config['sinkLinkedService'],'AzureBlobFS')]:
            link=next((l for l in links if l['name']==name),None)
            if not link or link['properties']['type']!=kind:
                raise RuntimeError('Configure the reviewed '+kind+' linked service '+name+' before deployment')
        owned_state=[]
        for kind in ['datasets','pipelines']:
            remote = az('rest','--method','get','--url',scope+'/'+kind+'?api-version=2018-06-01')['value']
            for item in remote:
                if item['name'] in config['resourceNames']: owned_state.append(item)
                if item['name'] in config['resourceNames'] and 'ingestron:'+config['useCase'] not in item.get('properties',{}).get('annotations',[]):
                    raise RuntimeError('Refusing to overwrite unowned resource '+item['name'])
        reviewed_digest=digest(effective, dict(config, ownedState=sorted(owned_state,key=lambda r:r["name"])), args.subscription, args.resource_group)
        path=ROOT/'deployment-template.json'
        path.write_text(json.dumps(effective,indent=2))
        if args.action=='plan':
            changes=az('deployment','group','what-if',*base,'--no-pretty-print','--name','ingestron-'+config['useCase'],'--mode','Incremental','--template-file',str(path))
            print(json.dumps({'digest':reviewed_digest,'changes':changes,'mode':'Incremental','resources':config['resourceNames']},indent=2))
        else:
            if args.approve!=reviewed_digest:
                raise RuntimeError('Run plan and supply its reviewed digest with --approve')
            print(json.dumps(az('deployment','group','create',*base,'--name','ingestron-'+config['useCase'],'--mode','Incremental','--template-file',str(path)),indent=2))
    elif args.action=='run':
        print(json.dumps(az('rest','--method','post','--url',scope+'/pipelines/'+config['pipelineName']+'/createRun?api-version=2018-06-01','--body','{}'),indent=2))
    else:
        if not args.run_id:
            raise RuntimeError('Supply --run-id from run')
        status=az('rest','--method','get','--url',scope+'/pipelineruns/'+args.run_id+'?api-version=2018-06-01')
        if args.action=='status':
            print(json.dumps({k:status.get(k) for k in ['runId','status','runStart','runEnd','message']},indent=2))
        else:
            if status.get('status')!='Succeeded' or status.get('pipelineName')!=config['pipelineName'] or not args.storage_account:
                raise RuntimeError('Download requires a successful discovery run and --storage-account')
            target=ROOT/(args.run_id+'-metadata.json')
            if target.exists() or (ROOT/(args.run_id+'-import.json')).exists():
                raise RuntimeError('Metadata destination already exists')
            az('storage','fs','file','download','--subscription',args.subscription,'--account-name',args.storage_account,'--auth-mode','login','--file-system',config['fileSystem'],'--path','discovery/'+config['useCase']+'/'+args.run_id+'/metadata.json','--destination',str(target))
            rows=json.loads(target.read_text(encoding='utf-8-sig'))
            proposal={'sourceId':config['useCase'],'sourceKind':config['sourceKind'],'rows':rows}
            out=ROOT/(args.run_id+'-import.json')
            out.write_text(json.dumps(proposal,indent=2))
            print(str(out))
if __name__=='__main__':
    try: main()
    except (RuntimeError, ValueError, KeyError, OSError, subprocess.TimeoutExpired) as exc:
        print(str(exc),file=sys.stderr)
        sys.exit(1)
`;

// src/discovery.mjs
var require2 = (v, m) => {
  if (!v) throw new Error(m);
};
var id = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v);
var ref = (name, type) => ({ referenceName: name, type });
var sourceTypes = {
  "azure-sql": ["AzureSqlTable", "AzureSqlSource", "sqlReaderQuery"],
  "sql-server": ["SqlServerTable", "SqlSource", "sqlReaderQuery"],
  postgresql: ["PostgreSqlV2Table", "PostgreSqlV2Source", "query"]
};
function metadataQuery(kind, schemas, tables = []) {
  require2(Array.isArray(tables) && tables.length <= 100 && tables.every(
    (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_ ]{0,127}$/.test(v)
  ), "Invalid explicit table selection");
  const tableScope = tables.map((t) => `'${t}'`).join(",");
  require2(sourceTypes[kind], "Unsupported discovery source kind");
  require2(Array.isArray(schemas) && schemas.length > 0 && schemas.length <= 20 && schemas.every(id), "Supply 1\u201320 explicit simple schema names");
  const scope = schemas.map((s) => `'${s}'`).join(",");
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
function discoveryPrepare(input) {
  const {
    useCase,
    factoryName,
    location,
    sourceKind,
    sourceLinkedService,
    sinkLinkedService,
    fileSystem,
    schemas
  } = input;
  require2(id(useCase) && useCase.length <= 32, "Use a simple useCase identifier up to 32 characters");
  require2(typeof factoryName === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{1,61}[A-Za-z0-9]$/.test(
    factoryName
  ), "Invalid factory name");
  require2(typeof location === "string" && /^[a-z0-9]+$/.test(location), "Supply an Azure location");
  require2(id(sourceLinkedService) && id(sinkLinkedService), "Use simple linked-service names");
  require2(typeof fileSystem === "string" && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(
    fileSystem
  ), "Invalid ADLS filesystem");
  require2(["new-factory", "existing-factory"].includes(
    input.mode
  ), "Select new-factory or existing-factory mode");
  const query = metadataQuery(sourceKind, schemas, input.tables), prefix2 = `ingestron_${useCase}`, annotations = [`ingestron:${useCase}`];
  const resource = (kind, name, properties) => ({
    type: `Microsoft.DataFactory/factories/${kind}`,
    apiVersion: "2018-06-01",
    name: `${factoryName}/${name}`,
    properties: { ...properties, annotations }
  });
  const sourceName = `${prefix2}_source`, sinkName = `${prefix2}_metadata`, pipelineName = `${prefix2}_discover`;
  const [datasetType, copyType, queryKey] = sourceTypes[sourceKind];
  const resources = [
    resource("datasets", sourceName, {
      type: datasetType,
      linkedServiceName: ref(sourceLinkedService, "LinkedServiceReference"),
      typeProperties: {}
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
            value: `@concat('discovery/${useCase}/',dataset().runId)`
          },
          fileName: "metadata.json"
        }
      }
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
            secureOutput: true
          },
          inputs: [ref(sourceName, "DatasetReference")],
          outputs: [
            {
              ...ref(sinkName, "DatasetReference"),
              parameters: {
                runId: { type: "Expression", value: "@pipeline().RunId" }
              }
            }
          ],
          typeProperties: {
            source: {
              type: copyType,
              [queryKey]: query,
              queryTimeout: "00:05:00"
            },
            sink: {
              type: "JsonSink",
              storeSettings: { type: "AzureBlobFSWriteSettings" },
              formatSettings: {
                type: "JsonWriteSettings",
                filePattern: "arrayOfObjects"
              }
            },
            enableStaging: false
          }
        }
      ]
    })
  ];
  const factoryId = `[resourceId('Microsoft.DataFactory/factories','${factoryName}')]`;
  resources[2].dependsOn = [sourceName, sinkName].map(
    (n) => `[resourceId('Microsoft.DataFactory/factories/datasets','${factoryName}','${n}')]`
  );
  if (input.mode === "new-factory") {
    for (const r of resources)
      r.dependsOn = [...r.dependsOn ?? [], factoryId];
    resources.unshift({
      type: "Microsoft.DataFactory/factories",
      apiVersion: "2018-06-01",
      name: factoryName,
      location,
      identity: { type: "SystemAssigned" },
      tags: { "ingestron-use-case": useCase },
      properties: {}
    });
  }
  const template = {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    resources
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
    deploymentMode: "Incremental"
  };
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts: {
      "template.json": JSON.stringify(template, null, 2),
      "deployment.json": JSON.stringify(deployment, null, 2),
      "metadata-query.sql": query,
      "deploy.py": runner
    },
    review: [
      "Catalogue visibility can hide objects; verify source permissions and schema scope",
      "Configure the referenced linked services and required integration runtime before deployment",
      "Grant the factory metadata-output permissions; no automatic RBAC or firewall changes",
      "No schedules are created; trigger discovery explicitly after reviewing connections"
    ],
    deployed: false
  };
}
function boolean(v, name) {
  require2(typeof v === "boolean" || v === 0 || v === 1, `Explicit ${name} boolean required`);
  return v === true || v === 1;
}
function mappedType(row, kind) {
  const type = row.data_type.toLowerCase();
  if (["numeric", "decimal"].includes(type)) {
    require2(Number.isInteger(row.precision) && row.precision >= 1 && row.precision <= 38 && Number.isInteger(row.scale) && row.scale >= 0 && row.scale <= row.precision, "Unbounded or unsupported decimal precision/scale; review mapping");
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
    float4: ["number", "FLOAT"]
  };
  if (type === "timestamp")
    return kind === "postgresql" ? ["timestamp", "TIMESTAMP"] : ["string", "BINARY"];
  if (["binary", "varbinary", "rowversion", "bytea"].includes(type))
    return ["string", "BINARY"];
  if ([
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
    "jsonb"
  ].includes(type))
    return ["string", "STRING"];
  require2(Object.hasOwn(
    map,
    type
  ), `Unsupported source type ${type}; no silent mapping`);
  return map[type];
}
function discoveryContracts(input) {
  require2(id(input.sourceId) && sourceTypes[input.sourceKind], "Supply sourceId and supported sourceKind");
  require2(Array.isArray(input.rows) && input.rows.length > 0 && input.rows.length <= 1e4, "Supply 1\u201310000 metadata rows");
  const tables = /* @__PURE__ */ new Map();
  for (const row of input.rows) {
    require2(id(row.schema_name) && typeof row.table_name === "string" && /^[A-Za-z_][A-Za-z0-9_ ]{0,127}$/.test(row.table_name) && id(
      row.column_name
    ), "Identifiers require explicit simple names; review unsupported names");
    require2(typeof row.data_type === "string" && row.data_type.length <= 128, "Supply a source type");
    require2(Number.isInteger(row.ordinal_position) && row.ordinal_position > 0, "Column ordinal must be positive");
    const key = `${input.sourceId}__${row.schema_name}__${row.table_name.replaceAll(" ", "_")}`;
    require2(!tables.has(key) || tables.get(key)[0].table_name === row.table_name, "Contract identifier collision; narrow scope or rename explicitly");
    if (!tables.has(key)) tables.set(key, []);
    const columns = tables.get(key);
    require2(!columns.some(
      (c) => c.column_name === row.column_name || c.ordinal_position === row.ordinal_position
    ), "Duplicate column name or ordinal");
    columns.push(row);
  }
  require2(tables.size <= 100, "At most 100 tables per import");
  const artifacts = {}, review = [];
  for (const [key, rows] of [...tables].sort(
    ([a], [b]) => a.localeCompare(b)
  )) {
    rows.sort((a, b) => a.ordinal_position - b.ordinal_position);
    const properties = rows.map((row) => {
      const [logicalType, physicalType] = mappedType(row, input.sourceKind), nullable = boolean(row.nullable, "nullability"), primary = boolean(row.primary_key, "primary-key evidence");
      require2(!primary || !nullable, "Declared primary key cannot be nullable");
      return {
        name: row.column_name,
        logicalType,
        physicalType,
        required: !nullable,
        ...primary && input.acceptDeclaredKeys === true ? { primaryKey: true } : {},
        description: `Source type: ${row.data_type}; precision: ${row.precision ?? "unspecified"}; scale: ${row.scale ?? "unspecified"}; max length: ${row.max_length ?? "unspecified"}; declared primary key: ${primary}`
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
          properties
        }
      ]
    };
    artifacts[`${key}.odcs.json`] = JSON.stringify(contract, null, 2);
    review.push({
      contract: key,
      declaredKeyColumns: rows.filter((r) => boolean(r.primary_key, "primary-key evidence")).map((r) => r.column_name),
      keysAccepted: input.acceptDeclaredKeys === true
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
        "Drafts do not imply ingestion semantics or production acceptance"
      ]
    },
    null,
    2
  );
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts,
    applied: false
  };
}
var str = { type: "string", minLength: 1, maxLength: 128 };
var discoveryDefinitions = [
  {
    name: "discover prepare",
    description: "Generate a metadata-only ADF Copy pipeline and runnable deployment bundle; no Azure calls.",
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
        "schemas"
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
        schemas: { type: "array", minItems: 1, maxItems: 20, items: str }
      }
    }
  },
  {
    name: "discover contracts",
    description: "Convert exported catalogue rows into draft ODCS files for review; keys require explicit acceptance.",
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
          maxItems: 1e4,
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
              "primary_key"
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
              max_length: { type: ["integer", "null"] }
            }
          }
        }
      }
    }
  }
];

// src/source-discovery.mjs
var fileFormats = [
  "csv",
  "tsv",
  "json",
  "jsonl",
  "parquet",
  "xml",
  "xlsx"
];
var check5 = (v, m) => {
  if (!v) throw Error(m);
};
var id2 = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v);
var path = (v) => typeof v === "string" && v.length <= 512 && /^[A-Za-z0-9_./= -]+$/.test(v) && v.split("/").every((p) => p !== "." && p !== ".." && p !== "");
function sourcePrepare(input) {
  check5(id2(input.sourceId), "Use a simple sourceId");
  if (input.sourceKind === "azure-sql") {
    check5(
      !input.format && !input.datasets && !input.sampleRows,
      "SQL uses explicit catalogue schemas/tables, not file settings"
    );
    return {
      apiVersion: "ingestron.artifact-proposal/v1",
      artifacts: {
        "discovery.json": JSON.stringify(input, null, 2),
        "discover.mjs": sqlRunner,
        "metadata-query.sql": metadataQuery(
          "azure-sql",
          input.schemas,
          input.tables
        ),
        "package.json": JSON.stringify(
          {
            private: true,
            type: "module",
            engines: { node: ">=22 <23" },
            dependencies: { mssql: "12.7.2" }
          },
          null,
          2
        )
      },
      applied: false
    };
  }
  check5(
    input.sourceKind === "adls" && fileFormats.includes(input.format),
    "Select adls and a supported file format"
  );
  check5(
    !input.schemas && !input.tables,
    "Files use explicit datasets, not catalogue schemas/tables"
  );
  check5(
    Array.isArray(input.datasets) && input.datasets.length > 0 && input.datasets.length <= 100,
    "Select 1\u2013100 datasets"
  );
  const names = /* @__PURE__ */ new Set();
  for (const d of input.datasets) {
    check5(
      id2(d.name) && !names.has(d.name),
      "Dataset names must be unique simple identifiers"
    );
    names.add(d.name);
    check5(
      Array.isArray(d.paths) && d.paths.length > 0 && d.paths.length <= 100 && d.paths.every(path) && new Set(d.paths).size === d.paths.length,
      "Select unique safe explicit file paths"
    );
    check5(
      d.paths.every((p) => p.toLowerCase().endsWith("." + input.format)),
      "File extension must match format"
    );
    check5(
      input.format === "xlsx" ? d.paths.length === 1 && id2(d.sheet) : d.sheet === void 0,
      "XLSX requires one file and explicit simple worksheet; sheet applies only to XLSX"
    );
    check5(
      !d.partitionColumns || input.format === "parquet" && d.partitionColumns.every(id2) && new Set(d.partitionColumns).size === d.partitionColumns.length,
      "Explicit partitions apply only to Parquet"
    );
  }
  check5(
    input.datasets.reduce((n, d) => n + d.paths.length, 0) <= 200,
    "At most 200 selected file reads"
  );
  const sampleRows = input.sampleRows ?? 1e3;
  check5(
    Number.isInteger(sampleRows) && sampleRows >= 1 && sampleRows <= 1e4,
    "sampleRows must be 1\u201310000"
  );
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts: {
      "discovery.json": JSON.stringify({ ...input, sampleRows }, null, 2),
      "discover.py": fileRunner,
      "requirements.txt": requirements
    },
    applied: false
  };
}
function property(c, depth = 0) {
  check5(
    depth <= 8 && id2(c.name) && typeof c.nullable === "boolean",
    "Invalid column name, depth or nullability"
  );
  const types2 = {
    string: ["STRING", "BINARY"],
    integer: ["BIGINT", "INT", "SMALLINT"],
    number: ["DOUBLE", "FLOAT"],
    boolean: ["BOOLEAN"],
    date: ["DATE"],
    timestamp: ["TIMESTAMP"],
    object: ["STRUCT"],
    array: ["ARRAY"]
  };
  check5(
    types2[c.logicalType] && (types2[c.logicalType].includes(c.physicalType) || c.logicalType === "number" && /^DECIMAL\((\d{1,2}),(\d{1,2})\)$/.test(c.physicalType)),
    "Unsupported discovered type"
  );
  if (c.physicalType.startsWith("DECIMAL")) {
    const [p, s] = c.physicalType.match(/\d+/g).map(Number);
    check5(p >= 1 && p <= 38 && s <= p, "Invalid decimal");
  }
  check5(
    [
      "sampled-values",
      "declared-parquet-schema",
      "declared-path-partition"
    ].includes(c.evidence),
    "Unknown type evidence"
  );
  const out = {
    name: c.name,
    logicalType: c.logicalType,
    physicalType: c.physicalType,
    required: c.evidence === "declared-parquet-schema" && !c.nullable,
    description: `Discovery evidence: ${c.evidence}. Sample absence of nulls does not establish requiredness.${c.warning ? " " + c.warning : ""}`
  };
  if (c.logicalType === "object") {
    check5(
      Array.isArray(c.properties) && c.properties.length > 0,
      "Object properties required"
    );
    out.properties = c.properties.map((x) => property(x, depth + 1));
    check5(
      new Set(out.properties.map((p) => p.name)).size === out.properties.length,
      "Duplicate nested property"
    );
  }
  if (c.logicalType === "array") {
    check5(c.items, "Array item metadata required");
    out.items = property(c.items, depth + 1);
    delete out.items.name;
  }
  return out;
}
function fileContracts(input) {
  check5(
    input.apiVersion === "ingestron.file-metadata/v1" && id2(input.sourceId) && input.sourceKind === "adls" && fileFormats.includes(input.format),
    "Unsupported file metadata envelope"
  );
  check5(
    Array.isArray(input.datasets) && input.datasets.length > 0 && input.datasets.length <= 100,
    "Expected 1\u2013100 datasets"
  );
  const artifacts = {}, review = [];
  for (const d of input.datasets) {
    check5(
      id2(d.name) && Array.isArray(d.files) && d.files.length > 0 && d.files.every((f) => path(f.path) && /^[a-f0-9]{64}$/.test(f.sha256)),
      "Invalid dataset file identity"
    );
    check5(
      Array.isArray(d.columns) && d.columns.length > 0 && d.columns.length <= 200,
      "Expected bounded columns"
    );
    const key = input.sourceId + "__" + d.name;
    check5(!artifacts[key + ".odcs.json"], "Duplicate dataset");
    const properties = d.columns.map((c) => property(c));
    check5(
      new Set(properties.map((p) => p.name)).size === properties.length,
      "Duplicate columns"
    );
    artifacts[key + ".odcs.json"] = JSON.stringify(
      {
        apiVersion: "v3.1.0",
        kind: "DataContract",
        id: key,
        name: key,
        version: "1.0.0",
        status: "draft",
        schema: [
          {
            name: key,
            logicalType: "object",
            physicalName: d.files.map((f) => f.path).join(";") + (d.sheet ? "#" + d.sheet : ""),
            properties
          }
        ]
      },
      null,
      2
    );
    review.push({
      contract: key,
      format: input.format,
      files: d.files,
      sheet: d.sheet,
      sampledRows: d.sampledRows,
      truncated: d.truncated,
      columns: d.columns,
      keysAccepted: false
    });
  }
  artifacts["review.json"] = JSON.stringify(
    {
      sourceId: input.sourceId,
      sourceKind: input.sourceKind,
      format: input.format,
      evidence: "bounded-source-discovery",
      datasets: review,
      checks: [
        "Review sample scope and unknown/all-null types; text stays STRING without a declared schema",
        "Review keys and semantic types; sampled uniqueness is not a key",
        "Nested ODCS is preserved; native table authoring needs a reviewed flat projection",
        "File ingestion preserves bytes; schema discovery does not transform them"
      ]
    },
    null,
    2
  );
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts,
    applied: false
  };
}

// src/commands.mjs
var require3 = (condition, message) => {
  if (!condition) throw new Error(message);
};
var safeName = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
var types = {
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
  binary: "BINARY"
};
function discovery(input, context) {
  require3(Array.isArray(input.tables) && input.tables.length > 0, "Supply table metadata");
  const names = /* @__PURE__ */ new Set();
  const tables = input.tables.map((table) => {
    require3(safeName(table.name) && !names.has(table.name), "Table names must be unique simple identifiers");
    names.add(table.name);
    const columns = /* @__PURE__ */ new Set();
    require3(Array.isArray(table.columns) && table.columns.length > 0, "Supply columns");
    return {
      name: table.name,
      columns: table.columns.map((column) => {
        require3(safeName(column.name) && !columns.has(
          column.name
        ), "Column names must be unique simple identifiers");
        columns.add(column.name);
        require3(typeof column.type === "string" && Object.hasOwn(
          types,
          column.type.toLowerCase()
        ), "Unsupported source type; review the mapping before importing");
        require3(typeof column.nullable === "boolean", "Column nullability must be explicit");
        return {
          name: column.name,
          type: types[column.type.toLowerCase()],
          required: !column.nullable
        };
      })
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
      "Select keys and contract versions; no keys are inferred"
    ],
    applied: false
  };
}
function command(request) {
  require3(request.apiVersion === "ingestron.provider-command-request/v1", "Unsupported command protocol");
  if (request.command === "project assemble") return assemble(request.input);
  if (request.command === "connection prepare")
    return projectConnectionPrepare(request.input);
  if (request.command === "connector contracts")
    return connectorContracts(request.input);
  if (request.command === "compute pool prepare")
    return poolPrepare(request.input);
  if (request.command === "compute prepare")
    return computePrepare(request.input);
  if (request.command === "discover prepare" || request.command === "deploy prepare")
    return discoveryPrepare(request.input);
  if (request.command === "discover source prepare")
    return sourcePrepare(request.input);
  if (request.command === "discover contracts")
    return request.input.apiVersion === "ingestron.file-metadata/v1" ? fileContracts(request.input) : discoveryContracts(request.input);
  if (request.command === "discover import")
    return discovery(request.input, request.context);
  if (request.command === "deploy inspect")
    return inspect(request.input.artifact, request.context);
  throw new Error("Unsupported provider command");
}
var PLATFORM = "adf";
function inspect(artifact, context) {
  require3(artifact && Array.isArray(artifact.resources), "Supply an ARM template with resources");
  const resources = [], names = /* @__PURE__ */ new Set();
  const walk = (items, depth = 0) => {
    require3(depth < 8 && items.length <= 1e3, "Resource nesting/count exceeds inspection limits");
    for (const resource of items) {
      require3(resource && typeof resource.name === "string" && typeof resource.type === "string", "Each resource requires a name and type");
      require3([
        "Microsoft.DataFactory/factories/pipelines",
        "Microsoft.DataFactory/factories/datasets",
        "Microsoft.DataFactory/factories/linkedservices"
      ].includes(
        resource.type
      ), "Only explicit ADF pipeline, dataset and linked-service resources are supported");
      const identity = resource.type + ":" + resource.name;
      require3(!names.has(identity), "Duplicate resource identity");
      names.add(identity);
      const scan = (value) => {
        if (!value || typeof value !== "object") return;
        require3(value.type !== "ExecuteDataFlow", "Data Flow is forbidden by these standards");
        for (const child of Object.values(value)) scan(child);
      };
      scan(resource.properties);
      resources.push({ name: resource.name, type: resource.type });
      if (resource.resources) walk(resource.resources, depth + 1);
    }
  };
  walk(artifact.resources);
  require3(resources.length > 0 && resources.length <= 1e3, "Supply at most 1000 resources");
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
      "Review shared-resource ownership before deploying"
    ]
  };
}
export {
  command
};
