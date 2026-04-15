# Track-D-Adapter-Contract.md

## Purpose

This note defines the Track D adapter boundary from Wave 0 foundations through the current
Wave 3 side-batch policy state.

It is intentionally minimal and aligned to Track B canonical runtime contracts.

---

## Wave

- Current frontier: Wave 3 side-batch Step 3 (`R3-O` Track B boundary review + `R3-P` Track E smoke/evidence)
- Current scope: `R3-M` + `R3-N` + `R3-O` delivered as bounded Wave 3 provider policy stack
- Out of scope: full provider parity, local-model runtime, advanced tool/handoff bridges, Wave 4 hardening

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

- `OpenAICompatibleAdapter` (placeholder)
  - path: `src/fractal_agent_lab/adapters/openai/adapter.py`
  - currently raises `RuntimeBoundaryError`

- `OpenRouterAdapter` (Wave 3 side-batch MVP)
  - path: `src/fractal_agent_lab/adapters/openrouter/adapter.py`
  - supports one bounded real-provider path for `h1.single.v1`
  - strict JSON-object-only parse/fail-loud behavior remains MVP-scoped, not parity-complete

Safe default route remains `mock`.
No silent provider fallback is allowed unless explicit fallback policy enables it.

---

## Provider and Model Routing (Wave 3 policy v1)

Routing helper lives in:

- `src/fractal_agent_lab/adapters/routing.py`

Input config sources:

- `configs/providers.example.yaml`
- `configs/model_policy.example.yaml`

Wave 3 supported routing targets:

- `mock`
- `openrouter`

Example config in Wave 3 only advertises these bounded targets.

Provider resolution order (`explicit_v1`):

1. `AgentSpec.metadata["provider"]` when valid + enabled
2. `providers_config.default_provider` when valid + enabled
3. implicit safe default: `mock`

Guardrails:

- no `first enabled provider wins` behavior
- `openai` and `local` are not Wave 3 routing targets
- unsupported or disabled explicit selections fail loudly

Fallback policy values:

- default: `none`
- opt-in: `conservative_mock`

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
- rejects unsupported targets (Wave 3: only `mock` and `openrouter`)
- sets `default_provider` to the validated target
- may enable the validated provider entry (`openrouter`) for that run

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
- `OpenAICompatibleAdapter` and `OpenRouterAdapter` are placeholders only.
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
  - same request payload
  - recoverable provider failures only
- fallback execution point is `AdapterStepRunner`; router is not a fallback engine
- fallback and provider-attempt behavior must stay inspectable in step `raw` and failure details
- existing H1 compare/materiality eval surfaces remain mock-only until `R3-P`; shared override helpers do not widen real-provider evidence scope by themselves
- delivery note: `docs/wave3/Wave3-W3-SB-TrackD-R3-N-R3-O-Routing-and-Failure-Policy-v1.md`

### Wave 4

- provider expansion and hardening
- `OpenAICompatibleAdapter` joins as the second meaningful path
- routing policy becomes stronger and evidence-backed
- rate-limit/backoff behavior is hardened
- optional local-model experimentation remains contained

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
