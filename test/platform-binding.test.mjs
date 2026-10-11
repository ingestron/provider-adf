import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { author } from "../plugin/lifecycle.mjs";

const input = () => ({
  projectId: "finance-overview",
  environment: "dev",
  profile: { purpose: "development", authentication: "azure-cli", secrets: [] },
  resources: { factoryName: "synthetic-finance-dev" },
});
test("packaged guided binding references an existing factory without changing the input", () => {
  const options = input(),
    before = structuredClone(options);
  const result = author({ operation: "platform_binding", options });
  assert.deepEqual(Object.keys(result.files), ["binding.yaml"]);
  const binding = parse(result.files["binding.yaml"]);
  assert.deepEqual(binding.binding, {
    kind: "adf",
    factoryName: "synthetic-finance-dev",
  });
  assert.deepEqual(binding.options, {});
  assert.match(binding.ownership, /externally owned/);
  assert.match(binding.pendingIntent.join(" "), /deployment authority/);
  assert.deepEqual(options, before);
  const manifest = parse(
    readFileSync(new URL("../plugin/provider.yaml", import.meta.url), "utf8"),
  );
  assert.equal(
    manifest.platformBinding.apiVersion,
    "ingestron.platform-binding-authoring/v1",
  );
  assert.ok(
    manifest.compatibility.requiredFeatures.includes(
      "programme-platform-binding",
    ),
  );
  assert.deepEqual(manifest.platformBinding.resourcesSchema.required, [
    "factoryName",
  ]);
});
test("unsupported resource, identity and production intent cannot be silently discarded", () => {
  const edits = [
    (o) => delete o.resources.factoryName,
    (o) => (o.resources.factoryName = "../factory"),
    (o) => (o.resources.factoryName = "https://synthetic.invalid"),
    (o) => (o.resources.factoryName = 1),
    (o) => (o.resources.resourceGroup = "shared"),
    (o) => (o.resources.password = "synthetic"),
    (o) => (o.profile.authentication = "managed-identity"),
    (o) => o.profile.secrets.push({ name: "TOKEN", source: "local-env" }),
    (o) => (o.profile.purpose = "production"),
    (o) => (o.projectId = "../shared"),
    (o) => (o.environment = "../prod"),
  ];
  for (const edit of edits) {
    const options = input();
    edit(options);
    assert.throws(() => author({ operation: "platform_binding", options }));
  }
});
