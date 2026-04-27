# Wave4-W4-S2-Meta-P4-F-Policy-Closeout-v1

## Scope

Meta Coordinator closes Wave 4 Sprint `W4-S2` Step 3 `P4-F` as a policy/rollout note based on Track D's technical routing notes.

Input artifact:

- `docs/wave4/Wave4-W4-S2-TrackD-P4-F-Technical-Routing-Notes-v1.md`

Execution mode:

- `manual_policy_driven`

Visibility / audit state:

- based on git-visible routing, adapter, config, test, and Wave 4 documentation
- no live OpenAI evidence was available or claimed
- no live local runtime evidence was available or claimed

---

## Policy Decision

`P4-F` is accepted as the current routing/model-tier policy guidance for Wave 4 closeout under the OpenRouter-first exception.

Accepted policy stance:

- provider routing remains explicit and inspectable
- `mock` remains the safe default
- real provider routes require a resolved model
- `openrouter` is the operator-first real-provider path
- `openai` remains adapter-boundary supported, but live evidence is deferred until `OPENAI_API_KEY` exists
- `local` is an optional experimental route, disabled by default, with fake-transport proof only
- `conservative_mock` remains bounded to `openrouter -> mock`
- model-tier guidance remains role/tier guidance, not model-quality proof
- `reasoning_effort` remains deferred and non-canonical

---

## Provider Route Guidance

### `mock`

Use for:

- offline development
- smoke and replay-friendly structural checks
- deterministic failure-boundary and workflow-shape validation

Do not use as:

- real-provider evidence
- provider-quality or model-quality evidence

### `openrouter`

Use for:

- current operator-first real-provider execution
- provider-pressure scenarios covered by `P4-D` retry/backoff evidence
- the only route eligible for `conservative_mock` fallback

Limits:

- OpenRouter evidence does not imply OpenAI parity
- retry/backoff support is OpenRouter-first only
- `Retry-After` parsing remains deferred

### `openai`

Use for:

- adapter-boundary compatibility when credentials and model policy are configured
- future `P4-B` live comparison leg when credentials exist

Limits:

- no live OpenAI `PASS` evidence is recorded
- no OpenAI retry/backoff claim exists
- no provider-parity claim is allowed until `P4-B` reaches real OpenRouter + OpenAI `PASS`

### `local`

Use for:

- optional local endpoint contract experiments
- explicit-provider local adapter validation
- deterministic fake/injected-transport tests

Limits:

- disabled by default
- requires explicit provider selection and resolved model
- no live local server compatibility claim
- no local model-quality claim
- no conservative fallback compatibility

---

## Model-Tier Guidance

### `cheap_worker`

Use for:

- bounded intake
- normalization
- extraction
- low-risk structural transformations

Avoid for:

- final synthesis
- high-stakes critique
- arbitration or closeout decisions

### `specialist`

Use for:

- planning
- critique
- architecture and systems reasoning
- repo-aware planning support
- middle workflow steps where reasoning quality matters

Avoid as:

- a blanket upgrade for unclear workflow design
- a substitute for role decomposition

### `finalizer`

Use for:

- final synthesis
- user-facing decision packages
- manager finalization
- narrow conflict resolution inside an already-structured workflow

Avoid as:

- all-purpose default for every role
- evidence of model superiority over `specialist`

### Rare Escalation

`gpt-5.4` remains a future/narrow arbitration candidate only.

No active config change is made by `P4-F`.

---

## Cross-Track Rollout Guidance

Track D:

- owns future adapter/routing changes behind the current provider boundary
- should keep provider selection explicit and inspectable
- should not widen fallback beyond `openrouter -> mock` without a new reviewed plan

Track E:

- owns future provider comparison/evidence work
- should keep `P4-B` blocked/deferred until real OpenRouter + OpenAI `PASS` evidence exists
- should not treat P4-D or P4-E evidence as provider-parity evidence

Track C:

- owns prompt/role semantics
- may use model-tier guidance as input, but P4-F does not rewrite prompts or role responsibilities

Track B:

- no runtime schema or executor change is introduced by P4-F
- future provider behavior should remain adapter-boundary behavior unless explicitly escalated

Track A:

- no UI/CLI presentation change is required by P4-F
- future display of provider/model routing should consume existing inspectable raw routing fields

Meta:

- owns future policy/status synchronization and wave-level gate decisions
- should keep the OpenAI-live parity blocker visible until credentials/evidence exist

---

## No Claims

This policy closeout does not claim:

- provider parity
- provider quality ranking
- model quality ranking
- `P4-B` completion
- live OpenAI evidence
- live local runtime support
- OpenAI retry/backoff support
- fallback widening beyond `openrouter -> mock`
- `reasoning_effort` implementation or canonical config policy

---

## Closeout Decision

`P4-F` is complete.

Wave 4 provider-expansion work is operationally closed under the OpenRouter-first exception, with one explicit deferred blocker:

- final provider-parity claims remain blocked until `P4-B` records a real OpenRouter + OpenAI `PASS` pair

Next frontier may move beyond Wave 4 provider hardening, but any future provider-parity/public claim must first close the `P4-B` live-evidence gate.
