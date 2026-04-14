# Wave3-W3-S3-TrackE-R3-K-H1-H2-Comparison-v1.md

## Purpose

This document records Track E delivery for Wave 3 Sprint `W3-S3` Step 1 epic `R3-K`.

`R3-K` establishes replay-backed comparison surfaces for H1/H2 without introducing winner-scoring,
benchmark claims, or runtime contract churn.

---

## Scope Guardrails

In scope:

- replay-backed H1 comparison surface reuse
- replay-backed H2 multi-run comparability surface for `h2.manager.v1`
- explicit structural readiness gates for compare outputs
- script/test coverage and documentation for repeatable compare evidence generation

Out of scope:

- quality winner selection logic
- benchmark/judge scoring semantics
- generic H1+H2 unified comparison engine abstraction
- runtime/CLI schema mutation for compare support

---

## Canonical Comparison Posture

- H1 = replay-backed **variant comparison** (`h1.single.v1`, `h1.manager.v1`, `h1.handoff.v1`)
- H2 = replay-backed **multi-run comparability** within one workflow family (`h2.manager.v1`)

Artifact-path evidence guardrail:

- run/trace artifact paths are sourced from replay/validation surfaces only
- CLI JSON output must not be treated as canonical artifact-path source

---

## Implemented Files

H2 compare contracts/projections/reports:

- `src/fractal_agent_lab/evals/h2_eval_contracts.py`
- `src/fractal_agent_lab/evals/h2_eval_projections.py`
- `src/fractal_agent_lab/evals/h2_run_comparison.py`

Script surface:

- `scripts/run_r3_k_h2_run_comparison.py`

Tests:

- `tests/evals/test_h2_eval_projections.py`
- `tests/evals/test_h2_run_comparison.py`

Export surface updates:

- `src/fractal_agent_lab/evals/__init__.py`

Status/coordination updates:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## H1 Reused Evidence Surfaces

`R3-K` reuses existing H1 replay-backed comparison surfaces:

- `src/fractal_agent_lab/evals/h1_smoke_suite.py`
- `src/fractal_agent_lab/evals/h1_baseline_tags.py`
- `src/fractal_agent_lab/evals/h1_artifact_set.py`

No new H1 compare engine is introduced in this step.

---

## H2 Comparison Surface Added

### H2 Contract

`h2.manager.v1` comparable keys and manager delegate-order expectation are captured in
`h2_eval_contracts.py`.

### H2 Projection

`extract_h2_comparable_output(...)` projects replayed run output into structural compare fields:

- output presence/completeness
- canonical key-order compliance
- `implementation_waves` shape validity
- `recommended_starting_slice` presence

### H2 Replay-backed Report

`run_h2_run_comparison_by_run_ids(...)` produces per-run and aggregate readiness report with:

- artifact validation and replay readiness
- expected workflow matching
- comparable-output completeness
- key-order and shape checks
- manager delegate-order compatibility

---

## Validation

Executed checks:

1. `PYTHONPATH=src python -m unittest tests.evals.test_h1_smoke_suite tests.evals.test_h1_baseline_tags tests.evals.test_h2_eval_projections tests.evals.test_h2_run_comparison`
2. `PYTHONPATH=src python -m unittest tests.evals.test_h1_smoke_comparison tests.evals.test_h1_evidence_prep tests.evals.test_artifact_replay tests.evals.test_artifact_acceptance`
3. `PYTHONPATH=src python scripts/run_r3_k_h2_run_comparison.py --run-id <h2_run_id_1> --run-id <h2_run_id_2> --data-dir data`

Observed:

- H1 compare reuse remains green on replay-backed structural gates
- H2 compare report fails loudly on workflow mismatch, key-order drift, or shape regressions
- comparison readiness remains structural/comparability-oriented, not winner-oriented

---

## Known Limits

- comparison reports are additive evidence surfaces and not canonical quality ranking systems
- H2 compare surface currently targets `h2.manager.v1` only
- cross-provider comparison and benchmark-grade scoring remain out of scope here

---

## Downstream Handoff

- `R3-L` evidence curation can consume `R3-K` H1/H2 comparison surfaces as validated inputs.
- Track E keeps compare success tied to replay-backed structural completeness, not envelope-only presence.
