# Wave3-W3-S1-TrackB-R3-A-Schema-Review.md

## Purpose

This document records Track B review outcomes for Wave 3 Sprint `W3-S1` Step 2 epic:

- `R3-A` schema review (H2 workflow schema contract confirmation)

---

## Scope

In scope:

- confirm `h2.manager.v1` schema compatibility with Track B runtime contract boundaries
- confirm manager topology invariants and pre-runtime guardrail coverage
- close manager-schema invariant gaps that are practical to reject before runtime

Out of scope:

- H2 role-pack implementation (`R3-B`)
- H2 output template finalization (`R3-C`)
- H2 smoke rubric work (`R3-D`)
- workflow registry/CLI public wiring as part of the Track B review implementation itself
- runtime branch expansion specific to H2

---

## Reviewed Surfaces

- `src/fractal_agent_lab/workflows/h2.py`
- `tests/workflows/test_h2_workflow_spec.py`
- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
- `tests/runtime/test_workflow_executor_manager.py`
- `src/fractal_agent_lab/runtime/executor.py`
- `src/fractal_agent_lab/cli/workflow_registry.py` (boundary confirmation only)

---

## Confirmation Outcome

### Confirmed schema/runtime boundary invariants

- `h2.manager.v1` remains a manager-mode workflow and uses the existing generic manager runtime path.
- manager topology is explicit and stable:
  - manager step: `synthesizer`
  - workers: `intake`, `planner`, `architect`, `critic`
- manager orchestration output remains the shared additive shape:
  - `output_payload.step_results`
  - `output_payload.manager_orchestration`
  - `output_payload.final_output`
- no H2-specific runtime branch or core schema redesign is required.

### Pre-runtime invariant hardening applied

`WorkflowSpec` manager validation now rejects before runtime:

- unknown `manager_spec.manager_step_id`
- empty `manager_spec.worker_step_ids`
- duplicate `manager_spec.worker_step_ids`
- unknown worker step IDs in `manager_spec.worker_step_ids`
- manager workflow entrypoint mismatch (`entrypoint_step_id != manager_step_id`)

Existing invariants remain:

- manager mode requires non-null `manager_spec`
- `manager_spec` requires manager execution mode
- manager step cannot appear in worker set
- duplicate workflow `step_id` rejection

---

## Tests Added/Updated

Updated:

- `tests/runtime/test_workflow_executor_manager.py`
  - `manager_spec` requires manager execution mode
  - manager step must reference declared step
  - worker IDs must reference declared steps
  - worker list cannot be empty
  - worker list cannot contain duplicates
  - manager `max_turns` must be positive
  - manager entrypoint must match manager step
- `tests/workflows/test_h2_workflow_spec.py`
  - stronger explicit schema assertions for H2 name/version/metadata/topology

---

## Boundary Notes

- `R3-A` Track B review remains contract-first; registry/pack wiring belongs to `R3-B`, even though later repo state may already include that Track C integration.
- No H2 agent pack, no H2 summary/eval projection, and no CLI run-surface expansion are introduced here.
- This review confirms schema correctness and runtime compatibility expectations only.

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.workflows.test_h2_workflow_spec tests.runtime.test_workflow_executor_manager tests.workflows.test_h1_workflow_spec`
3. `PYTHONPATH=src python -m unittest discover tests`

Observed:

- targeted schema/runtime suites pass
- full test suite passes

---

## Downstream Handoff

- Track C can continue `R3-B` role pack work on top of a stricter manager-schema contract.
- Track E can prepare `R3-D` smoke skeleton/finalization against confirmed manager boundary assumptions.
- Track B returns at `R3-E` schema review checkpoint.
