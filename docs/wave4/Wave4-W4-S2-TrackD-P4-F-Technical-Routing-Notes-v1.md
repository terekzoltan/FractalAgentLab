# Wave4-W4-S2-TrackD-P4-F-Technical-Routing-Notes-v1

## Scope

Track D prepared Wave 4 Sprint `W4-S2` Step 2 `P4-F` as a docs-first technical routing note.

This note records current provider routing law, model-tier usage, provider-route evidence maturity, and technical recommendations for Meta policy closeout.

In scope:

- current provider-routing behavior
- current model-tier defaults and observed role usage
- evidence-backed provider-route maturity labels
- bounded model-tier recommendations from Track D's adapter/routing perspective
- P4-D OpenRouter retry/backoff evidence and P4-E local adapter evidence as technical inputs

Out of scope:

- routing code changes
- adapter changes
- model-policy config changes
- provider-quality or model-quality comparison
- `P4-B` cross-provider live evidence closeout
- live local runtime support claim
- OpenAI retry support claim
- fallback widening
- runtime schema or executor redesign

---

## Acceptance Conditions

This `P4-F` Track D slice is docs-only.

Acceptance requires:

- no source-code changes
- no adapter changes
- no routing implementation changes
- no `configs/model_policy.example.yaml` changes
- no `ops/` closeout/status sync by Track D
- no provider parity claim
- no local live runtime claim
- no OpenAI retry claim
- no `reasoning_effort` implementation or canonization
- explicit handoff to Meta for final rollout/policy closeout

If any code or config change becomes necessary, Track D should stop and request Meta approval before continuing.

---

## Current Routing Law

Routing implementation lives in:

- `src/fractal_agent_lab/adapters/routing.py`

Supported provider targets:

- `mock`
- `openai`
- `openrouter`
- `local`

Real-provider targets requiring a resolved non-empty model:

- `openai`
- `openrouter`
- `local`

Provider resolution order under `explicit_v1`:

1. `AgentSpec.metadata["provider"]` when valid and enabled
2. `providers_config.default_provider` when valid and enabled
3. implicit safe default: `mock`

Model resolution order:

1. `workflow_overrides[workflow_id][model_policy_ref]`
2. `tier_defaults[model_policy_ref]`
3. `tier_defaults["specialist"]`
4. `None`

Fallback policy:

- default is `none`
- `conservative_mock` is valid only for selected provider `openrouter`
- runtime fallback remains bounded to `openrouter -> mock`
- `openai + conservative_mock`, `local + conservative_mock`, and `mock + conservative_mock` fail loudly

Routing guardrails retained from `P4-C` / `P4-E`:

- no first-enabled-provider behavior
- unsupported or disabled explicit selections fail loudly
- malformed provider/model-policy config blocks fail loudly
- no hidden local default model
- no provider scoring or automatic provider ranking

---

## Current Model-Tier Defaults

Current explicit defaults in `configs/model_policy.example.yaml`:

```yaml
tier_defaults:
  cheap_worker: mistral-small-3.2-24b-instruct
  specialist: gpt-5.4-mini
  finalizer: gpt-5.4-mini
```

These are current explicit defaults and routing inputs. They are not proof that these models are optimal, and this note does not make model-quality claims.

The current architecture intentionally separates tier purpose from provider route:

- `model_policy_ref` selects a model tier or workflow override
- provider routing selects the adapter route
- provider and model are both inspectable in step `raw.routing`

---

## Observed Role Usage

Observed usage in current agent packs:

- H1 manager/handoff variants use `cheap_worker` for intake, `specialist` for planner/critic work, and `finalizer` for synthesis.
- `h1.single.v1` uses `finalizer` because it is a single-step baseline and final output producer.
- H2 uses `cheap_worker` for intake, `specialist` for planner/architect/critic work, and `finalizer` for synthesis.
- H3 uses `cheap_worker` for intake, `specialist` for planner/systems/critic work, and `finalizer` for synthesis.
- H4 wave_start and seq_next currently use `specialist` for repo-aware intake/planning/architect-critic roles and `finalizer` for synthesizer roles.

H4 notes here are model-tier observations only. They do not change coding-vertical governance, artifact policy, prompts, roles, or Track C ownership.

---

## Provider Route Recommendations With Evidence Maturity

### `mock`

Evidence maturity: offline/replay/smoke evidence.

Recommended use:

- default-safe development and smoke path
- replay-friendly execution where external providers should not be required
- structural workflow validation and failure-boundary checks

Limits:

- not real-provider evidence
- not provider-quality evidence
- not model-quality evidence

### `openrouter`

Evidence maturity: live/operator-first route plus `P4-D` retry/backoff evidence.

Recommended use:

- current operator-first real-provider route
- provider-pressure testing where OpenRouter retry/backoff behavior matters
- the only current provider route eligible for `conservative_mock` fallback

Limits:

- OpenRouter evidence does not imply OpenAI parity
- retry/backoff support is OpenRouter-first only
- `Retry-After` parsing is not supported in `P4-D` v1

### `openai`

Evidence maturity: adapter-boundary proof only; live evidence is blocked.

Recommended use:

- explicit OpenAI-compatible route when `OPENAI_API_KEY` and model policy are configured
- adapter-boundary validation of request/auth/strict JSON behavior
- future `P4-B` live comparison leg when credentials are available

Limits:

- no live OpenAI PASS evidence in the current operator state
- no OpenAI retry/backoff claim
- no provider parity claim until `P4-B` reaches real OpenRouter + OpenAI `PASS`

### `local`

Evidence maturity: fake-transport proof only; disabled by default.

Recommended use:

- optional experimental local adapter route
- local endpoint contract experiments behind explicit provider selection
- deterministic fake/injected-transport validation

Limits:

- no live local server compatibility claim
- no local model quality claim
- no provider parity claim
- no conservative fallback compatibility

---

## Model-Tier Guidance

### `cheap_worker`

Best fit:

- bounded intake
- normalization
- simple extraction
- low-risk structural transformation
- cheap preparatory work where downstream roles can inspect or correct the result

Avoid using as default for:

- final synthesis
- high-stakes critique
- arbitration or closeout decisions

### `specialist`

Best fit:

- planning
- critique
- architecture and systems reasoning
- repo-aware planning support
- middle steps where reasoning quality matters but final arbitration is not yet needed

Avoid using as an implicit escape hatch for unclear workflow design. If every role needs specialist-level effort, the workflow may need better decomposition.

### `finalizer`

Best fit:

- final synthesis
- user-facing decision package construction
- manager final output consolidation
- narrow conflict resolution inside an already-structured workflow

Avoid using as:

- all-purpose default for every role
- substitute for missing specialist decomposition
- evidence of model superiority over `specialist`, because current defaults may share the same base model

### Rare Escalation

Existing documented policy direction mentions rare arbitration escalation to `gpt-5.4`.

For `P4-F`, this is only a future arbitration candidate and not an active config recommendation. Any escalation tier or config change should be separately reviewed and approved.

---

## Workflow Guidance

### H1

- `h1.single.v1` remains the bounded real-provider proof anchor because it has one finalizer step and stable comparison surfaces.
- Multi-agent H1 variants should keep cheap intake, specialist planning/critique, and finalizer synthesis as the default tier shape.

### H2

- Project decomposition benefits from `specialist` planner/architect/critic roles because the output is dependency-sensitive.
- Final template integration belongs at `finalizer` tier.

### H3

- Architecture review benefits from `specialist` planner/systems/critic roles and a `finalizer` synthesis pass.
- Exact quality claims remain outside this note; this is tier-routing guidance only.

### H4

- Current H4 usage is specialist-heavy for repo-aware intake/planning/architect-critic steps because repository context and sequencing constraints are dense.
- H4 synthesizer roles remain `finalizer` observations.
- This does not change H4 governance, artifact contracts, or coding-vertical policy.

---

## Deferred Reasoning Effort Note (Non-Canonical)

`docs/private/Model-Reasoning-Effort-Policy-Note-v01.md` exists as a private design-only input.

For `P4-F`:

- `reasoning_effort` is not implemented
- `reasoning_effort` is not canonical runtime policy
- `reasoning_effort` is not canonical config policy
- `configs/model_policy.example.yaml` is unchanged
- provider-specific effort mappings are not introduced

If adopted later, the safest first version remains a separate reviewed implementation plan with tier-level defaults only, normalized values, and adapter-owned provider translation.

---

## No Claims

This note does not claim:

- provider parity
- provider quality
- model quality
- `P4-B` completion
- live local runtime support
- OpenAI retry support
- fallback widening beyond `openrouter -> mock`
- provider scoring or automatic provider ranking
- reasoning-effort implementation or canonization

---

## Meta Handoff

P4-F technical routing notes complete; ready for Meta policy closeout; P4-B remains blocked/deferred; no provider parity claim.
