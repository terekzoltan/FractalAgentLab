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
Maintenance status: `LOCAL_QUALIFICATION_COMPLETE / ROLLOUT_PENDING`
Candidate identity: `awc5-v2-router / mutable source, not frozen or accepted`
Configuration identity: `AWC5 / Router V2 source candidate`
Combined row identity: `Maintenance/FAL-ROUTER-V2/position-10`
Active artifact: `plans/epics/FAL-ROUTER-V2.md`
Role runbook: external Canon `runbooks/WORKFLOW-MAINTAINER-RUNBOOK.md`

## Intent and evidence

Last accepted decision: Owner replaced the pending W8 program with one small
Router V2 and approved isolated cross-repository source implementation.
Last completed action: local candidate commits, isolated compatibility probe and
one Orchestrator-led full documentation lifecycle through local closeout.
Operation facts: all seven pilot stages delivered/completed without resend or
manual stage intervention; exact evidence is in the qualification record.
Semantic acceptance: isolated documentation pilot GREEN/ALLOWED, Delivery ACK,
Meta local closeout; system production promotion remains pending.
Owner pause: existing parked project pauses preserved; source maintenance may
continue. A late result or successful import never resumes product work.
Installed/loaded status: not established by this source candidate.
Publication: `LOCAL_COMMIT`; no main merge, push or production installation.

## Exact next action

Expected role: current Workflow Systems Steward maintenance coordinator.
Action: obtain the separate production rollout/release envelope, then complete
only authorized adoption, installation and publication. Do not repeat the pilot.
Input: `plans/epics/FAL-ROUTER-V2.md`, current source diff and offline evidence.
Evidence: `plans/epics/FAL-ROUTER-V2-QUALIFICATION.md` and pilot commit be764a3.
No current product lifecycle send or unfreeze is authorized.
Active source blocker: none recorded; report a concrete integration failure if found.

## Boundaries and pending closure

AWC5 remains unreleased. Isolated live compatibility and the one useful pilot are
complete. Actual parked-project legacy import/adoption, production installation,
loaded verification, release and publication remain outside the current envelope.

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
