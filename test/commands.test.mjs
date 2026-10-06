import { test } from "node:test";
import assert from "node:assert/strict";
import { command } from "../src/commands.mjs";
const request = (name, input) =>
  command({
    apiVersion: "ingestron.provider-command-request/v1",
    command: name,
    context: { project: "retail", environment: "dev" },
    input,
  });
test("metadata import returns a review proposal and rejects lossy unknown types", () => {
  const input = {
    tables: [
      {
        name: "customers",
        columns: [{ name: "id", type: "bigint", nullable: false }],
      },
    ],
  };
  const result = request("discover import", input);
  assert.equal(result.applied, false);
  assert.equal(result.tables[0].columns[0].type, "BIGINT");
  input.tables[0].columns[0].type = "decimal(38,18)";
  assert.throws(
    () => request("discover import", input),
    /Unsupported source type/,
  );
  assert.throws(
    () => request("deploy apply", {}),
    /Unsupported provider command/,
  );
});
test("deployment inspection inventories supplied resources without deployment claims", () => {
  const result = request("deploy inspect", {
    artifact: {
      resources: [
        {
          name: "factory/pipeline",
          type: "Microsoft.DataFactory/factories/pipelines",
          properties: { activities: [] },
        },
      ],
    },
  });
  assert.equal(result.resources.length, 1);
  assert.equal(result.deployed, false);
  assert.throws(() => request("deploy inspect", { artifact: {} }));
});

test("SQL rowversion is binary and Data Flow is rejected", () => {
  const imported = request("discover import", {
    tables: [
      {
        name: "customers",
        columns: [{ name: "version", type: "timestamp", nullable: false }],
      },
    ],
  });
  assert.equal(imported.tables[0].columns[0].type, "BINARY");
  assert.throws(
    () =>
      request("deploy inspect", {
        artifact: {
          resources: [
            {
              name: "factory/pipeline",
              type: "Microsoft.DataFactory/factories/pipelines",
              properties: { activities: [{ type: "ExecuteDataFlow" }] },
            },
          ],
        },
      }),
    /Data Flow/,
  );
});

test("schedule trigger inspection is native-only, bounded and requires explicit pipeline parameters", () => {
  const resource = {
    name: "factory/retail_schedule_001",
    type: "Microsoft.DataFactory/factories/triggers",
    properties: {
      type: "ScheduleTrigger",
      typeProperties: {
        recurrence: {
          frequency: "Day",
          interval: 1,
          startTime: "2026-10-06T00:00:00Z",
          timeZone: "UTC",
        },
      },
      pipelines: [
        {
          pipelineReference: {
            type: "PipelineReference",
            referenceName: "retail_source_schedule_dispatch",
          },
          parameters: { scheduledTime: "@trigger().scheduledTime" },
        },
      ],
    },
  };
  const inspect = (value) =>
    request("deploy inspect", { artifact: { resources: [value] } });
  assert.equal(inspect(resource).deployed, false);
  const badKind = structuredClone(resource);
  badKind.properties.type = "TumblingWindowTrigger";
  assert.throws(() => inspect(badKind), /ScheduleTrigger/);
  const badInterval = structuredClone(resource);
  badInterval.properties.typeProperties.recurrence.interval = 1001;
  assert.throws(() => inspect(badInterval), /ScheduleTrigger/);
  const missingParams = structuredClone(resource);
  delete missingParams.properties.pipelines[0].parameters;
  assert.throws(
    () => inspect(missingParams),
    /explicit references and parameters/,
  );
  const wrongReference = structuredClone(resource);
  wrongReference.properties.pipelines[0].pipelineReference.type =
    "DatasetReference";
  assert.throws(
    () => inspect(wrongReference),
    /explicit references and parameters/,
  );
  const forbidden = structuredClone(resource);
  forbidden.properties.pipelines[0].parameters.hidden = {
    type: "ExecuteDataFlow",
  };
  assert.throws(() => inspect(forbidden), /Data Flow/);
});
