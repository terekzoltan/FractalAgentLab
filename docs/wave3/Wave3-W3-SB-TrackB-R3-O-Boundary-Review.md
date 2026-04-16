# Wave3-W3-SB-TrackB-R3-O-Boundary-Review.md

## Purpose

This document records Track B review outcomes for Wave 3 side-batch Step 3 epic:

- `R3-O` boundary review (provider failure/fallback boundary confirmation)

---

## Scope

In scope:

- confirm provider fallback/error behavior from `R3-O` does not leak into Track B canonical runtime law
- confirm top-level step result `provider` / `model` semantics after fallback
- confirm inspectability fields remain additive and non-canonical
- confirm provider-specific failure details in runtime envelopes remain additive details only

Out of scope:

- provider-policy redesign (`R3-N` successor scope)
- provider expansion or parity (`R3-P` closeout and Wave 4)
- generic runtime/executor redesign
- eval policy rewrite beyond side-batch boundary consumption

---

## Reviewed Surfaces

Primary review targets:

- `src/fractal_agent_lab/adapters/step_runner.py`
- `src/fractal_agent_lab/core/errors/runtime_errors.py`
- `src/fractal_agent_lab/runtime/executor.py`

Supporting boundary/context surfaces:

- `src/fractal_agent_lab/adapters/routing.py`
- `src/fractal_agent_lab/adapters/openrouter/adapter.py`
- `src/fractal_agent_lab/cli/app.py`
- `tests/adapters/test_h1_single_step_runner.py`
- `tests/adapters/test_provider_router.py`
- `tests/adapters/test_openrouter_adapter.py`
- `tests/cli/test_r3_n_provider_override_policy.py`
- `docs/wave3/Wave3-W3-SB-TrackD-R3-N-R3-O-Routing-and-Failure-Policy-v1.md`
- `docs/Track-D-Adapter-Contract.md`

---

## Confirmation Outcome

### Executed truth vs selection truth

- top-level step fields (`provider`, `model`) remain executed-truth surfaces after fallback
- when conservative fallback triggers (`openrouter -> mock`), executed step output reports the fallback provider result
- selected-provider metadata remains visible in additive inspectability surfaces (`raw.routing`)

### Additive inspectability surfaces (not runtime law)

Track B confirms these are additive inspectability fields, not canonical runtime contracts:

- `raw.routing`
- `raw.provider_attempts`
- `raw.fallback`

These fields are accepted as boundary telemetry for provider behavior and failure-path explainability.

### Provider-specific failure details in generic envelopes

- provider-specific fields inside error `details` are accepted only as additive details
- generic runtime envelope/category law remains unchanged (`RuntimeBoundaryError` / `StepExecutionError` vocabulary and `runtime_error_envelope.v1` contract)
- no new Track B runtime category/schema law was introduced by `R3-O`

---

## Findings

1. No new shared runtime invariant hole was found in `R3-O` review scope.
2. Fallback boundary remains contained to adapter layer (`AdapterStepRunner`) and does not redesign generic runtime semantics.
3. A docs wording drift was present around fallback request wording (`same request payload`) while implementation intentionally clears fallback execution model (`model=None`). This is now aligned in docs so executed-truth semantics remain explicit.

Resulting Track B implementation shape:

- docs-first confirmation
- status/sequencing updates
- no production code change required

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.adapters.test_provider_router tests.adapters.test_openrouter_adapter tests.adapters.test_h1_single_step_runner tests.cli.test_r3_n_provider_override_policy`
3. `PYTHONPATH=src python -m unittest tests.runtime.test_execution_mode_truth tests.runtime.test_workflow_executor_manager`

Observed:

- provider routing/fallback boundary tests are green
- Track B runtime guardrail suites are green
- no cross-surface blocker emerged in reviewed boundary scope

---

## Downstream Handoff

- Track B `R3-O` boundary signoff is complete.
- Track E may continue/close `R3-P` smoke/evidence flow.
- Even when prep work overlaps in the same numbered step, final downstream `R3-P` acceptance wording remains gated by Track B boundary signoff (now satisfied).
