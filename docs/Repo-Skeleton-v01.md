# Repo-Skeleton-v01.md

## Purpose

This document defines the recommended repository skeleton for the Fractal Agent Lab project.

It is not just a folder tree.
It is a session-safe, track-aware, layered repository design intended to support:

- parallel work across multiple opencode sessions
- multi-track implementation without constant file collisions
- a clean reusable core for later productization
- early CLI + early UI development in parallel
- later evolution from single-repo engine into a more platform-like system

This skeleton is designed around the current project identity:

- A1: lab
- A2: engine
- A3: research OS

So the repo must support experimentation, runtime growth, and workflow quality at the same time.

---

## Design Principles

### 1. Layered core, explicit ownership
The repo should be architected by layers, not by temporary track labels.

However, ownership must still be explicit so that parallel track sessions do not constantly interfere with each other.

This means:

- architecture is reflected in directories
- ownership is reflected in project docs and conventions

### 2. Session-safe structure
Because work happens in parallel opencode sessions, the repo must minimize:

- overlapping edits
- silent contract drift
- accidental overwrite risk
- “everyone touched the same file” failure modes

So the structure should create:

- narrow shared zones
- broad isolated work zones
- clear merge-risk hotspots

### 3. One shared contract, many local implementations
Common contracts should live in a small number of stable places.

Concrete implementations should be separated into their own directories so track sessions can work independently.

### 4. Ops-first coordination
This project has a genuine meta-coordination layer.
So operational documents are not secondary clutter.
They are first-class project infrastructure.

### 5. Early practicality over fake completeness
The skeleton should leave room for future expansion, but it should not pretend the project is already bigger than it is.

v1 should be clean, expandable, and realistic.

---

## Top-Level Repository Structure

```text
repo/
  ops/
  docs/
    public/
    private/
  src/
  tests/
  data/
  examples/
  scripts/
  configs/
  ui/
```

---

## Top-Level Directory Roles

### `ops/`
Operational project coordination files.

This directory is the project’s meta-control surface.
In the dual-repo model, this directory is private-only and remains in the canonical lab repo.

Expected contents:

- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
- future sprint notes
- future ownership matrix
- future risk register
- future coordination templates

Primary owner:
- Meta Coordinator

Risk level:
- HIGH (shared coordination truth)

---

### `docs/`
Longer-form architectural, design, and reasoning documents.

In the dual-repo model, this directory should gradually separate into:

- `docs/public/` for public-safe mirror candidates
- `docs/private/` for internal design, planning, and research material

Use this for:

- architecture notes
- design decisions
- workflow explainers
- memory strategy docs
- eval strategy docs
- roadmap deep dives

Primary owner:
- shared, but usually Meta + relevant track lead

Risk level:
- LOW to MEDIUM

Recommended visibility split:
- `docs/public/` = public mirror candidate
- `docs/private/` = private only by default

---

### `src/`
Main Python codebase.

This is the backend and engine core of the project.

Primary owner:
- shared by tracks according to subdirectory ownership

Risk level:
- varies by subdirectory

---

### `tests/`
All formal verification and validation-oriented code.

Use this for:

- unit tests
- integration tests
- replay tests
- smoke workflow tests
- benchmark validation

Primary owner:
- Track E

Risk level:
- LOW to MEDIUM

---

### `data/`
Local runtime artifacts and storage.

Recommended contents:

- local SQLite databases
- local JSON/JSONL traces
- run outputs
- replay captures
- local memory snapshots

Policy:
- mostly gitignored
- not a source-of-truth documentation layer

Primary owner:
- runtime-generated, consumed by multiple tracks

Risk level:
- LOW in git, HIGH in local operational relevance

---

### `examples/`
Committed sample inputs and outputs.

Use this for:

- hero workflow example prompts
- tiny sample traces
- example configs
- expected output snapshots
- demo input files

Primary owner:
- shared across A, C, E

Risk level:
- LOW

---

### `scripts/`
Utility and dev scripts.

Use this for:

- bootstrap helpers
- smoke-run scripts
- replay launchers
- migration helpers
- demo scripts

Primary owner:
- shared, but often B/D/E

Risk level:
- LOW to MEDIUM

---

### `configs/`
Configuration templates and structured config files.

Use this for:

- provider config templates
- model policy templates
- feature flags
- environment examples
- runtime tuning presets

Primary owner:
- Track D primary
- B/C/E consume

Risk level:
- HIGH when changed incorrectly

---

### `ui/`
UI layer for trace viewer and later workbench.

This is a deliberate top-level directory because UI is expected to arrive relatively early and develop in parallel with the engine.

This avoids forcing Track A to constantly edit backend core files.

Potential future contents:

- trace viewer frontend
- lightweight workbench UI
- later full agent workbench
- shared UI docs

Primary owner:
- Track A

Risk level:
- LOW to MEDIUM, depending on coupling

---

## Recommended `src/` Structure

```text
src/
  fractal_agent_lab/
    core/
      contracts/
      events/
      models/
      errors/
    runtime/
    agents/
    workflows/
    adapters/
    tools/
    state/
    memory/
    tracing/
    identity/
    evals/
    cli/
    shared/
```

---

## `src/` Directory Roles

### `src/fractal_agent_lab/core/`
The deepest conceptual core.

This should contain stable abstractions and shared contracts.

#### `src/fractal_agent_lab/core/contracts/`
Shared system contracts.

Examples:

- agent contract
- workflow contract
- handoff contract
- provider interface contract
- tool contract

Primary owner:
- Track B

Shared usage:
- C, D, E consume heavily

Risk:
- VERY HIGH merge sensitivity

#### `src/fractal_agent_lab/core/events/`
Core event types and event schema definitions.

Examples:

- run started
- agent invoked
- handoff issued
- tool called
- run completed
- eval result recorded

Primary owner:
- Track B

Shared usage:
- E and tracing consume heavily

Risk:
- HIGH

#### `src/fractal_agent_lab/core/models/`
Core data models.

Examples:

- run model
- task model
- workflow result model
- message model
- trace summary model

Primary owner:
- Track B

Risk:
- HIGH

#### `src/fractal_agent_lab/core/errors/`
Common domain errors and structured error types.

Primary owner:
- Track B

Risk:
- MEDIUM

---

### `src/fractal_agent_lab/runtime/`
Execution layer.

This is where orchestration becomes real.

Examples:

- orchestrator
- run manager
- dispatch logic
- retry policy
- budget control
- timeout logic
- lifecycle transitions

Primary owner:
- Track B

Risk:
- VERY HIGH

---

### `src/fractal_agent_lab/agents/`
Concrete agent definitions.

Examples:

- planner
- decomposer
- researcher
- critic
- synthesizer
- strategist

Primary owner:
- Track C

Risk:
- MEDIUM

---

### `src/fractal_agent_lab/workflows/`
Workflow modules built from multiple agent and runtime components.

Initial hero workflows:

- startup idea refinement
- project decomposition
- architecture review

Primary owner:
- Track C

Shared dependency:
- B runtime
- D providers
- E later for eval hooks

Risk:
- MEDIUM to HIGH

---

### `src/fractal_agent_lab/adapters/`
Provider and backend adapters.

Suggested future shape:

```text
src/fractal_agent_lab/adapters/
  base/
  openai/
  openrouter/
  local/
```

This is where model/provider-specific behavior should be isolated.

Primary owner:
- Track D

Risk:
- HIGH

---

### `src/fractal_agent_lab/tools/`
Tool abstractions and wrappers.

Examples:

- web tool wrapper
- file tool wrapper
- future repo inspection tool wrapper
- future memory helper tools

Primary owner:
- Track D
- sometimes shared with B

Risk:
- MEDIUM

---

### `src/fractal_agent_lab/state/`
State and persistence coordination.

Examples:

- run state
- session state
- workflow state
- SQLite-backed indexes
- state serializers

Primary owner:
- Track B

Risk:
- HIGH

---

### `src/fractal_agent_lab/memory/`
Memory semantics and consolidation layer.

Examples:

- memory extraction
- memory summary
- memory merge policy
- memory scoring
- durable memory store interface

Primary owner:
- Track C

Shared dependency:
- B for lifecycle hooks
- E for quality evaluation

Risk:
- MEDIUM to HIGH

---

### `src/fractal_agent_lab/identity/`
Emergent identity layer — adaptive behavioral profiles for agents.

This package implements the observational and adaptive identity subsystem described in `docs/Emergent-Identity-Layer-v01.md`.

Recommended internal shape:

```text
src/fractal_agent_lab/identity/
  models/        # IdentityProfile, IdentitySnapshot
  updater/       # signal rules, post-run identity update logic
  store/         # JSON-based identity persistence (later SQLite)
  drift/         # drift monitor, drift classification
  routing/       # identity-informed routing hints (later)
```

Primary owner:
- Track C

Shared dependency:
- B for runtime/state/tracing boundaries
- E for drift/eval checks

Risk:
- MEDIUM (isolated from core, but semantics must stay grounded)

---

### `src/fractal_agent_lab/tracing/`
Tracing, replay, and trace structure support.

Examples:

- trace recorder
- trace event writer
- replay loader
- timeline shape
- trace summarizer

Primary owner:
- B and E shared

Risk:
- HIGH

---

### `src/fractal_agent_lab/evals/`
Evaluation logic inside the codebase.

Examples:

- rubric evaluators
- baseline comparison helpers
- LLM judge helpers
- workflow score logic

Primary owner:
- Track E

Risk:
- MEDIUM

---

### `src/fractal_agent_lab/cli/`
CLI entrypoints and commands.

Recommended early direction:
- Typer or Click based CLI

Examples:

- run workflow
- inspect trace
- replay run
- list examples
- validate config

Primary owner:
- Track A

Risk:
- LOW to MEDIUM

---

### `src/fractal_agent_lab/shared/`
Strictly limited shared utilities.

This directory should stay small.

Allowed examples:

- formatting helper
- common path utility
- tiny serialization helper
- common constants

Not allowed:
- turning this into a dumping ground for cross-track shortcuts

Primary owner:
- shared, but use carefully

Risk:
- deceptively HIGH if abused

---

## Ownership Matrix

### Primary ownership by track

- **Track A**
  - `ui/`
  - `src/fractal_agent_lab/cli/`
  - part of `examples/`

- **Track B**
  - `src/fractal_agent_lab/core/`
  - `src/fractal_agent_lab/runtime/`
  - `src/fractal_agent_lab/state/`

- **Track C**
  - `src/fractal_agent_lab/agents/`
  - `src/fractal_agent_lab/workflows/`
  - `src/fractal_agent_lab/memory/`
  - `src/fractal_agent_lab/identity/` (shared deps: B, E)

- **Track D**
  - `src/fractal_agent_lab/adapters/`
  - `src/fractal_agent_lab/tools/`
  - `configs/`

- **Track E**
  - `tests/`
  - `src/fractal_agent_lab/evals/`
  - part of `src/fractal_agent_lab/tracing/`
  - part of `examples/`

- **Meta Coordinator**
  - `ops/`

---

## Shared Zones

These areas are shared by design and need coordination discipline.

### Shared Zone 1 — Core contracts
- `src/fractal_agent_lab/core/contracts/`
- `src/fractal_agent_lab/core/events/`
- `src/fractal_agent_lab/core/models/`

Primary writer:
- Track B

Consumers:
- C, D, E, A indirectly

Rule:
- consumers should avoid changing these casually
- changes should be announced and reflected in ops docs if impactful

---

### Shared Zone 2 — Trace boundary
- `src/fractal_agent_lab/tracing/`

Primary shared writers:
- B and E

Consumers:
- A for UI
- C for workflow introspection

Rule:
- event shape changes require coordination

---

### Shared Zone 3 — Config policy
- `configs/`

Primary writer:
- D

Consumers:
- B, C, E, A

Rule:
- config names and semantics must remain legible and versionable

---

### Shared Zone 4 — Examples
- `examples/`

Used by:
- A for demos
- C for workflow illustration
- E for eval and regression examples

Rule:
- examples should stay small, stable, and illustrative

---

## Merge-Risk Zones

These areas have elevated risk for opencode session collisions.

### Critical merge-risk zones
- `src/fractal_agent_lab/core/contracts/`
- `src/fractal_agent_lab/core/models/`
- `src/fractal_agent_lab/runtime/`
- `src/fractal_agent_lab/tracing/`
- `configs/`
- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

### Medium merge-risk zones
- `src/fractal_agent_lab/workflows/`
- `src/fractal_agent_lab/memory/`
- `src/fractal_agent_lab/tools/`
- `tests/`

### Lower-risk zones
- `ui/`
- `examples/`
- `scripts/`
- most of `docs/`

---

## Session-Safe Working Rules

Because each track may be developed from a different opencode session, use these rules.

### Rule 1: prefer file separation over clever coordination
If two tracks can work in different files, do that.

### Rule 2: contract changes should happen before dependent implementation bursts
Change shared contracts first, then let dependent tracks implement.

### Rule 3: do not use a giant shared “utils.py”
That becomes a silent multi-track collision zone.

### Rule 4: shared zones require deliberate updates
If editing contracts, tracing, or config semantics, reflect it in ops docs when relevant.

### Rule 5: when in doubt, isolate
Create one more small module rather than one giant shared file.

---

## Artifact Policy

### Committed
Commit:

- small examples
- example prompts
- example traces
- config templates
- lightweight docs
- tiny expected outputs

### Local only
Keep local or gitignored:

- large traces
- live SQLite databases
- experimental run dumps
- volatile session data
- personal provider secrets
- heavy benchmark artifacts

### Suggested pattern
- `examples/` = curated public samples
- `data/` = real local operational data

---

## Storage Policy

Recommended early storage split:

### SQLite
Use for:

- run indexes
- session metadata
- lightweight state indexing
- searchable run registry

### JSON / JSONL
Use for:

- raw trace events
- replayable event streams
- import/export artifacts
- lightweight structured outputs

### Markdown
Use for:

- human-readable summaries
- audit notes
- coordination memos
- design reflections

This hybrid keeps the project both machine-friendly and human-legible.

---

## Config Policy

Recommended early config files:

```text
configs/
  model_policy.example.yaml
  providers.example.yaml
  runtime.example.yaml
```

### `model_policy.example.yaml`
For:
- routing defaults
- model tiers
- cheap vs strong model usage
- workflow model preferences

### `providers.example.yaml`
For:
- OpenAI provider config
- OpenRouter config
- future local model placeholders

### `runtime.example.yaml`
For:
- timeouts
- retries
- tracing toggles
- storage paths
- feature flags

Rule:
- secrets should not live in committed config files

---

## UI Policy

Because UI is expected relatively early, the repo should reserve a proper top-level `ui/` directory from the start.

Why:

- Track A can move in parallel
- trace viewer work does not contaminate backend structure
- later workbench evolution becomes easier
- early prototypes can stay minimal while architecture remains open

The UI does not need to be fully decided now.
The directory is mainly an architectural reservation and an ownership-safe boundary.

---

## v1 vs Later Expansion

### v1 should include
- layered backend directories
- ops directory
- committed examples
- local data policy
- early configs
- early CLI support
- reserved UI directory
- clear ownership boundaries

### Later can expand into
- richer UI frontend
- multi-provider sophistication
- local model runtime adapters
- stronger benchmark suite
- more complex workflow graphs
- possible monorepo split if needed

### Monorepo expansion path
If the project outgrows a single-package shape later, possible future split:

- `apps/`
- `packages/`
- `services/`

But this should happen only when the current single-repo structure becomes a genuine bottleneck.

---

## Recommended Initial File Tree Example

```text
repo/
  ops/
    AGENTS.md
    Combined-Execution-Sequencing-Plan.md
    Meta-Coordinator-Runbook.md
  docs/
    public/
    private/
  src/
    fractal_agent_lab/
      core/
        contracts/
        events/
        models/
        errors/
      runtime/
      agents/
      workflows/
      adapters/
        base/
        openai/
        openrouter/
        local/
      tools/
      state/
      memory/
      identity/
        models/
        updater/
        store/
        drift/
        routing/
      tracing/
      evals/
      cli/
      shared/
  tests/
  data/
  examples/
  scripts/
  configs/
  ui/
```

---

## Final Recommendation

This repository should be treated as:

> a layered engine workspace with explicit track ownership,
> not just a code folder.

That is the key to making it work well with:

- parallel opencode sessions
- a meta-coordinator workflow
- later productization
- growing multi-agent complexity

The structure should help prevent not only technical mess, but also coordination mess.

That is the deeper reason the skeleton matters.

---

## Recommended first files to actually create

Very short list:

- `ops/AGENTS.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
- `configs/model_policy.example.yaml`
- `configs/providers.example.yaml`
- `src/fractal_agent_lab/core/contracts/`
- `src/fractal_agent_lab/runtime/`
- `src/fractal_agent_lab/agents/`
- `src/fractal_agent_lab/workflows/`
- `src/fractal_agent_lab/cli/`
- `src/fractal_agent_lab/tracing/`
- `tests/`
- `examples/`
- `ui/`
