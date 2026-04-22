# Wave4-W4-S1-TrackD-P4-A-OpenAI-Compatible-Adapter-MVP

## Scope

Track D implemented Wave 4 Sprint `W4-S1` Step 1 `P4-A` as a narrow second-provider adapter MVP.

Scope lock applied:

- acceptance anchor: `h1.single.v1` only
- adapter/provider boundary work only
- fake-transport integration proof only (no live-provider comparison claim)

Out of scope for this step:

- `P4-B` cross-provider smoke comparison
- `P4-C` routing policy hardening v2
- fallback policy widening
- manager/handoff/H2/H3 real-provider claims
- Wave 4 Step 2+ hardening (`P4-D`, `P4-E`, `P4-F`)

---

## Implemented Surfaces

- `src/fractal_agent_lab/adapters/openai/adapter.py`
  - real OpenAI-compatible request path added
  - provider-config/env-key auth lookup
  - strict JSON-object-only parse/fail-loud behavior
  - requested-vs-response model inspectability
- `src/fractal_agent_lab/adapters/routing.py`
  - `openai` added as a supported provider target
- `src/fractal_agent_lab/adapters/step_runner.py`
  - default adapter wiring now threads `providers.openai` config into `OpenAICompatibleAdapter`
- `src/fractal_agent_lab/cli/app.py`
  - `--provider` help text updated for Wave 4 supported targets
- `configs/providers.example.yaml`
  - `providers.openai` block added

---

## Guardrails Enforced

- no hidden default model selection (`request.model` is required)
- no silent fallback
- no workflow-semantic repair in adapter layer
  - no invented output keys
  - no key rename heuristics
  - no semantic rescue output synthesis
- fallback policy remains unchanged (`conservative_mock` remains bounded to `openrouter -> mock`)

---

## Parity Pass Meaning (Bounded)

`P4-A` parity pass means adapter-boundary parity only:

- explicit model requirement
- strict JSON-object-only parsing
- fail-loud transport/http/envelope/content behavior
- inspectable raw fields
- same logical request shape through the adapter boundary

It does **not** mean:

- output-quality parity
- prompt-quality parity
- cross-provider behavioral sameness on real tasks

---

## Validation Evidence

Executed test slices:

- `tests/adapters/test_openai_adapter.py`
  - success path
  - missing model/auth failures
  - real `HTTPError`/non-success status path
  - invalid envelope/content failures
  - transport failure
  - request payload serialization failure
- `tests/adapters/test_h1_single_step_runner.py`
  - `h1.single.v1` fake-transport integration proof through `build_step_runner(...)`
  - explicit non-default `providers.openai` plumbing proof (`api_key_env` + `chat_completions_url`)
- `tests/adapters/test_provider_router.py`
  - `openai` routing support and override acceptance
- `tests/cli/test_r3_n_provider_override_policy.py`
  - CLI `--provider openai` acceptance

---

## Known Gaps / Next Step Inputs

- `P4-B` still needed for Track E cross-provider smoke comparison evidence (`openrouter` vs `openai`)
- `P4-C` still needed for routing policy hardening v2 from real-provider evidence
- `P4-D` still needed for rate-limit/backoff hardening
- existing `R3-P` helper remains bounded to OpenRouter and should not be treated as provider-parity evidence
