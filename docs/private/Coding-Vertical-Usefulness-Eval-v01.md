# Coding-Vertical-Usefulness-Eval-v01

## Status

Private Wave 6 evaluation planning artifact.

Purpose:

- define how to judge whether the OpenCode + Fractal Agent Lab coordination layer earns its complexity
- prevent the coding vertical from becoming extra policy and packet theater
- separate real usefulness from nicer documentation

Authority:

- `ops/Combined-Execution-Sequencing-Plan.md` remains canonical for active sequencing and status.
- `docs/private/OpenCode-Orchestration-Layer-v01.md` defines the Wave 6 strategic correction.
- `docs/private/Coordination-Layer-Packet-Bus-v02.md` defines the MVP packet/state surface this eval should inspect.

## Core Question

Does Fractal Agent Lab materially improve the real OpenCode Meta/Track development loop?

Material improvement means at least one of these is true:

- fewer manual transport steps
- faster plan review
- clearer implementation plans
- better test/doc obligations
- fewer false-green starts
- more real bugs caught during review
- fewer avoidable fix/re-review cycles
- better scope control
- clearer commit-readiness decisions
- reusable private lessons are captured without leaking sensitive heuristics

If the answer is mostly no, Wave 6 should narrow or stop.

## Compared Modes

Wave 6 usefulness should compare these modes when enough evidence exists:

### Mode A — Manual OpenCode workflow

- operator manually copy-pastes context between Track and Meta sessions
- custom commands may be used, but no structured packet ledger exists
- decisions are recoverable only from chat history, docs, git, or memory

### Mode B — Command-assisted OpenCode workflow

- custom commands and skills structure each step
- handoff remains manual or semi-manual
- evidence capture is inconsistent unless the operator writes it down

### Mode C — Packet-assisted OpenCode server workflow

- structured packets are forwarded between sessions through OpenCode server/API surfaces
- routing/validation may exist
- evidence capture may still be mostly transport-focused

### Mode D — FAL evidence-backed workflow

- packet states are validated
- evidence ledger records decisions and transitions
- review/gate quality is evaluated
- private learning-loop rows can later improve policy

The goal is not for Mode D to always win.
The goal is to learn where Mode D is worth the extra structure.

## Metrics

For each evaluated loop, capture:

- `loop_id`
- `target_repo`
- `sequence_ref`
- `task_type`
- `complexity_class`: `simple` | `medium` | `high` | `shared_boundary`
- `mode`: `manual_opencode` | `command_assisted` | `packet_assisted` | `fal_evidence_backed`
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
- `scope_drift_observed`: `yes` | `no` | `unclear`
- `plan_adherence`: `high` | `medium` | `low` | `unclear`
- `gate_correctness`: `correct` | `too_strict` | `too_lenient` | `unclear`
- `final_status`: `pass` | `pass_with_warnings` | `hold` | `blocked`
- `net_recommendation`: `recommended` | `optional` | `not_worth_it` | `dangerous` | `insufficient_data`

## Qualitative Review Questions

For each loop, ask:

- Did the plan packet make Meta review faster or more accurate?
- Did Meta review catch issues the Track would likely have missed?
- Did the Track implementation follow the accepted plan?
- Did the implementation summary make step review easier?
- Were review findings real, useful, and fixable?
- Were any findings false positives or policy noise?
- Did packet/state validation prevent a bad transition?
- Did the evidence ledger make the final decision easier to audit?
- Did this workflow reduce operator load, or just move work into forms?

## Eval Cadence

### Cycle 1 — Single-loop baseline

Use one real Meta/Track loop.

Goal:

- verify that the evidence fields are capturable without excessive overhead
- record friction honestly
- avoid public claims

Expected output:

- private eval row
- short verdict: `recommended`, `optional`, `not_worth_it`, `dangerous`, or `insufficient_data`

### Cycle 2 — Different task class

Use a second task with different risk shape.

Goal:

- identify where packet/evidence capture helps or hurts
- refine task-type policy

### Cycle 3 — External target trial

Use a non-FAL target repo if ready.

Default candidate:

- WorldSim

Goal:

- prevent self-recursive validation
- prove whether the workflow helps outside Fractal Agent Lab

WorldSim readiness must be checked first through a target brief:

- repo location
- current architecture summary
- active workflow need
- safe first sequence item
- expected evidence
- boundaries and non-goals

If WorldSim is unavailable or not ready, choose another target repo rather than using FAL-only validation as a substitute.

## Success Criteria

The Wave 6 usefulness eval succeeds if it produces grounded policy such as:

- use FAL evidence-backed packets for medium/high or shared-boundary tasks
- skip FAL packet capture for trivial tasks
- require Meta plan review only when risk justifies it
- require deep review only for larger/high-risk completed units
- keep command-assisted OpenCode as enough for narrow tasks
- invest in bridge delivery only after evidence capture proves value

The eval does not succeed if it only shows:

- packets are possible
- artifacts are longer
- state diagrams are cleaner
- automation feels impressive
- the same decisions would have happened faster in plain OpenCode

## Stop Or Narrow Conditions

Stop or narrow Wave 6 if, after meaningful loops:

- manual or command-assisted OpenCode is consistently as good or better
- packet capture adds more overhead than it removes
- Meta review does not become faster or more accurate
- false-positive findings increase
- gate decisions are mostly obvious without the ledger
- private learning rows do not change later policy
- external target-repo trial cannot be completed without unsafe disclosure

## Privacy Rules

Raw evaluation rows are private by default.

Private raw evidence may include:

- exact packet contents
- prompts
- finding details
- target-repo context
- failure examples
- operator workflow heuristics

Sanitized output may include:

- aggregate metrics
- generalized before/after loop diagrams
- non-sensitive case-study summary
- high-level lessons

No public output should include the strongest private review/gate heuristics without explicit release review.

## First Eval Recommendation

The first Wave 6 eval should not wait for OpenCode API delivery.

Recommended first test:

- one real Meta/Track loop
- packet/evidence captured manually or semi-manually
- no auto-delivery
- no commit/push automation
- record friction and review-quality metrics

If this does not produce a useful audit trail, do not build the bridge yet.
