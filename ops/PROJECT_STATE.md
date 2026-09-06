# FractalAgentLab Project State

Updated: 2026-09-06
Updated by: Owner-authorized Workflow Systems Steward maintenance
State revision: `fal-router-v2-source-adoption-20260906-v1`
Canon source: `5.0.0 / CANDIDATE_UNRELEASED`
Sequence authority: `ops/Combined-Execution-Sequencing-Plan.md`

## Active frontier

Wave: `none - cross-repository maintenance`
Epic: `FAL-ROUTER-V2`
Accountable role: `Workflow Systems Steward / fal.workflow-maintainer`
Epic readiness: `READY for authorized source work`
Epic status: `ACTIVE`
Workflow phase: `none - not a normal project lane lifecycle`
Maintenance status: `IMPLEMENTATION_IN_PROGRESS`
Candidate identity: `awc5-v2-router / mutable source, not frozen or accepted`
Configuration identity: `AWC5 / Router V2 source candidate`
Combined row identity: `Maintenance/FAL-ROUTER-V2/position-10`
Active artifact: `plans/epics/FAL-ROUTER-V2.md`
Role runbook: external Canon `runbooks/WORKFLOW-MAINTAINER-RUNBOOK.md`

## Intent and evidence

Last accepted decision: Owner replaced the pending W8 program with one small
Router V2 and approved isolated cross-repository source implementation.
Last completed action: scoped source ownership and combined AWC/WOps integration
inputs established; this checkout now contains the bounded FAL adoption candidate.
Operation facts: no live operation observation performed by this source adoption;
offline checks belong to the coordinator's candidate evidence.
Semantic acceptance: pending integrated review and qualification.
Owner pause: existing parked project pauses preserved; source maintenance may
continue. A late result or successful import never resumes product work.
Installed/loaded status: not established by this source candidate.
Publication: `NONE`.

## Exact next action

Expected role: current Workflow Systems Steward maintenance coordinator.
Action: integrate and verify the FAL router, installer and governance candidate
against the explicitly selected combined AWC and Workflow Operations sources.
Input: `plans/epics/FAL-ROUTER-V2.md`, current source diff and offline evidence.
Result: coherent reviewable source with actual checks, remaining qualification
and one resume point recorded by the coordinator. No project lifecycle send.
Active source blocker: none recorded; report a concrete integration failure if found.

## Boundaries and pending closure

AWC5 remains unreleased. Legacy no-send reconciliation, isolated live compatibility,
one useful full-lifecycle pilot, authorized installation/loaded verification,
release and target adoption remain pending central qualification. They are not
proved or authorized by this state update.

W8-A and W8-W10 are `SUPERSEDED`, never `COMPLETE`; do not resume the old
Meta review, stage-manifest route, W8-v3 planning program or temporary W8 role.
Historical baseline and requirement mapping:
`ops/migration/AWC5-V2-SUPERSESSION.md`.

Protected no-touch paths: `src/fractal_agent_lab/integrations/router_fal_sync.py`
and `tests/integrations/test_router_fal_sync.py`. A separate future assignment
owns their disposition. Preserve original repositories and unrelated work.
Only the Owner interrupts sessions and compacts orchestrators.

Hydration: basic target/role/status reads remain available while paused or
blocked. Use the coordinator's explicit combined Canon candidate root in this
isolated worktree; the shipped sibling locator remains portable. No runtime
session IDs, endpoints, credentials or workstation paths belong here.
