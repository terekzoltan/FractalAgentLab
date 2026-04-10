# Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-Skeleton.md

## Purpose

This document records Track E `R3-D` delivery for Wave 3 Sprint `W3-S1` Step 3 as a
**skeleton prep artifact**.

It is intentionally provisional:

- this is a draft smoke-rubric structure based on current runnable H2 evidence
- this is not the final `R3-D` smoke rubric
- final rubric freeze remains Step 4 scope and requires `R3-C` completion

---

## Scope

In scope (`R3-D` Step 3 skeleton prep):

- define a docs-first H2 smoke-rubric structure for manual/operator use
- capture current runnable evidence from `R3-A` + Track B `R3-A` review + `R3-B`
- separate what is currently observed from what must be finalized after `R3-C`
- preserve anti-false-green discipline while avoiding premature template-law claims

Out of scope in this step:

- final H2 output-template freeze
- final usefulness gate wording tied to the `R3-C` output template
- new eval module creation
- new smoke script creation
- scoring/judge semantics
- runtime/core contract changes
- CLI formatting or export changes

---

## Readiness Basis

`R3-D` skeleton prep is ready because:

- `R3-A` is complete (`h2.manager.v1` contract exists)
- Track B `R3-A` review is complete (manager boundary invariants confirmed/hardened)
- `R3-B` is complete (runnable H2 manager role-pack baseline exists)

Current operational references:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `docs/wave3/Wave3-W3-S1-R3-A-H2-Workflow-Schema-v1.md`
- `docs/wave3/Wave3-W3-S1-TrackB-R3-A-Schema-Review.md`
- `docs/wave3/Wave3-W3-S1-R3-B-H2-Agent-Pack-v1.md`

---

## Evidence Inputs

Primary code/test surfaces for current runnable evidence:

- `src/fractal_agent_lab/workflows/h2.py`
- `src/fractal_agent_lab/agents/h2/pack.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
- `tests/workflows/test_h2_workflow_spec.py`
- `tests/runtime/test_workflow_executor_manager.py`
- `tests/adapters/test_h2_manager_step_runner.py`

Manual-rubric template reference:

- `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md`

---

## Current Runnable Evidence (Provisional)

Observed from current `R3-B` runnable mock path and tests:

- `h2.manager.v1` is listable/runnable
- manager control turn sequence is explicit delegate/finalize, not fallback-only
- planner/architect/critic enforce upstream-context prerequisites
- malformed worker output fails synthesizer finalization (fail-loud)

Observed current final output fields in runnable baseline:

- `project_summary`
- `tracks`
- `modules`
- `phases`
- `dependency_order`
- `implementation_waves`
- `recommended_starting_slice`
- `risk_zones`
- `open_questions`

Guardrail:

- this field set is treated as current runnable evidence only
- this is not final canonical `R3-C` template law in Step 3

---

## H2 Smoke Rubric Skeleton (Step 3 Draft)

### A. Preflight

- [ ] `h2.manager.v1` is listed from CLI
- [ ] input payload (`goal`) is recorded
- [ ] provider/config used for the run is recorded

### B. Run Sanity

- [ ] run reaches terminal status
- [ ] run has non-empty `run_id`
- [ ] run + trace artifacts exist
- [ ] output payload is non-empty

### C. Manager Orchestration Sanity

- [ ] `output_payload.manager_orchestration` is present
- [ ] turn actions include explicit delegates before finalize
- [ ] delegate targets follow current runnable manager-worker flow (`intake`, `planner`, `architect`, `critic`)
- [ ] evidence does not rely on fallback-only behavior

### D. Worker Evidence and Fail-Loud Checks

- [ ] planner requires intake context
- [ ] architect requires planner context
- [ ] critic requires architect context
- [ ] malformed worker output is surfaced as explicit failure, not silent defaulting

### E. Current Runnable Output Field Presence (Provisional)

- [ ] current runnable field set is present in final output
- [ ] structural list/text fields needed for decomposition are non-empty where expected
- [ ] if these checks pass but decomposition usefulness is weak, result cannot be treated as final `PASS`

### F. Provisional Human Usefulness Prompt (Step 3)

- [ ] decomposition is more than project-goal restatement
- [ ] dependency order is actionable for implementation sequencing
- [ ] risk zones and open questions are concrete enough for follow-up

### G. Documentation and Ownership

- [ ] outcome recorded as `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`
- [ ] failures include owning track and next action
- [ ] any template-law uncertainty is explicitly marked for `R3-C`/Step 4 resolution

---

## Deferred Finalization Items (Step 4 After `R3-C`)

The following are explicitly deferred and must not be frozen in this Step 3 skeleton:

- exact canonical H2 output-template section naming/order
- final structural completeness gate tied to `R3-C` output-template decisions
- final human-usefulness gate wording for H2 decomposition acceptance
- any automation beyond docs-first rubric definition

---

## Outcome Labels (Provisional)

- `PASS`: provisional structural checks pass and output appears usable for decomposition planning
- `PARTIAL`: structural run succeeds but one or more rubric checks are weak
- `FAIL`: required structural checks fail
- `BLOCKED`: run cannot proceed due to dependency/environment blocker

These labels remain provisional in Step 3 and are finalized in Step 4 after `R3-C`.

---

## Known Limits

- This skeleton is based on current runnable mock-backed evidence and does not claim final quality ranking.
- This step does not finalize H2 output-template law.
- This step does not introduce scoring/judge semantics.

---

## Downstream Handoff

- `R3-C` finalizes H2 output-template decisions.
- `R3-D` Step 4 finalizes this rubric against completed `R3-C` output form.
