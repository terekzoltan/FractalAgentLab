# Wave4-W4-S2-TrackD-P4-D-Rate-Limit-Backoff-Handling-v1

## Scope

Track D implemented Wave 4 Sprint `W4-S2` Step 1 `P4-D` as OpenRouter-first provider pressure hardening.

Scope lock applied:

- OpenRouter adapter retry/backoff only
- adapter-internal pressure handling, not runtime redesign
- retry evidence remains inspectable through direct OpenRouter results and fallback-backed success

Out of scope:

- OpenAI retry support claim
- cross-provider parity or model-quality comparison
- `P4-B` live comparison closeout
- fallback widening
- `Retry-After` parsing
- local provider support

---

## Implemented Surfaces

- `src/fractal_agent_lab/adapters/openrouter/adapter.py`
  - opt-in retry config under `providers.openrouter.retry`
  - retry loop for HTTP `429`, HTTP `5xx`, `URLError`, and `OSError`
  - retry metadata in `provider_retry`
- `src/fractal_agent_lab/adapters/step_runner.py`
  - failed provider attempt records preserve `provider_retry` from error details
- `configs/providers.example.yaml`
  - OpenRouter retry example added
- `tests/adapters/test_openrouter_adapter.py`
  - adapter-level retry, exhaustion, non-retryable, and malformed-config tests
- `tests/adapters/test_h1_single_step_runner.py`
  - fallback-success retry evidence preservation test
  - retry-success no-fallback test

---

## Config Semantics

Config shape:

```yaml
providers:
  openrouter:
    retry:
      max_retries: 1
      backoff_seconds: 0.0
```

Rules:

- missing `retry` block disables retry
- explicit `retry: null` is malformed config and fails loudly
- `max_retries` means extra attempts after the initial HTTP attempt
- `attempt_count = 1 + retry_count`
- `max_retries` valid range: integer `0..3`
- `backoff_seconds` valid range: numeric `0.0..10.0`
- malformed retry blocks fail loudly with `RuntimeBoundaryError`

---

## Inspectability

Minimum `provider_retry` shape:

- `used`
- `max_retries`
- `attempt_count`
- `retry_count`
- `recoverable`
- `final_status_code`
- `failure_stage`
- `exhausted`

`provider_attempts` remains adapter-level attempt truth. HTTP retries are summarized inside `provider_retry` and are not expanded into separate provider attempts.

Acceptance-critical invariant:

- retry evidence must remain visible on direct OpenRouter success/failure
- retry evidence must remain visible when OpenRouter retry exhaustion is followed by successful `conservative_mock` fallback

---

## No Claims

- no OpenAI retry support claim
- no cross-provider parity claim
- no provider-quality or model-quality claim
- no `P4-B` completion claim
- no fallback widening beyond existing `openrouter -> mock`
- no `Retry-After` support in v1

---

## Validation Evidence

Targeted validation for this slice:

- `tests/adapters/test_openrouter_adapter.py`
  - `429` then success retries once
  - `503` then success retries once
  - `429` exhaustion preserves retry metadata
  - non-recoverable `400` does not retry
  - `URLError` then success retries once
  - malformed retry config fails loudly
- `tests/adapters/test_h1_single_step_runner.py`
  - retry exhaustion plus `conservative_mock` fallback preserves retry evidence in failed OpenRouter provider attempt
  - retry success does not invoke mock fallback

---

## Known Gaps / Next Step Inputs

- `P4-B` still requires real OpenRouter + OpenAI PASS evidence before provider-parity claims
- OpenAI retry/backoff remains outside this OpenRouter-first exception slice
- `Retry-After` parsing needs a transport contract expansion or response metadata support before implementation
- `P4-F` can use this bounded technical evidence after `P4-D` review acceptance
