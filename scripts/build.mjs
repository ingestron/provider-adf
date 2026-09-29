import { createHash } from "node:crypto";
const provenance = JSON.parse(
  readFileSync("src/vendor/connectors/provenance.json", "utf8"),
);
for (const [name, record] of Object.entries(provenance.files)) {
  if (
    createHash("sha256")
      .update(readFileSync("src/vendor/connectors/" + name))
      .digest("hex") !== record.sha256
  )
    throw Error("Shared connector contract differs from pinned source");
}
import { readFileSync, writeFileSync } from "node:fs";
writeFileSync(
  "plugin/runtime-assets.mjs",
  "// Generated from runtime/ by scripts/build.mjs.\n" +
    [
      ["fileRunner", "runtime/discover-files.py"],
      ["sqlRunner", "runtime/discover-sql.mjs"],
      ["requirements", "runtime/requirements.txt"],
    ]
      .map(
        ([name, path]) =>
          `export const ${name} = ${JSON.stringify(readFileSync(path, "utf8"))};`,
      )
      .join("\n") +
    "\n",
);
import { build } from "esbuild";
await build({
  entryPoints: ["src/index.mjs"],
  outfile: "plugin/index.mjs",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
});

await build({
  entryPoints: ["src/commands.mjs"],
  outfile: "plugin/commands.mjs",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
});

await build({
  entryPoints: ["src/lifecycle.ts"],
  outfile: "plugin/lifecycle.mjs",
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
});

const fsNotices = await import("node:fs");
const noticesPath = "plugin/THIRD-PARTY-NOTICES.txt";
const baseNotices = fsNotices.existsSync(noticesPath)
  ? fsNotices
      .readFileSync(noticesPath, "utf8")
      .split("\n\nYAML (bundled parser)")[0]
  : "";
fsNotices.writeFileSync(
  noticesPath,
  baseNotices +
    "\n\nYAML (bundled parser)\n\n" +
    fsNotices.readFileSync("node_modules/yaml/LICENSE", "utf8"),
);

const { discoveryDefinitions } = await import("../src/discovery.mjs");
const { sourceDefinition, fileMetadataSchema } =
  await import("../src/source-discovery.mjs");
discoveryDefinitions[1].inputSchema = {
  oneOf: [discoveryDefinitions[1].inputSchema, fileMetadataSchema],
};
const { parse, stringify } = await import("yaml");
const { connectorRuntimes, projectConnectionDefinition } =
  await import("../src/project-connections.mjs");
const { connectorDefinitions } = await import("../src/connectors.mjs");
const { computeDefinition, poolDefinition } =
  await import("../src/compute.mjs");
const manifestPath = "plugin/provider.yaml";
const manifest = parse(fsNotices.readFileSync(manifestPath, "utf8"));
manifest.version = JSON.parse(
  fsNotices.readFileSync("package.json", "utf8"),
).version;
delete manifest.connectors;
manifest.connectorRuntimes = connectorRuntimes;
manifest.compatibility.requiredFeatures = [
  ...new Set([
    ...manifest.compatibility.requiredFeatures,
    "project-connections",
    "odcs-connections",
    "connector-runtime-capabilities",
  ]),
];
manifest.commands.definitions = manifest.commands.definitions.filter(
  (d) =>
    ![
      "connection prepare",
      "connector contracts",
      "connector browse",
      "connector prepare",
      "compute pool prepare",
      "compute prepare",
      "discover prepare",
      "discover contracts",
      "deploy prepare",
      "discover source prepare",
    ].includes(d.name),
);
manifest.commands.definitions.push(
  projectConnectionDefinition,
  ...connectorDefinitions,
  computeDefinition,
  poolDefinition,
  sourceDefinition,
  ...discoveryDefinitions,
  {
    ...discoveryDefinitions[0],
    name: "deploy prepare",
    description:
      "Prepare a reviewed discovery deployment bundle for a new or existing factory; no Azure calls.",
  },
);

manifest.projectAssembly = {
  apiVersion: "ingestron.project-assembly/v1",
  command: "project assemble",
};
manifest.compatibility.requiredFeatures = [
  ...new Set([...manifest.compatibility.requiredFeatures, "project-assembly"]),
];
manifest.commands.definitions = manifest.commands.definitions.filter(
  (d) => d.name !== "project assemble",
);
manifest.commands.definitions.push({
  name: "project assemble",
  description: "Assemble one scoped platform project without deployment",
  inputSchema: { type: "object", additionalProperties: true },
});
const { format } = await import("prettier");
fsNotices.writeFileSync(
  manifestPath,
  await format(stringify(JSON.parse(JSON.stringify(manifest))), {
    parser: "yaml",
  }),
);

// The activity pack extends one exact provider version and ships on its tag.
const presetPath = "packs/sql-snapshot/pack.yaml";
const preset = parse(readFileSync(presetPath, "utf8"));
preset.version = manifest.version;
preset.extends.version = manifest.version;
writeFileSync(presetPath, await format(stringify(preset), { parser: "yaml" }));
