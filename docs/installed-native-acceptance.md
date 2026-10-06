# Check installed native handovers

Use immutable installed CLI/core packages and a local Databricks 3.8.0 candidate
snapshot to check ADF mapping, file publication and history together. This local
candidate check generates synthetic assets. It does not connect to SQL, Azure,
Databricks or source storage.

In this provider directory, set `INGESTRON_ACCEPTANCE_CLI_PACKAGE` to the installed
`ingestron` package directory, `INGESTRON_ACCEPTANCE_OUTPUT` to a fresh output
directory and `INGESTRON_ACCEPTANCE_PEER_PROVIDER` to the clean local Databricks
snapshot tagged 3.8.0. Run `pnpm build`, then `pnpm acceptance`.
The runner creates its own immutable ADF snapshot. It accepts qualified installed
CLI/core pairs only and retains TAP output and `native-acceptance.json`. Set
`INGESTRON_ACCEPTANCE_PROOF` to save another copy of the proof.

The journey copies physical source names to contract output names, checks that the
Parquet handover declares those names, publishes the same completion identity and
feeds its reviewed contract to native history. It also rejects a consumer still
using the original physical schema and preserves the last prepared delivery.
Generated resources reference existing identities and infrastructure; there is no
deployment or execution step. Native routing, permissions and recovery still need
separate workspace qualification.

## Check the private scheduling candidate

The scheduling harness checks a private core0.12.21/CLI0.17.10 pair with a locked
ADF4.10.0 snapshot. Use separate immutable package archives and a local snapshot;
these candidates are not public install references.

Set `INGESTRON_ACCEPTANCE_CLI_PACKAGE` to the installed CLI package directory,
`INGESTRON_ACCEPTANCE_PROVIDER` to the local tagged provider snapshot,
`INGESTRON_ACCEPTANCE_EXAMPLE` to `examples/sql-snapshot/project.yaml`,
`INGESTRON_ACCEPTANCE_OUTPUT` to a fresh directory and
`INGESTRON_ACCEPTANCE_PROOF` to a receipt path. Set
`INGESTRON_ACCEPTANCE_CORE_ARCHIVE` and `INGESTRON_ACCEPTANCE_CLI_ARCHIVE` to those
immutable archives. `INGESTRON_ACCEPTANCE_OLD_CLI` points to an older installed CLI
whose compiler lacks the required schedule resource-claim feature.
Run `node scripts/schedules-acceptance.mjs` from this provider directory.

The harness reviews all four recurrences through the SDK, CLI and read-only MCP,
checks the assembled native assets, refuses partial flows and unsupported policies,
and confirms an older host rejects the provider before generation. It does not
connect to the manifest view or copied source.

To check the exact installed count-manifest query on a temporary SQL Server,
use Python3.12 with `mssql_python`, a local Docker engine and the pinned official
Developer image. Set `INGESTRON_TEST_CONTAINERS=1`; set
`INGESTRON_DOCKER_CONTEXT` if your test engine uses a named Docker context. Run:

```sh
python scripts/check-schedule-manifest-sqlserver.py \
  --fixture /path/to/scheduling-receipt.json \
  --proof /path/to/sqlserver-receipt.json
```

This opt-in check covers fresh counts, exact IDs, missing/duplicate rows, invalid
counts and read-only permissions. It removes its own container and preserves
pre-existing containers. It does not qualify publication-input queries, frozen
source consistency, ADF Lookup/Copy, trigger clocks or recurring execution.
