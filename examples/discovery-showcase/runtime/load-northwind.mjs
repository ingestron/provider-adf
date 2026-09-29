// Explicit customer-side sample loading. Never imported by the compiler or tests.
import sql from "mssql";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    server: { type: "string" },
    database: { type: "string" },
    subscription: { type: "string" },
    script: { type: "string" },
    factory: { type: "string" },
    "approve-empty-database": { type: "string" },
  },
});
let pool;
try {
  if (
    !/^[a-z0-9-]+\.database\.windows\.net$/.test(values.server ?? "") ||
    !/^[A-Za-z0-9_-]+$/.test(values.database ?? "") ||
    !/^[A-Za-z0-9-]+$/.test(values.factory ?? "") ||
    !/^[a-f0-9-]{36}$/i.test(values.subscription ?? "") ||
    values["approve-empty-database"] !== values.database
  )
    throw new Error(
      "Supply server, database, subscription, script, factory and --approve-empty-database matching the dedicated new database",
    );
  const lock = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../public-data.lock.json", import.meta.url)),
      "utf8",
    ),
  );
  const script = readFileSync(values.script);
  if (
    createHash("sha256").update(script).digest("hex") !==
    lock.sources.find((s) => s.id === "northwind-azure").sha256
  )
    throw new Error("Northwind source checksum mismatch");
  const source = script.toString("utf8");
  if (/^\s*(USE\s|CREATE\s+DATABASE|DROP\s+DATABASE)/im.test(source))
    throw new Error("Sample must not switch/create/drop databases");
  // Token stays in memory; never printed or written to an artifact.
  const token = JSON.parse(
    execFileSync(
      "az",
      [
        "account",
        "get-access-token",
        "--subscription",
        values.subscription,
        "--resource",
        "https://database.windows.net/",
        "--output",
        "json",
      ],
      { encoding: "utf8" },
    ),
  ).accessToken;
  pool = await new sql.ConnectionPool({
    server: values.server,
    database: values.database,
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token },
    },
    options: { encrypt: true, trustServerCertificate: false },
    requestTimeout: 120000,
    pool: { max: 1, min: 1 },
  }).connect();
  const tables = await pool
    .request()
    .query("SELECT COUNT(*) AS count FROM sys.tables WHERE is_ms_shipped=0");
  if (tables.recordset[0].count !== 0)
    throw new Error("Database is not empty; refusing sample SQL");
  const batches = source.split(/^\s*GO\s*$/im).filter((s) => s.trim());
  for (const batch of batches) await pool.request().batch(batch);
  const factory = values.factory;
  await pool
    .request()
    .batch(
      `IF DATABASE_PRINCIPAL_ID(N'${factory}') IS NULL CREATE USER [${factory}] FROM EXTERNAL PROVIDER; GRANT VIEW DEFINITION TO [${factory}];`,
    );
  const result = await pool
    .request()
    .query("SELECT COUNT(*) AS tables FROM sys.tables WHERE is_ms_shipped=0");
  console.log(
    JSON.stringify({
      database: values.database,
      tables: result.recordset[0].tables,
      metadataIdentity: factory,
      permission: "VIEW DEFINITION",
      dataSource: "checksum-pinned Microsoft Northwind",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}
