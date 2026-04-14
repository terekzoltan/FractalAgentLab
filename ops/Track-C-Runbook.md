# Track-C-Runbook.md

## Purpose

This runbook defines how Track C should operate as the agent logic / prompts /
memory semantics track.

Use it together with:

- `ops/Track-Implementation-Runbook.md`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

---

## Track Mission

Track C owns the intelligence-layer behavior of workflows.

Primary responsibilities:

- agent role definitions
- prompt systems and prompt versioning
- workflow-specific role packs
- memory extraction and merge policy
- identity signal/update semantics

Track C should not own:

- runtime lifecycle mechanics
- provider auth/request plumbing
- UI or presentation packaging

---

## What Track C Should Optimize For

Track C should prefer:

- explicit role separation
- versioned prompts and pack metadata
- low-noise memory semantics
- narrow extraction policies before broad ones
- additive, reviewable behavior over opaque cleverness

---

## Typical Readiness Conditions

Track C is usually `READY` when:

- the required workflow/runtime contracts are stable enough
- the intended output semantics are explicit enough to implement honestly

Track C is usually `READY with guardrails` when:

- the workflow is runnable but some output law or compare/eval posture must remain deferred
- memory or identity work needs strict canonical vs additive boundary wording

Track C is usually `NOT READY` when:

- runtime truth is still moving
- the requested semantics would force Track C to invent shared contract behavior

---

## Standard Implementation Pattern

Track C should usually work in this order:

1. define or confirm the workflow/role contract
2. implement the smallest meaningful role-pack or memory policy slice
3. validate that prompts, pack metadata, mock behavior, and docs agree
4. add negative-path tests that prove malformed or premature outputs fail loudly
5. document what is canonical, what is additive, and what is still deferred

---

## Track-C Guardrails

- do not rewrite runtime/core contracts unless a real boundary gap exists
- do not let prompt text accidentally freeze template-law earlier than sequencing allows
- do not treat additive sidecars as canonical merge truth
- keep memory durable writes low-noise and explicitly justified
- keep post-run updaters non-fatal unless the contract explicitly says otherwise
- avoid silently collapsing session memory, project memory, and identity memory into one layer

---

## Expected Validation

Track C validation should usually include:

- role-pack tests
- workflow-spec tests where relevant
- mock adapter manager-path tests for runnable workflows
- memory or identity tests for store/load/update policy
- adjacent workflow-family regressions if shared helpers or contracts are touched

If a workflow claims fail-loud behavior, the tests should prove it.

---

## Typical Deliverables

Track C delivery docs should usually state:

- role topology or memory contract
- versioning stance
- extraction or merge rules
- canonical vs non-canonical surfaces
- known limits and deferred semantics
- downstream handoff expectations

Track C should prefer explicit policy over accidental behavior.
