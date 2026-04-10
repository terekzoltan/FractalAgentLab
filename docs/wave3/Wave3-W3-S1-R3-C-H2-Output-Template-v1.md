# Wave3-W3-S1-R3-C-H2-Output-Template-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S1` Step 3 epic `R3-C`.

`R3-C` freezes the H2 final output template on top of runnable `R3-B` behavior.

---

## Scope

In scope:

- canonical H2 final output template v1 (section set + order)
- planner-owned sequencing field alignment (`recommended_starting_slice`)
- stricter mock finalization structural checks to block false-green output defaulting
- prompt semantics alignment for template-freeze behavior

Out of scope:

- runtime/core schema changes
- CLI formatting changes
- eval/projection layer changes
- prompt-tags/provenance expansion
- R3-D smoke rubric finalization

---

## Implemented Files

- `src/fractal_agent_lab/agents/h2/prompts.py`
- `src/fractal_agent_lab/agents/h2/pack.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/adapters/test_h2_manager_step_runner.py`
- `tests/agents/test_h2_pack.py`
- `tests/workflows/test_h2_workflow_spec.py`

---

## Canonical H2 Final Output Template v1

Template key order:

1. `project_summary`
2. `tracks`
3. `modules`
4. `phases`
5. `dependency_order`
6. `implementation_waves`
7. `recommended_starting_slice`
8. `risk_zones`
9. `open_questions`

Template field-shape intent:

- `project_summary`: non-empty text
- `tracks`: non-empty list
- `modules`: non-empty list
- `phases`: non-empty list
- `dependency_order`: non-empty list
- `implementation_waves`: non-empty list of objects with:
  - `wave`: non-empty text
  - `focus`: non-empty list
- `recommended_starting_slice`: non-empty text
- `risk_zones`: non-empty list
- `open_questions`: non-empty list

---

## Role-to-Template Mapping

- Intake owns `project_summary` grounding.
- Planner owns `dependency_order`, `implementation_waves`, and `recommended_starting_slice`.
- Architect owns `tracks`, `modules`, `phases`.
- Critic owns `risk_zones` and `open_questions`.
- Synthesizer remains manager/finalizer and integrates worker outputs without inventing missing template fields.

---

## Prompt Versioning Note

- pack prompt version advanced to `h2.prompt.v2`
- role-level prompt bumps were selective:
  - planner: `h2/planner/v2`
  - synthesizer: `h2/synthesizer/v2`
- intake/architect/critic stayed on v1 because their prompt semantics did not require meaningful template-scope changes

---

## Validation

R3-C acceptance focuses on runnable/template surfaces:

- `tests/adapters/test_h2_manager_step_runner.py` now checks exact template key order and stronger malformed-shape failures
- `tests/agents/test_h2_pack.py` verifies pack versioning and selective role-level prompt versions

Shared schema/runtime compatibility surface remains intentionally narrower:

- `tests/workflows/test_h2_workflow_spec.py` keeps representative H2 final-output shape checks but does not become the primary template-law assertion surface

---

## Boundary Notes

- Exact template-law is carried by runnable acceptance tests and this delivery doc, not by generic schema/runtime compatibility assertions.
- No H2 CLI/eval/provenance expansion is introduced in this step.
- R3-D final smoke-rubric freeze remains Step 4 work.

---

## Downstream Handoff

- Track E can finalize `R3-D` against a frozen H2 template.
- Track C returns at `R3-E` after `W3-S1` completion.
