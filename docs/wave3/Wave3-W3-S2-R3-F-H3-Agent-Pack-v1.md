# Wave3-W3-S2-R3-F-H3-Agent-Pack-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S2` Step 2 epic `R3-F`.

`R3-F` implements the first full H3 manager role pack (`intake`/`planner`/`systems`/`critic`/`synthesizer`) on top of the fixed `R3-E` workflow contract (`h3.manager.v1`).

This document remains the historical `R3-F` delivery record. Current frozen H3 section-law and
prompt/version canon after `R3-G` are recorded in
`docs/wave3/Wave3-W3-S2-R3-G-H3-Output-Sections-v1.md`.

---

## Scope

In scope:

- H3 prompt/role pack v1 under manager orchestration
- explicit systems + critic + synthesizer complementarity
- manager-pack validation rules and model-tier mapping
- runnable registry wiring for `h3.manager.v1`
- H3-specialized mock manager path with explicit anti-fallback control behavior

Out of scope:

- H3 final output section naming/order freeze (`R3-G`)
- H3 smoke rubric skeleton/finalization (`R3-H`)
- runtime/core schema changes (Track B owned)
- CLI formatting and eval/projection layer changes

---

## Implemented Files

- `src/fractal_agent_lab/agents/h3/roles.py`
- `src/fractal_agent_lab/agents/h3/prompts.py`
- `src/fractal_agent_lab/agents/h3/pack.py`
- `src/fractal_agent_lab/agents/h3/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/agents/test_h3_pack.py`
- `tests/adapters/test_h3_manager_step_runner.py`

---

## Role Topology v1

- `h3.intake`
- `h3.planner`
- `h3.systems`
- `h3.critic`
- `h3.synthesizer` (manager + finalizer)

Manager/worker alignment follows `src/fractal_agent_lab/workflows/h3.py`:

- manager step: `synthesizer`
- worker steps: `intake`, `planner`, `systems`, `critic`

---

## Prompt Versioning

At `R3-F` delivery time:

- pack version: `h3.prompt.v1`
- role versions:
  - `h3/intake/v1`
  - `h3/planner/v1`
  - `h3/systems/v1`
  - `h3/critic/v1`
  - `h3/synthesizer/v1`

Current canon after `R3-G` freeze:

- pack version: `h3.prompt.v2`
- synthesizer role version: `h3/synthesizer/v2`
- intake/planner/systems/critic remain on `v1`

Each `AgentSpec` includes:

- `metadata.prompt_version` (role version)
- `metadata.pack_prompt_version` (pack version)

---

## Manager Control Semantics

The H3 synthesizer prompt and H3 mock manager output are aligned with manager runtime control parsing:

- `control.action=delegate` with `target_step_id`
- `control.action=finalize` with `control.output`

H3 mock manager order is explicit and deterministic:

1. delegate `intake`
2. delegate `planner`
3. delegate `systems`
4. delegate `critic`
5. finalize

Workers do not emit manager control envelopes.

---

## Validation

Added tests verify:

1. H3 pack shape, role separation, and prompt metadata
2. registry resolution for `h3.manager.v1`
3. end-to-end manager execution on mock with explicit delegate/finalize turn evidence
4. strict upstream-context failures for planner/systems/critic when required prior outputs are missing
5. malformed worker outputs fail synthesizer finalization instead of producing defaulted green output

---

## Boundary Notes

- Manager orchestration authority remains in `workflow.manager_spec` and manager control output, not pack-level handoff topology.
- Top-level manager output envelope is unchanged (`step_results` + `manager_orchestration` + `final_output`).
- Evaluator remains deferred from executable H3 v1.
- At `R3-F` delivery time, H3 mock finalizer used runnable default naming (`strengths`, `bottlenecks`, `merge_risks`, `refactor_ideas`) for execution evidence only.
- After `R3-G`, this section naming/order is frozen canon; see `docs/wave3/Wave3-W3-S2-R3-G-H3-Output-Sections-v1.md`.
- No runtime/core schema contract changes were introduced.

---

## Downstream Handoff

- `R3-F` handed off a runnable role-separated manager path for `R3-G` freeze work.
- `R3-F` also unblocked `R3-H` skeleton prep on top of explicit H3 manager orchestration and fail-loud worker-shape behavior.
