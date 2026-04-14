# Track-B-Runbook.md

## Purpose

This runbook defines how Track B should operate as the core runtime / state /
execution-engine track.

Use it together with:

- `ops/Track-Implementation-Runbook.md`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

---

## Track Mission

Track B owns the shared execution heart of the system.

Primary responsibilities:

- workflow executor behavior
- run lifecycle and state transitions
- orchestration primitives
- event model and trace contracts
- shared runtime schemas and invariant checks

Track B should not own:

- workflow-specific prompt semantics
- provider-specific product logic
- presentation-layer UX

---

## What Track B Should Protect

Track B is the main contract-owner track.

It should preserve:

- canonical runtime truth
- explicit failure classification
- pre-runtime structural invariant rejection where practical
- additive rather than breaking schema evolution when possible
- declared orchestration truth matching emitted runtime truth

---

## Typical Readiness Conditions

Track B is usually `READY` earlier than other tracks, but should still avoid overreach.

Track B is usually `READY` when:

- the requested change clearly belongs to shared runtime or contract ownership
- the boundary is already repo-visible and not speculative

Track B should prefer `READY with guardrails` when:

- a change is requested because another track hit a real boundary gap
- the fix should stay minimal and not become a runtime-expansion sprint

Track B should prefer `NOT READY` when:

- the request is actually prompt-layer, UI, or eval policy work disguised as runtime work

---

## Standard Implementation Pattern

Track B should usually work in this order:

1. identify the exact contract or invariant gap
2. prefer the narrowest shared fix that closes the gap
3. add explicit negative-path coverage for the new branch or guard
4. verify that downstream declared semantics still match runtime output
5. update docs only where shared truth changed

---

## Track-B Guardrails

- do not silently absorb track-specific policy into generic runtime behavior
- avoid fallback behavior that can create false-green success for malformed orchestration
- if runtime semantics expand, ensure at least one explicit cross-surface consistency pass
- do not let replay/eval or prompt-layer needs redefine canonical runtime contracts without review
- preserve additive compatibility where possible, but not at the cost of hiding structural invalidity

---

## Expected Validation

Track B validation should usually include:

- targeted runtime or contract tests
- explicit negative-path tests for new invariants or parser branches
- regression checks for affected workflow families
- broader suite coverage when a shared surface is touched

If a change affects declared orchestration, make sure emitted runtime evidence proves it.

---

## Typical Deliverables

Track B delivery docs should usually state:

- what shared contract changed or was confirmed
- which invariants are now enforced
- what remains additive vs canonical
- how downstream tracks should consume the new truth
- what validation proves the change

Track B should optimize for honest contracts, not convenience shortcuts.
