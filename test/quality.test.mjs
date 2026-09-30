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
  const from = "[dbo].[customers]";
  assert.equal(
    query,
    `SELECT (SELECT COUNT_BIG(*) FROM ${from}) AS q0, ` +
      `(SELECT ISNULL(SUM(CASE WHEN [state] IS NOT NULL AND [state] NOT IN (N'NZ', N'O''Neil') THEN 1 ELSE 0 END), 0) FROM ${from}) AS q1, ` +
      `(SELECT ISNULL(CAST(100.0 * (ISNULL(SUM(CASE WHEN [state] IS NULL OR [state] IN (N'') THEN 1 ELSE 0 END), 0)) / NULLIF(COUNT_BIG(*), 0) AS DECIMAL(9, 4)), 0) FROM ${from}) AS q2, ` +
      `(SELECT ISNULL(SUM(CASE WHEN [id] IS NULL THEN 1 ELSE 0 END), 0) FROM ${from}) AS q3, ` +
      `(SELECT COUNT_BIG(*) - (SELECT COUNT_BIG(*) FROM (SELECT DISTINCT [id] FROM ${from}) AS d) FROM ${from}) AS q4`,
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
  const patterned = planned(
    "snapshot-land@v1",
    contract({}, [
      {
        metric: "invalidValues",
        arguments: { pattern: "[A-Z]{2}" },
        mustBe: 0,
      },
    ]),
  );
  assert.throws(() => validate(plan(patterned)), /regular expressions/);
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

test("sql rules join the pre-copy check; engine rules are left to their engine", () => {
  const w = planned(
    "snapshot-land@v1",
    contract(
      {
        quality: [
          {
            id: "recent",
            type: "sql",
            query: "SELECT COUNT(*) FROM ${table} WHERE [id] < 0",
            mustBe: 0,
            severity: "error",
          },
          {
            id: "dbx-only",
            type: "custom",
            engine: "databricks",
            implementation: "id > 0",
            severity: "error",
          },
        ],
      },
      [
        {
          id: "state-width",
          type: "sql",
          query: "SELECT MAX(LEN(${column})) FROM ${table}",
          mustBeLessOrEqualTo: 3,
        },
      ],
    ),
  );
  assert.deepEqual(
    w.quality.map((q) => q.id),
    [
      "recent",
      "state-width",
      "customers.id.key-not-null",
      "customers.key-unique",
    ],
  );
  const pipeline = render(plan(w))["pipelines/retail_source_customers.json"]
    .value.properties;
  const query = pipeline.activities[0].typeProperties.source.sqlReaderQuery;
  assert.match(
    query,
    /^SELECT \(SELECT COUNT\(\*\) FROM \[dbo\]\.\[customers\] WHERE \[id\] < 0\) AS q0, \(SELECT MAX\(LEN\(\[state\]\)\) FROM \[dbo\]\.\[customers\]\) AS q1, /,
  );
  assert.match(
    pipeline.activities[1].typeProperties.expression.value,
    /^@and\(equals\(activity\('CheckQuality'\)\.output\.firstRow\.q0, 0\), /,
  );
  for (const [query, message] of [
    ["SELECT 1; DROP TABLE x", /semicolons/],
    ["SELECT * INTO copy FROM ${table}", /only read/],
    ["EXEC sp_who", /only read/],
    ["SELECT 1 /* x */", /comments/],
  ])
    assert.throws(
      () =>
        planned(
          "snapshot-land@v1",
          contract({ quality: [{ type: "sql", query, mustBe: 0 }] }),
        ),
      message,
    );
});

test("postgresql, mysql and oracle snapshots use their own Copy types and SQL dialect", () => {
  const rules = contract({}, [
    {
      id: "state-valid",
      metric: "invalidValues",
      arguments: { validValues: ["NZ"] },
      mustBe: 0,
      severity: "error",
    },
    {
      id: "state-code",
      metric: "invalidValues",
      arguments: { pattern: "[A-Z]{2}" },
      mustBe: 0,
    },
  ]);
  const expected = {
    postgresql: {
      dataset: ["PostgreSqlV2Table", { schema: "dbo", table: "customers" }],
      source: "PostgreSqlV2Source",
      query: "query",
      select: 'SELECT "id", "state" FROM "dbo"."customers"',
      checks: [
        /COUNT\(\*\)/,
        /COALESCE\(SUM/,
        /"state" NOT IN \('NZ'\)/,
        /CAST\("state" AS TEXT\) !~ '\^\(\[A-Z\]\{2\}\)\$'/,
      ],
    },
    mysql: {
      dataset: ["MySqlTable", { tableName: "customers" }],
      source: "MySqlSource",
      query: "query",
      select: "SELECT `id`, `state` FROM `dbo`.`customers`",
      checks: [/NOT REGEXP_LIKE\(`state`/, /AS d\)/],
    },
    oracle: {
      dataset: ["OracleTable", { schema: "dbo", table: "customers" }],
      source: "OracleSource",
      query: "oracleReaderQuery",
      select: 'SELECT "id", "state" FROM "dbo"."customers"',
      checks: [/ FROM DUAL$/, /\) d\)/, /NOT REGEXP_LIKE\("state"/],
    },
  };
  for (const [kind, e] of Object.entries(expected)) {
    const p = plan(planned("snapshot-land@v1", rules));
    p.nodes[0].source.kind = kind;
    validate(p);
    const assets = render(p);
    const dataset =
      assets["datasets/retail_source_customers_source.json"].value.properties;
    assert.deepEqual([dataset.type, dataset.typeProperties], e.dataset, kind);
    const [lookup, , copy] =
      assets["pipelines/retail_source_customers.json"].value.properties
        .activities;
    assert.equal(copy.typeProperties.source.type, e.source);
    assert.equal(copy.typeProperties.source[e.query], e.select);
    assert.equal(copy.typeProperties.source.partitionOption, undefined);
    const check = lookup.typeProperties.source[e.query];
    assert.doesNotMatch(check, /COUNT_BIG|ISNULL|N'/, kind);
    for (const pattern of e.checks) assert.match(check, pattern, kind);
  }
});

test("S3 files copy unchanged through the S3 location", () => {
  const p = plan({
    standard: "immutable-file-copy@v1",
    target: { linkedService: "landing", fileSystem: "landing", path: "retail" },
  });
  p.nodes[0].source = {
    kind: "s3",
    linkedService: "vendor_s3",
    bucket: "vendor-drops",
    folder: "daily",
    fileName: "orders.csv",
    completion: "immutable",
  };
  validate(p);
  const assets = render(p);
  const location =
    assets["datasets/retail_source_customers_source.json"].value.properties
      .typeProperties.location;
  assert.deepEqual(location, {
    type: "AmazonS3Location",
    bucketName: "vendor-drops",
    folderPath: "daily",
    fileName: "orders.csv",
  });
  const copy =
    assets["pipelines/retail_source_customers.json"].value.properties
      .activities[0];
  assert.equal(
    copy.typeProperties.source.storeSettings.type,
    "AmazonS3ReadSettings",
  );
  p.nodes[0].source.bucket = "Bad_Bucket";
  assert.throws(() => validate(p), /bucket/);
  p.nodes[0].source = {
    ...p.nodes[0].source,
    kind: "gcs",
    bucket: "vendor_drops",
  };
  validate(p);
  const gcs = render(p);
  assert.equal(
    gcs["datasets/retail_source_customers_source.json"].value.properties
      .typeProperties.location.type,
    "GoogleCloudStorageLocation",
  );
  assert.equal(
    gcs["pipelines/retail_source_customers.json"].value.properties.activities[0]
      .typeProperties.source.storeSettings.type,
    "GoogleCloudStorageReadSettings",
  );
});

test("SharePoint lists land as typed Parquet through the list connector", () => {
  const p = plan({
    standard: "sharepoint-list-land@v1",
    target: { linkedService: "landing", fileSystem: "landing", path: "retail" },
  });
  p.nodes[0].source = {
    kind: "sharepoint-list",
    linkedService: "finance_sharepoint",
    listName: "Budgets",
  };
  validate(p);
  const assets = render(p);
  const dataset =
    assets["datasets/retail_source_customers_source.json"].value.properties;
  assert.deepEqual(
    [dataset.type, dataset.typeProperties],
    ["SharePointOnlineListResource", { listName: "Budgets" }],
  );
  const activities =
    assets["pipelines/retail_source_customers.json"].value.properties
      .activities;
  assert.deepEqual(
    activities.map((a) => a.name),
    ["Copy"],
  );
  const copy = activities[0].typeProperties;
  assert.deepEqual(copy.source, {
    type: "SharePointOnlineListSource",
    query: "$select=id,state",
  });
  assert.equal(copy.sink.type, "ParquetSink");
  assert.equal(copy.translator.mappings.length, 2);
  const landing =
    assets["datasets/retail_source_customers_landing.json"].value.properties;
  assert.equal(landing.type, "Parquet");
  p.nodes[0].source = {
    kind: "sharepoint-list",
    linkedService: "finance_sharepoint",
    path: "Lists/Team%20Budgets",
    entity: "list",
  };
  validate(p);
  assert.equal(
    render(p)["datasets/retail_source_customers_source.json"].value.properties
      .typeProperties.listName,
    "Team Budgets",
  );
  p.nodes[0].source.entity = "file";
  assert.throws(() => validate(p), /SharePoint files need another route/);
  p.nodes[0].source = {
    kind: "sharepoint-list",
    linkedService: "x",
    listName: "Bob's list",
  };
  assert.throws(() => validate(p), /apostrophe/);
});

test("Salesforce and HubSpot objects land as typed Parquet through Copy", () => {
  const p = plan({
    standard: "app-land@v1",
    target: { linkedService: "landing", fileSystem: "landing", path: "retail" },
  });
  const rendered = (source) => {
    p.nodes[0].source = source;
    validate(p);
    const assets = render(p);
    return {
      dataset:
        assets["datasets/retail_source_customers_source.json"].value.properties,
      copy: assets["pipelines/retail_source_customers.json"].value.properties
        .activities,
    };
  };
  const sf = rendered({
    kind: "salesforce",
    linkedService: "crm_salesforce",
    object: "Invoice__c",
  });
  assert.deepEqual(
    [sf.dataset.type, sf.dataset.typeProperties],
    ["SalesforceV2Object", { objectApiName: "Invoice__c" }],
  );
  assert.deepEqual(
    sf.copy.map((a) => a.name),
    ["Copy"],
  );
  assert.deepEqual(sf.copy[0].typeProperties.source, {
    type: "SalesforceV2Source",
    query: "SELECT id, state FROM Invoice__c",
    includeDeletedObjects: false,
  });
  assert.equal(sf.copy[0].typeProperties.sink.type, "ParquetSink");
  const hs = rendered({
    kind: "hubspot",
    linkedService: "crm_hubspot",
    object: "contacts",
  });
  assert.deepEqual(
    [hs.dataset.type, hs.dataset.typeProperties],
    ["HubspotObject", { tableName: "CRM.Objects.Contacts" }],
  );
  assert.deepEqual(hs.copy[0].typeProperties.source, { type: "HubspotSource" });
  assert.equal(hs.copy[0].typeProperties.translator.mappings.length, 2);
  p.nodes[0].source = { kind: "hubspot", linkedService: "x", object: "forms" };
  assert.throws(() => validate(p), /HubSpot object must be one of/);
  p.nodes[0].source = {
    kind: "salesforce",
    linkedService: "x",
    object: "Account WHERE",
  };
  assert.throws(() => validate(p), /Salesforce object API name/);
  p.nodes[0].source = { kind: "jira", linkedService: "x", object: "issues" };
  assert.throws(() => validate(p), /read salesforce, hubspot/);
});
