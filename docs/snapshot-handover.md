# Publish a SQL snapshot for Databricks history

Use this offline workflow to copy a frozen SQL table into ADLS, verify
its landed contents on Databricks, and publish the completed delivery for a
separate Lakeflow history consumer. The same ADF provider still supports simple
landing-only projects without a Databricks dependency.

The user is an Azure data engineer with existing ADF, SQL, ADLS and Databricks
resources. Allow about 20 minutes for local configuration and generation; this is
an estimate, not a native deployment benchmark. Native execution and enterprise
acceptance are not yet proven. ADF Copy, Databricks compute and storage operations
use the customer's existing billing; this guide does not authorise deployment.

## Before you start

Use Node 22, the current Ingestron CLI, and this provider together with the
[Databricks provider](https://github.com/ingestron/provider-databricks). Start from the
[ADF project](../examples/snapshot-handover/project.yaml), the Databricks
provider's `examples/snapshot-publication/project.yaml`, and its
`examples/snapshot-history-from-adf/project.yaml`. The projects deliberately use
the same `retail.source.customers` dataset identity and reviewed column contract.

For native acceptance, gather these existing resource references:

| Value                             | Where to obtain it                          | How it is used                                                                                    |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ADF factory name                  | Azure portal, Data Factory overview         | Deployment target; safe to store as configuration                                                 |
| `source_sql`, `landing_adls`      | ADF Manage, Linked services                 | Existing authenticated SQL and ADLS connections, including integration-runtime routing            |
| Storage account and filesystem    | Storage account overview and container list | Must match the landing linked service and publisher/consumer source root                          |
| `publisher_databricks`            | ADF Databricks linked service               | Selects existing compute and the identity running the notebook                                    |
| Publisher notebook path           | The deployed Databricks job's notebook task | Copy the actual workspace path into `values.publisherNotebook`; the example is only a placeholder |
| Publisher secret-scope references | Databricks secret-scope administrator       | References only; values never belong in project YAML or ADF parameters                            |

The Databricks provider owns [publication setup and permissions](https://github.com/ingestron/provider-databricks/blob/main/docs/snapshot-publication.md).
The identity configured in an ADF linked service is distinct from a generated
Databricks job's run-as identity. Job run-as does not govern direct ADF notebook
invocations. Accept permissions for each actual execution route.

Keep the SQL source frozen during Copy. Keep completed landing directories
immutable after Copy. Row counts do not prove business completeness, so the source
owner must supply a truthful full-table snapshot and its expected count.

## Generate the three exports locally

1. Copy each example project into its own directory. Replace environment resource
   references in `project.yaml`; preserve identical dataset, columns, contract
   version and ADLS source roots across the projects.
2. In the ADF project directory, run:

   ```sh
   ingestron plugin install adf@2.0.0
   ingestron validate
   ingestron plan --out build/plan.json
   ingestron generate --plan build/plan.json --out build/adf
   ingestron validate-output build/adf
   ```

   Expect two datasets, a Copy/count/publication pipeline, and a separate
   `retail_source_customers_publish` recovery pipeline. The ARM template only
   creates project-owned datasets and pipelines; linked services and the factory
   remain existing references. No Data Flow is generated.

3. In both Databricks project directories, install provider 2.0.0 and run the same
   validate/plan/generate sequence, choosing `build/databricks` as the output.
   The publication export includes a native notebook, a job on the declared
   existing cluster, and `handover/retail_source_customers.json`. The consumer
   export contains the Lakeflow snapshot/history definition.
4. Compare `dataset`, `sourceRoot`, `deliveryIndex` and `contractVersion` in the ADF
   and publisher handover files. Expected index suffix:
   `retail/source/customers/_ingestron/deliveries.json`. Commit each project's
   `packages.lock.yaml`; use `--frozen` for repeat installs in CI.

For a local repository checkout, add `--from-git /absolute/path/to/provider-adf`
or the Databricks equivalent to the install command. Generation remains offline.

## Native acceptance sequence

Perform these steps only in separately authorised development infrastructure.

1. Prepare the existing identities, private connectivity, secret references and
   protected `_ingestron` directory using the publisher guide. Import/deploy the
   publisher export and verify its actual notebook path. Configure that path in
   ADF and regenerate if needed. Use incremental ARM deployment; never complete
   mode against a shared factory.
2. Use the [synthetic SQL fixture](../examples/snapshot-handover/source-fixture.sql)
   in a scratch database. Confirm the frozen table contains the two expected rows.
3. Run `retail_source_customers` in ADF with a source-issued `deliveryId`,
   `version: 1`, a timezone-bearing `capturedAt`, `expectedRowCount: 2` and
   `initialiseIndex: true`. This last flag is only for first-time index creation;
   leave it false for normal and recovery runs.
4. Verify Copy, VerifyCount and Publish all succeed. Read the index using an
   authorised storage viewer. Expect one entry with version 1, rowCount 2,
   complete true, scope full-table and the exact Copy run directory. The index
   contains no customer rows. It is written only after schema, required values
   and unique keys have passed.
5. Start the separately configured Lakeflow consumer. Expect the two current
   customer rows and their history. This is the first native proof; a local
   generated-file check alone does not establish it.

For a second snapshot, use a new source delivery ID, version 2 and a non-decreasing
capture time. Change only the scratch source between runs. The index must retain
version 1 as well as version 2. A new consumer can replay both versions.

## Recover without copying again

If publication fails after Copy, record the original Copy pipeline `RunId` and
original source parameters. Run `retail_source_customers_publish` with that
`runId`, identical delivery metadata and `initialiseIndex: false`. It contains no
Copy activity. If the first publication committed but its response was lost,
recovery returns `already-published` and leaves the index unchanged.

An initialisation response lost after commit is also recovered with false. If no
index was created at all, explicitly confirm this is a new dataset before retrying
initialisation. Never initialise a missing historical index; restore its protected
backup and reconcile the highest source version.

Do not restart the full Copy pipeline to recover an already published delivery:
a new RunId is a different path and conflicts with that delivery's immutable
receipt. For Copy failures before any publication, a new copy attempt is allowed,
provided the source still represents the same frozen snapshot. Only its successful
run path may subsequently be published.

## Diagnose failures and clean up

| Symptom                                                    | Safe action                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Count mismatch, null key, duplicate key or schema mismatch | Inspect synthetic/native validation evidence; correct the source/contract before retrying. No index is updated.       |
| Notebook identity, source root or contract mismatch        | Compare the generated handover and deployed notebook. Never bypass the identity check.                                |
| Missing/out-of-order version                               | Publish or recover the missing source version first. Do not renumber snapshots to hide a gap.                         |
| Existing ID/version/path with different metadata           | Read the committed receipt and recover using its exact metadata. Do not overwrite it.                                 |
| Authentication/private routing failure                     | Check the actual ADF execution identity, secret permissions, Spark source access and Blob endpoint access separately. |
| Index missing or retention/size limit reached              | Stop publication; restore/reconcile or design an explicit migration. Do not truncate retained entries.                |

As a safe failure exercise, give the scratch first run an incorrect expected count.
It must fail VerifyCount and leave the index unchanged. Then test a publication-only
retry twice with identical metadata; the second call must not add a receipt.

Clean up only named scratch assets after stopping their triggers/jobs. Preserve
completed landing data, index backups and consumer checkpoints while replay is
required. This standard does not delete or overwrite another product's resources.
For limits and the source capability matrix, see [ADF standards](standards.md).
