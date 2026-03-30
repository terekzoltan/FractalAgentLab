# Wave0-Manual-Smoke-Checklist.md

## Purpose

This document defines the first manual smoke checklist for Wave 0 (`F0-L`).

Its job is to prevent false confidence by validating that the first runnable path is:

- actually executable,
- trace-visible,
- and operationally understandable.

This is a manual acceptance artifact, not a full eval harness.

---

## Scope

In scope:

- Wave 0 runnable path smoke for `h1.lite` and `wave0.demo`
- run lifecycle sanity (`RunState`)
- trace event sanity (`TraceEvent`)
- CLI output sanity for human inspection
- pass/fail/blocked outcome logging

Out of scope:

- automated smoke suite implementation
- replay engine implementation
- benchmark dataset growth
- LLM judge scoring
- workflow quality optimization claims

---

## Readiness

`READY` for checklist execution design because core contracts and runtime boundaries exist:

- `src/fractal_agent_lab/core/models/run_state.py`
- `src/fractal_agent_lab/core/events/trace_event.py`
- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
- `src/fractal_agent_lab/runtime/executor.py`
- `src/fractal_agent_lab/tracing/emitter.py`

Still dependent on runnable-path wiring and artifact persistence maturity for deeper replay checks.

---

## Smoke Target Definition (Wave 0)

A Wave 0 smoke target is acceptable when all are true:

1. Workflow command starts and finishes with a terminal run status.
2. Trace timeline exists with ordered run and step events.
3. Output payload is structured and non-empty.
4. Failure mode is explicit if execution does not succeed.

Wave 0 does not require production-quality reasoning output.

---

## Execution Command (Current Baseline)

Use the CLI entrypoint function directly (current repo shape):

```bash
PYTHONPATH=src python -c "from fractal_agent_lab.cli.app import run_cli; raise SystemExit(run_cli(['run','h1.lite','--input-json','{\"idea\":\"AI founder assistant\"}','--format','json','--show-trace']))"
```

Optional workflow listing:

```bash
PYTHONPATH=src python -c "from fractal_agent_lab.cli.app import run_cli; raise SystemExit(run_cli(['list-workflows']))"
```

---

## Manual Smoke Checklist v0

### A. Preflight

- [ ] Repo paths exist: `src/`, `configs/`, `docs/`, `examples/`
- [ ] `h1.lite` appears in workflow list
- [ ] Default provider config is present (`mock` expected for Wave 0)

### B. Run Execution

- [ ] Run command exits with code `0` for success path
- [ ] Run summary includes `workflow_id`, `run_id`, `status`
- [ ] `status` is terminal (`succeeded`, `failed`, `timed_out`, `cancelled`)

### C. Trace Visibility

- [ ] Trace includes `run_started`
- [ ] Trace includes at least one `step_started` and `step_completed`
- [ ] Successful run includes `run_completed`; failed run includes `run_failed` or `run_timed_out`
- [ ] Trace sequence values are monotonically increasing

### D. Output Sanity

- [ ] `output_payload` exists for successful run
- [ ] `step_results` keys align with workflow steps (`intake`, `planner`, `synthesizer` for `h1.lite`)
- [ ] No silent empty-output success (success with empty step results is fail)

### E. Error Sanity (Failure Path Spot Check)

- [ ] Failure path returns non-zero exit code
- [ ] Failure includes explicit error text
- [ ] Failure emits trace failure event

### F. Documentation/Handoff

- [ ] Smoke result is logged as `PASS`, `PARTIAL`, `FAIL`, or `BLOCKED`
- [ ] Any contract mismatch is documented before workaround
- [ ] Follow-up dependency owner is named (B/C/D/A/E)

---

## Outcome Labels

- `PASS`: runnable path, trace, and output checks all pass
- `PARTIAL`: run works but one or more smoke acceptance checks fail
- `FAIL`: run does not complete as a usable workflow path
- `BLOCKED`: upstream dependency missing or unstable

---

## Wave 0 Acceptance Mapping

This checklist supports Wave 0 gate conditions from `ops/Combined-Execution-Sequencing-Plan.md`:

- one runnable command completes
- one minimal workflow returns understandable output
- manual smoke checklist exists

Stored trace/run artifact hardening remains tied to `F0-M`.

---

## Risks Guarded by This Checklist

- one-off demo success being misread as reliability
- hidden failures without explicit trace evidence
- contract drift masked by ad hoc local fixes
- premature quality claims without baseline discipline

---

## Next Step After F0-L

1. Execute this checklist against each new runnable variant (`h1.lite`, then others).
2. Feed findings into `F0-M` artifact usability and replay assumptions.
3. Consolidate later operator-smoke learnings into a canonical rubric doc when the workflow family is rich enough (fulfilled later by `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md`).
