import { test } from "node:test";
import assert from "node:assert/strict";
import { expand, validate, render } from "../plugin/index.mjs";

const columns = [
  { name: "id", type: "BIGINT", required: true, key: true },
  { name: "state", type: "STRING", required: false, key: false },
];
const contract = (extra = {}, stateRules = []) => ({
  apiVersion: "v3.1.0",
  kind: "DataContract",
  id: "customers",
  version: "1.0.0",
  status: "draft",
  schema: [
    {
      name: "customers",
      logicalType: "object",
      physicalType: "table",
      properties: [
        {
          name: "id",
          logicalType: "integer",
          physicalType: "BIGINT",
          primaryKey: true,
        },
        {
          name: "customer_state",
          physicalName: "state",
          logicalType: "string",
          physicalType: "STRING",
          quality: stateRules,
        },
      ],
      ...extra,
    },
  ],
});
const flow = (standard, value) => ({
  id: "source",
  kind: "ingestion",
  defaults: { with: {} },
  tables: { customers: { steps: {}, contract: value } },
  ingestion: {
    standard,
    target: { linkedService: "landing", fileSystem: "landing", path: "retail" },
  },
});
const planned = (standard, value) =>
  expand({
    flow: flow(standard, value),
    providerSource: "adf",
    columns: { customers: columns },
  }).steps[0].with;
const plan = (w) => ({
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
      columns,
      source: {
        kind: "azure-sql",
        linkedService: "erp",
        schema: "dbo",
        table: "customers",
        consistency: "frozen-extract",
      },
      with: w,
    },
  ],
});

test("SQL snapshots check contract rules on the frozen source before Copy", () => {
  const w = planned(
    "snapshot-land@v1",
    contract(
      {
        quality: [
          {
            id: "volume",
            metric: "rowCount",
            mustBeGreaterThan: 0,
            severity: "error",
          },
        ],
      },
      [
        {
          id: "state-valid",
          metric: "invalidValues",
          arguments: { validValues: ["NZ", "O'Neil", 7] },
          mustBe: 0,
          severity: "error",
        },
        {
          id: "state-missing",
          metric: "missingValues",
          mustBeLessThan: 5,
          unit: "percent",
        },
      ],
    ),
  );
  assert.deepEqual(
    w.quality.map((q) => [q.id, q.outcome]),
    [
      ["volume", "fail"],
      ["state-valid", "fail"],
      ["state-missing", "warn"],
      ["customers.id.key-not-null", "fail"],
      ["customers.key-unique", "fail"],
    ],
  );
  const p = plan(w);
  validate(p);
  const pipeline =
    render(p)["pipelines/retail_source_customers.json"].value.properties;
  assert.deepEqual(
    pipeline.activities.map((a) => a.name),
    ["CheckQuality", "VerifyQuality", "Copy", "VerifyCount"],
  );
  const [lookup, verify, copy] = pipeline.activities;
  const query = lookup.typeProperties.source.sqlReaderQuery;
  assert.equal(
    query,
    "SELECT COUNT_BIG(*) AS q0, " +
      "ISNULL(SUM(CASE WHEN [state] IS NOT NULL AND [state] NOT IN (N'NZ', N'O''Neil') THEN 1 ELSE 0 END), 0) AS q1, " +
      "ISNULL(CAST(100.0 * (ISNULL(SUM(CASE WHEN [state] IS NULL OR [state] IN (N'') THEN 1 ELSE 0 END), 0)) / NULLIF(COUNT_BIG(*), 0) AS DECIMAL(9, 4)), 0) AS q2, " +
      "ISNULL(SUM(CASE WHEN [id] IS NULL THEN 1 ELSE 0 END), 0) AS q3, " +
      "COUNT_BIG(*) - (SELECT COUNT_BIG(*) FROM (SELECT DISTINCT [id] FROM [dbo].[customers]) AS d) AS q4 " +
      "FROM [dbo].[customers]",
  );
  assert.equal(lookup.typeProperties.firstRowOnly, true);
  assert.equal(lookup.policy.retry, 0);
  assert.equal(
    verify.typeProperties.expression.value,
    "@and(greater(activity('CheckQuality').output.firstRow.q0, 0), " +
      "equals(activity('CheckQuality').output.firstRow.q1, 0), " +
      "equals(activity('CheckQuality').output.firstRow.q3, 0), " +
      "equals(activity('CheckQuality').output.firstRow.q4, 0))",
  );
  assert.equal(
    verify.typeProperties.ifFalseActivities[0].typeProperties.errorCode,
    "INGESTRON_QUALITY_FAILED",
  );
  assert.deepEqual(copy.dependsOn, [
    { activity: "VerifyQuality", dependencyConditions: ["Succeeded"] },
  ]);
  assert.doesNotMatch(
    JSON.stringify(pipeline),
    /DataFlow|enableSkipIncompatibleRow":true/,
  );
});

test("warning-only rules record counts without a gate", () => {
  const w = planned(
    "snapshot-land@v1",
    contract({}, [{ metric: "nullValues", mustBe: 0 }]),
  );
  w.quality = w.quality.filter((q) => q.outcome === "warn");
  const pipeline = render(plan(w))["pipelines/retail_source_customers.json"]
    .value.properties;
  assert.deepEqual(
    pipeline.activities.map((a) => a.name),
    ["CheckQuality", "Copy", "VerifyCount"],
  );
});

test("forms T-SQL cannot check and non-SQL standards are handled explicitly", () => {
  assert.throws(
    () =>
      planned(
        "snapshot-land@v1",
        contract({}, [
          {
            metric: "invalidValues",
            arguments: { pattern: "[A-Z]{2}" },
            mustBe: 0,
          },
        ]),
      ),
    /regular expressions/,
  );
  assert.equal(
    planned("immutable-file-copy@v1", contract()).quality,
    undefined,
  );
  const p = plan({
    ...planned("snapshot-land@v1", contract()),
    standard: "immutable-file-copy@v1",
  });
  assert.throws(() => validate(p), /SQL snapshot standards only/);
});
