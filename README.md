# Ingestron Azure Data Factory provider

Generates native Azure Data Factory assets from reviewed Ingestron projects:
pipelines, datasets, linked-service references and parameter files for SQL
snapshots, metadata-driven Copy, immutable file copies and snapshot handover to
Databricks. Output is plain JSON you review, commit and deploy with your own
tooling.

The provider only generates files. It does not deploy to Azure, run pipelines or
connect to your data.

## Install

With the Ingestron CLI, inside a project:

```sh
ingestron provider install ingestron/provider-adf/plugin/provider.yaml@4.4.0
```

Then select the provider in a flow and run `ingestron check` and `ingestron build`.
See the [Ingestron documentation](https://docs.ingestron.io) for projects,
contracts and plugins.

## Contract quality rules

For `snapshot-land@v1` and `snapshot-to-databricks@v1`, ODCS library rules in the
contract (`nullValues`, `missingValues`, `invalidValues` with `validValues`,
`duplicateValues`, `rowCount`) and the rules implied by primary keys become one
native Lookup that counts each rule on the frozen source before Copy. An
IfCondition fails the pipeline with `INGESTRON_QUALITY_FAILED` when an
error-severity rule fails, so nothing is copied. Other results stay in the
Lookup output. No Data Flow is generated, no rows are skipped, and pattern rules
are rejected because SQL Server has no portable regular expressions. File copies
and metadata-driven snapshots do not check contract rules. Requires Ingestron core
0.12.11 or later.

## Guides

- [Standards](docs/standards.md)
- [Metadata-driven SQL snapshots](docs/metadata-pipelines.md)
- [External connectors on ADF Batch](docs/project-connections.md)
- [Reusable ADF compute](docs/compute-engine.md)
- [Publish a SQL snapshot for Databricks history](docs/snapshot-handover.md)

Examples are in [examples](examples). Their data is synthetic or comes from
public sample databases.

## Status

Generation is tested offline against synthetic projects. Deployment and execution
in a real Azure subscription have not been qualified by this repository; review
generated assets before deploying them.

## Develop

Use Node 22, pnpm 10.15.0 and Python 3.12. Create `.venv` from
`runtime/requirements.txt`, then run `pnpm install` and `pnpm validate`. The
`plugin` folder is build output; rebuild it with `pnpm build`.

## Licence

Apache-2.0, copyright Otrera Limited. Third-party material keeps its own terms;
see [NOTICE](NOTICE). Report security issues as described in [SECURITY.md](SECURITY.md).
