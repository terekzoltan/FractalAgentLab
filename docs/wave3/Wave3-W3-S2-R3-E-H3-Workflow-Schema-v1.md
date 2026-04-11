# Wave3-W3-S2-R3-E-H3-Workflow-Schema-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S2` Step 1 epic `R3-E`.

`R3-E` defines the executable `H3` workflow schema baseline (`h3.manager.v1`) with explicit manager topology and manager-runtime compatibility evidence.

---

## Scope

In scope:

- add H3 manager workflow schema module (`h3.manager.v1`)
- expose H3 workflow constants and builder from root workflows package
- add H3 workflow-spec tests for schema shape and manager control-turn behavior
- keep manager output envelope compatibility explicit

Out of scope:

- `agents/h3/*` role pack implementation (`R3-F`)
- H3 output section freeze (`R3-G`)
- H3 smoke rubric prep/finalization (`R3-H`)
- workflow registry wiring
- mock adapter H3-specialized path
- runtime/core contract changes

---

## Implemented Files

New:

- `src/fractal_agent_lab/workflows/h3.py`
- `tests/workflows/test_h3_workflow_spec.py`

Updated:

- `src/fractal_agent_lab/workflows/__init__.py`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## H3 Schema Contract v1

Workflow identity:

- workflow id: `h3.manager.v1`
- schema contract: `h3.workflow.v1`
- input schema ref: `h3.input.v1`
- output schema ref: `h3.manager.output.v1`

Topology:

- manager step: `synthesizer`
- worker steps: `intake`, `planner`, `systems`, `critic`
- entrypoint: `synthesizer`
- execution mode: `manager`
- manager max turns: `8`
- manager revisit workers: `false`

Metadata:

- `source=track_c.r3_e`
- `hero_workflow=H3`
- `variant=manager`
- `schema_contract=h3.workflow.v1`

---

## Guardrails Applied

Manager envelope compatibility:

- `R3-E` does not change manager top-level runtime output shape
- tests assert the existing manager envelope remains:
  - `step_results`
  - `manager_orchestration`
  - `final_output`
- H3-specific content is only inside `final_output`

Section naming freeze discipline:

- `R3-E` does not freeze exact final H3 section naming/order
- tests require representative H3 review content only
- exact section law remains `R3-G` scope

Evaluator deferral:

- executable `R3-E` topology is `synthesizer + intake + planner + systems + critic`
- evaluator remains deferred from this executable v1 schema

---

## Validation

Executed:

1. `PYTHONPATH=src python -m unittest tests.workflows.test_h3_workflow_spec`
2. `PYTHONPATH=src python -m unittest tests.runtime.test_workflow_executor_manager`
3. `PYTHONPATH=src python -m unittest tests.workflows.test_h1_workflow_spec tests.workflows.test_h2_workflow_spec`
4. `python -m compileall src tests`

Observed:

- H3 schema and manager-envelope compatibility tests pass
- shared manager runtime regression remains green
- H1/H2 workflow-spec suites remain green

---

## Downstream Handoff

- Track B reviews `R3-E` schema/runtime boundary compatibility in `W3-S2` Step 2.
- Track C proceeds to `R3-F` role pack once `R3-E` is accepted.
- H3 section naming/order freeze remains explicitly deferred to `R3-G`.
