# Wave1-W1-S1-TrackB-Stabilization.md

## Purpose

This document records Track B implementation for the Wave 1 stabilization mini-batch:

- `W1-S1-FIX-B1`
- `W1-S1-FIX-B2`
- `W1-S1-FIX-B3`
- `W1-S1-FIX-B4`

Reference plan: `docs/Wave1-W1-S1-Stabilization-Plan.md`.

---

## Scope

In scope:

- baseline execution-mode contract correctness (`h1.single.v1`)
- manager decision parser correctness (first valid envelope wins)
- missing manager-runtime guardrail tests
- execution-mode truth hardening for additional linear workflows (`h1.lite`, `wave0.demo`)
- manager-spec worker-set validation hardening

Out of scope:

- mock strictness and model-tier default realignment (Track D scope)
- stabilization closeout decision log (Meta scope)
- handoff primitive implementation (`L1-F`)

---

## Implemented Changes

### `W1-S1-FIX-B1` — Baseline execution-mode mismatch

Updated `h1.single.v1` to reflect the real executor branch it uses:

- `src/fractal_agent_lab/workflows/h1_single.py`
  - `execution_mode` changed from `manager` to `linear`

Supporting contract and test alignment:

- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
  - added `WorkflowExecutionMode.LINEAR`
- `tests/workflows/test_h1_single_workflow_spec.py`
  - assertion updated to `WorkflowExecutionMode.LINEAR`

---

### `W1-S1-FIX-B2` — Manager parser first-valid behavior

Updated manager control parsing to evaluate candidate envelopes in order and return the first valid parse result:

- `src/fractal_agent_lab/runtime/executor.py`
  - `_try_parse_manager_decision(...)` now iterates all discovered candidates
  - added `_parse_control_candidate(...)` helper

Behavioral result:

- invalid top-level `control` no longer suppresses valid nested `output.control` or `raw.control`

---

### `W1-S1-FIX-B3` — Manager guardrail tests

Added dedicated runtime-level tests:

- `tests/runtime/test_workflow_executor_manager.py`
  - invalid delegate target -> failure
  - revisit rejection when revisits disabled -> failure
  - max-turn exhaustion -> failure
  - fallback behavior without manager control envelope -> success with expected turn actions
  - first valid nested control (`output.control`) -> honored
  - first valid nested control (`raw.control`) -> honored

Added package marker:

- `tests/runtime/__init__.py`

---

### `W1-S1-FIX-B4` — Execution-mode truth hardening and manager-spec validation

Execution-mode truth hardening updates:

- `src/fractal_agent_lab/workflows/h1_lite.py`
  - `execution_mode` changed from `manager` to `linear`
- `src/fractal_agent_lab/cli/workflow_registry.py`
  - `wave0.demo` `execution_mode` changed from `manager` to `linear`
- `src/fractal_agent_lab/runtime/executor.py`
  - run-started and run-completed metadata now emit effective runtime branch mode
  - runtime branch routing now uses explicit effective mode derivation

Manager-spec validation updates:

- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
  - manager mode now requires non-null `manager_spec`
  - `manager_spec` now requires manager execution mode
  - `manager_spec.worker_step_ids` cannot include `manager_step_id`

Runtime invariant tests added:

- `tests/runtime/test_execution_mode_truth.py`
  - `h1.lite` declares linear + no manager spec
  - `wave0.demo` declares linear + no manager spec
  - emitted run execution mode and step lane reflect linear runtime branch
- `tests/runtime/test_workflow_executor_manager.py`
  - added manager-mode/manager-spec invariants for fail-fast validation

---

## Validation

Executed checks:

1. `python -m compileall src tests`
2. targeted manager/workflow tests
3. related adapter/CLI regression tests
4. CLI smoke runs for `h1.lite` and `wave0.demo` with trace output

Runtime test command form used:

```bash
python -c "import sys, unittest; sys.path.append('src'); ..."
```

All executed checks passed.

---

## Downstream Impact

### Track D

- can now apply `W1-S1-FIX-D1/D2` against stabilized runtime semantics

### Track A

- baseline workflow metadata now correctly distinguishes linear vs manager orchestration

### Track E

- baseline-vs-manager comparisons are less likely to be skewed by execution-mode mislabeling

### Track C

- no prompt/schema ownership change required from this stabilization batch

---

## Current Frontier

Track B stabilization fixes are complete, and the full W1-S1 stabilization batch is now closed.

The active frontier has returned to normal Wave 1 sequencing:

1. Track B `L1-F`
2. Track C `L1-G`
3. Track B `L1-H`
4. Track E `L1-I`
