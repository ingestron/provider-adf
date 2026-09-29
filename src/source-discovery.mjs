import {
  fileRunner,
  sqlRunner,
  requirements,
} from "../plugin/runtime-assets.mjs";
import { metadataQuery } from "./discovery.mjs";
export const fileFormats = [
  "csv",
  "tsv",
  "json",
  "jsonl",
  "parquet",
  "xml",
  "xlsx",
];
const check = (v, m) => {
  if (!v) throw Error(m);
};
const id = (v) =>
  typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v);
const path = (v) =>
  typeof v === "string" &&
  v.length <= 512 &&
  /^[A-Za-z0-9_./= -]+$/.test(v) &&
  v.split("/").every((p) => p !== "." && p !== ".." && p !== "");
export function sourcePrepare(input) {
  check(id(input.sourceId), "Use a simple sourceId");
  if (input.sourceKind === "azure-sql") {
    check(
      !input.format && !input.datasets && !input.sampleRows,
      "SQL uses explicit catalogue schemas/tables, not file settings",
    );
    return {
      apiVersion: "ingestron.artifact-proposal/v1",
      artifacts: {
        "discovery.json": JSON.stringify(input, null, 2),
        "discover.mjs": sqlRunner,
        "metadata-query.sql": metadataQuery(
          "azure-sql",
          input.schemas,
          input.tables,
        ),
        "package.json": JSON.stringify(
          {
            private: true,
            type: "module",
            engines: { node: ">=22 <23" },
            dependencies: { mssql: "12.7.2" },
          },
          null,
          2,
        ),
      },
      applied: false,
    };
  }
  check(
    input.sourceKind === "adls" && fileFormats.includes(input.format),
    "Select adls and a supported file format",
  );
  check(
    !input.schemas && !input.tables,
    "Files use explicit datasets, not catalogue schemas/tables",
  );
  check(
    Array.isArray(input.datasets) &&
      input.datasets.length > 0 &&
      input.datasets.length <= 100,
    "Select 1–100 datasets",
  );
  const names = new Set();
  for (const d of input.datasets) {
    check(
      id(d.name) && !names.has(d.name),
      "Dataset names must be unique simple identifiers",
    );
    names.add(d.name);
    check(
      Array.isArray(d.paths) &&
        d.paths.length > 0 &&
        d.paths.length <= 100 &&
        d.paths.every(path) &&
        new Set(d.paths).size === d.paths.length,
      "Select unique safe explicit file paths",
    );
    check(
      d.paths.every((p) => p.toLowerCase().endsWith("." + input.format)),
      "File extension must match format",
    );
    check(
      input.format === "xlsx"
        ? d.paths.length === 1 && id(d.sheet)
        : d.sheet === undefined,
      "XLSX requires one file and explicit simple worksheet; sheet applies only to XLSX",
    );
    check(
      !d.partitionColumns ||
        (input.format === "parquet" &&
          d.partitionColumns.every(id) &&
          new Set(d.partitionColumns).size === d.partitionColumns.length),
      "Explicit partitions apply only to Parquet",
    );
  }
  check(
    input.datasets.reduce((n, d) => n + d.paths.length, 0) <= 200,
    "At most 200 selected file reads",
  );
  const sampleRows = input.sampleRows ?? 1000;
  check(
    Number.isInteger(sampleRows) && sampleRows >= 1 && sampleRows <= 10000,
    "sampleRows must be 1–10000",
  );
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts: {
      "discovery.json": JSON.stringify({ ...input, sampleRows }, null, 2),
      "discover.py": fileRunner,
      "requirements.txt": requirements,
    },
    applied: false,
  };
}
function property(c, depth = 0) {
  check(
    depth <= 8 && id(c.name) && typeof c.nullable === "boolean",
    "Invalid column name, depth or nullability",
  );
  const types = {
    string: ["STRING", "BINARY"],
    integer: ["BIGINT", "INT", "SMALLINT"],
    number: ["DOUBLE", "FLOAT"],
    boolean: ["BOOLEAN"],
    date: ["DATE"],
    timestamp: ["TIMESTAMP"],
    object: ["STRUCT"],
    array: ["ARRAY"],
  };
  check(
    types[c.logicalType] &&
      (types[c.logicalType].includes(c.physicalType) ||
        (c.logicalType === "number" &&
          /^DECIMAL\((\d{1,2}),(\d{1,2})\)$/.test(c.physicalType))),
    "Unsupported discovered type",
  );
  if (c.physicalType.startsWith("DECIMAL")) {
    const [p, s] = c.physicalType.match(/\d+/g).map(Number);
    check(p >= 1 && p <= 38 && s <= p, "Invalid decimal");
  }
  check(
    [
      "sampled-values",
      "declared-parquet-schema",
      "declared-path-partition",
    ].includes(c.evidence),
    "Unknown type evidence",
  );
  const out = {
    name: c.name,
    logicalType: c.logicalType,
    physicalType: c.physicalType,
    required: c.evidence === "declared-parquet-schema" && !c.nullable,
    description: `Discovery evidence: ${c.evidence}. Sample absence of nulls does not establish requiredness.${c.warning ? " " + c.warning : ""}`,
  };
  if (c.logicalType === "object") {
    check(
      Array.isArray(c.properties) && c.properties.length > 0,
      "Object properties required",
    );
    out.properties = c.properties.map((x) => property(x, depth + 1));
    check(
      new Set(out.properties.map((p) => p.name)).size === out.properties.length,
      "Duplicate nested property",
    );
  }
  if (c.logicalType === "array") {
    check(c.items, "Array item metadata required");
    out.items = property(c.items, depth + 1);
    delete out.items.name;
  }
  return out;
}
export function fileContracts(input) {
  check(
    input.apiVersion === "ingestron.file-metadata/v1" &&
      id(input.sourceId) &&
      input.sourceKind === "adls" &&
      fileFormats.includes(input.format),
    "Unsupported file metadata envelope",
  );
  check(
    Array.isArray(input.datasets) &&
      input.datasets.length > 0 &&
      input.datasets.length <= 100,
    "Expected 1–100 datasets",
  );
  const artifacts = {},
    review = [];
  for (const d of input.datasets) {
    check(
      id(d.name) &&
        Array.isArray(d.files) &&
        d.files.length > 0 &&
        d.files.every((f) => path(f.path) && /^[a-f0-9]{64}$/.test(f.sha256)),
      "Invalid dataset file identity",
    );
    check(
      Array.isArray(d.columns) &&
        d.columns.length > 0 &&
        d.columns.length <= 200,
      "Expected bounded columns",
    );
    const key = input.sourceId + "__" + d.name;
    check(!artifacts[key + ".odcs.json"], "Duplicate dataset");
    const properties = d.columns.map((c) => property(c));
    check(
      new Set(properties.map((p) => p.name)).size === properties.length,
      "Duplicate columns",
    );
    artifacts[key + ".odcs.json"] = JSON.stringify(
      {
        apiVersion: "v3.1.0",
        kind: "DataContract",
        id: key,
        name: key,
        version: "1.0.0",
        status: "draft",
        schema: [
          {
            name: key,
            logicalType: "object",
            physicalName:
              d.files.map((f) => f.path).join(";") +
              (d.sheet ? "#" + d.sheet : ""),
            properties,
          },
        ],
      },
      null,
      2,
    );
    review.push({
      contract: key,
      format: input.format,
      files: d.files,
      sheet: d.sheet,
      sampledRows: d.sampledRows,
      truncated: d.truncated,
      columns: d.columns,
      keysAccepted: false,
    });
  }
  artifacts["review.json"] = JSON.stringify(
    {
      sourceId: input.sourceId,
      sourceKind: input.sourceKind,
      format: input.format,
      evidence: "bounded-source-discovery",
      datasets: review,
      checks: [
        "Review sample scope and unknown/all-null types; text stays STRING without a declared schema",
        "Review keys and semantic types; sampled uniqueness is not a key",
        "Nested ODCS is preserved; native table authoring needs a reviewed flat projection",
        "File ingestion preserves bytes; schema discovery does not transform them",
      ],
    },
    null,
    2,
  );
  return {
    apiVersion: "ingestron.artifact-proposal/v1",
    artifacts,
    applied: false,
  };
}
const str = { type: "string", minLength: 1, maxLength: 512 };
export const sourceDefinition = {
  name: "discover source prepare",
  description:
    "Prepare a bounded SQL or format-specific file metadata reader; no source access inside the CLI.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["sourceId", "sourceKind"],
    properties: {
      sourceId: str,
      sourceKind: { enum: ["azure-sql", "adls"] },
      format: { enum: fileFormats },
      schemas: { type: "array", items: str },
      tables: { type: "array", items: str },
      sampleRows: { type: "integer" },
      datasets: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "paths"],
          properties: {
            name: str,
            paths: { type: "array", maxItems: 100, items: str },
            sheet: str,
            partitionColumns: { type: "array", maxItems: 20, items: str },
          },
        },
      },
    },
  },
};
export const fileMetadataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["apiVersion", "sourceId", "sourceKind", "format", "datasets"],
  properties: {
    apiVersion: { enum: ["ingestron.file-metadata/v1"] },
    sourceId: str,
    sourceKind: { enum: ["adls"] },
    format: { enum: fileFormats },
    datasets: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { type: "object" },
    },
  },
};
