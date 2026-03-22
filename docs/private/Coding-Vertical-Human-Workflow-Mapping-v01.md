# Coding-Vertical-Human-Workflow-Mapping-v01.md

## Purpose

This document makes one core point explicit:

> the Software Delivery Loop exists to formalize and gradually automate the current human-driven workflow already used in this project

The coding vertical is therefore not an abstract coding-bot idea.
It is a structured evolution of the current Meta + track workflow.

---

## Current human workflow

The current operating pattern already has a recognizable shape.

Typical commands or intents include:

- `WAVE START`
- `SEQ NEXT`
- `IMPLEMENT`
- `REVIEW`
- explicit commit decision or commit refusal

The workflow is not prompt-only.
It already depends on:

- current repository reality
- current wave/sprint/track status
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- specialized stabilization or design docs
- recent review findings and acceptance history

---

## Current sources of truth in practice

When the current human workflow is operating correctly, it follows this order:

1. actual repository state
2. `ops/AGENTS.md`
3. `ops/Combined-Execution-Sequencing-Plan.md`
4. specialized docs and stabilization plans
5. recent review/evidence context
6. the immediate user prompt

This matters because the future coding vertical must preserve this behavior.
It must not replace it with freeform prompt-following.

---

## Prompt-to-system mapping

### `WAVE START`

Current meaning:
- refresh project context after many repo changes
- recover the live frontier
- detect what is actually next

Future system mapping:
- Meta `full-sweep`
- later `H4` context refresh / repo intake artifact

### `SEQ NEXT`

Current meaning:
- verify whether a requested task is truly unblocked
- map the task against the current wave/sprint/track state
- produce a detailed implementation plan from repo truth

Future system mapping:
- `H4` sequencing-aware planning artifact
- explicit `READY` / `NOT READY` / blocked-prereq reporting when relevant

### `IMPLEMENT`

Current meaning:
- execute against an accepted plan
- respect track/session ownership and live repo constraints
- document what changed and why

Future system mapping:
- later constrained implementation path
- plan-following with explicit deviation reporting

### `REVIEW`

Current meaning:
- inspect implementation deeply
- prioritize bugs, regressions, risks, and missing tests
- refuse commit when findings are serious

Future system mapping:
- `H5` findings-first review artifact
- explicit residual-risk and testing-gap surface

### commit decision

Current meaning:
- commit only if the state is actually safe enough
- otherwise hold and explain why

Future system mapping:
- `H5` explicit commit-gate artifact
- `pass` / `pass_with_warnings` / `hold`

---

## Control surface rule

The current workflow uses the coordination layer as an active control surface.

That means:

- `ops/Combined-Execution-Sequencing-Plan.md` is not just a roadmap
- it is the live status, readiness, ordering, and blocked-state surface
- the future coding vertical must read and preserve that surface
- H4/H5 should automate work through that control surface, not around it

---

## Current execution-shell reality

The current workflow is productive partly because it runs inside a tool-enabled shell environment.

Right now, that shell is OpenCode.

OpenCode currently provides the practical execution surface for:

- repository access
- file reads and edits
- search
- git operations
- test execution
- multi-session practical usage

Fractal Agent Lab should therefore treat the current coding-vertical direction as **OpenCode-anchored** in the near term.

Meaning:

- the lab provides workflow logic, artifacts, sequencing, review/gate policy, and learning-loop discipline
- OpenCode remains the main execution substrate that actually touches the repo

This is valid.
The coding vertical does not need to replace the shell immediately in order to be useful.

---

## OpenCode-anchored vs hybrid

### OpenCode-anchored model

This is the preferred current model.

Meaning:

- OpenCode remains the main execution environment
- Fractal Agent Lab improves how work is planned, reviewed, gated, and recorded
- the main value is workflow intelligence, not shell replacement

Helpful shorthand:

- OpenCode = the hands
- Fractal Agent Lab = the method

### Hybrid model

This is a possible later direction, not the current default.

Meaning:

- OpenCode still remains in use
- Fractal Agent Lab gradually adds small standardized wrappers around repeated repo operations

In this context, a wrapper means a thin helper layer around an existing operation.

Example:

- instead of every workflow using raw repo/test/git calls in a different way
- a small standard helper can run the operation in one expected format and return a more consistent result

The hybrid model is therefore called hybrid because:

- OpenCode still provides the shell and tool substrate
- Fractal Agent Lab starts adding its own standardized work surface on top of it

Current stance:

- OpenCode-anchored = preferred now
- hybrid = valid later if repeated repo operations are worth standardizing

---

## Human-in-the-loop boundaries

The coding vertical should preserve explicit human control at important points, especially early on.

Human control remains primary for:

- scope correction when the request is underspecified or drifts
- sequencing overrides or cross-track reprioritization
- final commit authorization unless a future workflow explicitly says otherwise
- privacy and release decisions
- deciding when a design-only batch should remain blocked instead of becoming implementation work

---

## Automation ladder

The intended evolution is gradual.

### Stage A — Manual Meta + manual track prompting

Current reality.
The human and Meta Coordinator actively inspect the repo, check sequencing, plan next actions, review work, and decide on commit safety.

### Stage B — Assisted planning

`H4` begins to automate:

- repo intake
- context refresh
- sequencing-aware planning
- risk and acceptance-check artifact creation

### Stage C — Assisted review and gating

`H5` begins to automate:

- findings-first review output
- test-evidence capture
- explicit commit-gate decisions

### Stage D — Later constrained delivery chaining

Only after earlier stages prove trustworthy:

- limited implementation chaining
- richer orchestration
- stronger eval and policy feedback loops

---

## Non-goals

Early coding-vertical work should not try to:

- bypass `ops/Combined-Execution-Sequencing-Plan.md`
- replace the Meta Coordinator with a freeform coding bot
- turn the workflow into unattended repo takeover
- collapse planning, implementation, review, and gate into one opaque agent action
- ignore track/session ownership because a prompt sounded urgent

---

## Design implication

The first successful coding-vertical slices should feel like:

- the current workflow, but more inspectable
- the current workflow, but less repetitive
- the current workflow, but more artifactized
- the current workflow, but safer to audit and replay

They should not feel like a separate system with unrelated behavior.

---

## Related docs

- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
