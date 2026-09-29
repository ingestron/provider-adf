import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrepare, spotPoolPolicy } from "../src/compute.mjs";
import { command } from "../src/commands.mjs";
const input = {
  factoryName: "demo-factory",
  pipelineName: "compute_demo",
  batchAccountUrl: "https://demobatch.australiaeast.batch.azure.com",
  poolName: "workers",
  workerIdentityResourceId:
    "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/demo/providers/Microsoft.ManagedIdentity/userAssignedIdentities/worker",
  storageAccount: "demostorage",
  resourceFolder: "assets/work/v1",
  files: ["worker.py", "config.json"],
  entryPoint: "worker.py",
  configFile: "config.json",
  timeout: "00.00:10:00",
  pollIntervalSeconds: 60,
  recovery: "idempotent-checkpoint-commit-v1",
};
test("generic compute uses the shared native transport and bounds abandoned jobs", () => {
  const result = command({
    apiVersion: "ingestron.provider-command-request/v1",
    command: "compute prepare",
    input,
  });
  const a = result.pipeline.properties.activities;
  assert.equal(result.applied, false);
  assert.equal(result.recovery.verified, false);
  assert.match(a[1].typeProperties.body.value, /python worker.py/);
  assert.match(a[0].typeProperties.body.value, /PT900S/);
  assert.equal(a[1].policy.retry, 0);
  assert.deepEqual(a[3].dependsOn[0].dependencyConditions, ["Completed"]);
  assert.deepEqual(
    result.template.resources[0].properties,
    result.pipeline.properties,
  );
});
test("compute rejects shell injection, missing resources, unsafe recovery and unbounded duration", () => {
  for (const patch of [
    { entryPoint: "worker.py;bad" },
    { files: ["config.json"] },
    { recovery: "trust-me" },
    { timeout: "99.00:00:00" },
    { resourceFolder: "assets/../bad" },
    { pollIntervalSeconds: 1 },
    { secret: "bad" },
  ])
    assert.throws(() => computePrepare({ ...input, ...patch }));
});
test("shared Spot policy has one operator, bounded capacity and graceful drain", () => {
  const policy = spotPoolPolicy(1);
  assert.match(policy.autoScaleFormula, /\$TargetDedicatedNodes = 0/);
  assert.match(policy.autoScaleFormula, /taskcompletion/);
  assert.match(policy.autoScaleFormula, /\$PendingTasks/);
  assert.throws(() => spotPoolPolicy(0));
});
