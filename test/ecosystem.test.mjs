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
