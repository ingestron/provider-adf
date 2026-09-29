import { test } from "node:test";
import assert from "node:assert/strict";
import { expand, validate, render } from "../plugin/index.mjs";
const plan = () => ({
  project: "retail",
  flows: [{ id: "source", requires: {} }],
  bindings: { factory: { kind: "adf", factoryName: "adf-dev" } },
  nodes: [
    {
      id: "source/customers/copy",
      flow: "source",
      table: "customers",
      platform: "adf",
      uses: "copy@v1",
      binding: "factory",
      needs: [],
      runtime: { options: {} },
      columns: [
        { name: "id", type: "BIGINT" },
        { name: "name", type: "STRING" },
      ],
      source: {
        kind: "azure-sql",
        linkedService: "erp",
        schema: "dbo",
        table: "customers",
        consistency: "frozen-extract",
      },
      with: {
        standard: "snapshot-land@v1",
        target: {
          linkedService: "landing",
          fileSystem: "landing",
          path: "retail",
        },
      },
    },
  ],
});
test("SQL sources generate guarded native Copy and no shared resource writes", () => {
  for (const kind of ["azure-sql", "sql-server"]) {
    const p = plan();
    p.nodes[0].source.kind = kind;
    const a = render(p),
      pipeline = a["pipelines/retail_source_customers.json"].value.properties;
    assert.equal(pipeline.concurrency, 1);
    assert.equal(pipeline.activities[0].policy.retry, 0);
    assert.equal(pipeline.activities[0].type, "Copy");
    assert.equal(
      pipeline.activities[0].typeProperties.enableSkipIncompatibleRow,
      false,
    );
    assert.equal(
      pipeline.activities[1].dependsOn[0].dependencyConditions[0],
      "Succeeded",
    );
    assert.match(
      pipeline.activities[1].typeProperties.expression.value,
      /expectedRowCount/,
    );
    assert.equal(pipeline.parameters.expectedRowCount.defaultValue, undefined);
    assert(
      a["adf-template.json"].value.resources.every((r) =>
        /\/(datasets|pipelines)$/.test(r.type),
      ),
    );
    assert(!JSON.stringify(a).includes("ExecuteDataFlow"));
  }
});
test("immutable ADLS/SFTP copy preserves one file without claiming schema validation", () => {
  for (const kind of ["adls", "sftp"]) {
    const p = plan();
    p.nodes[0].source = {
      kind,
      linkedService: "files",
      folder: "complete",
      fileName: "data.parquet",
      completion: "immutable",
      ...(kind === "adls" ? { fileSystem: "source" } : {}),
    };
    p.nodes[0].with.standard = "immutable-file-copy@v1";
    const a = render(p);
    assert.equal(
      a["datasets/retail_source_customers_source.json"].value.properties.type,
      "Binary",
    );
    assert.equal(
      a["pipelines/retail_source_customers.json"].value.properties.activities
        .length,
      1,
    );
  }
});
test("reject unsafe or unsupported semantics rather than generate partial configuration", () => {
  for (const mutate of [
    (p) => (p.nodes[0].source.consistency = "live"),
    (p) => (p.nodes[0].source.table = "x;DROP"),
    (p) => (p.nodes[0].with.dataFlow = true),
    (p) => (p.nodes[0].with.standard = "cdc@v1"),
    (p) => (p.nodes[0].source.password = "secret"),
    (p) => (p.nodes[0].with.target.path = "../escape"),
    (p) => (p.nodes[0].needs = ["other"]),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validate(p));
  }
});
test("standard expansion is bounded and rejects manual step overrides", () => {
  const flow = {
    kind: "ingestion",
    defaults: { with: {} },
    tables: { customers: { steps: {} } },
    ingestion: { standard: "snapshot-land@v1", target: {} },
  };
  assert.equal(
    expand({ flow, providerSource: "adf" }).steps[0].uses,
    "copy@v1",
  );
  assert.throws(
    () => expand({ flow: { ...flow, steps: [{}] }, providerSource: "adf" }),
    /own steps/,
  );
});
test("snapshot handover waits for count checks and exposes a copy-free recovery pipeline", () => {
  const p = plan(),
    n = p.nodes[0];
  n.contract = { version: "1.0.0" };
  n.with.standard = "snapshot-to-databricks@v1";
  n.with.target.storageAccount = "retailstore";
  n.with.publication = {
    linkedService: "dbx",
    notebookPath: "/Workspace/Shared/publish_customers",
    protocol: "ingestron.snapshot-publication/v1",
  };
  const a = render(p);
  const main = a["pipelines/retail_source_customers.json"].value.properties;
  const retry =
    a["pipelines/retail_source_customers_publish.json"].value.properties;
  assert.equal(main.activities[2].type, "ExecutePipeline");
  assert.equal(main.activities[2].dependsOn[0].activity, "VerifyCount");
  assert.equal(main.activities[2].typeProperties.waitOnCompletion, true);
  assert.equal(retry.activities.length, 1);
  assert.equal(retry.activities[0].type, "DatabricksNotebook");
  assert.equal(retry.parameters.initialiseIndex.defaultValue, false);
  assert.equal(
    retry.activities[0].typeProperties.baseParameters.dataset,
    "retail.source.customers",
  );
  assert.equal(
    JSON.parse(retry.activities[0].typeProperties.baseParameters.contractShape)
      .length,
    2,
  );
  assert(!JSON.stringify(a).includes("ExecuteDataFlow"));
  const template = a["adf-template.json"].value;
  assert(
    template.resources
      .find((r) => r.name.endsWith("/retail_source_customers')]"))
      .dependsOn.some((d) => d.includes("factories/pipelines")),
  );
});

test("SQL table names preserve Northwind spaces and reject SQL metacharacters", () => {
  const p = plan();
  p.nodes[0].source.table = "Order Details";
  validate(p);
  const output = JSON.stringify(render(p));
  assert(output.includes("[dbo].[Order Details]"));
  for (const table of [
    "Orders]; DROP TABLE dbo.Orders--",
    "Orders'",
    "Orders\\Other",
    "Orders\nOther",
    " Orders",
    "Orders ",
  ]) {
    const bad = plan();
    bad.nodes[0].source.table = table;
    assert.throws(() => validate(bad));
  }
});
