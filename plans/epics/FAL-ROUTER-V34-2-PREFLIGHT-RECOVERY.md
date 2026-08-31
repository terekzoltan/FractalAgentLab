# FAL Router v34.2 pre-operation recovery

Status: `IMPLEMENTED AND VERIFIED / BOUNDARY_ROLLOUT GATED`

Baseline: FAL router v34.1 (`3b2b004`)

## Outcome

Transient, read-only installed-capability probe failures receive one bounded
recovery attempt before an ordinary lifecycle operation is rejected. If the
stage still cannot start, the CLI returns a privacy-safe pre-operation receipt
that proves whether an operation or lifecycle send occurred and whether the
same request is safe to retry.

## Exact scope

- Retry the complete installed-capability probe once only for transport-level
  timeout, connection, or retryable server failures.
- Never retry authentication, semantic identity, command-registry, SSE,
  target-directory, source, authority, privacy, or duplicate-action failures.
- Preserve the existing two independent capability resolutions immediately
  before dispatch; both still have to agree byte-for-byte.
- Replace an uninformative pre-operation `BLOCKED` result with a bounded phase
  code plus `operation_created`, `lifecycle_send`, and retry disposition.
- Mark the same request retry-safe only when the operation set did not change
  and no lifecycle send could have occurred.

## Invariants

- No lifecycle POST retry or auto-advance.
- No operation, intent, transport receipt, or semantic authority is fabricated.
- POST/response uncertainty remains non-retryable.
- Source, recipient, command, authority, privacy, P0B, and CLOSEOUT boundaries
  remain fail-closed.
- Diagnostics contain no raw path, origin, credential, session id, response,
  source content, or internal exception text.

## Validation

1. First transient probe failure then success reaches exactly one lifecycle
   send.
2. Exhausted transient probe attempts produce zero operation and zero send with
   a safe same-request pre-operation receipt.
3. Authentication, semantic identity, source, and authority failures are not
   retried.
4. Any created operation or uncertain transport remains `NO_AUTOMATIC_RETRY`.
5. Existing STANDARD/STRICT, Compact, P0B, RingFall continuation, and WorldSim
   continuation tests remain green.
6. Full TypeScript build, Node suite, PowerShell router suites, executable
   attestation, and `git diff --check` pass before rollout.

## Rollout

Feature branch and offline validation first. Commit, push, integration, the new
executable-identity P0B, protected admission replacement, and any lifecycle
dispatch remain separate Owner-gated actions. RingFall stays paused at the
existing IMPLEMENT projection; WorldSim stays parked at PLAN_REVISION.

## Verification receipt

- Targeted transport and CLI taxonomy suite: `39/39 PASS`.
- Full runtime suite: `185 PASS / 0 FAIL / 1 expected private-evidence SKIP`.
- Reviewed source identity: `fal-explicit-stage-router-source-v34.2`.
- `git diff --check`: pass (line-ending conversion notices only).
- Lifecycle commands sent during implementation or verification: `0`.
