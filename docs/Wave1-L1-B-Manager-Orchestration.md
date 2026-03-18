# Wave1-L1-B-Manager-Orchestration.md

## Purpose

This document records the Track B implementation of Wave 1 epic `L1-B`.

`L1-B` stabilizes the manager orchestration primitive so H1 can move beyond Wave 0 static sequencing.

---

## Scope

In scope:

- manager control contract shape (`ManagerSpec`, `ManagerDecision`)
- manager runtime loop with guardrails
- manager/worker trace visibility improvement
- backward-compatible execution path for existing Wave 0 workflows

Out of scope:

- handoff primitive (`L1-F`)
- parallel fan-out (`Wave 1+` later)
- graph workflow runtime hardening (`later`)
- Track C prompt semantics and role content

---

## Files Implemented

- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
- `src/fractal_agent_lab/core/contracts/__init__.py`
- `src/fractal_agent_lab/core/__init__.py`
- `src/fractal_agent_lab/runtime/executor.py`

---

## Contract Changes

Added in `WorkflowSpec` contract:

- `ManagerAction` enum
  - `delegate`
  - `finalize`
  - `fail`
- `ManagerSpec`
  - `manager_step_id`
  - `worker_step_ids`
  - `max_turns`
  - `allow_revisit_workers`
- `ManagerDecision`
  - `action`
  - `target_step_id`
  - `target_agent_id`
  - `reason`
  - `output`
- `WorkflowSpec.manager_spec` optional field

Design rule:

- if `manager_spec` is absent, executor keeps linear path behavior.

---

## Runtime Behavior (L1-B)

### Linear path (unchanged baseline)

When `manager_spec` is missing:

- executor keeps Wave 0 linear step iteration
- Wave 0 workflows remain runnable with no migration requirement

### Manager path (new)

When `manager_spec` is present:

1. executor validates manager step + worker steps
2. manager step executes per turn
3. manager decision is parsed from step output control envelope when available
4. on `delegate`, selected worker step executes
5. on `finalize`, run succeeds with manager summary payload
6. on `fail`, run fails explicitly

Fallback policy:

- if no parseable manager control envelope exists, executor auto-delegates remaining workers in order, then auto-finalizes

Guardrails:

- `max_turns` hard limit enforced
- delegate target must match declared worker set
- optional worker revisit policy enforced via `allow_revisit_workers`

---

## Trace Model Impact

`L1-B` now emits agent-level events in addition to run/step events:

- `agent_dispatched`
- `agent_completed`
- `agent_failed`

Event payload includes:

- `agent_id`
- `attempt`
- `turn_index`
- orchestration `lane` (`linear`, `manager`, `worker`)

This gives Track A and Track E better orchestration observability without changing provider behavior.

---

## Validation Evidence

Performed checks:

1. `python -m compileall src`
2. manager-path smoke with explicit manager control decisions
3. manager fallback smoke without control envelope
4. regression smoke: existing `h1.lite` CLI path still succeeds

Observed outcome:

- manager runtime path succeeds on both explicit and fallback control
- Wave 0 `h1.lite` continues to run successfully

---

## Downstream Impact

### Track C (`L1-A`, `L1-C`)

- can define H1 schema/pack against explicit manager runtime contract
- no need to fake manager behavior with static step chain

### Track D

- current step runner contract remains valid
- manager control envelope can be produced by adapters/prompts without core boundary rewrite

### Track A

- richer event stream available for run summary and timeline views

### Track E

- manager-vs-baseline comparisons now have explicit turn and agent dispatch evidence in trace artifacts

---

## Known Limits

- manager control parsing currently expects a pragmatic dict envelope (`control`) and is intentionally permissive
- no dedicated handoff semantics yet (kept for `L1-F`)
- no graph-level branching semantics (kept for later wave)
