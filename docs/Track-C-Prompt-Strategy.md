# Track-C-Prompt-Strategy.md

## Purpose

This document defines Track C prompt strategy for Wave 0 and early Wave 1.

It anchors prompt work to Track B canonical contracts and keeps role boundaries explicit.

---

## Scope

In scope now:

- H1-lite minimal agent pack (`F0-J`)
- role separation and anti-overlap rules
- prompt versioning conventions
- memory-safe prompt behavior for M0/M1 stage

Out of scope now:

- long-term memory merge automation
- judge/eval prompts (Track E owned)
- provider transport/auth specifics (Track D owned)

---

## Contract Anchors

Track C prompt pack implementation must bind to:

- `AgentSpec` (`src/fractal_agent_lab/core/contracts/agent_spec.py`)
- `WorkflowSpec` (`src/fractal_agent_lab/core/contracts/workflow_spec.py`)
- `RunState` (`src/fractal_agent_lab/core/models/run_state.py`)
- `TraceEvent` (`src/fractal_agent_lab/core/events/trace_event.py`)

Track C must not redefine these core runtime contracts.

---

## Role Separation Rules (H1)

### Intake

- normalize raw idea input into a structured brief
- must not produce final recommendation

### Planner

- turn intake brief into analysis and validation plan
- must not rewrite intake facts or finalize outputs

### Synthesizer

- produce final H1-lite output from intake + planner artifacts
- must be terminal in the role chain

---

## Prompt Versioning

Version keys are explicit and comparable.

- Pack version: `h1-lite.prompt.v0`
- Role-level version id style: `h1/<role>/v0`

Minimum metadata on each `AgentSpec`:

- `metadata.prompt_version`

When prompt text changes meaningfully:

1. bump version
2. add short rationale note in docs
3. keep previous version recoverable in git history

---

## H1-lite Agent Pack v0

Implemented files:

- `src/fractal_agent_lab/agents/h1_lite/roles.py`
- `src/fractal_agent_lab/agents/h1_lite/prompts.py`
- `src/fractal_agent_lab/agents/h1_lite/pack.py`

Role order and handoff chain:

- intake -> planner -> synthesizer

Validation rules enforce:

- required roles exist
- handoff targets exist
- no self-handoff
- synthesizer is terminal

---

## Memory Semantics Constraints (Wave 0)

- prompts may use current run context only (M0 style)
- no automatic durable memory writes in prompt layer
- memory candidate extraction policy is deferred to Wave 2 (`H2-K`)

---

## Documentation Protocol

For Track C implementation work:

1. mark epic status `⬜ -> 🔄` at start in sequencing doc
2. keep `ops/AGENTS.md` uzenofal updated
3. close epic as `✅` only after local acceptance checks pass

---

## Next Track C Steps

1. `L1-M` completed: H1 prompt tags are explicit in summaries and run artifacts
2. `L1-N` / `L1-O` completed: design-only identity profile and signal-carrier drafts are now published
3. wait for Wave 2 identity implementation entry points before any runtime or schema-touching execution
