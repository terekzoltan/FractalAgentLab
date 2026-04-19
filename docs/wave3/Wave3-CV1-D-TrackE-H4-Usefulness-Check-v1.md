# Wave3-CV1-D-TrackE-H4-Usefulness-Check-v1

## Purpose

Track E delivery for `CV1-D` in the `CV1` Step 3 lane.

This thin check evaluates whether canonical H4 planning artifacts are materially more inspectable and readiness-honest than an unstructured one-shot baseline plan.

---

## Scope

In scope:

- inspect-first, artifact-backed `CV1-D` helper/script/test surface
- matched-task baseline comparison with explicit operator intent disclosure
- lane-split reporting:
  - `seq_next` lane as main usefulness verdict lane
  - `wave_start` lane as additive inspectability/transport-legibility lane

Out of scope:

- autonomous implementation claims
- H5/CV2 spillover
- packet/session-bus expansion
- live-run orchestration in this Track E slice

---

## Canonical Evidence Law

Main `CV1-D` usefulness verdict uses canonical evidence first:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/implementation_plan.md`
- `data/artifacts/<run_id>/acceptance_checks.json`

`wave_start` packet sidecars remain additive-only evidence:

- `data/artifacts/<run_id>/packets/wave_start.packet.json`
- `data/artifacts/<run_id>/packets/wave_start.packet.md`

Packet sidecar gaps do not automatically block the main usefulness verdict.

References:

- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`
- `docs/wave3/Wave3-CV1-C-TrackD-H4-Helper-Surface-v1.md`

---

## Implemented Surfaces

- `src/fractal_agent_lab/evals/cv1_d_h4_usefulness_check.py`
- `scripts/run_cv1_d_h4_usefulness_check.py`
- `tests/evals/test_cv1_d_h4_usefulness_check.py`
- `docs/wave3/Wave3-CV1-D-TrackE-H4-Usefulness-Check-v1.md`

---

## Outcome Semantics

Main summary fields:

- `track_e_evidence_ready`
- `h4_usefulness_passed`
- `packet_legibility_demonstrated`
- `eval_outcome`
- `blocked_reason`

Outcome split:

- `BLOCKED`: required main comparison evidence unavailable (missing seq_next run, missing baseline, missing canonical run/trace pair, replay not ready, or missing matched-task intent assertion)
- `FAIL`: evidence exists but bounded usefulness claim does not hold, or canonical H4 artifacts are structurally inadequate
- `PASS`: evidence exists and bounded usefulness claim is demonstrated in the main `seq_next` lane

Additional strictness:

- `h4.seq_next.v1` run status must be `succeeded` for main usefulness `PASS`
- empty baseline file is treated as missing comparison evidence and yields `BLOCKED`

---

## Validation

Run the dedicated test module:

1. `PYTHONPATH=src python -m unittest tests.evals.test_cv1_d_h4_usefulness_check`

Run the inspect-first helper script:

1. `PYTHONPATH=src python -m scripts.run_cv1_d_h4_usefulness_check --seq-next-run-id <run_id> --baseline-plan <path> --comparison-task-intent "same task intent" --data-dir data`
2. optional additive lane: add `--wave-start-run-id <run_id>`

Script exit semantics:

- `0`: `PASS`
- `1`: `FAIL`
- `3`: `BLOCKED`

---

## Known Limits

- Baseline is external/manual and non-canonical by design.
- Matched-input discipline depends on explicit operator assertion (`comparison_task_intent`).
- Packet lane is additive evidence; absence of packet proof does not redefine canonical artifact-law verdicts.

---

## Downstream Note

- This closes Track E implementation scope for the thin `CV1-D` eval surface.
- Final sequencing closeout remains dependent on actual local evidence outcomes (`PASS`/`FAIL`/`BLOCKED`) rather than helper availability alone.
