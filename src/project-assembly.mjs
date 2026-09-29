const check = (v, m) => {
  if (!v) throw Error(m);
};
const prefix = (i) =>
  [
    i.project,
    i.environment,
    i.configuration,
    ...(i.scope.partial ? [i.scope.id] : []),
  ].join("_");
export function assemble(input) {
  const name = prefix(input);
  if (input.phase === "configure") {
    check(
      input.execution.mode === "adf-batch",
      "ADF external execution requires Batch",
    );
    check(
      !input.execution.compute.factoryName ||
        input.binding?.factoryName === input.execution.compute.factoryName,
      "Execution factory must match the configured provider binding",
    );
    return {
      execution: {
        ...input.execution,
        compute: {
          ...input.execution.compute,
          factoryName: input.binding.factoryName,
          pipelineName: name + "_" + input.flow,
          resourceFolder:
            input.execution.compute.resourceFolder +
            "/" +
            name +
            "/" +
            input.flow,
        },
      },
    };
  }
  check(input.phase === "assemble", "Unknown project assembly phase");
  const artifacts = { ...input.nativeFiles };
  const put = (file, value) => {
    check(
      !Object.hasOwn(artifacts, file) || artifacts[file] === value,
      "Conflicting project asset: " + file,
    );
    artifacts[file] = value;
  };
  const template = artifacts["adf-template.json"]
    ? JSON.parse(artifacts["adf-template.json"])
    : {
        $schema:
          "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        contentVersion: "1.0.0.0",
        resources: [],
      };
  const resources = new Map();
  const key = (r) => {
    const match =
      /^\[concat\(parameters\('factoryName'\), '\/([^']+)'\)\]$/.exec(r.name);
    return (
      r.type +
      "/" +
      (match ? input.binding.factoryName + "/" + match[1] : r.name)
    );
  };
  const add = (r) => {
    const old = resources.get(key(r));
    check(
      !old || JSON.stringify(old) === JSON.stringify(r),
      "Conflicting shared ADF resource: " + r.name,
    );
    resources.set(key(r), r);
  };
  template.resources.forEach(add);
  const groups = new Map(),
    staging = [];
  for (const c of input.connections) {
    const config = JSON.parse(c.artifacts["connector.json"]);
    const compute = config.projectLock.execution.compute;
    check(
      compute.factoryName === input.binding.factoryName,
      "Mixed factories in one target",
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
      reviewRequired: true,
    });
  }
  let index = 0;
  for (const { base, entries } of groups.values()) {
    check(
      entries.length <= 25,
      "A shared Batch worker supports at most 25 compiled workloads; split execution configurations",
    );
    const worker = name + "_batch_worker_" + ++index;
    const factory = input.binding.factoryName;
    base.parameters = { workload: { type: "String" } };
    // Compile only the reviewed workload choices into the worker. Unknown selectors fail.
    const submit = base.activities.find((a) => a.name === "SubmitBatchTask");
    const choices = entries.map((e) => ({
      value: e.flow,
      activities: [
        {
          ...JSON.parse(JSON.stringify(submit)),
          name: "Submit_" + e.flow,
          dependsOn: [],
          typeProperties: { ...submit.typeProperties, body: e.body },
        },
      ],
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
              errorCode: "INGESTRON_WORKLOAD",
            },
          },
        ],
      },
    };
    add({
      type: "Microsoft.DataFactory/factories/pipelines",
      apiVersion: "2018-06-01",
      name: factory + "/" + worker,
      properties: base,
    });
    for (const e of entries)
      add({
        ...e.pipeline,
        dependsOn: [
          `[resourceId('Microsoft.DataFactory/factories/pipelines', '${factory}', '${worker}')]`,
        ],
        properties: {
          activities: [
            {
              name: "ExecuteReviewedWorkload",
              type: "ExecutePipeline",
              typeProperties: {
                pipeline: { referenceName: worker, type: "PipelineReference" },
                waitOnCompletion: true,
                parameters: { workload: e.flow },
              },
            },
          ],
        },
      });
  }
  template.resources = [...resources.values()];
  artifacts["adf-template.json"] = JSON.stringify(template, null, 2);
  if (!artifacts["adf-parameters.json"])
    artifacts["adf-parameters.json"] = JSON.stringify(
      {
        $schema:
          "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        contentVersion: "1.0.0.0",
        parameters: {},
      },
      null,
      2,
    );
  artifacts["staging.json"] = JSON.stringify(staging, null, 2);
  artifacts["deployment.json"] = JSON.stringify(
    {
      mode: "Incremental",
      factoryName: input.binding.factoryName,
      scope: input.scope,
      omissionMeansDeletion: false,
      resources: [...resources.keys()],
      infrastructure: "existing customer-owned resources only",
    },
    null,
    2,
  );
  artifacts["PROJECT.md"] =
    "# ADF project package\n\nReview and deploy adf-template.json with adf-parameters.json using Incremental mode only. No deletion or complete-mode deployment is provided. Stage each flows directory to its exact staging.json destination after discovery, review and approval. The shared worker accepts only compiled workload selectors; its RunId is the snapshot retry identity. Existing storage, pools, identities and factory are referenced, not provisioned. Generation does not deploy or execute.\n";
  return {
    apiVersion: "ingestron.project-package/v1",
    artifacts,
    details: {
      entryPoint: "adf-template.json",
      deploymentMode: "Incremental",
      omissionMeansDeletion: false,
      sharedWorkers: groups.size,
      resources: [...resources.keys()],
      staging,
    },
  };
}
