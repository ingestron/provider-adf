import { test } from "node:test";
import assert from "node:assert/strict";
import { author, model } from "../plugin/lifecycle.mjs";
const options = {
  id: "selected_land",
  origin: "selected",
  provider: "adf",
  binding: "selected_files",
  container: "demo-data",
  tables: [
    {
      id: "products",
      path: "retail/products.csv",
      format: "csv",
      contract: { version: "1.0.0", schema: [] },
    },
  ],
};
test("file handoff preserves exact Blob selection and declares a binary CSV dependency", () => {
  const o = JSON.parse(
    author({ operation: "file_handoff", options }).files["handoff.json"],
  );
  assert.equal(o.flow.tables.products.source.path, "retail/products.csv");
  const n = {
    flow: o.flow.id,
    table: "products",
    binding: "adf",
    source: o.flow.tables.products.source,
    contract: options.tables[0].contract,
    with: o.flow.ingestion,
  };
  const r = model({
    project: "demo",
    node: n,
    bindings: { adf: { factoryName: "design_factory" }, ...o.bindings },
  });
  assert.equal(r.datasets.snapshot.location.format, "csv");
  assert.deepEqual(r.datasets.snapshot.location.reader, {
    header: true,
    delimiter: ",",
  });
  assert.equal(
    r.datasets.snapshot.location.completion,
    "requires-successful-adf-run",
  );
  assert.deepEqual(r.datasets.snapshot.contract, options.tables[0].contract);
});
test("file handoff rejects directories, wildcards, traversal and unsupported readers", () => {
  for (const patch of [
    { path: "../other.csv" },
    { path: "retail/*.csv" },
    { format: "xml" },
  ])
    assert.throws(() =>
      author({
        operation: "file_handoff",
        options: { ...options, tables: [{ ...options.tables[0], ...patch }] },
      }),
    );
});
