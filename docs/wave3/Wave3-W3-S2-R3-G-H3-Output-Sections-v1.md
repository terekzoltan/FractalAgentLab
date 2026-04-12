# Wave3-W3-S2-R3-G-H3-Output-Sections-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S2` Step 3 epic `R3-G`.

`R3-G` freezes H3 final output section naming and ordering on top of the runnable `R3-F` role-pack path.

---

## Scope

In scope:

- canonical H3 final output sections v1 (exact section set + exact order)
- synthesizer prompt semantics alignment for frozen template behavior
- runnable acceptance-test hardening to protect exact section order
- cross-surface wording alignment from deferred to frozen status

Out of scope:

- runtime/core schema changes
- new H3 roles or evaluator activation
- registry surface redesign
- CLI formatting and eval/projection changes
- `R3-H` smoke rubric finalization

---

## Implemented Files

- `src/fractal_agent_lab/agents/h3/prompts.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/adapters/test_h3_manager_step_runner.py`
- `tests/agents/test_h3_pack.py`
- `tests/workflows/test_h3_workflow_spec.py`

---

## Canonical H3 Final Output Template v1

Template key order:

1. `strengths`
2. `bottlenecks`
3. `merge_risks`
4. `refactor_ideas`

Template field-shape intent:

- each section is a non-empty list
- section content remains architecture-review oriented and actionable

---

## Role-to-Template Mapping

- `systems` provides architecture-strength evidence that maps into `strengths`.
- `critic` provides `bottlenecks`, `merge_risks`, and refactor pressure (`refactor_candidates`) that maps into `refactor_ideas`.
- `synthesizer` remains manager/finalizer and emits the canonical section set/order without alternate names.

---

## Prompt Versioning Note

- pack prompt version advanced to `h3.prompt.v2`
- role-level prompt bump is selective:
  - synthesizer: `h3/synthesizer/v2`
- intake/planner/systems/critic remain on `v1`

---

## Validation

`R3-G` acceptance focuses on runnable/template law surfaces:

- `tests/adapters/test_h3_manager_step_runner.py` now asserts exact H3 final section order
- `tests/agents/test_h3_pack.py` verifies prompt metadata alignment with selective version bump

Shared schema/runtime compatibility surface remains narrower:

- `tests/workflows/test_h3_workflow_spec.py` is aligned to canonical H3 section names but is not the primary exact-order law surface

---

## Boundary Notes

- Top-level manager envelope remains unchanged (`step_results` + `manager_orchestration` + `final_output`).
- Evaluator remains deferred from executable H3 v1.
- Exact H3 section-law is now frozen in this step and carried by runnable acceptance tests + this delivery doc.
- No runtime/core contract expansion was introduced.

---

## Downstream Handoff

- Track E can finalize `R3-H` smoke checks against frozen H3 section naming/order.
- Track C has no additional `W3-S2` coding epic after `R3-G`; next Track C mainline checkpoint opens in `W3-S3`.
