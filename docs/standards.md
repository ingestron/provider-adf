# ADF standards and acceptance

Status: versioned standards. Generation is tested offline; native execution is
not qualified by this repository.

| Standard                  | Source kinds                                     | Meaning                                                                                                                |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| snapshot-to-databricks@v1 | azure-sql, sql-server, postgresql, mysql, oracle | Frozen snapshot copy, count gate and invocation of the versioned native Databricks publisher                           |
| metadata-snapshot-land@v1 | azure-sql, sql-server                            | Reviewed catalogue, coordinator and reusable guarded snapshot worker                                                   |
| snapshot-land@v1          | azure-sql, sql-server, postgresql, mysql, oracle | Explicit frozen full-table source, selected contract columns, Parquet landing and expected-row-count gate              |
| watermark-append-land@v1  | azure-sql, sql-server                            | Bounded ordered immutable integer-key append, quality/count gates and atomic watermark plus committed-delivery journal |
| immutable-file-copy@v1    | adls, s3, gcs, sftp                              | One completed immutable file, binary-preserving copy into a new run folder                                             |

The table describes the current private candidate. The snapshot standards use the
source-specific SQL dialect. Read the [candidate temporal quality guide](temporal-quality.md)
for date and clock literals. `sharepoint-list-land@v1` reads SharePoint lists;
`app-land@v1` reads Salesforce objects or reviewed HubSpot table names. Those live
API/list standards do not claim a frozen snapshot or required contract quality.

Data Flow is forbidden for these standards; there is no silent fallback. A future
exception needs a named standard, necessity evidence, compute/network/cost
prerequisites and explicit opt-in. Change Tracking and CDC remain separately gated
capabilities. The candidate append standard has strict source-owner ordering
requirements; read [its setup and recovery guide](watermark-append.md).

Simple projects use the same standards as enterprise projects. Existing linked
services own authentication and integration-runtime selection; use managed
identity where supported, Key Vault references otherwise, and verify private
connectivity independently. Linked services, identities and infrastructure are not generated or deleted.
Legacy standards generate one pipeline per table with concurrency one; cross-pipeline source-load
limits, scheduling, alerts and deployment procedures require operator review.

The metadata standard instead shares product-owned pipelines/datasets within a
named compatible group. Read [its contract and recovery guide](metadata-pipelines.md).

Snapshot source consistency is an explicit frozen-extract commitment; row counts
do not establish business completeness or transaction consistency. Do not use
mutable tables. The independently known expectedRowCount is a required runtime
parameter, not a second live count query. Copy retries are disabled to avoid
reusing partial Parquet directories. Retry the whole pipeline into a fresh run
folder. Incomplete folders stay unpublished and require owner-managed retention.

The standalone landing standard does not publish a cumulative index. The new
`snapshot-to-databricks@v1` standard invokes a separately deployed native Databricks
publisher after the count gate. That publisher owns contract/key validation,
conditional index updates and ordered source receipts. See the
[paired workflow and recovery guide](snapshot-handover.md). The remaining native
acceptance gate is explicit; no enterprise-readiness claim is made.

Acceptance: deploy/redeploy into authorised Azure infrastructure; verify linked
services and effective identities, private runtime connectivity, count mismatches,
empty snapshots, failures during copy, new-run recovery, preserved binary content,
alerts and representative cost/volume. Test the publication adapter separately
before end-to-end Databricks acceptance. No platform was contacted in this work.

Primary sources, accessed 2026-09-12:

- https://learn.microsoft.com/en-us/azure/data-factory/connector-sql-server
- https://learn.microsoft.com/en-us/azure/data-factory/connector-azure-sql-database
- https://learn.microsoft.com/en-us/azure/data-factory/connector-azure-data-lake-storage
- https://learn.microsoft.com/en-us/azure/data-factory/connector-sftp
- https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-data-consistency
