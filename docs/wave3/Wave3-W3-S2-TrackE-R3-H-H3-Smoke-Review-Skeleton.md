# Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-Skeleton.md

## Purpose

This document records Track E `R3-H` delivery for Wave 3 Sprint `W3-S2` Step 3 as a
**skeleton prep artifact**.

It is intentionally provisional:

- this is a draft smoke-review structure based on current runnable H3 evidence
- this is not the final `R3-H` smoke review
- final smoke-review freeze remains Step 4 scope and requires `R3-G` completion

---

## Scope

In scope (`R3-H` Step 3 skeleton prep):

- define a docs-first H3 smoke-review structure for manual/operator use
- capture current runnable evidence from `R3-E` + Track B `R3-E` review + `R3-F`
- separate what is currently observed from what must be finalized after `R3-G`
- preserve anti-false-green discipline while avoiding premature section-law claims

Out of scope in this step:

- final H3 output-section naming/order freeze
- final structural completeness gate tied to `R3-G` section-law decisions
- final human-usefulness acceptance wording for Step 4
- new eval module creation
- new smoke script creation
- runtime/core contract changes
- CLI formatting or export changes

---

## Readiness Basis

`R3-H` skeleton prep is ready because:

- `R3-E` is complete (`h3.manager.v1` contract exists)
- Track B `R3-E` review is complete (manager boundary compatibility confirmed)
- `R3-F` is complete (runnable H3 manager role-pack baseline exists)

Current operational references:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `docs/wave3/Wave3-W3-S2-R3-E-H3-Workflow-Schema-v1.md`
- `docs/wave3/Wave3-W3-S2-TrackB-R3-E-Schema-Review.md`
- `docs/wave3/Wave3-W3-S2-R3-F-H3-Agent-Pack-v1.md`

---

## Evidence Inputs

Primary code/test surfaces for current runnable evidence:

- `src/fractal_agent_lab/workflows/h3.py`
- `src/fractal_agent_lab/agents/h3/pack.py`
- `src/fractal_agent_lab/agents/h3/prompts.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/adapters/mock/adapter.py`
- `tests/workflows/test_h3_workflow_spec.py`
- `tests/agents/test_h3_pack.py`
- `tests/adapters/test_h3_manager_step_runner.py`

Manual-rubric template references:

- `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md`
- `docs/wave3/Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-Skeleton.md`

---

## Current Runnable Evidence (Provisional)

Observed from current `R3-F` runnable mock path and tests:

- `h3.manager.v1` is listable/runnable
- manager control turn sequence is explicit delegate/finalize, not fallback-only
- planner/systems/critic enforce upstream-context prerequisites
- malformed worker output fails synthesizer finalization (fail-loud)

Observed current final output fields in runnable baseline:

- `strengths`
- `bottlenecks`
- `merge_risks`
- `refactor_ideas`

Guardrail:

- this field set is treated as current runnable evidence only
- this is not final canonical `R3-G` section law in Step 3

---

## H3 Smoke Review Skeleton (Step 3 Draft)

### A. Preflight

- [ ] `h3.manager.v1` is listed from CLI.
- [ ] input payload (`goal`) is recorded.
- [ ] provider/config used for the run is recorded.

### B. Run Sanity

- [ ] run reaches terminal runtime status (`SUCCEEDED`, `FAILED`, `CANCELLED`, or `TIMED_OUT`).
- [ ] run has non-empty `run_id`.
- [ ] run + trace artifacts exist.
- [ ] output payload is non-empty.

### C. Manager Orchestration Sanity

- [ ] `output_payload.manager_orchestration` is present.
- [ ] turn actions include explicit delegates before finalize.
- [ ] delegate targets follow current runnable manager-worker flow (`intake`, `planner`, `systems`, `critic`).
- [ ] evidence does not rely on fallback-only behavior.

### D. Worker Evidence and Fail-Loud Checks

- [ ] planner requires intake context.
- [ ] systems requires planner context.
- [ ] critic requires systems context.
- [ ] malformed worker output is surfaced as explicit failure, not silent defaulting.

### E. Current Runnable Output Field Presence (Provisional)

- [ ] current runnable field set is present in final output.
- [ ] `strengths`, `bottlenecks`, `merge_risks`, and `refactor_ideas` are non-empty lists in observed runs.
- [ ] if these checks pass but review quality is weak, result cannot be treated as final `PASS`.

### F. Provisional Human Usefulness Prompt (Step 3)

- [ ] strengths are architecture-grounded, not generic praise.
- [ ] bottlenecks and merge risks are specific enough for planning follow-up.
- [ ] refactor ideas are bounded and do not assume cross-track contract churn.

### G. Documentation and Ownership

- [ ] outcome recorded as `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`.
- [ ] failures include owning track and next action.
- [ ] any section-law uncertainty is explicitly marked for `R3-G`/Step 4 resolution.

---

## Deferred Finalization Items (Step 4 After `R3-G`)

The following are explicitly deferred and must not be frozen in this Step 3 skeleton:

- exact canonical H3 output-section naming/order
- final structural completeness gate tied to `R3-G` output-section decisions
- final human-usefulness acceptance wording for H3 draft-review quality
- any automation beyond docs-first rubric definition

---

## Outcome Labels (Provisional)

- `PASS`: provisional structural checks pass and output appears usable for draft architecture review.
- `PARTIAL`: structural run succeeds but one or more rubric checks are weak.
- `FAIL`: required structural checks fail.
- `BLOCKED`: rubric-level classification used when execution/evidence collection is blocked by environment or dependency constraints.

These labels remain provisional in Step 3 and are finalized in Step 4 after `R3-G`.

---

## Known Limits

- This skeleton is based on current runnable mock-backed evidence and does not claim final quality ranking.
- This step does not finalize H3 output-section law.
- This step does not introduce scoring/judge semantics.

---

## Downstream Handoff

- `R3-G` finalizes H3 output-section naming/order decisions.
- `R3-H` Step 4 finalizes this smoke review against completed `R3-G` output form.
