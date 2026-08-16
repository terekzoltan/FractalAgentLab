# Active Route Target Migration Receipt

Plan identity: `awc-active-route-compact-v1-owner-20260805`
Disposition: `OFFLINE_PROOF_COMPLETE_GLOBAL_PIN_REAPPLY_REQUIRED`

## FractalAgentLab

- Canon profile: `fractal-agent-lab` revision `2026-08-08.1`.
- Enrollment: `LEGACY_VALIDATED`; no promotion claim.
- Static state locator: `ops/PROJECT_STATE.md`.
- Static Combined locator: `ops/Combined-Execution-Sequencing-Plan.md`.
- Active route locator: `.fal/ACTIVE_ROUTE.json`.
- Stage-specific `phase_reads`: empty.
- Writer CLI `WRITE`: `PASS`.
- Writer CLI exact-expectation `VERIFY`: `PASS`.
- Final generation:
  `04e2ec5817d2beb872c4d5d10bc903e2c15ed2d50df9f833060699d13f9e1bad`.

## WorldSim

- Canon profile: `worldsim` revision `2026-08-08.1`.
- Enrollment: `LEGACY_VALIDATED`; no promotion claim.
- Static state locator: `ops/PROJECT_STATE.md`.
- Static Combined locator:
  `Docs/Plans/Master/Combined-Execution-Sequencing-Plan.md`.
- Active route locator: `.fal/ACTIVE_ROUTE.json`.
- Stage-specific `phase_reads`: empty; the former current-stage profile shim is
  removed.
- Writer CLI `WRITE`: `PASS`.
- Writer CLI exact-expectation `VERIFY`: `PASS`.
- Generation:
  `10151da73c0367a6ae56a261154152f8ca0485b735eb11055bb3bd5f3748c74d`.
- Route remains Meta `/seq-next` with the exact pinned `IMPLEMENT_BLOCKED`
  artifact; no command was sent.

## Preserved blockers

- RingFall remains `BLOCKED_MISSING_AUTHORITY`. No durable target-owned
  `ops/PROJECT_STATE.md` was fabricated, no profile opt-in occurred, and no
  manifest was generated.
- TriageCI remains `LEGACY_VALIDATED` without Active Route locators. It has no
  first real stage artifact suitable for enrollment, and no manifest was
  generated.

## Writer regression

The first real CLI rehearsal exposed that dot-sourcing the core replaced
`$MyInvocation.InvocationName`, preventing the writer entrypoint from running.
The script now captures dot-source state before loading the core and returns one
JSON receipt plus the exact process exit code. A child-process CLI regression
test reproduces the previously silent failure and now passes.

The generated manifests are private, target-local, ignored projections. This was
an offline rehearsal only: no compact, hydration pilot, lifecycle dispatch,
target feature implementation, commit, push, or remote side effect occurred.
