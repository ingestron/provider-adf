/** Relational sources for SQL snapshot standards (PB-064 phase 2).
 *
 * Each kind maps to its ADF dataset and Copy source types, the query property
 * that source uses and the SQL dialect for identifiers and quality checks.
 * Types follow the current connector versions (PostgreSQL V2, MySQL 2.0,
 * Oracle 2.0); linked services are customer-owned and referenced by name.
 */
import { dialects } from "./quality.mjs";

export const sqlSources = {
  "azure-sql": {
    dataset: "AzureSqlTable",
    source: "AzureSqlSource",
    query: "sqlReaderQuery",
    dialect: "tsql",
    options: { partitionOption: "None" },
    table: (s) => ({ schema: s.schema, table: s.table }),
  },
  "sql-server": {
    dataset: "SqlServerTable",
    source: "SqlSource",
    query: "sqlReaderQuery",
    dialect: "tsql",
    options: { partitionOption: "None" },
    table: (s) => ({ schema: s.schema, table: s.table }),
  },
  postgresql: {
    dataset: "PostgreSqlV2Table",
    source: "PostgreSqlV2Source",
    query: "query",
    dialect: "postgres",
    options: {},
    table: (s) => ({ schema: s.schema, table: s.table }),
  },
  mysql: {
    dataset: "MySqlTable",
    source: "MySqlSource",
    query: "query",
    dialect: "mysql",
    options: {},
    // MySQL has no schema below the database; `schema` names the database.
    table: (s) => ({ tableName: s.table }),
  },
  oracle: {
    dataset: "OracleTable",
    source: "OracleSource",
    query: "oracleReaderQuery",
    dialect: "oracle",
    options: {},
    table: (s) => ({ schema: s.schema, table: s.table }),
  },
};

export const sqlKinds = Object.keys(sqlSources);

/** The reviewed projection as a query in the source's dialect. */
export function selectQuery(kind, columns, schema, table) {
  const { quote } = dialects[sqlSources[kind].dialect];
  return `SELECT ${columns.map((c) => quote(c.name)).join(", ")} FROM ${quote(schema)}.${quote(table)}`;
}
