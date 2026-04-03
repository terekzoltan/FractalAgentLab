# Wave2-W2-S2-TrackE-H2-E.md

## Purpose

This document records Track E implementation for Wave 2 Sprint `W2-S2` epic `H2-E`.

`H2-E` delivers artifact-backed replay/read/reconstruction for stored runs, with explicit preflight validation and no re-execution claims.

---

## Scope

In scope:

- `run_id + data_dir` replay input
- canonical run + trace artifact loading via shared path resolver
- mandatory `artifact_acceptance` preflight gate
- stored-artifact replay view and reconstruction output
- timeline + orchestration/path + linkage + failure summaries
- compatibility across `run_state.v0/v1` and `trace_event.v0/v1`
- H1 family coverage:
  - `h1.single.v1`
  - `h1.manager.v1`
  - `h1.handoff.v1`

Out of scope:

- deterministic rerun engine
- same-input rerun/compare logic
- smoke suite expansion (`H2-F`)
- baseline tagging/comparison pipeline (`H2-G`)
- sidecar artifact requirements
- persistence format changes

---

## Implemented Files

- `src/fractal_agent_lab/evals/artifact_replay.py`
- `src/fractal_agent_lab/evals/__init__.py`
- `scripts/run_h2_e_artifact_replay.py`
- `tests/evals/test_artifact_replay.py`

Status surfaces updated:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Replay Contract

Entry point:

- `replay_run_artifacts_by_id(run_id, data_dir="data")`

Execution model:

1. resolve paths through shared artifact layout helpers
2. run `validate_run_trace_by_run_id(...)`
3. if preflight fails, return `replay_ready=false` with explicit blockers
4. if preflight passes, build reconstruction report from stored run/trace payloads

No runtime execution path is invoked.

---

## Output Shape (H2-E replay report)

Top-level report fields:

- `report_version`
- `created_at`
- `run_id`
- `run_artifact_path`
- `trace_artifact_path`
- `artifact_validation`
- `replay_ready`
- `run_summary`
- `timeline`
- `linkage_summary`
- `orchestration_reconstruction`
- `failure_summary`
- `supported_h1_workflow`

Failure behavior:

- invalid artifacts return `replay_ready=false`
- `replay_blockers` contains preflight errors

---

## Guardrail Alignment

`H2-E` preserves the approved guardrails:

- no hardcoded run/trace path logic
- no assumption that every failed run has `step_started`
- linkage-aware reconstruction using `parent_event_id` and `correlation_id`
- replay remains read/reconstruct, not execution
- compatibility with both v0 and v1 artifact schema envelopes

---

## Validation

Executed checks:

1. `python -m compileall src tests scripts`
2. `PYTHONPATH=src python -m unittest tests.evals.test_artifact_replay tests.evals.test_artifact_acceptance tests.evals.test_h1_smoke_comparison`

Observed:

- `H2-E` replay tests pass for:
  - v0 single success
  - v1 manager success
  - v1 handoff linkage reconstruction
  - v1 pre-step failure replay
  - invalid artifact preflight blocking

---

## Downstream Handoff

- `H2-F` can build smoke gates on top of replay-ready artifact reconstruction.
- `H2-G` can layer baseline tagging/comparison once replay foundation is stable.
- Track C and Track B can rely on explicit replay failure summaries for cross-track review in `W2-S3`.
