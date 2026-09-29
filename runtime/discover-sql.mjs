// Explicit customer-side catalogue reader; never runs inside the compiler.
import sql from "mssql";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: { connections: { type: "string" }, out: { type: "string" } },
});
let pool;
try {
  if (!values.connections || !values.out || existsSync(values.out))
    throw Error("Supply --connections and a new --out path");
  const config = JSON.parse(
    readFileSync(new URL("./discovery.json", import.meta.url), "utf8"),
  );
  const c = JSON.parse(readFileSync(values.connections, "utf8")).sql;
  if (
    !/^[a-z0-9-]+\.database\.windows\.net$/.test(c.server) ||
    c.encrypt !== true ||
    c.trustServerCertificate !== false
  )
    throw Error("Expected encrypted Azure SQL connection");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      pool = await new sql.ConnectionPool({
        server: c.server,
        port: c.port ?? 1433,
        database: c.database,
        user: c.user,
        password: c.password,
        options: { encrypt: true, trustServerCertificate: false },
        connectionTimeout: 120000,
        requestTimeout: 120000,
        pool: { min: 0, max: 1, idleTimeoutMillis: 1000 },
      }).connect();
      break;
    } catch {
      if (attempt === 2)
        throw Error(
          "SQL connection failed; check access or free-offer availability",
        );
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  const rows = (
    await pool
      .request()
      .query(
        readFileSync(new URL("./metadata-query.sql", import.meta.url), "utf8"),
      )
  ).recordset;
  if (!rows.length || rows.length > 10000)
    throw Error("Catalogue empty or exceeds 10000 columns; narrow scope");
  const payload = JSON.stringify(
    { sourceId: config.sourceId, sourceKind: "azure-sql", rows },
    null,
    2,
  );
  if (Buffer.byteLength(payload) > 1900000)
    throw Error("Metadata exceeds CLI input size");
  writeFileSync(values.out, payload + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      metadata: values.out,
      columns: rows.length,
      tables: new Set(rows.map((r) => r.schema_name + "." + r.table_name)).size,
    }),
  );
} catch {
  console.error(
    "SQL discovery failed; verify connection, database availability, catalogue scope and output path. Credentials suppressed.",
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}
