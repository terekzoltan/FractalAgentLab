# Wave4-W4-S1-TrackD-P4-C-Routing-Policy-Hardening-v2

## Scope

Track D implemented Wave 4 Sprint `W4-S1` Step 2 `P4-C` as a narrow routing-policy hardening slice.

Scope lock applied:

- routing/model-policy validation hardening only
- provider boundary behavior stays inside Track D adapter/routing surfaces
- `selection_mode` remains `explicit_v1`

Out of scope for this step:

- `P4-B` cross-provider smoke comparison evidence
- rate-limit/backoff handling (`P4-D`)
- model-tier recommendation policy (`P4-F`)
- local provider support
- fallback widening
- runtime schema redesign

---

## Implemented Surfaces

- `src/fractal_agent_lab/adapters/routing.py`
  - malformed routing/provider/model-policy config blocks now fail loudly through `ProviderRouter.resolve(...)`
  - real providers (`openai`, `openrouter`) require a resolved non-empty model
  - `conservative_mock` is compatible only with selected provider `openrouter`
- `tests/adapters/test_provider_router.py`
  - router-boundary negative tests for malformed config blocks
  - real-provider missing-model negative tests
  - fallback-policy compatibility tests
- `docs/Track-D-Adapter-Contract.md`
  - routing hardening v2 behavior documented

---

## Policy Semantics

Provider selection remains explicit and bounded:

1. `AgentSpec.metadata["provider"]` when valid and enabled
2. `providers_config.default_provider` when valid and enabled
3. implicit safe default: `mock`

P4-C hardening adds these enforcement rules:

- malformed `providers.routing` / `providers.providers` blocks fail loudly
- malformed `model_policy.workflow_overrides` / `model_policy.tier_defaults` blocks fail loudly
- malformed `model_policy.workflow_overrides[workflow_id]` entries fail loudly
- selected `openai` / `openrouter` require a resolved model
- selected `mock` may still run without a model
- `conservative_mock` remains bounded to `openrouter -> mock`

---

## Guardrails Enforced

- no `first enabled provider wins`
- no `openai -> mock` fallback
- no `mock -> mock` fallback policy ambiguity
- no multi-hop fallback chain
- no provider scoring or automatic provider ranking
- no cross-provider quality claim
- no live provider comparison claim

---

## Validation Evidence

Targeted validation for this slice includes:

- `tests/adapters/test_provider_router.py`
  - malformed config rejection through `resolve(...)`
  - missing model rejection for real providers
  - fallback compatibility enforcement
- `tests/adapters/test_h1_single_step_runner.py`
  - existing `openrouter -> mock` conservative fallback regression remains green
- `tests/cli/test_r3_n_provider_override_policy.py`
  - provider override routing behavior remains explicit and inspectable

---

## Known Gaps / Next Step Inputs

- `P4-B` still owns real cross-provider smoke comparison (`openrouter` vs `openai`)
- if `P4-B` uses separate model-policy configs per provider, that must be disclosed as provider-path smoke rather than model/provider quality comparison
- `P4-D` still owns rate-limit/backoff handling
- `P4-F` still owns later model-tier recommendation policy closeout
