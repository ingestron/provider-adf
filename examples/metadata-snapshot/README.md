# One metadata group, three reviewed tables

With Node 22 and CLI 0.3.2, from this directory:

```sh
ingestron plugin install adf@2.4.0 --cache-only
ingestron --no-input build --delivery --out out
```

The `landing` export contains two pipelines and two datasets. The `source`
flow requires nonempty customers/suppliers; `empty/demographics` allows zero.
Both use group `sql`. These are synthetic configuration examples, not connected
resources. Supply existing linked services/factory and frozen source counts before
any native run. Build does not deploy or execute.

Read [the metadata guide](../../docs/metadata-pipelines.md) for coordinator
parameters, completion receipts, retries, grouping and migration.
