# Wave3-W3-S1-R3-B-H2-Agent-Pack-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S1` Step 2 epic `R3-B`.

`R3-B` implements the first full H2 manager role pack (intake/planner/architect/critic/synthesizer) on top of the fixed `R3-A` workflow contract.

---

## Scope

In scope:

- H2 prompt/role pack v1 under manager orchestration
- explicit architect role as a first-class specialist
- pack validation rules and model-tier mapping
- runnable registry wiring for `h2.manager.v1`
- H2 mock manager path with explicit anti-fallback control behavior

Out of scope:

- H2 output-template finalization (`R3-C`)
- H2 smoke rubric implementation (`R3-D`)
- runtime/core schema changes (Track B owned)
- H2 prompt-tags/provenance formatter extensions
- H2 eval/projection layer changes

---

## Implemented Files

- `src/fractal_agent_lab/agents/h2/roles.py`
- `src/fractal_agent_lab/agents/h2/prompts.py`
- `src/fractal_agent_lab/agents/h2/pack.py`
- `src/fractal_agent_lab/agents/h2/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/agents/test_h2_pack.py`
- `tests/adapters/test_h2_manager_step_runner.py`

---

## Role Topology v1

- `h2.intake`
- `h2.planner`
- `h2.architect`
- `h2.critic`
- `h2.synthesizer` (manager + finalizer)

Manager/worker alignment follows `src/fractal_agent_lab/workflows/h2.py`:

- manager step: `synthesizer`
- worker steps: `intake`, `planner`, `architect`, `critic`

---

## Prompt Versioning

- pack version: `h2.prompt.v1`
- role versions:
  - `h2/intake/v1`
  - `h2/planner/v1`
  - `h2/architect/v1`
  - `h2/critic/v1`
  - `h2/synthesizer/v1`

Each `AgentSpec` includes:

- `metadata.prompt_version` (role version)
- `metadata.pack_prompt_version` (pack version)

---

## Manager Control Semantics

The H2 synthesizer prompt and H2 mock manager output are aligned with manager runtime control parsing:

- `control.action=delegate` with `target_step_id`
- `control.action=finalize` with `control.output`

Workers do not emit manager control envelopes.

H2 mock manager order is explicit and deterministic:

1. delegate `intake`
2. delegate `planner`
3. delegate `architect`
4. delegate `critic`
5. finalize

This keeps the runnable path protected from fallback-only false-green acceptance.
Malformed worker outputs should now fail finalization instead of silently defaulting missing list/text fields.

---

## Validation

Added tests verify:

1. H2 pack shape, role separation, and prompt metadata
2. registry resolution for `h2.manager.v1`
3. end-to-end manager execution on mock with explicit turn-level delegate/finalize evidence
4. strict upstream-context failures for planner/architect/critic when required prior outputs are missing
5. malformed worker outputs fail synthesizer finalization instead of producing defaulted green output

---

## Boundary Notes

- Manager orchestration authority remains in `workflow.manager_spec` and manager control output, not pack-level handoff topology.
- No runtime or core schema contract changes were introduced.
- H2 final output template is intentionally not frozen here; that remains `R3-C` scope.
- No H2 CLI formatting, eval projection, or prompt-tag helper expansion is introduced in this step.

---

## Downstream Handoff

- `R3-C` can finalize H2 output-template shape against a runnable role-separated manager path.
- `R3-D` can draft and finalize smoke rubric checks against this now-runnable H2 manager baseline.
