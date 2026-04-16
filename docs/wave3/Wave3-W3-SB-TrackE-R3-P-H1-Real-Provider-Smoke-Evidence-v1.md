# Wave3-W3-SB-TrackE-R3-P-H1-Real-Provider-Smoke-Evidence-v1

## Purpose

Track E delivery for Wave 3 side-batch Step 3 epic `R3-P`.

This step validates one bounded real-provider smoke path and records artifact-backed evidence
without widening into compare/materiality surfaces that remain mock-only in Wave 3.

---

## Disclosure

- execution mode: `manual_policy_driven`
- visibility/audit state: git-visible coordination/code surfaces plus local `data/` artifacts were consulted; real-provider conclusions depend on local credentials/network/model mapping and canonical stored artifacts

---

## Scope

In scope:

- workflow: `h1.single.v1`
- provider: `openrouter`
- claim: one bounded real-provider smoke path
- artifact-backed inspection for provider/fallback/model truth

Out of scope:

- `h1.manager.v1` / `h1.handoff.v1` real-provider claims
- cross-provider compare/parity
- `run_h1_smoke_comparison(...)` or `run_h2_l_h1_memory_materiality(...)` widening
- Wave 4 routing/backoff/parity hardening

---

## Upstream Preconditions Consumed

- `R3-M` OpenRouter adapter MVP
- `R3-N` explicit routing policy v1
- `R3-O` conservative fallback policy v1
- Track B `R3-O` boundary review signoff

Canonical references:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `docs/wave3/Wave3-W3-SB-TrackD-R3-M-OpenRouter-Adapter-MVP.md`
- `docs/wave3/Wave3-W3-SB-TrackD-R3-N-R3-O-Routing-and-Failure-Policy-v1.md`

---

## Implemented Surfaces

- `src/fractal_agent_lab/evals/r3_p_h1_real_provider_smoke.py`
- `scripts/run_r3_p_h1_real_provider_smoke.py`
- `tests/evals/test_r3_p_h1_real_provider_smoke.py`
- `docs/wave3/Wave3-W3-SB-TrackE-R3-P-H1-Real-Provider-Smoke-Evidence-v1.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Evidence Law (PASS Criteria)

`real_provider_smoke_passed` requires all of:

1. workflow is `h1.single.v1`
2. selected provider was `openrouter`
3. executed provider is also `openrouter`
4. fallback was not used
5. run status is `succeeded`
6. artifact validation passed
7. replay is ready
8. comparable single-output is complete

Important separation:

- `track_e_evidence_ready` means the report is structurally handoff-ready.
- `real_provider_smoke_passed` means the bounded real-provider claim is true.
- fallback-backed success may still be inspectable evidence, but not PASS.

---

## Provider/Fallback Truth Source

Provider/fallback/model truth is read from canonical run artifacts, not CLI stdout.

Specifically, the helper reads run artifact truth for:

- selected provider (`step_results.single.raw.routing.selected_provider` / failure details fallback)
- executed provider (`step_results.single.provider` with attempt fallback inference)
- fallback usage (`step_results.single.raw.fallback.used` with attempt fallback inference)
- provider attempts (`step_results.single.raw.provider_attempts` / failure details fallback)
- requested/response model (`step_results.single.raw.requested_model` / `response_model`)

---

## Validation

Executed test suites:

1. `PYTHONPATH=src python -m unittest tests.evals.test_r3_p_h1_real_provider_smoke tests.adapters.test_openrouter_adapter tests.adapters.test_provider_router tests.adapters.test_h1_single_step_runner tests.cli.test_r3_n_provider_override_policy`

Executed script smoke checks:

1. inspect-only negative (non-openrouter historical run):
   - `PYTHONPATH=src python -m scripts.run_r3_p_h1_real_provider_smoke --run-id 28624e30-7937-4137-b889-f4a696350d60 --data-dir data`
   - expected: `real_provider_smoke_passed: false`
2. live + inspect bounded run:
   - `PYTHONPATH=src python -m scripts.run_r3_p_h1_real_provider_smoke --runtime-config configs/runtime.example.yaml --providers-config configs/providers.example.yaml --model-policy-config configs/model_policy.example.yaml --provider openrouter`

Trace drill-down check:

- `PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id ee1e6a8f-f9c1-40c8-9895-7696f1f52322`

---

## Observed Evidence Snapshot

Bounded live evidence run:

- run id: `ee1e6a8f-f9c1-40c8-9895-7696f1f52322`
- workflow: `h1.single.v1`
- selected provider: `openrouter`
- executed provider: `openrouter`
- fallback used: `false`
- run status: `succeeded`
- artifact validation: pass
- replay: ready
- comparable single-output: complete
- `real_provider_smoke_passed`: `true`

Inspect-only negative control (historical mock run):

- run id: `28624e30-7937-4137-b889-f4a696350d60`
- selected provider truth unavailable in legacy payload, executed provider `mock`
- `real_provider_smoke_passed`: `false`

---

## Known Limits

- This is a bounded `h1.single.v1` smoke/evidence surface only.
- No manager/handoff real-provider claim is made.
- No provider parity claim is made.
- If a future environment is blocked (credentials/network/model mapping), outcome should be `BLOCKED`, never softened into green.

---

## Downstream Coordination Note

- Track E `R3-P` smoke/evidence scope is complete.
- Step 3 side-batch closeout can be treated as complete with Track B boundary review signoff and this Track E evidence note.
