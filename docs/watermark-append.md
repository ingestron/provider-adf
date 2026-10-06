# Native SQL append batches

`watermark-append-land@v1` is a candidate standard in provider 4.8.0. It generates
ADF coordinator and batch pipelines, Parquet datasets, and an Azure SQL control
script. Generation does not apply SQL, deploy assets, connect to a source, or
qualify cloud execution. Keep the public 4.7.0 installation until the candidate
release is accepted.

Use this standard only when the source owner guarantees an immutable, committed,
ordered append table. Every later commit must use a key greater than every
previous committed key. The watermark must be the sole non-null integer physical
primary key and match the reviewed contract. Updates, deletes, reused keys, late
commits with smaller keys, timestamps, composite keys and CDC are unsupported.
They require a different ingestion standard.

## Configure and review

Set `ingestion.standard` to `watermark-append-land@v1`. Configure the existing
landing linked service, ADLS filesystem and path as with SQL snapshots. Configure
`ingestion.watermark` with:

| Setting                | Meaning                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `column`               | Sole required integer contract primary key                                     |
| `initial`              | Canonical non-negative signed int64 **string**, such as `"0"`; it is exclusive |
| `batchSize`            | Maximum rows per run, from 1 to 1,000,000                                      |
| `namespace`            | Explicit reviewed state identity, separate for a changed plan                  |
| `consistency`          | `ordered-committed-append` source-owner commitment                             |
| `controlLinkedService` | Existing Azure SQL linked service for a dedicated control database             |

The source definition also requires `consistency: ordered-committed-append`.
A table may override only `column`, `initial` and `batchSize` under
`tables.<table>.ingestion.watermark`. Namespace, consistency and control ownership
stay at flow level. An initial `"0"` does not ingest a source row with key zero;
review this exclusion before activation.

Review the exact generated plan digest and
`sql/ingestron-watermark-control-v1.sql`. Apply the SQL separately to the control
database through your reviewed deployment process. It creates versioned
`dbo.IngestronWatermarkV1` and `dbo.IngestronDeliveryV1` tables and read, validate
and commit procedures. Reapplication never resets state. Grant the ADF control
identity EXECUTE on the three procedures. Journal consumers need SELECT on the
journal; direct state writes are an independently reviewed migration operation.
Review the two pipelines and three datasets owned per table before incremental
ARM deployment. Existing linked services remain references.

## One run

The coordinator reads the committed cursor and verifies the actual source key.
It selects at most `batchSize` keys above that cursor and returns the upper bound
as an exact decimal string. No new keys means successful completion without Copy
or publication. Otherwise it invokes the batch worker with both cursor strings
and the original coordinator run ID.

The worker validates canonical parameters and the current checkpoint in SQL
before constructing a source query. It verifies the physical key again, counts
only the selected window and checks the contract's library quality rules there.
It rejects empty or oversized batches. Error rules fail before Copy; warning
metrics are calculated but do not stop delivery. Custom SQL and pattern rules are
rejected. Primary-key quality is included.

Copy projects only reviewed contract columns into a fresh original-run folder.
Incompatible-row skipping and type conversion are disabled. Both `rowsRead` and
`rowsCopied` must equal the bounded source count. The final SQL transaction
compares the prior cursor, updates it and inserts the committed delivery record
atomically. A conflicting or failed run publishes nothing.

## Recovery and publication

Consumers must use committed journal entries to find published landing folders.
Listing every ADLS folder includes incomplete or losing-run files and does not
establish delivery. The handover JSON names the dataset identity, plan digest,
control journal and landing prefix; its execution status stays `not-run` during
generation.

Retry a failed coordinator as a new run. A failed copy leaves its folder
unpublished and its cursor unchanged. Copy activity retries are disabled.
If commit succeeded but its response was lost, a new coordinator reads the
advanced cursor. Repeating the commit procedure with the exact original run ID,
cursors, row count and landing path is idempotent. Reusing that run ID with
changed evidence fails. Do not rerun the worker into the original landing folder.
Unpublished-folder retention is an operator-owned procedure.

Checkpoint identity contains namespace, project, environment, flow and table.
The reviewed plan digest fences reuse. Changing the plan, source, contract or
policy must not silently reset or reuse state: review a separate namespace and
initial cursor, or prepare and approve an explicit migration. A new namespace
can replay earlier data if its initial value is wrong. There is no automatic
migration or cumulative replay deduplication across namespaces.

## Qualification

Run the normal provider validation, installed CLI/Studio generation acceptance
and the opt-in `scripts/check-watermark-sqlserver.py` harness against the generated
SQL file. The SQL harness uses a pinned local SQL Server Developer container and
synthetic state to test exact int64 cursors, replay, competing writers and rollback
after a failed journal insert. It does not prove ADF cloud execution.

Before cloud activation, qualify native deployment and redeployment, existing
linked-service identities and private connectivity, source-owner ordering,
empty batches, quality failure, interrupted Copy, count mismatch, lost commit
response, concurrent coordinators, journal consumers and expected volume/cost in
an authorised isolated Azure environment.

Platform references checked 2026-10-04:

- [ADF nested activity limits](https://learn.microsoft.com/en-us/azure/data-factory/concepts-nested-activities)
- [ADF Execute Pipeline](https://learn.microsoft.com/en-us/azure/data-factory/control-flow-execute-pipeline-activity)
- [Azure SQL source procedure parameters](https://learn.microsoft.com/en-us/azure/data-factory/connector-azure-sql-database)
- [SQL XACT_ABORT](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-xact-abort-transact-sql)
