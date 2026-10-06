import test from "node:test";
import assert from "node:assert/strict";
import { renderWatermark, validateWatermark } from "../src/watermark.mjs";
import { passingExpression } from "../src/quality.mjs";
import { watermarkControlSql } from "../src/watermark-control.mjs";
const fixture = () => ({
  project: "retail",
  environment: "dev",
  digest: "a".repeat(64),
  nodes: [
    {
      flow: "sales",
      table: "orders",
      source: {
        kind: "sql-server",
        linkedService: "erp",
        schema: "dbo",
        table: "orders",
        consistency: "ordered-committed-append",
      },
      runtime: { options: {} },
      columns: [
        { name: "id", type: "BIGINT", key: true, required: true },
        { name: "label", type: "STRING" },
      ],
      with: {
        standard: "watermark-append-land@v1",
        target: {
          linkedService: "lake",
          fileSystem: "landing",
          path: "retail",
        },
        watermark: {
          column: "id",
          initial: "0",
          batchSize: 2,
          namespace: "sales_v1",
          consistency: "ordered-committed-append",
          controlLinkedService: "control",
        },
      },
    },
  ],
});
function exported(plan) {
  const assets = {};
  renderWatermark(
    plan,
    plan.nodes[0],
    (kind, name, properties) => {
      assets[`${kind}/${name}.json`] = {
        format: "json",
        value: { name, properties },
      };
    },
    assets,
  );
  return assets;
}
test("native batches preserve int64 cursor strings, reconcile counts before atomic publication, and skip empty batches", () => {
  const plan = fixture(),
    assets = exported(plan),
    pipeline = assets["pipelines/retail_sales_orders.json"].value.properties;
  assert.equal(pipeline.concurrency, 1);
  assert.deepEqual(
    pipeline.activities.map((a) => a.name),
    [
      "ReadWatermark",
      "ValidateSourceKey",
      "RequireSourceKey",
      "ChooseUpper",
      "IfBatch",
    ],
  );
  const upper = pipeline.activities[3];
  assert.match(upper.typeProperties.source.sqlReaderQuery.value, /TOP \(2\)/);
  assert.match(
    upper.typeProperties.source.sqlReaderQuery.value,
    /CONVERT\(varchar\(20\),MAX\(\[id\]\)\)/,
  );
  const branch = pipeline.activities[4].typeProperties;
  assert.deepEqual(branch.ifFalseActivities, []);
  assert.deepEqual(
    branch.ifTrueActivities.map((a) => a.type),
    ["ExecutePipeline"],
  );
  assert.equal(
    branch.ifTrueActivities[0].typeProperties.waitOnCompletion,
    true,
  );
  assert.equal(
    branch.ifTrueActivities[0].typeProperties.parameters.runId.value,
    "@pipeline().RunId",
  );
  const worker =
    assets["pipelines/retail_sales_orders_batch.json"].value.properties
      .activities;
  assert.equal(
    worker[0].typeProperties.source.sqlReaderStoredProcedureName,
    "dbo.IngestronValidateBatchV1",
  );
  assert.equal(worker[0].typeProperties.source.sqlReaderQuery, undefined);
  const copy = worker.find((a) => a.name === "Copy");
  assert.equal(copy.typeProperties.enableSkipIncompatibleRow, false);
  assert.equal(copy.typeProperties.translator.typeConversion, false);
  assert.deepEqual(copy.dependsOn, [
    { activity: "RequireQuality", dependencyConditions: ["Succeeded"] },
  ]);
  const count = worker.find((a) => a.name === "VerifyCount");
  assert.match(count.typeProperties.expression.value, /rowsRead/);
  assert.match(count.typeProperties.expression.value, /rowsCopied/);
  assert.deepEqual(count.dependsOn, [
    { activity: "Copy", dependencyConditions: ["Succeeded"] },
  ]);
  const commit = count.typeProperties.ifTrueActivities[0];
  assert.equal(commit.type, "SqlServerStoredProcedure");
  assert.equal(
    commit.typeProperties.storedProcedureName,
    "dbo.IngestronCommitWatermarkV1",
  );
  assert.equal(
    commit.typeProperties.storedProcedureParameters.PlanDigest.value,
    plan.digest,
  );
  assert.deepEqual(
    count.typeProperties.ifFalseActivities.map((a) => a.type),
    ["Fail"],
  );
  assert.match(
    assets["handover/retail_sales_orders.json"].value.publication,
    /Only committed/,
  );
  assert.equal(
    assets["sql/ingestron-watermark-control-v1.sql"].value,
    watermarkControlSql,
  );
  assert.deepEqual(exported(plan), assets);
});
test("checkpoint identities are separate across environments and explicit reviewed namespaces", () => {
  const plan = fixture(),
    node = plan.nodes[0],
    dev = validateWatermark(plan, node);
  assert.notEqual(
    validateWatermark({ ...plan, environment: "test" }, node),
    dev,
  );
  assert.notEqual(
    validateWatermark(plan, {
      ...node,
      with: {
        ...node.with,
        watermark: { ...node.with.watermark, namespace: "sales_v2" },
      },
    }),
    dev,
  );
  node.with.watermark.initial = "9223372036854775807";
  assert.ok(validateWatermark(plan, node));
});
test("native append rejects unsafe cursors, mutable sources, undeclared physical keys and unsupported quality", () => {
  for (const mutate of [
    (p) => (p.nodes[0].with.watermark.initial = 9007199254740992),
    (p) => (p.nodes[0].with.watermark.initial = "9223372036854775808"),
    (p) => (p.nodes[0].with.watermark.initial = "00"),
    (p) => (p.nodes[0].with.watermark.batchSize = 1000001),
    (p) => (p.nodes[0].with.watermark.column = "id; DROP"),
    (p) => (p.nodes[0].source.consistency = "live"),
    (p) => (p.nodes[0].source.kind = "oracle"),
    (p) => (p.nodes[0].columns[0].required = false),
    (p) => (p.nodes[0].columns[1].key = true),
    (p) => (p.nodes[0].with.quality = [{ metric: "sql" }]),
    (p) => (p.digest = ""),
  ]) {
    const plan = fixture();
    mutate(plan);
    assert.throws(() => exported(plan));
  }
});
test("quality queries read only the bounded window and failure has no checkpoint writer", () => {
  const plan = fixture();
  plan.nodes[0].with.quality = [
    {
      id: "minimum",
      table: "orders",
      metric: "rowCount",
      operator: "mustBeGreaterOrEqualTo",
      threshold: 1,
      outcome: "fail",
      arguments: {},
    },
  ];
  const activities =
    exported(plan)["pipelines/retail_sales_orders_batch.json"].value.properties
      .activities;
  const query = activities.find((a) => a.name === "CheckQuality").typeProperties
    .source.sqlReaderQuery.value;
  assert.match(query, /ingestron_batch/);
  assert.match(query, /CAST\(/);
  assert.match(query, /output.firstRow.lowerWatermark/);
  const gate = activities.find(
    (a) => a.name === "RequireQuality",
  ).typeProperties;
  assert.match(gate.expression.value, /firstRow.q0/);
  assert.deepEqual(
    gate.ifFalseActivities.map((a) => a.type),
    ["Fail"],
  );
});

test("native conditional nesting and local activity dependencies obey ADF constraints", () => {
  const assets = exported(fixture());
  function walk(activities, inConditional = false, ancestors = new Set()) {
    const local = new Set(activities.map((a) => a.name));
    for (const a of activities) {
      assert.ok(
        !inConditional || !["IfCondition", "Switch"].includes(a.type),
        "ADF forbids nested If/Switch",
      );
      for (const d of a.dependsOn ?? [])
        assert.ok(
          local.has(d.activity),
          "Dependencies must refer to local activities",
        );
      for (const child of [
        a.typeProperties?.ifTrueActivities,
        a.typeProperties?.ifFalseActivities,
      ])
        if (child) walk(child, true, new Set([...ancestors, ...local]));
      for (const value of JSON.stringify(a).matchAll(/activity\('([^']+)'\)/g))
        assert.ok(
          local.has(value[1]) || ancestors.has(value[1]),
          "Activity expressions must resolve within their pipeline",
        );
    }
  }
  for (const [path, value] of Object.entries(assets))
    if (path.startsWith("pipelines/")) walk(value.value.properties.activities);
  const worker =
    assets["pipelines/retail_sales_orders_batch.json"].value.properties
      .activities;
  const gate = worker.find((a) => a.name === "RequireQuality");
  assert.match(
    gate.typeProperties.expression.value,
    /lessOrEquals.*rowCount, 2/,
  );
  assert.match(gate.typeProperties.expression.value, /greater.*rowCount, 0/);
});

test("three or more native quality gates use binary ADF boolean functions", () => {
  const rules = Array.from({ length: 4 }, (_, i) => ({
    id: `q${i}`,
    outcome: "fail",
    operator: "mustBe",
    threshold: 0,
  }));
  assert.equal(
    passingExpression(rules),
    "@and(and(and(equals(activity('CheckQuality').output.firstRow.q0, 0), equals(activity('CheckQuality').output.firstRow.q1, 0)), equals(activity('CheckQuality').output.firstRow.q2, 0)), equals(activity('CheckQuality').output.firstRow.q3, 0))",
  );
});
