# Active Route And Non-Dispatch Compact Recovery Implementation Summary

Plan identity: `awc-active-route-compact-v1-owner-20260805`
Candidate: `awc-active-route-compact-v1-owner-20260805`
Status: `IMPLEMENTATION_COMPLETE / FINAL_REVIEW_RECONCILED`

## Outcome

The candidate establishes a static, Canon-registered route interface without
turning a generated route projection into project authority. FAL and WorldSim can
produce or verify a target-local private `.fal/ACTIVE_ROUTE.json` from current
state, the state-selected Combined span, and the state-pinned stage artifact.
Compact recovery terminates at a verified non-dispatch `ROUTE_READY` receipt.

The candidate does not authorize a lifecycle command, automatic continuation,
live compact pilot, target implementation, commit, push, publication, or remote
side effect.

## Canon contract

- Canon version is `3.1.0`; machine contract is `2.0.0`.
- `registry/ACTIVE-ROUTE.schema.json` defines
  `agent-workflow-active-route/v1` with strict string schema version `"1"`.
- Project profiles expose static `authority_locators` and one
  `active_route_locator`; opt-in profiles use empty `phase_reads`.
- `HYDRATION-RESULT` admits terminal action `ROUTE_READY`.
- Resolver and invoker independently revalidate state, Combined, stage, route,
  source identity, profile policy, worktree identity, and privacy constraints.
- The six-schema profile-bound pack digest is
  `9116d7a7682ff7140f709e28e6ea2f8ed24ab33f61e1441bd217f5500a833a03`.

## Writer and verifier

The FAL writer supports `WRITE` and read-only `VERIFY`. It requires an exact
registered target profile and reads only its declared static locators. It parses
the target-owned state labels, resolves exactly one Combined heading span, opens
and hashes the pinned stage artifact, computes one generation identity, and
publishes the manifest last through a flushed same-directory temporary file.

Caller fields are expectations only. State, Combined, stage, generation,
worktree, path, privacy, schema, or optimistic-concurrency disagreement blocks
without replacing the prior valid manifest. Output-directory delete/rename is
held closed for the transaction to prevent parent junction or rename swaps.
Credential-shaped route identities and concrete private runtime data are rejected
before publication.

## Compact behavior

The compact adapter uses one effective policy identity and warning/critical ratio
pair. Telemetry must repeat that policy exactly. Missing target mapping, malformed
status maps, lookup failure, required telemetry failure, and valid idle omission
remain distinct fail-closed outcomes.

Before capsule persistence, the adapter checks the event's active-route generation
and source hashes. It also checks the current pure command-registry identity and
the exact `/after-compact` command identity before preflight and immediately before
the sole `/after-compact <role>` POST. It never sends `/seq-next`, `/implement`,
`/terv-review`, `/step-review`, or another lifecycle command.

FAL event `ROUTE_READY` is translated only at the Canon V2 compatibility boundary
to legacy input `AUTO_RESUME`; the final Canon hydration action remains
`ROUTE_READY`. The FAL-only `/after-compact` identity stays in the FAL event and is
not inserted into the narrower Canon capsule host attestation. The terminal FAL
receipt records `command_sent: false` and stops.

## Target enrollment

- FAL profile revision `2026-08-08.1` uses profile
  `fal.compact-v2-maintainer`; enrollment remains `LEGACY_VALIDATED`.
- WorldSim profile revision `2026-08-08.1` uses `worldsim.meta`; enrollment
  remains `LEGACY_VALIDATED`.
- RingFall remains `BLOCKED_MISSING_AUTHORITY`; no Active Route opt-in or
  manifest was created.
- TriageCI remains `LEGACY_VALIDATED`; no Active Route opt-in or manifest was
  created because its first real stage artifact and privacy rehearsal remain
  unresolved.
- Promotion to `ACTIVE` requires a separate target-specific Owner-authorized live
  pilot and is outside this candidate.

## Global tooling closure

Three explicit Owner-approved, backup-first global candidates were needed:

1. `active-route-global-nondispatch-v1` installed the non-dispatch
   `/after-compact` command and initial restore contract.
2. `active-route-profile-pins-global-v1` synchronized the profile-bound Canon
   pack identity in `context-restore`.
3. `active-route-hydration-consumers-global-v1` synchronized the final resolver
   and pack identities in both `context-onboarding` and `context-restore` after
   independent review exposed cold-start drift.

The final official Toolbox transaction is
`active-route-hydration-consumers-20260808T150524Z-547053f88d10`. Its managed
inventory identity is
`11182104266a1ae9e8b8b5f6bad00415736b44727b1a3e6918ce9c0363a68a19`.
The generated Canon snapshot payload digest is
`2efa3e99ab9ec45774da3077fdbb9f2f24c7d5782cfd64d24f704abb8e8a4a86`,
with contract alignment `MATCH`.

## Validation

- Fresh pure OpenCode registry verification: `PASS`.
- OpenCode version: `1.18.15`.
- Launcher identity:
  `7dc7f9e963b88bbfb7a529a82d1922adf642d386f096fc250e891e374884ee8e`.
- Pure registry identity:
  `37837304c69f08e400a592ffcf29140f9cceb4ae64d55971d3dd0ab2a1363bba`.
- `/after-compact` entry identity:
  `1321868dddde6f034a95728297cc485ba470d8f8bd39154fafa2c33bda263a37`.
- Canon all-hydration validation: `PASS`; release readiness `READY`.
- FAL writer, compact-flow, and context-status suites: `PASS`.
- WorldSim route generation
  `10151da73c0367a6ae56a261154152f8ca0485b735eb11055bb3bd5f3748c74d`
  verified unchanged.

## Review status

One final independent reviewer returned `APPROVE WITH FIXES` with no P0/P1 and no
implementation, security, privacy, or contract defect. Its sole P2 finding was
that the final validation receipt named the pre-review FAL generation rather than
the frozen `STEP_REVIEW` projection. A post-freeze `VERIFY` was run against that
projection, Canon all-hydration validation remained `READY`, WorldSim remained
verified, and the validation receipt was reconciled without code changes.

The offline implementation candidate is complete. Enrollment remains
`LEGACY_VALIDATED`; workflows, compacts, and live pilots remain frozen until a
separate Owner decision explicitly opens one of them.
