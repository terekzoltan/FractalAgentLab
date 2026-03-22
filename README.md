# Fractal Agent Lab

Fractal Agent Lab is a multi-agent systems project focused on building **inspectable, replayable, and evolvable agent workflows**.

The project combines:

- multi-agent orchestration
- structured runtime state
- trace and replay foundations
- evaluation-oriented design
- a future adaptive identity layer for agents

The goal is not to build a black-box "AI swarm", but a system where agent behavior can be **understood, improved, and compared over time**.

---

## Why This Project Exists

A lot of agent systems today focus on task completion, tool use, or routing, but often leave out a few things that become critical as systems grow:

- traceability
- evaluation
- replayability
- explicit coordination
- behavioral consistency over time

Fractal Agent Lab is built around the idea that multi-agent systems should be treated as **engineered systems**, not just prompt chains.

That means the project is designed to make workflows:

- easier to reason about
- easier to debug
- easier to evolve
- and eventually more interesting to study as adaptive systems

---

## What Makes It Different

### 1. Traceability-first design

Runs should not disappear into a black box.

The project is being built so that workflow execution can leave behind structured traces that later support:

- inspection
- replay
- evaluation
- comparison across iterations

### 2. Explicit role vs behavior separation

An agent role is static.
An agent's actual behavior over time is not.

One of the long-term ideas in this project is to model agents not only as predefined roles, but as evolving system components with observable behavioral drift.

### 3. Evaluation is part of the architecture

Evaluation is not treated as an afterthought.

The system is being designed with room for:

- replay-driven checks
- baseline comparisons
- drift monitoring
- future workflow quality scoring

### 4. Built in layers, not as a monolith

The project is structured around a clean internal separation between:

- core contracts
- runtime execution
- agent definitions
- workflow composition
- adapters
- tracing
- evaluation
- future identity logic

This makes it easier to extend without turning the codebase into a fragile one-shot prototype.

---

## Project Vision

Fractal Agent Lab is moving toward a system where:

- workflows are explicitly modeled
- runs produce inspectable state and traces
- agents can be coordinated across multiple roles
- execution quality can be evaluated over time
- identity can later emerge as a measurable adaptive layer

A simple way to describe the long-term direction is:

> static roles, dynamic behavior, explicit coordination.

---

## Core Concepts

### `AgentSpec`

Defines what an agent is supposed to be.

This includes things like:

- role
- kind
- allowed tools
- handoff targets
- model policy references
- metadata

### `WorkflowSpec`

Defines how a workflow is structured.

This is the unit that describes which steps exist, how they are ordered, and which agents participate.

### `RunState`

Represents the live state of a workflow run.

This is the place where execution-time data accumulates.

### `TraceEvent`

Captures meaningful events during execution.

This is the basis for replay, observability, and evaluation.

### Emergent Identity Layer

A planned subsystem that will model agents as evolving identity profiles shaped by execution history, feedback, and coordination patterns.

This is a future-facing direction, but it is being grounded as an engineering problem rather than treated as vague personality simulation.

---

## Current Focus

The project is currently in an early structured build phase.

The immediate focus is on:

- establishing a clean repository spine
- building a stable runtime shell
- defining core contracts
- setting up workflow structure
- creating a useful trace foundation
- preparing the system for replay and eval hardening

An emergent identity subsystem has also been designed, but implementation is intentionally phased in later so the core runtime does not destabilize too early.

---

## Repository Structure

```text
ops/        coordination and project-operating documents
docs/       architecture and subsystem design docs
src/        main Python implementation
tests/      replay / eval / validation
configs/    runtime and provider configuration
examples/   small committed examples
data/       local runtime artifacts (gitignored)
ui/         early trace viewer / future workbench
```

---

## Design Documents

This project treats design documents as first-class artifacts.

Key docs include:

- `docs/Repo-Skeleton-v01.md`
- `docs/Emergent-Identity-Layer-v01.md`
- `docs/Repo-Visibility-and-Release-Policy-v01.md`

These reflect an important part of the project: the system is meant to show not only implementation, but also architecture and design thinking.

---

## Planned Build Progression

### Wave 0

Repository spine, contracts, runtime shell, first runnable workflow path, stored artifacts, and Wave 0 smoke/acceptance groundwork.

### Wave 1

Basic hero-workflow execution hardening, early orchestration learning, baseline comparisons, and better visibility.

### Wave 2

Replay and eval hardening, stronger state/trace contracts, and the first observational version of the Emergent Identity Layer.

### Later

- richer workflow orchestration
- stronger benchmark and evaluation paths
- UI / workbench improvements
- identity-aware routing experiments
- possible team/system-level aggregation ideas

---

## Long-term Research Direction

One of the most interesting directions in this project is the idea that agents should not be modeled only as static role wrappers.

Instead, they may gradually develop measurable identity profiles based on:

- repeated execution behavior
- success and failure patterns
- coordination tendencies
- reflection and correction behavior
- later, possibly reputation and team-level interaction

In practical terms, this means treating identity as a small adaptive subsystem built on top of execution and trace data.

The important constraint is that this is being approached as an engineering feature:

- bounded
- inspectable
- versionable
- measurable

not as vague "AI personality" theater.

---

## Quickstart

The project is still evolving, but Wave 0 already has a runnable CLI path.

### Requirements

- Python 3.12+

### List workflows

Git Bash:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli list-workflows
```

PowerShell:

```powershell
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli list-workflows
```

### Run the current `h1.lite` workflow

Git Bash:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli run h1.lite --input-json "{\"idea\":\"AI founder assistant\"}" --format json --show-trace
```

PowerShell:

```powershell
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli run h1.lite --input-json '{"idea":"AI founder assistant"}' --format json --show-trace
```

### Inspect a stored trace timeline

Git Bash:

```bash
PYTHONPATH=src python -m fractal_agent_lab.cli trace show --run-id <run_id>
```

PowerShell:

```powershell
$env:PYTHONPATH='src'; python -m fractal_agent_lab.cli trace show --run-id <run_id>
```

### Run the current tests

Git Bash:

```bash
PYTHONPATH=src python -m unittest tests.adapters.test_h1_lite_step_runner tests.evals.test_artifact_acceptance
```

### Validate a stored artifact pair

```bash
PYTHONPATH=src python scripts/validate_f0_m_artifact_pair.py <run_id>
```

---

## Project Philosophy

Fractal Agent Lab is built around a few simple preferences:

- explicitness over magic
- inspectability over hype
- measured complexity over premature abstraction
- architecture before framework inflation
- systems thinking over prompt folklore

The project is intentionally trying to stay grounded.

The goal is not to make agents look impressive in isolation.
The goal is to build a system where agent workflows become:

- legible
- testable
- evolvable
- and eventually worth studying

---

## Status Note

This is an actively evolving personal project.

Some design artifacts are intentionally public-facing because they contribute to the portfolio value of the project.
Some deeper coordination, research, and evaluation material may remain private during development.

That boundary is intentional.

The project officially supports a dual-repo model:

- a canonical private lab repo
- and a curated public portfolio repo

See `docs/Repo-Visibility-and-Release-Policy-v01.md` for the current visibility and release policy.
