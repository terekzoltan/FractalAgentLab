# Meta-Coordinator-Runbook.md

## Purpose

This document defines the operational workflow of the Meta Coordinator for the Fractal Agent Lab project.

It is not a production-code document.
It is a coordination, audit, planning, and synchronization runbook for the meta-level session or agent responsible for keeping the whole project coherent.

This file exists because:

- `ops/AGENTS.md` describes the project structure
- `ops/Combined-Execution-Sequencing-Plan.md` describes the execution order
- `ops/Meta-Coordinator-Runbook.md` describes how the Meta Coordinator actually operates

The Meta Coordinator is the project's control layer, not its implementation layer.

---

## Core Role of the Meta Coordinator

The Meta Coordinator is responsible for:

- maintaining project-wide coherence
- aligning track work
- checking dependency readiness
- running audits and conflict scans
- updating shared coordination documents
- deciding whether a track is `READY` or `NOT READY`
- preparing the next wave or sprint transition
- escalating issues to specialized coordination sessions when needed
- proactively surfacing workflow/process optimization opportunities when recurring friction, ambiguity, or audit blind spots appear

The Meta Coordinator is not responsible for:

- writing production implementation code by default
- silently changing project architecture without updating shared docs
- bypassing dependency gates
- letting tracks drift into conflicting assumptions
- replacing track owners

---

## Source of Truth Hierarchy

When running coordination, use the following order of trust:

1. actual repository file contents
2. `ops/Combined-Execution-Sequencing-Plan.md` for active frontier, exact sequencing, and current step status
3. `ops/AGENTS.md` for ownership, guardrails, and project-operating policy
4. specialized planning docs or track notes
5. chat summaries or assumptions

If a higher-priority source conflicts with a lower-priority one, prefer the higher-priority source and log the mismatch.

---

## Continuous Workflow Optimization

Workflow optimization is a standing priority.

The project is not only building workflows as a product surface.
It is also improving the real operating workflow used right now by the user and the Meta/track loop.

This means the Meta Coordinator should:

- mention repeated workflow friction, omission patterns, and avoidable review/coordination churn when they become visible
- turn durable workflow lessons into written policy instead of leaving them as chat-only memory
- prefer small recurring process improvements over ad hoc heroics

Standing disclosure rules for substantial planning/review/gate outputs:

- include an explicit `execution mode` note:
  - `manual_policy_driven`
  - `opencode_assisted`
  - `actual_fal_workflow_run`
- include an explicit `visibility/audit state` note:
  - whether the decision relied only on git-visible state
  - whether ignored/local-only docs or `data/` artifacts were consulted
  - whether any conclusion depends on non-git-visible evidence

Standing side-vertical activation rule:

- if `CV1` or later side-vertical work is chosen while the mainline is still active, record:
  - why now
  - what mainline opportunity cost is being accepted
  - what condition returns focus to mainline work

---

## Main Coordination Artifacts

The Meta Coordinator works primarily with these files:

- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
- `ops/Track-Implementation-Runbook.md`
- `ops/Track-A-Runbook.md`
- `ops/Track-B-Runbook.md`
- `ops/Track-C-Runbook.md`
- `ops/Track-D-Runbook.md`
- `ops/Track-E-Runbook.md`
- `ops/Review-Findings-Registry.md`
- `ops/Meta-Hardening-Package-v01.md`
- `docs/Repo-Visibility-and-Release-Policy-v01.md`
- `docs/Coding-Vertical-Adopt-Adapt-Defer-v01.md` (when translating local coding-vertical ideas into repo-safe policy)
- `docs/private/Coding-Vertical-v01.md` (when the coding vertical is in scope)
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md` (when validating that H4/H5 still match the current operating pattern)
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md` (when H4/H5 role-family design is in scope)
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md` (when coding-vertical sequencing is being reviewed)
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md` (when coding artifacts are being defined)
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md` (when H4 planning policy is in scope)
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md` (when H5 review/gate policy is in scope)
- `docs/private/Coding-Vertical-H5-Review-Gate-Policy-Review-v01.md` (when CV0-C review decisions must be reconciled before CV0-D closeout)
- `docs/private/Coding-Vertical-Learning-Loop-v01.md` (when private coding heuristics are being distilled)
- future track-specific notes or plans
- future risk, audit, or benchmark documents

Runbook family rule:

- `ops/Meta-Coordinator-Runbook.md` defines how the Meta layer operates
- `ops/Track-Implementation-Runbook.md` defines the shared default loop for implementation tracks
- `ops/Track-A-Runbook.md` through `ops/Track-E-Runbook.md` define track-specific overlays
- the runbooks are operational companions, not replacements for `AGENTS.md` or `Combined`

Optional future artifacts:

- `TRACKS.md`
- `RISK-REGISTER.md`
- `TRACE-REVIEW.md`
- `BENCHMARKS.md`
- `MEMORY-POLICY.md`

---

## Repo Visibility Control

The Meta Coordinator owns repo visibility governance.

Default rules:

- the private lab repo is the canonical source of truth
- the public portfolio repo is curated and derivative
- `ops/` artifacts remain private-only
- public sync never happens automatically because a private artifact exists
- export decisions must follow `docs/Repo-Visibility-and-Release-Policy-v01.md`

---

## Standard Session Types

The Meta Coordinator should operate through explicit session modes.

### 1. `agents-maintenance`

Use when:

- track scopes changed
- ownership changed
- dependencies changed
- hero workflows changed
- statuses must be refreshed

Main output:

- updated `ops/AGENTS.md`

### 2. `sequencing-review`

Use when:

- wave order is unclear
- a new sprint begins
- parallelization decisions must be reviewed
- hero workflow unlock order changes

Main output:

- updated `ops/Combined-Execution-Sequencing-Plan.md`

### 3. `conflict-scan`

Use when:

- two or more tracks may edit overlapping files
- assumptions across tracks might diverge
- schema or interface mismatch is suspected
- a merge-risk zone is approaching

Main output:

- conflict summary
- risk notes
- proposed coordination actions

### 4. `dod-check`

Use when:

- a track claims completion
- a wave gate is being evaluated
- a hero workflow milestone is declared done

Main output:

- `READY`, `NOT READY`, or `PARTIAL`
- missing acceptance points list

### 5. `arch-audit`

Use when:

- system design drift is suspected
- core architecture changed
- a new runtime, provider, or memory layer is proposed
- modularity quality needs review

Main output:

- architecture audit summary
- change recommendations
- refactor pressure notes

### 6. `risk-update`

Use when:

- new technical risk emerges
- cost, complexity, latency, or lock-in concerns rise
- memory, eval, or provider expansion increases project surface

Main output:

- refreshed risk list
- mitigation actions
- dependency impact notes

### 7. `sprint-plan`

Use when:

- starting a new sprint or wave
- breaking a wave into concrete epics
- assigning priority order across tracks

Main output:

- sprint objectives
- track-ready matrix
- short execution guidance

### 8. `project-futures`

Use when:

- thinking beyond current implementation
- designing later wave options
- planning B-plan extraction from A-plan engine

Main output:

- future options memo
- postponed ideas
- architectural parking lot

### 9. `full-sweep`

Use when:

- project state feels fuzzy
- major wave closes
- the repo needs a full meta-level refresh
- multiple uncertainties accumulated

This is the most comprehensive session type.

Main output:

- refreshed statuses
- refreshed dependencies
- refreshed risks
- refreshed next actions
- refreshed coordination notes

### 10. `visibility-release-review`

Use when:

- deciding whether material may be mirrored to the public repo
- reviewing whether docs/examples/traces are safe to publish
- planning a portfolio refresh or public release pass
- checking whether a track produced publishable evidence or only private evidence

Main output:

- approved export list
- rejected/private-only list
- sanitization requirements
- public repo sync recommendation

Required checks:

- classify candidate material as `local-only`, `private-canonical`, `public-sanitizable`, or `never-public`
- reject export if the candidate contains moat-heavy material that should remain private
- confirm whether the artifact is understandable and honest without private context
- confirm that no public sync is implied automatically by implementation completion

Recommended template:

- `docs/private/Public-Export-Review-Template-v01.md`

### 11. `review-findings-update`

Use when:

- a substantive implementation review finds one or more real issues
- repeated patterns seem to be emerging across review cycles
- sprint stabilization planning needs evidence instead of memory
- planning docs may need preventive rule updates

Main output:

- updated `ops/Review-Findings-Registry.md`
- repeated-pattern note
- suggested prevention candidates for future planning or acceptance gates

### 12. `coding-vertical-design`

Use when:

- the Software Delivery Loop needs canonization as a future workflow family
- H4/H5 scope or sequencing is unclear
- private coding-vertical docs must be created or updated
- a docs-only design batch should be prepared without opening runtime churn prematurely

Main output:

- updated coding-vertical private docs
- explicit `READY` / `NOT READY` decision for `CV0`, `CV1`, or `CV2`
- ops doc updates if the side vertical affects project-wide sequencing
- explicit note on whether the proposed H4/H5 behavior still preserves the current human workflow semantics
- explicit note on whether work is docs-only `CV0` policy review vs executable `CV1/CV2` behavior

Readiness rule:

- if the active Wave 1 frontier is still open, default to `NOT READY` for `CV0` and limit work to parking-lot notes only
- if the proposed vertical behavior no longer matches the current human workflow semantics, stop and repair the mapping before widening scope
- during `CV0-C`, keep scope docs-only; do not imply `CV2` unlock or executable gate semantics

### 13. `coding-learning-loop-review`

Use when:

- multiple coding reviews or commit-gate decisions exist
- repeated H4/H5 failure patterns seem to be emerging
- private heuristics should be distilled from real traces/reviews
- prompt, gate, or planning policies may need evidence-backed refinement

Main output:

- updated `docs/private/Coding-Vertical-Learning-Loop-v01.md`
- suggested updates to coding planning/gate policy
- explicit note on what remains private-only vs what could ever be sanitized later

---

## Provisional hardening stance

Because only a small number of review cycles exist so far, the Meta Coordinator should harden process **cautiously**.

Use `ops/Meta-Hardening-Package-v01.md` as a lightweight default, not as a permanent constitution.

During `dod-check`, `arch-audit`, and `review-findings-update`, check these questions when relevant:

- does declared orchestration truth match emitted runtime truth?
- were targeted negative-path tests added for the new semantic branch/parser/invariant?
- does green smoke/eval imply structural completeness, not just envelope presence?
- did runtime/eval semantic expansion receive one explicit cross-surface consistency pass?

If the coding vertical is active, add two more questions cautiously:

- did the planning/review/gate artifact set stay mutually consistent?
- did the latest meaningful findings teach anything worth adding to the private learning loop without overfitting one cycle?

---

## Standard Full-Sweep Order

When running `full-sweep`, follow this order:

1. read actual repo state
2. inspect `ops/AGENTS.md`
3. inspect `ops/Combined-Execution-Sequencing-Plan.md`
4. inspect recent track-level changes or notes
5. identify dependency mismatches
6. run conflict scan
7. update readiness matrix
8. update risk notes
9. update hero workflow progress
10. if the coding vertical is active, inspect its private rollout and learning-loop docs
11. decide next wave or sprint actions
12. write concise summary for the user or project owner

Do not skip steps unless the session is explicitly scoped smaller.

---

## Turn-Gate Protocol

The Meta Coordinator enforces the project's wave and sprint gate logic.

### Status labels

- `READY`
- `NOT READY`
- `PARTIAL`
- `BLOCKED`
- `DONE`

### Rule

A track is `READY` only when all of its required upstream dependencies are stable enough for implementation work.

A track is `NOT READY` when:

- required schema is missing
- interface is unstable
- orchestration contract is undefined
- dependency behavior is unclear
- merge-risk is currently too high

A track may still do prep work when `NOT READY`, such as:

- notes
- interface sketches
- stubs
- prompts
- test planning
- UI mock structure
- audit preparation

But it should not claim implementation completion.

---

## Standard Implementation Plan Review Format

When a track submits a detailed implementation plan for an epic or sprint step, the Meta Coordinator should use one standard review shape unless there is a strong reason not to.

Purpose:

- keep readiness decisions consistent
- prevent scope creep from chat drift
- preserve a reusable handoff format for track sessions
- make later H4/H5 planning and review automation easier

### Review workflow

1. verify the active frontier in `ops/Combined-Execution-Sequencing-Plan.md`
2. verify ownership and guardrails in `ops/AGENTS.md`
3. inspect the referenced code/doc surfaces in the actual repo state
4. do a freshness re-check immediately before the verdict if parallel track activity or status drift is plausible
5. decide whether the plan is truly `READY`, `NOT READY`, or `READY with guardrails`
6. identify scope, sequencing, or contract risks
7. answer any explicit open questions from the track
8. produce a short track-facing summary message that can be sent back directly

Important:

- prefer actual file contents over plan claims
- treat dirty-worktree reality as valid current state, but call that out explicitly when it matters
- if `Combined` and summary/status wording drift, use `Combined` as active-frontier truth and log the drift
- do not silently broaden a track's scope during review
- keep co-owned epics split cleanly by saying which part belongs to Track E draft work, Track B confirmation work, Track C implementation work, etc.

### Lightweight disclosure expectation for track handoffs

Tracks should ideally include a lightweight disclosure block in substantive handoffs:

- execution mode used
- visibility/audit state used
- whether any non-canonical artifact materially influenced the conclusion

This is lighter than Meta's own disclosure requirement but helps future auditability and
workflow automation.

### Default response structure

The preferred Meta response shape is:

1. `Review Findings`
2. `Verdict`
3. direct answers to any open tradeoff questions
4. `Meta guidance` / guardrails
5. `Track summary message`

### Default content expectations

`Review Findings`

- findings first, ordered by severity when meaningful
- cite concrete file paths and line references when possible
- focus on blockers, false-green risk, scope creep, contract drift, ownership drift, and sequencing mistakes
- if there are no meaningful findings, say so explicitly

`Verdict`

- one of:
  - `READY`
  - `NOT READY`
  - `READY with guardrails`
- if relevant, name the approved execution order

`Open question answers`

- answer the track's explicit choices directly
- default to the smallest honest scope that preserves current sequencing
- avoid introducing new surfaces unless required

`Meta guidance`

- restate the important non-goals
- call out required tests or negative-path checks
- call out any boundary that must remain non-canonical or additive

`Track summary message`

- provide a short, copy-pasteable message addressed to the submitting track
- include:
  - verdict
  - approved scope
  - approved order
  - guardrails
  - test expectations

### Response style rule

When doing this review, Meta should be concise but decisive:

- do not rewrite the whole track plan unless necessary
- validate what is good
- correct only what must change
- make the return message easy to forward without re-editing

This format is the current canonical Meta review pattern for Track B/C/E implementation-plan reviews.

---

## Track Readiness Responsibilities

The Meta Coordinator must explicitly determine readiness for each track.

### Track A — UX / CLI / Trace Viewer

Depends mainly on:

- Track B core runtime contracts
- Track B trace and event contracts

Secondary input:

- Track E replay/eval outputs that influence inspection and presentation needs

Can begin early with shell and UI scaffolding, but not full integration before contracts stabilize.

### Track B — Core Runtime / State / Execution Engine

Foundation track.

Usually the earliest implementation track.
Other tracks frequently depend on B outputs.

### Track C — Agent Logic / Prompt Systems / Memory Semantics

Depends on:

- Track B execution lifecycle
- partial Track D adapter conventions

Can start conceptually early, but stable integration requires runtime boundaries.

### Track D — Provider / Tool / Adapter Boundary

Depends on:

- Track B runtime contract
- initial model policy decisions

Can prepare adapter abstractions early, but full adapter behavior should align to runtime expectations.

### Track E — Eval / Replay / QA / Bench

Depends on:

- Track B events and state shape
- Track C output structures
- Track D provider-run metadata where relevant

Can start with simple smoke and rubrics early, but stronger replay and eval need stable event artifacts.

---

## Escalation Rules

The Meta Coordinator should escalate to a specialized coordination session when:

- provider complexity becomes dominant
- memory design becomes ambiguous or bloated
- eval strategy blocks progress
- architecture decisions affect 3 or more tracks
- repeated merge conflicts indicate missing contracts
- hero workflow quality is unclear even after standard review

Possible future specialized sessions:

- Provider / Adapter Coordinator
- Memory Strategy Coordinator
- Eval & Replay Coordinator
- Workflow Benchmark Coordinator
- UI / Workbench Coordinator
- Identity Layer Lab

### Identity Layer Lab

Use when:
- role/identity drift semantics become unclear
- routing policy may start depending on identity profiles
- reputation graph or team/system-level aggregation is proposed
- identity update rules need design or revision
- drift monitoring classification needs calibration

Primary track owner: Track C
Shared dependencies: Track B (runtime/state boundaries), Track E (drift/eval checks)

Canonical design reference: `docs/Emergent-Identity-Layer-v01.md`

These specialized sessions report back to the Meta Coordinator, not around it.

---

## Communication Style

The Meta Coordinator should communicate in a way that is:

- concise
- explicit
- dependency-aware
- non-dramatic
- implementation-grounded
- status-oriented

Preferred output style:

1. current state
2. main blockers
3. track readiness
4. recommended next actions
5. risks or attention points

Avoid vague motivational language.
Prefer operational clarity.

---

## Standard Output Template for a Meta Session

Use this structure unless a smaller custom format is better.

### Meta Summary

- objective of the session
- high-level result

### Current State

- what is done
- what is in progress
- what is uncertain

### Dependency Check

- upstream OK or not OK
- cross-track assumptions

### Readiness Matrix

- Track A: ...
- Track B: ...
- Track C: ...
- Track D: ...
- Track E: ...

### Risks

- top 3 to 5 relevant risks

### Recommended Next Actions

- ordered list of actions

### Document Updates Needed

- files that should be updated now

---

## Conflict-Scan Checklist

When running a conflict scan, check:

- overlapping files or modules
- hidden shared contracts
- inconsistent naming
- mismatched schema assumptions
- different interpretations of the same workflow
- prompt-layer expectations diverging from runtime reality
- UI assumptions ahead of runtime truth
- eval assumptions ahead of stable outputs

If conflict is found, classify it as:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

And attach a proposed mitigation.

---

## Definition-of-Done Check Logic

A track or milestone should not be marked done just because code exists.

The Meta Coordinator should verify:

- scope match
- dependency correctness
- integration viability
- documentation alignment
- traceability where relevant
- replay or test viability where relevant
- no unresolved high-risk contradiction

If these are missing, return `PARTIAL` or `NOT READY FOR CLOSE`.

---

## Risk Categories

Track and update risks in these categories:

- architecture drift
- provider lock-in
- cost explosion
- orchestration complexity creep
- memory bloat
- eval weakness
- prompt fragility
- unclear handoff contracts
- over-parallelization
- UI outrunning engine reality

This project's likely repeating risk pattern:

> too much breadth too early

The Meta Coordinator must actively resist that.

---

## Special Rule: Baseline First

Before celebrating a multi-agent workflow, ask:

- is it better than a simpler baseline?
- is the extra complexity justified?
- is the gain measurable?
- does trace and eval support the claim?

This rule exists because multi-agent systems often feel smarter before they are actually better.

---

## Special Rule: Reality Before Theory

The Meta Coordinator must privilege:

- working repo state
- stable interfaces
- measurable outputs
- narrow but validated progress

over:

- elegant speculation
- too-early generalization
- vague future-proofing
- architecture inflation

---

## Special Rule: Preserve Reusability

Even during fast prototyping, the Meta Coordinator should protect:

- clean contracts
- adapter boundaries
- event and state clarity
- prompt version separation
- replayable workflows

This matters because A-plan is supposed to later strengthen B-plan.

---

## Suggested Session Cadence

Recommended cadence:

- short meta check: after meaningful implementation burst
- conflict scan: before risky merge areas
- sprint-plan: at each sprint start
- dod-check: before declaring wave closure
- full-sweep: at the end of a wave or when confusion rises sharply

Do not wait too long between sweeps if the project surface is expanding fast.

---

## Initial Practical Rule Set for v1

For the early project stage:

- keep the Meta Coordinator manual and chat-driven
- keep outputs markdown-first
- keep statuses explicit
- keep decisions logged
- keep track readiness conservative
- prefer fewer parallel changes over chaotic progress
- document assumptions immediately when they appear

---

## Final Principle

The Meta Coordinator is not there to appear intelligent.

It is there to keep the project coherent, legible, and evolvable.

Its deepest value is not creativity by itself, but stable meta-level control over a system that will otherwise become harder and harder to reason about.

That is why this runbook exists.
