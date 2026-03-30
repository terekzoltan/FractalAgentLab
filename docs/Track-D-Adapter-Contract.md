# Track-D-Adapter-Contract.md

## Purpose

This note defines the Wave 0 adapter boundary implemented by Track D for `F0-F` and `F0-I`.

It is intentionally minimal and aligned to Track B canonical runtime contracts.

---

## Wave

- Current wave: Wave 0
- Scope: `F0-F` minimal adapter path + `F0-I` config/provider selection shell
- Out of scope: full provider parity, local model runtime, advanced tool/handoff bridges

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

## Implemented Providers in Wave 0

- `MockAdapter` (active)
  - path: `src/fractal_agent_lab/adapters/mock/adapter.py`
  - deterministic offline output
  - scripted responses (`step_id`, `agent_id`, `__default__`)
  - failure simulation via configured `fail_steps`

- `OpenAICompatibleAdapter` (placeholder)
  - path: `src/fractal_agent_lab/adapters/openai/adapter.py`
  - currently raises `RuntimeBoundaryError`

- `OpenRouterAdapter` (placeholder)
  - path: `src/fractal_agent_lab/adapters/openrouter/adapter.py`
  - currently raises `RuntimeBoundaryError`

Wave 0 default fallback route is `mock`.

---

## Provider and Model Routing (v0)

Routing helper lives in:

- `src/fractal_agent_lab/adapters/routing.py`

Input config sources:

- `configs/providers.example.yaml`
- `configs/model_policy.example.yaml`

Resolution order:

1. `AgentSpec.metadata["provider"]` when enabled
2. `providers_config.default_provider` when enabled
3. first enabled provider in priority order (`openrouter`, `openai`, `local`, `mock`)
4. fallback `mock`

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

- sets `default_provider`
- force-enables the selected provider in config view for that run

This keeps provider selection at the adapter/config boundary, not in core workflow logic.

---

## Error Boundary

Track D adapter path uses Track B runtime error vocabulary:

- `RuntimeBoundaryError`
- `StepExecutionError`

Unknown adapter exceptions are wrapped into `StepExecutionError` inside `AdapterStepRunner`.

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
    - `cheap_worker`: `gpt-4o-mini`
    - `specialist`: `gpt-5.4-nano`
    - `finalizer`: `gpt-5.4-mini`
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
