# Offline ADF example

Use existing per-environment linked services and factory bindings after review.

```sh
ingestron plugin install adf@2.3.1
ingestron validate
ingestron plan --out build/plan.json
ingestron generate --plan build/plan.json --out build/adf
ingestron validate-output build/adf
```

Use --from-git /absolute/path/to/provider-adf for local installation.
Review the generated README before deployment. Native acceptance remains open.
No cumulative Databricks delivery index is published by this example.
