# Publish a SQL snapshot for Databricks history

Prepare native ADF Copy, a Databricks publication notebook and a Lakeflow history
consumer for a frozen SQL snapshot. Generation is local; running the assets uses
your existing platform identities and infrastructure.

Start with the [ADF handover example](../examples/snapshot-handover/project.yaml),
Databricks provider `examples/snapshot-publication/project.yaml` and
`examples/snapshot-history-from-adf/project.yaml`. The three projects declare the
same `retail.source.customers` dataset, reviewed fields and version. Use Node 22
and the current Ingestron CLI. Public examples reference ADF 4.7.0 and Databricks
3.7.0. The separately labelled private candidate adds mapped handover contract
checks; its [installed acceptance](installed-native-acceptance.md) uses locked local
snapshots rather than public installation.

## Configure and generate

1. Copy each example to its own directory. Set existing factory, linked-service,
   storage, workspace, compute and secret-scope references in each project. Keep
   the SQL source frozen during Copy and completed landing directories immutable.
   The source owner must supply the full-table scope and truthful expected count.
2. In the ADF example directory, run:

   ```sh
   ingestron plugin install ingestron/provider-adf/plugin/provider.yaml@4.7.0
   ingestron doctor
   ingestron plan --out build/plan.json
   ingestron generate --plan build/plan.json --out build/adf
   ingestron validate-output build/adf
   ```

   Expect project-owned datasets, a Copy/count/publication pipeline and a separate
   publication recovery pipeline. The existing factory and linked services are
   references. No Data Flow is generated.

3. In each Databricks example directory, install
   `ingestron/provider-databricks/plugin/provider.yaml@3.7.0` and run the same
   doctor/plan/generate/validate-output sequence with `build/databricks` as output.
   Publication generates a native notebook and a job on declared existing
   compute. History generates the Lakeflow snapshot/SCD2 definition.
4. Compare dataset identity, source root, delivery index and contract version in
   the generated handover files. The index ends in
   `retail/source/customers/_ingestron/deliveries.json`. Commit each package lock.
   Use the [coordinated example](../examples/coordinated-snapshot/project.yaml) to
   review the three exports as one dependency graph.

Mappings apply during Copy: Parquet fields use the contract `name`, while SQL reads
use `physicalName`. The private candidate declares those output names in its file
handover contract. Review the same output contract for publisher and history;
reusing a source contract with stale physical aliases is rejected. SQL quality
checks still evaluate the frozen source before copying.

## Execute and recover in your authorised workspace

Configure storage access and publication using the Databricks provider's
[publication guide](https://github.com/ingestron/provider-databricks/blob/main/docs/snapshot-publication.md).
The ADF linked-service identity and generated Databricks job run-as identity can
be different; qualify the identity for the route you actually run. Protect index
write access and retain immutable landing data and receipt entries.

Deploy/import the publisher first and set its actual notebook path in ADF.
Use incremental ARM deployment against the existing factory. Run Copy with the
reviewed source delivery identity, version, captured time and expected count.
Publish only after Copy/count checks succeed, then run the history consumer.
The initial index requires an explicit first-publication choice; recovery reuses
the same completed copy run and receipt instead of copying again.

If publication fails after a completed copy, run the separate recovery pipeline
with the original receipt. It reuses existing immutable files. If history fails,
repair the source/rule and rerun the native consumer. Missing keys in an accepted
complete snapshot expire current rows; partial snapshots and unapproved empty
snapshots must be rejected. Lost indexes require restoring retained metadata,
not silently starting a new baseline.

Local checks do not establish native permissions, connectivity, concurrency,
restart or recovery. Qualify those behaviours with synthetic data in your
separately authorised development workspace before production use.
