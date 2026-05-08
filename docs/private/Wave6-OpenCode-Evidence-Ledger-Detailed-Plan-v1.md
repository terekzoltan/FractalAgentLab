# Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1

## Status

Private Wave 6 detailed planning artifact.

Authority:

- `ops/Combined-Execution-Sequencing-Plan.md` remains canonical for active sequencing, status markers, and Track start permission.
- This document is the detailed planning reference that Tracks should use when preparing their own implementation plans.
- `docs/private/OpenCode-Orchestration-Layer-v01.md` defines the strategic correction behind Wave 6.
- `docs/private/Coordination-Layer-Packet-Bus-v02.md` defines the current MVP packet/state direction.
- `docs/private/Coding-Vertical-Usefulness-Eval-v01.md` defines usefulness evaluation expectations.

Current Meta decision:

- Wave 6 / W6-S1 is open for active sequencing.
- The first implementation epic is `READY`, not already in progress.
- Track implementation still requires a Track-authored implementation plan and Meta review before code changes.
- The first implementation slice is a manual or semi-manual evidence ledger MVP, not OpenCode API automation.

## Purpose

Wave 6 turns the real OpenCode Meta/Track development loop into structured, private, auditable evidence.

The goal is not to build another command wrapper. The goal is to answer whether Fractal Agent Lab makes OpenCode-driven development safer, more measurable, easier to review, and worth the extra structure.

## Non-Goals

Wave 6 must not implement or claim:

- autonomous push
- autonomous commit by default
- unattended swarm execution
- hidden OpenCode session mutation
- direct mutation of OpenCode storage internals
- broad session bus or queue autonomy before evidence proves usefulness
- UI/dashboard work before useful evidence exists
- public exposure of raw private learning-loop evidence
- provider/model ranking or coding-agent performance leaderboard claims

## Track Ownership Model

| Track | Wave 6 role | Early W6-S1 posture |
|---|---|---|
| Meta Coordinator | sequencing, gates, no-claim boundaries, target readiness, final decisions | owns this plan and Combined sync |
| Track B | packet/state contract, artifact boundaries, transition validator | first implementation owner for contract/state surfaces |
| Track E | evidence sufficiency, usefulness metrics, false-green prevention, eval rows | co-owner after Track B contract draft exists |
| Track D | OpenCode bridge/router/transport surface | deferred from implementation until manual ledger proves value; may later do bridge feasibility |
| Track C | payload meaning, role/command semantics, handoff semantics | review/checkpoint support, not first implementation owner |
| Track A | visibility/dashboard UX | deferred until evidence exists and display needs are known |

## Sprint Structure

### W6-S1 - Manual Evidence Ledger MVP

Intent:

- prove one real Meta/Track loop can be captured as structured private evidence
- keep capture manual or semi-manual
- validate packet/state rules before bridge delivery
- record usefulness friction honestly

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W6-A Packet and ledger contract | Track B | Track E, Track C checkpoint | schema/envelope, artifact contract, loop identity rules | Wave 5 closed |
| W6-B Packet state machine validator | Track B | Track E | allowed transitions, stop states, false-green transition checks | W6-A contract accepted |
| W6-C Manual evidence recorder MVP | Track E + Track B | Meta | private local recorder for packets, ledgers, loop summaries | W6-A contract accepted; can overlap with W6-B after schema stabilizes |
| W6-D First real loop capture and seed usefulness row | Track E + Meta | originating Track as selected | one captured FAL Meta/Track loop, usefulness seed row, stop/narrow recommendation | W6-B + W6-C accepted |

W6-S1 implementation is successful only if the captured loop is useful to audit. If the evidence ledger does not improve review, gate, or retrospective understanding, do not move to bridge delivery.

### W6-S2 - Usefulness Expansion And Bridge Readiness

Intent:

- test whether the ledger helps beyond one loop
- decide whether OpenCode bridge/API work is justified
- avoid building transport before value is proven

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W6-E Second task-class evidence loop | Track E + selected Track | Meta | captured loop for a different task/risk class | W6-D not negative |
| W6-F Usefulness evaluation v1 | Track E | Meta | private eval summary with recommended/optional/not-worth-it/dangerous verdict by task class | W6-D + W6-E |
| W6-G OpenCode bridge readiness brief | Track D + Track B | Track E | bridge/API feasibility and risk brief; no bridge implementation unless W6-F supports it | W6-F says ledger is recommended or optional for at least one non-trivial class |

### W6-S3 - External Target Readiness And Trial

Intent:

- avoid validating only on Fractal Agent Lab
- keep external evidence private by default
- separate public architecture/case-study output from private review heuristics

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W6-H Target repo readiness brief | Meta + Track E | Track roles as needed | repo location, architecture summary, safe first sequence item, boundaries | W6-F accepted |
| W6-I External target repo trial | Track roles as assigned by brief | Meta + Track E | one captured external loop or documented blocker | W6-H accepted |
| W6-J Sanitized case-study / release review | Meta + Track E | Track A only if presentation is needed | public-safe summary or explicit no-release decision | W6-I evidence or blocker |

WorldSim is the preferred candidate, not an active trial target. It must pass W6-H before W6-I starts.

## Proposed Artifact Surfaces

These paths are proposed planning guidance. Track B owns the final artifact contract.

Suggested private local structure:

```text
data/evidence/wave6/
  loops/
    <loop_id>/
      ledger.json
      packets/
        <packet_id>.json
      summary.md
      review_findings.json
      usefulness_row.json
  eval/
    usefulness_rows.jsonl
    usefulness_summary.json
```

Suggested privacy posture:

- `data/evidence/wave6/**` is private/local evidence by default.
- Raw packet payloads, prompts, review findings, gate-quality judgments, and target-repo context are never public by default.
- Public-safe output must be derived through a separate visibility/release review.

## Packet Contract Requirements

W6-A should reuse the `w6.packet.v1` intent from `Coordination-Layer-Packet-Bus-v02.md`.

Minimum envelope fields:

- `schema_version`
- `packet_id`
- `loop_id`
- `stage`
- `producer`
- `consumer`
- `originating_track`
- `target_track`
- `sequence_ref`
- `source_command`
- `decision`
- `created_at`
- `parent_packet_id`
- `artifact_refs`
- `payload_summary`
- `payload`
- `visibility_audit_state`
- `privacy_classification`
- `validation`

Allowed MVP stages:

- `plan_ready_for_meta_review`
- `meta_plan_review_done`
- `plan_review_acknowledged`
- `implementation_done`
- `step_review_done`
- `step_review_acknowledged`
- `review_fix_done`

Allowed MVP decisions:

- `greenlit`
- `changes_requested`
- `blocked`
- `pass`
- `fix_required`
- `hold`
- `deep_review_needed`

Deferred packet families:

- launch packets
- UI packets
- reminder packets
- compact packets
- commit execution packets
- push packets
- general session-bus packets

## State Machine Requirements

W6-B should make invalid workflow transitions fail loudly.

Required transition rules:

- implementation cannot follow plan review unless a `greenlit` decision exists
- `blocked` stops the loop until a new explicit plan or unblock packet is created
- `changes_requested` returns to `plan_ready_for_meta_review`
- `implementation_done` requires a prior greenlit plan path
- `fix_required` requires `review_fix_done` before another pass review
- `deep_review_needed` is an extension route, not the default path
- `pass` plus acknowledgement closes the loop or makes it commit-ready depending on the surrounding Meta decision
- `hold` is not success and cannot be counted as pass in usefulness evaluation

False-green risks to test:

- missing `greenlit` still allows implementation
- `blocked` loop later records pass without unblock/new plan evidence
- `hold` is counted as success
- `deep_review_needed` is treated as pass
- malformed packet is recorded as valid evidence
- privacy classification is absent or public-safe by default

## Evidence Recorder Requirements

W6-C should record useful workflow evidence, not just messages.

For each loop, capture:

- originating Track
- Meta reviewer session
- sequence item
- plan summary
- review verdict
- implementation summary
- changed files
- tests/checks run
- missing tests or skipped checks
- review findings
- whether findings were accepted, rejected, fixed, or deferred
- whether fixes were required
- whether the Meta gate was correct in hindsight
- manual intervention count
- manual copy-paste steps
- copy-paste avoided count
- operator interruptions required
- final status: `pass`, `pass_with_warnings`, `hold`, or `blocked`

Recorder acceptance expectations:

- rejects invalid packets instead of recording them as clean evidence
- records missing/skipped tests explicitly
- keeps local/private output separate from canonical run artifacts
- does not mutate OpenCode storage
- does not perform commit, push, or session delivery actions
- can produce a concise loop summary for Meta review

## Usefulness Evaluation Requirements

W6-D and W6-F should judge whether the ledger earns its complexity.

Metrics to capture:

- `loop_id`
- `target_repo`
- `sequence_ref`
- `task_type`
- `complexity_class`
- `mode`
- `manual_copy_paste_steps`
- `copy_paste_avoided_count`
- `operator_interruptions_required`
- `time_to_greenlit_estimate`
- `time_to_pass_estimate`
- `plan_review_iterations`
- `implementation_review_iterations`
- `fix_cycles`
- `real_issues_caught_count`
- `false_positive_findings_count`
- `missing_tests_count`
- `tests_added_or_requested_count`
- `scope_drift_observed`
- `plan_adherence`
- `gate_correctness`
- `final_status`
- `net_recommendation`

Allowed recommendations:

- `recommended`
- `optional`
- `not_worth_it`
- `dangerous`
- `insufficient_data`

Rules:

- one loop can produce a seed row, not a broad claim
- a longer artifact is not automatically useful
- a cleaner state diagram is not automatically useful
- if command-assisted OpenCode is enough for a task class, say so
- if capture adds more friction than value, narrow or stop

## Track Implementation Plan Expectations

Every Track implementation plan for Wave 6 should include:

- exact Combined epic and step reference
- owned files and non-owned files
- proposed artifact paths if any
- packet/state/evidence contract impact
- privacy classification impact
- non-goals and no-claim boundaries
- acceptance criteria
- negative-path tests
- manual verification plan
- rollback/failure behavior
- Track handoff message for the next owner

Meta should reject Track plans that:

- start bridge/API automation before the manual ledger value gate
- skip false-green transition tests
- treat private evidence as public-safe by default
- let Track D own packet state semantics that belong to Track B
- let Track A build dashboard work before evidence needs stabilize
- treat WorldSim as active without a readiness brief

## Suggested Track Start Packets

### Track B W6-A Start Packet

Task:

- define packet and ledger artifact contracts for manual evidence-ledger capture

Use this document plus:

- `Coordination-Layer-Packet-Bus-v02.md`
- `OpenCode-Orchestration-Layer-v01.md`
- `Coding-Vertical-Usefulness-Eval-v01.md`

Expected plan focus:

- schema and validation boundaries
- proposed local artifact path
- invalid packet behavior
- privacy classification defaults
- handoff to Track E for evidence fields

### Track B W6-B Start Packet

Task:

- implement or specify state-machine validation over W6-A packet contract

Expected plan focus:

- allowed transitions
- blocked/hold/deep-review semantics
- false-green transition tests
- loop closure semantics

### Track E W6-C Start Packet

Task:

- define and implement the manual evidence recorder MVP on top of W6-A/W6-B surfaces

Expected plan focus:

- evidence fields
- recorder output
- missing/skipped tests representation
- review finding representation
- private eval row seed

### Track E + Meta W6-D Start Packet

Task:

- capture one real FAL Meta/Track loop and produce a seed usefulness row

Expected plan focus:

- selected loop
- mode classification
- friction metrics
- usefulness verdict limits
- stop/narrow recommendation

### Track D W6-G Start Packet

Task:

- produce bridge/API readiness brief only after W6-F shows value

Expected plan focus:

- OpenCode integration assumptions
- storage/session mutation risks
- delivery vs capture distinction
- no bridge implementation unless Meta opens it explicitly

## Readiness Gates

W6-S1 can start because Wave 5 is closed and the first slice is manual-ledger-first.

W6-A is `READY` when:

- Track B reads Combined and this plan
- Track B prepares an implementation plan
- Meta reviews and greenlights that plan

W6-C is not fully ready until W6-A contract exists, but Track E may prepare evidence-field planning in parallel.

W6-D is not ready until W6-B and W6-C are accepted.

W6-G bridge readiness is not ready until W6-F provides a non-negative usefulness verdict.

W6-H/W6-I external target work is not ready until target readiness is explicitly accepted.

## Stop Or Narrow Conditions

Stop or narrow Wave 6 if:

- manual/command-assisted OpenCode is consistently enough
- the ledger does not change review or gate decisions
- packet capture adds more overhead than it removes
- false-positive review noise increases
- evidence rows do not improve later planning/review decisions
- useful public output would require leaking private heuristics
- OpenCode API assumptions are unstable or require unsafe storage mutation

## First Correct Next Step

The first Track-facing next step is Track B W6-A implementation planning.

Track B should not start coding from this document alone. Track B should produce an implementation plan for Meta review that turns this Wave-level plan into exact file ownership, interfaces, tests, and acceptance gates.
