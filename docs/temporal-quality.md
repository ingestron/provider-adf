# Check native date and clock quality

The private 4.9.0 candidate generates typed allowed and missing values for contract
`DATE` and timezone-less microsecond `TIMESTAMP` columns. SQL snapshots use one
count-only quality Lookup before Copy. Physical source names are used in SQL;
logical contract names are used in the destination mapping. The published install
reference remains in the [README](../README.md).

For example, this contract field permits one precise clock value:

```yaml
name: event_time
physicalName: event
logicalType: timestamp
physicalType: TIMESTAMP
quality:
  - id: clock-valid
    metric: invalidValues
    arguments:
      validValues: ["2024-02-29T01:02:03.123456"]
    mustBe: 0
    severity: error
```

The candidate checks the Gregorian calendar and clock components before emitting
a literal. Use years 0001 through 9999, `YYYY-MM-DD` dates and clocks separated by
`T` or one space, with at most six fractional digits. MySQL values start at year 1000. Offsets, timezone suffixes, leap seconds, invalid dates, excess precision,
trailing newlines and non-string values never become typed literals. As with
portable library rules, incompatible listed values cannot match a row; an
allowed-value list with no compatible values counts every non-null row as invalid.
Nulls remain separate from allowed-value failures and count as missing values.

SQL Server and Azure SQL use explicit `CONVERT(date, ..., 112)` and
`CONVERT(datetime2(6), ..., 126)`. PostgreSQL, MySQL and Oracle use typed `DATE` and
`TIMESTAMP` literals. These literal rules do not establish that the source column
has the contract's native type. Review its catalogue and clock semantics first;
zoned or session-sensitive clocks and source precision above six require their
own policy. Oracle DATE columns can contain a time component. Native conversion,
ADF Parquet representation and Copy failure remain separate qualification tasks.

## Verify the private candidate

First run the [installed handover check](installed-native-acceptance.md). Set
`INGESTRON_ACCEPTANCE_FIXTURE` to its passed evidence JSON, retain the same installed
CLI package, and choose a fresh `INGESTRON_ACCEPTANCE_OUTPUT` and
`INGESTRON_ACCEPTANCE_PROOF`. Run `node scripts/temporal-acceptance.mjs` in the
provider directory. It verifies SDK, CLI and read-only MCP quality coverage,
typed SQL for all five source kinds, denied writes, failed preparation and exact
recovery. It retains the exact generated query assets and their hashes.

For synthetic database checks, set `INGESTRON_TEST_CONTAINERS=1` and run
`scripts/check-temporal-sqlserver.py` with the existing `mssql_python` test driver,
or `scripts/check-temporal-postgresql.py` with the existing `pg8000` test driver.
Both scripts take `--fixture` pointing to the passed temporal proof and `--proof`
for their result. They start a pinned loopback container, test exact generated
counts across three native session settings, and remove only their own container.
These checks execute synthetic queries. They do not run Copy, an ADF pipeline or
cloud deployment. MySQL and Oracle engine checks remain open.

Primary references, accessed 2026-10-04:

- [SQL Server explicit conversion styles](https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql)
- [PostgreSQL timestamp literals and timezone behaviour](https://www.postgresql.org/docs/18/datatype-datetime.html)
- [MySQL date and time literals](https://dev.mysql.com/doc/refman/8.4/en/date-and-time-literals.html)
- [Oracle datetime literals](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Literals.html)
