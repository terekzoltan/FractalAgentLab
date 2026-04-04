# Coding-Vertical-Repo-Aware-Planning-Policy-v01.md

## Purpose

This document defines how future `H4` planning should behave.

The point of `H4` is not to produce clever text.
The point is to produce a repo-grounded plan that is inspectable, reviewable, and realistic.

---

## Planning modes

### Mode A — Human-first planning

Use when:
- the user is still shaping the idea
- the task is ambiguous
- codebase execution should not start yet

Output style:
- clarification
- scoping
- possible directions
- early decomposition

### Mode B — Repo-aware planning

Use when:
- the request is tied to actual repository work
- repo state matters
- the output should be execution-ready

Output style:
- concrete implementation plan
- touched-surface map
- risks
- acceptance checks

---

## Input precedence

When generating a repo-aware plan, trust inputs in this order:

1. actual repository state
2. `ops/Combined-Execution-Sequencing-Plan.md` for active readiness/order/frontier truth
3. `ops/AGENTS.md` for ownership/guardrail truth
4. relevant specialized docs
5. recent commit/review context
6. user prompt wording

If higher-priority inputs contradict the prompt, the contradiction must be named explicitly.

Clarification:

- repo state is first for factual grounding
- Combined is decisive for sequencing/readiness/blocking decisions
- AGENTS remains canonical for ownership and operating policy

---

## Combined-driven planning

`H4` planning should preserve the current control-surface behavior already used manually in this project.

That means:

- read the current frontier before treating any request as executable
- preserve wave/sprint/track/session framing when it is still valid
- explicitly report blocked prerequisites when the requested work is not actually ready
- use `ops/Combined-Execution-Sequencing-Plan.md` as a live planning surface, not only as background reading

Reference:
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`

---

## Required H4 outputs

Every repo-aware plan should explicitly name:

- task summary
- intent
- current repo context
- affected surfaces
- likely touched files
- step order
- dependencies
- test plan
- documentation obligations
- risks
- open questions

If relevant, it should also name:

- related wave/sprint/track references
- shared-zone caution
- blocked prerequisites
- what is intentionally out of scope

If the request already names a track or session, preserve that execution framing unless repo truth clearly shows it is blocked or outdated.

If the request assumes a task is ready but the current frontier says otherwise, the planning artifact should say so explicitly instead of silently replanning the queue.

If AGENTS and Combined differ on active sequencing interpretation, use Combined for active frontier/readiness and call out the mismatch explicitly.

---

## Planning rules

### 1. Ground the plan in repo reality

Do not plan from prompt text alone if the repo provides clarifying evidence.

### 2. Name uncertainty honestly

Unknowns and assumptions are allowed.
Hidden guesses are not.

### 3. Keep scope explicit

If the plan expands scope, it must say so.

### 4. Respect the shared zones

If the likely touched files include sensitive shared zones, the plan should say so explicitly.

Sensitive shared zones include:
- `core/contracts`
- `core/models`
- `runtime/`
- `tracing/`
- `configs/`
- `ops/`

### 5. Name the expected verification path

If implementation is later expected, the plan should already say what tests, smoke checks, or validation steps should exist.

### 6. Prefer family-aligned naming and structure

Future plans should align with current repo style unless there is a strong reason to change it.

### 7. Keep prompt provenance explicit and non-magical

If prompt/version/provenance tags are included in planning artifacts, treat them as provenance context.
Do not treat prompt provenance as quality scoring or gate authority by itself.

### 8. Consume artifact contract, do not rewrite it

`H4` planning should map to the existing coding-vertical artifact contract.
It must not redefine artifact validity/canonicality rules inside a planning response.

---

## Anti-patterns

Reject these planning behaviors:

- planning from a headline without checking repo state
- pretending confidence where the repo is unclear
- inventing architecture changes silently
- overscoping a small request into a platform rewrite
- omitting tests/docs from a plan that clearly needs them
- turning planning into pure prompt theater
- importing non-canonical runtime sidecar failure semantics as if they were coding-vertical artifact law

---

## Acceptance for a good H4 plan

A good `H4` planning artifact is:

- grounded in actual repo state
- explicit about scope and risks
- concrete enough to execute
- honest about unknowns
- modest enough not to destabilize the main wave spine

---

## Feedback hook

Repeated planning failures or strengths should feed:

- `docs/private/Coding-Vertical-Learning-Loop-v01.md`
- future planning-template refinements
- future prompt/gate policy updates
