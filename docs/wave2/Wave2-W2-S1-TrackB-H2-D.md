# Wave2-W2-S1-TrackB-H2-D.md

## Purpose

This document records Track B implementation for Wave 2 Sprint `W2-S1` epic `H2-D`:

- run persistence layout for runs/traces/artifacts

The implementation keeps canonical run/trace persistence stable while centralizing path resolution for downstream consumers.

---

## Scope

In scope:

- central artifact layout path module
- canonical run/trace path resolution hardening
- additive per-run artifact-sidecar path surface
- writer/reader/eval alignment on one shared path contract

Out of scope:

- replay engine implementation (`H2-E`)
- memory/identity storage logic (`H2-I`/`H2-M`)
- canonical migration to per-run run/trace directories

---

## Implemented Layout Contract

Canonical run/trace truth remains unchanged:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

Additive sidecar-ready surface introduced:

- `data/artifacts/<run_id>/`

This keeps existing Track A/Track E consumers stable while giving replay/memory/coding-vertical extensions a dedicated non-canonical area.

---

## Implemented Files

### New

- `src/fractal_agent_lab/tracing/artifact_layout.py`

### Updated

- `src/fractal_agent_lab/tracing/artifact_writer.py`
- `src/fractal_agent_lab/tracing/__init__.py`
- `src/fractal_agent_lab/cli/trace_reader.py`
- `src/fractal_agent_lab/evals/artifact_acceptance.py`

---

## Runtime/Eval/CLI Alignment

Path assembly for run/trace artifacts is now centralized and shared across:

- writer (`write_run_artifact`, `write_trace_artifact`)
- CLI trace viewer load path (`trace show`)
- artifact acceptance lookup by `run_id`

This removes duplicated hardcoded path construction and reduces cross-surface drift risk.

---

## Tests Added

### New test module

- `tests/tracing/test_artifact_layout.py`

Coverage includes:

- canonical run/trace path derivation
- additive sidecar path derivation
- custom data-dir path support

### Existing suites re-validated

- `tests/cli/test_l1_j_trace_viewer.py`
- `tests/evals/test_artifact_acceptance.py`
- `tests/evals/test_h1_smoke_comparison.py`

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.tracing.test_artifact_layout tests.cli.test_l1_j_trace_viewer tests.evals.test_artifact_acceptance tests.evals.test_h1_smoke_comparison`
3. `PYTHONPATH=src python -m unittest discover tests`

Observed:

- targeted suites passed
- full test suite passed

Follow-up alignment:

- CLI trace reading now fails loudly on non-monotonic stored event sequence instead of silently reordering malformed artifacts
- coding-vertical sidecar docs are aligned to the shared `data/artifacts/<run_id>/` per-run sidecar path

---

## Downstream Impact

- Track E replay foundation (`H2-E`) can rely on a single persistence-layout resolver.
- Track C memory/identity foundations (`H2-I`/`H2-M`) are unblocked from run/trace path churn.
- Track A trace viewer keeps canonical behavior while inheriting centralized path logic.
- Coding-vertical sidecar direction remains compatible with canonical run/trace truth.
