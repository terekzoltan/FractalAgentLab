# Model-Reasoning-Effort-Policy-Note-v01.md

## Purpose

This note proposes a minimal future policy surface for configuring model reasoning effort.

It is intentionally narrower than full model-routing redesign.
The goal is to let the project tune the same model differently across tiers/workflows when the provider supports it.

This is a design note only.
It is not yet canonical executable policy.

---

## Why add this surface

Current policy can choose:

- model tier
- workflow-level model override

But it cannot yet say:

- use the same model with lower reasoning effort for a cheap structural pass
- use the same model with higher reasoning effort for synthesis or gate arbitration

That gap matters most now that:

- `specialist` and `finalizer` may intentionally share the same base model
- the project wants bounded cost control without collapsing everything into one undifferentiated tier

---

## Proposed scope

Add one optional policy field:

- `reasoning_effort`

Provider-agnostic normalized values:

- `low`
- `medium`
- `high`

Optional future extension:

- `max`

Recommendation:

- do not introduce provider-specific labels such as `xhigh` into canonical policy
- if a provider supports a richer native scale, map it internally from the normalized values

---

## What this field should mean

`reasoning_effort` is not a quality promise.
It is a budget/intensity hint for the chosen model.

Meaning:

- `low`
  - cheap structural work
  - formatting / normalization / bounded extraction
- `medium`
  - default planning/reasoning intensity
  - should be the safe baseline unless there is a reason to go lower or higher
- `high`
  - harder synthesis / critique / arbitration
  - use sparingly for expensive or high-stakes steps
- `max` (future, only if needed)
  - rare escalation setting for narrow, costly final decisions

This field should not be used to hide poor workflow design.
If a workflow constantly needs `high` or `max` everywhere, the workflow is probably under-structured.

---

## Proposed config shape

Minimal extension of `configs/model_policy.example.yaml` style:

```yaml
tier_defaults:
  cheap_worker: mistral-small-3.2-24b-instruct
  specialist: gpt-5.4-mini
  finalizer: gpt-5.4-mini

reasoning_effort_defaults:
  cheap_worker: low
  specialist: medium
  finalizer: high

workflow_overrides:
  h3.review.v1:
    finalizer: gpt-5.4-mini
    reasoning_effort:
      finalizer: high
```

Optional later extension for role-level specificity:

```yaml
workflow_overrides:
  h4.plan:
    reasoning_effort:
      repo_intake: low
      planner: medium
      architect_critic: medium
      synthesizer: high
```

Recommendation:

- start with tier-level defaults
- add workflow-level tier overrides next
- only later add explicit role-level overrides if the evidence says they are needed

---

## Proposed resolution order

If implemented, reasoning effort should resolve in this order:

1. explicit workflow-role override
2. explicit workflow-tier override
3. `reasoning_effort_defaults[model_policy_ref]`
4. no hint / provider default

This mirrors the current model-selection logic without forcing a full redesign.

---

## Boundary rules

### 1. Keep canonical policy normalized

Canonical policy should use normalized values:

- `low`
- `medium`
- `high`
- later maybe `max`

Do not make provider-specific labels canonical.

### 2. Mapping belongs to the adapter layer

If one provider uses a different native field or different labels, Track D should map normalized policy values into provider-native settings.

Meaning:

- policy stays stable
- adapter owns provider translation

### 3. Unsupported providers should fail soft, not invent semantics

If a provider does not support reasoning-effort control:

- ignore the hint explicitly
- optionally emit metadata/warning for inspection
- do not silently reinterpret the value as something else

### 4. Do not let this become hidden model-routing policy

`reasoning_effort` is a secondary execution hint.
It must not replace explicit model-tier selection or workflow design.

---

## Recommended first defaults

With the currently chosen models:

- `cheap_worker` -> `low`
- `specialist` -> `medium`
- `finalizer` -> `high`
- rare arbitration escalation (`gpt-5.4`) -> `high`, with later consideration for `max` only if real evidence justifies it

This keeps the current architecture simple:

- cheap tier stays cheap
- specialist does most real reasoning at a balanced setting
- finalizer is not a different base model by default, but still gets a stronger effort profile

---

## When this is worth implementing

Worth implementing when at least one of these is true:

- the same base model is intentionally used for multiple tiers
- cost/latency tuning matters for repeated workflow runs
- final synthesis/gate quality benefits from a stronger setting than normal planning

Not worth implementing yet if:

- provider support is too inconsistent
- the project still lacks stable evidence for where effort changes help
- workflow design is still changing faster than model policy

---

## Recommended rollout

1. keep this as design note only for now
2. if adopted, Track D adds normalized config parsing and adapter mapping
3. start with tier-level defaults only
4. collect evidence from one or two workflows before adding role-level overrides

Good first candidates if later tested:

- `H3` final synthesis / architecture review pass
- future `H4` synthesizer
- future `H5` commit-gate / hard arbitration pass

---

## Bottom line

The project should treat `reasoning_effort` as an optional normalized execution hint,
not as a new provider-specific complexity surface.

If added later, the safest first version is:

- tier-level defaults
- normalized values (`low` / `medium` / `high`)
- adapter-owned provider translation
- no broad role-level complexity until evidence justifies it
