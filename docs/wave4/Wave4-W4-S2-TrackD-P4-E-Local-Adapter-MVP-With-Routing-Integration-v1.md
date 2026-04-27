# Wave4-W4-S2-TrackD-P4-E-Local-Adapter-MVP-With-Routing-Integration-v1

## Scope

Track D implemented optional Wave 4 `P4-E` after explicit activation as a local adapter MVP with routing integration.

Scope lock applied:

- local provider adapter boundary only
- explicit routing integration for provider target `local`
- disabled-by-default config posture
- fake/injected transport proof for `h1.single.v1`

Out of scope:

- live local runtime proof
- local model quality claims
- provider parity claims
- `P4-B` cross-provider smoke closeout
- fallback widening beyond existing `openrouter -> mock`

---

## Implemented Surfaces

- `src/fractal_agent_lab/adapters/local/adapter.py`
  - `LocalModelAdapter` with strict JSON HTTP default transport
  - injected transport support for deterministic proof
  - fail-loud model/config/transport/envelope/content behavior
- `src/fractal_agent_lab/adapters/routing.py`
  - `local` added as supported provider target
  - `local` added to real-provider model requirement
  - `local + conservative_mock` remains rejected because fallback stays `openrouter -> mock`
- `src/fractal_agent_lab/adapters/step_runner.py`
  - default adapter registry wires `LocalModelAdapter` from `providers.local`
- `src/fractal_agent_lab/cli/app.py`
  - CLI provider override help includes `local`
- `configs/providers.example.yaml`
  - `providers.local.enabled: false`
  - example `endpoint_url` provided for default HTTP transport

---

## Config Semantics

Example shape:

```yaml
providers:
  local:
    enabled: false
    endpoint_url: http://localhost:11434/fractal-agent-lab/v1/step
```

Rules:

- `local` is never selected by first-enabled-provider behavior.
- `local` must be explicitly selected by agent metadata, `default_provider`, or CLI `--provider local`.
- `providers.local.enabled` must be true for explicit local selection.
- a non-empty resolved model is required from model policy.
- no hidden local default model exists.
- `endpoint_url` is required only when using the default HTTP transport.
- fake/injected transport tests may omit `endpoint_url`.

---

## Endpoint Contract

Default transport sends a JSON POST with this top-level shape:

```json
{
  "model": "local/test-model",
  "request": {
    "run_id": "...",
    "workflow_id": "h1.single.v1",
    "step_id": "single",
    "agent_id": "h1_single_agent",
    "input_payload": {},
    "context": {}
  }
}
```

Accepted response shapes:

- JSON object with object-valued `output`
- JSON object with OpenAI-style `choices[0].message.content` containing a JSON object string

Rejected response shapes fail loudly:

- non-JSON envelope
- non-object envelope
- missing object `output` and missing JSON object content
- invalid JSON content
- non-success HTTP status

---

## Fallback Posture

`P4-E` does not widen fallback compatibility.

- `fallback_policy: none` remains default.
- `conservative_mock` remains valid only for selected provider `openrouter`.
- local adapter execution failures set `fallback_eligible: false`.
- `local + conservative_mock` fails at routing compatibility before adapter execution.

---

## Validation Evidence

Targeted validation for this slice:

- `tests/adapters/test_local_adapter.py`
  - success with object `output`
  - success with JSON-object OpenAI-style content
  - missing model and missing endpoint fail loudly
  - invalid timeout, status, envelope, content, and request payload fail loudly
- `tests/adapters/test_provider_router.py`
  - local default provider requires enabled config and resolved model
  - disabled local and missing model fail loudly
  - `local + conservative_mock` fails loudly
  - CLI override helper accepts local and enables it
- `tests/adapters/test_h1_single_step_runner.py`
  - `h1.single.v1` runs through local using fake transport
  - routing, model, provider attempts, and fallback metadata remain inspectable
- `tests/cli/test_r3_n_provider_override_policy.py`
  - `--provider local` runs through local with patched HTTP transport
  - malformed providers block still fails loudly for local override

---

## Known Gaps / Next Step Inputs

- no live local server compatibility has been proven
- no local model output quality or provider parity has been evaluated
- `P4-B` remains blocked/deferred until real OpenRouter + OpenAI PASS evidence exists
- `P4-F` should consume this as optional experimental routing evidence, not as provider-parity evidence
