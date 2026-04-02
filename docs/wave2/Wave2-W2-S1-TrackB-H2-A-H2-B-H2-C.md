# Wave2-W2-S1-TrackB-H2-A-H2-B-H2-C.md

## Purpose

This document records Track B implementation for Wave 2 Sprint `W2-S1` Step 1:

- `H2-A` RunState hardening v1
- `H2-B` TraceEvent versioned contract v1
- `H2-C` failure classification and error envelope v1

The implementation follows additive compatibility constraints: existing v0 fields remain present, while new structured fields are introduced without removing prior keys.

---

## Scope

In scope:

- additive `RunState` v1 hardening
- additive `TraceEvent` v1 contract versioning
- structured failure taxonomy and runtime error envelope v1
- terminal failure envelope propagation to run artifacts and trace payloads
- artifact validation hardening and negative-path tests

Out of scope:

- persistence layout redesign (`H2-D`)
- replay engine implementation (`H2-E`)

---

## Implemented Changes

### H2-A - RunState hardening v1

Updated:

- `src/fractal_agent_lab/core/models/run_state.py`

Changes:

- schema version bumped to `run_state.v1`
- added additive structured field: `failure: dict[str, Any] | None`
- added additive lifecycle field: `status_transitions: list[dict[str, Any]]`
- lifecycle transitions now recorded from initial pending state through terminal state
- failure and timeout paths can persist structured failure envelopes

Compatibility note:

- existing fields (`errors`, `context`, `trace_event_ids`, timestamps, `output_payload`, `step_results`) remain present

### H2-B - TraceEvent versioned contract v1

Updated:

- `src/fractal_agent_lab/core/events/trace_event.py`

Changes:

- schema version bumped to `trace_event.v1`
- event envelope fields remain additive-compatible with v0 consumers
- linkage fields (`parent_event_id`, `correlation_id`) remain first-class

### H2-C - Failure classification and error envelope v1

Updated:

- `src/fractal_agent_lab/core/errors/runtime_errors.py`
- `src/fractal_agent_lab/core/errors/__init__.py`
- `src/fractal_agent_lab/core/__init__.py`
- `src/fractal_agent_lab/runtime/executor.py`

Changes:

- introduced `FailureCategory` taxonomy:
  - `contract`
  - `runtime_boundary`
  - `step_execution`
  - `timeout`
  - `budget`
  - `orchestration_control`
  - `unknown`
- introduced `RuntimeErrorEnvelope` with schema `runtime_error_envelope.v1`
- runtime subclasses now carry explicit category defaults
- terminal run failures/timeouts persist structured failure envelopes to `RunState.failure`
- terminal trace payloads now include `failure_envelope` while preserving existing keys (`code`, `error`, `details`)
- step-level failure events (`agent_failed`, `step_failed`) now include additive failure metadata

---

## Cross-Surface Hardening

Updated:

- `src/fractal_agent_lab/evals/artifact_acceptance.py`
- `src/fractal_agent_lab/cli/formatting.py`

Artifact acceptance additions:

- supports both v0 and v1 run/trace schema versions
- rejects unsupported schema versions
- validates trace `event_id` uniqueness
- validates trace timestamp ISO format
- validates payload object type
- validates `trace_event_ids` ordering equality with trace event ids
- enforces `run_state.v1` failed/timed_out structured `failure` presence
- enforces `run_state.v1` non-empty `status_transitions`

CLI cross-surface alignment:

- trace summary ordered event list now includes `run_cancelled`

---

## Tests Added/Updated

Updated:

- `tests/runtime/test_execution_mode_truth.py`
- `tests/evals/test_artifact_acceptance.py`

Added:

- `tests/runtime/test_failure_envelope.py`

Negative-path coverage added for:

- duplicate trace `event_id`
- invalid timestamp format
- unsupported trace schema version
- v1 failed run without structured `failure`
- mismatched `trace_event_ids` ordering

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.runtime.test_execution_mode_truth tests.runtime.test_failure_envelope tests.evals.test_artifact_acceptance tests.cli.test_l1_e_h1_summary tests.cli.test_l1_j_trace_viewer tests.evals.test_h1_smoke_comparison`
3. `PYTHONPATH=src python -m unittest discover tests`

Observed:

- targeted runtime/eval/cli suites passed
- full test discovery passed

Follow-up alignment:

- artifact acceptance allows valid pre-step terminal failures (for example unsupported-mode failures that emit `run_started` then `run_failed` without any `step_started` event)
- regression coverage now includes a passing v1 pre-step failure artifact case

---

## Downstream Impact

- Track A can continue consuming trace linkage fields and v1 schema metadata without losing v0 compatibility assumptions.
- Track E has stricter artifact validity guarantees before replay foundation (`H2-E`).
- Track C identity/memory prep remains compatible with additive `RunState.context` and permissive trace payload usage.
- Track B can now start `H2-D` on top of hardened run/trace/error contracts.
