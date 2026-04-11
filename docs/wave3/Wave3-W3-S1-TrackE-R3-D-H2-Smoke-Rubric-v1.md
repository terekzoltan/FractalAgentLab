# Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-v1.md

## Purpose

This document records Track E final delivery for Wave 3 Sprint `W3-S1` Step 4 epic `R3-D`.

`R3-D` now defines the **final manual smoke rubric** for `h2.manager.v1` after `R3-C` froze the H2 output template.

This is a manual operator artifact and is not a benchmark or judge-scoring system.

---

## Scope

In scope:

- final `h2.manager.v1` smoke rubric v1
- docs-first manual verification against frozen `R3-C` target
- structural + usefulness gates for project decomposition output
- evidence capture for `h2.manager.v1` mock-run path

Out of scope:

- new eval module creation
- new smoke script creation
- scoring/judge semantics
- runtime/core contract churn
- CLI formatting/provenance expansion
- prompt/version changes as gate conditions

---

## Readiness Basis

`R3-D` is ready to finalize because:

- `R3-A` is complete (`h2.manager.v1` schema exists) and reviewed
- `Track B` reviewed `R3-A` schema/runtime contract
- `R3-B` is complete (registered manager workflow and runnable pack)
- `R3-C` froze the canonical H2 output surface and key shape constraints
- `R3-C` also tightened mock finalizer behavior so malformed outputs fail loudly

Key references:

- `docs/wave3/Wave3-W3-S1-R3-A-H2-Workflow-Schema-v1.md`
- `docs/wave3/Wave3-W3-S1-TrackB-R3-A-Schema-Review.md`
- `docs/wave3/Wave3-W3-S1-R3-B-H2-Agent-Pack-v1.md`
- `docs/wave3/Wave3-W3-S1-R3-C-H2-Output-Template-v1.md`

---

## Canonical H2 Target Surface

This section is now frozen by `R3-C` and used as the final rubric target.

Exact key order:

1. `project_summary`
2. `tracks`
3. `modules`
4. `phases`
5. `dependency_order`
6. `implementation_waves`
7. `recommended_starting_slice`
8. `risk_zones`
9. `open_questions`

Canonical field-shape intent:

- `project_summary`: non-empty text
- `tracks`: non-empty list
- `modules`: non-empty list
- `phases`: non-empty list
- `dependency_order`: non-empty list
- `implementation_waves`: non-empty list of objects where each object has:
  - `wave`: non-empty text
  - `focus`: non-empty list
- `recommended_starting_slice`: non-empty text owned by planner sequencing
- `risk_zones`: non-empty list
- `open_questions`: non-empty list

Prompt/version note (evidence only, not a gate):

- `h2.prompt.v2`
- `h2/planner/v2`
- `h2/synthesizer/v2`
- `h2.intake`, `h2.architect`, `h2.critic` remain at `v1`

---

## Current Runnable Evidence

Baseline evidence for this rubric is the current mock runnable path:

- `h2.manager.v1` listed in workflow registry
- `h2.manager.v1` executes successfully on mock provider with explicit delegate/finalize turns
- ordered final output template-law is validated on the runnable adapter surface in:
  - `tests/adapters/test_h2_manager_step_runner.py`
- workflow-spec checks remain representative compatibility coverage in:
  - `tests/workflows/test_h2_workflow_spec.py`

---

## Execution Procedure

1. Confirm `h2.manager.v1` is available:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli list-workflows
```

2. Run smoke payload (JSON for artifact paths and `manager_orchestration`):

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h2.manager.v1 \
  --input-json '{"goal":"Turn a broad software project into a dependency-aware implementation plan"}' \
  --format json --show-trace
```

3. Record evidence from command output and run/trace artifacts and run checks below.

---

## Final H2 Smoke Rubric v1

### A. Preflight

- [ ] `h2.manager.v1` is listable from CLI.
- [ ] Input payload used in the run is recorded.
- [ ] Provider/config used for the run is recorded.

### B. Run Sanity

- [ ] run reaches terminal runtime status (`SUCCEEDED`, `FAILED`, `CANCELLED`, or `TIMED_OUT`); non-success outcomes include explicit reason evidence.
- [ ] run_id is non-empty.
- [ ] run artifact and trace artifact paths exist.
- [ ] output payload is non-empty.

### C. Artifact and Trace Sanity

- [ ] `final_output` exists in the output payload.
- [ ] `manager_orchestration` exists in the output payload.
- [ ] manager turn sequence shows explicit delegate actions followed by finalize (not finalize-only fallback).
- [ ] run status and final trace tail do not conflict (terminal event reflects final run state).

### D. Manager Orchestration Sanity

- [ ] delegate order is `intake -> planner -> architect -> critic`.
- [ ] finalize occurs only after worker sequence has been observed.
- [ ] worker dependency chain is enforced in code path (`planner` requires intake context; `architect` requires planner context; `critic` requires architect context).

### E. Canonical Template Compliance

- [ ] final output key order is exactly:
  `project_summary`, `tracks`, `modules`, `phases`, `dependency_order`, `implementation_waves`, `recommended_starting_slice`, `risk_zones`, `open_questions`
- [ ] all required keys are present.
- [ ] `implementation_waves` is a non-empty list, not list-of-text.
- [ ] every `implementation_waves` item is an object with:
  - `wave` (non-empty text)
  - `focus` (non-empty list)
- [ ] `recommended_starting_slice` is non-empty text.

### F. Human Usefulness Gate

- [ ] output shows real decomposition structure, not only goal repetition.
- [ ] tracks/modules/phases provide distinct layers of decomposition.
- [ ] dependency order is implementable as an ordering hint for sequencing work.
- [ ] risk zones and open questions are concrete and actionable.

If structural checks pass but decomposition usefulness is weak, result is `PARTIAL`.

### G. Documentation and Ownership

- [ ] outcome recorded as `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`.
- [ ] any non-PASS outcome includes owning track and next action.

---

## Outcome Labels

- `PASS`: all required checks pass and output is usable for real project decomposition planning.
- `PARTIAL`: structural checks pass but useful decomposition quality is weak.
- `FAIL`: any required structural or canonical-compliance check fails.
- `BLOCKED`: rubric-level classification used when execution/evidence collection is blocked by environment or dependency constraints.

---

## Evidence Template

Record at minimum:

- date/time
- input payload
- provider/config
- run id
- run artifact path
- trace artifact path
- observed `final_output` key order
- observed `manager_orchestration.turns` summary
- outcome label
- owner and next action for any non-PASS result

---

## Known Limits

- this is a manual structural/usefulness smoke on mock evidence, not a final quality ranking system
- this is not an orchestration winner comparison
- not a benchmark replacement

---

## Downstream Handoff

- `W3-S2` may open at `R3-E` now that `R3-D` is finalized.
- `R3-H` may use this finalized H2 rubric structure as a template for H3 review quality checks.
