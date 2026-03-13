# Wave0-TrackB-Implementation-Report.md

## Purpose

This document records what Track B implemented in the first Wave 0 runtime burst.

It is a concrete handoff artifact for Tracks A/C/D/E so downstream work can start with less guessing.

---

## Scope Covered

Implemented in this burst:

- `F0-B` Initial canonical schemas
- `F0-C` Workflow executor skeleton
- `F0-D` Event emission primitives
- `F0-E` Timeout/retry/budget placeholders
- `F0-M` First stored run + trace artifact write path (Track B side)

Out of scope intentionally:

- provider-specific implementation details
- prompt semantics and agent content packs
- UI presentation logic
- replay and durable persistence hardening

---

## Implemented Files

### Canonical schemas (`F0-B`)

- `src/fractal_agent_lab/core/models/run_state.py`
- `src/fractal_agent_lab/core/events/trace_event.py`
- `src/fractal_agent_lab/core/contracts/agent_spec.py`
- `src/fractal_agent_lab/core/contracts/workflow_spec.py`

### Runtime + tracing + state foundation (`F0-C/F0-D/F0-E`)

- `src/fractal_agent_lab/core/errors/runtime_errors.py`
- `src/fractal_agent_lab/runtime/executor.py`
- `src/fractal_agent_lab/tracing/emitter.py`
- `src/fractal_agent_lab/state/store.py`

### Artifact storage foundation (`F0-M` Track B side)

- `src/fractal_agent_lab/tracing/artifact_writer.py`
- `docs/Wave0-F0-M-Artifact-Contract.md`

### Export surfaces

- `src/fractal_agent_lab/core/__init__.py`
- `src/fractal_agent_lab/core/models/__init__.py`
- `src/fractal_agent_lab/core/events/__init__.py`
- `src/fractal_agent_lab/core/contracts/__init__.py`
- `src/fractal_agent_lab/core/errors/__init__.py`
- `src/fractal_agent_lab/runtime/__init__.py`
- `src/fractal_agent_lab/tracing/__init__.py`
- `src/fractal_agent_lab/state/__init__.py`

---

## Canonical Contract Snapshot (v0)

### `RunState`

Core fields:

- `run_id`, `workflow_id`, `status`
- `input_payload`, `output_payload`, `step_results`
- `errors`, `context`, `trace_event_ids`
- `created_at`, `started_at`, `completed_at`
- `schema_version`

Lifecycle helpers:

- `start()`, `succeed()`, `fail()`, `cancel()`, `timeout()`

### `TraceEvent`

Core fields:

- `event_id`, `run_id`, `event_type`, `sequence`, `timestamp`, `source`
- `step_id`, `parent_event_id`, `correlation_id`
- `payload`, `schema_version`

Core event types include:

- run-level: start/completed/failed/cancelled/timed_out
- step-level: started/completed/failed
- agent-level placeholders: dispatched/completed/failed

### `AgentSpec`

Core fields:

- `agent_id`, `role`, `kind`
- `instructions` or `instruction_ref`
- `model_policy_ref`
- `tools_allowed`, `handoff_targets`
- `output_schema_ref`, `metadata`, `schema_version`

### `WorkflowSpec`

Core fields:

- `workflow_id`, `name`, `version`, `execution_mode`
- `steps` (`WorkflowStepSpec`), `entrypoint_step_id`, `entrypoint_ref`
- `input_schema_ref`, `output_schema_ref`
- `agent_ids`, `metadata`, `schema_version`

Behavior:

- derives `agent_ids` from steps if not provided
- derives `entrypoint_step_id` from first step if not provided

---

## Runtime Skeleton Snapshot

`WorkflowExecutor` in `src/fractal_agent_lab/runtime/executor.py` currently provides:

- explicit run initialization with `RunState`
- lifecycle state transitions
- step loop over `WorkflowSpec.steps`
- pluggable `StepRunner` boundary
- structured failure handling through runtime error classes
- trace emission on run and step lifecycle events
- in-memory/null state store and trace emitter compatibility

Placeholder controls included:

- timeout (`timeout_seconds`)
- retry (`max_retries_per_step`)
- budget (`budget_units`, `step_cost_units`)

---

## Validation Performed

- syntax validation: `python -m compileall src`
- import and model instantiation smoke
- executor success-path smoke
- executor failure-path smoke
- budget placeholder guard smoke

All checks passed in local Wave 0 baseline.

---

## Downstream Impact

### Track A

- can rely on canonical `TraceEvent` shape for timeline consumption once CLI output exists

### Track C

- can define first agent packs and workflow content against stable `AgentSpec` and `WorkflowSpec`

### Track D

- can implement minimal adapter/step-runner boundary against `WorkflowExecutor` without core contract guessing

### Track E

- can draft smoke and replay assumptions against explicit run/event/runtime boundaries

---

## Open Contract Questions (kept explicit)

1. Should v0 contract models remain stdlib dataclasses, or migrate to Pydantic as a Wave 0.x hardening step?
2. Should `TraceEvent.payload` stay permissive in v0, or tighten per-event-type in Wave 1?
3. Should executor emit additional correlation fields by default for easier replay indexing?

---

## Next Recommended Steps

1. Track D: implement minimal `StepRunner` adapter path for `F0-F`
2. Track A: begin CLI shell against executor entrypoint for `F0-G`
3. Track E: prepare Wave 0 smoke checklist against these contracts
