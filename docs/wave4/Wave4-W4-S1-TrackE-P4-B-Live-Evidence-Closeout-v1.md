# Wave4-W4-S1-TrackE-P4-B-Live-Evidence-Closeout-v1

## Purpose

Track E live evidence closeout for Wave 4 Sprint `W4-S1` Step 2 epic `P4-B`.

This note records the first real bounded `h1.single.v1` cross-provider smoke `PASS` pair over `openrouter` and `openai`.

## Scope

In scope:

- bounded `h1.single.v1` live provider-path smoke comparison
- real `openrouter` run leg
- real `openai` run leg
- canonical run/trace artifact inspection
- matched-input validation
- replay readiness
- model provenance disclosure

Out of scope:

- provider-quality parity
- model-quality parity
- winner scoring
- routing-policy redesign
- retry/backoff expansion beyond existing `P4-D` scope
- local-provider claims
- manager/handoff/H2/H3 real-provider parity

## Live Evidence Summary

Structured summary:

```yaml
comparison_outcome: PASS
cross_provider_smoke_passed: true
track_e_evidence_ready: true
workflow_id: h1.single.v1
matched_input_payload: true
fallback_used: false
openrouter_run_id: 4771b058-97b6-4164-b060-40b381acd2b4
openai_run_id: 308ac05a-7f2e-4985-99dc-11d547557a98
openrouter_model_policy_config: configs/model_policy.p4_b.openrouter.live.yaml
openai_model_policy_config: configs/model_policy.p4_b.openai.live.yaml
providers_config: configs/providers.p4_b.live.yaml
provider_quality_claim: false
model_quality_claim: false
```

## Inputs Used

- providers config: `configs/providers.p4_b.live.yaml`
- OpenRouter model policy: `configs/model_policy.p4_b.openrouter.live.yaml`
- OpenAI model policy: `configs/model_policy.p4_b.openai.live.yaml`
- runtime config: `configs/runtime.example.yaml`
- matched input payload:

```json
{"idea":"AI founder assistant for startup idea refinement"}
```

## Commands Run

Preflight tests:

1. `PYTHONPATH=src python -m unittest tests.evals.test_p4_b_h1_cross_provider_smoke`
2. `PYTHONPATH=src python -m unittest tests.adapters.test_openai_adapter tests.adapters.test_openrouter_adapter`

Live evidence command:

1. `PYTHONPATH=src python -m scripts.run_p4_b_h1_cross_provider_smoke --input-json '{"idea":"AI founder assistant for startup idea refinement"}' --runtime-config configs/runtime.example.yaml --providers-config configs/providers.p4_b.live.yaml --openrouter-model-policy-config configs/model_policy.p4_b.openrouter.live.yaml --openai-model-policy-config configs/model_policy.p4_b.openai.live.yaml`

## Run Truth

OpenRouter leg:

- run id: `4771b058-97b6-4164-b060-40b381acd2b4`
- selected provider: `openrouter`
- executed provider: `openrouter`
- fallback used: `false`
- selected/requested model: `openai/gpt-4.1-mini`
- response/executed model: `openai/gpt-4.1-mini-2025-04-14`
- run status: `succeeded`

OpenAI leg:

- run id: `308ac05a-7f2e-4985-99dc-11d547557a98`
- selected provider: `openai`
- executed provider: `openai`
- fallback used: `false`
- selected/requested model: `gpt-4.1-mini`
- response/executed model: `gpt-4.1-mini-2025-04-14`
- run status: `succeeded`

## PASS Basis

`PASS` is justified because:

- both runs are `h1.single.v1`
- exact `input_payload` match is confirmed
- selected/executed providers match expected provider legs
- no fallback occurred on either leg
- both run/trace artifact validations passed
- both replay surfaces are ready
- both comparable H1 outputs are complete
- comparable key sets match
- model provenance is present for both legs

## Behavioral Differences Disclosure

The two providers produced different but structurally complete H1 outputs.

This is expected and acceptable for `P4-B` because the claim is provider-path smoke only.

This closeout does not claim:

- output-quality sameness
- model-quality parity
- provider-quality parity
- winner scoring

## No-Claim Boundaries Preserved

- No provider-quality claim.
- No model-quality claim.
- No manager/handoff/H2/H3 real-provider parity claim.
- No local-provider claim.
- No retry/backoff expansion claim beyond existing `P4-D` evidence.
- No public release claim.

## Outcome

`P4-B` is complete for its bounded acceptance target:

- real `openrouter` + `openai` provider-path smoke `PASS`
- workflow anchor: `h1.single.v1`

This closes the old credential blocker for `P4-B`.

## Residual Limits

- The evidence is bounded to `h1.single.v1`.
- The compared model IDs differ by provider route and are disclosed rather than normalized.
- This does not establish general provider parity across H2/H3/H4 or across all models.
