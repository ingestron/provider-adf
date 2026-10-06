/** Locked ADF native schedules through immutable core/CLI/read-only MCP and project assembly; no cloud or source calls. */
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readdirSync,
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const required = (name) => {
  const value = process.env["INGESTRON_ACCEPTANCE_" + name];
  assert.ok(value, name);
  return resolve(value);
};
const cliRoot = realpathSync(required("CLI_PACKAGE")),
  coreRoot = realpathSync(resolve(cliRoot, "../@ingestron/core"));
assert.equal(
  JSON.parse(readFileSync(resolve(coreRoot, "package.json"))).version,
  "0.12.21",
);
const { execute } = await import(
  pathToFileURL(resolve(coreRoot, "dist/sdk/index.js")).href
);
const { installPackage, renderProject } = await import(
  pathToFileURL(resolve(coreRoot, "dist/sdk/adapter.js")).href
);
const require = createRequire(resolve(cliRoot, "package.json")),
  { parse, stringify } = require("yaml");
const { Client } = await import(
  pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/index.js"))
    .href
);
const { StdioClientTransport } = await import(
  pathToFileURL(require.resolve("@modelcontextprotocol/sdk/client/stdio.js"))
    .href
);
mkdirSync(required("OUTPUT"), { recursive: true });
const root = mkdtempSync(resolve(required("OUTPUT"), "adf-schedules-"));
const reference = "ingestron/provider-adf/plugin/provider.yaml@4.10.0";
installPackage(root, reference, { fromGit: required("PROVIDER") });
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const lockHash = hash(resolve(root, "packages.lock.yaml"));
const project = parse(readFileSync(required("EXAMPLE"), "utf8"));
project.packages.adf = reference;
project.providers.configurations.landing.options = {
  scheduleInputs: {
    source: {
      kind: "azure-sql",
      linkedService: "source_manifest",
      schema: "governance",
      view: "frozen_manifest",
    },
  },
};
const source = project.flows[0],
  table = source.tables.customers;
for (const id of ["orders", "products"]) {
  const clone = structuredClone(table);
  clone.source = { table: id };
  clone.contract.id = id;
  clone.contract.name = id;
  clone.contract.schema[0].name = id;
  source.tables[id] = clone;
}
const manual = { ...structuredClone(source), id: "manual" };
project.flows.push(manual);
writeFileSync(resolve(root, "project.yaml"), stringify(project));
const context = {
  root,
  environment: "dev",
  allowWrite: false,
  allowNetwork: false,
  allowExecute: false,
};
const passed = (value) => {
  assert.equal(value.ok, true, JSON.stringify(value));
  return value.result;
};
const cli = resolve(cliRoot, "build/cli/cli/index.js");
const command = (operation, args, write = false, selected = cli) => {
  const child = spawnSync(
    process.execPath,
    [
      selected,
      "--project",
      root,
      "--json",
      "--no-input",
      "operation",
      operation,
      ...(write ? ["--allow-write"] : []),
    ],
    { input: JSON.stringify(args), encoding: "utf8", timeout: 60000 },
  );
  assert.equal(child.error, undefined);
  assert.ok(child.stdout, child.stderr);
  return JSON.parse(child.stdout);
};
const base = {
  apiVersion: "ingestron.schedule/v1",
  enabled: false,
  timeZone: "Pacific/Auckland",
  start: "2026-10-06T00:00:17Z",
  end: "2027-10-06T00:00:17Z",
  overlap: "native",
  missed: "native",
};
const models = [
  {
    kind: "interval",
    schedule: {
      ...base,
      timeZone: "UTC",
      recurrence: { kind: "interval", minutes: 15 },
    },
  },
  {
    kind: "daily",
    schedule: {
      ...base,
      recurrence: { kind: "daily", times: ["09:15", "17:45"] },
    },
  },
  {
    kind: "weekly",
    schedule: {
      ...base,
      enabled: true,
      recurrence: {
        kind: "weekly",
        weekDays: ["Monday", "Friday"],
        times: ["09:15", "17:45"],
      },
    },
  },
  {
    kind: "monthly",
    schedule: {
      ...base,
      recurrence: {
        kind: "monthly",
        monthDays: [1, 31],
        times: ["09:15", "17:45"],
      },
    },
  },
];
const records = [];
let client,
  result = "failed";
const walk = (directory, prefix = "") =>
  Object.fromEntries(
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? Object.entries(
            walk(resolve(directory, entry.name), prefix + entry.name + "/"),
          )
        : [
            [
              prefix + entry.name,
              readFileSync(resolve(directory, entry.name), "utf8"),
            ],
          ],
    ),
  );
try {
  client = new Client({ name: "adf-schedules-installed", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [cli, "--project", root, "advanced", "mcp", "serve"],
      stderr: "pipe",
    }),
  );
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some((tool) => tool.name === "ingestron_plan"));
  assert.ok(
    !tools.some((tool) =>
      ["ingestron_build", "ingestron_execution_start"].includes(tool.name),
    ),
  );
  for (const model of models) {
    const proposal = passed(
      execute(context, "schedule_propose", {
        flow: "source",
        schedule: model.schedule,
      }),
    );
    assert.equal(
      execute(context, "apply", { proposal }).diagnostics[0].code,
      "PERMISSION",
    );
    passed(execute({ ...context, allowWrite: true }, "apply", { proposal }));
    const sdk = execute(context, "plan", { flow: "source" }),
      plan = passed(sdk);
    assert.deepEqual(
      command("plan", { flow: "source" }),
      JSON.parse(JSON.stringify(sdk)),
    );
    const wire = await client.callTool({
      name: "ingestron_plan",
      arguments: { flow: "source" },
    });
    assert.deepEqual(
      JSON.parse(wire.content[0].text),
      JSON.parse(JSON.stringify(sdk)),
    );
    const assets = renderProject(root, plan),
      manifest = JSON.parse(assets["adf-schedules.json"]);
    assert.equal(manifest.schedules.length, 1);
    const owned = manifest.schedules[0];
    assert.deepEqual(owned.definition, model.schedule);
    assert.deepEqual(owned.tables, [
      "source/customers",
      "source/orders",
      "source/products",
    ]);
    assert.equal(owned.triggers.length, model.kind === "interval" ? 1 : 2);
    assert.ok(
      owned.targets.every(
        (name) =>
          !name.includes("manual") &&
          !name.endsWith("_worker") &&
          !name.endsWith("_publish"),
      ),
    );
    if (model.kind !== "interval")
      assert.deepEqual(
        owned.triggers.map(
          (t) =>
            t.properties.typeProperties.recurrence.schedule.hours +
            ":" +
            t.properties.typeProperties.recurrence.schedule.minutes,
        ),
        ["9:15", "17:45"],
      );
    const out = "build/" + model.kind + "/sdk";
    passed(
      execute({ ...context, allowWrite: true }, "build", {
        flow: "source",
        out,
      }),
    );
    passed(
      command(
        "build",
        { flow: "source", out: "build/" + model.kind + "/cli" },
        true,
      ),
    );
    const sdkFiles = walk(resolve(root, out)),
      cliFiles = walk(resolve(root, "build/" + model.kind + "/cli"));
    const entries = Object.entries(sdkFiles).filter(
      ([name]) =>
        name.endsWith("adf-schedules.json") ||
        /(^|\/)(triggers|pipelines|datasets)\//.test(name) ||
        name.endsWith("adf-template.json"),
    );
    assert.ok(entries.length >= 14);
    for (const name of owned.targets)
      assert.ok(sdkFiles["pipelines/" + name + ".json"], name);
    for (const trigger of owned.triggers)
      assert.ok(sdkFiles["triggers/" + trigger.name + ".json"], trigger.name);
    for (const [name, content] of entries)
      assert.equal(cliFiles[name], content, name);
    assert.equal(
      passed(execute(context, "plan", { flow: "manual" })).scheduleBoundaries,
      undefined,
    );
    records.push({
      check:
        "Reviewed schedule authoring, immutable SDK/CLI/MCP plan parity, native rendering and exact project assembly/build parity",
      kind: model.kind,
      flow: "source",
      tables: owned.tables,
      triggers: owned.triggers.map((t) => ({
        name: t.name,
        recurrence: t.properties.typeProperties.recurrence,
      })),
      activationIntent: owned.activationIntent,
      files: entries.map(([name, content]) => ({
        name,
        sha256: createHash("sha256").update(content).digest("hex"),
      })),
    });
  }
  const accepted = passed(execute(context, "plan", { flow: "source" }));
  const forbidden = passed(
    execute(context, "schedule_propose", {
      flow: "source",
      schedule: { ...models[1].schedule, overlap: "skip" },
    }),
  );
  passed(
    execute({ ...context, allowWrite: true }, "apply", { proposal: forbidden }),
  );
  assert.equal(execute(context, "plan", { flow: "source" }).ok, false);
  const repaired = passed(
    execute(context, "schedule_propose", {
      flow: "source",
      schedule: models[3].schedule,
    }),
  );
  passed(
    execute({ ...context, allowWrite: true }, "apply", { proposal: repaired }),
  );
  assert.equal(
    passed(execute(context, "plan", { flow: "source" })).digest,
    accepted.digest,
  );
  assert.equal(
    execute(context, "plan", { flow: "source", table: "orders" }).ok,
    false,
  );
  const old = command("plan", { flow: "source" }, false, required("OLD_CLI"));
  assert.equal(old.ok, false);
  assert.equal(old.diagnostics[0].code, "COMPATIBILITY");
  assert.equal(hash(resolve(root, "packages.lock.yaml")), lockHash);
  records.push({
    check:
      "Portable-policy refusal, exact repaired plan, partial-flow refusal and actual older-host ABI denial; locked provider unchanged",
    oldHostDiagnostic: old.diagnostics[0],
  });
  result = "passed";
} finally {
  if (client) await client.close();
  writeFileSync(
    required("PROOF"),
    JSON.stringify(
      {
        apiVersion: "ingestron.adf-schedules-installed/v1",
        result,
        root,
        coreVersion: "0.12.21",
        cliVersion: "0.17.10",
        provider: {
          reference,
          lockSha256: lockHash,
          origin: required("PROVIDER"),
        },
        archives: Object.fromEntries(
          ["CORE_ARCHIVE", "CLI_ARCHIVE"].map((name) => [
            name,
            { path: required(name), sha256: hash(required(name)) },
          ]),
        ),
        records,
        limits:
          "Actual immutable SDK/CLI/read-only MCP and locked native provider; reviewed definitions, native assets and assembled project builds only. No source reads, vendor execution, activation, browser qualification or cancellation/recovery qualification.",
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(JSON.stringify({ result, checks: records.length }));
