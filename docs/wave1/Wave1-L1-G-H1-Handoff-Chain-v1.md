# Wave1-L1-G-H1-Handoff-Chain-v1.md

## Purpose

This document records Track C delivery for Wave 1 epic `L1-G`.

`L1-G` implements the H1 handoff-chain variant on top of the Track B `L1-F` handoff primitive.

---

## Scope

In scope:

- H1 handoff workflow variant (`h1.handoff.v1`)
- handoff-specific role prompts and agent pack wiring
- registry exposure for runnable CLI path
- mock adapter handoff-chain outputs for smoke execution

Out of scope:

- handoff trace schema enrichment (`L1-H`)
- baseline vs manager vs handoff comparison (`L1-I`)
- runtime contract changes (Track B owned)

---

## Implemented Files

- `src/fractal_agent_lab/workflows/h1_handoff.py`
- `src/fractal_agent_lab/workflows/__init__.py`
- `src/fractal_agent_lab/agents/h1/prompts.py`
- `src/fractal_agent_lab/agents/h1/pack.py`
- `src/fractal_agent_lab/agents/h1/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/workflows/test_h1_handoff_workflow_spec.py`
- `tests/agents/test_h1_handoff_pack.py`
- `tests/adapters/test_h1_handoff_step_runner.py`

---

## Handoff Variant Identity

- workflow id: `h1.handoff.v1`
- execution mode: `handoff`
- entrypoint: `intake`
- step chain: `intake -> planner -> critic -> synthesizer`

Schema alignment:

- input schema ref: `h1.input.v1`
- output schema ref: `h1.handoff.output.v1`
- schema contract: `h1.workflow.v1`

---

## Prompt and Pack Strategy

Pack version:

- `h1.handoff.prompt.v1`

Role prompt versions:

- `h1/handoff/intake/v1`
- `h1/handoff/planner/v1`
- `h1/handoff/critic/v1`
- `h1/handoff/synthesizer/v1`

Control behavior:

- intake emits `control.action=handoff -> planner`
- planner emits `control.action=handoff -> critic`
- critic emits `control.action=handoff -> synthesizer`
- synthesizer emits `control.action=finalize` with final comparable output keys

---

## Validation

The new tests cover:

1. workflow contract shape for `h1.handoff.v1`
2. handoff pack chain integrity and prompt metadata
3. end-to-end mock handoff run success and orchestration path

---

## Downstream Handoff

- `L1-H` can now enrich trace semantics over a real handoff workflow variant.
- `L1-I` can compare baseline vs manager vs handoff after `L1-H` is complete.
