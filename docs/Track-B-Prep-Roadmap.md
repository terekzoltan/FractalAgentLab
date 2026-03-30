# Track-B-Prep-Roadmap.md

## Purpose

This document turns the Wave 0 Track B kickoff into a concrete implementation plan.

It is narrower than `ops/Combined-Execution-Sequencing-Plan.md`.
That sequencing plan defines ordering across the whole project.
This roadmap defines what Track B should actually implement first, in what order, and what counts as done.

This is the active Track B preparation doc for the first implementation burst.

---

## Scope

This roadmap covers only the early Wave 0 Track B foundation work:

- `F0-B` Initial canonical schemas
- `F0-C` Workflow executor skeleton
- `F0-D` Event emission primitives
- `F0-E` Budget / timeout placeholders

Important:

- `F0-A` repo spine and package layout is already complete
- this roadmap does not include provider implementation
- this roadmap does not include real hero workflow logic
- this roadmap does not include full trace persistence or replay yet
- this roadmap does not include advanced orchestration modes yet

---

## Current Starting Point

Wave status:
- project is in `Wave 0`
- repo spine exists
- coordination docs are aligned
- Track B is the first active implementation track

Physical repo baseline already present:
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
- `docs/Repo-Skeleton-v01.md`
- `src/fractal_agent_lab/core/`
- `src/fractal_agent_lab/runtime/`
- `src/fractal_agent_lab/state/`
- `src/fractal_agent_lab/tracing/`

Track B readiness:
- `READY`

---

## Track B Mission in This Burst

Track B must establish the first canonical runtime backbone.

That means:

1. define the minimum shared contracts other tracks can safely consume
2. define the first execution loop shape
3. define the first event emission boundary
4. make failures and lifecycle states explicit enough to debug

This burst should optimize for:

- clarity
- stability
- debuggability
- low schema churn

This burst should not optimize for:

- framework completeness
- provider breadth
- prompt sophistication
- UI polish
- speculative generalization

---

## Canonical File Targets

Recommended first Track B file areas:

- `src/fractal_agent_lab/core/contracts/`
- `src/fractal_agent_lab/core/events/`
- `src/fractal_agent_lab/core/models/`
- `src/fractal_agent_lab/core/errors/`
- `src/fractal_agent_lab/runtime/`
- `src/fractal_agent_lab/state/`
- `src/fractal_agent_lab/tracing/`

Recommended earliest concrete files:

- `src/fractal_agent_lab/core/models/run_state.py`
- `src/fractal_agent_lab/core/events/trace_event.py`
- `src/fractal_agent_lab/core/contracts/agent_spec.py`
- `src/fractal_agent_lab/core/contracts/workflow_spec.py`
- `src/fractal_agent_lab/core/errors/runtime_errors.py`
- `src/fractal_agent_lab/runtime/executor.py`
- `src/fractal_agent_lab/tracing/emitter.py`
- `src/fractal_agent_lab/state/store.py`

These file names are recommendations, not mandatory if a slightly cleaner equivalent emerges.

---

## Implementation Order

### Step B1 - Define `RunState`

Goal:
- create the first explicit run lifecycle model

Minimum expectations:
- stable run identifier
- workflow identifier
- lifecycle status
- input payload container
- output/result container
- error/failure container
- timestamps or lifecycle markers
- trace reference hooks

Why first:
- execution, tracing, and later persistence all depend on a stable run concept

Definition of done:
- `RunState` exists in a canonical Track B-owned location
- lifecycle stages are explicit enough for debugging
- downstream tracks can refer to it without guessing

### Step B2 - Define `TraceEvent`

Goal:
- create the canonical event unit for observable execution

Minimum expectations:
- event id
- run id
- event type
- timestamp
- actor/source
- payload/details
- optional correlation or parent reference

Why now:
- the project wants trace-first discipline from the beginning

Definition of done:
- one canonical trace event schema exists
- event types are constrained enough to be useful
- Track A and Track E can later consume it without inventing their own shape

### Step B3 - Define `AgentSpec`

Goal:
- create the minimum contract for executable agent definitions

Minimum expectations:
- id
- role
- instructions or instruction reference
- model policy reference
- tool allowance placeholder
- handoff allowance placeholder
- output expectation placeholder

Important:
- this should stay minimal
- do not overfit to Track C prompt complexity yet

Definition of done:
- Track C can later define agent packs against this contract

### Step B4 - Define `WorkflowSpec`

Goal:
- create the minimum contract for a runnable workflow

Minimum expectations:
- workflow id
- workflow name
- entrypoint or execution definition reference
- input schema placeholder
- output schema placeholder
- agent participation list or references
- execution mode placeholder

Definition of done:
- Track C can later describe `H1-lite` without redefining workflow structure from scratch

### Step B5 - Define structured runtime errors

Goal:
- stop failure handling from becoming opaque too early

Minimum expectations:
- base runtime error
- config/boundary error placeholder
- execution error placeholder
- timeout/budget placeholder

Definition of done:
- executor and tracing code have a clean error vocabulary to build on

### Step B6 - Create executor skeleton

Goal:
- define the smallest execution loop that can later run a workflow deterministically enough to debug

Minimum expectations:
- receives workflow spec
- initializes run state
- emits lifecycle events
- leaves provider/adapter execution as a boundary, not a hardcoded implementation
- returns a structured run result or updated state

Important:
- this is not the final orchestrator
- this is the first explicit execution shell

Definition of done:
- a clear execution path exists on paper and in code shape
- downstream tracks know where workflow execution enters the runtime

### Step B7 - Create event emission primitive

Goal:
- define how runtime code records trace events

Minimum expectations:
- one emitter interface or utility
- accepts canonical `TraceEvent`
- can operate without full persistence system
- easy to replace or extend later

Definition of done:
- event emission no longer depends on ad hoc prints or implicit side effects

### Step B8 - Add budget and timeout placeholders

Goal:
- make control boundaries explicit even before they are fully enforced

Minimum expectations:
- timeout placeholder in runtime config or executor boundary
- retry placeholder
- budget placeholder for future model/tool usage controls

Definition of done:
- the runtime shape visibly reserves these concerns
- later enforcement can be added without redesigning the executor contract

---

## Minimal Contract Design Guidance

Track B should prefer:

- small, explicit models
- names that will survive later hardening
- versionable event shapes
- clear separation between contracts, models, runtime, and tracing

Track B should avoid:

- giant god-models
- mixing provider concerns into core contracts
- prompt-rich agent specs too early
- workflow graphs too early
- premature abstraction for every imagined future mode

Rule of thumb:

> if a field is not needed by Wave 0 or a clear Wave 1 downstream consumer, it probably does not belong in v0.

---

## What Is Explicitly Out of Scope

Not part of this first Track B burst:

- real OpenAI/OpenRouter calling code
- full handoff engine
- parallel fan-out engine
- graph workflow runtime
- replay system
- durable memory
- UI-facing trace viewer logic
- benchmark logic
- prompt authoring

These are later concerns.

---

## Downstream Handoff Intent

When this burst succeeds, the downstream effect should be:

- Track D can begin the minimal adapter boundary cleanly
- Track A can prepare around a real execution boundary and later trace shape
- Track C can define agent/workflow content against stable contracts
- Track E can design smoke/replay assumptions against real runtime artifacts

This burst is successful only if it reduces downstream guessing.

---

## Acceptance Criteria

### `F0-B` accepted when

- `RunState` exists
- `TraceEvent` exists
- `WorkflowSpec` exists
- `AgentSpec` exists
- canonical ownership is obvious from file placement
- no major field ambiguity remains for Wave 0 consumers

### `F0-C` accepted when

- one executor entrypoint exists
- it clearly consumes workflow/run contracts
- runtime lifecycle shape is understandable
- success and failure path are both structurally visible

### `F0-D` accepted when

- one event emission primitive exists
- executor can emit at least start/completion/failure class events in principle
- trace emission no longer depends on implicit future design

### `F0-E` accepted when

- timeout, retry, and budget placeholders are represented in code shape or config boundary
- they are not yet fully powerful, but they are no longer invisible

---

## Suggested Delivery Sequence

Recommended order inside the first implementation burst:

1. `RunState`
2. `TraceEvent`
3. `AgentSpec`
4. `WorkflowSpec`
5. runtime errors
6. executor skeleton
7. event emission primitive
8. budget / timeout placeholders

Recommended checkpoint after items 1 to 4:

- pause and verify whether the schemas are still small and legible
- if they already feel too broad, simplify before building executor shape on top

---

## Meta Review Checklist for This Burst

The Meta Coordinator should evaluate Track B output using this checklist:

- Are the contracts small enough?
- Is ownership obvious from the file layout?
- Did Track B avoid provider leakage?
- Did Track B avoid prompt-layer leakage?
- Is the executor a real skeleton, not theater?
- Can downstream tracks now work with fewer assumptions?
- Did the implementation preserve the project's trace-first philosophy?

---

## Recommended Next Docs After This Burst

Once Track B finishes this prep burst, the next highest-value docs are:

1. `docs/Workflow-H1-Idea-Refinement-Plan.md`
2. `docs/Track-C-Prompt-Strategy.md`
3. `docs/wave0/Wave0-Manual-Smoke-Checklist.md`

---

## Execution Status Update (2026-03-08)

Current implementation status for this roadmap:

- `F0-B` = implemented
- `F0-C` = implemented
- `F0-D` = implemented
- `F0-E` = implemented

Implementation report:

- `docs/wave0/Wave0-TrackB-Implementation-Report.md`

---

## Final Guidance to Track B

Do not try to impress the project with breadth.

The job here is to make the rest of the repo safer to build.

If Track B delivers a small, clean, explicit runtime foundation, then Wave 0 is on track.
