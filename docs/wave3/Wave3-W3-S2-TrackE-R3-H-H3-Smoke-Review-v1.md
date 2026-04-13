# Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-v1.md

## Purpose

This document records Track E final delivery for Wave 3 Sprint `W3-S2` Step 4 epic `R3-H`.

`R3-H` now defines the **final manual smoke review rubric** for `h3.manager.v1` after `R3-G`
froze the H3 output sections.

This is a manual operator artifact and is not a benchmark or judge-scoring system.

---

## Scope

In scope:

- final `h3.manager.v1` smoke review rubric v1
- docs-first manual verification against frozen `R3-G` target
- structural + draft-quality usefulness gates for architecture review output
- evidence capture for `h3.manager.v1` mock-run path

Out of scope:

- new eval module creation
- new smoke script creation
- scoring/judge semantics
- runtime/core contract churn
- CLI formatting/provenance expansion
- prompt/version changes as gate conditions

---

## Readiness Basis

`R3-H` is ready to finalize because:

- `R3-E` is complete (`h3.manager.v1` schema exists) and reviewed
- `R3-F` is complete (registered runnable manager role pack and fail-loud worker guards)
- `R3-G` froze canonical H3 output section naming/order and tightened runnable exact-order checks
- `R3-H` Step 3 skeleton prep is complete and preserved as a historical artifact

Key references:

- `docs/wave3/Wave3-W3-S2-R3-E-H3-Workflow-Schema-v1.md`
- `docs/wave3/Wave3-W3-S2-TrackB-R3-E-Schema-Review.md`
- `docs/wave3/Wave3-W3-S2-R3-F-H3-Agent-Pack-v1.md`
- `docs/wave3/Wave3-W3-S2-R3-G-H3-Output-Sections-v1.md`
- `docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-Skeleton.md`

---

## Canonical H3 Target Surface

This section is frozen by `R3-G` and is the final rubric target.

Exact key order:

1. `strengths`
2. `bottlenecks`
3. `merge_risks`
4. `refactor_ideas`

Canonical field-shape intent:

- `strengths`: non-empty list
- `bottlenecks`: non-empty list
- `merge_risks`: non-empty list
- `refactor_ideas`: non-empty list

Prompt/version note (evidence only, not a gate):

- `h3.prompt.v2`
- `h3/synthesizer/v2`
- `h3/intake`, `h3/planner`, `h3/systems`, `h3/critic` remain at `v1`

---

## Current Runnable Evidence

Baseline evidence for this rubric is the current mock runnable path:

- `h3.manager.v1` listed in workflow registry
- `h3.manager.v1` executes successfully on mock provider with explicit delegate/finalize turns
- exact final output template-law is validated on runnable adapter surface in:
  - `tests/adapters/test_h3_manager_step_runner.py`
- workflow-spec checks remain representative compatibility coverage in:
  - `tests/workflows/test_h3_workflow_spec.py`

---

## Execution Procedure

1. Confirm `h3.manager.v1` is available:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli list-workflows
```

2. Run smoke payload (JSON for `manager_orchestration`, trace summary, and final output evidence):

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h3.manager.v1 \
  --input-json '{"goal":"Review architecture boundaries for a multi-agent research OS"}' \
  --format json --show-trace
```

3. Record evidence from command output, inspect local run/trace artifacts if your execution environment writes them, and apply the checks below.

---

## Final H3 Smoke Review Rubric v1

### A. Preflight

- [ ] `h3.manager.v1` is listable from CLI.
- [ ] input payload used in the run is recorded.
- [ ] provider/config used for the run is recorded.

### B. Run Sanity

- [ ] run reaches terminal runtime status (`SUCCEEDED`, `FAILED`, `CANCELLED`, or `TIMED_OUT`); non-success outcomes include explicit reason evidence.
- [ ] run_id is non-empty.
- [ ] if local artifact writing is enabled, run artifact and trace artifact paths exist.
- [ ] output payload is non-empty.

### C. Artifact and Trace Sanity

- [ ] `final_output` exists in the output payload.
- [ ] `manager_orchestration` exists in the output payload.
- [ ] manager turn sequence shows explicit delegate actions followed by finalize (not finalize-only fallback).
- [ ] run status and final trace tail do not conflict (terminal event reflects final run state).

### D. Manager Orchestration Sanity

- [ ] delegate order is `intake -> planner -> systems -> critic`.
- [ ] finalize occurs only after worker sequence has been observed.
- [ ] worker dependency chain is enforced in code path (`planner` requires intake context; `systems` requires planner context; `critic` requires systems context).

### E. Canonical Template Compliance

- [ ] final output key order is exactly: `strengths`, `bottlenecks`, `merge_risks`, `refactor_ideas`.
- [ ] all required keys are present.
- [ ] every canonical section is a non-empty list.
- [ ] no alternate section names appear in final output.

### F. Draft-Quality Human Usefulness Gate

- [ ] strengths are architecture-grounded, not generic praise.
- [ ] bottlenecks and merge risks are specific enough to guide follow-up decisions.
- [ ] refactor ideas are bounded and actionable for near-term iteration.
- [ ] output meets draft-quality review usefulness and is not embarrassing to circulate internally.

If structural checks pass but review usefulness is weak, result is `PARTIAL`.

### G. Documentation and Ownership

- [ ] outcome recorded as `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`.
- [ ] any non-PASS outcome includes owning track and next action.

---

## Outcome Labels

- `PASS`: all required checks pass and output is usable for draft architecture review decisions.
- `PARTIAL`: structural checks pass but review usefulness quality is weak.
- `FAIL`: any required structural or canonical-compliance check fails.
- `BLOCKED`: rubric-level classification used when execution/evidence collection is blocked by environment or dependency constraints.

---

## Evidence Template

Record at minimum:

- date/time
- input payload
- provider/config
- run id
- run artifact path (if available from local execution environment)
- trace artifact path (if available from local execution environment)
- observed `final_output` key order
- observed `manager_orchestration.turns` summary
- outcome label
- owner and next action for any non-PASS result

---

## Known Limits

- this is a manual structural/usefulness smoke on mock evidence, not a final quality ranking system
- this is not an orchestration winner comparison
- this is not a benchmark replacement

---

## Downstream Handoff

- `W3-S2` is complete through Step 4 now that `R3-H` is finalized.
- `W3-S3` Step 1 (`R3-I` / `R3-J` / `R3-K`) may proceed in parallel.
