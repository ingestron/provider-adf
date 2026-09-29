# Reusable ADF compute

ADF 2.7.0 adds offline provider commands `compute prepare` and
`compute pool prepare`. Generic Python workloads use a native
managed-identity Batch pipeline builder. Native Copy, SQL execution and eligible
Databricks workloads retain their own execution choices.

## Author a workload

Supply [workload.json](../examples/compute/workload.json) to the installed
provider command from a project whose ADF configuration is named `execution`:

```sh
ingestron plugin install adf@2.7.0
ingestron --env dev provider execution compute prepare --input workload.json
ingestron --env dev provider execution compute pool prepare --input pool.json
```

`pool.json` contains `{"maxNodes":1}`. It returns a pipeline and ARM template; it does not upload,
deploy, execute code or change shared infrastructure. The template references an
existing factory, pool, worker identity and versioned Blob folder. Upload reviewed
files there with an identity that can write assets; workers need read access only.
The worker environment must already contain Python and pinned dependencies.

The entry point receives `--config <file> --run-id <ADF RunId>`. Filenames are
restricted to simple names; arbitrary shell commands are not accepted. The config
contains references, never credentials. The workload must:

1. Fingerprint configuration, code version, tenant and input identity. Reject reuse
   of a logical run ID with a different fingerprint.
2. Write durable checkpoints only after a complete replayable unit. On eviction,
   repeat an incomplete unit and reuse completed units. Local disk is temporary.
3. Write immutable attempt output, then atomically select one success receipt.
   Downstream readers follow that selection; they never scan partial folders.
4. Exit zero only after committing output. Validate hashes, schemas and counts as
   appropriate. Supply actual process-loss and replay tests before asserting safety.
5. Fence external writes separately. OAuth rotation, sending messages and updating
   third-party systems do not become idempotent by using this engine.

The recovery field is a declaration, not proof; the returned result explicitly
marks it unverified. This command does not yet add a general compute step to flow YAML.

## Lifecycle and shared capacity

Each ADF run owns one Batch job. Job duration includes queue time and is bounded
by the requested task duration plus five minutes. ADF attempts job termination
when polling finishes or fails. Batch enforces the job deadline even if ADF is
cancelled or task submission fails. An ambiguous POST is not blindly retried;
inspect the job ID. New ADF runs have new IDs and request fresh work.

`compute pool prepare` takes `{"maxNodes":1}` and returns an autoscale policy.
The infrastructure owner evaluates and applies it once to an existing shared
pool. It watches all pending/running tasks, caps Spot nodes, keeps dedicated nodes
at zero, and drains with `taskcompletion`. With sufficient samples and no work it
scales to zero. Missing metrics choose bounded capacity; alert on stale metrics
and idle spend. This is not a monetary spending cap. It is intended for ordinary
single-instance tasks without job-release tasks.

Individual workload deployments do not resize or delete the shared pool. Share a
pool only across compatible dependencies and the same trust/identity boundary;
separate environments and customers may require separate pools. Scheduling is
capacity sharing, not tenant security isolation. Spot capacity and latency are not
guaranteed; dedicated fallback remains an explicit infrastructure choice.

## Evidence and limits

Synthetic tests cover command validation, generic entry points, ARM parity,
job deadlines and termination dependencies. In a native rehearsal, a generic
workload prepared through the installed command survived a controlled node reboot
with one Batch requeue, reused its durable checkpoint and committed successfully,
replaying its original logical commit.

The pool accepted the policy and bootstrapped from zero to one Spot node; its
Python startup task succeeded on cold boot and reboot. Final automatic scale-down
is recorded separately in the evidence. This is not a naturally occurring Azure
capacity eviction, nor proof that arbitrary user code is idempotent. OAuth
rotation interruption remains fail-closed. No dedicated fallback or public
availability is implied. The reusable entry point is still a provider command,
not a general flow-YAML activity.

References checked 2026-09-15:
[Batch jobs and tasks](https://learn.microsoft.com/en-us/azure/batch/jobs-and-tasks),
[Batch autoscale](https://learn.microsoft.com/en-us/azure/batch/batch-automatic-scaling).

Automatic idle scale-down was also observed: the policy requested zero workers,
Azure removed the node, and current/target Spot and dedicated counts all reached
zero with autoscale still enabled. All six retained Batch jobs were completed.
