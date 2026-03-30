# Wave1-L1-C-H1-Agent-Pack-v1.md

## Purpose

This document records Track C delivery for Wave 1 epic `L1-C`.

`L1-C` implements the first full H1 agent pack (intake/planner/critic/synthesizer) bound to the `L1-A` manager workflow schema and `L1-B` manager runtime behavior.

---

## Scope

In scope:

- H1 prompt/role pack v1 under manager orchestration
- explicit critic role addition (beyond Wave 0 H1-lite)
- pack validation rules and model tier mapping
- minimum runnable wiring in workflow registry for `h1.manager.v1`

Out of scope:

- single-agent baseline path (`L1-D`)
- run summary/readability formatting upgrades (`L1-E`)
- runtime contract changes (Track B owned)

---

## Implemented Files

- `src/fractal_agent_lab/agents/h1/roles.py`
- `src/fractal_agent_lab/agents/h1/prompts.py`
- `src/fractal_agent_lab/agents/h1/pack.py`
- `src/fractal_agent_lab/agents/h1/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/agents/test_h1_pack.py`
- `tests/adapters/test_h1_manager_step_runner.py`

---

## Role Topology v1

- `h1.intake`
- `h1.planner`
- `h1.critic`
- `h1.synthesizer` (manager + finalizer)

Manager/worker alignment follows `src/fractal_agent_lab/workflows/h1.py`:

- manager step: `synthesizer`
- worker steps: `intake`, `planner`, `critic`

---

## Prompt Versioning

- pack version: `h1.prompt.v1`
- role versions:
  - `h1/intake/v1`
  - `h1/planner/v1`
  - `h1/critic/v1`
  - `h1/synthesizer/v1`

Each `AgentSpec` includes:

- `metadata.prompt_version` (role version)
- `metadata.pack_prompt_version` (pack version)

---

## Manager Control Semantics

The synthesizer prompt is contract-aligned with `L1-B` runtime control parsing:

- `control.action=delegate` with `target_step_id`
- `control.action=finalize` with `control.output`

Workers do not emit manager control envelopes.

---

## Validation

Added tests verify:

1. H1 pack shape, roles, and prompt metadata
2. End-to-end manager execution for `h1.manager.v1` on mock provider

---

## Downstream Handoff

- `L1-D`: can now consume this pack to build the single-agent reference baseline.
- `L1-E`: can now improve summary/readability against real H1 manager outputs.
