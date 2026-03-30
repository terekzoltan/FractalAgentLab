# Wave1-L1-F-Handoff-Primitive-v1.md

## Purpose

This document records Track B delivery for Wave 1 epic `L1-F`.

`L1-F` introduces the first runtime handoff primitive so downstream tracks can implement and evaluate a real handoff variant.

---

## Scope

In scope:

- handoff runtime execution branch in executor
- handoff control parsing (`handoff`, `finalize`, `fail`)
- no-revisit/self-loop/unknown-target guardrails
- execution-mode truth and handoff lane traceability
- runtime-level tests for handoff semantics

Out of scope:

- workflow-specific H1 handoff chain implementation (`L1-G`)
- dedicated handoff trace schema enrichment (`L1-H`)
- baseline/manager/handoff comparison (`L1-I`)

---

## Implemented Files

- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
- `src/fractal_agent_lab/core/contracts/__init__.py`
- `src/fractal_agent_lab/core/__init__.py`
- `src/fractal_agent_lab/runtime/executor.py`
- `tests/runtime/test_workflow_executor_handoff.py`
- `tests/runtime/test_execution_mode_truth.py`

Status surfaces updated:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Contract Additions

Added handoff control contracts in workflow contracts:

- `HandoffAction` enum:
  - `handoff`
  - `finalize`
  - `fail`
- `HandoffDecision`:
  - `action`
  - `target_step_id`
  - `target_agent_id`
  - `reason`
  - `output`

These mirror manager-control envelope style to keep parsing and downstream prompt conventions consistent.

---

## Runtime Behavior (v1)

When `workflow.execution_mode == handoff`:

1. start from `entrypoint_step_id`
2. execute current step with existing retry/timeout/budget machinery
3. parse handoff decision from first valid control envelope candidate (`control`, `output.control`, `raw.control`)
4. apply action:
   - `handoff` -> resolve target step/agent and continue
   - `finalize` -> complete run with `final_output`
   - `fail` -> fail run explicitly

Fallback behavior when no valid control exists:

- one remaining unvisited step -> auto handoff to that step
- no remaining unvisited steps -> auto finalize
- multiple remaining steps -> fail as ambiguous handoff

Guardrails:

- unknown target step fails
- self-loop handoff fails
- revisit/cycle fails

Run output now includes a `handoff_orchestration` summary payload with path and turn records.

---

## Execution-Mode Truth

Executor runtime mode resolution now supports handoff as a first-class branch.

Emitted run metadata (`run_started` and `run_completed` payloads) reports effective runtime mode and handoff steps emit lane `handoff`.

---

## Validation

Executed checks:

1. `python -m compileall src tests`
2. targeted runtime/workflow tests
3. adapter + CLI regression tests
4. full test suite
5. CLI smoke for `h1.lite` and `wave0.demo`
6. direct handoff runtime smoke via inline workflow script

All checks passed.

---

## Downstream Impact

### Track C (`L1-G`)

- can now build H1 handoff chain variant against stable runtime primitive

### Track B (`L1-H`)

- can enrich trace semantics on top of a working handoff execution path

### Track E (`L1-I`)

- can compare baseline vs manager vs handoff after `L1-G` + `L1-H`

### Track A

- existing trace summaries can already display handoff lane events
