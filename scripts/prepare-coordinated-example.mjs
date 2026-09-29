import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [databricksRoot, output] = process.argv.slice(2);
if (!databricksRoot || !output)
  throw new Error(
    "Usage: node scripts/prepare-coordinated-example.mjs <databricks-repository> <new-output-directory>",
  );
const out = resolve(output);
if (existsSync(out)) throw new Error("Output directory must not exist");
const dbx = resolve(databricksRoot, "plugin");
const manifest = parse(readFileSync(resolve(dbx, "provider.yaml"), "utf8"));
if (manifest.version !== "2.1.0")
  throw new Error("This example requires Databricks candidate 2.1.0");
mkdirSync(out, { recursive: true });
cpSync(resolve(root, "examples/coordinated-snapshot"), out, {
  recursive: true,
});
cpSync(resolve(root, "plugin"), resolve(out, "providers/adf"), {
  recursive: true,
});
cpSync(dbx, resolve(out, "providers/databricks"), { recursive: true });
cpSync(resolve(root, "packs"), resolve(out, "packs"), { recursive: true });
const project = parse(readFileSync(resolve(out, "project.yaml"), "utf8"));
project.providers.packages.adf.source = "./providers/adf/provider.yaml";
project.providers.packages.databricks.source =
  "./providers/databricks/provider.yaml";
project.providers.packs.snapshots.source = "./packs/sql-snapshot/pack.yaml";
writeFileSync(resolve(out, "project.yaml"), stringify(project));
console.log(out);
