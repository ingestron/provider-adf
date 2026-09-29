import { test } from "node:test";
import assert from "node:assert/strict";
import { render, validate, expand } from "../plugin/index.mjs";
import { model } from "../plugin/lifecycle.mjs";

function fixture() {
  const node = (flow, table, empty = false) => ({
    id: `${flow}/${table}/copy`,
    flow,
    table,
    platform: "adf",
    uses: "copy@v1",
    binding: "factory",
    needs: [],
    runtime: { options: {} },
    columns: [{ name: "id", type: "BIGINT" }],
    source: {
      kind: "azure-sql",
      linkedService: "sql",
      schema: "dbo",
      table,
      consistency: "frozen-extract",
    },
    with: {
      standard: "metadata-snapshot-land@v1",
      group: "northwind",
      allowEmpty: empty,
      target: { linkedService: "lake", fileSystem: "landing", path: "demo" },
    },
  });
  return {
    project: "demo",
    bindings: { factory: { kind: "adf", factoryName: "adf-demo" } },
    flows: [
      { id: "source", requires: {} },
      { id: "empty", requires: {} },
    ],
    nodes: [node("source", "customers"), node("empty", "demographics", true)],
  };
}
test("one compatible group emits two pipelines and two datasets across flows", () => {
  const p = fixture(),
    a = render(p),
    resources = a["adf-template.json"].value.resources;
  assert.equal(resources.length, 4);
  assert.equal(resources.filter((r) => r.type.endsWith("/datasets")).length, 2);
  const worker = a["pipelines/demo_md_northwind_worker.json"].value.properties;
  assert.deepEqual(Object.keys(worker.parameters), [
    "tableId",
    "expectedRowCount",
  ]);
  assert.deepEqual(
    Object.keys(JSON.parse(worker.variables.catalogue.defaultValue)),
    ["empty/demographics", "source/customers"],
  );
  const copy = worker.activities.find((a) => a.type === "Copy");
  assert.equal(copy.dependsOn[0].activity, "ValidateCount");
  assert.equal(copy.policy.retry, 0);
  assert.equal(copy.typeProperties.enableSkipIncompatibleRow, false);
  assert.match(copy.outputs[0].parameters.runId.value, /pipeline\(\).RunId/);
  const catalogue = a["metadata/northwind.json"].value.catalogue;
  assert.equal(catalogue["empty/demographics"].minimumRows, 0);
  assert.equal(catalogue["source/customers"].minimumRows, 1);
  assert.equal(catalogue["source/customers"].translator.typeConversion, false);
  const coordinator =
    a["pipelines/demo_md_northwind_run.json"].value.properties;
  assert.deepEqual(Object.keys(coordinator.parameters), [
    "tables",
    "expectedCounts",
  ]);
  assert.equal(
    coordinator.activities.at(-1).dependsOn[0].activity,
    "ValidateCounts",
  );
  assert.equal(
    coordinator.activities.at(-1).typeProperties.activities[0].typeProperties
      .waitOnCompletion,
    true,
  );
  assert.match(
    coordinator.activities[1].typeProperties.expression.value,
    /union\(/,
  );
  assert.deepEqual(render({ ...p, nodes: [...p.nodes].reverse() }), a);
});
test("resource ownership declares every shared asset and coalesces across tables", () => {
  const p = fixture();
  const claims = p.nodes.map(
    (node) =>
      model({ node, bindings: p.bindings, project: p.project }).resources,
  );
  assert.deepEqual(claims[0], claims[1]);
  const names = render(p)
    ["adf-template.json"].value.resources.map(
      (r) => r.name.match(/\/([^/']+)'\)/)[1],
    )
    .sort();
  assert.deepEqual(claims[0].map((c) => c.name).sort(), names);
});
test("compatible groups remain isolated and incompatible connections cannot silently share a worker", () => {
  const p = fixture();
  p.nodes[1].source.kind = "sql-server";
  assert.throws(() => validate(p), /matching source kind/);
  p.nodes[1].with.group = "private";
  const a = render(p);
  assert.equal(a["adf-template.json"].value.resources.length, 8);
  assert.equal(
    a["datasets/demo_md_private_sql.json"].value.properties.type,
    "SqlServerTable",
  );
  assert.equal(
    a["pipelines/demo_md_private_worker.json"].value.properties.activities.find(
      (a) => a.type === "Copy",
    ).typeProperties.source.type,
    "SqlSource",
  );
});
test("metadata settings fail closed for unsafe or incompatible inputs", () => {
  for (const change of [
    (p) => delete p.nodes[0].with.group,
    (p) => (p.nodes[0].with.group = "../x"),
    (p) => (p.nodes[0].with.parallelism = 17),
    (p) => (p.nodes[0].with.parallelism = 1.5),
    (p) => (p.nodes[0].with.handover = { binding: "lake" }),
    (p) => (p.nodes[0].source.consistency = "live"),
    (p) => (p.nodes[0].source.table = "X] DROP"),
    (p) => (p.nodes[0].columns[0].type = "BINARY"),
    (p) => (p.nodes[0].with.standard = "snapshot-land@v1"),
    (p) => (p.nodes[1].runtime.options.timeout = "00.00:05:00"),
  ]) {
    const p = fixture();
    change(p);
    assert.throws(() => render(p));
  }
  const p = fixture();
  p.nodes[1].with.standard = "snapshot-land@v1";
  delete p.nodes[1].with.group;
  assert.throws(() => render(p), /separate export/);
});
test("catalogue selection comes from reviewed contract columns and safely quoted table names", () => {
  const p = fixture();
  p.nodes[0].source.table = "Order Details";
  const a = render(p),
    record = a["metadata/northwind.json"].value.catalogue["source/customers"];
  assert.equal(record.query, "SELECT [id] FROM [dbo].[Order Details]");
  assert.deepEqual(record.translator.mappings, [
    { source: { name: "id" }, sink: { name: "id" } },
  ]);
  const flow = {
    kind: "ingestion",
    defaults: { with: {} },
    tables: { customers: {} },
    ingestion: p.nodes[0].with,
  };
  assert.equal(
    expand({ flow, providerSource: "adf" }).steps[0].with.group,
    "northwind",
  );
});
test("groups bound catalogue size and table count", () => {
  const p = fixture();
  p.nodes = Array.from({ length: 101 }, (_, i) => ({
    ...p.nodes[0],
    id: `source/t${i}/copy`,
    table: `t${i}`,
  }));
  assert.throws(() => render(p), /at most 100/);
  const big = fixture();
  big.nodes[0].columns = Array.from({ length: 2000 }, (_, i) => ({
    name: `column_${i}_long_reviewed_name`,
    type: "STRING",
  }));
  assert.throws(() => render(big), /200,000 characters/);
});

test("reviewed physical source names map to logical output names", () => {
  const p = fixture();
  p.nodes[0].columns = [
    { name: "CustomerID", target: "customer_id", type: "STRING" },
  ];
  const files = render(p);
  const catalogue = JSON.parse(
    files["pipelines/demo_md_northwind_worker.json"].value.properties.variables
      .catalogue.defaultValue,
  );
  const table = catalogue["source/customers"];
  assert.equal(table.query, "SELECT [CustomerID] FROM [dbo].[customers]");
  assert.deepEqual(table.translator.mappings, [
    { source: { name: "CustomerID" }, sink: { name: "customer_id" } },
  ]);
});
