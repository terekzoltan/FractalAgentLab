# Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1

## Status

Private draft planning artifact.

This document is a proposed next-direction plan only.

It does not authorize:

- OpenCode bridge/API/session delivery replacement
- browser-side execution
- autonomous commit/push
- unattended swarm execution
- public release of raw private learning-loop evidence

## Authority

- `ops/Combined-Execution-Sequencing-Plan.md` remains canonical for active sequencing and status.
- `docs/private/OpenCode-Orchestration-Layer-v01.md` remains the main strategic correction behind Wave 6.
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md` remains the accepted Wave 6 evidence-ledger planning baseline.
- `docs/private/FAL-External-Project-Usage-Runbook-v01.md` remains the accepted W6.5 use-mode baseline.

This Wave 7 draft should be read as a narrow product-direction proposal for what comes after the current evidence-ledger-first posture, not as a contradiction of Wave 6 or W6.5.

## Trigger For This Draft

Recent live use across external-project OpenCode sessions clarified a practical product truth:

- direct OpenCode Track commands such as `/seq-next`, `/implement`, `/step-review`, and `/deep-review` are often more useful than re-running equivalent planning flows through standalone FAL API-backed workflow prompts
- the durable value of FAL is not replacing the OpenCode execution loop
- the durable value of FAL is sitting behind that loop as a private evidence, learning, replay, gate, and suggestions layer

This is consistent with the Wave 6 strategic correction:

> OpenCode is the execution hand. FAL is the workflow intelligence layer above it.

## Core Thesis

FAL should evolve toward a seamless sidecar layer for OpenCode-driven development loops.

Target posture:

```text
OpenCode sessions
  do the planning, implementation, review, and fix work

oc-session-router
  optionally transports messages, packets, approvals, and chaining

FAL
  ingests selected loop evidence
  normalizes it into canonical artifacts
  updates project-local and global learning state
  exposes replay, audit, comparison, and suggestions surfaces
```

In other words:

- OpenCode remains the workflow engine
- router remains optional transport/automation help
- FAL becomes the evidence and learning layer that makes the whole system improve over time

## Confirmed Product Decisions From The Clarification Round

- Primary role now: evidence layer first
- Later expansion: evidence layer plus suggestions
- Full controller mode: deferred research only
- First ingest slice: packets plus selected outputs, not full raw message-stream capture
- Retention default: structured extracts only, not full raw transcripts
- Memory scope: both project-local and cross-project/global value should matter
- Deliverable now: plan/spec first, not immediate broad implementation

## What "Full Controller Later" Means

This option should be defined explicitly so it is not confused with the recommended path.

Full controller later would mean FAL owns:

- loop startup policy
- dispatch order
- Track/Meta routing decisions
- session action triggers
- automatic chaining rules
- controller-state truth above the router

That is intentionally not the Wave 7 recommendation.

Reason:

- current evidence supports FAL as an evidence/control layer
- current evidence does not support replacing OpenCode as the main execution hand
- controller-first work would recreate the same redundancy risk that Wave 6 already corrected away from

## Strategic Repositioning Of Existing FAL Surfaces

### H4 and standalone planning workflows

`h4.wave_start.v1` and `h4.seq_next.v1` remain useful as:

- internal workflow-lab baselines
- artifact-shape test fixtures
- controlled eval inputs
- fallback planning experiments when OpenCode is unavailable

They should not remain the default operational path for day-to-day OpenCode-driven project work when direct OpenCode commands are clearly better on usefulness/cost grounds.

### Wave 5 workbench

The Wave 5 workbench remains valid, but the source of truth it should increasingly browse is not only FAL-native workflow runs.

It should evolve to browse:

- OpenCode-backed loop evidence
- router-captured packet/state transitions
- selected review outputs and syntheses
- project-local and global distilled learnings

### Memory and identity

These become more valuable when they learn from real OpenCode project loops rather than mostly from internal lab workflows.

## Recommended Layer Model

### Layer 0 - OpenCode execution hand

Owns:

- real planning
- implementation
- review
- fix loops
- repo edits
- shell commands

### Layer 1 - Router / transport helper

Owns:

- session-to-session transport
- approval-gated sends
- optional chain automation
- session polling / latest-output extraction

This layer remains optional and user-owned.

### Layer 2 - FAL evidence ingest and normalization

New Wave 7 focus.

Owns:

- ingesting router packets and selected OpenCode outputs
- normalizing them into FAL run/trace/artifact shapes
- loop identity and transition recording
- privacy-preserving structured extracts

### Layer 3 - FAL learning and evaluation

Owns:

- project-local memory updates
- global distilled learning updates
- observational identity updates
- usefulness/eval rows
- replay/acceptance/quality checks over captured loops

### Layer 4 - FAL workbench and suggestions

Owns:

- browsing loops
- replaying decisions
- comparing loops across projects or step classes
- surfacing warnings, gate history, and evidence readiness
- later suggesting likely next actions, cautions, and review pressure points

## Wave 7 Product Posture

### Recommended posture

```text
evidence layer now
suggestions layer later
controller mode much later, only if evidence strongly supports it
```

### Non-goals for Wave 7

- replacing OpenCode `/seq-next` as the default planner
- forcing all work through FAL-native prompt workflows
- full raw transcript storage by default
- browser control of OpenCode sessions
- commit/push automation
- broad autonomous chaining without explicit evidence benefit
- public dashboard work

## Canonical Artifact Direction

Wave 7 should reuse the existing FAL evidence spine rather than inventing a parallel shadow system.

Primary canonical paths should stay:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

Recommended Wave 7 addition inside artifact payloads and sidecars:

- external loop identity
- project identity
- router packet refs
- selected output extracts
- review synthesis extracts
- approval checkpoints
- gate outcomes
- privacy audit state

Recommended Wave 7 sidecars under `data/artifacts/<run_id>/`:

- `opencode_loop_summary.json`
- `packet_ledger.json`
- `selected_outputs.json`
- `review_synthesis.json`
- `approval_log.json`
- `ingest_report.json`

Structured extracts should store:

- stage
- command name
- producer / consumer
- summary
- decision
- selected output excerpt or distilled summary
- artifact refs
- validation state

Structured extracts should not require:

- full raw message history
- full thought/reasoning parts
- hidden session internals

## Learning-State Direction

### Project-local memory

Keep using the existing project-memory model and store shape as the main project-local memory surface.

Existing path family:

- `data/memory/projects/<project_id>.json`

Wave 7 should add new memory entry subtypes tailored to OpenCode-backed loops, such as:

- stable review gate rule
- common failure pattern
- repo-specific caution
- accepted approval policy note
- useful routing pattern

### Global distilled learning

Wave 7 should add a separate cross-project aggregation layer rather than mixing raw project facts into project-local stores.

Recommended new path family:

- `data/memory/global/<topic>.json`

Examples:

- `data/memory/global/opencode_review_patterns.json`
- `data/memory/global/router_transport_lessons.json`
- `data/memory/global/manual_smoke_gate_patterns.json`

Rule:

- project-local memory may contain repo-specific facts
- global memory should contain distilled, de-identified workflow lessons only

### Identity

Wave 7 should keep identity observational and bounded.

Good Wave 7 identity targets:

- Track/session caution tendency
- review strictness tendency
- false-positive tendency
- follow-through / fix completion tendency
- delegation / handoff tendency

Not a Wave 7 goal:

- identity-driven autonomous routing authority

## Seamless Use Requirement

Wave 7 should optimize for the user's practical experience:

```text
run the OpenCode workflow normally
optionally let the router help
let FAL quietly record, normalize, learn, and surface useful context around it
```

Seamless means:

- the user should not have to duplicate planning in FAL when OpenCode already did it better
- the user should not manually rewrite session outputs into FAL formats
- the evidence/learning layer should be mostly sidecar behavior
- approvals should remain where safety requires them, but FAL bookkeeping should not feel like extra theater

## Wave 7 Implementation Slices

### W7-A - OpenCode-backed loop contract

Define the first canonical contract for an OpenCode-backed development loop inside existing FAL run/trace/artifact conventions.

Owns:

- run identity model for external loops
- trace-event mapping from router/session actions
- selected-output extract schema
- packet-ledger sidecar schema
- privacy and retention rules

### W7-B - Router evidence ingest CLI

Build a thin ingest command that consumes router/runtime outputs and writes canonical FAL artifacts.

Candidate future command shape:

```text
fal ingest router-loop
fal ingest selected-output
fal ingest review-synthesis
```

Not a browser feature. Not a session controller.

### W7-C - Workbench support for OpenCode-backed loops

Extend generated indexes and the UI so OpenCode-backed loop artifacts become first-class browse targets.

Needs:

- loop browser rows
- packet/state drill-down
- selected output / synthesis visibility
- approval log visibility
- per-project and cross-project filters

### W7-D - Project-local and global learning updates

Teach memory/eval/identity updaters to consume OpenCode-backed loop artifacts.

Needs:

- project-memory extractors for OpenCode review loops
- global distilled-learning writers
- optional identity signal derivation from loop outcomes

### W7-E - Suggestion layer

Only after the evidence layer is stable.

Suggestions may include:

- likely next action
- missing gate reminder
- repeated failure caution
- recommended validation checklist
- reusable review-fix pattern

Suggestions are advisory only.

## Current Draft Child Docs

The following draft documents now expand the Wave 7 direction:

- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `docs/private/Wave7-W7-B-Router-Evidence-Ingest-CLI-v1.md`
- `docs/private/Wave7-W7-C-OpenCode-Backed-Workbench-Integration-v1.md`
- `docs/private/Wave7-W7-D-OpenCode-Learning-State-And-Suggestions-v1.md`

## Suggested Future CLI Direction

The existing module CLI is useful, but Wave 7 should move toward the long-discussed external-project use shape.

Future preferred invocation:

```text
fal <command>
```

Most relevant Wave 7 command families:

- `fal ingest ...`
- `fal loop ...`
- `fal memory ...`
- `fal evidence ...`
- `fal suggest ...`

This should be a thin layer over the existing Python module, not a separate second system.

## Usefulness Criteria

Wave 7 should be considered useful only if it improves at least some of the following:

- less manual copy/paste bookkeeping
- easier loop audit and replay
- better cross-project memory reuse
- better warning / gate continuity
- better understanding of what really happened between plan, implement, and review
- lower repeated process mistakes across projects
- better operator trust that evidence was preserved correctly

Wave 7 should be considered a miss if it becomes:

- a duplicate planner
- a second workflow theater layer
- an over-eager controller that fights OpenCode
- a raw transcript hoarder with low signal value

## Risks

- Ingest contracts may become too loose and produce low-quality evidence.
- Memory/global learning may mix repo-specific facts with cross-project lessons if not separated carefully.
- Suggestion surfaces may drift into pseudo-authoritative control too early.
- UI work may outpace evidence quality again if browse surfaces are implemented before ingest discipline is stable.
- Router-specific assumptions may leak too deeply into canonical FAL artifacts.

## Recommended Near-Term Decision

Recommended next decision:

```text
open Wave 7 only as evidence-and-learning-layer planning first
```

Recommended immediate scope:

- accept the product correction that OpenCode native commands remain the primary workflow engine
- keep router as optional transport help
- make FAL the seamless evidence/learning/workbench layer behind that workflow
- treat H4 native planning workflows as secondary lab/eval surfaces, not primary operational planning

## Draft Final Position

If adopted, the most accurate one-line description of FAL becomes:

> FAL is the private evidence, replay, learning, and suggestions layer that sits behind real OpenCode development loops across projects.
