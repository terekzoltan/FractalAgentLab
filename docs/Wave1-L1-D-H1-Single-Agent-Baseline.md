# Wave1-L1-D-H1-Single-Agent-Baseline.md

## Purpose

This document records Track E delivery for Wave 1 epic `L1-D`.

`L1-D` establishes a single-agent H1 reference path so Wave 1 can compare orchestration variants against a simple baseline.

---

## Scope

In scope:

- single-agent H1 baseline workflow path (`h1.single.v1`)
- baseline agent pack wiring for CLI execution
- mock-path baseline output shape suitable for manual comparison
- test coverage for workflow contract and end-to-end mock execution

Out of scope:

- baseline-vs-manager decision log (`L1-L`)
- handoff comparison (`L1-I`)
- rubric formalization (`L1-K`)

---

## Implemented Files

- `src/fractal_agent_lab/workflows/h1_single.py`
- `src/fractal_agent_lab/workflows/__init__.py`
- `src/fractal_agent_lab/agents/h1/prompts.py`
- `src/fractal_agent_lab/agents/h1/pack.py`
- `src/fractal_agent_lab/agents/h1/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/workflows/test_h1_single_workflow_spec.py`
- `tests/adapters/test_h1_single_step_runner.py`
- `tests/agents/test_h1_pack.py`

---

## Baseline Identity

- workflow id: `h1.single.v1`
- variant metadata: `single_agent_baseline`
- baseline target metadata: `h1.manager.v1`

Contract alignment:

- input schema ref: `h1.input.v1`
- output schema ref: `h1.single.output.v1`
- schema contract: `h1.workflow.v1`

Execution shape:

- one step: `single`
- one agent: `h1_single_agent`
- no `manager_spec` (executor uses linear branch)

---

## Comparison Intent

The baseline output is intentionally shaped around the same H1 decision fields used by manager finalization:

- `clarified_idea`
- `strongest_assumptions`
- `weak_points`
- `alternatives`
- `recommended_mvp_direction`
- `next_3_validation_steps`

This does not claim quality superiority.
It creates a stable reference for later comparison epics.

---

## Validation

Executed checks:

- `PYTHONPATH=src python -m unittest discover -s tests -p "test_*.py"`
- `PYTHONPATH=src python -m compileall src tests scripts`

Validation focus:

- baseline workflow contract integrity
- baseline pack integrity
- end-to-end mock run success for `h1.single.v1`

---

## Known Limits

- Baseline and manager output envelopes still differ at runtime payload shape.
- This epic does not perform comparison scoring.
- This epic does not normalize outputs for judge/rubric consumption yet.

These are addressed in later Wave 1 eval steps (`L1-I`, `L1-K`, `L1-L`).

---

## Downstream Handoff

- `L1-E` can now format H1 outputs with an explicit baseline path present.
- `L1-I` can compare baseline vs manager vs handoff once handoff variant is available.
- `L1-K` can reference this baseline in smoke rubric v1 acceptance criteria.
