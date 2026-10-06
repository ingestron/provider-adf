import { test } from "node:test";
import assert from "node:assert/strict";
import { model } from "../plugin/lifecycle.mjs";
const request = () => ({
  project: "retail",
  bindings: {
    factory: { kind: "adf", factoryName: "sample-factory" },
    files: { kind: "adls", accountName: "samplestorage" },
  },
  node: {
    binding: "factory",
    flow: "source",
    table: "customers",
    contract: { version: "1.0.0" },
    with: {
      standard: "snapshot-land@v1",
      target: { fileSystem: "landing", path: "retail" },
      handover: { binding: "files" },
    },
  },
});
test("snapshot handover names the generated root, completion boundary and owned resources", () => {
  const result = model(request());
  assert.equal(
    result.datasets.snapshot.location.name,
    "abfss://landing@samplestorage.dfs.core.windows.net/retail/source/customers",
  );
  assert.equal(
    result.datasets.snapshot.location.completion,
    "requires-successful-adf-run",
  );
  assert.deepEqual(
    result.resources.map((r) => r.name),
    [
      "retail_source_customers",
      "retail_source_customers_source",
      "retail_source_customers_landing",
    ],
  );
});
test("unsupported handover standards and bindings fail closed", () => {
  const r = request();
  r.node.with.standard = "immutable-file-copy@v1";
  assert.throws(() => model(r), /snapshot-land/);
  r.node.with.standard = "snapshot-land@v1";
  r.bindings.files.kind = "sftp";
  assert.throws(() => model(r), /ADLS/);
});

test("Parquet handover contracts describe mapped sink columns without mutating source contracts", () => {
  const r = request();
  r.node.contract = {
    version: "1.0.0",
    schema: [
      {
        name: "orders",
        properties: [
          {
            name: "order_id",
            physicalName: "raw_id",
            logicalType: "integer",
            physicalType: "BIGINT",
            primaryKey: true,
          },
          {
            name: "customer_name",
            physicalName: "raw_name",
            logicalType: "string",
            physicalType: "STRING",
          },
        ],
      },
    ],
  };
  const result = model(r),
    columns = result.datasets.snapshot.contract.schema[0].properties;
  assert.deepEqual(
    columns.map((c) => [c.name, c.physicalName]),
    [
      ["order_id", undefined],
      ["customer_name", undefined],
    ],
  );
  assert.equal(r.node.contract.schema[0].properties[0].physicalName, "raw_id");
  assert.equal(columns[0].primaryKey, true);
  assert.equal(result.datasets.snapshot.contract.version, "1.0.0");
});

test("scheduled flow resource claims are assigned once with all100 paired slots", () => {
  const r = request();
  r.flowContext = {
    id: "source",
    tableIds: ["customers", "orders"],
    schedule: {
      apiVersion: "ingestron.schedule/v1",
      enabled: false,
      timeZone: "UTC",
      start: "2026-10-06T00:00:00Z",
      recurrence: {
        kind: "daily",
        times: Array.from(
          { length: 100 },
          (_, i) =>
            String(Math.floor(i / 60)).padStart(2, "0") +
            ":" +
            String(i % 60).padStart(2, "0"),
        ),
      },
      overlap: "native",
      missed: "native",
    },
  };
  const claims = model(r).resources;
  assert.equal(claims.length, 105);
  assert.equal(claims.filter((v) => v.kind === "trigger").length, 100);
  assert.equal(new Set(claims.map((v) => v.kind + ":" + v.name)).size, 105);
  assert.ok(
    claims.some(
      (v) =>
        v.name === "retail_source_schedule_dispatch" && v.kind === "pipeline",
    ),
  );
  assert.ok(
    claims.some(
      (v) => v.name === "retail_source_schedule_inputs" && v.kind === "dataset",
    ),
  );
  assert.ok(claims.every((v) => v.scope === "sample-factory"));
  r.node.table = "orders";
  assert.equal(model(r).resources.length, 3);
  r.node.table = "customers";
  r.flowContext.schedule = null;
  assert.equal(model(r).resources.length, 3);
});

test("interval flow has one owned trigger and file-copy needs no count supplier", () => {
  const r = request();
  delete r.node.with.handover;
  r.node.with.standard = "immutable-file-copy@v1";
  r.flowContext = {
    id: "source",
    tableIds: ["customers", "orders"],
    schedule: { recurrence: { kind: "interval", minutes: 15 } },
  };
  const claims = model(r).resources;
  assert.equal(claims.length, 5);
  assert.equal(claims.filter((v) => v.kind === "trigger").length, 1);
  assert.equal(
    claims.some((v) => v.name.endsWith("_schedule_inputs")),
    false,
  );
});
