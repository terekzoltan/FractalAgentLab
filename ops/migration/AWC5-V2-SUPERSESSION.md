# AWC5 / Router V2 supersession record

Date: 2026-09-06.
Disposition: source adoption candidate under the Owner-authorized cross-repository
Workflow Systems Steward assignment. Successor: `plans/epics/FAL-ROUTER-V2.md`.
AWC5 is `CANDIDATE_UNRELEASED`; current maintenance is
`IMPLEMENTATION_IN_PROGRESS`. No installed, live, pilot or release claim is made.

## Preserved baseline

The exact pre-adoption FAL commit is
`4f47a2a6da8fc0304e167d7b035e63df8ecd4a37`.
Use Git to read a historical file without restoring it over the candidate:

```text
git show 4f47a2a6da8fc0304e167d7b035e63df8ecd4a37:ops/PROJECT_STATE.md
git show 4f47a2a6da8fc0304e167d7b035e63df8ecd4a37:ops/Combined-Execution-Sequencing-Plan.md
git show 4f47a2a6da8fc0304e167d7b035e63df8ecd4a37:ops/PROJECT_OVERLAY.md
git show 4f47a2a6da8fc0304e167d7b035e63df8ecd4a37:ops/roles/W8-GOVERNANCE-DELIVERY.md
git show 4f47a2a6da8fc0304e167d7b035e63df8ecd4a37:docs/private/W8-A-AWC-4_1_1-Epic-Plan-v1.md
```

The baseline state and Combined preserve exact closed-Epic status, earlier
candidate/review/acknowledgement lineage and named private v3 evidence pointers.
Earlier Wave chronology remains at
`f982184:ops/Combined-Execution-Sequencing-Plan.md` and intervening Git history.
Existing private artifacts and review records remain historical evidence at
their existing locations; no giant duplicate archive or fabricated missing
artifact is created. History may explain a decision but is not a send instruction.

## Superseded, not complete

W8 was NOT_OPEN and W8-A pre-open reconciliation was unfinished. W8-A, the pending
W8-W10 program and its v3 architecture/roadmap/planning package are SUPERSEDED by
the accepted V2 direction. They are not successfully completed or accepted by
this migration. Prior accepted closed work retains its historical meaning.

The temporary W8 Governance Delivery role is retired from active selection.
Its historical file is retained, and no current state/overlay routes work to it.
The candidate maintenance hydration profile is `fal.workflow-maintainer`.
Old W8 stage manifests, precise prose/terminal admission, P0B restart ceremonies,
Compact Lite/Compact V2/Active Route enrollment and legacy sender routes are not
prerequisites for the new source path. Necessary import/archive access remains.

## Requirement disposition

These family-level dispositions use the approved AWC5 / Router V2 program
migration plan as design input. Historical program provenance remains in the
exact baseline sources above.

| Accepted requirement family | V2 successor or deferral |
|---|---|
| Authority, ownership and adoption | Owner envelope, explicit recipient/role/effect mapping, project intent and bounded adoption; packets 02/05/06 |
| Transport event/outbox integration | Atomic correlated operation facts, no duplicate sends and read-only recovery; packets 01/02; no competing lifecycle engine |
| Continuity, durability and privacy | Orchestrator monitoring, safe compact/restore, unresolved evidence retention and private current view; packets 01/03 |
| Workflow usability and operator effort | Retained lifecycle plus bounded clarification/progress-aware repair and minimal flow measurements; packets 02/05/06 |
| Environment and lifecycle proof | Focused Windows/router/installer CI, meaningful offline cases and one useful full-lifecycle pilot; packets 04/06 |
| Recovery and measurement | Proportionate protocol/crash/replay/negative tests and actual pilot effort; packets 01/02/06 |
| Qualification | One sufficient pilot and actual release/adoption decision; packet 06 |
| Execution bounds and isolation | Stable scoped work, participant coordination, editable intent and durable facts; packets 01/02/05 |
| Review, closeout and retirement | Independent review/response/fix/ACK gates, authorized local closeout, one sender, rollback/resume; packets 05/06 |
| Broad studies, learning backend and UI/scaling platform | Deferred research/product direction; no first-release prerequisite |

Useful notes, lessons, domain evidence and actual accepted constraints remain.
Any surviving issue that matters to current V2 acceptance needs a demonstrated
current-candidate nexus and explicit enforcing gate; historical findings do not
silently expand the successor.

## Protected work and resumption

`src/fractal_agent_lab/integrations/router_fal_sync.py` and
`tests/integrations/test_router_fal_sync.py` remain unrelated and no-touch.
Their former W8-E pointer is replaced by a separate future Owner-authorized
disposition, not a dependency on reopening an abandoned Wave.

FAL, RingFall, WorldSim and TriageCI retain existing product pauses and scope.
No-send import/reconciliation preserves delivered work and uncertain operations.
Installation cannot undo a pause; a late answer cannot silently resume work.
No product workflow resumes merely because source adoption or migration succeeds.

Current authority covers isolated source work and offline verification only.
Global/loaded cutover, the bounded live compatibility check, one pilot, publication
and release remain central qualification work under the actual Owner envelope.
Only the Owner interrupts sessions or compacts orchestrators. Preserve exact
unfinished work for continuation without replaying completed operations.
