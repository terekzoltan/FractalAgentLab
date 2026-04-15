# Wave3-W3-SB-TrackD-R3-M-OpenRouter-Adapter-MVP

## Scope

Track D implemented Wave 3 side-batch Step 1 `R3-M` as a narrow real-provider MVP.

Scope lock applied:

- acceptance anchor: `h1.single.v1` only
- adapter/provider boundary work only
- fake-transport validation only (no live provider smoke claim)

Out of scope for this step:

- `R3-N` routing-policy hardening
- `R3-O` failure/fallback policy hardening
- `R3-P` Track E smoke/evidence closeout
- OpenAI parity, cross-provider comparison, rate-limit/backoff policy

---

## Implemented Surfaces

- `src/fractal_agent_lab/adapters/openrouter/adapter.py`
  - real OpenRouter request path added
  - provider-config/env-key based auth lookup
  - strict JSON-object parsing for model content
  - fail-loud behavior on transport/envelope/content errors
  - preserves requested-vs-response model identity for inspectability
- `src/fractal_agent_lab/adapters/step_runner.py`
  - default adapter instantiation now plumbs `providers.openrouter` config into `OpenRouterAdapter`

---

## Guardrails Enforced

- no hidden default model selection (`request.model` is required)
- no silent fallback to `mock`
- no workflow-semantic repair in adapter layer
  - no invented output keys
  - no key rename heuristics
  - no semantic rescue output synthesis
- `mock` remains the default-safe route via `configs/providers.example.yaml`

---

## Validation Evidence

Executed test slices:

- `tests/adapters/test_openrouter_adapter.py`
  - success path
  - missing model/auth failures
  - real `HTTPError`/non-success status path
  - invalid envelope / missing choice / missing message / empty content failures
  - invalid/non-object JSON content failures
  - transport `URLError` failure
- `tests/adapters/test_h1_single_step_runner.py`
  - `h1.single.v1` fake-transport integration proof through `build_step_runner(...)` + provider config plumbing

These validations prove a runnable, bounded, real-provider adapter path at `h1.single.v1` scope without claiming broader provider parity.

---

## Known Gaps / Next Step Inputs

- `R3-N` still needed for explicit policy-level routing hardening beyond current selection shell
- `R3-O` still needed for conservative fallback policy and boundary-reviewed failure semantics
- `R3-P` still needed for Track E smoke/evidence note over the real-provider path
- manager/handoff real-provider stability is intentionally not claimed in `R3-M`
