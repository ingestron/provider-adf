# External connectors on ADF Batch

ADF 4.0.0 with CLI 0.9.0 prepares external connector workloads for an existing
Azure Batch pool. Source packages belong to
[connectors](https://github.com/ingestron/connectors), not this provider.
Local execution uses [provider-local](https://github.com/ingestron/provider-local).
ADF does not accept `execution.mode: local`.

Start with [the synthetic Faker project](../examples/connector-faker/project.yaml).
Install `adf@4.0.0` and `faker@0.3.0`, then use:

```sh
ingestron connections validate users_batch
ingestron connections prepare users_batch --out prepared.json
ingestron providers export --result prepared.json --out runtime
```

Source settings live under `connections`; selected tables use ordinary ODCS
contracts. The provider consumes the source package's digest-checked runtime
assets through `ingestron.snapshot/python/v1`. Adding a qualified source does not
require changing ADF's code. Custom source packages use this same
boundary.

Set `ingestion.execution.mode: adf-batch` and supply `azure` and `compute` settings.
The example contains illustrative resource references: replace them with authorised
existing resources before deployment. Compute identifies a Batch pool, worker
identity, storage and a preinstalled isolated Python 3.12 executable. Source
credentials use per-field `$secret` references with `vaultUrl`, `name` and
`identityClientId`; environment-secret references are rejected for this route.
Do not author `azure.configSecret`; project connections derive secret delivery.

Preparation creates pipeline ARM and stages the project lock, selection and
runtime files. It makes no Azure calls and does not install upstream dependencies.
Prepare the hash-locked Python environment, discover in the permitted execution
context, review and approve the generated projection before running. Reuse the
logical run ID for retries; use a fresh ID for a new snapshot. Read only committed
manifests, not partial attempt folders.

The connectors repository documents the snapshot, licence, resource-limit and
recovery contract. Native cloud execution remains an acceptance gate;
offline preparation and local source rehearsal are not Azure execution evidence.
There are no existing projects requiring a compatibility route: use the current
source/executor boundary and freshly reviewed bundles.
