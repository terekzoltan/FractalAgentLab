# FAL Native Review Adapter Migration

Plan identity: `fal-native-review-adapter-awc-3-1-20260808`
Candidate identity: `fal-native-review-adapter-awc-3-1-20260808`
Status: `COMPLETE / OFFLINE_VERIFIED`

## Outcome

FAL's session-router review path now consumes the AWC 3.1 native review contract.
The Orchestrator transports one frozen candidate/risk/budget/domain envelope to
Meta. Meta owns domain routing, generic reviewer-profile selection, native Task
fan-out, receipt inspection, challenge decisions, and final synthesis.

The canonical path no longer depends on an `opencode-swarm` role registry, a
`swarm-assistant` session, `/swarm-review`, a plain `GO`, or external review-result
forwarding. Historical Swarm artifacts remain read-only provenance and are never
resumed or converted into native receipts.

## Implemented scope

- Updated the strict final-synthesis classifier from the retired
  `Review profile/topology:` field to the AWC 3.1 `Review routing:` contract.
- Added routing-shape/budget consistency checks and rejected active Swarm or
  `review-sol-pro` assignment claims.
- Made serial, parallel, and fix-cycle wrappers fail closed on active Swarm
  controls while preserving harmless compatibility inputs.
- Removed the parallel native path's dependency on a registered Swarm session.
- Persisted native transport, budget policy, assignment cap, and requested domains
  in serial and parallel run state.
- Replaced parallel Phase-1 bindings with `REQUIRED NATIVE REVIEW BINDINGS`.
- Updated offline regression expectations to AWC 3.1 and retained legacy envelope
  parsers only as historical compatibility tests.
- Rewrote the hot/cold router documentation around the one-stage native review
  path and token-efficient selective recovery.
- Added exact source/test allowlist entries so the migrated adapter is durable in
  FAL rather than remaining an ignored machine-local patch.
- Added current 15-command/20-skill Canon snapshot inventory assertions without
  rewriting historical Compact V2 transaction evidence.

## Preserved boundaries

- Active Route and Compact V2 remain non-dispatch and unchanged in authority.
- No live OpenCode command, compact, restart, target mutation, implementation,
  commit, push, PR, merge, deploy, publication, or remote side effect was run.
- `src/fractal_agent_lab/integrations/router_fal_sync.py` and its test remain
  untouched.
- Existing historical run directories and `.swarm` evidence were not modified.
- A current RingFall Meta session may receive a fresh candidate-bound native
  `/step-review`; an old Swarm frontier in that session is not resumed.

## Validation

```text
test-review-routing.ps1: PASS (203 assertions)
PowerShell parser validation: PASS
Review migration source credential-shape scan: PASS
AWC 3.x snapshot inventory: PASS (15 commands / 20 skills / native step-review)
```

The validation is offline and uses local fixtures/mocked transport. It proves
router contract and parser behavior, not a live session pilot.

## Remaining external follow-up

The generated AWC tooling snapshot still shows stale Swarm wording in the global
`/fal-orchestrate-target` command/skill consumer. That global-tooling surface is
outside this FAL repository migration and must use the normal backup-first
`/workflow-fix` tooling transaction, restart/live verification, and automatic
Canon snapshot refresh. Until then, the FAL adapter is migrated but the overall
AWC native-review release gate remains open. The current `/step-review` command
and reviewer registry are already the native execution authority.

## Closeout

FAL adapter result: `COMPLETE / OFFLINE_VERIFIED`.

Global consumer result: `FOLLOWUP_REQUIRED / NO_GLOBAL_APPLY_IN_THIS_EPIC`.

Next command: `NONE` unless the Owner separately opens the global
`fal-orchestrate-target` tooling cleanup or a live target review pilot.
