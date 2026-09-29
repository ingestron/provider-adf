# Discover source schemas and draft data contracts

For Azure data engineers reviewing a source before designing ingestion. This example
turns scoped database catalogue metadata into draft ODCS contracts.
Install this provider with `ingestron provider install ingestron/provider-adf/plugin/provider.yaml@4.3.0`. Start with the offline fixtures (about 10 minutes);
live setup needs an authorised Azure subscription and typically 30–60 minutes plus
resource/identity propagation.

## Choose a showcase

| Example             | Data and connection                                                                | What it demonstrates                                                              |
| ------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `northwind_azure`   | Microsoft Northwind, Azure SQL, factory managed identity                           | Customers/orders/products, decimals, nullable columns and composite declared keys |
| `northwind_private` | Northwind on SQL Server, SQL authentication through Key Vault and a self-hosted IR | The same business data behind a private connection boundary                       |
| `pagila`            | Pagila PostgreSQL V2, Basic authentication through Key Vault and a self-hosted IR  | Customer/rental/payment metadata and PostgreSQL type differences                  |

[Public data lock](public-data.lock.json) pins upstream commits and SHA-256 digests.
[Microsoft MIT notice](licenses/microsoft-MIT.txt) and
[Pagila notice](licenses/pagila-PostgreSQL.txt) accompany the sources. Download using
`python3 fetch-public-data.py --out /your/new/download-directory`. The fetcher does
not load SQL. Upstream scripts can drop objects; review and load only into a new,
verified-empty demo database. The checked-in metadata fixtures are manually authored
interface samples, not evidence of a live source query.

## Try the offline contract journey

In a new project directory:

```sh
ingestron plugin install adf@2.3.1
ingestron init --id showcase --provider adf@2.1.1 --environments dev
```

Copy `northwind_azure/prepare.json` and `northwind_azure/metadata-fixture.json`
from this example into that directory. `default` is the provider configuration
created by init. Adjust it if your project uses another configuration name.

```sh
ingestron provider default discover prepare --input prepare.json --out build/discovery-result.json
ingestron providers export --result build/discovery-result.json --out discovery --dry-run
ingestron providers export --result build/discovery-result.json --out discovery
ingestron provider default discover contracts --input metadata-fixture.json --out build/contract-result.json
ingestron providers export --result build/contract-result.json --out contracts --dry-run
ingestron providers export --result build/contract-result.json --out contracts
```

Expected: `discovery/template.json`, a catalogue query and `deploy.py`; draft
`contracts/*.odcs.json` plus `review.json`. The CLI validates ODCS before exporting.
Saved result files and exported artifacts are not overwritten; choose a new path for
each review. Review keys, source visibility, types, precision and timezones before
using `table add --contract <reviewed-file>`. Set `acceptDeclaredKeys: true` in the
metadata request only after accepting the declared database keys for the contract.
Business keys are not inferred. No source data or SQL is executed by these commands.

## Load the optional Azure SQL demo

After approving and deploying the foundation, install the sample loader's isolated
Node 22 dependency with `pnpm --dir runtime install --frozen-lockfile`. With an Azure
CLI login for the configured SQL Entra administrator, run:

```sh
node runtime/load-northwind.mjs --server <server>.database.windows.net --database northwind --subscription <uuid> --script /download/northwind-azure.sql --factory <factory-name> --approve-empty-database northwind
```

The loader verifies the pinned SQL digest and refuses a database containing user
tables. It loads the public sample and grants the factory user VIEW DEFINITION for
catalogue discovery. It does not grant business-row SELECT. Tokens stay in memory.
The SQL endpoint must allow the loader's client IP; remove any temporary seed rule
afterwards. If loading fails partway, inspect the dedicated demo database before
recovery; the loader will refuse an automatic overwrite on rerun. Identity creation
may require the administrator's directory lookup permission.

## Connect and run on Azure

Use [connection examples](connections.example.json) to configure the source and
ADLS linked services. Replace the example host/database/Key Vault names. Grant
catalogue visibility to the source identity and Blob Data Contributor on the metadata
container to the factory identity. A private source needs a working self-hosted IR
and network route; the example does not provision a VM or register an IR.

For an existing factory, select `mode: existing-factory` in `prepare.json`; the
bundle contains only use-case-prefixed datasets and one pipeline. It never declares
shared linked services. For a new factory select `new-factory`, review the bundle,
then run `python3 discovery/deploy.py init ... --approve-init`. This initialises the
factory only; configure the linked services before deploying the discovery pipeline.

The separate [subscription foundation](subscription.bicep) provides a fully specified
Azure SQL/ADLS demo foundation in a new reusable resource group. It requires review
of subscription, resource names, role grants, public authenticated network access
and recurring cost. It is not a migration template for an existing shared factory.

With an authenticated Azure CLI and reviewed subscription/resource group:

```sh
python3 discovery/deploy.py plan --subscription <uuid> --resource-group <name>
python3 discovery/deploy.py apply --subscription <uuid> --resource-group <name> --approve <reviewed-digest>
python3 discovery/deploy.py run --subscription <uuid> --resource-group <name>
python3 discovery/deploy.py status --subscription <uuid> --resource-group <name> --run-id <returned-run-id>
python3 discovery/deploy.py download --subscription <uuid> --resource-group <name> --run-id <returned-run-id> --storage-account <account>
```

`plan` runs ARM what-if, verifies connection types and rejects unowned resource
collisions. `apply` requires the reviewed template/configuration/current-owned-state
digest and always uses Incremental mode. No schedules, Data Flow or business-row
extraction are generated. The Copy activity writes one JSON metadata array under
`discovery/<useCase>/<pipeline-run-id>/metadata.json`, with timeout/retry controls.
Only a successful run from the expected pipeline can be downloaded by the runner.

Use the downloaded `<run-id>-import.json` with `discover contracts` in place of the
offline fixture. Retain run ID, source scope, query, imported metadata and review
result together. Compare the exported table/column inventory with the reviewed
scope; catalogue permissions can hide tables even when a pipeline succeeds.

## Limits, recovery and cleanup

- SQL Server/Azure SQL and PostgreSQL V2 are the discovery sources in this version.
  ADLS is the metadata sink. REST, SFTP and file schema inference are not advertised
  as relational catalogue discovery.
- Select 1–20 schemas and optionally up to 100 table names. Import is bounded to
  100 tables, 10,000 rows and the CLI command's 2 MB input limit. Narrow scope if needed.
- Unknown types, invalid or unbounded decimals, duplicate columns and identifier
  collisions fail explicitly. Source table spaces become underscores in contract IDs;
  original schema/table names are retained. Unsupported column identifiers require review.
- Timezone-bearing source types remain strings pending an explicit conversion decision.
  Lengths and source key evidence are retained as review metadata, not silently enforced.
- Missing catalogue visibility: adjust the source identity, rerun into a new run folder,
  and inspect table completeness. Failed/partial metadata is not accepted by download.
- Existing-name collision: choose a distinct use-case prefix; do not remove another
  project's ownership annotation. Template/state changes require a fresh plan digest.
- ADF copy/orchestration, storage requests and the demo SQL database can incur charges.
  No automatic deletion is provided. Retain the reusable resource group until its owner
  authorises cleanup; delete only resources and run folders owned by the approved showcase.

## Connector evidence

Accessed 2026-09-13: [Azure SQL](https://learn.microsoft.com/en-us/azure/data-factory/connector-azure-sql-database),
[SQL Server](https://learn.microsoft.com/en-us/azure/data-factory/connector-sql-server),
[PostgreSQL V2](https://learn.microsoft.com/en-us/azure/data-factory/connector-postgresql),
[JSON format](https://learn.microsoft.com/en-us/azure/data-factory/format-json),
[ADLS](https://learn.microsoft.com/en-us/azure/data-factory/connector-azure-data-lake-storage),
[Incremental deployment](https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/deployment-modes).
