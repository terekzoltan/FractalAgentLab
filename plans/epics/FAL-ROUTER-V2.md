# FAL-ROUTER-V2: small router and AWC5 adoption

Qualification update2026-09-06: local source and the one useful isolated live
pilot are complete. See FAL-ROUTER-V2-QUALIFICATION.md for exact evidence and
remaining rollout boundaries. Earlier planning-only envelope below is historical;
current Owner authority allowed LOCAL_COMMIT and isolated pilot, not production
installation, main merge, push, release or project resumption. Do not rerun the
completed pilot as a new prerequisite.

Status: `IMPLEMENTATION_IN_PROGRESS / CANDIDATE_UNRELEASED`.
Owner: Project Owner. Coordinator: Workflow Systems Steward maintenance.
Source-only publication intent: `NONE`.
This concise repository plan records the accepted successor scope. It is not a
claim that ordinary Delivery/Meta lifecycle stages or release gates have run.

## Outcome and authority

Replace the coupled V1 sender/control paths with one small stateful router.
Existing project orchestrators lead work; OpenCode executes sessions. Preserve
all meaningful lifecycle stages, independent review, scope, proof and Owner control.
The Owner approved isolated source implementation and coordination across FAL,
AWC and Workflow Operations. Current state records the exact next source action.

AWC owns reusable laws and versioned OpenCode definitions; FAL owns the router,
telemetry adapter and managed installer; Workflow Operations owns Codex skills.
Target projects own intent, accepted artifacts, findings and product decisions.
Installed copies and source-derived references are outputs, with loaded process
evidence tracked separately. Every affected authorized sync belongs to the same
maintenance task.

## Implementation packets

| Packet | Deliverable | Dependency and completion evidence |
|---|---|---|
| 01 Operation store | Short SQLite WAL transactions; stable action identity, immutable inputs/results, atomic participant claims and progress projection | Accepted source scope; offline duplicate/concurrency/crash and corrupt-store cases |
| 02 Transport and recovery | Explicit addressed submit/inspect/wait/reconcile; correlation before interpretation; role/command/effect validation | 01; long history, changed template, timeout/restart, ambiguous roots, source tamper and no-interruption cases |
| 03 Lane continuity | Reused context estimates, orchestrator monitoring, shared idle compact and minimal role restore | 02 and coupled definitions; native compact, busy/paused lanes, interrupted maintenance and preserved completed-result cases |
| 04 Versioned tooling | Git-owned definitions; exact managed installer with drift checks, backup, resumable source/install/reference closure | Source inventory; offline installation/restore/race checks with AWC and WOps manifests |
| 05 Canon and adoption | AWC5 content-based contracts, preserved lifecycle, minimal hydration and bounded project consumers | 02-04 integration; source/pack/hydration tests and FAL supersession provenance |
| 06 Qualification and cutover | No-send legacy import; one sender; isolated compatibility; one useful full-lifecycle pilot; authorized distribution/release/adoption | 01-05 coherent candidate; actual evidence at each boundary, never an HTTP-only release claim |

These are implementation units within one maintenance assignment. Their existence
does not mark them completed. The coordinator records actual checks and remaining
dependencies against the final candidate; evolving source is not a frozen release.

## Required behavior

- Editable scope, plans and stopping point remain project intent. SQLite records
  immutable requests and observed operation facts; responsible roles interpret
  results. A current readable view derives progress with source/freshness and
  preserves Owner pause, without a competing editable next-action field.
- One stable action cannot execute twice on retry/restart. Different input under
  the same key conflicts. Participant exclusion spans lifecycle and maintenance,
  while independent participants can progress. Possible sends survive process
  loss and remain inspectable; uncertainty is never deleted to permit retry.
- Persist acknowledgements/correlation before judging output. Real tools,
  compaction and harmless prose variation do not erase known delivery. Missing
  proof/authority is still missing; bounded clarification does not reimplement.
- Preserve seq-next, plan review, revision, implementation, step review, response,
  reviewed fix-plan/revision and acknowledged closeout. Repair can continue while
  making substantive progress within scope/budget; material replanning returns
  to planning. No hard total repair cap or automatic weakening of acceptance.
- The orchestrator monitors lanes, requests one safe idle compact and minimal
  project/role restore, then continues the prior envelope if permitted. Missing
  optional telemetry is visible rather than a universal blocker. Only the Owner
  compacts orchestrators or interrupts sessions; local wait completion never
  calls abort. No scheduler or second autonomous controller is introduced.
- New sends validate current addressing/API behavior; old results retain dispatch
  provenance. Ordinary restart needs useful read-only checks, not repeated P0B
  approval. Model/assignment sizing is configurable and does not widen accepted
  scope or remove integration/review boundaries.
- Keep task-relevant final outputs, evidence references and concise operation
  facts. Preserve unresolved recovery, accepted artifacts, useful notes and lesson
  candidates. Full session history remains with OpenCode; no second transcript
  database or broad learning system is required.

## Qualification still pending

Use proportionate offline tests and realistic recovery fixtures, then one bounded
isolated OpenCode compatibility check and ONE simplest useful full-lifecycle
pilot. The proposed pilot is FAL-V2-QUICKSTART-PILOT in an isolated FAL worktree:
an Orchestrator leads separate Delivery and Meta participants to produce the
verified Router V2 quickstart through normal review/response/local closeout.
Its setup, live effects and local commit require the applicable actual Owner
envelope; this source plan does not authorize execution.

Keep RingFall's performed implementation and WorldSim's accepted plan review as
no-send migration examples, preserving candidate/finding lineage, accepted scope
and pauses. An ambiguous old action remains uncertain; imported delivery proves
neither new product correctness nor permission to resume. TriageCI retains its
paused frontier without a fabricated trial.

Record a few actual flow measures: technical Owner interventions, useful-work
versus recovery/wait time, framework-only model calls/cost where observable,
incidents needing patches, genuine blockers versus avoidable stops, and context
needed to resume. Aim for zero mandatory technical intervention in the simple
successful pilot; real product decisions are counted separately. Do not invent
comparative scores, manufacture findings or demand multi-project/full-Wave trials.

Before release, integrate source and affected consumer checks, review actual
candidate/proof, retire competing writers, finish authorized installer/reference/
loaded verification and target adoption, and record rollback plus exact resume
conditions. Backups preserve prior bytes and operation history; rollback cannot
erase V2 sends or re-enable a V1 writer unaware of them.

## Scope and historical disposition

W8-A and the pending W8-W10/v3 program are SUPERSEDED, not completed. The requirement
map and exact baseline references are in `ops/migration/AWC5-V2-SUPERSESSION.md`.
Large research/learning backends, UI/HUB, autonomous hierarchy and broad product
repair are deferred. The protected Python sync source/tests require a separate
future disposition. Source adoption does not reopen parked projects or authorize
live install, pilot, restart, publication or release.
