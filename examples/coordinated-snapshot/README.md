# Build a SQL snapshot delivery across ADF and Databricks

You will generate three independently reviewable native exports from four flows:

| Export               | Flows              | Native output                           | Starts after                                             |
| -------------------- | ------------------ | --------------------------------------- | -------------------------------------------------------- |
| source/landing       | source             | Guarded ADF Copy pipeline               | A frozen source and its expected row count are available |
| publish/publisher    | publish            | Databricks publication notebook and job | Successful Copy run receipt                              |
| analytics/processing | current, reporting | One Lakeflow pipeline and refresh job   | Completed publication receipt and readable index         |

This is a synthetic offline example. Both environment profiles use placeholder
identities and development deployment settings. The profile called `prod` is a
configuration-resolution test, not a production deployment approval.

## Prerequisites

Use Node 22 and the current Ingestron CLI. No Azure or Databricks account is
needed to compile.
Copy this example to a fresh working directory and run there:

```sh
ingestron --no-input provider install ingestron/provider-adf/plugin/provider.yaml@4.3.1
ingestron --no-input provider install ingestron/provider-databricks/plugin/provider.yaml@3.2.0
ingestron --no-input plugin install ingestron/provider-adf/packs/sql-snapshot/pack.yaml@4.3.1
ingestron --no-input plugin check --delivery
ingestron --no-input build --delivery --out out
```

These commands use immutable Git tags. Maintainers can also rehearse
unreleased working copies with pnpm 10.15.0 and the following preparation script.

From the programme checkout containing the component repositories, run:

```sh
pnpm --dir repo/cli build
pnpm --dir repo/provider-adf build
pnpm --dir repo/provider-databricks build
node repo/provider-adf/scripts/prepare-coordinated-example.mjs repo/provider-databricks /tmp/ingestron-coordinated-example
node repo/cli/build/cli/cli/index.js --project /tmp/ingestron-coordinated-example --no-input plugin check --delivery
node repo/cli/build/cli/cli/index.js --project /tmp/ingestron-coordinated-example --no-input build --delivery --out out
```

Choose a new output directory if the temporary directory already exists. The
preparation script copies the exact built provider packages and rewrites only
package selectors to local paths. Installed Git package acceptance is separately
covered by the CLI's `pnpm package:providers:check`.

## Inspect the result

Open `out/ingestron-delivery.json`: it must contain three exports, ordered
source → publish → analytics, with `execution: not-run`. The analytics export
contains both the current/history ingestion and reporting sources. Its resource
configuration owns one pipeline; reporting must not replace that pipeline through
a separate partial export.

The snapshot preset `snapshots:strict` chooses `snapshot-land@v1` and rejects empty
snapshots by default. Project configuration supplies the linked services, ADLS
binding and destination. The pack adds no code. The publisher receives its source
root and reviewed contract from `retail.source.customers.snapshot`; current/history
receives the delivery index from `retail.publish.customers.completed`. You do not
repeat those storage paths in consumer flows.

`flow export current --group analytics` and `flow export reporting --group analytics`
set group ownership. `flow connect` adds a reviewed dependency; for ingestion use
`--table customers` to bind its source. Existing aliases are protected from replacement.
After editing, rerun `plugin check --delivery`. Remove the reporting export group
to see conflicting resource ownership rejected. Restore it to recover.

## Native run boundary

Compilation creates no files in ADLS and runs no platform jobs. Before any native
trial, review actual bindings, authorise the identities and network routes, freeze
the source, and establish retention and index permissions.

1. Deploy the reviewed exports using each platform's native tooling.
2. Run the ADF pipeline with the independently established expected row count.
   Retain its successful run ID, source capture time and ordered source version.
3. Invoke the exported publisher with the same run receipt, dataset identity,
   source root, contract version/shape and protocol described in its generated
   handover JSON. Authorise index initialisation only for the first publication.
4. Start the Lakeflow refresh only after successful publication. Verify current,
   history and reporting results against the frozen source.

A failed copy is unpublished. A failed or uncertain publication is recovered by
rerunning publication with the identical receipt; do not recopy. The publisher
verifies files, counts and keys and conditionally updates the index. An offline
handover declaration cannot prove source immutability or receipt truth. Native
permissions, concurrent writes, restart and consumer visibility remain acceptance
work in an authorised environment. There is no Ingestron live executor here.
