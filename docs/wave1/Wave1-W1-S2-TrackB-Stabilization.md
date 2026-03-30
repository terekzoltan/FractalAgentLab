# Wave1-W1-S2-TrackB-Stabilization.md

## Purpose

This document records Track B implementation for the Wave 1 `W1-S2` stabilization fixes:

- `W1-S2-FIX-B1`
- `W1-S2-FIX-B2`

These are post-review hardening changes, not new orchestration features.

---

## Scope

In scope:

- explicit runtime rejection for unsupported execution modes
- workflow contract hardening for duplicate `step_id` values
- focused runtime/contract invariant tests

Out of scope:

- eval success criteria hardening (`W1-S2-FIX-E1`)
- CLI summary/JSON trace parity fixes (`W1-S2-FIX-A1/A2`)

---

## Implemented Changes

### `W1-S2-FIX-B1` — Unsupported mode rejection

Updated runtime mode handling in:

- `src/fractal_agent_lab/runtime/executor.py`

Behavior change:

- `parallel` and `graph` no longer silently execute as `linear`
- run now fails explicitly with `RuntimeBoundaryError`
- failure details include declared mode and supported mode list

Execution-mode truth remains explicit in emitted `run_started` metadata.

### `W1-S2-FIX-B2` — Duplicate step identity invariant

Updated workflow contract validation in:

- `src/fractal_agent_lab/core/contracts/workflow_spec.py`

Behavior change:

- duplicate `step_id` values are rejected at `WorkflowSpec` construction time
- runtime clobber risk from duplicate step keys is blocked before execution

---

## Tests Added / Updated

- `tests/runtime/test_execution_mode_truth.py`
  - rejects `parallel` mode without fallback
  - rejects `graph` mode without fallback

- `tests/runtime/test_workflow_executor_manager.py`
  - rejects duplicate `step_id` values in `WorkflowSpec`

---

## Validation

Executed:

1. `python -m compileall src tests`
2. targeted runtime tests:
   - `tests.runtime.test_execution_mode_truth`
   - `tests.runtime.test_workflow_executor_manager`
   - `tests.runtime.test_workflow_executor_handoff`
3. full test suite discovery (`tests`)

Observed:

- all targeted tests passed
- full suite passed

---

## Downstream Impact

### Track E (`W1-S2-FIX-E1`)

- now evaluates against stricter runtime truth (no unsupported-mode false linear runs)

### Track A (`W1-S2-FIX-A1/A2`)

- visibility layers consume cleaner runtime invariants and execution-mode signaling

### Meta (`W1-S2-FIX-META1`)

- Track B prerequisites for stabilization closeout are complete
