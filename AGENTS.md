# Ingestron Azure Data Factory provider

Public Apache-2.0 repository. Owns ADF standards, native asset generation and
synthetic validation. Use Node 22, pnpm 10.15.0 and Python 3.12 on short-lived
branches; run `pnpm validate` before merging. `plugin/` is build output.

Never execute customer code, connect to source data or call cloud platforms in
tests. Use synthetic or public sample data only; no customer, employer or personal
material. Preserve generated-file ownership and keep third-party terms in NOTICE.
Releases are Git tags of the exact version; install references use
`ingestron/provider-adf/plugin/provider.yaml@VERSION`.
