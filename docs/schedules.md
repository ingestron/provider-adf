# Reviewed ADF schedules

The private 4.10.0 candidate generates native ADF schedule definitions for complete
flows. Review the trigger files, dispatcher and `adf-schedules.json`. Generation
does not deploy, start, stop or reconcile existing triggers.

Choose explicit `native` overlap and missed-run policies. ADF owns the recurrence
clock; portable daylight-saving choices are unsupported. Each exact HH:mm slot
gets a separate trigger, preserving paired hours/minutes. Weekly and monthly
selections remain intact. Elapsed intervals require UTC and an exact native
frequency/multiplier. Non-UTC boundaries use the compiler's local resolution and
pinned CLDR48 Windows mapping. Ambiguous boundaries are refused until their native
interpretation can preserve the reviewed instant. Runtime dispatch checks the
original UTC start and exclusive end against the scheduled occurrence before any
source read. Native behaviour and those expressions still need vendor execution
qualification.

Snapshot pipelines need independently authoritative runtime inputs at every
occurrence. Configure one existing read-only source-owner manifest view per flow:

```yaml
options:
  scheduleInputs:
    source:
      kind: azure-sql
      linkedService: reviewed_manifest
      schema: governance
      view: frozen_source_manifest
```

Azure SQL and SQL Server manifest views are supported. They may describe snapshots
from any supported source; they are separate from the copied source. The view must
stay frozen with that source extract throughout validation and copy. Return exactly
one row per selected `flow/table` ID, with exact case and no added whitespace, and an integer
`expectedRowCount` within the native Int range. Empty data requires the table's
reviewed `allowEmpty` policy. A generated bounded query rejects missing, duplicate
and invalid records before dispatch. No source-row payload is read into Studio.

For `snapshot-to-databricks@v1`, also provide `deliveryId`, positive integer `version`,
UTC-second `capturedAt` and Boolean/bit `initialiseIndex`. These values come from the
source-owner publication protocol. The dispatcher does not invent versions from
clocks, create delivery IDs or reuse fixed demo counts. Preserve source sequencing,
manifest identity and retention for native publication recovery.

The dispatcher invokes only each table's primary pipeline or a metadata coordinator
with its exact flow subset and counts. It never independently schedules recovery or
worker pipelines. Watermark primaries need no snapshot manifest: their existing
durable control journal owns their parameters. Manual flows remain unscheduled.

New triggers normally start stopped. The manifest preserves enabled/paused intent
for separately authorised reconciliation. Existing deployed triggers may already
be running; an ARM definition alone does not stop them. Review native permissions,
source connectivity, clock behaviour and existing ownership before applying or
activating anything. Scheduled execution, cancellation and recovery qualification
remain open; a generated asset is not deployment evidence.
