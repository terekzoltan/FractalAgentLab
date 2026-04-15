# Wave3-W3-SB-TrackD-R3-N-R3-O-Routing-and-Failure-Policy-v1

## Scope

Track D implemented Wave 3 side-batch Step 2 in sequence:

1. `R3-N` explicit routing policy v1
2. `R3-O` conservative provider failure/fallback policy v1

This batch is intentionally bounded to Wave 3 MVP scope.

---

## R3-N: Routing Policy v1

Canonical policy source:

- `src/fractal_agent_lab/adapters/routing.py`

Wave 3 supported routing targets:

- `mock`
- `openrouter`

Selection law (`explicit_v1`):

1. `AgentSpec.metadata["provider"]` when valid + enabled
2. `providers_config.default_provider` when valid + enabled
3. implicit safe default: `mock`

Guardrails:

- no `first enabled provider wins`
- no implicit `openai`/`local` route in Wave 3
- unsupported/disabled explicit selection fails loudly
- CLI `--provider` override reuses this same policy source

---

## R3-O: Conservative Failure/Fallback Policy v1

Default:

- `fallback_policy: none`

Opt-in:

- `fallback_policy: conservative_mock`

Conservative fallback behavior:

- fallback execution point: `AdapterStepRunner`
- router remains selection-only (not fallback engine)
- single attempt only
- only `openrouter -> mock`
- same request payload
- only recoverable provider failures

Non-goal behaviors explicitly blocked:

- no silent fallback-to-mock
- no multi-hop fallback chain
- no fallback on provider-config/model-contract failures
- no workflow-semantics repair inside adapter/fallback path

---

## Inspectability Guarantees

Successful step `raw` now includes:

- `routing` metadata (`selected_provider`, `selection_source`, `selection_mode`, `fallback_policy`, model refs)
- `provider_attempts`
- `fallback` result block (`used`, `policy`, `from_provider`, `to_provider`, `reason`)

Failure details include policy/attempt context so terminal failure envelopes remain legible.

Request-boundary guardrail:

- OpenRouter request payload serialization now fails loud on non-JSON-serializable runtime data instead of stringifying it implicitly.

---

## Implemented Surfaces

- `src/fractal_agent_lab/adapters/routing.py`
- `src/fractal_agent_lab/adapters/step_runner.py`
- `src/fractal_agent_lab/adapters/openrouter/adapter.py`
- `src/fractal_agent_lab/cli/app.py`
- `configs/providers.example.yaml`
- `docs/Track-D-Adapter-Contract.md`

---

## Validation Coverage

Primary tests:

- `tests/adapters/test_provider_router.py`
- `tests/adapters/test_openrouter_adapter.py`
- `tests/adapters/test_h1_single_step_runner.py`
- `tests/cli/test_r3_n_provider_override_policy.py`

Regression checks should include adjacent adapter paths (`h1/h2/h3` mock-manager tests) to prove no regression in non-provider-fallback paths.

---

## Known Gaps / Next Step Inputs

- `R3-O` still requires Track B boundary review confirmation (`R3-O boundary review` in Combined Step 3)
- `R3-P` remains the downstream Track E smoke/evidence closeout
- existing `h1_smoke_comparison` / `h1_memory_materiality` eval surfaces remain mock-only in Wave 3 so the bounded `h1.single.v1` real-provider claim does not widen prematurely
- OpenAI/local routing and broader parity hardening remain Wave 4 scope
