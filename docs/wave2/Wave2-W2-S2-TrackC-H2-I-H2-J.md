# Wave2-W2-S2-TrackC-H2-I-H2-J.md

## Purpose

This document records Track C delivery for Wave 2 Sprint `W2-S2` Step 1 epics:

- `H2-I` Session memory v1 foundation (`M1` only)
- `H2-J` H1 manager role-boundary cleanup

---

## Scope

In scope:

- `H2-I`: load session memory by `input_payload.session_id` into run context
- `H2-I`: JSON session-memory store under `data/memory/sessions/`
- `H2-I`: optional per-run snapshot sidecar at `data/artifacts/<run_id>/session_memory.json`
- `H2-J`: remove misleading manager-pack handoff topology in H1 manager pack
- `H2-J`: validation and tests aligned to manager authority semantics

Out of scope:

- dedicated CLI session-memory flag or UX surface (Track A concern later)
- memory extraction/merge/candidate policy work (`H2-K`)
- identity updater/drift/routing work (`H2-N`/later)
- Track B runtime schema or execution-mode contract changes

---

## Implemented Files

H2-J:

- `src/fractal_agent_lab/agents/h1/pack.py`
- `tests/agents/test_h1_pack.py`

H2-I:

- `src/fractal_agent_lab/memory/session_memory.py`
- `src/fractal_agent_lab/memory/json_store.py`
- `src/fractal_agent_lab/memory/session_context.py`
- `src/fractal_agent_lab/memory/__init__.py`
- `src/fractal_agent_lab/cli/app.py`
- `tests/memory/test_session_memory.py`

Coordination status updates:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## H2-J Result

Manager-pack `handoff_targets` were removed from H1 manager variant agents.

Validation now enforces that manager-pack agents do not declare handoff topology.
The authority boundary is explicit:

- manager orchestration authority lives in `workflow.manager_spec`
- manager decisions come from manager control output
- manager-pack `AgentSpec.handoff_targets` are not used as orchestration truth

This is a semantic cleanup only; manager runtime path remains unchanged.

---

## H2-I Result

Session-memory v1 foundation is now available as a minimal Track C-owned layer:

- lookup key: `input_payload.session_id`
- canonical memory store path: `data/memory/sessions/<session_id>.json`
- run context additive surface:
  - `context.session_id`
  - `context.session_memory` (when record exists)

Behavior rules:

- missing `session_id` -> no memory context injection
- missing session record -> run proceeds with `session_id` only
- malformed session record -> run proceeds without injected memory payload
- no fake fallback memory is created

Optional sidecar behavior:

- when a session memory record is loaded, a non-canonical snapshot may be written to
  `data/artifacts/<run_id>/session_memory.json`
- this sidecar is best-effort context evidence, not the canonical session-memory store

---

## Validation

Executed:

- `PYTHONPATH=src python -m unittest tests.agents.test_h1_pack tests.memory.test_session_memory`
- `PYTHONPATH=src python -m unittest tests.cli.test_l1_e_h1_summary tests.adapters.test_h1_manager_step_runner`

Observed:

- H1 manager pack boundary cleanup passes and remains stable
- session memory load/negative-path/context pass-through tests pass
- manager-path summary/runtime regressions remain green

---

## Downstream Handoff

- `H2-K` can build extraction/policy work on top of the now-stable `session_id` lookup and memory context load surface.
- Track E `H2-L` can evaluate whether session memory materially helps H1 using this M1 foundation.
