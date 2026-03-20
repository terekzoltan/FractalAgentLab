# Wave1-L1-I-H1-Smoke-Comparison.md

## Purpose

This document records Track E delivery for Wave 1 epic `L1-I`.

`L1-I` runs and compares the three H1 variants on matched input:

- baseline (`h1.single.v1`)
- manager (`h1.manager.v1`)
- handoff (`h1.handoff.v1`)

The goal is anti-self-deception smoke evidence, not winner scoring.

---

## Scope

In scope:

- run all three H1 variants under matched input/provider settings
- validate run/trace artifacts for each run
- normalize variant output envelopes into one comparable key set
- report structural orchestration signals from trace/run payloads

Out of scope:

- quality winner decision (`L1-L`)
- manual smoke rubric v1 (`L1-K`)
- judge scoring or benchmark growth

---

## Implemented Files

- `src/fractal_agent_lab/evals/h1_smoke_comparison.py`
- `src/fractal_agent_lab/evals/__init__.py`
- `scripts/run_l1_i_h1_smoke_comparison.py`
- `tests/evals/test_h1_smoke_comparison.py`

Status surfaces updated:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Comparison Method

Shared execution settings:

- one input payload
- one provider (default: `mock`)
- one runtime/model-policy config set

Compared workflow set:

- `h1.single.v1`
- `h1.manager.v1`
- `h1.handoff.v1`

Per-variant output includes:

- run status and run id
- run/trace artifact paths
- artifact validation pass/errors/warnings
- trace event/lane counts and handoff-specific signal counts
- normalized comparable output keys

---

## Normalization Contract (Track E)

All variants are normalized to these keys:

- `clarified_idea`
- `strongest_assumptions`
- `weak_points`
- `alternatives`
- `recommended_mvp_direction`
- `next_3_validation_steps`

Envelope mapping:

- baseline: `output_payload.step_results.single.output`
- manager/handoff: `output_payload.final_output`

Missing keys are reported explicitly per variant.

Stabilization hardening (`W1-S2-FIX-E1`):

- envelope presence alone is not enough for green status
- a variant counts as comparable only when all normalized keys are complete

---

## Validation

Executed checks:

- `PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py"`
- `PYTHONPATH=src python scripts/run_l1_i_h1_smoke_comparison.py --provider mock`
- `PYTHONPATH=src python -m compileall src tests scripts`

Observed outcome:

- all three variants run successfully
- all three artifact pairs pass Track E artifact acceptance
- normalized comparable outputs are complete for all variants

---

## Known Limits

- Mock outputs are variant-authored and are not a fair quality benchmark.
- This epic reports structural smoke evidence, not a final orchestration winner.
- CLI workflow summary now exposes variant-parity H1 comparable fields after `W1-S2-FIX-A1`; `L1-I` comparison should still use this eval report/artifacts as canonical smoke evidence.

---

## Downstream Handoff

- `L1-K`: use this report to define H1 smoke rubric v1 gates.
- `L1-L`: use this report as baseline evidence input for Wave 1 decision log.
