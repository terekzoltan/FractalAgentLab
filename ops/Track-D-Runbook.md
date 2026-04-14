# Track-D-Runbook.md

## Purpose

This runbook defines how Track D should operate as the provider / tool / adapter
boundary track.

Use it together with:

- `ops/Track-Implementation-Runbook.md`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

---

## Track Mission

Track D owns the boundary between the engine and external providers/tools.

Primary responsibilities:

- provider adapters
- model routing policy surfaces
- tool wrappers
- provider failure envelopes
- interoperability across adapter families

Track D should not own:

- product-level workflow semantics
- memory merge logic
- final UX or presentation surfaces

---

## What Track D Should Optimize For

Track D should prefer:

- clean adapter contracts
- provider swap safety
- explicit model-policy usage
- bounded failure behavior
- mock and real-provider parity where the repo explicitly asks for it

---

## Typical Readiness Conditions

Track D is usually `READY` when:

- Track B contract surfaces are stable enough
- provider behavior can be expressed through existing adapter boundaries

Track D is usually `READY with guardrails` when:

- a side batch or MVP adapter path is allowed but must not displace the mainline
- provider parity is partial and honesty matters more than polish

Track D is usually `NOT READY` when:

- the runtime contract is still moving underneath the adapter work
- the request would require prompt, eval, or UI work rather than adapter work

---

## Standard Implementation Pattern

Track D should usually work in this order:

1. confirm the shared adapter contract
2. implement the narrowest provider/tool boundary needed
3. make failure behavior explicit and inspectable
4. prove mock-path and provider-path assumptions do not silently diverge
5. document the exact limits of parity or support

---

## Track-D Guardrails

- do not bend core contracts around one provider unless sequencing explicitly accepts that cost
- avoid silent fallback that hides provider-specific failure reality
- keep model-policy use inspectable
- preserve mock honesty when the mock path is used as mainline evidence
- do not let adapter details redefine workflow-level business logic

---

## Expected Validation

Track D validation should usually include:

- adapter tests
- model-policy/config tests where relevant
- negative-path tests for missing upstream context or malformed outputs
- shared workflow-family regressions for affected provider-facing paths

If a provider surface is non-blocking or MVP-grade, say so explicitly in docs.

---

## Typical Deliverables

Track D delivery docs should usually state:

- supported provider/tool surfaces
- known gaps and non-goals
- model-policy assumptions
- failure and fallback posture
- evidence used for parity or bounded support claims

Track D should optimize for honest boundaries, not synthetic portability claims.
