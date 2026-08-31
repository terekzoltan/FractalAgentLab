# FAL Router v34.3 pre-operation stability

Status: `IMPLEMENTED AND VERIFIED / BOUNDARY_ROLLOUT GATED`

Baseline: FAL router v34.2 (`7c8c104`)

## Outcome

An ordinary stage may stabilize the initial live capability/authority pair once
before operation creation when the two GET-only measurements disagree. A
remaining failure returns a finite, privacy-safe diagnostic that distinguishes
the blocking guard without exposing native detail.

## Exact scope

- One 50 ms bounded re-read of the initial capability/authority pair only for
  exhausted transient capability probing or pair disagreement.
- `stage-dispatch-diagnostic.v2` with finite phase, reason class,
  `stability_attempts`, operation evidence, send evidence, and retry disposition.
- No lifecycle POST retry, operation recreation, semantic retry, source repair,
  authority relaxation, or auto-advance.
- Existing request, transition, source, finding, recipient, privacy,
  duplicate-action, fence, lease, and snapshot-baseline guards stay fail-closed.

## Incident evidence

The exact RingFall fix-cycle request, immutable run authority, transition,
revised-plan/finding lineage, capability resolver, authority resolver, privacy
scan, semantic-action ledger, and lock state all passed current read-only
inspection. The v34.2 failure created no operation and no lifecycle send. The
discarded native pre-operation reason therefore prevented a more exact historic
classification; v34.3 makes the next such boundary attributable and recovers
the demonstrated transient live-pair class in place.

## Verification requirements

1. One initial disagreement followed by a stable pair produces one operation
   and exactly one lifecycle POST.
2. Persistent disagreement produces zero operation and zero POST.
3. Every semantic mismatch remains non-retryable.
4. Diagnostics contain no raw paths, origins, credentials, session IDs, source
   content, or native error text.
5. Full runtime and PowerShell router suites, executable attestation, and
   `git diff --check` pass before rollout.

## Rollout boundary

`BOUNDARY_ROLLOUT`: RingFall remains paused at the existing exact IMPLEMENT
projection and WorldSim remains parked at PLAN_REVISION. Commit, push,
integration, isolated P0B, protected admission replacement, and lifecycle
dispatch remain separate Owner-gated actions.

## Verification receipt

- Targeted CLI/stage-engine suite: `84/84 PASS`.
- Full runtime suite: `188 PASS / 0 FAIL / 1 expected private-evidence SKIP`.
- Eight applicable offline PowerShell router, review, Compact, context, and
  Active Route suites: `PASS`.
- The separate global-tooling inventory audit remains outside this router
  candidate and reproduces a pre-existing snapshot drift on the unchanged
  v34.2 main checkout.
- Reviewed source identity: `fal-explicit-stage-router-source-v34.3`.
- Compiled entry, compiled manifest, source manifest, attestation file, and
  launcher-pinned attestation digest: exact match.
- `git diff --check`: pass (line-ending conversion notices only).
- Lifecycle commands, protected-control mutations, P0B POSTs, and production
  sends during implementation or verification: `0`.
