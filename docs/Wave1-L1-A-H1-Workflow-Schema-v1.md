# Wave1-L1-A-H1-Workflow-Schema-v1.md

## Purpose

This document records Track C delivery for Wave 1 epic `L1-A`.

`L1-A` defines the first H1 manager workflow schema contract that later epics (`L1-C`, `L1-D`, `L1-E`) consume.

---

## Scope

In scope:

- H1 workflow schema v1 under manager orchestration
- explicit manager step and worker step contract
- explicit schema references and metadata for H1 manager baseline
- schema-level runtime compatibility checks

Out of scope:

- H1 role prompt pack v1 (`L1-C`)
- single-agent baseline path (`L1-D`)
- run-summary formatting upgrades (`L1-E`)

---

## Implemented Files

- `src/fractal_agent_lab/workflows/h1.py`
- `src/fractal_agent_lab/workflows/__init__.py`
- `tests/workflows/test_h1_workflow_spec.py`

---

## H1 Schema Contract v1

Workflow identity:

- `workflow_id`: `h1.manager.v1`
- `execution_mode`: `manager`
- `version`: `1.0.0`
- `input_schema_ref`: `h1.input.v1`
- `output_schema_ref`: `h1.manager.output.v1`

Manager contract:

- `manager_step_id`: `synthesizer`
- `worker_step_ids`: `intake`, `planner`, `critic`
- `max_turns`: `6`
- `allow_revisit_workers`: `false`

Metadata:

- `hero_workflow`: `H1`
- `variant`: `manager`
- `schema_contract`: `h1.workflow.v1`

---

## Design Rationale

- Keeps Wave 1 complexity controlled: manager path only, no handoff/parallel assumptions.
- Uses `synthesizer` as manager/finalizer to avoid introducing a fifth role before `L1-C`.
- Keeps runtime ownership boundaries clean: no Track B contract or executor changes in this epic.

---

## Validation

`tests/workflows/test_h1_workflow_spec.py` verifies:

1. schema shape and manager contract values
2. manager-runtime compatibility through a scripted manager control envelope

This confirms `L1-A` is a real consumable contract, not a documentation-only placeholder.

---

## Downstream Handoff

- `L1-C` consumes this schema for H1 pack v1 prompt/role content.
- `L1-D` uses the same schema context for baseline comparison path setup.
- `L1-E` can format outputs once `L1-C` produces stable role outputs.
