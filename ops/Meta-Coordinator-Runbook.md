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
2. `ops/AGENTS.md`
3. `ops/Combined-Execution-Sequencing-Plan.md`
4. specialized planning docs or track notes
5. chat summaries or assumptions

If a higher-priority source conflicts with a lower-priority one, prefer the higher-priority source and log the mismatch.

---

## Main Coordination Artifacts

The Meta Coordinator works primarily with these files:

- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
- `docs/Repo-Visibility-and-Release-Policy-v01.md`
- future track-specific notes or plans
- future risk, audit, or benchmark documents

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
10. decide next wave or sprint actions
11. write concise summary for the user or project owner

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
