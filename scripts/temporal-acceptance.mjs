/** Immutable installed temporal quality generation; no source or cloud access. */
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
for (const name of [
  "INGESTRON_ACCEPTANCE_CLI_PACKAGE",
  "INGESTRON_ACCEPTANCE_FIXTURE",
  "INGESTRON_ACCEPTANCE_OUTPUT",
  "INGESTRON_ACCEPTANCE_PROOF",
])
  assert.ok(process.env[name], "Set " + name);
const cliRoot = realpathSync(process.env.INGESTRON_ACCEPTANCE_CLI_PACKAGE),
  coreRoot = realpathSync(resolve(cliRoot, "../@ingestron/core")),
  cli = resolve(cliRoot, "build/cli/cli/index.js"),
  seed = JSON.parse(
    readFileSync(process.env.INGESTRON_ACCEPTANCE_FIXTURE, "utf8"),
  ),
  base = resolve(process.env.INGESTRON_ACCEPTANCE_OUTPUT),
  proof = resolve(process.env.INGESTRON_ACCEPTANCE_PROOF);
assert.equal(seed.result, "passed");
assert.equal(seed.provider, "4.9.0");
assert.equal(
  execFileSync("git", ["status", "--porcelain"], {
    cwd: seed.snapshot,
    encoding: "utf8",
  }).trim(),
  "",
);
assert.equal(
  execFileSync("git", ["rev-parse", seed.provider + "^{commit}"], {
    cwd: seed.snapshot,
    encoding: "utf8",
  }).trim(),
  seed.providerCommit,
);
assert.equal(
  createHash("sha256")
    .update(readFileSync(resolve(seed.snapshot, "plugin/index.mjs")))
    .digest("hex"),
  seed.providerModuleSha256,
);
const sdk = await import(
    pathToFileURL(resolve(coreRoot, "dist/sdk/adapter.js")).href
  ),
  { execute } = await import(
    pathToFileURL(resolve(coreRoot, "dist/sdk/index.js")).href
  ),
  require = createRequire(resolve(cliRoot, "package.json"));
const { Client } = await import(
    pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/index.js"))
      .href
  ),
  { StdioClientTransport } = await import(
    pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/stdio.js"))
      .href
  );
assert.equal(
  JSON.parse(readFileSync(resolve(coreRoot, "package.json"), "utf8")).version,
  "0.12.15",
);
assert.equal(
  JSON.parse(readFileSync(resolve(cliRoot, "package.json"), "utf8")).version,
  "0.17.9",
);
mkdirSync(base, { recursive: true });
const root = mkdtempSync(resolve(base, "adf-temporal-")),
  reference = "ingestron/provider-adf/plugin/provider.yaml@" + seed.provider,
  checks = [],
  queries = [];
sdk.installPackage(root, reference, { fromGit: seed.snapshot });
const put = (path, value) => {
  const p = resolve(root, path);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(
    p,
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
  );
};
const contract = {
  apiVersion: "v3.1.0",
  kind: "DataContract",
  id: "orders",
  name: "orders",
  version: "1.0.0",
  status: "draft",
  schema: [
    {
      name: "orders",
      logicalType: "object",
      physicalType: "table",
      properties: [
        {
          name: "id",
          physicalName: "source_id",
          logicalType: "integer",
          physicalType: "BIGINT",
          required: true,
          primaryKey: true,
        },
        {
          name: "business_day",
          physicalName: "day",
          logicalType: "date",
          physicalType: "DATE",
          quality: [
            {
              id: "day-valid",
              metric: "invalidValues",
              arguments: {
                validValues: [
                  "2024-02-29",
                  "2000-02-29",
                  "0001-01-01",
                  "2023-02-29",
                  "0000-01-01",
                  "2024-02-29\n",
                ],
              },
              mustBe: 0,
              severity: "error",
            },
          ],
        },
        {
          name: "event_time",
          physicalName: "event",
          logicalType: "timestamp",
          physicalType: "TIMESTAMP",
          quality: [
            {
              id: "clock-valid",
              metric: "invalidValues",
              arguments: {
                validValues: [
                  "2024-02-29T01:02:03.123456",
                  "2000-02-29 00:00:00",
                  "2023-02-29T01:02:03",
                  "2024-02-29T01:02:03.1234567",
                  "2024-02-29T01:02:03Z",
                  "2024-02-29T01:02:03+01:00",
                ],
              },
              mustBe: 0,
              severity: "error",
            },
            {
              id: "clock-missing",
              metric: "missingValues",
              arguments: {
                missingValues: ["2000-01-01T00:00:00", "2023-02-29T00:00:00"],
              },
              mustBe: 0,
            },
          ],
        },
      ],
    },
  ],
};
const flow = {
  apiVersion: "ingestron.flow/v1",
  id: "orders",
  kind: "ingestion",
  ingestion: {
    standard: "snapshot-land@v1",
    target: { linkedService: "landing", fileSystem: "landing", path: "retail" },
  },
  defaults: {
    source: {
      kind: "azure-sql",
      linkedService: "source",
      schema: "dbo",
      table: "orders",
      consistency: "frozen-extract",
    },
  },
  tables: {
    orders: { contract: { $resolve: "../../contracts/orders.odcs.yaml" } },
  },
};
put("contracts/orders.odcs.yaml", contract);
put("flows/orders/flow.yaml", flow);
put("project.yaml", {
  apiVersion: "ingestron.project/v1",
  id: "synthetic_adf_temporal",
  packages: { adf: reference },
  providers: {
    configurations: { landing: { package: "adf", binding: "factory" } },
  },
  defaults: { provider: "landing" },
  environments: {
    dev: {
      apiVersion: "ingestron.environment/v1",
      environment: "dev",
      bindings: { factory: { kind: "adf", factoryName: "synthetic-adf" } },
      values: {},
    },
  },
  connections: {},
  flows: [{ $resolve: "./flows/orders/flow.yaml" }],
});
const context = {
  root,
  environment: "dev",
  allowWrite: true,
  allowExecute: false,
  allowNetwork: false,
};
const command = (operation, args = {}, allow = false) => {
  const r = spawnSync(
    process.execPath,
    [
      cli,
      "--project",
      root,
      "--env",
      "dev",
      "--json",
      "--no-input",
      "operation",
      operation,
      ...(allow ? ["--allow-write"] : []),
    ],
    {
      input: JSON.stringify(args),
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  assert.equal(r.error, undefined);
  return JSON.parse(r.stdout);
};
const render = () => {
  const plan = sdk.planProject(root),
    files = sdk.renderProject(root, plan);
  return {
    plan,
    files,
    pipeline: JSON.parse(
      files["pipelines/synthetic_adf_temporal_orders_orders.json"],
    ),
  };
};
const build = () =>
  execute(context, "build", { flow: "orders", out: "build/acceptance" });
let result = "failed";
try {
  const validated = execute(context, "validate", {});
  assert.equal(validated.ok, true, JSON.stringify(validated.diagnostics));
  assert.ok(
    validated.result.quality.rules
      .filter((r) => r.outcome === "fail")
      .every((r) => r.mode === "at-load"),
  );
  assert.deepEqual(
    command("validate").result.quality,
    validated.result.quality,
  );
  const client = new Client({
    name: "adf-temporal-acceptance",
    version: "1.0.0",
  });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [cli, "--project", root, "advanced", "mcp", "serve"],
        stderr: "pipe",
      }),
    );
    assert.ok(
      !(await client.listTools()).tools.some(
        (t) => t.name === "ingestron_build",
      ),
    );
    const value = JSON.parse(
      (await client.callTool({ name: "ingestron_validate", arguments: {} }))
        .content[0].text,
    );
    assert.equal(value.ok, true, JSON.stringify(value));
    assert.deepEqual(value.result.quality, validated.result.quality);
  } finally {
    await client.close();
  }
  checks.push(
    "Immutable SDK/CLI/read-only MCP expose the same required native temporal quality coverage without source execution or writing MCP tools",
  );
  for (const [kind, queryKey, dialect] of [
    ["azure-sql", "sqlReaderQuery", "tsql"],
    ["sql-server", "sqlReaderQuery", "tsql"],
    ["postgresql", "query", "postgres"],
    ["mysql", "query", "mysql"],
    ["oracle", "oracleReaderQuery", "oracle"],
  ]) {
    const f = structuredClone(flow);
    f.defaults.source.kind = kind;
    if (kind === "postgresql") f.defaults.source.schema = "public";
    put("flows/orders/flow.yaml", f);
    const { plan, pipeline } = render(),
      [lookup, gate, copy] = pipeline.properties.activities,
      query = lookup.typeProperties.source[queryKey];
    assert.equal(copy.dependsOn[0].activity, "VerifyQuality");
    assert.equal(gate.typeProperties.ifFalseActivities[0].type, "Fail");
    assert.equal(copy.typeProperties.enableSkipIncompatibleRow, false);
    assert.equal(copy.typeProperties.translator.typeConversion, false);
    assert.deepEqual(copy.typeProperties.translator.mappings.at(-1), {
      source: { name: "event" },
      sink: { name: "event_time" },
    });
    assert.doesNotMatch(
      query,
      /2023|0000-01-01|00000101|1234567|\+01:00|03Z|\n/,
    );
    assert.equal(query.includes("0001"), kind !== "mysql");
    if (dialect === "tsql") {
      assert.match(query, /CONVERT\(date, '20240229', 112\)/);
      assert.match(
        query,
        /CONVERT\(datetime2\(6\), '2024-02-29T01:02:03.123456', 126\)/,
      );
    } else {
      assert.match(query, /DATE '2024-02-29'/);
      assert.match(query, /TIMESTAMP '2024-02-29 01:02:03.123456'/);
    }
    const path = resolve(root, "queries/" + kind + ".json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          kind,
          dialect,
          query,
          rules: plan.nodes[0].with.quality,
          pipeline,
          providerCommit: seed.providerCommit,
          providerModuleSha256: seed.providerModuleSha256,
        },
        null,
        2,
      ) + "\n",
    );
    queries.push({
      kind,
      path,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    });
  }
  checks.push(
    "All five relational source kinds emit strict typed temporal literals, frozen-source required gates and exact physical/logical mappings; invalid calendar/precision/timezone values never enter native SQL",
  );
  put("flows/orders/flow.yaml", flow);
  const accepted = build();
  assert.equal(accepted.ok, true, JSON.stringify(accepted.diagnostics));
  const nativePath = resolve(
      root,
      "build/acceptance/pipelines/synthetic_adf_temporal_orders_orders.json",
    ),
    original = readFileSync(nativePath, "utf8");
  assert.equal(
    execute({ ...context, allowWrite: false }, "build", {
      flow: "orders",
      out: "build/acceptance",
    }).ok,
    false,
  );
  assert.equal(readFileSync(nativePath, "utf8"), original);
  const bad = structuredClone(contract);
  bad.schema[0].properties[2].quality[0].arguments = { pattern: ".*" };
  put("contracts/orders.odcs.yaml", bad);
  const failed = build();
  assert.equal(failed.ok, false);
  assert.match(
    JSON.stringify(failed.diagnostics),
    /regular expressions|validValues/,
  );
  assert.equal(readFileSync(nativePath, "utf8"), original);
  checks.push(
    "Unapproved writes and unsupported native regex cannot replace the last accepted temporal pipeline",
  );
  put("contracts/orders.odcs.yaml", contract);
  assert.equal(build().ok, true);
  assert.equal(readFileSync(nativePath, "utf8"), original);
  assert.equal(
    JSON.parse(
      readFileSync(
        resolve(root, "build/acceptance/ingestron-project.json"),
        "utf8",
      ),
    ).deployment.executed,
    false,
  );
  checks.push(
    "Exact corrected contract/flow definitions regenerate the original mapped pipeline without native deployment",
  );
  result = "passed";
} finally {
  put("contracts/orders.odcs.yaml", contract);
  put("flows/orders/flow.yaml", flow);
  writeFileSync(
    proof,
    JSON.stringify(
      {
        apiVersion: "ingestron.adf-temporal-installed-acceptance/v1",
        result,
        root,
        cli,
        provider: reference,
        providerCommit: seed.providerCommit,
        providerModuleSha256: seed.providerModuleSha256,
        snapshot: seed.snapshot,
        core: "0.12.15",
        cliVersion: "0.17.9",
        queries,
        checks,
        limits: [
          "Synthetic immutable installed generation only; no records, query/copy execution, accounts or cloud access",
          "Source DATE/plain clock policy and vendor/native transport qualification remain distinct from literal generation",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(JSON.stringify({ result, checks: checks.length, root }));
