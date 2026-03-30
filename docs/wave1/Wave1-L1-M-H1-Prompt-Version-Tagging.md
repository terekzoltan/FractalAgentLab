# Wave1-L1-M-H1-Prompt-Version-Tagging.md

## Purpose

This document records Track C delivery for Wave 1 epic `L1-M`.

`L1-M` formalizes prompt-version tagging for H1 variants so summaries and run artifacts carry explicit, comparable prompt provenance.

---

## Scope

In scope:

- canonical H1 prompt-tag manifest for manager/single/handoff variants
- stricter pack metadata validation for `prompt_version` and `pack_prompt_version`
- additive prompt-tag visibility in CLI summaries and JSON output
- prompt-tag persistence into run artifacts through run output payload

Out of scope:

- runtime/trace contract changes (Track B owned)
- summary UX redesign (Track A owned)
- comparison scoring/gating changes (Track E owned)

---

## Implemented Files

- `src/fractal_agent_lab/agents/h1/prompt_tags.py`
- `src/fractal_agent_lab/agents/h1/pack.py`
- `src/fractal_agent_lab/agents/h1/__init__.py`
- `src/fractal_agent_lab/agents/__init__.py`
- `src/fractal_agent_lab/cli/app.py`
- `src/fractal_agent_lab/cli/formatting.py`
- `tests/agents/test_h1_prompt_tags.py`
- `tests/agents/test_h1_pack.py`
- `tests/agents/test_h1_handoff_pack.py`
- `tests/cli/test_l1_e_h1_summary.py`

---

## Tagging Contract

Prompt tags are emitted as an additive `prompt_tags` block:

- `workflow_id`
- `variant`
- `pack_prompt_version`
- `role_prompt_versions`
- `executed_step_prompt_versions`

Variant mapping:

- `h1.manager.v1` -> `manager`
- `h1.single.v1` -> `single`
- `h1.handoff.v1` -> `handoff`

---

## Validation Hardening

`L1-M` now enforces:

- manager pack: consistent `pack_prompt_version = h1.prompt.v1`
- handoff pack: consistent `pack_prompt_version = h1.handoff.prompt.v1`
- single pack: `pack_prompt_version = h1.single.prompt.v1`
- all required agents retain non-empty `prompt_version`

---

## Output Surfaces

Prompt tags are now visible in:

- text summary: additive `prompt_tags` section
- JSON summary: additive top-level `prompt_tags`
- run artifacts: via `run_state.output_payload.prompt_tags`

No runtime branch semantics, trace event schema, or eval pass/fail gates were changed.

---

## Downstream Handoff

- `L1-L` can reference explicit prompt provenance in baseline-vs-variant decision notes.
- later waves can consume prompt tags for stricter replay/eval version pinning.
