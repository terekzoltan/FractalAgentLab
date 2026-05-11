# Wave6 W6-S1 Meta W6-D Step 3A Capture Brief

## Status

Meta Coordinator capture brief for `W6-D` Step 3A.

Execution mode: `manual_policy_driven`

Visibility / audit state:

- git-visible code, tests, docs, and recent commits were consulted
- local-only `ops/` coordination docs were consulted
- no `data/` evidence artifacts were consulted for this brief
- conclusions depend on local-only coordination context for review-loop chronology

Readiness verdict: `GREEN` for Track E Step 3B capture, with the guardrails below.

## Purpose

`W6-D` must prove that the Wave 6 manual ledger can capture one real FAL Meta/Track loop without becoming workflow theater.

This brief selects the first target loop and defines exactly what Track E should capture with the accepted `W6-C` recorder.

## Selected Target

Capture target:

- loop: W6-S1 Step 2 shared-boundary review/fix loop that led to `62bd245 Complete W6 OpenCode evidence ledger`
- practical focus: W6-B state-machine false-green fix plus W6-C recorder clean-pass false-green fix
- primary reason: the loop contains real high-severity false-green review findings, fixes, re-review, and acceptance
- target repo: `FractalAgentLab`

Recommended recorder fields:

```text
schema_version: w6.manual_evidence_input.v1
loop_id: w6d-fal-w6bc-review-fix-20260508
target_repo: FractalAgentLab
sequence_ref: W6-S1/W6-D/step3-first-real-loop-capture
task_type: w6_shared_boundary_review_fix_capture
complexity_class: shared_boundary
mode: fal_evidence_backed
net_recommendation: insufficient_data
```

`net_recommendation` should remain `insufficient_data` unless the capture itself shows the ledger is clearly harmful or clearly useful. One loop is a seed row, not broad usefulness proof.

## Ownership Boundaries

Meta Coordinator owns:

- target selection
- privacy and no-claim boundaries
- acceptance criteria for the capture
- final decision after Track E returns evidence

Track E owns:

- W6-C recorder input assembly
- running the recorder
- private output inspection
- usefulness seed row interpretation
- continue / narrow / stop recommendation

Track B is evidence/source context only for this W6-D capture:

- W6-B transition-validator behavior
- RF-2026-05-08-02 fix evidence
- computed transition validation truth consumed by W6-C

Selected originating Track support:

- Track E is the primary capture executor.
- Track B context may be referenced as linked evidence.
- Do not blur this into new Track B implementation work.

## Required Packet Chain

Track E should build one recorder input whose packets form this state-machine path:

| Order | Packet ID | Stage | Decision | Preferred source_command | Meaning |
|---|---|---|---|---|---|
| 1 | `w6d-plan-ready` | `plan_ready_for_meta_review` | null | `/seq-next` | Track plan/readiness for W6-B/W6-C Step 2 work |
| 2 | `w6d-plan-review` | `meta_plan_review_done` | `greenlit` | `/terv-review` | Meta plan review allowed Step 2 implementation path |
| 3 | `w6d-plan-ack` | `plan_review_acknowledged` | null | `/terv-review-utan` | Track acknowledged accepted plan/review guidance |
| 4 | `w6d-implementation-done` | `implementation_done` | null | `/implement` | W6-B/W6-C implementation completed before review |
| 5 | `w6d-step-review-red` | `step_review_done` | `fix_required` | `/step-review` | Meta review found false-green blockers |
| 6 | `w6d-review-fix-done` | `review_fix_done` | null | `/review-fix` | Track fixes addressed review findings |
| 7 | `w6d-step-review-green` | `step_review_done` | `pass` | `/step-review` | Meta re-review accepted the fixed loop |
| 8 | `w6d-step-ack` | `step_review_acknowledged` | null | `manual_operator_action` | Meta/operator closes the captured loop for W6-D evidence |

Rules:

- Use known `source_command` values only.
- Use non-`unknown` Track labels wherever evidence identifies the Track.
- Use `manual_operator_action` for the final acknowledgement unless Track E is copying an actual `/step-review` acknowledgement artifact.
- Every packet must use the same `loop_id` and `sequence_ref`.
- `parent_packet_id` should reference the immediately prior packet after the first packet.
- `privacy_classification` must be `private_raw`.
- Do not use `sanitized_public` in recorder packets.

## Required Review Findings

Track E should record at least these findings in `review_findings` if the supporting evidence is present:

| Finding ID | Severity | Status | Owner Context | Summary |
|---|---|---|---|---|
| `RF-2026-05-08-02` | `high` | `fixed` | Track B | Invalid post-closure W6 packet history exposed closed/commit-ready flags even after errors |
| `RF-2026-05-08-03` | `high` | `fixed` | Track E + Track B | W6-C clean-pass could ignore non-pass decisions or unavailable/failed transition validation |

Finding rules:

- Use `status: fixed` only for findings actually addressed by the accepted re-review.
- If a finding was only accepted or deferred, keep that status and explain why `clean_pass` is weaker.
- Do not record the Track C checkpoint cautions as primary review findings unless they were part of the captured W6-B/W6-C loop; carry them as W6-D guardrails instead.

## Required Payload Semantics

`payload_summary` is only a short index. It is not semantic proof.

Packet payloads must carry the required stage-specific fields from `w6.packet.v1`, especially:

- plan packets: assumptions, risks, dependencies, affected files/surfaces, acceptance checks, explicit non-goals
- Meta plan review packets: findings-first plan review, required changes, blockers, residual risks, Meta guidance, handoff summary
- implementation packets: implementation summary, changed files, tests/checks run, missing/skipped checks, deviations, known gaps, review request
- step review packets: findings-first implementation review, missing tests, required fixes, residual risks, commit-readiness recommendation, deep-review flag
- review-fix packets: fixed findings, files changed, validation rerun summary, residual risk note, re-review request
- acknowledgement packets: consumed packet reference, Track/operator response, final acknowledgement or next action

## Evidence References To Prefer

Track E should prefer concrete, durable references over chat-memory-only claims:

- commit `62bd245 Complete W6 OpenCode evidence ledger`
- commit `2729d83 Complete W6-A packet ledger contract`
- `ops/Review-Findings-Registry.md` entries `RF-2026-05-08-02` and `RF-2026-05-08-03`
- `docs/private/Wave6-W6-S1-TrackB-W6-B-State-Machine-Validator.md`
- `docs/private/Wave6-W6-S1-TrackE-W6-C-Manual-Evidence-Recorder.md`
- `src/fractal_agent_lab/core/contracts/w6_state_machine.py`
- `src/fractal_agent_lab/evals/w6_manual_evidence_recorder.py`
- relevant W6 tests under `tests/core/contracts/`, `tests/evals/`, `tests/scripts/`, and `tests/tracing/`

If exact historical test output is not durable, do not invent it. Record the claimed command as evidence context and list any unrunnable/unverified check under `missing_tests_or_skipped_checks`.

## Final Status Rules

Track E should choose `final_status` as follows:

- `pass`: only if W6-B computed transition validation passes, the loop is closed/commit-ready, no packet/recorder warnings exist, no missing/skipped checks are present, and no unresolved accepted/deferred/fix-required findings remain.
- `pass_with_warnings`: use when the loop was accepted but evidence has warnings, missing historical verification, weak command/Track labels, or findings that must be interpreted alongside `clean_pass`.
- `hold`: use when the evidence is meaningful but insufficient for a W6-D recommendation.
- `blocked`: use when the recorder input cannot be assembled without fabricating evidence or violating privacy/no-claim boundaries.

Even when the recorder returns `clean_pass: true`, Track E must separately interpret `review_findings.json`. `clean_pass` is transition/test/packet cleanliness, not proof that the loop had no important findings.

## Required W6-D Outputs

Track E Step 3B must produce private/local outputs through W6-C:

```text
data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/packets/*.json
data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/ledger.json
data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/review_findings.json
data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/usefulness_row.json
data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/summary.md
```

Track E should also return a short handoff to Meta with:

- recorder command used
- script exit status
- output paths
- `final_status`
- `clean_pass`
- computed transition validation status
- review findings count and statuses
- missing/skipped checks count
- recommendation: `continue`, `narrow`, `stop`, or `insufficient_data`

## Suggested Recorder Command

After assembling the operator input JSON, Track E should run:

```bash
PYTHONPATH=src python scripts/run_w6_c_manual_evidence_recorder.py --input <operator-input-json> --data-dir data
```

The operator input JSON is private raw evidence. It does not become public-safe merely because the recorder accepts it.

## Acceptance Criteria

Step 3B is acceptable only if:

- recorder input validates without partial writes
- output is under `data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/`
- transition validation source is `computed_w6_b`
- transition validation status is clearly reported
- `review_findings.json` preserves RF-2026-05-08-02 / RF-2026-05-08-03 status truth or explains why one is excluded
- `usefulness_row.json` keeps `claim_boundary: single_loop_seed_row_only_not_broad_usefulness_claim`
- `summary.md` does not claim public case-study readiness, broad usefulness proof, OpenCode automation, bridge/API delivery, commit automation, or push automation
- Track E gives Meta a continue/narrow/stop/insufficient-data recommendation

## Risks And Edge Cases

- Historical loop reconstruction can accidentally overstate evidence if chat-only claims are treated as durable artifacts.
- The selected target spans Track B and Track E; if this creates packet ambiguity, Track E should narrow the packet chain to W6-C and treat W6-B as linked dependency evidence.
- Unknown `source_command` or `unknown` Track labels weaken the evidence and should prevent clean-pass interpretation.
- Fixed findings are still useful evidence; they should not be hidden to make the loop look cleaner.
- One seed row cannot justify W6-G bridge/API readiness.

## Next Gate

Track E may start W6-D Step 3B capture from this brief.

Meta should not open W6-E until Track E returns W6-D evidence and Meta decides the result is not negative.
