/** Synthetic installed ADF → publication → native Lakeflow history. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  realpathSync,
  cpSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { stringify, parse } from "yaml";
const cli = realpathSync(process.env.INGESTRON_ACCEPTANCE_CLI_PACKAGE);
const core = realpathSync(resolve(cli, "../@ingestron/core"));
const { installPackage, planProject, renderProject } = await import(
  pathToFileURL(resolve(core, "dist/sdk/adapter.js")).href
);
const { execute } = await import(
  pathToFileURL(resolve(core, "dist/sdk/index.js")).href
);
function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), "ingestron-adf-handover-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, value) => {
    const file = resolve(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof value === "string" ? value : stringify(value));
  };
  const adf = process.env.INGESTRON_ACCEPTANCE_PROVIDER_REFERENCE,
    dbx = "ingestron/provider-databricks/plugin/provider.yaml@3.8.0";
  installPackage(root, adf, {
    fromGit: process.env.INGESTRON_ACCEPTANCE_PROVIDER,
  });
  installPackage(root, dbx, {
    fromGit: process.env.INGESTRON_ACCEPTANCE_PEER_PROVIDER,
  });
  const source = {
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
            name: "order_id",
            physicalName: "id",
            logicalType: "integer",
            physicalType: "BIGINT",
            required: true,
            primaryKey: true,
          },
          {
            name: "customer_name",
            physicalName: "name",
            logicalType: "string",
            physicalType: "STRING",
          },
        ],
      },
    ],
  };
  const output = structuredClone(source);
  for (const column of output.schema[0].properties) delete column.physicalName;
  put("contracts/source.odcs.yaml", source);
  put("contracts/output.odcs.yaml", output);
  const project = {
    apiVersion: "ingestron.project/v1",
    id: "retail",
    packages: { factory: adf, databricks: dbx },
    providers: {
      configurations: {
        landing: { package: "factory", binding: "factory" },
        publisher: {
          package: "databricks",
          binding: "engine",
          options: {
            publication: {
              workspaceRoot: "/Workspace/Shared/synthetic_publication",
              existingClusterId: "0123-synthetic",
              runAsServicePrincipal: "synthetic-publisher",
              permissions: [
                { group_name: "engineers", level: "CAN_MANAGE_RUN" },
              ],
            },
          },
        },
        history: { package: "databricks", binding: "engine" },
      },
    },
    defaults: { provider: "landing" },
    environments: {
      dev: {
        apiVersion: "ingestron.environment/v1",
        environment: "dev",
        values: {},
        bindings: {
          factory: { kind: "adf", factoryName: "synthetic-factory" },
          files: { kind: "adls", accountName: "samplestorage" },
          engine: {
            kind: "databricks",
            host: "https://example.invalid",
            catalog: "retail",
          },
        },
      },
    },
    flows: [
      { $resolve: "./flows/landing/flow.yaml" },
      { $resolve: "./flows/publication/flow.yaml" },
      { $resolve: "./flows/history/flow.yaml" },
    ],
  };
  const landing = {
    apiVersion: "ingestron.flow/v1",
    id: "landing",
    kind: "ingestion",
    provider: "landing",
    export: "adf",
    ingestion: {
      standard: "snapshot-land@v1",
      target: {
        linkedService: "existing_landing",
        fileSystem: "landing",
        path: "retail",
      },
      handover: { binding: "files" },
    },
    defaults: {
      source: {
        kind: "azure-sql",
        linkedService: "existing_sql",
        schema: "dbo",
        table: "Orders",
        consistency: "frozen-extract",
      },
    },
    tables: {
      orders: { contract: { $resolve: "../../contracts/source.odcs.yaml" } },
    },
  };
  const publication = {
    apiVersion: "ingestron.flow/v1",
    id: "publication",
    kind: "ingestion",
    provider: "publisher",
    export: "publication",
    requires: {
      snapshot: {
        dataset: "retail.landing.orders.snapshot",
        handover: "files",
        select: { mode: "same-run" },
      },
    },
    ingestion: {
      standard: "snapshot-publication@v1",
      credential: {
        secretScope: "existing_scope",
        tenantIdKey: "tenant",
        clientIdKey: "client",
        clientSecretKey: "secret",
      },
    },
    defaults: { source: { from: "requires.snapshot" } },
    tables: {
      orders: { contract: { $resolve: "../../contracts/output.odcs.yaml" } },
    },
  };
  const history = {
    apiVersion: "ingestron.flow/v1",
    id: "history",
    kind: "ingestion",
    provider: "history",
    export: "history",
    requires: {
      completed: {
        dataset: "retail.publication.orders.completed",
        handover: "files",
        select: { mode: "same-run" },
      },
    },
    ingestion: {
      standard: "snapshot-with-history@v1",
      pipeline: "history",
      target: { schema: "current", historySchema: "history" },
      source: {
        delivery: "complete-snapshot",
        scope: "full-table",
        deletes: "missing-keys",
      },
      retention: { sourceDeliveries: "externally-retained", period: "P90D" },
    },
    defaults: { source: { from: "requires.completed" } },
    tables: {
      orders: { contract: { $resolve: "../../contracts/output.odcs.yaml" } },
    },
  };
  const save = () => {
    put("project.yaml", project);
    put("flows/landing/flow.yaml", landing);
    put("flows/publication/flow.yaml", publication);
    put("flows/history/flow.yaml", history);
  };
  save();
  const plan = () => planProject(root, "dev", { delivery: true });
  const build = () =>
    execute(
      {
        root,
        environment: "dev",
        allowWrite: true,
        allowExecute: false,
        allowNetwork: false,
      },
      "build",
      { delivery: true, out: "build/accepted" },
    );
  return {
    root,
    put,
    source,
    output,
    project,
    landing,
    publication,
    history,
    save,
    plan,
    build,
  };
}
test("installed mapped ADF handover, publication and history share exact output schemas and immutable completion identity", (t) => {
  const f = fixture(t),
    plan = f.plan();
  assert.equal(plan.nodes.length, 3);
  assert.equal(
    plan.nodes.find((n) => n.flow === "landing").contract.schema[0]
      .properties[0].physicalName,
    "id",
  );
  for (const id of [
    "retail.landing.orders.snapshot",
    "retail.publication.orders.completed",
    "retail.history.orders.current",
  ]) {
    const dataset = plan.datasets[id];
    assert.ok(dataset, id);
    assert.deepEqual(
      dataset.contract.schema[0].properties.map((c) => [
        c.name,
        c.physicalName,
      ]),
      [
        ["order_id", undefined],
        ["customer_name", undefined],
      ],
    );
  }
  const files = renderProject(f.root, plan),
    paths = Object.keys(files);
  const read = (suffix) => {
    const path = paths.find((p) => p.endsWith(suffix));
    assert.ok(path, suffix);
    return files[path];
  };
  const copy = JSON.parse(
    read("pipelines/retail_landing_orders.json"),
  ).properties.activities.find((a) => a.type === "Copy");
  assert.deepEqual(
    copy.typeProperties.translator.mappings.map((m) => [
      m.source.name,
      m.sink.name,
    ]),
    [
      ["id", "order_id"],
      ["name", "customer_name"],
    ],
  );
  const publisher = read("handover/retail_publication_orders.json");
  assert.match(publisher, /retail.landing.orders/);
  const history = JSON.parse(read("pipelines/history/orders.ipynb"))
    .cells.at(-1)
    .source.join("");
  assert.match(history, /`order_id` BIGINT, `customer_name` STRING/);
  assert.doesNotMatch(history, /F.col\("id"\)/);
  assert.match(history, /retail.landing.orders/);
  assert.match(history, /_ingestron\/deliveries.json/);
  const delivery = JSON.parse(files["ingestron-delivery.json"]);
  assert.equal(delivery.execution, "not-run");
  assert.equal(delivery.exports.length, 3);
  assert.equal(f.build().ok, true);
});
test("a stale physical schema or ambiguous mapping cannot replace installed delivery output", (t) => {
  const f = fixture(t);
  const first = f.build();
  assert.equal(first.ok, true, JSON.stringify(first));
  const path = resolve(f.root, "build/accepted/ingestron-project.json"),
    original = readFileSync(path, "utf8");
  f.put("contracts/output.odcs.yaml", f.source);
  let result = f.build();
  assert.equal(result.ok, false);
  assert.match(
    JSON.stringify(result.diagnostics),
    /Imported snapshot contract differs/,
  );
  assert.equal(readFileSync(path, "utf8"), original);
  f.put("contracts/output.odcs.yaml", f.output);
  const ambiguous = structuredClone(f.source);
  ambiguous.schema[0].properties[0].name = "key";
  ambiguous.schema[0].properties[1].name = "KEY";
  f.put("contracts/source.odcs.yaml", ambiguous);
  assert.throws(() => f.plan(), /case-ambiguous|contract differs/);
  assert.equal(readFileSync(path, "utf8"), original);
  f.put("contracts/source.odcs.yaml", f.source);
  assert.equal(f.build().ok, true);
  assert.equal(readFileSync(path, "utf8"), original);
});

for (const example of [
  "sql-snapshot",
  "immutable-file",
  "snapshot-handover",
  "metadata-snapshot",
  "coordinated-snapshot",
  "bridge-to-databricks",
  "watermark-append",
])
  test(`installed native example ${example} generates without source or platform access`, (t) => {
    const root = mkdtempSync(resolve(tmpdir(), "ingestron-adf-example-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const owner = fileURLToPath(new URL("../../", import.meta.url));
    cpSync(resolve(owner, "examples", example), root, { recursive: true });
    const adf = process.env.INGESTRON_ACCEPTANCE_PROVIDER_REFERENCE,
      peer = "ingestron/provider-databricks/plugin/provider.yaml@3.8.0";
    installPackage(root, adf, {
      fromGit: process.env.INGESTRON_ACCEPTANCE_PROVIDER,
    });
    installPackage(root, peer, {
      fromGit: process.env.INGESTRON_ACCEPTANCE_PEER_PROVIDER,
    });
    const file = resolve(root, "project.yaml"),
      project = parse(readFileSync(file, "utf8"));
    for (const key of Object.keys(project.packages ?? {})) {
      if (project.packages[key].includes("provider-adf"))
        project.packages[key] = adf;
      if (project.packages[key].includes("provider-databricks"))
        project.packages[key] = peer;
    }
    if (project.providers.packs?.snapshots) {
      const reference =
        "ingestron/provider-adf/packs/sql-snapshot/pack.yaml@" +
        adf.split("@").at(-1);
      project.providers.packs.snapshots = {
        source: "ingestron/provider-adf/packs/sql-snapshot/pack.yaml",
        version: adf.split("@").at(-1),
      };
      installPackage(root, reference, {
        fromGit: process.env.INGESTRON_ACCEPTANCE_PROVIDER,
      });
    }
    writeFileSync(file, stringify(project));
    const result = execute(
      {
        root,
        environment: "dev",
        allowWrite: true,
        allowExecute: false,
        allowNetwork: false,
      },
      "build",
      { out: "build/example" },
    );
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    const metadata = JSON.parse(
      readFileSync(
        resolve(root, "build/example/ingestron-project.json"),
        "utf8",
      ),
    );
    assert.equal(metadata.deployment.executed, false);
    assert.ok(metadata.includedFlows.length > 0);
  });
