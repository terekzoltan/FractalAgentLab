# Track-D-Adapter-Contract.md

## Purpose

This note defines the Track D adapter boundary from Wave 0 foundations through the current
Wave 4 provider-expansion policy state.

It is intentionally minimal and aligned to Track B canonical runtime contracts.

---

## Wave

- Current state: Wave 4 Sprint `W4-S2` `P4-F` technical routing notes and Meta policy closeout are complete
- Completed Track D scope: `P4-A` OpenAI-compatible adapter MVP, `P4-C` routing policy hardening v2, `P4-D` rate-limit/backoff handling v1 (OpenRouter-first only), optional `P4-E` local adapter MVP with routing integration, and `P4-F` technical routing notes
- Parallel evidence scope: `P4-B` remains Track E-owned cross-provider smoke comparison evidence, with Track D provider paths as inputs
- Post-closeout correction scope: provider enabled-flag fail-loud hardening; this is not a new Wave 4 feature
- Out of scope for this contract state: live local runtime support claim, advanced tool/handoff bridges, provider scoring, and provider/model quality parity claims

---

## Runtime Boundary Alignment

Track D integrates via Track B `StepRunner` boundary in `src/fractal_agent_lab/runtime/executor.py`.

`StepRunner` call shape:

- input: `run_state`, `workflow`, `step`
- output: step result payload (opaque to runtime)
- errors: runtime-compatible exceptions

Track D implementation:

- `src/fractal_agent_lab/adapters/step_runner.py`
  - `AdapterStepRunner`
  - `build_step_runner(...)`

---

## Adapter Contract v0

Base contract lives in:

- `src/fractal_agent_lab/adapters/base/contract.py`

Core objects:

- `AdapterStepRequest`
  - `run_id`, `workflow_id`, `step_id`, `agent_id`
  - `input_payload`, `context`, `step_description`, `model`
- `AdapterStepResult`
  - `output`, `provider`, `model`, `raw`
- `ModelAdapter` protocol
  - `execute_step(request) -> AdapterStepResult`

---

## Implemented Providers

- `MockAdapter` (active)
  - path: `src/fractal_agent_lab/adapters/mock/adapter.py`
  - deterministic offline output
  - scripted responses (`step_id`, `agent_id`, `__default__`)
  - failure simulation via configured `fail_steps`

- `OpenAICompatibleAdapter` (Wave 4 `P4-A` MVP)
  - path: `src/fractal_agent_lab/adapters/openai/adapter.py`
  - supports bounded real-provider Chat Completions path with explicit model requirement and strict JSON-object-only fail-loud parsing

- `OpenRouterAdapter` (Wave 3 side-batch MVP)
  - path: `src/fractal_agent_lab/adapters/openrouter/adapter.py`
  - supports one bounded real-provider path for `h1.single.v1`
  - strict JSON-object-only parse/fail-loud behavior remains MVP-scoped, not parity-complete

- `LocalModelAdapter` (Wave 4 optional `P4-E` MVP)
  - path: `src/fractal_agent_lab/adapters/local/adapter.py`
  - supports an explicit local provider route behind disabled-by-default config
  - requires explicit provider selection, enabled provider config, and resolved non-empty model
  - uses a strict JSON HTTP endpoint contract for default transport and fake/injected transport for acceptance evidence
  - supports JSON-object `output` or JSON-object OpenAI-style `choices[0].message.content`
  - no live local runtime, model quality, or provider parity claim is made

Safe default route remains `mock`.
No silent provider fallback is allowed unless explicit fallback policy enables it.

---

## Provider and Model Routing (Wave 4 policy state)

Routing helper lives in:

- `src/fractal_agent_lab/adapters/routing.py`

Input config sources:

- `configs/providers.example.yaml`
- `configs/model_policy.example.yaml`

Wave 4 supported routing targets:

- `mock`
- `openai`
- `openrouter`
- `local` (`P4-E` optional experimental route; disabled by default)

Example config now advertises these bounded Wave 4 targets.

Provider resolution order (`explicit_v1`):

1. `AgentSpec.metadata["provider"]` when valid + enabled
2. `providers_config.default_provider` when valid + enabled
3. implicit safe default: `mock`

Guardrails:

- no `first enabled provider wins` behavior
- `local` was not a Wave 4 routing target in `P4-A` / `P4-C`; it is added only by optional `P4-E`
- unsupported or disabled explicit selections fail loudly
- malformed routing/model-policy config blocks fail loudly instead of being silently coerced to empty mappings
- `providers.<provider>.enabled` must be a real boolean when present; missing means disabled, and explicit non-boolean values fail loudly
- real providers (`openai`, `openrouter`, `local`) require a resolved non-empty model at the routing boundary
- no hidden local default model exists

Fallback policy values:

- default: `none`
- opt-in: `conservative_mock`

Fallback compatibility (`P4-C` hardening):

- `conservative_mock` is valid only when the selected provider is `openrouter`
- `openai + conservative_mock` fails loudly
- `local + conservative_mock` fails loudly
- `mock + conservative_mock` fails loudly
- this mirrors the execution truth in `AdapterStepRunner`, where conservative fallback remains bounded to `openrouter -> mock`

Model selection order:

1. `workflow_overrides[workflow_id][model_policy_ref]`
2. `tier_defaults[model_policy_ref]`
3. `tier_defaults["specialist"]`
4. `None`

---

## F0-I Config Loading Shell

CLI config loading lives in:

- `src/fractal_agent_lab/cli/config_loader.py`

Run command integration lives in:

- `src/fractal_agent_lab/cli/app.py`

Wave 0 run command now accepts:

- `--runtime-config`
- `--providers-config`
- `--model-policy-config`
- `--provider` (optional override)

Supported config format in Wave 0:

- simple mapping-style YAML subset
- JSON mapping files are also accepted

Runtime controls read from config shell:

- `runtime.default_timeout_seconds`
- `runtime.max_retries`

Provider override behavior:

- uses the same provider-policy source as router selection
- rejects unsupported targets (Wave 4: `mock`, `openai`, `openrouter`, `local`)
- sets `default_provider` to the validated target
- may enable the validated provider entry (`openai`, `openrouter`, or `local`) for that run

This keeps provider selection at the adapter/config boundary, not in core workflow logic,
and avoids CLI-vs-router policy drift.

---

## Error Boundary

Track D adapter path uses Track B runtime error vocabulary:

- `RuntimeBoundaryError`
- `StepExecutionError`

Unknown adapter exceptions are wrapped into `StepExecutionError` inside `AdapterStepRunner`.

When fallback policy is active, `AdapterStepRunner` also annotates provider-attempt context
(`provider_attempts`, selected provider metadata, fallback policy/result) so failure paths remain inspectable.

---

## Canonical evolution path

### Wave 0

- `MockAdapter` is the only active execution path.
- `OpenAICompatibleAdapter` and `OpenRouterAdapter` are placeholders only in this historical Wave 0 phase.
- provider selection shell exists, but no real-provider execution claim is made.

### Wave 2

- Track D may prepare config, boundary assumptions, and smoke-design notes against hardened Track B contracts.
- this wave is still prep only for real-provider work
- no canonical claim of real-provider readiness should be made here

### Wave 3

- first real-provider MVP arrives as a non-blocking side batch
- `OpenRouterAdapter` is the preferred first real-provider path
- scope stays intentionally narrow:
  - one real-provider H1 path
  - explicit provider selection
  - explicit failure/fallback behavior
  - narrow smoke/evidence validation

#### Wave 3 Step 1 (`R3-M`) implementation shape

- acceptance anchor is locked to `h1.single.v1`
- validation uses fake-transport evidence for adapter behavior (no live network smoke claim)
- adapter enforces JSON-object-only response parsing and fails loudly on malformed/non-JSON responses
- adapter does not repair workflow semantics:
  - no invented fields
  - no key-rename repair
  - no semantic rescue fallback
- `mock` remains default-safe path and no silent fallback-to-mock is allowed
- delivery note: `docs/wave3/Wave3-W3-SB-TrackD-R3-M-OpenRouter-Adapter-MVP.md`

#### Wave 3 Step 2A (`R3-N`) implementation shape

- router is the canonical provider-selection truth source
- Wave 3 targets are bounded to `mock` and `openrouter`
- selection mode is explicit (`explicit_v1`)
- no `first enabled provider wins` behavior
- CLI `--provider` override reuses the same policy source and does not create a second routing law

#### Wave 3 Step 2B (`R3-O`) implementation shape

- default fallback policy remains `none`
- only explicit opt-in enables `conservative_mock`
- conservative fallback is bounded to:
  - single attempt
  - `openrouter -> mock` only
  - same run/workflow/step/input/context payload, with fallback execution model unset (`model=None`) so top-level execution truth stays provider-accurate
  - recoverable provider failures only
- fallback execution point is `AdapterStepRunner`; router is not a fallback engine
- fallback and provider-attempt behavior must stay inspectable in step `raw` and failure details
- existing H1 compare/materiality eval surfaces remain mock-only in Wave 3; `R3-P` adds a separate bounded `h1.single.v1` real-provider smoke/evidence surface without widening those evals
- delivery note: `docs/wave3/Wave3-W3-SB-TrackD-R3-N-R3-O-Routing-and-Failure-Policy-v1.md`

### Wave 4

- provider expansion and hardening
- `OpenAICompatibleAdapter` joins as the second meaningful path
- routing policy becomes stronger and evidence-backed
- rate-limit/backoff behavior is hardened
- optional local-model experimentation remains contained

#### Wave 4 Step 2B (`P4-C`) implementation shape

- `selection_mode` remains `explicit_v1`; `P4-C` is policy hardening, not a config-mode rename
- malformed provider/model-policy config blocks now fail loudly through `ProviderRouter.resolve(...)`
- real-provider selections require a resolved non-empty model before adapter execution
- `conservative_mock` compatibility is aligned with runtime truth and remains valid only for selected provider `openrouter`
- `P4-C` does not claim `P4-B` cross-provider smoke comparison evidence, model-quality parity, or provider-quality parity

#### Wave 4 Step 1 (`P4-D`) implementation shape

- `P4-D` is OpenRouter-first provider pressure handling under the W4-S2 exception
- OpenRouter retry is opt-in under `providers.openrouter.retry`
- missing retry config disables retry (`max_retries=0`, `backoff_seconds=0.0`)
- explicit `retry: null` is malformed config and fails loudly
- `max_retries` means extra HTTP attempts after the first attempt; valid range is integer `0..3`
- `backoff_seconds` is a fixed delay between retry attempts; valid range is numeric `0.0..10.0`
- malformed retry config fails loudly with `RuntimeBoundaryError`
- retry-eligible pressure failures are HTTP `429`, HTTP `5xx`, `URLError`, and `OSError`
- non-retryable failures include non-recoverable `4xx`, response-envelope parse failures, response-content JSON failures, and request serialization failures
- retry evidence is reported as `provider_retry`, not by expanding `provider_attempts` into HTTP-level entries
- `provider_attempts` remains adapter-level attempt truth; `provider_retry` summarizes HTTP retry behavior inside the OpenRouter adapter attempt
- if OpenRouter retry exhausts and `conservative_mock` fallback succeeds, `AdapterStepRunner` preserves `provider_retry` on the failed OpenRouter provider attempt

No claims:

- no OpenAI retry support claim
- no cross-provider parity claim
- no `P4-B` completion claim
- no fallback widening beyond existing `openrouter -> mock`
- no `Retry-After` support in v1

#### Wave 4 Optional Step (`P4-E`) implementation shape

- `P4-E` is an explicitly chosen optional local adapter MVP, not a Wave 4 closure prerequisite
- `local` is added as a supported provider target only after `P4-C` hardening; this is a compatibility extension, not retroactive `P4-C` scope
- local provider config remains disabled by default in `configs/providers.example.yaml`
- selection stays explicit through agent metadata, `default_provider`, or CLI `--provider local`
- local execution requires a resolved non-empty model from model policy; there is no hidden default local model
- default local transport sends a strict JSON HTTP POST to `providers.local.endpoint_url`
- injected/fake transport is accepted for tests and does not require `endpoint_url`
- accepted response shapes are JSON-object `output` or JSON-object OpenAI-style `choices[0].message.content`
- all malformed config, transport failure, non-success HTTP status, malformed envelope, and malformed content paths fail loudly
- local adapter failures mark `fallback_eligible: false`
- `conservative_mock` remains only `openrouter -> mock`; `local + conservative_mock` fails at routing compatibility

No claims:

- no live local runtime claim
- no local model quality claim
- no provider parity claim
- no `P4-B` completion claim
- no fallback widening beyond existing `openrouter -> mock`

#### Wave 4 Step 2 (`P4-F`) technical routing notes

- `P4-F` is a docs-only technical routing note, not routing redesign
- delivery note: `docs/wave4/Wave4-W4-S2-TrackD-P4-F-Technical-Routing-Notes-v1.md`
- Track D scope is current routing law, model-tier observations, provider-route evidence maturity, and bounded recommendations
- Meta owns final rollout/policy closeout, which is complete as `docs/wave4/Wave4-W4-S2-Meta-P4-F-Policy-Closeout-v1.md`
- no code, adapter, routing implementation, or model-policy config changes are part of `P4-F`
- `P4-F` does not close `P4-B` and does not make provider-parity, live-local, or OpenAI-retry claims

#### Wave 4 post-closeout correction

- provider enabled-flag strictness was hardened after Wave 4 deep review
- missing provider entries and missing `enabled` keys remain disabled
- explicit non-boolean `enabled` values are malformed config and fail loudly with provider/config details
- this correction preserves the `P4-C` fail-loud routing contract and the `P4-E` local disabled-by-default safety boundary
- this is not a new Wave 4 provider feature and does not change P4-B/provider-parity status

---

## Wave 1 W1-S1 Stabilization Notes (Track D)

Stabilization fixes implemented for `W1-S1-FIX-D1` and `W1-S1-FIX-D2`:

- `W1-S1-FIX-D1`
  - `MockAdapter` H1 manager worker path now enforces upstream context requirements.
  - planner requires intake output context.
  - critic requires intake and planner output context.
  - ordering mistakes now fail loudly instead of appearing healthy in mock mode.

- `W1-S1-FIX-D2`
  - canonical tier defaults restored in `configs/model_policy.example.yaml`:
    - `cheap_worker`: `mistral-small-3.2-24b-instruct`
    - `specialist`: `gpt-5.4-mini`
    - `finalizer`: `gpt-5.4-mini`
    - rare arbitration / gate-conflict escalation: `gpt-5.4`
  - adapter and CLI tests now align to these defaults.

---

## First real-provider MVP definition

The first real-provider MVP is considered complete if:

- one real provider can run at least one H1 workflow end-to-end
- auth/config selection is explicit and inspectable
- provider failure modes are surfaced clearly
- `mock` remains the stable offline/default-safe path
- Track E can produce a narrow smoke/evidence note for the real-provider path

This MVP should not attempt full provider parity, advanced routing intelligence, or local-model breadth.

---

## Canonical later-wave units

### Wave 3 MVP units

- `R3-M` OpenRouter adapter MVP
- `R3-N` routing policy v1
- `R3-O` failure envelope + conservative fallback v1
- `R3-P` H1 real-provider smoke/evidence path

### Wave 4 expansion units

- `P4-A` OpenAI-compatible adapter MVP / parity pass
- `P4-B` cross-provider smoke comparison
- `P4-C` routing policy hardening v2
- `P4-D` rate-limit/backoff handling v1
- `P4-E` optional local/secondary adapter experiment
- `P4-F` routing notes and rollout policy closeout
