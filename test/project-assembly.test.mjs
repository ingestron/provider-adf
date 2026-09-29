import { test } from "node:test";
import assert from "node:assert/strict";
import { assemble } from "../src/project-assembly.mjs";
import { computePrepare } from "../src/compute.mjs";
const input = {
  phase: "assemble",
  project: "demo",
  environment: "dev",
  configuration: "batch",
  scope: { id: "full", partial: false },
  binding: { factoryName: "demo-factory" },
  nativeFiles: {},
  connections: [],
};
const compute = {
  factoryName: "demo-factory",
  pipelineName: "work",
  batchAccountUrl: "https://demo.australiaeast.batch.azure.com",
  poolName: "workers",
  workerIdentityResourceId:
    "/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/demo/providers/Microsoft.ManagedIdentity/userAssignedIdentities/worker",
  storageAccount: "demostorage",
  resourceFolder: "assets/work",
  files: ["worker.py", "config.json"],
  entryPoint: "worker.py",
  configFile: "config.json",
  timeout: "00.00:10:00",
  pollIntervalSeconds: 60,
  recovery: "idempotent-checkpoint-commit-v1",
};
const flow = (id) => ({
  flow: id,
  artifacts: {
    "pipeline.arm.json": JSON.stringify(
      computePrepare({
        ...compute,
        pipelineName: id,
        resourceFolder: "assets/" + id,
      }).template,
    ),
    "connector.json": JSON.stringify({
      projectLock: { execution: { compute } },
    }),
    "worker.py": "pass",
  },
});
test("compatible workloads share one bounded allowlisted worker and incremental deployment", () => {
  const result = assemble({ ...input, connections: [flow("a"), flow("b")] });
  const template = JSON.parse(result.artifacts["adf-template.json"]);
  assert.equal(template.resources.length, 3);
  const worker = template.resources.find((r) => r.name.includes("worker"));
  const select = worker.properties.activities.find((a) => a.type === "Switch");
  assert.equal(select.typeProperties.cases.length, 2);
  assert.equal(select.typeProperties.defaultActivities[0].type, "Fail");
  assert.equal(
    JSON.parse(result.artifacts["deployment.json"]).mode,
    "Incremental",
  );
});
test("conflicting resources/assets and oversized workload switches fail", () => {
  const a = {
    type: "Microsoft.DataFactory/factories/pipelines",
    name: "demo-factory/a",
    properties: {},
  };
  assert.throws(
    () =>
      assemble({
        ...input,
        nativeFiles: {
          "adf-template.json": JSON.stringify({
            resources: [a, { ...a, properties: { description: "different" } }],
          }),
        },
      }),
    /Conflicting/,
  );
  assert.throws(
    () =>
      assemble({
        ...input,
        nativeFiles: { "flows/a/worker.py": "different" },
        connections: [flow("a")],
      }),
    /Conflicting/,
  );
  assert.throws(
    () =>
      assemble({
        ...input,
        connections: Array.from({ length: 26 }, (_, i) => flow("f" + i)),
      }),
    /25/,
  );
});
