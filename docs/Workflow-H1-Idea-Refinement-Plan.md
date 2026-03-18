# Workflow-H1-Idea-Refinement-Plan.md

## Purpose

This document defines the Wave 0 `H1-lite` runnable workflow plan and implementation boundary.

It is the Track C handoff artifact for F0-K.

---

## Scope

In scope for Wave 0:

- runnable startup idea refinement path (`h1.lite`)
- strict role chain: intake -> planner -> synthesizer
- manager-mode sequential execution
- mock-provider compatibility through existing adapter boundary

Out of scope in this phase:

- critic role integration (Wave 1)
- handoff/parallel orchestration hardening
- durable memory writes and merge semantics

---

## Workflow Identity

- workflow id: `h1.lite`
- module: `src/fractal_agent_lab/workflows/h1_lite.py`
- execution mode: `manager`

---

## Step Topology

1. `intake`
   - agent: `h1_intake_agent`
   - output goal: normalized problem brief
2. `planner`
   - agent: `h1_planner_agent`
   - output goal: validation and risk plan
3. `synthesizer`
   - agent: `h1_synthesizer_agent`
   - output goal: final H1-lite recommendation package

---

## Contract Anchors

The workflow uses canonical Track B contracts without redefinition:

- `WorkflowSpec` and `WorkflowStepSpec`
- `AgentSpec`
- `RunState`
- `TraceEvent`

Agent specs are sourced from the F0-J pack and validated before use.

---

## Runtime Wiring

Registry and CLI wiring:

- `src/fractal_agent_lab/cli/workflow_registry.py`
  - maps `h1.lite` to workflow and agent pack factories
- `src/fractal_agent_lab/cli/app.py`
  - resolves workflow-specific `agent_specs_by_id`
  - passes them to `build_step_runner(...)`

Result:

- router can use role metadata and model policy refs from Track C pack
- run executes via existing Track B executor and Track D adapter path

---

## Acceptance Check (F0-K)

- `h1.lite` appears in workflow list
- CLI run succeeds on mock provider path
- run and step events are emitted and visible in trace summary
- no Track C contract drift from Track B canonical schemas

---

## Next Steps

1. `L1-A` and `L1-C` are complete: H1 manager schema + full role pack are now implemented
2. `L1-D` completed: Track E shipped the single-agent baseline reference path (`h1.single.v1`)
3. Track A proceeds with `L1-E` run summary readability improvements
