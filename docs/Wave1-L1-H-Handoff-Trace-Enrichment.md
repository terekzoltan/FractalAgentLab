# Wave1-L1-H-Handoff-Trace-Enrichment.md

## Purpose

This document records Track B delivery for Wave 1 epic `L1-H`.

`L1-H` enriches handoff trace semantics so handoff runs are causally inspectable in timeline/debug flows.

---

## Scope

In scope:

- dedicated handoff decision/failure trace events
- causal event linkage via `parent_event_id` and `correlation_id`
- handoff decision context in trace payloads
- runtime and regression tests for enriched trace behavior

Out of scope:

- workflow-level handoff variant implementation (`L1-G`)
- comparison/rubric execution (`L1-I`)
- UI timeline rendering changes (`L1-J`)

---

## Implemented Files

- `src/fractal_agent_lab/core/events/trace_event.py`
- `src/fractal_agent_lab/runtime/executor.py`
- `src/fractal_agent_lab/cli/formatting.py`
- `tests/runtime/test_workflow_executor_handoff.py`

Status surfaces updated:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Trace Model Changes

Added event types:

- `handoff_decided`
- `handoff_failed`

No breaking change to `TraceEvent` envelope; enrichment is additive via event type expansion and payload details.

---

## Runtime Enrichment Details

### Causal linking

For handoff lane execution:

- each handoff hop now uses `correlation_id = "handoff:<run_id>:<handoff_index>"`
- `handoff_decided` and `handoff_failed` events are emitted with the same hop correlation id
- subsequent step events use `parent_event_id` linkage from prior handoff decision

### Decision/failure payload context

Handoff decision payload includes:

- `lane`
- `handoff_index`
- `decision_action`
- `decision_source` (`explicit` or `fallback`)
- `from_step_id`, `from_agent_id`
- optional `to_step_id`, `to_agent_id`
- `reason`

Handoff failure payload includes:

- handoff identifiers (`lane`, `handoff_index`, `decision_source`)
- source and attempted target details
- error message and error type

### Step/agent payload propagation

Handoff lane `step_*` and `agent_*` events now carry handoff context fields (`handoff_index`, `from_step_id`, `from_agent_id`) to improve timeline readability without extra schema layers.

---

## Validation

Executed:

1. `python -m compileall src tests`
2. targeted runtime/workflow/handoff regressions
3. full test suite
4. CLI smoke:
   - `h1.handoff.v1` with trace output
   - `h1.manager.v1` regression with trace output

Observed:

- handoff traces include explicit decision chain events
- parent/correlation links are present and consistent per hop
- manager/linear paths remain stable

---

## Downstream Impact

### Track E (`L1-I`)

- comparison runs can now inspect handoff causality, not only lane counts

### Track A (`L1-J`)

- timeline rendering has richer handoff semantics available immediately

### Track C

- no contract rewrite needed; existing handoff control envelope remains valid
