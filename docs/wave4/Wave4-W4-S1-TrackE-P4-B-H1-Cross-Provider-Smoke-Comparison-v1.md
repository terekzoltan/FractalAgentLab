# Wave4-W4-S1-TrackE-P4-B-H1-Cross-Provider-Smoke-Comparison-v1

## Purpose

Track E implementation note for Wave 4 Sprint `W4-S1` Step 2 epic `P4-B`.

This slice adds a bounded cross-provider smoke comparison surface for `h1.single.v1` over `openrouter` and `openai`.

---

## Scope

In scope:

- `h1.single.v1` only
- provider legs: `openrouter` and `openai`
- canonical run/trace artifact inspection
- replay readiness checks
- provider/fallback/model truth from canonical run artifacts
- H1 comparable-output structural completeness
- matched input-payload requirement for comparison `PASS`

Out of scope:

- provider-quality or model-quality parity
- winner scoring
- routing policy hardening v2 (`P4-C`)
- fallback policy widening
- rate-limit/backoff hardening (`P4-D`)
- local model work (`P4-E`)
- manager/handoff/H2/H3 real-provider claims

---

## Implemented Surfaces

- `src/fractal_agent_lab/evals/p4_b_h1_cross_provider_smoke.py`
- `scripts/run_p4_b_h1_cross_provider_smoke.py`
- `tests/evals/test_p4_b_h1_cross_provider_smoke.py`
- `docs/wave4/Wave4-W4-S1-TrackE-P4-B-H1-Cross-Provider-Smoke-Comparison-v1.md`

---

## Evidence Law

Provider and fallback truth must be read from canonical run artifacts:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

CLI stdout is used only to discover run ids in live mode. It is not the evidence truth source.

Each provider leg records:

- selected provider
- executed provider
- fallback usage
- provider attempts
- fallback policy
- selected model
- requested model
- response model
- executed model
- model-policy config path when provided by the script

Separate model-policy configs are allowed because OpenRouter and OpenAI-compatible routes may need different model IDs. When model IDs differ, the claim remains provider-path smoke only, not model-quality or provider-quality comparison.

---

## Outcome Semantics

`PASS` requires:

- both runs are `h1.single.v1`
- exact `input_payload` match
- OpenRouter leg selected/executed `openrouter`
- OpenAI leg selected/executed `openai`
- no fallback on either leg
- both runs succeeded
- both run/trace validations pass
- both replay surfaces are ready
- both comparable H1 outputs are complete
- comparable key sets match
- model provenance is present

`FAIL` means canonical evidence exists but the bounded smoke claim is false.

Examples:

- fallback-backed success
- wrong executed provider
- wrong workflow
- incomplete comparable output
- comparable key mismatch
- missing model provenance in an otherwise inspectable run pair

`BLOCKED` means the comparison cannot honestly be made.

Examples:

- missing run id
- missing run/trace artifact
- replay not ready
- missing API key
- provider disabled
- missing model mapping
- network/transport failure
- provider auth rejected
- provider service unavailable/rate limited
- exact input-payload mismatch

Script exit codes:

- `0`: `PASS`
- `1`: `FAIL`
- `2`: `BLOCKED`

---

## Validation

Targeted tests:

1. `PYTHONPATH=src python -m unittest tests.evals.test_p4_b_h1_cross_provider_smoke`
2. `PYTHONPATH=src python -m unittest tests.evals.test_p4_b_h1_cross_provider_smoke tests.evals.test_r3_p_h1_real_provider_smoke`

Inspect-only script shape:

1. `PYTHONPATH=src python -m scripts.run_p4_b_h1_cross_provider_smoke --openrouter-run-id <run_id> --openai-run-id <run_id> --data-dir data --comparison-task-intent "same H1 smoke input"`

Live + inspect script shape:

1. `PYTHONPATH=src python -m scripts.run_p4_b_h1_cross_provider_smoke --input-json '{"idea":"..."}' --runtime-config configs/runtime.example.yaml --providers-config configs/providers.example.yaml --openrouter-model-policy-config <path> --openai-model-policy-config <path>`

---

## Current Evidence Note

This implementation creates the Track E comparison surface. `P4-B` should not be marked complete until a real OpenRouter + OpenAI run pair reaches `PASS`.

If credentials, model mapping, network, or provider service availability blocks live proof, the report should remain `BLOCKED` and coordination should not mark `P4-B` complete.

Current operator-state note:

- live OpenAI evidence is currently blocked because no `OPENAI_API_KEY` is available
- this is an external credential blocker, not a P4-B helper/script failure
- OpenRouter-first Wave 4 hardening may continue only if it avoids provider-parity claims and keeps this live OpenAI proof deferred

---

## Downstream Note

`P4-C` may use P4-B evidence, but P4-B does not implement routing hardening. In particular, fallback policy validation remains Track D scope.
