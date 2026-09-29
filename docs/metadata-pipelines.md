# Metadata-driven SQL snapshots

ADF 2.4.0 adds `metadata-snapshot-land@v1`. It generates one coordinator, one Copy
worker and two parameterised datasets per named compatible group. Thirteen tables
can use four native resources; their thirteen contracts remain separate.

## Configuration

```yaml
ingestion:
  standard: metadata-snapshot-land@v1
  group: northwind
  parallelism: 2
  allowEmpty: false
  target:
    linkedService: landing_adls
    fileSystem: landing
    path: northwind
```

Keep source kind, linked services, timeout and parallelism identical within a
group. Different SQL schemas/tables, column mappings, landing paths/filesystems
and empty policies are allowed. Use another group for another connection or
connector. Group names must be safe identifiers; generated resource names must
fit the provider's 101-character bound. A group has at most 100 tables and a
200,000-character embedded catalogue. Parallelism is 1–16, default 2.

Flows sharing a group must share an export. The lifecycle model declares all
four native resources for every member so the CLI detects conflicting exports.
Different groups get separate resources. Never reuse a product ID/group name to
manage another product's resources in the same factory. Metadata and legacy
standards require separate exports. Group settings are validated even when the
flows have different allow-empty policies.

The [example](../examples/metadata-snapshot/project.yaml) uses two populated
tables and an explicitly empty table in two flows, sharing one export/group.

## What runs

For project `demo`, group `northwind`, the names are:

- `demo_md_northwind_run`: validates the selection/counts, then ForEach invokes workers.
- `demo_md_northwind_worker`: validates a table ID/count, copies and checks rows copied.
- `demo_md_northwind_sql`: fixed SQL linked service, parameterised schema/table.
- `demo_md_northwind_parquet`: fixed ADLS linked service, parameterised destination.

The compiler embeds an immutable-by-parameters catalogue in each pipeline's
variables. Each entry is keyed by `flow/table` and contains the reviewed query,
explicit translator, target location and minimum row count. There is no runtime
control database or editable blob. `metadata/<group>.json` is an inspection
artefact; editing it does not change the deployed pipeline. Change the project or
model, rebuild and review the deployment to change the catalogue.

Call the coordinator with selected IDs and independently established counts:

```json
{
  "tables": ["source/customers", "empty/demographics"],
  "expectedCounts": { "source/customers": 91, "empty/demographics": 0 }
}
```

These numbers illustrate the request shape, not a fresh source receipt. The
generated parameters example uses null counts deliberately: replace them with
verified values. Omit `tables` to select all compiled members. Empty, duplicate
or unknown selections, missing counts and invalid counts fail before any worker
is launched. Counts must represent integers from zero to 2,147,483,647, with zero
allowed only by the table's reviewed policy. Unused count entries do not add
tables to the selection. A malformed expression input may produce an ADF type
error instead of the provider's friendly Fail message; both stop before copying.

The worker accepts only `tableId` and `expectedRowCount`. SQL, mappings, identities
and paths cannot be supplied as execution parameters. Calling the worker directly
still validates the ID and count policy. Callers with ADF edit/deploy permission
can change pipelines; this design does not replace Azure authorisation.

The coordinator has concurrency one; ForEach and workers use the group's
parallelism. Multiple groups, direct worker runs and other products still need an
operator-reviewed total source-load budget. There are no shared mutable loop
variables. All worker calls wait for completion. Copy retries are zero; secure
input/output is retained for Copy and orchestration passes no data rows.

## Completion and recovery

Every worker writes `target.path/flow/table/<worker RunId>/`. Obtain the worker
run ID from its ExecutePipeline activity output or ADF monitoring. The coordinator
run ID is not the landing folder ID. A folder is eligible only when the **whole
worker** succeeds, including VerifyCount. A copied folder from a failed count
check remains incomplete and must not be consumed.

To retry one table, call the worker with its ID and a fresh independently verified
count, or select only that ID in a new coordinator run. The new worker run gets a
new folder. Retain the original failed receipt; do not overwrite its data. A failed
coordinator can have successful children: there is no atomic group commit,
cumulative delivery index, deduplication or automatic rollback. Avoid recopying
already consumed tables unless the downstream process handles duplicates.

Frozen-source consistency is still required throughout each extraction. Cross-table
transaction consistency is the operator's responsibility. Counts are not proof of
keys, nullability or business completeness. SQL BINARY remains rejected; Northwind
uses the explicit Categories/Employees tabular projections. Zero-row delivery may
have no physical file. No metadata-standard handover/publication protocol, CDC,
REST extraction, schedules, alerts or retention jobs are implemented.

## Ownership, migration and provider author requirements

`snapshot-land@v1` output is unchanged. Opt in explicitly; deploy the new names
incrementally into the existing factory. Preserve old resources and run folders.
Stop old triggers before routing new requests to the coordinator; compare the
native results before retiring anything. The compiler does not delete old Azure
assets. Always build the complete group for deployment: a table-filtered build
contains only selected metadata and would replace that group's deployed catalogue.

Data models remain provider-independent. Provider authors
implement connector semantics, resource grouping/claims, reviewed metadata
translation, parameter validation, deterministic output and native recovery.
Models/preset packs cannot execute code or introduce new runtime connectors.
Future metadata backends must maintain the same review/version boundary; arbitrary
control-table edits must not silently acquire deployment authority. New source
kinds require their own tested mappings, authentication and failure evidence.

The decision selects embedded reviewed metadata because it requires no extra
service and preserves the existing compiler review boundary. A runtime control
database is a possible later standard with its own authority and compatibility
contract. Sharing only datasets would reduce inventory but retain one pipeline
per table; this opt-in standard implements the fuller reusable-worker approach
requested by the owner. Legacy users do not inherit the new runtime behaviour.

Sources accessed 2026-09-14: [ForEach](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-for-each-activity),
[Execute Pipeline](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-execute-pipeline-activity),
[parameterised mappings](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-schema-and-type-mapping).
