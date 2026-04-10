# Wave3-W3-S1-R3-A-H2-Workflow-Schema-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S1` Step 1 epic `R3-A`.

`R3-A` defines the H2 workflow schema v1 first, before role-pack wiring.

---

## Scope

In scope:

- H2 manager workflow schema v1 (`h2.manager.v1`)
- explicit manager and worker step contract
- H2 schema refs and schema-contract metadata
- runtime compatibility tests with explicit manager control decisions

Out of scope:

- H2 role prompt/agent pack implementation (`R3-B`)
- H2 output template finalization (`R3-C`)
- H2 smoke rubric implementation (`R3-D`)
- runtime or core schema changes
- workflow registry wiring

---

## Implemented Files

- `src/fractal_agent_lab/workflows/h2.py`
- `src/fractal_agent_lab/workflows/__init__.py`
- `tests/workflows/test_h2_workflow_spec.py`

---

## H2 Schema Contract v1

Workflow identity:

- `workflow_id`: `h2.manager.v1`
- `name`: `H2 Project Decomposition Manager Baseline`
- `version`: `1.0.0`

Schema references:

- `input_schema_ref`: `h2.input.v1`
- `output_schema_ref`: `h2.manager.output.v1`
- `metadata.schema_contract`: `h2.workflow.v1`

Execution mode:

- `execution_mode`: `manager`

Step topology:

- manager/finalizer step: `synthesizer`
- worker steps: `intake`, `planner`, `architect`, `critic`

Manager config:

- `manager_step_id`: `synthesizer`
- `worker_step_ids`: `intake`, `planner`, `architect`, `critic`
- `max_turns`: `8`
- `allow_revisit_workers`: `false`

Metadata:

- `source`: `track_c.r3_a`
- `hero_workflow`: `H2`
- `variant`: `manager`

---

## Design Rationale

`R3-A` follows the same schema-first and manager-first strategy used in H1:

- Track C publishes a stable workflow contract before role-pack work
- manager orchestration authority is declared in `workflow.manager_spec`
- no runtime-semantic expansion is required to run H2 v1

The H2 topology includes all five roles (`intake`/`planner`/`architect`/`critic`/`synthesizer`) to match H2 project-decomposition intent while keeping manager execution semantics consistent with current runtime support.

---

## Validation

The H2 workflow tests verify:

1. explicit schema shape (`workflow_id`, `execution_mode`, schema refs, manager spec, metadata)
2. runtime compatibility with explicit manager control sequence

The compatibility test intentionally checks turn-level manager actions, target step order, and reasons so fallback auto-delegation cannot produce a false-green success.

---

## Boundary Notes

- No `workflow_registry.py` wiring is done in `R3-A`.
- No `agents/h2/*` pack is introduced in `R3-A`.
- No CLI summary or eval projection surface is changed in `R3-A`.

This keeps `R3-A` as a strict contract-first delivery and avoids exposing a half-integrated public workflow surface before `R3-B`.

---

## Downstream Handoff

- Track B can review `R3-A` schema contract expectations.
- Track C can start `R3-B` role pack against this fixed H2 workflow contract.
