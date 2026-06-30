# Combined Execution Sequencing Plan

**Project:** Fractal Agent Lab  
**Owner:** Meta Coordinator  
**Scope:** Track-level execution ordering for the A1 + A2 + A3 hybrid roadmap  
**Intent:** turn `ops/AGENTS.md` from a coordination map into an actually executable wave / sprint plan  
**Status:** active planning document  
**Last updated:** 2026-06-28

---

## 1. Why this document exists

`ops/AGENTS.md` defines the operating system of the project: identities, ownership, dependencies, and guardrails.
This document defines the **execution order**.

It answers:
- what should start first
- what can run in parallel
- what must wait
- which track is blocked vs unblocked
- which artifacts must exist before the next sprint opens
- how the project grows from **lab** -> **engine** -> **research OS** -> **workbench**

This is the central sequencing reference for:
- coding track agents
- Meta Coordinator session
- future specialized coordinator sessions
- sprint kickoff and gate decisions

---

## 2. Planning stance

This project is intentionally ambitious, but the execution model must stay asymmetric:

- **architecture may dream big**
- **implementation must unlock in layers**

The project is therefore planned as a **hybrid ladder**:

1. **Swarm-first lab** for fast learning and visible orchestration
2. **Engine hardening** for reusable internal runtime quality
3. **Research OS usefulness** for real workflows and portfolio value
4. **Provider/workbench expansion** only after the core earns it

The sequencing rule is:

> **Generality is allowed in design, but must be earned in implementation.**

---

## 3. Status markers and gate language

### Epic status markers
- `⬜` = not started
- `🔄` = in progress
- `✅` = completed and accepted
- `⏸` = intentionally paused
- `🚫` = blocked by external dependency or design uncertainty

### Execution-step status markers
- execution steps use the same markers as epics
- step status should summarize the step as a whole:
  - `⬜` = no row in the step has started
  - `🔄` = at least one row in the step is in progress and the step is not yet fully done
  - `✅` = all required rows in the step are complete and accepted
  - `⏸` = intentionally paused
  - `🚫` = blocked by unmet prerequisite

### Gate language
- `NOT READY` = prerequisite epic(s) are not `✅`; the track agent must not implement the blocked epic
- `READY` = all declared prerequisites are `✅`; the track agent may start and switch its own epic from `⬜` to `🔄`
- `HANDOFF READY` = the producing track completed the needed contract/artifact and explicitly signals the consuming track
- `VERIFY FIRST` = implementation may exist, but the next dependent epic cannot start until smoke / schema / replay verification is complete

### Acceptance vocabulary
- `acceptance gate` = local criteria for the epic are met
- `smoke gate` = at least one runnable smoke path passes
- `cross-track gate` = downstream track confirms that the handoff is usable
- `wave gate` = all mandatory epics of the wave are `✅` and blocking risks are documented

### Ownership vs execution assignment
- `Owner` = accountable track for scope/result and closeout
- `Execution assignment` = concrete implementation order when multiple tracks are listed
- If an epic has multiple owners, the sprint must define `Track X -> Track Y` execution order
- Rule: no multi-owner epic may remain without explicit execution assignment
- Future-step clarity rule: every future/open execution row must name the responsible actor sequence, gate/acceptance owner, and exact next allowed handoff. If multiple roles participate, write them sequentially with `->` instead of merging them with `+`.

### Session labels used in execution tables
- `Meta Coordinator session` = coordination/status/review/planning only
- `Track A agent session` = UX / CLI / trace viewer implementation session
- `Track B agent session` = runtime / state / execution implementation session
- `Track C agent session` = agent logic / prompts / memory / identity implementation session
- `Track D agent session` = provider / adapter / routing implementation session
- `Track E agent session` = eval / replay / smoke / benchmark implementation session
- When multiple epics are listed on one row, the default meaning is: run them as one focused batch in the same session unless the notes say otherwise

### Execution-step structuring rule
- one execution-table row must name exactly one session/owner; do not merge roles in the `Session` column with `/`, `+`, or vague combined labels
- if two or more sessions appear in the same numbered step, the default meaning is that they may run in parallel, provided dependencies, ownership boundaries, and evidence gates are safe
- if one item must wait for another, split it into a later numbered step or explicit substep instead of relying on row order inside one table
- if parallel work would blur responsibility, sequence, proof source-of-truth, or closeout ownership, serialize it behind an explicit gate
- parallelism is throughput optimization, not the workflow source of truth; sequential clarity wins when in doubt
- use a separate later step only for true dependency, true gating, or explicit optional/conditional work

### Project State Continuity Protocol

The active workflow bootloader is:

```text
ops/PROJECT_STATE.md
```

Mandatory rules:
- every Meta Coordinator and Track session reads `ops/PROJECT_STATE.md` before planning or acting
- the state file must be Hungarian, except for paths, commands, commits, field names, enum values, or quoted artifact text
- the state file must name the current wave/sprint/step/epic, workflow phase, next action, and next expected role
- sessions continue from that next action instead of replanning from scratch unless the state file is stale, missing, incomplete, or contradicted by repo evidence
- after any meaningful planning, implementation, review, fix, or handoff step, the acting session updates `ops/PROJECT_STATE.md`
- if the step causes no state change, `ops/PROJECT_STATE.md` must explicitly say `Nincs state változás ebből a lépésből.`
- Meta may not green-light the next step unless `ops/PROJECT_STATE.md` is fresh enough and points to the correct next role/action

Versioned protocol reference:
- `docs/private/Project-State-Continuity-Protocol-v01.md`

### OC Session Router Workflow Canon

For OC Session Router workflow semantics and operator usage, the canonical runbook is:

```text
tools/oc-session-router/docs/workflow-orchestrator-runbook.md
```

Rules:
- use that runbook as the primary shared description of the live router workflow, command order, review timing, prompt-forwarding behavior, recovery behavior, and operator stop conditions
- keep target-specific proof points, target state, and target constraints in the target repo runtime state rather than turning the shared runbook into a target-state ledger
- if a wave/step/sprint changes router wrapper semantics, prompt-control injection, review timing, FAL sync hook usage, recovery behavior, or stop conditions, the same closeout must update `tools/oc-session-router/docs/workflow-orchestrator-runbook.md`
- if the change also alters the operator quick path, update `tools/oc-session-router/docs/session-router-cheatsheet.md` and `tools/oc-session-router/README.md` in the same closeout or explicitly record why not

---

## 4. Global sequencing axioms

### Axiom 1 — Track B is the ground
Track B owns the foundational runtime, state, event, workflow execution, and canonical schemas.
If a debate exists about the shape of `RunState`, `TraceEvent`, `WorkflowSpec`, or runtime lifecycle, **Track B wins by default**.

### Axiom 2 — Track C and D are productive after B, not before B
Track C may prototype prompts early, but cannot lock production workflow semantics before Track B publishes the required runtime schemas.
Track D may prototype adapters early, but cannot finalize adapter contracts before Track B publishes the runtime/provider boundary.

### Axiom 3 — Track E is not “later nice-to-have”; it is anti-delusion infrastructure
Eval starts small, but it starts early.
A workflow is not “good” because it looks good once.
At minimum, early hero workflows must hit manual review + smoke.

### Axiom 4 — Track A consumes stable shapes, not fantasies
Track A should not chase moving targets.
CLI shell can start early, but trace viewer and later UI only consume versioned outputs and trace schemas.

### Axiom 5 — Hero workflow quality beats framework purity
Whenever there is tension between “more reusable framework” and “make H1/H2 materially better”, prefer the hero workflow unless it causes obvious structural debt.

### Axiom 6 — Parallelism is real, but declared
Parallel work is allowed only where contracts are explicit.
“Should be fine” is not a contract.

---

## 5. Dependency logic in execution form

### Canonical dependency tree

```text
Track B
├── Track C
├── Track D
├── Track E
└── Track A
```

### Operational interpretation

- **Track B** can start first and should always have useful work.
- **Track C** can do design/prompt drafting early, but production wiring waits on B.
- **Track D** can sketch adapters/config early, but production adapter validity waits on B.
- **Track E** can draft rubrics early, but replay/smoke require runnable outputs.
- **Track A** can scaffold CLI early, but trace viewer/UI waits for stable event schema.

### Practical unlocked order per major wave

- **Wave 0:** B -> D/A minimal -> C minimal -> E minimal
- **Wave 1:** B + C + D coordinated -> E smoke -> A trace consumption
- **Wave 2:** B + E core hardening, C adapts, A consumes stable traces
- **Wave 3:** C + E + A rise in importance, but B remains schema authority
- **Wave 4+:** D widens provider reach, A improves presentation, E compares variants

---

## 6. Merge-risk zones that affect sequencing

| Zone | Main Risk | Why sequencing matters | Mitigation |
|------|-----------|------------------------|------------|
| MR-1 | `RunState` churn | C/D/E/A all depend on it differently | B publishes versioned schema before downstream implementation |
| MR-2 | `TraceEvent` churn | A trace viewer and E replay break together | B defines event contract; A and E consume version tags |
| MR-3 | workflow contract drift | C agent pack and E eval expect different IO | lock workflow input/output schema before wider smoke |
| MR-4 | adapter abstraction drift | D shapes provider boundary too soon or too tightly | B + D handshake doc before production adapter sprint |
| MR-5 | eval illusion | workflow changes but baselines not updated | E owns baseline version tagging and replay references |
| MR-6 | prompt chaos | C creates overlapping agents without role clarity | planner/critic/synthesizer roles must be separated before H1 hardening |

---

## 7. Wave turn-gate protocol (all track agents)

These rules are mandatory.

1. Before starting an epic, the track agent reads:
   - `ops/PROJECT_STATE.md` first
   - `ops/AGENTS.md`
   - this `ops/Combined-Execution-Sequencing-Plan.md`
   - any directly referenced plan for the workflow / track

2. If `ops/PROJECT_STATE.md` is stale, missing, incomplete, not Hungarian, missing wave/sprint/step/epic, or contradicted by repo evidence, the agent must call out the mismatch before acting and update the state file during handoff.

3. If prerequisites are not `✅`, the track agent must explicitly report:
   - `NOT READY`
   - blocking prerequisite
   - allowed fallback work, if any

4. If prerequisites are complete, the track agent reports:
   - `READY`
   - epic name
   - expected owned files / areas

5. When implementation starts:
   - epic status becomes `⬜ -> 🔄`

6. When local implementation is done:
   - run acceptance gate
   - if required, request cross-track verification
   - update `ops/PROJECT_STATE.md` or explicitly record `Nincs state változás ebből a lépésből.`
   - only then mark `✅`

7. A consuming track must not silently adapt to a broken producer contract.
   - if schema mismatch appears, create a coordinator-visible note
   - add uzenofal entry if shared contract changed

8. If an epic changes a shared schema, these are mandatory:
   - schema version note
   - affected tracks listed
   - replay / smoke impact noted

9. A wave is not complete until all **mandatory** epics of that wave are `✅`, open risks are documented, and `ops/PROJECT_STATE.md` points to the correct next wave/sprint action.

10. Public portfolio repo sync is **not** implied by epic completion.
   - if a public release or mirror update is desired, declare it as explicit Meta/release work
   - default assumption: implementation completes in the private canonical repo first

### Provisional hardening addendum

Based on the first two substantial review cycles only, the project now adopts a small preventive layer:

- new orchestration modes should ship with at least one declared-vs-runtime truth check
- new parser/orchestration semantics should ship with targeted negative-path tests
- smoke/eval green should validate structural completeness, not just envelope presence
- runtime/eval semantic expansion should trigger one explicit cross-surface consistency pass before sprint closeout

This is intentionally lightweight and provisional.
Reference:
- `ops/Meta-Hardening-Package-v01.md`
- `ops/Review-Findings-Registry.md`

---

## 8. Execution philosophy by wave

### Wave 0 — Foundation
Build the smallest runnable core that still respects the future architecture.

### Wave 1 — Swarm-first lab
Make the system visibly multi-agent and inspectable fast.

### Wave 2 — Engine hardening
Make the multi-agent system debuggable, replayable, and less toy-like.

### Wave 3 — Research OS usefulness
Turn the engine into something that materially helps real planning tasks.

### Wave 4 — Provider expansion
Broaden runtime options without corrupting the core abstraction.

### Wave 5 — Workbench
Make the system usable and presentable as a portfolio-quality artifact.

---

# 9. Detailed wave plan

---

## Wave 0 — Foundation

**Wave goal:** establish the minimum viable skeleton for a reusable agent engine without overbuilding.  
**Primary value:** create a runnable path, shared schemas, and execution ownership clarity.  
**Hero outcome:** one mocked or lightly real run can execute end-to-end via CLI and produce a structured result + basic trace.

### Wave 0 mandatory outputs
- canonical initial core schemas exist
- minimal workflow executor exists
- one minimal adapter exists
- one CLI command can launch a run
- one simple multi-step path exists (can be mocked or partially real)
- first manual smoke path documented

### Wave 0 sprint breakdown

#### Sprint W0-S1 — Core contracts and repo spine (Track B first)

**Owner priority:** Track B  
**Secondary support:** Meta, then D/A minimal scaffolding

Epics:
- ✅ **F0-A** Repo spine and package layout — **Owner: Meta**
- ✅ **F0-B** Initial canonical schemas: `RunState`, `TraceEvent`, `WorkflowSpec`, `AgentSpec` — **Owner: Track B**
- ✅ **F0-C** Workflow executor skeleton — **Owner: Track B**
- ✅ **F0-D** Event emission primitives — **Owner: Track B**
- ✅ **F0-E** Budget / timeout placeholders (non-final, but explicit) — **Owner: Track B**

**Sequential ordering:**
1. F0-A first (repo spine must exist)
2. F0-B (canonical schemas)
3. F0-C, F0-D, F0-E can proceed in parallel after F0-B

Status note:
- `F0-A` is complete: the minimum repo spine now exists physically, coordination docs live under `ops/`, and the Python namespace package layout exists under `src/fractal_agent_lab/`
- `F0-B` through `F0-E` are complete in Track B code shape with compile and smoke validation, including canonical schemas, runtime executor skeleton, trace emitter boundary, and explicit timeout/retry/budget placeholders.

**Track readiness:**
- Track B = `READY` immediately
- Track D = `NOT READY` for production adapter until `F0-B` exists; may scaffold configs/stubs
- Track A = `NOT READY` for trace visualization until `F0-D` exists; may scaffold CLI shell
- Track C = `NOT READY` for production workflow prompts until `F0-B` exists; may draft role docs
- Track E = `NOT READY` for smoke execution until at least `F0-C` exists; may draft rubric

**Wave 0 sequencing note:**
This sprint is the equivalent of pouring the foundation. Everyone else may prepare, but B decides the concrete shape.

### Sprint W0-S1 — Execution Steps

**✅ Step 1 — Meta creates the repo/control surface first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | F0-A | none | Repo spine and coordination docs must exist before Track B hardens contracts against real paths |

**✅ Step 2 — Track B establishes the canonical schemas**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | F0-B | F0-A ✅ | This is the contract anchor for all downstream tracks |

**✅ Step 3 — Track B finishes the runtime foundation batch**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | F0-C, F0-D, F0-E | F0-B ✅ | Treat as one runtime-foundation batch unless a schema issue forces separation |

**✅ Step 4 — Downstream tracks may do prep-only work while B is finishing**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | prep-only notes for F0-F/F0-I | F0-A ✅ | No production adapter claim before F0-B/F0-C acceptance |
| Track A agent session | prep-only notes for F0-G/F0-H | F0-A ✅ | CLI shape drafting only; no trace-shape assumptions beyond published B contracts |
| Track C agent session | prep-only notes for F0-J/F0-K | F0-A ✅ | Role/prompt drafting only |
| Track E agent session | prep-only notes for F0-L/F0-M | F0-A ✅ | Rubric/checklist drafting only |

#### Sprint W0-S2 — Minimal runtime boundary and first runnable command

**Owner priority:** Track D + Track A, with B still authoritative

Epics:
- ✅ **F0-F** Mock adapter or OpenAI-compatible minimal adapter — **Owner: Track D**
- ✅ **F0-G** CLI shell: `fal run <workflow>` — **Owner: Track A**
- ✅ **F0-H** Minimal run summary output — **Owner: Track A**
- ✅ **F0-I** Basic config loading and provider selection shell — **Owner: Track D**

**Sequential ordering:**
1. F0-F and F0-G can start in parallel (no dependency between them)
2. F0-H after F0-G (needs CLI shell to produce output through)
3. F0-I after F0-F (needs adapter shape to know what config drives)

**Prerequisites:**
- `F0-B` and `F0-C` must be `✅`

**Track readiness:**
- Track D = `READY` after `F0-B/F0-C`
- Track A = `READY` after `F0-C`
- Track E = still mostly `NOT READY` beyond rubric drafting until a run actually completes

### Sprint W0-S2 — Execution Steps

**✅ Step 1 — adapter boundary and CLI shell start in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | F0-F | F0-B ✅ + F0-C ✅ | Establish the mock/provider boundary first |
| Track A agent session | F0-G | F0-C ✅ | Start the runnable entrypoint against the Track B executor shape |

**✅ Step 2 — Track A hardens the run output path**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | F0-H | F0-G ✅ | Keep this narrowly tied to Wave 0 runnable output, not future UI concerns |

**✅ Step 3 — Track D adds config/provider selection shell**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | F0-I | F0-F ✅ | Config loading should match the actual adapter boundary, not invent a separate policy surface |

**✅ Step 4 — Meta checks W0-S2 handoff readiness**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | W0-S2 handoff check | F0-F ✅ + F0-G ✅ + F0-H ✅ + F0-I ✅ | Confirms Track C/E can now consume a runnable path rather than drafts |

#### Sprint W0-S3 — First agent pack and first smoke path

**Owner priority:** Track C + Track E, with B/A/D fixing gaps

Epics:
- ✅ **F0-J** Minimal agent pack v0 (intake + planner + synthesizer, or even 2-agent chain) — **Owner: Track C**
- ✅ **F0-K** Minimal workflow `H1-lite` runnable path — **Owner: Track C** (with Track B/D support)
- ✅ **F0-L** Manual smoke checklist v0 — **Owner: Track E**
- ✅ **F0-M** First stored run artifact and trace artifact — **Owner: Track B + Track E**

Status note:
- `F0-J` moved through `🔄` and is now complete: Track C shipped an H1-lite minimal agent pack under `src/fractal_agent_lab/agents/h1_lite/` with explicit role separation, prompt version tag (`h1-lite.prompt.v0`), and pack validation helpers aligned to `AgentSpec`.
- `F0-K` moved through `🔄` and is now complete: Track C shipped runnable `h1.lite` workflow wiring via `src/fractal_agent_lab/workflows/h1_lite.py`, connected workflow-specific agent specs in `src/fractal_agent_lab/cli/workflow_registry.py`, and bound agent pack metadata into CLI step-runner wiring in `src/fractal_agent_lab/cli/app.py`.
- `F0-L` moved through `🔄` and is now complete: Track E shipped `docs/wave0/Wave0-Manual-Smoke-Checklist.md` with Wave 0 scope boundaries, execution commands, pass/fail labels, and gate mapping to prevent smoke-theater claims.
- `F0-M` moved through `🔄` and is now complete on Track B scope: run artifact write path and trace artifact write path are implemented with canonical shape serialization under `data/runs/<run_id>.json` and `data/traces/<run_id>.jsonl`, integrated into CLI run execution after each run.
- `F0-M` moved through `🔄` and is now complete on Track E scope: artifact usability validation is complete for both success and failure paths, with acceptance constraints codified in `src/fractal_agent_lab/evals/artifact_acceptance.py` and evidence documented in `docs/wave0/Wave0-F0-M-Artifact-Validation.md`.

**Sequential ordering:**
1. F0-J first (agent pack must exist before workflow can run)
2. F0-K after F0-J (wires agents into a runnable workflow)
3. F0-L after F0-K (manual smoke checklist)
4. F0-M after F0-K with explicit execution assignment: **Track B -> Track E**

**Execution assignment for co-owned epic:**
- `F0-M`: **Track B -> Track E**
  - Track B implements artifact write path and canonical artifact shape for run/trace outputs
  - Track E validates artifact usability for replay/smoke and records acceptance constraints

**Prerequisites:**
- `F0-F`, `F0-G`, and `F0-H` must be `✅`

**Wave 0 gate to close the wave:**
- one runnable command completes
- one stored trace exists
- one minimal workflow returns understandable output
- manual smoke checklist exists

### Sprint W0-S3 — Execution Steps

**✅ Step 1 — Track C builds the minimal agent pack first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | F0-J | F0-F ✅ + F0-G ✅ + F0-H ✅ | This is the first point where H1-lite agent semantics become implementation work |

**✅ Step 2 — Track C wires the first runnable workflow path**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | F0-K | F0-J ✅ | Wire the pack into the runnable CLI path, not into a separate experimental shell |

**✅ Step 3 — Track E publishes and executes the manual smoke path**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | F0-L | F0-K ✅ | Smoke must stay anti-delusion focused: runnable command, understandable output, visible trace |

**✅ Step 4 — Track B implements the stored artifact path**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | F0-M (Track B scope) | F0-K ✅ | Implement canonical run/trace artifact writing before eval validates usability |

**✅ Step 5 — Track E validates artifact usability and closes the wave gate**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | F0-M (Track E scope) | F0-M Track B scope ✅ | Validate both success and failure artifact pairs against replay/smoke expectations |
| Meta Coordinator session | Wave 0 closeout check | F0-L ✅ + F0-M ✅ | Marks the wave operationally complete and unblocks Wave 1 |

### Wave 0 optional but allowed parallel prep
- Track C prompt strategy draft
- Track D adapter contract draft
- Track E smoke rubric draft
- Track A trace viewer wireframe note

### Wave 0 refusal rule
If Track B has not yet published canonical schemas, nobody downstream may claim “production-ready” work.

---

## Wave 1 — Swarm-first Lab

**Wave goal:** rapidly learn orchestration patterns and make multi-agent behavior visible.  
**Primary value:** understand manager vs handoff vs basic specialization using the first real hero workflow.  
**Hero workflow:** **H1 — Startup idea refinement**.

### Wave 1 mandatory outputs
- H1 runs end-to-end in at least one orchestration mode
- at least two role-specialized agents exist clearly
- basic handoff or manager coordination works
- output is inspectable through stored traces
- first smoke comparison against a simple baseline exists

### Wave 1 sequencing rule
Do **not** jump into parallel fan-out or graph workflow immediately.
Wave 1 is about learning with controlled complexity.

### Wave 1 sprint breakdown

#### Sprint W1-S1 — Manager baseline for H1

**Owner priority:** B + C  
**Support:** D for provider routing, A for readable output, E for manual+smoke

Epics:
- ✅ **L1-A** H1 workflow schema v1 — **Owner: Track C** (Track B reviews schema contract)
- ✅ **L1-B** Manager orchestration primitive stabilized — **Owner: Track B**
- ✅ **L1-C** H1 agent pack v1: intake / planner / critic / synthesizer — **Owner: Track C**
- ✅ **L1-D** H1 baseline single-agent reference path — **Owner: Track E** (Track C provides single-agent config)
- ✅ **L1-E** Run summary output improves for H1 — **Owner: Track A**

**Sequential ordering:**
1. L1-A and L1-B can start in parallel (schema design + manager primitive)
2. L1-C after L1-A and L1-B (agent pack needs both schema and manager)
3. L1-D after L1-C (baseline needs working agent pack)
4. L1-E after L1-C (summary improvement needs real output to format)

**Prerequisites:**
- Wave 0 complete

**Notes:**
This sprint creates the comparison baseline:
- one simple single-agent path
- one controlled manager-based multi-agent path

### Sprint W1-S1 — Execution Steps

**✅ Step 1 — Track C and Track B open the H1 schema + orchestration baseline in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | L1-A | Wave 0 ✅ | Define the H1 workflow contract that later role packs and baselines will consume |
| Track B agent session | L1-B | Wave 0 ✅ | Stabilize manager orchestration around real H1 needs, not abstract future graph ambitions |

**✅ Step 2 — Track C upgrades the H1 agent pack against the new baseline**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ L1-C | L1-A ✅ + L1-B ✅ | First true H1 pack delivered; ready for baseline/readability consumers |

Status note:
- `L1-A` moved through `🔄` and is now complete: Track C shipped H1 workflow schema v1 in `src/fractal_agent_lab/workflows/h1.py` with explicit `ManagerSpec` contract (`manager_step_id`, worker set, bounded turns), versioned schema refs, and tests in `tests/workflows/test_h1_workflow_spec.py` validating both schema shape and manager-runtime compatibility.
- `L1-B` moved through `🔄` and is now complete: Track B stabilized a manager orchestration primitive in `src/fractal_agent_lab/runtime/executor.py` with explicit manager contract fields in `WorkflowSpec` (`ManagerSpec`/`ManagerDecision`), bounded manager turn loop controls, and manager/worker agent-level trace emissions without breaking Wave 0 linear workflow execution.
- `L1-C` moved through `🔄` and is now complete: Track C delivered full H1 role pack v1 under `src/fractal_agent_lab/agents/h1/` (intake/planner/critic/synthesizer), wired registry binding for `h1.manager.v1`, and added manager-path mock/test coverage.
- `L1-D` moved through `🔄` and is now complete: Track E delivered `h1.single.v1` single-agent baseline workflow wiring, baseline agent pack metadata, mock baseline output shape, and validation tests for contract + end-to-end execution.
- `L1-E` moved through `🔄` and is now complete: Track A upgraded CLI readability for `h1.manager.v1` with H1 outcome extraction, manager-orchestration summary sections, and lane/turn-aware trace rollups in `src/fractal_agent_lab/cli/formatting.py`.

Post-review stabilization note:
- W1-S1 implementation is complete, but a small stabilization batch is now the active immediate priority before `L1-F`.
- Canonical stabilization plan: `docs/wave1/Wave1-W1-S1-Stabilization-Plan.md`
- Execution order: `Track B agent session` -> `Track D agent session` -> `Meta Coordinator session`

**✅ Step 3 — baseline comparison and output readability consume the stabilized H1 pack**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | L1-D | L1-C ✅ | Build the single-agent reference path so Wave 1 learns something, not just looks busier |
| Track A agent session | L1-E | L1-C ✅ | Improve summaries only after H1 output structure is real enough to format meaningfully |

#### Sprint W1-S2 — Handoff variant for H1

**Owner priority:** B + C + D

Epics:
- ✅ **L1-F** Handoff primitive v1 — **Owner: Track B**
- ✅ **L1-G** H1 handoff chain variant — **Owner: Track C** (with Track B support)
- ✅ **L1-H** Trace event enrichment for handoffs — **Owner: Track B**
- ✅ **L1-I** H1 smoke comparison: baseline vs manager vs handoff — **Owner: Track E**

**Sequential ordering:**
1. L1-F first (handoff primitive must exist)
2. L1-G and L1-H can proceed in parallel after L1-F
3. L1-I after L1-G and L1-H (comparison needs both variants + enriched traces)

**Prerequisites:**
- `L1-A` through `L1-D` must be `✅`

**Track readiness:**
- Track A trace viewer is `READY` for basic timeline after `L1-H`
- Track E replay can begin only after at least two saved variant runs exist

### Sprint W1-S2 — Execution Steps

**✅ Step 1 — Track B stabilizes handoff as a runtime primitive first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ L1-F | L1-A ✅ + L1-B ✅ + L1-C ✅ + L1-D ✅ | Keep the primitive understandable; do not jump to parallel fan-out here |

Status note:
- `L1-F` moved through `🔄` and is now complete: Track B delivered handoff primitive v1 in the runtime executor with explicit handoff control parsing (`handoff/finalize/fail`), no-revisit/self-loop guardrails, handoff execution lane traceability, and runtime tests covering happy path plus failure invariants.

**✅ Step 2 — workflow handoff behavior and trace support consume the primitive in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ L1-G | L1-F ✅ | H1 handoff chain variant delivered against the stabilized primitive |
| Track B agent session | ✅ L1-H | L1-F ✅ | Enrich trace events so the handoff path is inspectable rather than theatrical |

Status note:
- `L1-G` moved through `🔄` and is now complete: Track C delivered `h1.handoff.v1` with handoff-specific prompt/pack semantics (`handoff -> handoff -> handoff -> finalize`), CLI registry binding, and mock/test handoff-path coverage.
- `L1-H` moved through `🔄` and is now complete: Track B enriched handoff trace semantics with dedicated `handoff_decided` / `handoff_failed` events, parent/correlation linkage across handoff hops, and handoff-specific decision context in step/agent payloads.
- `L1-I` moved through `🔄` and is now complete: Track E delivered matched-input H1 smoke comparison for baseline/manager/handoff with per-variant artifact validation, normalized comparable output extraction, and structural trace evidence reporting.

**✅ Step 3 — Track E compares baseline vs manager vs handoff**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ L1-I | L1-G ✅ + L1-H ✅ | This is the anti-self-deception checkpoint for Wave 1 orchestration learning |

#### Sprint W1-S3 — First visibility hardening

**Owner priority:** A + E, with B/C patching as needed

Epics:
- ✅ **L1-J** Basic trace viewer / timeline summary — **Owner: Track A**
- ✅ **L1-K** H1 manual smoke rubric v1 — **Owner: Track E**
- ✅ **L1-L** H1 baseline comparison notes and decision log — **Owner: Track E + Meta**
- ✅ **L1-M** prompt version tagging for H1 agent pack — **Owner: Track C**

All four epics can proceed in parallel (no inter-dependencies within this sprint).

**Execution assignment for co-owned epic:**
- `L1-L`: **Track E -> Meta**
  - Track E prepares comparison evidence and evaluation notes
  - Meta finalizes decision log and coordination implications

#### Wave 1 optional identity prep (design only, no implementation)

- ✅ **L1-N** Identity profile schema design draft — **Owner: Track C**
- ✅ **L1-O** Identity signal carrier convention draft — **Owner: Track C** (Track B reviews for runtime compatibility)

These are design/doc artifacts only. They prepare the observational identity MVP for Wave 2 without requiring code changes.
Reference: `docs/Emergent-Identity-Layer-v01.md`

**Wave 1 gate to close the wave:**
- H1 works in at least one multi-agent mode
- there is a visible trace trail
- there is at least one explicit comparison to a single-agent baseline
- H1 output is good enough to use on a real idea, even if imperfect

### Sprint W1-S3 — Execution Steps

**✅ Step 1 — visibility and rubric hardening can begin in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ L1-J | L1-H ✅ | Timeline/trace visibility should consume the now-enriched handoff trace shape |
| Track E agent session | ✅ L1-K | L1-I ✅ | Convert Wave 1 lessons into a repeatable H1 manual smoke rubric |
| Track C agent session | ✅ L1-M | L1-C ✅ | H1 prompt provenance is now explicit in summaries and artifacts |

Status note:
- `L1-J` moved through `🔄` and is now complete: Track A delivered a CLI-first trace viewer command (`trace show`) that reads stored trace artifacts and renders linkage-aware timeline summaries with `parent_event_id` / `correlation_id` preserved for handoff-chain inspection.
- `L1-K` moved through `🔄` and is now complete: Track E published `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md` with matched-input multi-variant smoke procedure, structural completeness gates, variant-specific checks, and explicit `PASS/PARTIAL/FAIL/BLOCKED` outcomes.
- `L1-M` moved through `🔄` and is now complete: Track C shipped formal H1 prompt tagging (`prompt_tags`) across manager/single/handoff with stricter pack-version metadata validation and additive summary/artifact visibility.

**✅ Step 2 — Track E prepares the baseline comparison record**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ L1-L (evidence prep) | L1-I ✅ + L1-K ✅ | Prepare comparison evidence, tradeoff notes, and recommendation draft |

Status note:
- `L1-L` evidence prep moved through `🔄` and is now complete on Track E scope: evidence package is published with structural comparison summary, prompt provenance context, trace-viewer guidance, tradeoff notes, and recommendation draft in `docs/wave1/Wave1-L1-L-H1-Evidence-Prep.md`.

**✅ Step 3 — Meta closes the Wave 1 decision log**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ L1-L (decision log closeout) | L1-L evidence prep ✅ | Finalize the coordination-level decision about what H1 mode becomes the default next baseline |

Status note:
- `L1-L` moved through `🔄` and is now complete: Meta accepted the Wave 1 evidence package and set `h1.manager.v1` as the default next multi-agent reference path, while preserving `h1.single.v1` as baseline anchor and `h1.handoff.v1` as a reference/learning variant in `docs/wave1/Wave1-L1-L-H1-Decision-Log.md`.

**✅ Step 4 — optional identity prep runs only if Wave 1 core work is under control**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ L1-N, ✅ L1-O | L1-C ✅ | Design-only prep delivered without runtime/schema code changes |

Status note:
- `L1-N` moved through `🔄` and is now complete: Track C published `docs/wave1/Wave1-L1-N-Identity-Profile-Schema-Draft.md` with a bounded identity profile draft (`identity.profile.v0`), invariants, and versioning rules for later Wave 2 implementation.
- `L1-O` moved through `🔄` and is now complete: Track C published `docs/wave1/Wave1-L1-O-Identity-Signal-Carrier-Convention.md` with explicit signal envelope/provenance conventions and Track B compatibility constraints (`design only`, no canonical runtime schema churn).

### Wave 1 risk note
The risk here is theatrical multi-agent behavior that teaches little.
Mitigation:
- keep roles sharp
- keep traces readable
- compare against a simpler baseline

---

## Wave 2 — Engine Hardening

**Wave goal:** transform the system from “cool demo” to “reusable engine”.  
**Primary value:** explicit state, structured traces, replay, and smoke gate discipline.  
**Hero focus:** keep H1 working while making the runtime more trustworthy.

### Wave 2 mandatory outputs
- explicit state lifecycle exists
- trace schema is versioned enough for consumers
- replay works for at least one workflow
- smoke checks exist and are runnable
- failure categories are visible

### Wave 2 sequencing principle
This is the first wave where **Track E becomes central**, not optional.
Track B and Track E are the spine of this wave.

### Wave 2 sprint breakdown

#### Sprint W2-S1 — State and trace contract hardening

**Owner priority:** Track B

Epics:
- ✅ **H2-A** `RunState` hardening v1 — **Owner: Track B**
- ✅ **H2-B** `TraceEvent` versioned contract v1 — **Owner: Track B**
- ✅ **H2-C** failure classification and error envelope v1 — **Owner: Track B**
- ✅ **H2-D** run persistence layout for runs/traces/artifacts — **Owner: Track B**

**Sequential ordering:**
1. H2-A, H2-B, H2-C can proceed in parallel (independent schema work)
2. H2-D after H2-A, H2-B, H2-C (persistence layout depends on final schema shapes)

**Prerequisites:**
- Wave 1 complete

**Track readiness:**
- Track A trace viewer enhancements wait for `H2-B`
- Track E replay waits for `H2-D`
- Track C memory extraction waits for stable trace/run persistence layout

### Sprint W2-S1 — Execution Steps

**✅ Step 1 — Track B hardens the shared contracts first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ H2-A, ✅ H2-B, ✅ H2-C | Wave 1 ✅ | Additive v1 hardening shipped with cross-surface updates and negative-path coverage |

**✅ Step 2 — Track B finalizes persistence layout on top of the hardened contracts**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ H2-D | H2-A ✅ + H2-B ✅ + H2-C ✅ | Shared persistence layout is centralized and additive-compatible for replay/smoke/memory consumers |

#### Sprint W2-S2 — Replay and Memory/Identity Foundation

**Owner priority:** E + C parallel

**Rationale for parallelism:**
Track C memory/identity work is **contract-dependent** (needs stable `RunState`/`TraceEvent`/persistence from Track B), not **execution-dependent** (does not need Track E replay implementation to start). This allows Track E replay foundation and Track C memory/identity foundation to proceed in parallel after W2-S1 contracts are stable.

Epics (Track E — replay/smoke foundation):
- ✅ **H2-E** Replay capability for at least H1 — **Owner: Track E** (Track B provides persistence hooks)
- ✅ **H2-F** Smoke suite v1 for H1 — **Owner: Track E**
- ✅ **H2-G** baseline run capture and comparison tags — **Owner: Track E**

Epics (Track C — memory/identity foundation):
- ✅ **H2-I** Session memory v1 (M1 only) — **Owner: Track C**
- ✅ **H2-J** agent role boundary cleanup for H1 — **Owner: Track C**
- ✅ **H2-K** memory candidate extraction policy v1 — **Owner: Track C** (Track E evaluates later)
- ✅ **H2-M** Identity profile model v0 (`IdentityProfile` + `IdentitySnapshot` + JSON store) — **Owner: Track C**
- ✅ **H2-N** Identity signal convention + post-run updater v0 — **Owner: Track C** (Track B reviews later)

Reference for H2-M/N: `docs/Emergent-Identity-Layer-v01.md`

**Sequential ordering:**
1. H2-E and H2-I/H2-J/H2-M can start in parallel (contract-dependent, not cross-dependent)
2. H2-F/H2-G after H2-E; H2-K after H2-I; H2-N after H2-M
3. H2-H draft after H2-F and H2-G

**Prerequisites:**
- `H2-A` through `H2-D` must be `✅`

### Sprint W2-S2 — Execution Steps

**✅ Step 1 — Track E and Track C foundation work in parallel (completed)**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ H2-E | H2-D ✅ | Artifact-backed replay/read/reconstruction foundation delivered with mandatory preflight validation |
| Track C agent session | ✅ H2-I, ✅ H2-J | H2-D ✅ | Session-memory v1 foundation and manager-boundary cleanup completed |
| Track C agent session | ✅ H2-M | H2-D ✅ | Identity profile model completed |

**✅ Step 2 — smoke/baseline and memory/identity policies in parallel (completed)**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ H2-F, ✅ H2-G | H2-E ✅ | Replay-backed stored-artifact smoke suite and additive baseline/provenance tagging delivered |
| Track C agent session | ✅ H2-K | H2-I ✅ | Memory extraction policy builds on memory foundation |
| Track C agent session | ✅ H2-N | H2-M ✅ | Identity updater delivered with config-gated, non-fatal post-run integration |

**✅ Step 3 — Track E drafts the regression checklist**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ H2-H (draft) | H2-F ✅ + H2-G ✅ | Draft regression checklist delivered from replay/smoke/tag reality with explicit Track B confirmation handoff |

#### Sprint W2-S3 — Cross-track Validation and Hardening

**Owner priority:** B + E (validation-focused)

**Rationale:**
This sprint focuses on cross-track reviews and validation-coupled evals that genuinely need the implementations from W2-S2 to exist.

Epics:
- ✅ **H2-H** (contract confirmation scope) — **Owner: Track B**
- ✅ **H2-L** evaluate whether session memory helps H1 materially — **Owner: Track E**
- ✅ **H2-N** (boundary review scope) — **Owner: Track B**
- ✅ **H2-O** Identity drift smoke checks v0 — **Owner: Track E**

**Execution assignment for co-owned epics:**
- `H2-H`: **Track E -> Track B**
  - Track E drafts regression checklist (in W2-S2 Step 3)
  - Track B confirms schema-level enforceability
- `H2-N`: **Track C -> Track B**
  - Track C implements identity updater (in W2-S2 Step 2)
  - Track B reviews runtime boundary

**Sequential ordering:**
1. H2-H confirmation and H2-N boundary review can proceed in parallel
2. H2-L and H2-O after their respective dependencies

**Prerequisites:**
- W2-S2 must be `✅`

**Wave 2 gate to close the wave:**
- H1 can be replayed
- H1 has smoke checks
- state and trace are stable enough for downstream consumers
- session memory exists in minimal form, or a documented decision says why it is deferred
- identity profile model exists and at least one post-run update produces observable output, or a documented decision says why it is deferred

### Sprint W2-S3 — Execution Steps

**✅ Step 1 — Track B confirms contracts and reviews boundaries in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ H2-H (contract confirmation) | H2-H draft ✅ | Contract boundary confirmed; shared invariants separated from eval-local policy |
| Track B agent session | ✅ H2-N (boundary review) | H2-N implementation ✅ | Updater boundary confirmed as additive non-canonical sidecar behavior |

**✅ Step 2 — Track E runs validation-focused evals**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ H2-L | H2-I ✅ + H2-K ✅ | Session-memory materiality eval completed with canonical session-load-path validation, session-store state restoration, and structural/materiality split |
| Track E agent session | ✅ H2-O | H2-M ✅ + H2-N boundary review ✅ | Identity drift smoke v0 completed with bounded classification, required updater evidence, configured identity-store lookup, and warning-grade orphan handling |

### Wave 2 anti-scope-creep rule
No provider-agnostic abstraction expansion beyond what is needed to keep the core clean.
Wave 2 is about trustworthiness, not ecosystem breadth.

Coding-vertical side batch rule:
- `CV0` is an explicit side batch running alongside Wave 2 mainline (see below)
- CV0 executes as a docs-only design batch with its own sequencing
- executable `H4/H5` coding-vertical work remains blocked until CV0 is closed AND named Wave 2 prerequisites are complete
- real-provider implementation remains prep-only in Wave 2; the first canonical real-provider MVP belongs to the Wave 3 side batch

---

## Wave 2 Side Batch — CV0 Docs-only Coding Vertical Design

**Status:** complete (CV0-D ✅; docs-only batch closed)  
**Constraint:** runs alongside Wave 2 mainline; does not block or depend on W2-S1/S2/S3  
**Execution model:** Meta primary coordination with Track C/B/E design input sessions  
**Reference docs:** `docs/private/Coding-Vertical-*.md`

### CV0 purpose

Canonize the H4/H5 workflow family design and policy layer **without writing production code**.

CV0 delivers:
- artifact shape contracts for H4/H5
- H4 planning prompt/policy draft
- H5 review/gate policy draft
- CV1 unlock criteria note

### CV0 execution rule

- W2-S1 (Track B contract hardening) = mainline priority
- CV0-1 (Meta artifact work) may start in parallel with W2-S1
- CV0-2/CV0-3 (Track C/E design review) only when not competing with W2 mainline bandwidth

### CV0 Execution Steps

**✅ Step CV0-1 — Meta canonizes artifact shapes and workflow family contracts**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ CV0-A: H4/H5 artifact contract finalization | Wave 1 ✅ | Finalized `Coding-Vertical-Artifact-Contract-v01.md` into canonical state |

**✅ Step CV0-2 — Track C reviews H4 planning prompt draft**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ CV0-B: H4 planning prompt/policy review | CV0-A ✅ | Design-only review delivered with scope normalization, Combined-authoritative readiness clarification, and cross-doc H4 policy alignment |

**✅ Step CV0-3 — Track E reviews H5 review/gate policy draft**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ CV0-C: H5 review/gate policy review | CV0-A ✅ | Design-only review delivered with false-green guardrail alignment, control-surface clarity, and explicit CV0-vs-CV2 boundary wording |

**✅ Step CV0-4 — Meta finalizes CV0 closeout**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ CV0-D: CV0 closeout + CV1 prereq note | CV0-B ✅ + CV0-C ✅ | CV0 is now closed as docs-only policy work; `CV1` is ready by named prerequisites but remains a side-vertical option, not the active mainline frontier |

### CV0 gate to close the batch
- H4/H5 artifact shapes are canonized
- H4 planning policy draft exists and is Track C reviewed
- H5 review/gate policy draft exists and is Track E reviewed
- CV1/CV2 unlock stance is explicit and does not replace the active mainline frontier
- No production code was written (docs/policy only)

---

## Wave 3 — Research OS Usefulness

**Wave goal:** make the system materially useful for real planning tasks.  
**Primary value:** extend beyond H1 into H2 and draft-usable H3.  
**Hero outcomes:** the system can decompose projects and critique architecture, not just brainstorm startup ideas.

### Wave 3 mandatory outputs
- H1 is stable enough for repeated real use
- H2 exists and is practically useful
- H3 exists in draft-usable form
- project-level memory begins carefully
- richer compare/eval logic starts paying off
- one real-provider H1 path exists in MVP form without displacing the main H2/H3 usefulness work

### Wave 3 sequencing principle
Wave 3 is where the project starts behaving like a **research OS**, not just an orchestration lab.
Track C rises sharply in strategic importance, but E must continue to protect against self-deception.
Track D may add a late-wave real-provider MVP side batch, but that work should not replace the main H2/H3 usefulness spine.

### Wave 3 sprint breakdown

#### Sprint W3-S1 — H2 Project Decomposition

**Owner priority:** C + B + E

Epics:
- ✅ **R3-A** H2 workflow schema v1 — **Owner: Track C** (Track B reviews schema contract)
- ✅ **R3-B** H2 architect / planner / critic role pack — **Owner: Track C**
- ✅ **R3-C** H2 sequencing and risk-zone output template — **Owner: Track C**
- ✅ **R3-D** H2 smoke rubric — **Owner: Track E** (Step 3 skeleton prep + Step 4 finalize complete)

**Sequential ordering:**
1. R3-A first (schema must exist before roles wire to it)
2. R3-A review and R3-B can proceed in parallel (Track B reviews schema while Track C builds role pack)
3. R3-C and R3-D prep can proceed in parallel (output template and smoke rubric skeleton)
4. R3-D finalize after R3-C (final smoke validation needs complete workflow)

**Prerequisites:**
- Wave 2 complete

### Sprint W3-S1 — Execution Steps

**✅ Step 1 — Track C defines the H2 contract first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | R3-A | Wave 2 ✅ | H2 should start from a clear workflow contract, not ad hoc role output shapes |

**✅ Step 2 — Track B reviews schema while Track C builds role pack in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ R3-A (schema review) | R3-A ✅ | Confirmed manager-schema/runtime compatibility invariants and pre-runtime guardrail coverage |
| Track C agent session | ✅ R3-B | R3-A ✅ | Architect/planner/critic separation delivered with runnable manager-pack wiring and explicit anti-fallback mock evidence |

**✅ Step 3 — Track C finalizes output form while Track E prepares smoke rubric skeleton in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ R3-C | R3-B ✅ | H2 output template v1 now freezes canonical sequencing/risk section ordering with planner-owned starting-slice semantics |
| Track E agent session | ✅ R3-D (skeleton prep) | R3-A ✅ + R3-B ✅ | Skeleton rubric drafted as explicit provisional artifact; final validation and freeze remain after `R3-C` |

**✅ Step 4 — Track E finalizes the smoke rubric with complete workflow**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ R3-D (finalize) | R3-C ✅ + R3-D (skeleton prep) ✅ | Validate usefulness for real project decomposition, not only structural completeness |

#### Sprint W3-S2 — H3 Architecture Review (draft quality)

**Owner priority:** C + E, supported by B/A

Epics:
- ✅ **R3-E** H3 workflow schema v1 — **Owner: Track C** (Track B reviews)
- ✅ **R3-F** H3 systems / critic / synthesizer role pack — **Owner: Track C**
- ✅ **R3-G** H3 output sections: strengths / bottlenecks / merge risks / refactor ideas — **Owner: Track C**
- ✅ **R3-H** H3 draft smoke review — **Owner: Track E** (Step 3 skeleton prep + Step 4 finalize complete)

**Sequential ordering:**
1. R3-E first (schema)
2. R3-E review and R3-F can proceed in parallel (Track B reviews schema while Track C builds role pack)
3. R3-G and R3-H prep can proceed in parallel (output sections and smoke prep skeleton)
4. R3-H finalize after R3-G (final smoke review needs complete workflow)

**Prerequisites:**
- `R3-A` through `R3-D` strongly recommended complete first

### Sprint W3-S2 — Execution Steps

**✅ Step 1 — Track C defines the H3 contract first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ R3-E | R3-A ✅ + R3-B ✅ + R3-C ✅ + R3-D ✅ | H3 manager schema v1 delivered with explicit manager envelope compatibility and deferred section-law freeze |

**✅ Step 2 — Track B reviews schema while Track C builds role pack in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ R3-E (schema review) | R3-E ✅ | Confirmed H3 manager-schema/runtime boundary compatibility with deferred section-law guardrails intact |
| Track C agent session | ✅ R3-F | R3-E ✅ | Delivered runnable H3 role pack with strict manager-path guardrails and no section-law freeze |

**✅ Step 3 — Track C hardens output sections while Track E prepares smoke review skeleton in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ R3-G | R3-F ✅ | H3 section naming/order is now frozen with runnable exact-order acceptance assertions |
| Track E agent session | ✅ R3-H (skeleton prep) | R3-E ✅ + R3-F ✅ | Draft smoke review structure delivered as provisional artifact; Step 4 finalize is now unblocked by completed `R3-G` |

**✅ Step 4 — Track E finalizes the smoke review with complete workflow**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ R3-H (finalize) | R3-G ✅ | Final manual smoke review v1 published against frozen H3 section-law; draft-quality usefulness gate retained |

#### Sprint W3-S3 — Project memory and visibility uplift

**Owner priority:** C + A + E

Epics:
- ✅ **R3-I** Project memory v1 (M2) for stable decisions and workflow learnings — **Owner: Track C**
- ✅ **R3-J** trace viewer improvements for multi-workflow browsing — **Owner: Track A**
- ✅ **R3-K** compare multiple runs/variants for H1/H2 — **Owner: Track E**
- ✅ **R3-L** portfolio-quality example runs documented — **Owner: Track A + Track E**

**Sequential ordering:**
1. R3-I, R3-J, R3-K can proceed in parallel (independent streams)
2. R3-L after R3-I, R3-J, R3-K (portfolio examples need memory, viewer, and comparison in place)

**Execution assignment for co-owned epic:**
- `R3-L`: **Track E -> Track A**
  - Track E curates validated comparison runs and eval-backed evidence
  - Track A packages presentation narrative and viewer integration

**Wave 3 gate to close the wave:**
- H1 is genuinely usable
- H2 is useful enough to structure a real project
- H3 can produce a non-embarrassing draft architecture review
- project memory exists and is not pure noise

### Sprint W3-S3 — Execution Steps

**✅ Step 1 — memory, compare logic, and viewer uplift can start in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ R3-I | R3-H ✅ | Project memory v1 delivered with explicit M2 boundary and anti-noise merge policy |
| Track A agent session | ✅ R3-J | R3-H ✅ | Viewer improvements should consume the now broader multi-workflow trace reality |
| Track E agent session | ✅ R3-K | R3-D ✅ + R3-H ✅ | Replay-backed H1 variant comparison reuse + H2 multi-run comparability surface delivered; no winner scoring |

Status note:
- `R3-J` moved through `🔄` and is now complete: Track A extended trace visibility from single-run drill-down to multi-workflow browse/list mode (`trace list`) with explicit row-level degrade policy, while preserving strict fail-loud semantics for `trace show --run-id`.

**✅ Step 2 — Track E curates portfolio-quality evidence first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ R3-L (evidence curation) | R3-I ✅ + R3-J ✅ + R3-K ✅ | Curated evidence published with honest current-state truth (`H1` replay-backed historical green, `H2` current corpus not comparison-ready, `H3` single-run validated/manual-rubric-backed) |

**✅ Step 3 — Track A packages the portfolio-facing presentation layer**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ R3-L (presentation packaging) | R3-L evidence curation ✅ | Track A delivered docs-first packaging with bounded README refresh, explicit disclosure, and no new presentation command |

#### Wave 3 side batch — First real-provider MVP

**Owner priority:** Track D + Track E, with Track B boundary review

Epics:
- ✅ **R3-M** OpenRouter adapter MVP for H1 — **Owner: Track D**
- ✅ **R3-N** provider routing policy v1 (`mock` / `openrouter` explicit selection) — **Owner: Track D**
- ✅ **R3-O** provider failure envelope + conservative fallback policy v1 — **Owner: Track D** (Track B reviews boundary)
- ✅ **R3-P** H1 real-provider smoke path and evidence note — **Owner: Track E + Track D**

**Sequential ordering:**
1. `R3-M` first (one real adapter path must exist before routing/failure behavior can be validated)
2. `R3-N` and `R3-O` can proceed in parallel after `R3-M`
3. `R3-P` after `R3-N` and `R3-O`

**Execution assignment for co-owned epics:**
- `R3-O`: **Track D -> Track B**
  - Track D defines provider-side failure/fallback behavior
  - Track B confirms the error boundary does not leak provider-specific corruption into core runtime contracts
- `R3-P`: **Track D -> Track E**
  - Track D exposes the runnable real-provider path
  - Track E validates it with a narrow H1 smoke/evidence pass

**Minimum required prerequisites:**
- `H2-A` ✅
- `H2-B` ✅
- `H2-C` ✅
- `H2-D` ✅

**Preferred but non-blocking readiness targets:**
- `H2-E` ✅
- `H2-F` ✅
- `H2-G` ✅
- `H2-H` ✅

Meaning:
- the side batch may start once core runtime contracts and persistence are stable enough
- replay/smoke discipline should ideally already exist, but it should enrich this MVP rather than block it completely

**Mainline parallelism rule:**
- Side batch may start after W3-S1 is complete (H2 workflow family is stable)
- Side batch runs parallel with W3-S2 and W3-S3
- Side batch should not consume Track C bandwidth (C is H2/H3 focused in mainline)
- Track D is primary owner; Track E may split time between mainline smoke work and side batch validation
- If bandwidth conflict arises, mainline W3-S2/W3-S3 takes priority over side batch

**Acceptance gate:**
- at least one real provider can run an H1 path end-to-end
- provider selection is explicit and inspectable
- failure behavior is explicit and conservative
- `mock` remains the stable offline/default-safe path
- provider-specific behavior does not leak into core workflow logic

### Wave 3 side batch — Execution Steps

**✅ Step 1 — Track D lands one real-provider path first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | ✅ R3-M | H2-A ✅ + H2-B ✅ + H2-C ✅ + H2-D ✅ | OpenRouter adapter MVP delivered with `h1.single.v1` anchor, strict JSON-object parse/fail-loud behavior, requested-vs-response model inspectability, and fake-transport proof only |

**✅ Step 2 — routing policy and failure semantics harden in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | ✅ R3-N | R3-M ✅ | Provider-selection truth source hardened to explicit `mock`/`openrouter` policy and reused by CLI override path |
| Track D agent session | ✅ R3-O | R3-M ✅ + R3-N ✅ | Conservative fallback policy shipped as explicit single-attempt `openrouter -> mock` behavior only for recoverable provider failures |

**✅ Step 3 — Track B reviews the boundary while Track E validates the path**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ R3-O boundary review | R3-O implementation candidate ✅ | Track B boundary signoff completed: provider fallback/error semantics remain adapter-boundary behavior, and provider-specific details stay additive to generic runtime envelopes |
| Track E agent session | ✅ R3-P | R3-N ✅ + R3-O ✅ + Track B `R3-O` signoff ✅ | Track E delivered bounded `h1.single.v1` + `openrouter` live+inspect smoke/evidence with canonical artifact-backed provider/fallback truth and explicit PASS law |

### Wave 3 risk note
This is the first wave where the system may feel “smart enough” to overtrust.
Mitigation:
- keep E involved
- keep examples stored
- keep critique roles sharp

---

## Wave 4 — Provider Expansion

**Wave goal:** widen runtime options while preserving the internal core model.  
**Primary value:** better routing, more experimentation, optional local/provider diversity.  
**Important constraint:** no architectural corruption of the core for short-term provider hacks.

### Wave 4 mandatory outputs
- OpenRouter and OpenAI-compatible paths are both explicit and inspectable
- routing policy is documented and evidence-backed
- rate-limit/backoff behavior is documented and bounded
- provider-specific behavior does not leak into core workflow logic

### Wave 4 sprint breakdown

#### Sprint W4-S1 — Second-provider parity and routing hardening

Epics:
- ✅ **P4-A** OpenAI-compatible adapter MVP / parity pass — **Owner: Track D**
- ✅ **P4-B** cross-provider smoke comparison (`openrouter` vs `openai`) — **Owner: Track E + Track D**
- ✅ **P4-C** routing policy hardening v2 — **Owner: Track D**

**Sequential ordering:**
1. P4-A first (the second meaningful provider path must exist before parity comparison or routing hardening)
2. P4-B and P4-C can proceed in parallel after P4-A

**Execution assignment for co-owned epic:**
- `P4-B`: **Track D -> Track E**
  - Track D exposes both runnable provider paths
  - Track E compares and documents behavioral differences

### Sprint W4-S1 — Execution Steps

**✅ Step 1 — Track D lands the second meaningful provider path first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | ✅ P4-A | R3-M ✅ + R3-N ✅ + R3-O ✅ | Delivered the OpenAI-compatible adapter MVP as the second real-provider path, bounded to `h1.single.v1` fake-transport proof and adapter-boundary parity; see `docs/wave4/Wave4-W4-S1-TrackD-P4-A-OpenAI-Compatible-Adapter-MVP.md` |

**✅ Step 2 — comparison evidence and routing hardening are complete**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ P4-B | P4-A ✅ | Real OpenRouter + OpenAI live run pair reached `PASS` for bounded `h1.single.v1` provider-path smoke evidence; see `docs/wave4/Wave4-W4-S1-TrackE-P4-B-Live-Evidence-Closeout-v1.md` |
| Track D agent session | ✅ P4-C | P4-A ✅ | Routing policy hardening v2 landed: malformed config blocks fail loudly, real providers require resolved models, and `conservative_mock` stays bounded to `openrouter -> mock` |

Pragmatic gate decision:
- `P4-B` is now complete for bounded `h1.single.v1` provider-path smoke evidence
- `P4-D` remains valid as OpenRouter-first rate-limit/backoff hardening completed under the earlier exception path
- `P4-B` completion still does not permit provider-quality parity or broader workflow-parity claims

#### Sprint W4-S2 — Rate-limit/backoff and optional local widening

Epics:
- ✅ **P4-D** rate-limit/backoff handling v1 — **Owner: Track D**
- ✅ **P4-E** optional local or secondary adapter experiment — **Owner: Track D**
- ✅ **P4-F** routing notes: which tasks deserve which model tier — **Owner: Track D + Meta**

**Sequential ordering:**
1. P4-D is the mainline hardening unit and is complete under the OpenRouter-first exception above
2. P4-E was explicitly chosen as an optional local adapter MVP side lane after P4-D and is complete
3. P4-F is complete after P4-D/P4-E, incorporating optional local-adapter evidence without provider-parity claims

**P4-E execution rule:**
- P4-E is explicitly optional and non-blocking for Wave 4 closure
- P4-E was explicitly chosen as a local adapter MVP with routing integration and completed after P4-D acceptance
- P4-E remains optional/non-blocking for future Wave 4 closure decisions despite being completed here
- P4-E evidence may feed P4-F but must stay isolated from provider-parity and P4-B claims

**Execution assignment for co-owned epic:**
- `P4-F`: **Track D -> Meta**
  - Track D prepares technical routing evidence and model-tier recommendations
  - Meta finalizes policy note and cross-track rollout guidance

### Sprint W4-S2 — Execution Steps

**✅ Step 1 — Track D hardened provider pressure handling and completed the optional local adapter experiment**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | ✅ P4-D | P4-A ✅ + P4-C ✅ + P4-B implementation surface accepted / OpenAI live evidence deferred | Completed OpenRouter-first retry/backoff provider pressure handling with opt-in config, retry inspectability, and no cross-provider parity claim |
| Track D agent session (optional side lane) | ✅ P4-E | P4-D complete + explicit user choice | Completed local adapter MVP with routing integration, disabled-by-default config, fake-transport `h1.single.v1` proof, and no live local/provider-parity claim |

**✅ Step 2 — Track D prepared routing guidance**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | ✅ P4-F (technical routing notes) | P4-D ✅ + P4-E ✅ | Delivered evidence-backed model-tier recommendations, incorporating the completed optional local adapter experiment without making provider-parity claims; see `docs/wave4/Wave4-W4-S2-TrackD-P4-F-Technical-Routing-Notes-v1.md` |

**✅ Step 3 — Meta finalized the rollout note**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ P4-F (policy closeout) | P4-F technical routing notes ✅ | Converted technical notes into cross-track routing/model-tier guidance without reopening adapter design; see `docs/wave4/Wave4-W4-S2-Meta-P4-F-Policy-Closeout-v1.md` |

### Wave 4 gate to close the wave
- same workflow can run through at least two real adapter routes
- routing policy is documented and evidence-backed
- rate-limit/backoff behavior is documented and bounded
- core logic does not fork per provider

Current exception / closeout note:
- OpenAI-compatible adapter behavior now has bounded live evidence through `P4-B` for `h1.single.v1`
- Wave 4 provider-expansion work remains operationally closed, now with bounded live cross-provider smoke evidence
- this does not imply provider-quality parity or general workflow parity beyond the accepted `P4-B` smoke target
- future broader provider/public claims should stay bounded to what the evidence actually covers

---

## Wave 5 — Workbench

**Wave goal:** move from engine quality to usability and portfolio presentation.  
**Primary value:** trace browsing, run management, easier demoability.  
**Constraint:** presentation cannot outrun reliability.

Detailed planning reference:
- `docs/wave5/Wave5-Workbench-Detailed-Plan-v1.md`

### Wave 5 mandatory outputs
- minimal web UI exists
- trace browsing is no longer painful
- run/result comparison is visible
- portfolio-quality narrative exists around the system

### Wave 5 sprint breakdown

#### Sprint W5-S1 — Minimal web shell

Epics:
- ✅ **U5-A** web shell / local UI — **Owner: Track A**
- ✅ **U5-B** run listing and run detail page — **Owner: Track A**
- ✅ **U5-C** trace timeline page — **Owner: Track A**

**Sequential ordering:**
1. U5-A first (web shell is the foundation)
2. U5-B and U5-C can proceed in parallel after U5-A

### Sprint W5-S1 — Execution Steps

**✅ Step 1 — Track A builds the web shell first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ U5-A | Wave 4 ✅ | Delivered the fixture-backed local evidence-observatory shell with explicit no-claim boundaries, responsive smoke PASS, and U5-B/U5-C handoff; see `docs/wave5/Wave5-W5-S1-TrackA-U5-A-Web-Shell.md` |

**✅ Step 2 — run browsing and trace browsing consume the shell in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ U5-B | U5-A ✅ | Delivered generated-index-backed run listing/detail with honest artifact states and U5-C handoff; see `docs/wave5/Wave5-W5-S1-TrackA-U5-B-Run-Browser.md` |
| Track A agent session | ✅ U5-C | U5-A ✅ | Delivered generated strict-valid trace detail files and a trace timeline page without hiding missing/invalid/degraded trace reality; see `docs/wave5/Wave5-W5-S1-TrackA-U5-C-Trace-Timeline.md` |

#### Sprint W5-S2 — Workbench primitives

Epics:
- ✅ **U5-D** workflow launch form — **Owner: Track A**
- ✅ **U5-E** compare two runs — **Owner: Track A + Track E**
- ✅ **U5-F** inspect stored project memory and eval summary — **Owner: Track A**

**Sequential ordering:**
1. U5-D first (launch form is prerequisite for useful comparison)
2. U5-E comparison spec and U5-F can proceed in parallel after U5-D
3. U5-E UX implementation after the comparison spec exists

**Execution assignment for co-owned epic:**
- `U5-E`: **Track E -> Track A**
  - Track E defines comparison metrics and validation expectations
  - Track A implements UX and interaction flow for run comparison

### Sprint W5-S2 — Execution Steps

**✅ Step 1 — Track A lands the workflow launch primitive first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ U5-D | U5-A ✅ + U5-B ✅ + U5-C ✅ | Delivered generated registry-derived workflow catalog, command preview, and operator-mediated packet composer as a `PARTIAL` surface without browser-side execution, OpenCode automation, commit action, bridge, or session bus; see `docs/wave5/Wave5-W5-S2-TrackA-U5-D-Workflow-Launch.md` and commit `3331eaa` |

**✅ Step 2 — Track E defines comparison semantics while Track A can build memory/eval inspection in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ U5-E (comparison spec/metrics) | U5-D ✅ | Accepted docs-only comparison semantics artifact; Track E later confirmed H2 unknown-corpus semantics and post-fix no-claim wording as GREEN |
| Track A agent session | ✅ U5-F | U5-D ✅ | Delivered generated read-only memory/eval inventory with narrowed canonical-memory wording, source-reported eval display, Track C/Track E wording checks, and Meta no-claim closeout; see `docs/wave5/Wave5-W5-S2-TrackA-U5-F-Memory-Eval-Inspection.md` |

**✅ Step 3 — Track A implements comparison UX on top of Track E's comparison semantics**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ U5-E (UX implementation) | U5-E comparison spec ✅ + U5-D ✅ | Delivered bounded structural run-comparison UX in `257892a`; review-fix commit `26fa0cf` hardened U5-C generated-output cleanup, U5-B run-index validation, and Wave 5 evidence wording before Track E returned GREEN semantics/no-claim review |

### Wave 5 gate to close the wave
- ✅ system is presentable without manually spelunking folders
- ✅ portfolio/demo narrative is supported by the UI and bounded README wording
- ✅ UI does not hide key trace/eval realities
- ✅ action surfaces remain operator-mediated and do not claim OpenCode automation, autonomous dispatch, commit authority, provider/model ranking, or quality scoring

---

## Wave 6 — Evidence-backed OpenCode Orchestration Layer

**Wave goal:** make OpenCode-driven Meta/Track development measurable, auditable, replayable, safer, and better over time.

**Primary value:** evidence-backed coordination loops, not another command/skill wrapper.

**Strategic correction:** OpenCode is the execution hand / agent shell / session runtime; Fractal Agent Lab owns workflow intelligence, coordination policy, audit, replay, evidence, and private learning loops.

Alternative internal label:
- `CV3-lite` — OpenCode Execution + FAL Evidence / Coordination / Learning Layer

Detailed planning reference:
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md`

Supporting private references:
- `docs/private/OpenCode-Orchestration-Layer-v01.md`
- `docs/private/Coordination-Layer-Packet-Bus-v02.md`
- `docs/private/Coding-Vertical-Usefulness-Eval-v01.md`

Status:
- ✅ Wave 6 is closed as `narrow_continue` after W6-J no-release and Wave 6 usefulness synthesis acceptance
- ✅ `W6-A` packet and ledger contract is complete (`2729d83`)
- ✅ `W6-B` packet state-machine validator and `W6-C` manual evidence recorder are accepted in `62bd245` after Meta re-review
- ✅ Track C payload-semantics checkpoint accepted as W6-D preflight semantic clearance
- ✅ `W6-D` Step 3A Meta capture brief is complete: `docs/private/Wave6-W6-S1-Meta-W6-D-Step3A-Capture-Brief.md`
- ✅ `W6-D` Step 3B first loop capture/evaluation is accepted as private seed evidence with warnings
- ✅ W6.5 RingFall readiness/adoption planning package is closed in `docs/private/Wave6_5-Ringfall-Adoption-Readiness-Closeout-v01.md`; RingFall Safe Slice 1 skeleton readiness and in-place repo/docs skeleton commit are complete; bridge/API/session delivery implementation remains blocked
- first slice remains manual/semi-manual evidence-ledger capture, not OpenCode API/session delivery automation

### Why Wave 6 exists

OpenCode now provides commands, skills, tools, permissions, and server/API automation.
If Fractal Agent Lab only mirrors OpenCode command workflows, it becomes redundant.

Wave 6 keeps Fractal Agent Lab above OpenCode:

- OpenCode runs sessions and touches repos.
- Fractal Agent Lab records what happened, why decisions were made, which gates worked, which reviews caught real issues, and whether the workflow actually improved development.

The standard changes from:

> how do we automate OpenCode?

to:

> how do we make OpenCode-driven development measurable, auditable, replayable, safer, and better over time?

### Wave 6 anti-goals

Wave 6 must not implement or claim:

- autonomous push
- autonomous commit by default
- unattended swarm execution
- hidden OpenCode session mutation
- direct mutation of OpenCode storage internals
- unvalidated raw-output forwarding between sessions
- broad session bus / queue autonomy before evidence proves usefulness
- another abstract workflow family without usefulness proof
- public exposure of raw private learning-loop evidence

### Wave 6 mandatory outputs

- minimal Meta/Track packet-loop evidence ledger
- explicit packet state machine for the real OpenCode development loop
- private-by-default evidence recorder
- usefulness evaluation comparing manual, command-assisted, packet-assisted, and FAL evidence-backed workflows
- at least one external target-repo trial after readiness check, with WorldSim as the default candidate if available
- sanitized case study or explicit no-release decision that separates public architecture from private operating heuristics; resolved by W6-J as `accepted_no_release`, so no public artifact is currently authorized

### Wave 6 track posture

| Track | Wave 6 role | Current Wave 6 posture |
|-------|-------------|------------------------|
| Meta Coordinator | sequencing, gates, no-claim boundaries, target-readiness decisions | active for planning/gating only |
| Track B | packet/state contract, artifact boundaries, transition validator | `W6-A` and `W6-B` accepted; `W6-B` is in `62bd245` and supports W6-D with transition-validation truth |
| Track E | evidence sufficiency, usefulness metrics, eval rows, false-green prevention | `W6-C` accepted in `62bd245`; `W6-D`, `W6-E`, and `W6-F` accepted; next supports Meta on W6-H target readiness/evidence/privacy judgment |
| Track D | bridge/router/transport surface | `W6-G` readiness brief accepted as do-not-implement-now; bridge/API/session delivery implementation remains blocked unless a later explicit Meta-opened step exists |
| Track C | packet payload meaning, role/command semantics, handoff semantics | W6-D preflight checkpoint accepted; remains checkpoint/review support, not implementation owner |
| Track A | visibility/dashboard UX | deferred until evidence exists and display needs are known |

### Wave 6 sprint breakdown

#### Sprint W6-S1 — Manual evidence-ledger MVP

Status:
- ✅ sprint complete enough to open W6-S2
- ✅ first Track implementation epic `W6-A` is accepted and committed in `2729d83`
- ✅ `W6-B` / `W6-C` accepted in `62bd245` after RED finding fixes and Meta re-review
- ✅ Track C payload-semantics checkpoint accepted for W6-D preflight; W6-D must still treat unknown commands/tracks and `payload_summary`-only evidence as weak
- ✅ `W6-D` Step 3A Meta capture brief is complete
- ✅ `W6-D` Step 3B first loop capture/evaluation is accepted as private single-loop seed evidence with warnings
- ✅ W6-S1 mandatory manual evidence-ledger MVP is complete enough to open W6-S2
- no OpenCode API bridge, hidden delivery, queue, commit, push, or UI dashboard work in this sprint

Epics:
- ✅ **W6-A** packet and ledger contract — **Owner: Track B**; accepted in `2729d83` with W6 packet/ledger contracts, private evidence path helpers, path-safe ID invariant, tests, and delivery note
- ✅ **W6-B** packet state-machine validator — **Owner: Track B**; accepted in `62bd245` after Meta re-review with post-closure false-green fix
- ✅ **W6-C** manual evidence recorder MVP — **Owner: Track E + Track B**; accepted in `62bd245` after Meta re-review with computed W6-B transition validation and clean-pass guardrails
- ✅ **W6-D** first real loop capture and seed usefulness row — **Execution order: Meta Coordinator -> Track E -> selected originating Track evidence source**; accepted as private seed evidence with warnings

Sequential ordering:
1. `W6-A` is complete and defines the packet/ledger artifact contract.
2. `W6-B` is accepted and defines transition-history validation.
3. `W6-C` is accepted and records private evidence with computed W6-B transition validation.
4. Track C payload-semantics checkpoint is accepted for W6-D preflight; W6-D may use payload fields as semantic evidence only with the recorded guardrails.
5. `W6-D` captured the selected W6-B/W6-C review-fix loop as private seed evidence; the originating Track remains an evidence source, not co-owner.

Execution assignment for co-owned epics:
- `W6-C`: **Track B -> Track E**
  - Track B owns recorder-safe artifact and validation boundaries.
  - Track E owns evidence sufficiency fields, usefulness row shape, and false-green semantics.
- `W6-D`: **Meta Coordinator -> Track E -> selected originating Track**
  - Meta first selects the loop, validates privacy/scope, and writes/communicates the W6-D capture brief.
  - Track E then prepares and executes the manual/semi-manual capture/evaluation using W6-C.
  - The originating Track participates only as evidence source for its own actual plan/review/implementation loop.

### Sprint W6-S1 — Execution Steps

**✅ Step 1 — Track B defines packet and ledger contract**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ W6-A | Wave 5 ✅ + this Wave 6 plan | Accepted and committed in `2729d83`; delivered `w6.packet.v1`, `w6.evidence_ledger.v1`, private evidence layout helpers, path-safe `loop_id` / `packet_id` / `parent_packet_id` invariants, targeted tests, and `docs/private/Wave6-W6-S1-TrackB-W6-A-Packet-Ledger-Contract.md` |

**✅ Step 2 — state machine and recorder accepted after W6-A contract acceptance**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ W6-B | W6-A ✅ | Accepted in `62bd245` after Meta re-review; transition validation now blocks missing `greenlit`, `blocked`, `hold`, `deep_review_needed`, post-closure packet, and commit-ready false-green paths |
| Track E agent session | ✅ W6-C | W6-A ✅ + W6-B ✅ | Accepted in `62bd245` after Meta re-review; recorder writes private evidence, records missing tests/review findings/usefulness seed row, and uses computed W6-B transition validation for `clean_pass` |
| Track C checkpoint | ✅ W6-D preflight payload semantics review | W6-A ✅ + W6-B ✅ + W6-C ✅ | Accepted as semantic clearance for W6-D with guardrails: prefer known commands/non-unknown tracks; do not use `payload_summary` alone; interpret `clean_pass` alongside review findings; no broad usefulness or automation claims |

**✅ Step 3A — Meta selects bounded W6-D loop target and capture brief**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ W6-D target/scope selection | W6-A ✅ + W6-B ✅ + W6-C ✅ + Track C checkpoint ✅ | Complete in `docs/private/Wave6-W6-S1-Meta-W6-D-Step3A-Capture-Brief.md`; selected the W6-S1 Step 2 W6-B/W6-C shared-boundary review/fix loop leading to `62bd245` and defined Track E capture criteria |

**✅ Step 3B — Track E captures/evaluates the selected W6-D loop**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ W6-D capture/evaluation | Accepted Meta W6-D capture brief | Captured `w6d-fal-w6bc-review-fix-20260508` with W6-C, preserved `RF-2026-05-08-02` and `RF-2026-05-08-03`, recorded `pass_with_warnings`, and returned Track E `continue` handoff recommendation without broad usefulness or bridge claims |
| Selected originating Track | ✅ W6-D evidence source support | Meta W6-D capture brief + Track E capture request | Track B remained linked evidence/source context for W6-B fix truth only; no new Track B implementation ownership was opened |

#### Sprint W6-S2 — Usefulness expansion and bridge readiness

Status:
- ✅ closed as readiness/risk only after W6-G Meta closeout
- `W6-E` is accepted as private governance/context-continuity seed evidence with warnings
- `W6-F` is accepted after review-fix as low-confidence FAL-only private advisory evidence
- `W6-G` is accepted as `do_not_implement_now`; bridge/API/session delivery implementation remains blocked

Current handoff:

| Field | Value |
|---|---|
| Now responsible | Meta Coordinator for W6.5 readiness/adoption planning |
| Current task | Wave 6 closeout accepted as `narrow_continue`; prepare W6.5/Ringfall readiness planning only |
| Inputs | W6-F delivery note + W6-D/W6-E caveats + Wave 6 anti-goals |
| W6-F accepted result | `overall_recommendation: optional`, `confidence: low`, FAL-only private advisory evidence |
| W6-G accepted result | `do_not_implement_now`; at most a later Meta-opened no-mutation feasibility spike, not opened now |
| W6-H accepted result | `READY_WITH_GUARDRAILS`; WorldSim accepted with Candidate A docs-only first loop and explicit dirty-worktree/privacy guardrails |
| W6-I accepted result | `accepted_with_warnings`; external docs-only merge-readiness loop accepted as Combined-only canonical verification in `docs/private/Wave6-W6-S3-Meta-W6-I-Step-Review-Closeout.md` |
| W6-J accepted result | `accepted_no_release`; Track E returned `APPROVE_NO_RELEASE` / `privacy_verdict: PASS`; no public artifact, public mirror, `docs/public/` output, or Track A presentation work is opened |
| Wave 6 synthesis accepted result | `narrow_continue`; Track E returned `APPROVE_NARROW_CONTINUE`, `confidence: medium_low`, `wave6_5_allowed: true`, `public_output_allowed: false`, `bridge_api_session_delivery_allowed: false` |
| Meta does next | Open W6.5/Ringfall only as readiness/adoption planning; no implementation automation, public output, HUB, Track A presentation, or bridge/API/session delivery |
| Explicitly blocked | Any broader external scope, refinery/live-service path, or bridge/API/session delivery implementation until later explicit Meta acceptance |

Epics:
- ✅ **W6-E** second task-class evidence loop — **Owner: Track E**; accepted as private governance/context-continuity seed evidence with warnings
- ✅ **W6-F** usefulness evaluation v1 — **Owner: Track E**; accepted as low-confidence, FAL-only private advisory evidence after false-green review-fix
- ✅ **W6-G** OpenCode bridge readiness brief — **Owner: Track D then Track B support, Meta closeout**; accepted as readiness/risk only in `docs/private/Wave6-W6-S2-Meta-W6-G-Step-Review-Closeout.md`, no bridge/API/session delivery implementation

Sequential ordering:
1. Meta selects the W6-E target and writes the capture brief. Status: ✅ complete in `docs/private/Wave6-W6-S2-Meta-W6-E-Capture-Brief.md`.
2. Track E captures/evaluates W6-E with W6-C and returns a recommendation. Status: ✅ complete.
3. Meta reviews W6-E evidence. Status: ✅ accepted with warnings.
4. `W6-F` evaluates W6-D + W6-E and decides whether FAL evidence-backed workflow is recommended, optional, not worth it, dangerous, or still insufficient. Status: ✅ accepted after review-fix.
5. `W6-G` closed as readiness/risk only because W6-F is `optional` with `low` confidence and preserved caveats. Status: ✅ accepted as `do_not_implement_now`.

### Sprint W6-S2 — Execution Steps

**✅ Step 1 — broaden evidence before bridge work**

| Order | Actor | Status | Task | Input | Output |
|---|---|---|---|---|---|
| 1 | Meta Coordinator | ✅ done | Select W6-E target and write capture brief | W6-D accepted and not negative | `docs/private/Wave6-W6-S2-Meta-W6-E-Capture-Brief.md` |
| 2 | Track E | ✅ done | Assemble recorder input, run W6-C capture, inspect private outputs, and return recommendation | W6-E capture brief | Private loop outputs under `data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/` plus `continue` handoff recommendation |
| 3 | Meta Coordinator | ✅ done | Step-review W6-E result and decide whether W6-F may start | Track E W6-E handoff | W6-E accepted with warnings; W6-F may start |

**✅ Step 2 — evaluate usefulness before transport automation**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ W6-F | W6-D ✅ + W6-E ✅ | Accepted after review-fix; result is `optional` / `low` confidence / FAL-only and supports at most a narrow W6-G readiness brief |

**✅ Step 3 — bridge readiness only after value is shown**

| Responsible actor | Epic(s) | Prereq | Output / gate |
|---|---|---|---|
| Track D readiness draft -> Track B packet/state/ledger support -> Meta Coordinator closeout | ✅ W6-G | W6-F accepted with `optional` / `low` confidence caveats | `docs/private/Wave6-W6-S2-TrackD-W6-G-OpenCode-Bridge-Readiness-Brief-v1.md` + `docs/private/Wave6-W6-S2-Meta-W6-G-Step-Review-Closeout.md`; final decision `do_not_implement_now`; no OpenCode API/session delivery implementation opened |

#### Sprint W6-S3 — External target readiness and trial

Status:
- ✅ required W6-S3 rows are complete after W6-J no-release acceptance
- WorldSim remained the accepted W6-H/W6-I Candidate A docs-only target

Epics:
- ✅ **W6-H** target repo readiness brief — **Execution assignment: Meta Coordinator -> Track E readiness review -> Meta acceptance**; accepted as `READY_WITH_GUARDRAILS` for WorldSim in `docs/private/Wave6-W6-S3-Meta-W6-H-Step-Review-Closeout.md`
- ✅ **W6-I** external target repo trial — **Execution assignment: selected WorldSim docs-only loop owner -> Meta review -> Track E evidence review -> Meta acceptance**; accepted with warnings in `docs/private/Wave6-W6-S3-Meta-W6-I-Step-Review-Closeout.md`
- ✅ **W6-J** sanitized case-study / release review — **Execution assignment: Meta draft -> Track E public-safety review -> Meta acceptance -> Track A only if presentation work is explicitly opened**; accepted as `no_public_release_now` with Track E `APPROVE_NO_RELEASE` / `privacy_verdict: PASS`
- ✅ **Wave 6 closeout usefulness synthesis** — **Execution assignment: Meta draft -> Track E usefulness/evidence sufficiency review -> Meta acceptance**; accepted as `narrow_continue` in `docs/private/Wave6-Post-Closeout-Usefulness-Synthesis-v01.md` with `confidence: medium_low`

Sequential ordering:
1. `W6-H` runs sequentially: Meta selects/requests candidate repo context and drafts/owns the target readiness brief -> Track E reviews evidence/privacy/readiness -> Meta accepts or rejects W6-H. Status: ✅ accepted as `READY_WITH_GUARDRAILS`.
2. `W6-I` runs only after Meta accepts `W6-H`; assigned implementation/review tracks are named by the accepted W6-H brief. Status: ✅ accepted with warnings as Combined-only canonical verification.
3. `W6-J` runs only after W6-I evidence or blocker exists; Meta drafts the release/no-release decision -> Track E reviews public-safety/evidence boundaries -> Meta accepts or rejects, with Track A only if presentation work is explicitly opened. Status: ✅ accepted as `no_public_release_now`.

### Sprint W6-S3 — Execution Steps

**✅ Step 1 — target readiness before external execution**

| Responsible actor sequence | Epic(s) | Prereq | Required output / gate | Next allowed handoff |
|---|---|---|---|---|
| Meta Coordinator draft -> Track E readiness review -> Meta acceptance | ✅ W6-H | W6-G ✅ closeout + W6-F accepted | Target readiness brief with repo location, architecture summary, active workflow need, safe first sequence item, expected evidence, privacy boundaries, non-goals, and verdict: `READY_WITH_GUARDRAILS` for WorldSim Candidate A | W6-I opens only on the accepted docs-only WorldSim loop |

**✅ Step 2 — run one external trial only after target brief acceptance**

| Responsible actor sequence | Epic(s) | Prereq | Required output / gate | Next allowed handoff |
|---|---|---|---|---|
| selected WorldSim docs-only loop owner -> Meta review -> Track E evidence review -> Meta acceptance | ✅ W6-I | W6-H ✅ only | Captured one external target docs-only loop and accepted with warnings as Combined-only canonical verification; private evidence loop `w6i-worldsim-docs-only-20260528`; no runtime/refinery/live/private-state spillover | W6-J opens as public-safety / no-release decision |

**✅ Step 3 — sanitize or explicitly decline public output**

| Responsible actor sequence | Epic(s) | Prereq | Required output / gate | Next allowed handoff |
|---|---|---|---|---|
| Meta Coordinator draft -> Track E public-safety review -> Meta acceptance -> Track A only if presentation is explicitly opened | ✅ W6-J accepted no-release | W6-I evidence or blocker | Explicit no-release decision: raw private evidence, prompts, findings, gate heuristics, target-repo details, W6-I prompt package, public mirror, `docs/public/` output, and Track A presentation all remain closed | Wave 6 closeout or post-Wave-6 usefulness synthesis gate |

### W6-A — Packet and ledger contract

Goal:
- define the thinnest packet and ledger contract for manual/semi-manual evidence capture.

Required output:
- packet envelope contract
- loop identity rules
- proposed private artifact paths
- validation defaults
- invalid-packet behavior
- handoff to Track E for evidence-field semantics

Scope remains limited to the real Meta/Track loop:

- `plan_ready_for_meta_review`
- `meta_plan_review_done`
- `plan_review_acknowledged`
- `implementation_done`
- `step_review_done`
- `step_review_acknowledged`
- `review_fix_done`

Decisions remain limited to:

- `greenlit`
- `changes_requested`
- `blocked`
- `pass`
- `fix_required`
- `hold`
- `deep_review_needed`

Required boundaries:

- no direct OpenCode storage mutation
- no hidden background autonomy
- no auto-commit
- no auto-push
- no launch/reminder/UI packet expansion in MVP
- all packets must be structured and validated before recording

### W6-B — Packet State Machine

Goal:
- model the Meta/Track workflow as explicit, auditable state transitions.

Required behavior:

- require explicit `greenlit` before implementation
- stop on `blocked`
- stop or require approval on high-risk transitions
- require `pass` or `hold` before commit-readiness
- record every transition as a traceable decision
- treat `deep_review_needed` as an extension route, not the default path

### W6-C — Manual Evidence Recorder MVP

Goal:
- record useful workflow evidence, not just messages.

For each loop, capture:

- originating Track
- Meta reviewer session
- sequence item
- plan summary
- review verdict
- implementation summary
- changed files
- tests/checks run
- missing tests
- review findings
- whether findings were accepted or rejected
- whether fixes were required
- whether the Meta gate was correct in hindsight
- manual intervention count
- copy-paste avoided count
- final status: `pass`, `pass_with_warnings`, `hold`, or `blocked`

Privacy rule:

- raw workflow evidence, prompt heuristics, failure corpora, and gate-quality notes remain private by default
- public output, if any, is sanitized and partial

### W6-D — First Real Loop Capture And Seed Usefulness Row

Goal:
- prove the manual ledger can capture one real FAL Meta/Track loop without becoming workflow theater.

Required output:
- one structured private loop ledger
- one usefulness seed row
- explicit verdict: continue, narrow, stop, or insufficient data

### W6-E / W6-F — Usefulness Expansion And Eval

Goal:
- prove whether the workflow earns its complexity.

Compare:

- manual OpenCode workflow
- command-assisted OpenCode workflow
- packet-assisted OpenCode server workflow
- FAL evidence-backed workflow

Metrics:

- manual copy-paste steps reduced
- total loop friction
- real issues caught by review
- false-positive findings
- avoidable rework cycles
- plan adherence
- test sufficiency
- scope drift
- gate correctness
- time-to-greenlit
- time-to-pass
- operator interruptions required

Expected output:

- where FAL genuinely helps
- where OpenCode alone is enough
- where automation is dangerous
- where more policy is not worth it

### W6-G — OpenCode Bridge Readiness Brief

Goal:
- decide whether OpenCode bridge/API work is justified after ledger evidence exists.

Status:
- ✅ accepted as readiness/risk closeout in `docs/private/Wave6-W6-S2-Meta-W6-G-Step-Review-Closeout.md`
- final recommendation: `do_not_implement_now`
- no bridge/API/session delivery implementation is opened

Required output:
- OpenCode integration assumptions
- storage/session mutation risk review
- delivery-vs-capture distinction
- bridge implementation recommendation or rejection

Boundary:
- `W6-G` is a readiness brief, not permission to implement bridge delivery.

### W6-H / W6-I — Target Repo Readiness And Trial

Goal:
- prove the workflow outside Fractal Agent Lab.

Default candidate:
- WorldSim, only after a target-brief/readiness check.

Required target brief:

- repo location
- current architecture summary
- active workflow need
- safe first sequence item
- expected evidence
- boundaries and non-goals

Execution ownership:
- `W6-H`: Meta Coordinator drafts/owns target selection and readiness brief -> Track E reviews evidence/privacy/readiness and may return `READY`, `READY_WITH_GUARDRAILS`, `NOT_READY`, or `BLOCKED` input -> Meta accepts or rejects
- `W6-I`: only the accepted W6-H brief may assign implementation/review Track roles -> Meta reviews external trial evidence -> Track E reviews evidence sufficiency/privacy -> Meta accepts or rejects
- `W6-J`: Meta drafts public-safety/release decision -> Track E reviews evidence/privacy boundaries -> Meta accepts or rejects; Track A participates only if presentation work is explicitly opened

Fallback:
- if WorldSim is unavailable or not ready, choose another suitable target repo instead of falling back to FAL-only validation.

### Wave 6 gate to close the wave

Status:
- ✅ accepted as `narrow_continue` after Track E usefulness/evidence sufficiency review
- closeout artifact: `docs/private/Wave6-Post-Closeout-Usefulness-Synthesis-v01.md`
- Track E result: `APPROVE_NARROW_CONTINUE`, `confidence: medium_low`, `wave6_5_allowed: true`

Wave 6 can close only if:

- at least one real Meta/Track loop is captured as structured evidence
- the packet state machine prevents false-green transitions
- usefulness evaluation distinguishes real value from extra meta-work
- private evidence remains private
- sanitized external-target evidence exists or a clear blocker is documented
- FAL is demonstrably acting as the evidence/control layer above OpenCode, not competing with OpenCode execution features

### Conditional post-Wave-6 strategy — RingFall adoption, evidence learning, and HUB compatibility

Status:
- ✅ W6.5 readiness/adoption planning package accepted with notes after Wave 6 closeout accepted `narrow_continue`; RingFall Safe Slice 1 repo skeleton readiness review and in-place skeleton commit are complete
- ✅ W6.5 closeout accepted in `docs/private/Wave6_5-Ringfall-Adoption-Readiness-Closeout-v01.md`
- 🔄 Wave 7 now opens as the OpenCode-backed evidence learning layer planning/contract frontier; the former HUB compatibility Wave 7 is deferred to Wave 8 or later
- strategy decision anchor: `docs/private/Wave6-Post-Closeout-Ringfall-HUB-Strategy-v01.md`

Verdicts:
- Wave 6.5 is accepted and closed as a conditional post-Wave-6 adoption/readiness slice
- Wave 7 is promoted to the OpenCode-backed evidence learning layer because live WorldSim/OpenCode/router usage showed ingest/normalization/learning should precede HUB compatibility
- The former HUB compatibility Wave 7 is deferred to Wave 8 or later as docs-first external control-surface contract work

Important sequencing correction:
- Ringfall does not replace the accepted W6-I WorldSim trial unless W6-I is blocked by a later explicit Meta decision
- WorldSim remains the first W6 external trial target under W6-H/W6-I guardrails
- Ringfall becomes the first serious post-Wave-6 adoption/readiness target if Wave 6 usefulness is not negative
- the HUB remains a separate future cross-project command center, not a FAL feature

#### Wave 6.5 — RingFall Adoption And External Project Readiness Pack

Activation gate:
- ✅ W6-I external evidence exists as `accepted_with_warnings` / Combined-only external docs-only evidence
- ✅ W6-J public-safety/no-release decision is complete as `accepted_no_release`
- ✅ Wave 6 closeout usefulness synthesis accepts `narrow_continue` and does not recommend stopping the external-project direction
- W6.5 execution remains limited to readiness/adoption planning; RingFall implementation remains blocked until later explicit Meta acceptance

Planned deliverables:
- ✅ `docs/private/Wave6-Post-Closeout-Usefulness-Synthesis-v01.md`
- ✅ `docs/private/FAL-External-Project-Usage-Runbook-v01.md` accepted for readiness/adoption planning
- ✅ `docs/private/External-Project-Packet-Fields-v01.md` accepted as planning-sidecar guidance; later Track B compatibility review still required before schema law
- ✅ `docs/private/Ringfall-Target-Readiness-Brief-v01.md` accepted with notes
- ✅ `docs/private/Ringfall-Safe-Slice-1-Repo-Skeleton-Readiness-Review-v01.md` completed with `repo_skeleton_planning: READY_WITH_GUARDRAILS` and `implementation_execution: NOT_READY`
- ✅ RingFall target-local private runbook: `C:\EGYETEM\FUNSTUFF\RingFall\.fal\FAL-Target-Project-Local-Runbook-v01.md`
- ✅ RingFall public-safe in-place git/docs skeleton commit pushed as `08732d5 init`; GitHub `origin/main` is `08732d5`
- ✅ `docs/private/Wave6_5-Ringfall-Adoption-Readiness-Closeout-v01.md` accepted as W6.5 closeout

W6.5 closeout result:
- ✅ **accepted_closeout**; owner decision is resolved, RingFall public-safe skeleton is committed and pushed as `08732d5 init`, GitHub remote exists at `https://github.com/terekzoltan/RingFall.git`, and RingFall feature implementation remains blocked

Next RingFall-side gates, if reopened later:
- Combined/wave-plan consistency review
- risk gate mapping into FAL policy
- explicit readiness brief before implementation planning or execution

Non-goals:
- no HUB implementation
- no dashboard work
- no automatic OpenCode session mutation
- no commit/push automation
- no autonomous swarm
- no public release of private learning-loop evidence

#### Wave 7 — OpenCode-Backed Evidence Learning Layer

Activation gate:
- Wave 6 and W6.5 are closed without authorizing bridge/API/session delivery
- live WorldSim/OpenCode/router usage shows the practical gap is evidence ingest, normalization, replay, learning, and browseability rather than another planner
- the planning package is now renamed from Wave8/W8 to Wave7/W7
- W7 remains evidence-layer-first; it must not become controller mode, browser-side OpenCode control, automatic dispatch, commit/push automation, or raw transcript hoarding

Planned deliverables:
- ✅ draft package exists:
- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md`
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `docs/private/Wave7-W7-B-Router-Evidence-Ingest-CLI-v1.md`
- `docs/private/Wave7-W7-C-OpenCode-Backed-Workbench-Integration-v1.md`
- `docs/private/Wave7-W7-D-OpenCode-Learning-State-And-Suggestions-v1.md`
- ✅ `docs/private/Wave7-W7-A-META1-Contract-Adoption-Review-v1.md` returns `READY_WITH_GUARDRAILS` for Track B `W7-A-B`

Track ownership model:

| Track | Wave 7 role | First allowed posture |
|---|---|---|
| Meta Coordinator | sequencing, scope lock, contract acceptance, closeout, no-claim boundary | lead W7-A review before any code |
| Track B | canonical run/trace/artifact contract, validators, path-safe IDs, schema compatibility | contract compatibility first, then artifact writer support |
| Track D | router/OpenCode selected-output source adapter and local tool boundary | adapter/reader only; no OpenCode session control |
| Track E | evidence sufficiency, privacy retention, false-green prevention, usefulness gates | review/gate first, then validation harness support |
| Track A | CLI/workbench browse surfaces for accepted artifacts | deferred until ingest artifact shape is stable |
| Track C | project/global learning semantics and advisory suggestion language | learning-input review first; no identity-driven routing authority |

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W7-A OpenCode-backed loop contract acceptance | Meta -> Track B -> Track E -> Meta | Track C/Track A consulted only if needed | accepted or revised loop/run/trace/artifact contract | W6.5 closed |
| W7-B Router evidence ingest CLI thin slice | Track B + Track D, then Track A | Track E | local ingest command and canonical artifact writer for selected router/OpenCode outputs | W7-A accepted |
| W7-C Ingest validation and privacy gate | Track E | Track B, Track D | validation report, negative cases, privacy/retention sufficiency | W7-B artifact writer exists |
| W7-D Workbench support for OpenCode-backed loops | Track A | Track B, Track E | generated indexes and read-only browse/drill-down support | W7-C accepts artifact shape |
| W7-E Project-local/global learning input surfaces | Track C | Track E, Track B | project-memory/global-learning candidate extractors or contracts | W7-C accepts artifact shape |
| W7-F Wave 7 usefulness and closeout decision | Track E -> Meta | all tracks as evidence providers | usefulness verdict, next-frontier decision, W8 gate recommendation | W7-D and W7-E evidence exist |
| W7-G Advisory suggestion layer design | Track C + Track E | Meta | docs-only advisory suggestion policy, if earned | W7-F says suggestions are useful and safe |

### Wave 7 — Execution Steps

**✅ Step 1 — W7-A contract review and acceptance before implementation (serial gate)**

Parallelism rule: no parallel work inside W7-A. Meta appears twice because it opens and later closes the gate; those are separate sessions, not concurrent Meta work.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 1.1 | Meta Coordinator session | ✅ W7-A-META1 contract/adoption review | W6.5 ✅ | Returned `READY_WITH_GUARDRAILS` in `docs/private/Wave7-W7-A-META1-Contract-Adoption-Review-v1.md`; W7-B implementation remains blocked |
| 1.2 | Track B session | ✅ W7-A-B contract compatibility review | W7-A-META1 ✅ | Accepted with routed follow-up in `docs/private/Wave7-W7-A-B-Contract-Compatibility-Review-v1.md`; W7-A must resolve or explicitly route `output_payload.step_results` compatibility before final acceptance |
| 1.3 | Track E session | ✅ W7-A-E evidence/privacy review | W7-A-B ✅ | Accepted direction with required contract changes in `docs/private/Wave7-W7-A-E-Evidence-Privacy-Review-v1.md`; privacy, retention, public export, false-green, and `output_payload.step_results` fields must become validator-ready before W7-B |
| 1.4 | Meta Coordinator session | ✅ W7-A-META2 acceptance closeout | W7-A-B ✅ + W7-A-E ✅ | Accepted with contract revisions in `docs/private/Wave7-W7-A-META2-Acceptance-Closeout-v1.md`; W7-B planning may start, implementation still requires Track plans + Meta review + scope declaration |

**✅ Step 2 — W7-B/W7-C thin ingest implementation and validation**

Parallelism rule: only `2.1a` and `2.1b` may run in parallel, and only if their file scopes are disjoint. `2.2`, `2.3`, and `2.4` are sequential gates.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 2.1a | Track B session | ✅ W7-B1 canonical artifact writer and validators review-fix | W7-A accepted | Accepted after Meta mini-review. Fixed forbidden raw/reasoning rejection, `step_results[*].raw` whitelist, approved-checkpoint clean-pass requirement, packet ledger warning/invalid clean-pass blocking, concrete terminal trace artifact ref, and bool-as-int `excerpt_max_chars` rejection. |
| 2.1b | Track D session | ✅ W7-B2 router selected-output reader/adapter hardening | W7-A accepted | Accepted after Meta mini-review. Non-int and bool `excerpt_max_chars` now raise `OpenCodeRouterSourceError`; no session mutation or dispatch. |
| 2.2 | Track A session | ✅ W7-B3 ingest CLI UX surface | W7-B1 ✅ + W7-B2 ✅ | Accepted after Meta + Swarm step-review synthesis. Implements `ingest router-loop` preview/write wrapper over W7-B1 writer; no selected-output subcommand, router discovery, browser execution, OpenCode control, dispatch, commit automation, or schema churn. |
| 2.3 | Track E session | ✅ W7-C1 ingest validation/privacy sufficiency | W7-B1 ✅ + W7-B2 ✅ + W7-B3 ✅ | Accepted after Track B fixed `RF-2026-06-04-01` and Track E reran sufficiency. Privacy/false-green PASS; partial-write remains accepted LOW residual with downstream validation constraint. |
| 2.4 | Meta Coordinator session | ✅ W7-B/C closeout | W7-C1 ✅ | Accepted artifact shape as stable enough for W7-D workbench and W7-E1 learning-input consumers, provided downstream consumers rely on canonical acceptance validation rather than artifact directory presence. |

**✅ Step 3 — Browse and learning consumers after accepted ingest shape**

Parallelism rule: `3.1a` and `3.1b` may run in parallel only after W7-B/C closeout accepts the artifact shape. Track E validation remains sequential after Track C learning semantics.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 3.1a | Track A session | ✅ W7-D workbench/index support | W7-B/C closeout ✅ | Accepted and committed in `ca1167d`. Read-only loop browser rows, packet/order drill-down, selected output visibility, approval log visibility, and project filters are implemented with accepted-artifact sidecar validation; no W7-E1 consumption. |
| 3.1b | Track C session | ✅ W7-E1 project/global learning input semantics | W7-B/C closeout ✅ | Accepted and committed in `9d1ff9f`. Standalone learning-input helper separates repo-specific project memory from de-identified global lessons and fail-closes on invalid sidecar `schema_version` or mismatched `run_id`. |
| 3.2 | Track E session | ✅ W7-E2 learning/privacy validation | W7-E1 ✅ | Accepted with residual risk in `docs/private/Wave7-W7-E2-TrackE-Learning-Privacy-Validation-v1.md`. Validated de-identification, non-public defaults, memory candidate quality, no identity-driven routing authority, and preserved `track_e_validation_claim: false` on W7-E1 sidecar evidence. |

**✅ Step 4 — W7-G advisory suggestion policy accepted; W7.5 hardening opens next**

Parallelism rule: W7-F closeout is serial and accepted. W7-G starts sequentially: W7-G1 docs-only semantics first, then W7-G2 safety review. No suggestion implementation, automatic routing, dispatch, commit/push automation, OpenCode bridge/API/session delivery, browser control, or public export is authorized.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 4.1 | Track E session | ✅ W7-F usefulness evaluation | W7-D ✅ + W7-E2 ✅ | Accepted GREEN after strict review. Usefulness recommendation is `narrow_continue`; residual semantic non-leakage risk classified as `in-scope now`. W7-specific evaluator/tests are accepted; private report remains local-only unless explicitly force-added later. |
| 4.2 | Meta Coordinator session | ✅ W7-F-META closeout | W7-F ✅ | Closed with `narrow_continue`. W7-G is opened only for docs-only / review-planning work; implementation and automation remain blocked. Wave 8 HUB/docs-first compatibility remains parked unless separately opened by Meta. |
| 4.3 | Track C session | ✅ W7-G1 advisory suggestion semantics | W7-F-META ✅ | Accepted by Meta step-review after clean Swarm review. Docs-only/private suggestion semantics brief preserves no automatic routing, dispatch, commit/push automation, authoritative control, public export, bridge/API/session delivery, browser-side OpenCode control, schema, UI, or implementation authorization. |
| 4.4 | Track E session | ✅ W7-G2 advisory suggestion safety review | W7-G1 ✅ | Accepted by Meta step-review as `APPROVE_WITH_GUARDRAILS`. W7-G1 wording, false-authority risk, privacy, gate-honesty, confidence, and residual semantic non-leakage boundaries reviewed; implementation and automation remain blocked. |

Non-goals:
- no HUB implementation in FAL
- no UI/dashboard implementation by default
- no automatic dispatch, repo/session mutation, commit, or push
- no public export of private raw evidence or private learning-loop heuristics

#### Wave 7.5 — Measurement & Context Continuity Hardening

Activation gate:
- W7-G1 and W7-G2 accepted as docs-only advisory suggestion policy/safety review
- W7.5 starts before Wave 8/HUB unless Meta explicitly overrides after closeout
- first posture is measurement, testability, context hydration, and pilot planning; no OpenCode bridge/API/session delivery, automatic dispatch, commit/push automation, HUB implementation, or public evidence release is authorized
- canonical planning inputs are `docs/private/FAL_Post_Wave7_Workflow_Plan.md` and `docs/private/Wave7_5-Measurement-Continuity-Hardening-Plan-v1.md`

Planned deliverables:
- `docs/private/Wave7_5-Measurement-Continuity-Hardening-Plan-v1.md`
- `docs/private/Wave7-W7-G-Meta-Closeout-W7_5-Activation-v1.md`
- W7 targeted sanity/testability closeout notes
- `workflow_metrics.json` MVP support
- `review_findings_ledger.json` MVP support
- context hydration contract / `context_digest.json` / target `.fal/ACTIVE_CONTEXT.*` guidance
- learning candidate backlog design
- RingFall pilot protocol
- public-safe methodology/showcase prep only after privacy review
- later HUB compatibility revisit after evidence exists

Track ownership model:

| Track | Wave 7.5 role | First allowed posture |
|---|---|---|
| Meta Coordinator | activation/scope lock, compact-hydration policy, closeout | docs/planning and sequencing only |
| Track E | metrics, review findings ledger, evidence quality, pilot measurement | eval/support code only after W7.5-A sanity |
| Track B | sidecar/contract compatibility for metrics and context digest | contract review before schema law |
| Track C | learning candidate semantics and safe improvement lifecycle | no automatic prompt rewrite/routing |
| Track A | public-safe/readability support only if explicitly opened | no UI/dashboard by default |
| Track D | router/tool evidence compatibility only if explicitly needed | no OpenCode session control |

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W7.5-A Repo/test sanity closeout | Track E | Meta; Track B/D only if blocker found | targeted W7 testability and import sanity result | W7-G accepted |
| W7.5-B Workflow metrics MVP | Track E | Track B | `workflow_metrics.json` MVP | W7.5-A accepted |
| W7.5-C Review findings ledger | Track E | Meta | `review_findings_ledger.json` MVP and human-label fields | W7.5-B accepted or explicit parallel-safe exception |
| W7.5-D Context hydration contract | Meta | Track B/C/E through explicitly sequenced follow-up rows | `context_digest.json` and `.fal/ACTIVE_CONTEXT.*` policy | W7.5-A accepted |
| W7.5-E Learning candidate backlog | Track C | Track E + Meta | controlled self-improvement queue lifecycle | W7.5-B/C draft evidence |
| W7.5-F RingFall pilot protocol | Meta | Track E + target project | 5-task measurement pilot protocol | W7.5-B/D accepted |
| W7.5-G Public-safe methodology/showcase prep | Meta | Track E; Track A optional only if opened | sanitized methodology candidates | W7.5-F evidence + public-safety review |
| W7.5-H HUB compatibility revisit | Meta | Track B/E/C optional | decide whether Wave 8 starts or remains parked | W7.5 closeout |

### Wave 7.5 — Execution Steps

**✅ Step 1 — W7-G closeout and W7.5 activation/scope lock**

Parallelism rule: no parallel implementation before W7.5-A. Meta first confirms W7-G closeout and W7.5 scope; then Track E can run targeted sanity/testability review in the next step.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 1.1 | Meta Coordinator session | ✅ W7-G closeout + W7.5 activation/scope lock | W7-G2 ✅ | Accepted W7-G docs-only evidence, adopted W7.5 measurement/context-continuity as the next frontier, and kept HUB, public export, OpenCode bridge/API/session delivery, RingFall feature execution, automation, dispatch, and commit/push automation blocked. |

**✅ Step 2 — W7.5-A repo/test sanity closeout**

Parallelism rule: no parallel work. This step proves the real repo can run targeted W7 tests before new metrics or context surfaces are opened.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 2.1 | Track E session | ✅ W7.5-A repo/test sanity closeout | W7.5 scope ✅ | Accepted by Meta step-review after clean Swarm review. Import sanity PASS, targeted W7 test batch PASS (`70 tests`), supplemental `compileall` PASS without full-repo-health claim, and README/public drift routed as follow-up rather than release work. |

**✅ Step 3 — Measurement and review-quality surfaces**

Parallelism rule: one Track E session owns the measurement batch. Do W7.5-B first, then W7.5-C in the same session unless Meta later splits the work.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 3.1 | Track E session | ✅ W7.5-B workflow metrics MVP, then W7.5-C review findings ledger | W7.5-A ✅ | Accepted after Meta step-review and review-fix. Added direct-import `workflow_metrics.json` and `review_findings_ledger.json` sidecar surfaces with W7 sidecar validation, no-overwrite policy, no fake quality score, no raw transcript/body retention, and path-safe `run_id` validation. |

**✅ Step 4 — Context hydration policy**

Parallelism rule: no parallel work. Meta defines hydration policy before Track B/C consume it.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 4.1 | Meta Coordinator session | ✅ W7.5-D context hydration policy lock | W7.5-A ✅, W7.5-B/C ✅ | Accepted policy artifact: `docs/private/Wave7_5-W7_5_D-Meta-Context-Hydration-Policy-Lock-v1.md`. Locks L0/L1/L2/L3 hydration, hot/warm/cold/frozen context policy, `context_digest.json` sidecar intent, and `.fal/ACTIVE_CONTEXT.*` restore rules; private docs are not bulk-loaded by default after compact. |

**✅ Step 5 — Parallel-safe contract and learning backlog work**

Parallelism rule: Track B and Track C may run in parallel only after W7.5-D policy lock and W7.5-B/C measurement fields are stable enough, and only if file scopes are disjoint.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 5.1a | Track B session | ✅ W7.5-D context digest contract support | W7.5-D policy ✅ + W7.5-B/C ✅ | Added Track B-owned direct-import `context_digest.json` contract builder/writer under `core/contracts`, with path-safe `run_id`, no-overwrite writes, deterministic JSON, privacy/claim fields, and no broad runtime, OpenCode control, bridge/API/session delivery, routing, dispatch, commit/push automation, or public export. |
| 5.1b | Track C session | ✅ W7.5-E learning candidate backlog semantics | W7.5-B/C ✅ | Added controlled local/private learning-candidate backlog semantics under `memory/**`, including lifecycle, owner-decision, confidence, validation, merge, store path-safety, and non-execution invariants; no automatic prompt rewrite, routing, commit/push, or public export. |

**✅ Step 6 — RingFall pilot protocol and measured pilot execution**

Parallelism rule: no parallel work. Meta defines pilot scope before Track E validates measurement sufficiency.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 6.1 | Meta Coordinator session | ✅ W7.5-F RingFall pilot protocol draft | W7.5-B/C ✅ + W7.5-D policy ✅ | Drafted `docs/private/Ringfall-FAL-Pilot-Protocol-v01.md`: five measured readiness/planning tasks, capture template, sidecar/label/context expectations, and target-project boundaries; no large RingFall feature push before pilot readiness. |
| 6.2 | Track E session | ✅ W7.5-F measurement sufficiency review | W7.5-F protocol draft ✅ | Returned YELLOW with accepted fixes; Meta tightened required sidecar fail-loud handling, auditable learning-candidate refs, and pilot hydration override against bulk target-doc loading. |
| 6.3 | Meta Coordinator session | ✅ W7.5-F P1 current RingFall state refresh | W7.5-F protocol + Track E review fixes ✅ | Completed read-only P1 capture in `docs/private/Ringfall-FAL-Pilot-P1-Current-State-Refresh-v01.md`; generated local/private sidecars under `data/artifacts/w75f-p1-ringfall-state-refresh-20260612/`; RingFall status stayed clean and target mutation count stayed 0. |
| 6.4 | Meta Coordinator session | ✅ W7.5-F P2 Combined vs wave-plan consistency review | W7.5-F P1 ✅ | Completed read-only P2 capture in `docs/private/Ringfall-FAL-Pilot-P2-Combined-vs-Wave-Plan-Consistency-Review-v01.md`; plans align on Wave 0-11 and guardrails, with one true-positive status-sync gap: actual RingFall skeleton commit `08732d5` exists while planning status still reads pre-implementation. No target doc rewrite occurred. |
| 6.5 | Meta Coordinator session | ✅ W7.5-F P3 risk-gate mapping review | W7.5-F P2 ✅ | Completed read-only P3 capture in `docs/private/Ringfall-FAL-Pilot-P3-Risk-Gate-Mapping-Review-v01.md`; mapped G1-G10 and automatic holds into FAL pilot gate language without weakening direct-mutation, hidden-truth, replay/eval, or FAL-dependency holds. One true-positive source-doc issue remains: executive G1-G10 does not match detailed G1-G9 guardrail headings. |
| 6.6 | Meta Coordinator session | ✅ W7.5-F P4 implementation-readiness brief draft | W7.5-F P3 ✅ | Completed read-only P4 capture in `docs/private/Ringfall-FAL-Pilot-P4-Implementation-Readiness-Brief-v01.md`; defined evidence still needed before RingFall Wave 1 planning/execution and explicitly did not approve implementation. RingFall remains not ready for Wave 1 planning/execution until P5 plus separate target-doc/status-sync or Wave 0 closeout. |
| 6.7 | Meta Coordinator session | ✅ W7.5-F P5 pilot synthesis and learning candidate review | W7.5-F P1-P4 evidence ✅ | Completed read-only P5 capture in `docs/private/Ringfall-FAL-Pilot-P5-Synthesis-and-Learning-Candidate-Review-v01.md`; P1-P4 sidecars complete, target mutation count 0, context digests restored, 2 true-positive findings, 2 proposed doc-cleanup candidates. Recommendation: `narrow`; no RingFall implementation or public output approval. |

**✅ Step 7 — Public-safe methodology prep**

Parallelism rule: no parallel work. Public-facing artifacts require Track E safety review before any release or mirror action.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 7.1 | Meta Coordinator session | ✅ W7.5-G public-safe methodology candidate scope | W7.5-F evidence ✅ | Private candidate scope captured in `docs/private/Wave7_5-W7_5_G-Public-Safe-Methodology-Candidate-Scope-v1.md`; no raw selected outputs, private paths, prompt/gate moat, RingFall strategy, `docs/public/**`, mirror, release, implementation approval, or public methodology/showcase output was created. P5 `narrow` is carried forward. |
| 7.2 | Track E session | ✅ W7.5-G public-safety review | W7.5-G candidate scope ✅ | Review accepted GREEN in `docs/private/Wave7_5-W7_5_G-TrackE-Public-Safety-Review-v1.md`. The private candidate scope is safe as a private planning artifact, but this does not authorize `docs/public/**`, public release, mirror, Track A presentation, HUB, bridge/API/session delivery, routing, dispatch, or commit/push automation. A concrete sanitized public package still needs its own Track E review before publication. |

**✅ Step 8 — HUB compatibility revisit**

Parallelism rule: no parallel work. HUB remains parked unless Meta explicitly opens a docs/contract-first compatibility step.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 8.1 | Meta Coordinator session | ✅ W7.5-H HUB compatibility revisit | W7.5-G ✅ | Accepted in `docs/private/Wave7_5-W7_5_H-HUB-Compatibility-Revisit-v1.md`. Wave 8/HUB implementation remains parked; future HUB compatibility is narrowed to docs/contract backlog for HUB-0 read-only evidence consumption and HUB-1 next-action preview only. After RingFall Wave 1 post-analysis, the next active FAL frontier is W7.6 target-orchestrator seamless integration, not HUB or RingFall feature implementation. |

Non-goals:
- no OpenCode bridge/API/session delivery
- no automatic routing, dispatch, commit, push, or workflow triggering
- no HUB implementation before W7.5 closeout
- no broad RingFall feature execution before pilot/readiness acceptance
- no public export without dedicated Track E/public-safety review
- no claim that semantic non-leakage is proven

#### Wave 7.6 — Target Orchestrator Seamless Integration

Activation gate:
- W7.5-H HUB compatibility revisit is accepted and HUB implementation remains parked
- RingFall Wave 1 post-analysis showed that FAL governance discipline helped, but FAL checkpoint/context/finding capture was not seamless
- this wave is workflow-hardening for target-project orchestration, not RingFall feature execution
- no OpenCode bridge/API/session delivery, automatic dispatch, automatic commit/push, public export, HUB implementation, or RingFall Wave 2 execution is authorized by this wave

Canonical planning input:
- `docs/private/FAL-Target-Orchestrator-Seamless-Integration-Plan-v01.md`
- `docs/private/Wave7_6-Session-Continuity-Compact-Authority-PRD-v1.md`
- `docs/private/FAL_external_advisory_handoff_2026-06-23.md` as recommendation-only input; it does not change authority or open scope

Planned deliverables:
- P0 Meta design freeze and Combined sequencing integration
- session continuity and compact authority PRD input for P1
- P1 `/fal-checkpoint-target` command and `fal-target-orchestration` skill PRD through `oc-toolsmith`
- target profile / active-context / checkpoint / findings / metrics row contracts sufficient for P1
- compact-readiness, context-delta, handoff sufficiency, and advisory usage telemetry requirements for P1
- minimal negative-control and bounded stop/escalation requirements for P1 review
- workflow-integrated cadence rules for always, boundary, conditional, validation, and audit checks
- explicit compact-boundary handling that does not rely on implicit compact-event detection
- read-only RingFall Wave 1 backfill validation after P1 exists
- cold-start recovery drill as part of backfill/usefulness validation
- existing workflow hook policy for `seq-next -> terv-review -> implement -> step-review -> review-fix`
- later parallel reconcile hardening before full orchestrator command
- finding-to-regression lineage as a W7.6-P9 read-only audit dimension, not a new database
- full `/fal-orchestrate-target` command only after P1-P3 evidence proves the smaller slices
- productized Easy/Guided/Strict/Audit UX and external advisory intake design are parked for Wave 7.7, not implemented in W7.6

Track ownership model:

| Track | Wave 7.6 role | First allowed posture |
|---|---|---|
| Meta Coordinator | P0 design freeze, sequencing, P1 PRD, acceptance, closeout | planning/review only; may use `oc-toolsmith` workflow for global command/skill design |
| Track B | target profile, active context, checkpoint row contract review | schema/contract review before tooling treats fields as law |
| Track C | review-finding, routing, context-delta, and handoff semantics | semantics/review only; no automatic prompt rewrite/routing |
| Track D | router/tooling compatibility, artifact pinning, latest-output classifier, PowerShell wrapper implications, advisory token/cost usage feasibility, bounded stop/resume feasibility | tooling plan/implementation only after P1 PRD acceptance; no OpenCode server control or automatic compaction |
| Track E | evidence sufficiency, metrics/finding ledger validation, negative controls, cold-start recovery drill, RingFall W1 backfill audit | measurement/QA; no public output |
| Track A | product UX implications review only | no W7.6 UI/UX implementation; later Easy/Guided/Strict/Audit mode design is parked for Wave 7.7 |

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W7.6-P0 Target-orchestrator design freeze and sequencing | Meta | none | P0 closeout in plan doc plus Combined integration | W7.5-H ✅ + user approval |
| W7.6-P1 Checkpoint closeout command/skill PRD | Meta using `oc-toolsmith` | Track A/B/C/D/E review | `/fal-checkpoint-target` + `fal-target-orchestration` PRD and reviewable global command/skill patch plan consuming the W7.6 compact/session authority PRD plus deduplicated advisory-derived checks and cadence rules | W7.6-P0 ✅; draft produced |
| W7.6-P2 P1 contract/semantics/tooling/evidence review | Meta synthesis | Track A/B/C/D/E review lanes | completed review: Track A/D `GREEN`, Track B/C/E `YELLOW/revise`, no `RED`; required narrow revision bundle identified for authority read order, target profile/active-context field law, verdict separation, finding status, and metrics row/status | W7.6-P1 PRD draft |
| W7.6-P3 P1 implementation/apply decision | Meta | `oc-toolsmith`, Track A/B/C/D/E as reviewers | P3 decision `revise`; revision bundle applied to the PRD and backup-first apply script; global apply still requires explicit user approval and verification | W7.6-P1 + W7.6-P2 reviews |
| W7.6-P4 RingFall Wave 1 read-only backfill validation | Track E | Meta, Track B/C if schema/finding ambiguity appears | accepted read-only backfill validation: checkpoint reconstruction proved, stale active-context / missing aggregate evidence surfaced as reconcile debt, explicit cold-start recovery drill still open | W7.6-P3 accepted plus global P1 command/skill applied and verified |
| W7.6-P5 Existing workflow hook integration plan | Meta | Track D, Track E | accepted hook plan in `docs/private/Wave7_6-W7_6_P5-Existing-Workflow-Hook-Integration-Plan-v1.md`; defines existing workflow hook stages, clean-closeout gates, fail-closed/reconcile-debt behavior, and runbook policy update while preserving P4 recovery-drill debt | W7.6-P4 evidence |
| W7.6-P6 Router/tooling artifact-pinning hardening | Track D | Track E, Meta | accepted after no-Swarm three-lane Meta step review and targeted review-fix; serial helper path now has pinned-source preflight, dry-run/propose default, explicit apply gate, source classifier hardening, and `review_fix_done` separation; local ignored tooling remains operational state, not normal versioned commit content | W7.6-P5 accepted |
| W7.6-P7 Parallel reconcile hardening | Track D | Track E, Track B/C as needed | parallel run reconcile support and lane-level evidence rules, plus required runbook update if shared workflow semantics change | W7.6-P6 accepted |
| W7.6-P8 Full orchestrator command readiness decision | Meta | all relevant tracks | decision `HOLD_FULL_COMMAND_WITH_NARROW_NEXT`: do not build full `/fal-orchestrate-target` now; proceed to P9 audit design / later W7.8 mechanical gates before revisiting | W7.6-P1-P7 evidence |
| W7.6-P9 Wave-level usefulness audit | Track E | Meta | accepted usefulness audit design in `docs/private/Wave7_6-W7_6_P9-Wave-Level-Usefulness-Audit-Design-v1.md`; defines future target-wave audit metrics, cold-start recovery drill protocol, negative controls, handoff sufficiency audit, and candidate finding-to-regression lineage sample format; design/protocol only, not recovery proof, not a new database, and not target implementation | W7.6-P8 decision plus W7.6-P4 evidence |

### Wave 7.6 — Execution Steps

**✅ Step 1 — P0 Meta design freeze and sequencing integration**

Parallelism rule: no parallel work. Meta closes the design baseline before any command/skill or Track implementation starts.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 1.1 | Meta Coordinator session | ✅ W7.6-P0 target-orchestrator design freeze and Combined integration | W7.5-H ✅ + user approval | `docs/private/FAL-Target-Orchestrator-Seamless-Integration-Plan-v01.md` is frozen for P1. Final P0 decisions: skill `fal-target-orchestration`, first command `/fal-checkpoint-target`, later command `/fal-orchestrate-target`, FAL aggregate evidence under `data/artifacts/target-projects/<project_id>/`, target `.fal/ACTIVE_CONTEXT.json` as FAL mirror machine state only, and P1 before full-loop automation. |

**✅ Step 2 — Session continuity PRD plus P1 checkpoint command/skill PRD through `oc-toolsmith`**

Parallelism rule: no parallel Track implementation until the session-continuity PRD input exists and the `oc-toolsmith` PRD/patch plan exists. Meta uses `oc-toolsmith`; no direct global command/skill edits.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 2.1 | Meta Coordinator session | ✅ W7.6 compact/session authority PRD input | W7.6-P0 ✅ | `docs/private/Wave7_6-Session-Continuity-Compact-Authority-PRD-v1.md` created as required P1 input. It defines compact as cache, not canon; pre/post compact boundaries; context delta; handoff sufficiency; cold-start recovery drill; advisory usage snapshot; minimal negative controls; bounded stop/escalation; workflow-integrated cadence; compact-detection limitation; and W7.7 product/advisory UX parking. |
| 2.2 | Meta Coordinator session using `oc-toolsmith` | ✅ W7.6-P1 `/fal-checkpoint-target` + `fal-target-orchestration` PRD draft | Step 2.1 ✅ | Produced `docs/private/Wave7_6-W7_6_P1-FAL-Checkpoint-Target-Command-Skill-PRD-v1.md` and reviewable script `ops/temp/apply-w7-6-p1-fal-target-orchestration.ps1`. No global command/skill file was modified or applied. |

**✅ Step 3 — Parallel authority/contract/tooling/evidence review of P1**

Parallelism rule: Track A, Track B, Track C, Track D, and Track E may review the same P1 PRD/patch plan in parallel because their ownership is disjoint: product-UX compatibility, schema/state, semantics/memory, tooling feasibility, and evidence/metrics. This is review-only; no Track implementation opens here.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 3.1a | Track A agent session | ✅ W7.6-P2 product-UX compatibility review | W7.6-P1 draft | Track A `GREEN` in `.opencode-router/parallel-runs/w76-p2-track-review-20260623-live/11-track-a-output.md`; no UX implementation or W7.7 product mode scope opened. |
| 3.1b | Track B agent session | ✅ W7.6-P2 schema/state contract review | W7.6-P1 draft | Track B `YELLOW/revise` in `.opencode-router/parallel-runs/w76-p2-track-review-20260623-live/12-track-b-output.md`; required fixes were authority read order and `fal.target_profile.v1` / `fal.active_context.v1` field law. |
| 3.1c | Track C agent session | ✅ W7.6-P2 finding/routing/session semantics review | W7.6-P1 draft | Track C `YELLOW/revise` in `.opencode-router/parallel-runs/w76-p2-track-review-20260623-live/13-track-c-output.md`; required fixes were workflow/domain/routing verdict separation and finding-status semantics. |
| 3.1d | Track D agent session | ✅ W7.6-P2 tooling/session telemetry feasibility review | W7.6-P1 draft | Track D `GREEN` in authoritative artifact `.opencode-router/parallel-runs/w76-p2-track-review-20260623-live/14b-track-d-output.md`; superseded `14-track-d-output.md` is ignored. |
| 3.1e | Track E agent session | ✅ W7.6-P2 evidence/metrics sufficiency review | W7.6-P1 draft | Track E `YELLOW/revise` in `.opencode-router/parallel-runs/w76-p2-track-review-20260623-live/15-track-e-output.md`; required fix was minimum metrics row/status behavior or explicit reconcile-debt fallback. |

**✅ Step 4 — P1 apply/hold decision**

Parallelism rule: no parallel work. Meta must synthesize Track reviews before any global command/skill apply script is accepted.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 4.1 | Meta Coordinator session | ✅ W7.6-P3 P1 implementation/apply decision | W7.6-P1 draft + W7.6-P2 reviews | P3 decision was `revise`, not `hold`. The required revision bundle was applied to `docs/private/Wave7_6-W7_6_P1-FAL-Checkpoint-Target-Command-Skill-PRD-v1.md` and `ops/temp/apply-w7-6-p1-fal-target-orchestration.ps1`: target authority read order, profile/active-context field law, workflow/domain/routing verdict separation, finding-status semantics, and metrics row/status contract. No global command/skill apply was run; user approval is still required before executing the backup-first script. |

**✅ Step 5 — RingFall Wave 1 read-only backfill validation**

Parallelism rule: no parallel target mutation. This validates P1 against existing RingFall Wave 1 artifacts only.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 5.1 | Track E agent session | ✅ W7.6-P4 RingFall W1 backfill validation | W7.6-P3 accepted plus global P1 command/skill applied and verified | User-driven dry-run report proved high-confidence checkpoint reconstruction for `W1-S7-C1-K`, surfaced stale `.fal/ACTIVE_CONTEXT.*` and missing aggregate evidence as reconcile debt, and proposed finding/metrics rows. One explicit validation gap remains: a separate `recovery_verdict` drill was not run. |
| 5.2 | Meta Coordinator session | ✅ W7.6-P4 Meta backfill closeout | W7.6-P4 Track E report | Meta accepts P4 as read-only backfill validation with reconcile debt. P1 is sufficient to proceed to hook integration planning. Full recovery proof remains open until a later explicit cold-start drill records `recovery_verdict: restored | partially_restored | failed`. |

**✅ Step 6 — Existing workflow hook integration planning and router/tooling hardening**

Parallelism rule: serialize until P1 backfill proves the checkpoint closeout slice. Hook integration must not jump directly to full orchestration.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 6.1 | Meta Coordinator session | ✅ W7.6-P5 existing workflow hook plan | W7.6-P4 Meta closeout | Accepted in `docs/private/Wave7_6-W7_6_P5-Existing-Workflow-Hook-Integration-Plan-v1.md`. Defines required hook stages (`meta_plan_review_done`, `step_review_done`, `review_fix_done`, `handoff_done`), conditional hooks (`implementation_done`, `pre_compact_checkpoint`, `post_compact_hydration`), clean-closeout gates, fail-closed vs reconcile-debt behavior, and updates `tools/oc-session-router/docs/workflow-orchestrator-runbook.md`. |
| 6.2 | Track D agent session | ✅ W7.6-P6 router/tooling artifact-pinning hardening | W7.6-P5 accepted | Accepted after no-Swarm, three-lane Meta step review and review-fix in `docs/private/Wave7_6-W7_6_P6-Meta-Step-Review-Closeout-v1.md`. Patch hardens the serial helper path with pinned source-artifact preflight, dry-run/propose default, explicit `-FalSyncApply` / `-Apply` write gate, fix-plan/final-synthesis classifier checks, marker-stage mismatch rejection, `review_fix_done` stage separation, and runbook/README/state sync. Local ignored tooling remains operational state and is not part of the normal versioned closeout commit. |

**✅ Step 7 — Parallel reconcile and full command readiness**

Parallelism rule: P7 accepted the parallel reconcile/artifact-pinning prerequisite, but P8 holds full `/fal-orchestrate-target` implementation until a later dedicated PRD/review and explicit approval.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 7.1 | Track D agent session | ✅ W7.6-P7 parallel reconcile hardening | W7.6-P6 accepted | Accepted after Meta+Swarm re-review. Patch replaces the `sync-fal-checkpoint.ps1` noncatchable `exit $LASTEXITCODE` branch with catchable failure behavior and proves both parallel plan/step wrappers still write `fal-parallel-reconcile-summary.json` with failed-lane evidence before failing on actual helper/Python nonzero exit. Residual checked-in wrapper regression coverage debt routed as `RF-2026-06-27-01` to W7.8 or the next router failure-path change. |
| 7.2 | Meta Coordinator session | ✅ W7.6-P8 full orchestrator command readiness decision | W7.6-P1-P7 evidence | Decision: `HOLD_FULL_COMMAND_WITH_NARROW_NEXT`. Do not build full `/fal-orchestrate-target` now. Accepted smaller checkpoint/hook/reconcile slices may continue, but full command implementation requires a later dedicated PRD/review and must wait on P9 audit design / regression-guard readiness. |
| 7.3 | Track E agent session | ✅ W7.6-P9 wave-level usefulness audit design | W7.6-P8 decision + W7.6-P4 evidence | Accepted private design/protocol artifact in `docs/private/Wave7_6-W7_6_P9-Wave-Level-Usefulness-Audit-Design-v1.md`. It defines future target-wave audit dimensions, cold-start recovery drill protocol, negative controls, handoff sufficiency audit, decision labels, deferred gates, and candidate finding-to-regression lineage samples. It does not execute the cold-start drill and does not prove `recovery_verdict`; actual recovery proof remains routed to P9b or later targeted validation. |

Non-goals:
- no RingFall Wave 2 execution from this wave
- no OpenCode bridge/API/session delivery
- no automatic dispatch, routing, commit, push, or server restart
- no global command/skill edits without `oc-toolsmith` and backup-first apply script
- no HUB/dashboard/UI implementation
- no public output or `docs/public/**`
- no new canonical finding-to-regression database from W7.6
- no external advisory intake product flow in W7.6

#### Wave 7.7 — Productized Target Orchestration UX (docs-first planning closed)

Activation gate:
- W7.6 is closed with design debt through `docs/private/Wave7_6-W7_6-Closeout-Decision-v1.md`, and W7.6 evidence through P9 is sufficient to open W7.7 docs-first activation planning.
- W7.7 implementation remains separately gated; no full `/fal-orchestrate-target` build, target implementation, bridge/API/session delivery, public output, automatic `/compact`, or global apply execution opens by default.
- External advisory intake is allowed only as recommendation-only planning input with Meta deduplication against private canon and no current-next-action authority.
- P9b actual cold-start `recovery_verdict: restored | partially_restored | failed` remains separate validation debt, not a hidden W7.7 activation prerequisite.

Goal:
- make FAL target orchestration easy by default for the owner and OC Server Orchestrator while preserving strict and audit/team paths for high-assurance workflows.

Planning inputs:
- `docs/private/Wave7_7-Activation-and-Sequencing-Plan-v1.md`
- `docs/private/Wave7_7-Mode-Policy-and-Review-Depth-Selector-v1.md`
- `docs/private/Wave7_7-Auto-Detect-and-Question-Flow-Policy-v1.md`
- `docs/private/Wave7_7-External-Advisory-Intake-Envelope-v1.md`
- `docs/private/Wave7_7-Full-Orchestrator-Command-PRD-v1.md`
- `docs/private/Wave7_7-Closeout-Readiness-Rubric-v1.md`

Canonical mode and review policy:
- canonical mode names: `easy`, `guided`, `strict`, `audit_team`, `external_advisory`
- default mode: `guided`
- `external_advisory` is the fifth mode and remains recommendation-only
- review depth is an independent policy axis, not automatically determined by mode
- review risk labels: `trivial`, `normal`, `high_risk`, `audit_or_parallel`
- target/profile/artifact confidence labels: `high`, `medium`, `low`
- default write posture: dry-run/propose; target `.fal/ACTIVE_CONTEXT.*` or FAL aggregate evidence writes require explicit apply authority

Sequencing clarity rule:
- each row's `Session` cell names exactly one producing owner
- normal `/seq-next`, `/terv-review`, `/implement`, `/step-review`, review-fix, and closeout mechanics are workflow gates around that owner output, not separate Combined rows unless they produce an independent planning artifact
- multiple rows in the same step are parallel lanes; separate steps mean a real output-to-input dependency
- review participants may be named in notes as gate expectations, but not as co-owners in the `Session` cell

Non-goals at activation:
- no product UI/dashboard implementation
- no automatic OpenCode control or browser-side control
- no weakening of W7.6 compact-is-cache / canon-first authority doctrine
- no automatic compaction and no implicit compact-event detection
- no external advisory item may change current next action without owner/Meta reprioritization
- no full `/fal-orchestrate-target` build from PRD-only planning
- no RingFall Wave 2 implementation/execution
- no public output or `docs/public/**`

**✅ Step 1 — Meta activation and full W7.7 plan package**

Parallelism rule: serial Meta planning step. This step creates the full W7.7 plan package and sequencing but does not accept or execute later W7.7 implementation/design steps.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 1.1 | Meta Coordinator session | ✅ W7.7-A activation / sequencing / plan-doc package | W7.6 closeout accepted; owner grill decisions captured | Completed as plan-only package in `docs/private/Wave7_7-Activation-and-Sequencing-Plan-v1.md` and tracked sequencing/state commits through `76da6d4` plus single-owner sequencing clarification in `ce50b5e`. No global OpenCode files changed, no apply scripts ran, and no implementation scope opened. |

**✅ Step 2 — Mode policy and independent review-depth selector**

Parallelism rule: one policy step because review-depth selection depends on the mode vocabulary, but remains an independent axis in the same acceptance surface.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 2.1 | Meta Coordinator session | ✅ W7.7-B mode policy and review-depth selector acceptance | W7.7-A plan package | Accepted in `docs/private/Wave7_7-W7_7_B-Mode-Policy-Acceptance-v1.md`. Canonical modes are `easy`, `guided`, `strict`, `audit_team`, `external_advisory`; default mode is `guided`; review depth remains independent with risk labels `trivial`, `normal`, `high_risk`, `audit_or_parallel`. No runbook update is required now because live wrapper semantics did not change. |

**✅ Step 3 — Parallel UX policy lanes for detection, questions, and advisory intake**

Parallelism rule: these lanes may run in parallel after Step 2 because they consume the same mode/review-depth contract and do not depend on each other's output until Step 4 synthesis.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 3.1 | Track D session | ✅ W7.7-C target-profile auto-detection and confidence contract | W7.7-B accepted | Accepted/closed by parallel step-review `GREEN` in `.opencode-router/parallel-runs/parallel-step-review-20260628-131414`; Track ACK `08-track-d-track-response.md`. Evidence artifact: `docs/private/Wave7_7-W7_7_C-Target-Profile-Detection-Contract-v1.md` as ignored/local private evidence, not force-added in normal closeout. No router/code implementation opened. |
| 3.2 | Track A session | ✅ W7.7-D operator question bank and Guided-mode prompt flow | W7.7-B accepted | Accepted/closed by parallel step-review `GREEN` in `.opencode-router/parallel-runs/parallel-step-review-20260628-131414`; Track ACK `08-track-a-track-response.md`. Evidence artifact: `docs/private/Wave7_7-W7_7_D-Operator-Question-Bank-and-Guided-Prompt-Flow-v1.md` as ignored/local private evidence, not force-added in normal closeout. No live wrapper/runbook semantic change opened. |
| 3.3 | Track C session | ✅ W7.7-E external advisory fifth-mode envelope and triage policy | W7.7-B accepted | Accepted/closed by parallel step-review `GREEN` in `.opencode-router/parallel-runs/parallel-step-review-20260628-131414`; Track ACK `08-track-c-track-response.md`. Evidence artifact: `docs/private/Wave7_7-External-Advisory-Intake-Envelope-v1.md` as ignored/local private evidence, not force-added in normal closeout. `external_advisory` remains recommendation-only and cannot change current next action without owner/Meta reprioritization. |

**✅ Step 4 — Full `/fal-orchestrate-target` PRD-only synthesis**

Parallelism rule: serial synthesis step. The full command PRD must consume Step 2 mode/review policy plus all Step 3 UX lanes.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 4.1 | Meta Coordinator session | ✅ W7.7-F full command PRD-only readiness package | W7.7-B/C/D/E accepted | Accepted/closed as PRD-only in `docs/private/Wave7_7-Full-Orchestrator-Command-PRD-v1.md` after one reviewer subagent GREEN plus Meta self-review GREEN. It consumes W7.7-B/C/D/E, defines future command UX, args, defaults, mode/review/confidence behavior, Guided questions, external advisory no-authority/disposition law, stop conditions, artifact outputs, checkpoint hooks, runbook alignment gate, and future build gate blockers. This acceptance does not authorize build, global apply, bridge/API/session delivery, target implementation, automatic compact, public output, commit/push automation, or RingFall Wave 2. Track D / oc-toolsmith input may be requested through normal review/consultation, not as a co-owner in this row. |

**✅ Step 5 — oc-toolsmith apply-design generation, no execution**

Parallelism rule: serial because apply-design targets must derive from the accepted command PRD. This step may generate a backup-first apply script artifact later, but execution remains separately gated.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 5.1 | Meta Coordinator session | ✅ W7.7-G global command/skill apply-design artifact generation | W7.7-F accepted | Accepted/closed as apply-design-only in `docs/private/Wave7_7-W7_7_G-Global-Command-Skill-Apply-Design-v1.md` after one reviewer subagent GREEN plus Meta self-review GREEN. Local generated script: `ops/temp/apply-w7-7-g-fal-orchestrate-target-command-skill.ps1`. Target global paths are `$env:USERPROFILE\.config\opencode\commands\fal-orchestrate-target.md` and `$env:USERPROFILE\.config\opencode\skills\fal-orchestrate-target\SKILL.md`. The script defaults to dry-run and requires explicit `-Apply`; after W7.7-H closeout the owner explicitly approved manual owner-run apply for these two global files in `docs/private/Wave7_7-W7_7_G-Explicit-Apply-Decision-v1.md`. The agent/session still did not execute the script. No target implementation, runbook semantics change, public output, commit/push automation, or RingFall Wave 2 opened. |

**✅ Step 6 — W7.7 closeout and next-gate decision**

Parallelism rule: serial Meta closeout. This step decides what can open next and preserves W7.6 debts.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 6.1 | Meta Coordinator session | ✅ W7.7-H wave closeout / readiness decision | W7.7-G accepted | Closed in `docs/private/Wave7_7-W7_7_H-Wave-Closeout-Readiness-Decision-v1.md` as `CLOSE_W7_7_PLAN_ONLY_WITH_APPLY_DECISION_READY`. W7.7 closes as plan-only/docs-first; explicit user apply decision for W7.7-G generated global command/skill script was ready at closeout and was later approved by the owner for manual owner-run `-Apply`. W7.8 CI/mechanical gates and P9b recovery validation remain separate Meta sequencing options. Deeper runtime/router/full wrapper implementation remains gated until a dedicated readiness decision addresses runbook alignment, recovery-proof status, `RF-2026-06-27-01`, dirty router/core diff triage, and explicit user approval. |

Deferred / adjacent gates:
- P9b actual cold-start recovery drill remains separate validation debt.
- W7.8 CI/mechanical gates remain independent infrastructure work and may address `RF-2026-06-27-01`.
- Dirty tracked `src/fractal_agent_lab/integrations/router_fal_sync.py` / `tests/integrations/test_router_fal_sync.py` diff must be triaged before router/full-command/CI work.
- Deeper `/fal-orchestrate-target` runtime/router/full wrapper implementation remains blocked until a separate full-command readiness decision and explicit user/Meta approval.
- W7.7-G generated script `-Apply` gate was owner-approved for manual owner-run apply of exactly the two global OpenCode command/skill files; post-apply verification later confirmed the global `/fal-orchestrate-target` command/skill contain the FAL hygiene and `/fal-checkpoint-target` policy markers.

#### Wave 7.8 — CI Readiness And Mechanical Gates

Activation gate:
- W7.6 target-orchestrator checkpoint proof should exist through P4, or Meta explicitly opens CI hardening earlier as the next infrastructure slice after verified P1 apply
- Wave 7.8 does not require Wave 7.7 product UX activation; it is an infrastructure wave, not a product-mode wave
- no CD/deploy automation, secret-dependent CI, or private artifact upload is authorized
- green CI must remain mechanical evidence only and must not replace FAL review/evidence gates

Goal:
- integrate early, narrow CI for tracked FAL mechanical surfaces before later infrastructure and product work increase adoption cost

Planned deliverables:
- CI scope boundary for tracked vs private/local FAL surfaces
- tracked UI CI for `ui/` typecheck, test, and build
- generated-data boundary so CI does not depend on ignored/private evidence or `.opencode-router` state
- reassessment of whether FAL has a stable tracked Python/core CI surface beyond the UI
- explicit policy that CI results may feed evidence but do not replace FAL review
- report-only/later coverage policy until a separate Track E gate accepts harder thresholds

Track ownership model:

| Track | Wave 7.8 role | First allowed posture |
|---|---|---|
| Meta Coordinator | activation, CI scope lock, CI-as-evidence policy, closeout | docs-first planning and gate ownership |
| Track A | UI CI and generated-data boundary | tracked UI/mechanical CI only |
| Track B | tracked Python/core CI reassessment | reassessment only unless canonical tracked commands exist |
| Track E | CI gate review, coverage policy, hygiene expectations | QA/policy/mechanical verification |
| Track C | consult only if CI scope touches tracked semantics surfaces | no default implementation role |
| Track D | consult only if CI scope touches adapters/tooling surfaces | no default implementation role |

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W7.8-A CI scope boundary | Meta | Track E, Track A | accepted tracked-vs-private CI scope and non-goals | W7.6 P4 evidence or explicit Meta exception |
| W7.8-B UI CI | Track A | Track E | reviewed workflow for `ui/` `npm ci`, `typecheck`, `test`, `build` | W7.8-A accepted |
| W7.8-C Generated-data boundary | Track A | Meta | CI-safe fixture/data policy so UI CI does not depend on private/ignored evidence | W7.8-A accepted |
| W7.8-D Python/core CI reassessment | Track B | Track E | decision on whether additional tracked root/package CI commands exist and are stable enough to gate | W7.8-A accepted |
| W7.8-E CI-as-evidence policy | Meta | Track E | explicit rule that green CI is mechanical evidence only | W7.8-B/C plus optional W7.8-D |
| W7.8-F Coverage policy later | Track E | Meta | report-only/later coverage policy with no broad hard gate | W7.8-B/C plus optional W7.8-D |

### Wave 7.8 — Execution Steps

**✅ Step 1 — CI scope lock**

Parallelism rule: no parallel work. Meta locks CI scope before any workflow file or gate implementation opens.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 1.1 | Meta Coordinator session | ✅ W7.8-A CI scope boundary | W7.6 P4 evidence, or explicit Meta exception | Accepted in `docs/private/Wave7_8-W7_8_A-CI-Scope-Boundary-v1.md` as `GREEN_WITH_CONSTRAINTS`. `ops/`, `docs/private/`, `.opencode-router/`, `.swarm/`, local evidence, global OpenCode config, `tools/oc-session-router/**`, target private artifacts, secret-dependent jobs, CD/deploy, root Python/core CI implementation, coverage hard gates, and runtime/router/full `/fal-orchestrate-target` implementation remain outside scope. W7.8-B/C may open for tracked UI mechanical CI plus generated-data boundary only. |

**✅ Step 2 — Mechanical CI implementation**

Parallelism rule: Track A UI CI and generated-data boundary may proceed in parallel after Step 1 if they touch only `ui/` and reviewed fixture surfaces.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 2.1 | Track A agent session | ✅ W7.8-B UI CI | W7.8-A accepted | Accepted after Meta draft + Swarm review APPROVE. Added `.github/workflows/ui-ci.yml` as UI-only mechanical GitHub Actions workflow for `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`; local evidence reports `npm ci`, typecheck, `CI=true npm test` (34 tests), and build PASS. No private/upload/coverage/deploy/secret/root/router scope opened. |
| 2.2 | Track A agent session | ✅ W7.8-C generated-data boundary | W7.8-A accepted | Accepted after Meta draft + Swarm review APPROVE. Clean `HEAD` worktree proof at `6e4e6a5` confirmed UI `npm ci`, typecheck, `CI=true npm test` (34 tests), and build PASS without ignored/private `ui/public/generated/**`, `.opencode-router/**`, `.swarm/**`, or `data/**` runtime evidence beyond tracked `data/.gitignore`; no semantic generated-data correctness claim. |

**🔄 Step 3 — Reassessment and policy closeout**

Parallelism rule: Track B reassessment may run in parallel with Track E coverage/policy review only if it stays docs-first and does not open new CI commands silently.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 3.1 | Track B agent session | ✅ W7.8-D Python/core CI reassessment | W7.8-A accepted | Accepted after Meta draft + Swarm review APPROVE. Private docs-only artifact `docs/private/Wave7_8-W7_8_D-Python-Core-CI-Reassessment-v1.md` records `NO_ROOT_PYTHON_CI_YET_WITH_REASSESSMENT_COMPLETE`: no root Python manifest or canonical tracked command surface exists, README unittest examples remain non-canonical guidance, future candidate commands are not approved gates, and dirty `review_fix_done` router/FAL sync diff remains separate triage before router/full-command/root CI assumptions. |
| 3.2 | Meta Coordinator session | ✅ W7.8-E CI-as-evidence policy | W7.8-B/C accepted and W7.8-D accepted | Accepted after one-subagent mini step-review + Meta main pass. Private docs-only artifact `docs/private/Wave7_8-W7_8_E-CI-As-Evidence-Policy-v1.md` records that failed CI blocks merge/closeout for the covered mechanical surface, while passed CI is supporting mechanical evidence only and does not imply semantic/domain/FAL approval. No workflow, root Python CI, coverage hard gate, deploy/release, private upload, or router/FAL sync behavior change is authorized. |
| 3.3 | Track E agent session | ✅ W7.8-F coverage policy later | W7.8-B/C accepted and optional W7.8-D input | Accepted after Meta step-review GREEN. Private docs-only artifact `docs/private/Wave7_8-W7_8_F-Coverage-Policy-Later-v1.md` records `COVERAGE_REPORT_ONLY_UNTIL_MODULE_SPECIFIC_TRACK_E_ACCEPTANCE`: W7.8-F does not approve any coverage command, dependency, package install, workflow job, threshold, or global repo coverage percentage. Any future coverage command remains `future_candidate_only` or `blocked_until_reviewed` until separately reviewed. |

Wave gate:
- FAL has a narrow tracked CI surface
- private/local coordination and evidence boundaries remain intact
- no CD/deploy automation or secret-dependent CI is introduced
- no broad coverage hard gate is introduced prematurely
- green CI remains mechanical evidence only

#### Wave 8 or later — HUB Compatibility Layer / External Control Surface Contract

Activation gate:
- Wave 7 produces stable OpenCode-backed loop artifact conventions, W7.5 closes measurement/continuity hardening, and W7.6 either closes target-orchestrator seamless integration or Meta explicitly defers it with rationale
- future HUB remains a separate project and FAL only defines safe status/export/control boundaries
- Wave 8 must remain docs/contract-first until Meta separately approves implementation; no HUB code, bridge delivery, or dashboard implementation is implied

Planned deliverables:
- `docs/private/Wave8-HUB-Compatibility-Layer-Plan-v01.md`
- `docs/private/External-Control-Surface-Contract-v01.md`
- `docs/private/Project-Room-Taxonomy-v01.md`
- `docs/private/Approval-Queue-State-Model-v01.md`
- `docs/private/FAL-HUB-Privacy-Boundary-v01.md`

Track ownership model:

| Track | Wave 8 role | First allowed posture |
|---|---|---|
| Meta Coordinator | activation decision, scope lock, compatibility closeout | docs-first planning only |
| Track B | external status/export contract and approval-state model | contract docs and compatibility review |
| Track C | project room taxonomy and semantic classification | docs/semantics only |
| Track E | privacy/export boundary and evidence-release rules | review/gate policy only |
| Track A | display-needs review for future HUB/workbench surfaces | requirements review only; no UI implementation by default |
| Track D | future bridge/API feasibility only if explicitly requested | no-mutation feasibility brief only |

Epics:

| Epic | Owner | Support | Core output | Prereq |
|---|---|---|---|---|
| W8-A HUB compatibility activation and scope lock | Meta | Track B/E consultation | Wave8 plan accepted as docs-first, or held | W7-F closeout or explicit Meta exception |
| W8-B External status/export contract | Track B | Track E | status feed, export shape, approval-state compatibility contract | W8-A accepted |
| W8-C Project room taxonomy | Track C | Meta, Track B | room/project classification semantics and naming rules | W8-A accepted |
| W8-D Privacy/export boundary | Track E | Track B, Track C | public/private export law, redaction requirements, evidence-release gates | W8-B/W8-C draft outputs |
| W8-E Display-needs review | Track A | Track E | future display requirements and no-implementation UX constraints | W8-B/W8-C/W8-D draft outputs |
| W8-F Bridge/API feasibility no-mutation brief | Track D | Track B, Track E | feasibility/risk note only, if opened | W8-B + W8-D accepted and Meta requests it |
| W8-G Meta compatibility closeout | Meta | all tracks as reviewers | accept/revise/hold compatibility layer | W8-B/W8-C/W8-D plus optional W8-E/W8-F |

### Wave 8 — Execution Steps

**⏸ Step 1 — Activation and docs-first scope lock**

Parallelism rule: no parallel work. Wave 8 starts only with one Meta activation/scope review.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 1.1 | Meta Coordinator session | ⏸ W8-A activation/scope review | W7-F closeout, or explicit Meta exception after W7-A/W7-B | Confirm why HUB compatibility is needed now, what mainline opportunity cost is accepted, and that no HUB implementation is authorized |

**⏸ Step 2 — Core compatibility contracts, parallel only if scope is clean**

Parallelism rule: `2.1a` and `2.1b` may run in parallel only if Meta provides a shared terminology seed and confirms file scopes are disjoint.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 2.1a | Track B session | ⏸ W8-B external status/export and approval-state contract | W8-A accepted | Defines status/export fields, approval queue state, request vs observe vs propose-action boundaries |
| 2.1b | Track C session | ⏸ W8-C project room taxonomy | W8-A accepted | May run parallel with W8-B if terms are coordinated; defines project/room classification and semantic labels |

**⏸ Step 3 — Privacy, display, and optional bridge feasibility**

Parallelism rule: Track E privacy/export review goes first. Track A display-needs review and Track D no-mutation feasibility may run in parallel only after W8-D if Meta explicitly opens both.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 3.1 | Track E session | ⏸ W8-D privacy/export boundary | W8-B draft ✅ + W8-C draft ✅ | Defines private/raw vs sanitized candidate vs public-approved release rules and review gates |
| 3.2a | Track A session | ⏸ W8-E display-needs review | W8-D ✅ + explicit Meta request | Requirements-only review for what a future HUB or workbench would need to display; no UI implementation by default |
| 3.2b | Track D session | ⏸ W8-F bridge/API feasibility brief | W8-B ✅ + W8-D ✅ + explicit Meta request | No-mutation feasibility/risk note only; no API/session delivery implementation |

**⏸ Step 4 — Meta acceptance or hold**

Parallelism rule: no parallel work. Meta closeout happens after all opened W8 review lanes finish.

| Order | Session | Epic(s) | Prereq | Notes |
|---|---|---|---|---|
| 4.1 | Meta Coordinator session | ⏸ W8-G compatibility closeout | W8-B ✅ + W8-C ✅ + W8-D ✅; W8-E/W8-F if opened | Decide whether future HUB compatibility is accepted, needs revision, or remains parked |

Non-goals:
- no HUB implementation in FAL
- no UI/dashboard implementation by default
- no automatic dispatch, repo/session mutation, commit, or push
- no public export of private raw evidence or private learning-loop heuristics

---

# 10. Wave and sprint matrix

| Wave | Primary Objective | Track B | Track C | Track D | Track E | Track A |
|------|-------------------|---------|---------|---------|---------|---------|
| 0 | Foundation | lead | prep -> integrate | stub -> integrate | rubric prep | CLI shell |
| 1 | Swarm-first lab | lead/co-lead | co-lead | support | smoke/baseline | trace consumption |
| 2 | Engine hardening | lead | adapt roles/memory | prep only | co-lead | stable trace UI |
| 3 | Research OS usefulness | schema authority | lead | late MVP side batch | co-lead | visibility uplift |
| 4 | Provider expansion | protect core | minor | lead parity/hardening | compare co-lead | optional UI support |
| 5 | Workbench | support | support | support | support | lead |
| 6 | OpenCode evidence/control layer | packet/state boundary | payload semantics | bridge readiness only until later Meta-opened step | usefulness/evidence scoring | later visibility only |
| 6.5 | Ringfall adoption/readiness | external-project packet-field compatibility | target-project language and room semantics | bridge remains deferred unless Wave 6 supports it | usefulness synthesis and evidence sufficiency | no UI by default |
| 7 | OpenCode-backed evidence learning layer | loop/run/trace/artifact contract | learning/identity semantics support | router ingest support only after contract | evidence/privacy validation | browse support after ingest shape stabilizes |
| 7.5 | Measurement and context continuity hardening | metrics/context contract review | learning candidate semantics | evidence compatibility only if needed | metrics, review ledger, pilot measurement | public-safe/readability only if opened |
| 7.6 | Target orchestrator seamless integration | target profile / active context / checkpoint contract review | finding/routing verdict semantics | router artifact pinning and reconcile hardening after P1 | checkpoint/evidence sufficiency and backfill audit | no default role |
| 7.8 | CI readiness and mechanical gates | python/core CI reassessment | consult only | consult only | CI gate review and report-only coverage policy | UI CI + fixture boundary |
| 8 | HUB compatibility contract | status/export and approval-state contract | room taxonomy semantics | future bridge/API feasibility only if gated | privacy/export and evidence boundary | display-needs review only |

---

## 11. Hero workflow unlock order

### H1 — Startup idea refinement
Unlocked first because:
- strongest motivation signal
- immediate personal usefulness
- easiest to compare against single-agent baseline
- good fit for manager/handoff experimentation

### H2 — Project decomposition
Unlocked second because:
- directly supports your working style
- naturally turns into tracks/modules/waves output
- ideal bridge between “lab” and “research OS”

### H3 — Architecture review
Unlocked third because:
- depends more on richer critique and structure
- benefits from stronger trace/eval discipline
- useful for portfolio and future real repos

### Future workflow family H4/H5 — Software Delivery Loop
Unlocked in stages, not all at once:
- docs-only design unlock after Wave 1 closeout
- thin `H4` pilot only after Wave 2 contract/replay/smoke hardening proves stable enough
- thin `H5` review/gate slice only after `H4` exists and artifact/gate discipline has real evidence

Why this order:
- strong strategic fit with the research-OS direction
- but depends on trustworthy run/trace/replay/smoke foundations
- should extend the engine, not distract from earned hardening work

---

## 12. Decision policy for orchestration patterns

The user was uncertain which orchestration style should dominate early.
This document resolves that uncertainty as follows:

### Early default
- **Wave 1 default:** Manager + limited handoff
- **Wave 2 default:** Manager + handoff + replayable trace discipline
- **Wave 3 experimentation:** parallel fan-out for critique-heavy workflows
- **Later hardening path:** explicit workflow graphs for stabilized hero flows

### Practical rule
If the workflow is new or unstable, prefer **manager**.
If the workflow benefits from specialist transfer and the chain is understandable, add **handoff**.
If the workflow is mature and critique-heavy, add **parallel specialists**.
If the workflow is recurring and stable, consider **workflow graph hardening**.

---

## 13. Immediate next execution order (short horizon)

This section should always describe the **current frontier**, not the original kickoff history.

### Current frontier
Wave 0 through Wave 5 are complete. Wave 6 is closed as `narrow_continue`, Wave 6.5 RingFall readiness/adoption is closed, Wave 7 OpenCode-backed evidence learning is closed through W7-G2, and Wave 7.5 Measurement & Context Continuity Hardening is closed through W7.5-H.

Wave 7.6 closeout summary:

- ✅ `W7.6-P0` Meta design freeze and Combined sequencing integration is complete.
- ✅ W7.6 compact/session authority PRD input is complete in `docs/private/Wave7_6-Session-Continuity-Compact-Authority-PRD-v1.md`, including deduplicated advisory-derived checks for cold-start recovery, handoff sufficiency, negative controls, bounded stop/escalation, and P9 lineage audit.
- ✅ `W7.6-P1` `/fal-checkpoint-target` + `fal-target-orchestration` PRD draft through `oc-toolsmith` is produced in `docs/private/Wave7_6-W7_6_P1-FAL-Checkpoint-Target-Command-Skill-PRD-v1.md` with reviewable script `ops/temp/apply-w7-6-p1-fal-target-orchestration.ps1`.
- ✅ `W7.6-P2` Track A/B/C/D/E parallel review completed: Track A/D `GREEN`, Track B/C/E `YELLOW/revise`, no `RED`.
- ✅ `W7.6-P3` Meta apply decision completed as `revise`; the required narrow revision bundle was applied to the P1 PRD and backup-first apply script.
- ✅ `W7.6-P4` RingFall Wave 1 read-only backfill validation is accepted as read-only checkpoint proof with reconcile debt; full cold-start recovery proof remains open.
- ✅ `W7.6-P5` existing workflow hook integration plan is complete in `docs/private/Wave7_6-W7_6_P5-Existing-Workflow-Hook-Integration-Plan-v1.md`.
- ✅ `W7.6-P6` router/tooling artifact-pinning hardening is accepted after no-Swarm, three-lane Meta step review and review-fix.
- ✅ `W7.6-P7` parallel reconcile hardening is accepted, with `RF-2026-06-27-01` routed as later regression-guard debt.
- ✅ `W7.6-P8` full `/fal-orchestrate-target` readiness decision is accepted as `HOLD_FULL_COMMAND_WITH_NARROW_NEXT`.
- ✅ `W7.6-P9` wave-level usefulness audit design is accepted in `docs/private/Wave7_6-W7_6_P9-Wave-Level-Usefulness-Audit-Design-v1.md`; it is design/protocol only and does not prove cold-start recovery.
- ✅ W7.6 closes with design debt in `docs/private/Wave7_6-W7_6-Closeout-Decision-v1.md`; P9b remains deferred targeted validation, not an active W7.6 blocker.
- ✅ Wave 7.7 Productized Target Orchestration UX opened and closed as docs-first planning with owner-run prompt-layer command/skill apply verified after closeout.
- 🔄 NEXT: Wave 7.8 CI readiness and mechanical gates remains open at Step 2; W7.8-B UI CI is accepted and Track A should proceed to W7.8-C generated-data boundary under the accepted UI-only/generated-data constraints.
- ⏸ Wave 8/HUB compatibility remains parked; this frontier does not authorize HUB work.

Current blocker summary:

- no blocker remains in the P2/P3 docs/contract revision bundle after the revised PRD/apply-script text is reviewed
- global P1 command/skill files exist locally, and P4 proved the checkpoint slice on real RingFall Wave 1 artifacts
- a later explicit cold-start recovery drill is still open before compact/hydration recovery may be treated as proven
- serial wrapper FAL hook behavior is accepted for P6 scope, and parallel reconcile behavior is accepted for P7 scope
- P9 design acceptance is not recovery proof; actual `recovery_verdict: restored | partially_restored | failed` remains P9b or later targeted validation debt, but does not block W7.6 closeout in design/debt state
- local/ignored operational surfaces (`tools/oc-session-router/**`, `docs/private/**`, `ops/AGENTS.md`, `ops/temp/**`) remain outside the normal versioned closeout commit unless a later explicit policy exception force-adds them
- W7.8-A scope boundary and W7.8-B UI-only mechanical CI are accepted; W7.8-C generated-data boundary is the next active Track A work
- RingFall Wave 2 implementation remains blocked before a separate target planning brief and Meta gate
- public release, public mirror, `docs/public/` output, and Track A presentation remain blocked
- OpenCode bridge/API/session delivery remains blocked
- automatic `/compact` remains blocked; W7.6 may record compact-readiness only
- W7.7 `external_advisory` remains recommendation-only and cannot alter the current next action by itself

### Current operational rule
If you want to know "which session do I run next?", use this order:

1. Open Track A W7.8-C generated-data boundary under `docs/private/Wave7_8-W7_8_A-CI-Scope-Boundary-v1.md`; W7.8-B UI CI is already accepted.
2. Treat W7.6 and W7.7 as closed with design debt; P9b remains available later as read-only targeted validation, not as the current active frontier.
3. Keep the missing explicit `recovery_verdict` drill visible as later validation debt; do not claim compact/hydration recovery is already proven.
4. Keep any full `/fal-orchestrate-target` implementation blocked until a dedicated full-command PRD/review and explicit Meta/user approval authorize it.
5. Keep root Python/core CI blocked until W7.8-D reassessment accepts a canonical tracked command surface.
6. Keep W7.8 CI non-secret, non-CD, non-deploy, and mechanical-evidence-only.
7. Wave 8 remains `⏸` unless a later explicit Meta decision opens docs-first compatibility work.

### CI readiness planning note

CI readiness for RingFall and FAL is canonized as a private planning input in `docs/private/CI-Readiness-Plan-RingFall-FAL-v01.md`.

This note was the private planning input for the now-open W7.8 direction and remains constrained to early, narrow CI:

- RingFall starts with contract/schema CI around `tools/schema_check.py`.
- FAL starts with tracked UI/mechanical CI around `ui/package.json` scripts.
- CD/deploy automation remains out of scope.
- Coverage starts report-only unless a later Track E gate accepts module-specific hard thresholds.
- Green CI is mechanical evidence only; it does not replace FAL review/evidence gates.

Reference:
- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md`
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `docs/private/FAL-Target-Orchestrator-Seamless-Integration-Plan-v01.md`
- `docs/private/Wave7_6-Session-Continuity-Compact-Authority-PRD-v1.md`
- `docs/private/Wave7_6-W7_6_P1-FAL-Checkpoint-Target-Command-Skill-PRD-v1.md`
- `ops/temp/apply-w7-6-p1-fal-target-orchestration.ps1`
- `docs/private/FAL_external_advisory_handoff_2026-06-23.md`
- `docs/private/CI-Readiness-Plan-RingFall-FAL-v01.md`
- `ops/Review-Findings-Registry.md`

### Future coding vertical insertion note (not active frontier yet)

This is a planned side-vertical sequence, not the mainline queue.

Wave 1 core closeout is complete, `CV0` is closed, and `CV1` is implemented.
The original `CV1-META1` closeout kept `CV2` blocked because local `h4.seq_next.v1` evidence was missing at that time.
Post-closeout live hardening later produced a canonically complete `h4.seq_next.v1` evidence run, so the missing-evidence blocker is now cleared.
`CV2` was explicitly activated on 2026-04-27 as a narrow H5 review/gate side-vertical; it remains subordinate to the main wave spine and does not imply implementation automation.
Wave 6 / `CV3-lite` is documented as a post-Wave-5 strategic correction: Fractal Agent Lab should become the evidence/control layer above OpenCode, not a wrapper around OpenCode commands or a hidden session bus.

Use this in the following order:

1. Meta-led `CV0` design/policy batch after `W1-S2-FIX-META1` and `L1-J` / `L1-K` / `L1-L` / `L1-M`
2. thin `CV1` (`H4`) pilot only after `H2-A` through `H2-H`
3. thin `CV2` (`H5`) review/gate slice only after `CV1` is accepted and coding artifacts are stable enough to judge honestly
4. Wave 6 / `CV3-lite` evidence-backed OpenCode orchestration only after Wave 5 closes, starting evidence-ledger-first rather than OpenCode API/session-bus-first

References:
- `docs/Coding-Vertical-Adopt-Adapt-Defer-v01.md`
- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/OpenCode-Orchestration-Layer-v01.md`
- `docs/private/Coordination-Layer-Packet-Bus-v02.md`
- `docs/private/Coding-Vertical-Usefulness-Eval-v01.md`

### Post-Wave-1 side vertical — Software Delivery Loop (`CV0` / `CV1` / `CV2`)

This is a future side-vertical sequence.
It no longer blocks on Wave 1 core closeout, but it still does not replace the mainline Wave 2 queue.

#### `CV0` — Design and policy canonization

**Status:** `✅ complete`  
**Owner priority:** Meta Coordinator, then Track C, with Track E review where needed

Scope normalization note:
- CV0-B is the narrow Track C `H4` planning prompt/policy review scope
- CV0-B is not a broad H4/H5 redesign step
- artifact contract finalization is already complete via CV0-A

Epics:
- ✅ **CV0-A** H4/H5 artifact contract finalization — **Owner: Meta Coordinator**
- ✅ **CV0-B** H4 planning prompt/policy review — **Owner: Track C**
- ✅ **CV0-C** H5 review/gate policy review — **Owner: Track E**
- ✅ **CV0-D** CV0 closeout + CV1 prereq note — **Owner: Meta Coordinator**

**Sequential ordering:**
1. `CV0-A` first (artifact contract baseline must exist before review alignment)
2. `CV0-B` after `CV0-A` (Track C H4 planning review)
3. `CV0-C` after `CV0-A` (Track E H5 review/gate review)
4. `CV0-D` after `CV0-B` and `CV0-C`

**Prerequisites:**
- `W1-S2-FIX-E1` ✅
- `W1-S2-FIX-A1` ✅
- `W1-S2-FIX-A2` ✅
- `W1-S2-FIX-META1` ✅
- `L1-J` ✅
- `L1-K` ✅
- `L1-L` ✅
- `L1-M` ✅

**Execution assignment for policy closeout chain:**
- `CV0-D`: Meta closeout after Track C/Track E reviews reconcile policy alignment and record the resulting CV1 prereq stance without changing the active mainline frontier

**Acceptance gate:**
- coding vertical has canonical private docs
- H4/H5 positioning and non-goals are explicit
- artifact/gate/privacy boundaries are explicit
- `CV1`/`CV2` unlock stance is explicit and sequencing-safe relative to the active mainline frontier
- no production-code churn was required
- the current human-driven Combined-aware workflow has an explicit canonical mapping

### `CV0` — Execution Steps

**✅ Step 1 — Meta canonizes the coding-vertical position and boundaries first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ CV0-A | Wave 1 closeout ✅ | Establish purpose, scope, non-goals, canonical human-workflow mapping, and artifact-contract baseline |

**✅ Step 2 — Track C executes narrow H4 planning prompt/policy review**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ CV0-B | CV0-A ✅ | H4 review delivered as docs-only decision package with scope normalization and cross-doc alignment |

**✅ Step 3 — Track E reviews H5 review/gate policy draft**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ CV0-C | CV0-A ✅ | Design-only review completed with H5 policy boundary tightening and cross-doc consistency alignment |

**✅ Step 4 — Meta closes CV0 and records CV1 prereq stance**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ CV0-D | CV0-B ✅ + CV0-C ✅ | Reconcile docs, close CV0, and record that `CV1` is ready by named prerequisites but remains a side-vertical option rather than the active mainline frontier |

#### `CV1` — Thin `H4` pilot

**Status:** `⏸ ready by named prerequisites; remains optional side-vertical work and does not replace the current recommended frontier order`  
**Owner priority:** Track C, with Track D support and Track E evaluation

Near-term UX stance:

- `CV1` is the first thin packet/compiler-first slice for the current `WAVE START` / `SEQ NEXT` loop
- the first operator win should be cheaper, more legible transport and near `enter-only` support
- guarded dispatch or session-bus behavior belongs later only if evidence earns it

Epics:
- ✅ **CV1-A** request normalization and repo-intake artifact — **Owner: Track C**
- ✅ **CV1-B** implementation-plan artifact and risk register — **Owner: Track C**
- ✅ **CV1-C** minimal coordination-layer / helper surface for H4 — **Owner: Track D**
- ✅ **CV1-D** thin baseline/eval check for H4 usefulness — **Owner: Track E**
- ✅ **CV1-META1** H4 pilot closeout and `CV2` readiness check — **Owner: Meta Coordinator**

**Sequential ordering:**
1. `CV1-A` first (repo-aware intake is the foundation of the pilot)
2. `CV1-B` and `CV1-C` can proceed in parallel after `CV1-A`
3. `CV1-D` after `CV1-B` and `CV1-C`
4. `CV1-META1` after `CV1-D`

**Prerequisites:**
- `CV0-D` ✅
- `H2-A` ✅
- `H2-B` ✅
- `H2-C` ✅
- `H2-D` ✅
- `H2-E` ✅
- `H2-F` ✅
- `H2-G` ✅
- `H2-H` ✅

**Acceptance gate:**
- H4 can produce grounded planning artifacts from real repo context
- the pilot names risks and unknowns explicitly
- the tool surface stays narrow
- the planning artifact is materially better than an unstructured one-shot answer
- the pilot preserves the current status-aware `WAVE START` / `SEQ NEXT` behavior instead of bypassing it
- packet outputs are legible enough to reduce manual transport friction without weakening readiness honesty

### `CV1` — Execution Steps

**✅ Step 1 — Track C establishes the repo-aware intake first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ CV1-A | CV0-D ✅ + H2-A ✅ + H2-B ✅ + H2-C ✅ + H2-D ✅ + H2-E ✅ + H2-F ✅ + H2-G ✅ + H2-H ✅ | Delivered `h4.wave_start.v1` as a narrow 3-role manager intake path with canonical `context_report.json` sidecar proof on the `fal run` path and no adapter-surface widening |

**✅ Step 2 — planning artifacts and the minimal tool surface advance in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track C agent session | ✅ CV1-B | CV1-A ✅ | Delivered `h4.seq_next.v1` as a separate 4-role planning workflow with required `implementation_plan.md` + `acceptance_checks.json` artifact writing on canonical `fal run`; risk register remains embedded in the plan, caution/risk/non-goal fields are preserved, and the default-mock runnable seam is kept as an explicit shared-boundary checkpoint |
| Track D agent session | ✅ CV1-C | CV1-A ✅ | Delivered a wave_start-only helper/compiler slice that derives packet sidecars from canonical `context_report.json`, writes non-canonical transport outputs under `artifacts/<run_id>/packets/`, and keeps queue/session-bus scope explicitly out |

**✅ Step 3 — Track E checks whether the H4 pilot is actually better than a freeform plan**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ CV1-D | CV1-B ✅ + CV1-C ✅ | Delivered a thin inspect-first usefulness check with explicit `PASS` / `FAIL` / `BLOCKED` semantics, lane-split evidence (`seq_next` main verdict, `wave_start` additive packet legibility), and bounded canonical-artifact-first evaluation before Meta decides whether the H4 pilot should advance |

**✅ Step 4 — Meta closes the H4 pilot before any H5 slice is allowed to open**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ CV1-META1 | CV1-D ✅ | Meta closed the thin H4 pilot and, at that time, recorded usefulness evidence as `BLOCKED` because no local `h4.seq_next.v1` run/trace/artifact corpus was present; later live hardening produced the missing corpus and clears that specific blocker |

Post-closeout evidence update:
- live hardening run `a887ffe1-617b-426b-a1bf-d7263d022673` succeeded with the full `repo_intake -> planner -> architect_critic -> finalize` manager chain
- canonical artifacts exist under `data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/implementation_plan.md` and `data/artifacts/a887ffe1-617b-426b-a1bf-d7263d022673/acceptance_checks.json`
- `CV1-D` rerun on that evidence is recorded as `PASS` in `docs/private/H4-SeqNext-Live-Hardening-Summary-v01.md`
- this cleared the old missing-evidence blocker at the time; explicit `CV2` activation is recorded below

#### `CV2` — Thin `H5` review/gate slice

**Status:** `✅ complete as a manual thin H5 review/gate slice; no native H5 runtime automation or provider-parity claim`
**Owner priority:** Track E, with Track D support and Meta closeout

Epics:
- ✅ **CV2-A** findings-first review artifact — **Owner: Track E**
- ✅ **CV2-B** test-evidence capture artifact — **Owner: Track D + Track E**
- ✅ **CV2-C** explicit commit-gate artifact — **Owner: Track E**
- ✅ **CV2-D** policy feedback loop and private-learning note — **Owner: Meta Coordinator**

**Sequential ordering:**
1. `CV2-A` and `CV2-B` can proceed in parallel on the same implementation candidate
2. `CV2-C` after `CV2-A` and `CV2-B`
3. `CV2-D` after `CV2-C`

**Prerequisites:**
- `CV1-META1` ✅
- post-CV1 live `h4.seq_next.v1` evidence exists and cleared the old missing-evidence blocker (`a887ffe1-617b-426b-a1bf-d7263d022673`)
- coding artifacts are stable enough to compare and review honestly
- commit-gate semantics have at least one credible evidence cycle behind them

**Acceptance gate:**
- review output is findings-first and severity-legible
- test evidence is explicit or the absence of tests is justified explicitly
- the gate can say `hold` honestly
- at least one meaningful cycle feeds the private learning loop without overfitting one run
- the slice preserves the current review-before-commit behavior and may refuse commit cleanly
- packet-friendly review/gate outputs are acceptable only if they preserve those same honesty rules

### `CV2` — Execution Steps

**✅ Step 1 — review findings and test evidence are gathered in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ CV2-A | CV1-META1 ✅ + H4 evidence ✅ | Findings-first review artifact delivered in `docs/private/CV2-A-H5-Findings-First-Review-v01.md`; medium finding `RF-2026-04-27-01` was discovered and later fixed by Track D commit `6fb49cf` |
| Track D + Track E session | ✅ CV2-B | CV1-META1 ✅ + H4 evidence ✅ | Track D evidence handoff delivered in `docs/private/CV2-B-TrackD-Test-Evidence-Handoff-v01.md`; Track E sufficiency review delivered in `docs/private/CV2-B-TrackE-Evidence-Sufficiency-Review-v01.md`, concluding CV2-C may start after `6fb49cf` fixed the medium issue |

**✅ Step 2 — Track E made the commit-gate decision only after review and evidence existed**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ CV2-C | CV2-A ✅ + CV2-B ✅ | Advisory commit-gate artifact delivered in `docs/private/CV2-C-TrackE-Advisory-Commit-Gate-v01.md` with gate status `pass`; advisory-only, no autonomous commit authority, no provider-parity/live-provider claim |

**✅ Step 3 — Meta fed durable lessons back into the private coding-vertical policy layer**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ CV2-D | CV2-C ✅ | Private-learning closeout delivered in `docs/private/CV2-D-Meta-Policy-Feedback-Private-Learning-Note-v01.md`; immediate policy/registry edits not required, and the slice is closed without overfitting one manual cycle into doctrine |

---

## 14. Blocked-state fallback guidance

If a track is `NOT READY`, it should not idle blindly.
Allowed fallback work:

### Track A fallback work
- CLI UX notes
- trace viewer wireframes
- output formatting sketches

### Track C fallback work
- role taxonomy
- prompt drafts
- memory policy design notes
- workflow input/output examples

### Track D fallback work
- adapter interface design notes
- provider config structures
- mock adapter scaffolding

### Track E fallback work
- rubric drafting
- benchmark case collection
- replay design notes

### Forbidden fallback behavior
- building fake “final” implementations on unstable schemas
- silently forking contracts
- creating de facto standards without B signoff

---

## 15. What “good progress” should mean after 2–3 weeks

Because the user explicitly valued learning, architecture quality, reusability, and portfolio value at once, good progress is defined as a **compound outcome**, not a single metric.

### Best-case near-term outcome
- there is a working multi-agent H1 flow
- there is a baseline comparison vs simpler path
- core runtime pieces are not spaghetti
- trace artifacts exist and can be read
- the repo looks like a serious evolving system, not random experiments

### Bad false-positive outcome
- lots of code exists, but no one workflow is reliable
- orchestration is complex, but traces are unreadable
- adapters are many, but core contracts are muddy
- memory exists, but it is mostly noise

The sequencing plan is explicitly designed to avoid the false-positive path.

---

## 16. Meta Coordinator responsibilities for this plan

The Meta Coordinator must use this document to:
- determine which track is actually unblocked
- prevent premature parallelization
- record wave gate outcomes
- create follow-up plan docs when a wave becomes detailed enough
- update statuses and risks after meaningful handoffs

### Suggested follow-up docs, in order
1. `ops/Meta-Coordinator-Runbook.md`
2. `docs/Track-B-Prep-Roadmap.md`
3. `docs/Workflow-H1-Idea-Refinement-Plan.md`
4. `docs/Track-C-Prompt-Strategy.md`
5. `docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md`

Post-Wave-1 side-vertical references:
- `docs/Coding-Vertical-Adopt-Adapt-Defer-v01.md`
- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`

---

## 17. Open design questions intentionally left unresolved

These are **not blockers** for Wave 0, but will matter later.

1. How rich should the long-term memory merge policy become?
2. Should local models matter for real use or only experimentation?
3. When should explicit graph workflows replace simpler orchestration?
4. How soon should project memory become visible in the UI?
5. What exact eval rubric best predicts “actually helpful” outputs for H1/H2/H3?
6. What is the smallest honest `H4` pilot that proves value without stealing focus from Wave 2 hardening?

These remain open by design so that implementation can teach the architecture.

---

## 18. Initial uzenofal entries for sequencing kickoff

- `[2026-03-06][Meta] Combined execution sequencing plan initialized - wave ladder and turn-gate protocol established - next: Track B Wave 0 foundation kickoff.`
- `[2026-03-06][Meta] Early orchestration policy resolved - Wave 1 defaults to manager + limited handoff, graph hardening deferred - next: encode in Track B/C workflow design.`
- `[2026-03-06][Meta] Hero workflow unlock order fixed - H1 first, H2 second, H3 third - next: create H1 workflow plan.`
- `[2026-03-06][Meta] Overbuild risk explicitly gated - provider expansion and workbench delayed until core earns it - next: keep Wave 0 and Wave 1 narrow.`
- `[2026-03-09][Meta] Emergent Identity Layer integrated into sequencing plan - observational MVP targets W2-S3 (H2-M/N/O), optional design prep in W1-S3 (L1-N/O), Track C primary owner - next: create identity/ package skeleton.`
- `[2026-03-19][Meta] Future coding vertical accepted as a staged side vertical - post-Wave-1 docs-only `CV0` is allowed, but executable H4/H5 work stays blocked behind Wave 2 hardening prerequisites - next: canonize private coding-vertical docs and rollout notes.`
- `[2026-03-20][Meta] Combined sequencing convention tightened - execution steps now carry explicit status markers and parallel-safe work should live inside the same numbered step - next: keep future sprint edits aligned with this structuring rule.`
- `[2026-03-20][Meta] Coding vertical expanded inside Combined - `CV0`, `CV1`, and `CV2` now have explicit epics, owners, prerequisites, execution steps, and gates without displacing the live Wave 1 frontier - next: keep `CV0` blocked until Wave 1 truly closes.`
- `[2026-03-20][Meta] W1-S2 stabilization formally closed - all five stabilization fixes are accepted, targeted validation passes, and the active frontier now returns to Wave 1 Sprint `W1-S3` (`L1-J` / `L1-K` / `L1-L` / `L1-M`) - next: run the W1-S3 parallel opening step.`
- `[2026-03-20][Meta] Current human workflow mapped into the coding vertical - H4/H5 are now explicitly tied to the existing Combined-driven Meta+track workflow instead of an abstract coding-agent model - next: preserve this mapping when refining CV0/CV1/CV2.`
- `[2026-04-17][Meta] Coding-vertical reorientation closed at docs level - the private canon now treats the near-term direction as coordination-layer-first (`packet law` + cheaper operator transport + near `enter-only` flow), keeps OpenCode as the hands and Combined as the control surface, and defers guarded dispatch/session-bus behavior to later earned expansion - next: if explicitly chosen, `CV1` may open under this sharper packet/compiler-first interpretation.`
- `[2026-03-09][Meta] Track ownership and sequential ordering added to all epics across all waves - every epic now has explicit owner and ordering constraints documented.`
- `[2026-03-09][Track D] F0-F implemented - StepRunner adapter boundary, MockAdapter path, and provider routing shell are active - next: wire CLI config loading path for F0-I.`
- `[2026-03-09][Track D] F0-I implemented - CLI now loads runtime/providers/model policy config and applies provider selection shell through adapter step runner - next: coordinate smoke/acceptance with Track A/E.`
- `[2026-03-18][Track D] W1-S1-FIX-D1 completed (🔄 -> ✅) - H1 manager mock workers now enforce upstream context requirements so ordering regressions fail fast instead of passing silently - next: close W1-S1-FIX-D2 tier realignment.`
- `[2026-03-18][Track D] W1-S1-FIX-D2 completed (🔄 -> ✅) - canonical model-tier defaults restored to gpt-4o-mini / gpt-5.4-nano / gpt-5.4-mini with adapter+CLI test fixtures aligned - next: Meta runs W1-S1-FIX-META1 closeout.`
- `[2026-03-09][Track A] F0-G completed - CLI shell now runs Wave 0 demo workflow through runtime executor with list-workflows/run commands and optional trace summary - next: complete F0-H formatting hardening.`
- `[2026-03-09][Track A] F0-H completed - minimal run summary contract now standardized across text/json output for Wave 0 CLI runs - next: proceed to W0-S3 dependencies with Track C/E.`
- `[2026-03-11][Track E] F0-L started (⬜ -> 🔄) - manual smoke checklist implementation kicked off against Wave 0 runnable path and Track B runtime contracts - next: publish executable checklist with acceptance labels.`
- `[2026-03-11][Track E] F0-L completed (🔄 -> ✅) - Wave 0 manual smoke checklist published in docs/wave0/Wave0-Manual-Smoke-Checklist.md with command baseline, trace/run checks, and outcome taxonomy - next: use checklist outputs to support F0-M artifact/replay validation.`
- `[2026-03-13][Track E] Coordination doc visibility note recorded - ops/docs markdown remains locally readable by opencode even when ignored by git, but those changes are not visible in git status or standard commit flow - next: treat documentation auditability separately from local read access.`
- `[2026-03-13][Track E] F0-M started (Track B scope ✅ -> 🔄 Track E scope) - artifact usability validation began for stored run/trace outputs with explicit replay-smoke invariants - next: validate success and failure artifact pairs.`
- `[2026-03-13][Track E] F0-M completed (🔄 -> ✅) - Track E acceptance passed for run/trace artifact usability with validator module, script, and validation report - next: move to L1 baseline and smoke rubric layering.`
- `[2026-03-17][Track E] L1-D started (⬜ -> 🔄) - implementation started for H1 single-agent baseline reference path to anchor Wave 1 orchestration comparisons - next: deliver baseline workflow/agent wiring plus validation tests.`
- `[2026-03-17][Track E] L1-D completed (🔄 -> ✅) - H1 single-agent baseline path shipped as h1.single.v1 with baseline agent pack wiring, mock output shaping, and test coverage for contract + end-to-end execution - next: feed baseline evidence into L1-I and L1-L comparison work.`
- `[2026-03-19][Track E] L1-I started (⬜ -> 🔄) - H1 smoke comparison implementation started for baseline vs manager vs handoff on matched input with artifact validation and normalization - next: ship comparison module, script, tests, and evidence report.`
- `[2026-03-19][Track E] L1-I completed (🔄 -> ✅) - comparison harness delivered with per-variant run+trace artifact validation, normalized H1 output fields, and structural trace evidence for baseline/manager/handoff runs - next: feed evidence into L1-K rubric and L1-L decision prep.`
- `[2026-03-19][Track E] W1-S2-FIX-E1 started (⬜ -> 🔄) - stabilization hardening started for L1-I false-green risk so envelope-only comparable outputs cannot pass comparison readiness - next: tighten completeness gating and add negative tests.`
- `[2026-03-19][Track E] W1-S2-FIX-E1 completed (🔄 -> ✅) - L1-I now gates success on full comparable-key completeness with strict script exit semantics and negative-path test coverage for missing normalized keys - next: Track A completes W1-S2-FIX-A1/A2 before Meta stabilization closeout.`
- `[2026-03-21][Track E] L1-K started (⬜ -> 🔄) - Wave 1 H1 manual smoke rubric v1 implementation started from stabilized L1-I comparison and W1-S2 parity fixes - next: publish operator-facing rubric with explicit completeness gates and outcomes.`
- `[2026-03-21][Track E] L1-K completed (🔄 -> ✅) - H1 manual smoke rubric v1 published in docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md with matched-input procedure, variant-specific sanity checks, and PASS/PARTIAL/FAIL/BLOCKED taxonomy - next: proceed to L1-L evidence prep.`
- `[2026-03-22][Track E] L1-L evidence prep started (⬜ -> 🔄) - Track E began Wave 1 comparison evidence packaging from L1-I + L1-K outputs with explicit trace-viewer guidance and prompt provenance context - next: publish evidence-prep report and recommendation draft for Meta closeout.`
- `[2026-03-22][Track E] L1-L evidence prep completed (🔄 -> ✅ Track E scope) - evidence package shipped via eval module/script and docs/wave1/Wave1-L1-L-H1-Evidence-Prep.md, including structural summary, tradeoff notes, and provenance-only prompt tag reporting - next: Meta executes L1-L decision-log closeout.`
- `[2026-03-22][Meta] L1-L decision log closeout completed (🔄 -> ✅) - Meta accepted the Wave 1 evidence package, chose `h1.manager.v1` as the default next multi-agent reference path, preserved `h1.single.v1` as baseline anchor and `h1.handoff.v1` as a learning/reference variant, and moved the mainline frontier to W2-S1 - next: Track B starts H2-A/H2-B/H2-C while docs-only CV0 becomes allowed side work.`
- `[2026-03-20][Track A] W1-S2-FIX-A1/A2 started (⬜ -> 🔄) - Track A stabilization implementation started to restore H1 variant summary parity and include handoff linkage fields in JSON trace output - next: complete formatter + regression tests and close A1/A2.`
- `[2026-03-20][Track A] W1-S2-FIX-A1/A2 completed (🔄 -> ✅) - CLI summary now gives H1 variant parity across single/manager/handoff and JSON trace events preserve parent/correlation linkage fields, with regression coverage in tests/cli/test_l1_e_h1_summary.py - next: Meta executes W1-S2-FIX-META1 closeout.`
- `[2026-03-17][Track A] L1-E started (⬜ -> 🔄) - implementation started for H1 manager run readability improvements in CLI summary output against L1-C output contracts - next: add H1-aware text/json summary and orchestration-focused formatting.`
- `[2026-03-17][Track A] L1-E completed (🔄 -> ✅) - CLI now surfaces H1 final_output and manager_orchestration in readable summary sections with lane/turn trace rollups and coverage in tests/cli/test_l1_e_h1_summary.py - next: support Track E baseline comparison interpretation with clearer manager run evidence.`
- `[2026-03-20][Track A] L1-J started (⬜ -> 🔄) - basic trace viewer/timeline summary implementation started from persisted trace artifacts so handoff-linked runs can be inspected without raw JSON spelunking - next: land `fal trace show --run-id` and linkage-aware timeline rendering.`
- `[2026-03-20][Track A] L1-J completed (🔄 -> ✅) - CLI now supports `trace show --run-id` for stored trace artifacts with text/json timeline output, event/lane rollups, and preserved parent/correlation linkage fields, plus regression coverage in tests/cli/test_l1_j_trace_viewer.py - next: proceed with remaining W1-S3 epics (`L1-L`, `L1-M`) toward Wave 1 closeout.`
- `[2026-04-02][Track E] H2-E started (⬜ -> 🔄) - Wave 2 replay foundation implementation opened with artifact-backed scope only (`run_id + data_dir`, shared path resolver, mandatory artifact_acceptance preflight) - next: deliver reconstruction report + script + tests for H1 family artifacts.`
- `[2026-04-02][Track E] H2-E completed (🔄 -> ✅) - artifact-backed replay/read/reconstruction shipped via src/fractal_agent_lab/evals/artifact_replay.py and scripts/run_h2_e_artifact_replay.py with v0/v1 compatibility, linkage-aware timeline/orchestration/failure summaries, and negative-path preflight blocking tests - next: proceed to H2-F/H2-G while Track C closes H2-I/H2-J/H2-M.`
- `[2026-04-03][Track C] H2-I/H2-J completed (🔄 -> ✅) - H2-J removed misleading manager-pack handoff topology and aligned manager-pack validation/tests to `manager_spec` + manager control authority; H2-I delivered M1 session-memory foundation using `input_payload.session_id` lookup, JSON store under data/memory/sessions, run-context injection, and optional per-run sidecar snapshot (non-canonical) with negative-path/context pass-through tests - next: proceed to H2-K/H2-N and Track E H2-F/H2-G.`
- `[2026-04-03][Track E] H2-F/H2-G started (⬜ -> 🔄) - Track E started W2-S2 Step 2 replay-backed smoke and additive baseline-tagging work on top of H2-E with strict no-rerun/no-scoring guardrails - next: deliver stored-artifact smoke suite, baseline/provenance tags, scripts, tests, and Wave 2 doc.`
- `[2026-04-03][Track E] H2-F/H2-G completed (🔄 -> ✅) - H2-F shipped as stored-artifact H1 smoke suite and H2-G shipped as additive baseline/provenance tagging, both replay-backed via artifact_acceptance + artifact_replay with completeness discipline preserved and no run/trace schema mutation - next: proceed to H2-H draft while Track C closes H2-K/H2-N.`
- `[2026-04-03][Track C] H2-K completed (🔄 -> ✅) - memory candidate extraction policy v1 delivered with deterministic success-only/session-tagged H1 extraction and optional non-canonical `memory_candidates.json` sidecar artifact under `data/artifacts/<run_id>/`, including tests for no-session/failure gates and canonical session-store non-mutation - next: continue H2-N and hand off H2-K outputs to Track E H2-L.`
- `[2026-04-03][Track C] H2-N completed (🔄 -> ✅) - identity updater v0 delivered with `identity.signal.v0` envelope normalization, documented derived fallback, bounded post-run profile updates, profile save + snapshot append, and non-canonical `identity_update.json` sidecar artifact; CLI integration is config-gated and explicitly non-fatal on updater errors, with no core runtime/schema churn - next: hand off to Track B H2-N boundary review and Track E H2-O dependency chain.`
- `[2026-04-03][Track E] H2-H draft started (⬜ -> 🔄) - Track E opened W2-S2 Step 3 as doc-only regression checklist drafting from H2-E/H2-F/H2-G evidence with strict bucket semantics and no hidden contract enforcement - next: publish draft checklist and hand off Track B confirmation candidates for W2-S3.`
- `[2026-04-03][Track E] H2-H draft completed (🔄 -> ✅ Track E draft scope) - regression checklist draft published in docs/wave2/Wave2-W2-S2-TrackE-H2-H-Draft-Regression-Checklist.md with explicit buckets (enforced now vs observed expectations vs Track B confirmation candidates), RF-2026-03-19-02 false-green anchor preserved, and Track C compatibility watchpoints kept non-gating - next: Track B executes W2-S3 H2-H contract confirmation scope (still open).`
- `[2026-04-04][Track B] W2-S3 Step 1 H2-H/H2-N completed (🔄 -> ✅) - H2-H contract confirmation finalized shared invariants vs eval-local policy and corrected checklist doc/code drift; H2-N boundary review confirmed additive sidecar boundaries with explicit orphan-tolerant updater behavior and accepted provenance simplification for current scope, backed by targeted negative-path tests - next: Track E executes W2-S3 Step 2 (`H2-L`/`H2-O`).`
- `[2026-04-04][Track E] H2-L/H2-O started (⬜ -> 🔄) - Track E opened W2-S3 Step 2 with manager-first H2-L memory-materiality eval and run-id-first H2-O drift smoke, preserving strict no-schema-churn/no-routing/no-prompt-rewrite boundaries - next: deliver eval modules, scripts, tests, and Wave 2 implementation note.`
- `[2026-04-05][Track E] H2-L/H2-O completed (🔄 -> ✅) - H2-L shipped with canonical session-memory load-path validation plus pair-level session-store restoration and conservative materiality labeling, while H2-O now requires real updater evidence, respects configured identity-store subdirs, validates present canonical artifacts, and still keeps orphan sidecars warning-grade only - next: Meta executes Wave 2 closeout sequencing.`
- `[2026-04-04][Track E] CV0-C started (⬜ -> 🔄) - docs-only H5 review/gate policy review started with explicit scope boundary (CV0 policy review, not CV2 execution), control-surface alignment checks, and false-green guardrail preservation - next: publish H5 review outcome package and apply targeted cross-doc wording alignment.`
- `[2026-04-04][Track E] CV0-C completed (🔄 -> ✅) - Track E delivered docs/private/Coding-Vertical-H5-Review-Gate-Policy-Review-v01.md and tightened canonical H5 policy wording for OpenCode-anchored control-surface alignment, anti-false-green evidence language, artifact-contract consumption boundaries, and explicit CV0-vs-CV2 separation without runtime/schema/tooling changes - next: Meta executes CV0-D closeout and CV1 prereq note.`
- `[2026-04-10][Track B] W3-S1 Step 2 R3-A schema review completed (🔄 -> ✅ Track B scope) - Track B confirmed H2 manager-schema/runtime boundary compatibility, hardened WorkflowSpec manager invariants to reject missing/unknown/duplicate worker topology and manager-entrypoint mismatch before runtime, and expanded negative-path manager invariant coverage - next: Track C continues R3-B and downstream W3-S1 sequencing.`
- `[2026-04-10][Track E] R3-D skeleton prep started (⬜ -> 🔄) - Track E opened W3-S1 Step 3 docs-first H2 smoke-rubric skeleton work after R3-A review + R3-B runnable baseline, with explicit provisional-only boundary and no eval/runtime expansion - next: publish skeleton artifact and keep finalization gated on R3-C.`
- `[2026-04-10][Track E] R3-D skeleton prep completed (stays 🔄 at epic level) - Track E published docs/wave3/Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-Skeleton.md with explicit Step-3-only provisional semantics (current runnable evidence vs deferred finalization), while keeping Step 4 finalize blocked on R3-C output-template completion - next: finalize R3-D after R3-C.`
- `[2026-04-10][Track C] R3-C completed (⬜ -> ✅) - H2 output-template v1 frozen with canonical section ordering, planner-owned `recommended_starting_slice`, and stricter mock finalization shape checks (including implementation-wave item validation) while keeping template-law assertions on runnable acceptance/doc surfaces instead of shared workflow-spec compatibility tests - next: Track E finalizes R3-D smoke rubric in Step 4.`
- `[2026-04-11][Track E] R3-D finalize started (⬜ -> 🔄) - Track E opened W3-S1 Step 4 finalize for the final H2 smoke rubric using `R3-C` frozen ordering/shape constraints while preserving the Step-3 skeleton as the immutable historical artifact.`
- `[2026-04-11][Track E] R3-D finalized (🔄 -> ✅) - Track E released `docs/wave3/Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-v1.md` as final `R3-D` output, and the active mainline moved to `W3-S2` Step 1 (`R3-E`) while `W3-S1` Step 4 stays closed.`
- `[2026-04-11][Track C] R3-E completed (⬜ -> ✅) - H3 workflow schema v1 delivered as `h3.manager.v1` with explicit manager topology (`synthesizer` + `intake`/`planner`/`systems`/`critic`), manager-envelope compatibility assertions on workflow-spec tests (`step_results` + `manager_orchestration` + `final_output`), and explicit deferral of exact H3 section naming/order freeze to `R3-G`; next: Track B executes `R3-E` schema review while Track C proceeds to `R3-F` in Step 2.`
- `[2026-04-12][Track B] W3-S2 Step 2 R3-E schema review completed (🔄 -> ✅ Track B scope) - Track B confirmed `h3.manager.v1` as a generic manager-contract-compatible schema with unchanged top-level manager envelope (`step_results`/`manager_orchestration`/`final_output`), validated deferred H3 section-law boundaries (`R3-G`), and found no new generic manager contract hole; this step remains in-progress only for parallel Track C `R3-F` execution.`
- `[2026-04-12][Track C] R3-F completed (⬜ -> ✅) - H3 manager role pack v1 delivered under `agents/h3` with explicit intake/planner/systems/critic/synthesizer separation, manager-only pack validation, `h3.manager.v1` registry wiring, and H3-specialized mock manager behavior with strict upstream-context and malformed-output fail-loud guards; runnable tests prove explicit delegate/finalize turn evidence while keeping H3 section naming/order as current runnable defaults only (final freeze deferred to `R3-G`).`
- `[2026-04-12][Track E] R3-H skeleton prep started (⬜ -> 🔄) - Track E opened W3-S2 Step 3 docs-first H3 smoke-review skeleton work on top of `R3-E` + Track B `R3-E` review + `R3-F`, with explicit provisional-only semantics and no eval/module/runtime expansion; final freeze stays blocked on `R3-G`.`
- `[2026-04-12][Track E] R3-H skeleton prep completed (stays 🔄 at epic level) - Track E published docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-Skeleton.md with explicit Step-3 boundary (`current runnable evidence` vs deferred `R3-G` section-law freeze), keeping `R3-H` Step 4 finalize as the post-`R3-G` gate.`
- `[2026-04-12][Track C] R3-G completed (⬜ -> ✅) - H3 output sections are now frozen at exact canonical naming/order (`strengths`, `bottlenecks`, `merge_risks`, `refactor_ideas`) with synthesizer prompt/pack version alignment (`h3.prompt.v2`, `h3/synthesizer/v2`) and exact-order assertions on runnable H3 manager acceptance tests; manager-envelope compatibility remains unchanged and evaluator stays deferred.`
- `[2026-04-13][Track E] R3-H finalize started (⬜ -> 🔄) - Track E opened W3-S2 Step 4 finalize for final H3 smoke review v1 using frozen `R3-G` section-law, preserving the Step-3 skeleton as a historical artifact and keeping docs-first/no-scope-creep boundaries.`
- `[2026-04-13][Track E] R3-H finalized (🔄 -> ✅) - Track E published `docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-v1.md` as final manual rubric v1, closed W3-S2 Step 4, and moved active mainline focus to W3-S3 Step 1 (`R3-I`/`R3-J`/`R3-K`).`
- `[2026-04-14][Track A] R3-J started (⬜ -> 🔄) - Wave 3 trace-viewer uplift implementation started to add multi-workflow trace browsing while preserving strict single-run drill-down semantics - next: ship `trace list` with explicit browse failure policy and regression coverage.`
- `[2026-04-14][Track A] R3-J completed (🔄 -> ✅) - Track A delivered multi-workflow trace browsing via `trace list` with workflow/status filtering, row-level degrade handling for broken artifact pairs, and preserved fail-loud `trace show` behavior, with coverage in tests/cli/test_r3_j_trace_browser.py - next: continue W3-S3 Step 1 parallel lane until `R3-I` and `R3-K` close.`
- `[2026-04-14][Track E] R3-K started (⬜ -> 🔄) - Track E opened W3-S3 Step 1 compare implementation with explicit split: reuse replay-backed H1 variant comparison surfaces and add replay-backed H2 multi-run comparability surface for `h2.manager.v1`; artifact-path claims stay bound to replay/validation outputs.`
- `[2026-04-14][Track E] R3-K completed (🔄 -> ✅) - Track E delivered `R3-K` via `docs/wave3/Wave3-W3-S3-TrackE-R3-K-H1-H2-Comparison-v1.md`, added H2 compare contracts/projections/report+script with fail-loud tests, and left W3-S3 Step 1 in progress while `R3-I` remains open.`
- `[2026-04-14][Track C] R3-I completed (⬜ -> ✅) - Track C delivered project-memory v1 (`M2`) with explicit `project_id`-keyed canonical store (`data/memory/projects/<project_id>.json`), additive project-memory context loading, and non-fatal post-run updater flow for successful `h2.manager.v1`/`h3.manager.v1` runs, with deterministic anti-noise merge/dedupe and explicit canonical-vs-sidecar separation.`
- `[2026-04-14][Track E] R3-L evidence curation completed (⬜ -> ✅ Track E Step 2 scope) - Track E published `docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md` plus explicit-run-id helper/script/tests (`r3_l_evidence_curation`) with disclosure and schema-version-labeled curated manifest; bounded H2 current-corpus sweep truth is explicit (`comparison_ready: false`), H1 is labeled replay-backed historical evidence, and M2 remains not demonstrated for selected runs - next: Track A executes W3-S3 Step 3 presentation packaging.`
- `[2026-04-14][Track A] R3-L presentation packaging started (⬜ -> 🔄) - Track A opened W3-S3 Step 3 in docs-first mode to package Track E curated evidence truth with bounded README updates and explicit disclosure requirements - next: publish Track A R3-L packaging delivery doc and close coordination surfaces.`
- `[2026-04-14][Track A] R3-L presentation packaging completed (🔄 -> ✅) - Track A published `docs/wave3/Wave3-W3-S3-TrackA-R3-L-Presentation-Packaging.md`, refreshed README current-focus/presentation wording with local-data boundedness, and completed W3-S3 Step 3 without introducing a new CLI presentation command.`
- `[2026-04-15][Track D] R3-M started (⬜ -> 🔄) - Track D opened Wave 3 side-batch Step 1 with explicit scope lock (`h1.single.v1` anchor only), provider-boundary-only adapter changes, and fake-transport proof guardrail - next: implement OpenRouterAdapter MVP with strict JSON-object parse/fail-loud behavior and no semantic repair fallback.`
- `[2026-04-15][Track D] R3-M completed (🔄 -> ✅) - Track D delivered OpenRouterAdapter MVP config plumbing + strict JSON-object-only normalization with requested-vs-response model inspectability, validated real `HTTPError` plus envelope/content negative paths and `h1.single.v1` fake-transport integration proof, and published a dedicated Wave 3 delivery doc for downstream `R3-N/R3-O/R3-P` sequencing.`
- `[2026-04-15][Track D] R3-N started (⬜ -> 🔄) - Track D opened Wave 3 side-batch Step 2 with explicit routing-policy-v1 scope (`mock`/`openrouter` only) so provider selection truth is canonical before `R3-O` failure/fallback work - next: remove implicit first-enabled routing and align CLI override handling to the same provider-policy source.`
- `[2026-04-15][Track D] R3-N completed (🔄 -> ✅) - Track D shipped explicit routing policy v1 with `mock`/`openrouter` bounded targets, removed implicit first-enabled routing, and aligned CLI `--provider` override to the same canonical policy source while preserving inspectable selection metadata in step raw output.`
- `[2026-04-15][Track D] R3-O started (⬜ -> 🔄) - Track D opened conservative failure/fallback hardening on top of `R3-N` routing law with explicit policy gates (`none` default, `conservative_mock` opt-in) and strict no-runtime-redesign guardrails.`
- `[2026-04-15][Track D] R3-O completed (🔄 -> ✅) - Track D delivered single-attempt `openrouter -> mock` conservative fallback only for recoverable provider failures, kept router as selection-only truth, and added provider-attempt/fallback inspectability in step raw + failure details with bounded adapter/CLI tests and Wave 3 delivery documentation.`
- `[2026-04-16][Track E] R3-P completed (⬜ -> ✅ Track E Step 3 scope) - Track E delivered `docs/wave3/Wave3-W3-SB-TrackE-R3-P-H1-Real-Provider-Smoke-Evidence-v1.md` with bounded `h1.single.v1` + `openrouter` live+inspect evidence, implemented artifact-backed helper/script/tests (`r3_p_h1_real_provider_smoke`), and kept `track_e_evidence_ready` separate from `real_provider_smoke_passed` while reading provider/fallback truth directly from canonical run artifacts.`
- `[2026-04-18][Track C] CV1-A completed (⬜ -> ✅) - Track C delivered `h4.wave_start.v1` with a narrow manager topology (`repo_intake`, `architect_critic`, `synthesizer`), canonical `context_report.json` sidecar writing on the existing `fal run` path (`workflow_id: h4`, `workflow_variant: h4.wave_start.v1`), and CLI-level integration proof while deferring adapter specialization/helper-surface expansion to later CV1 steps.`
- `[2026-04-18][Track D] CV1-C started (⬜ -> 🔄) - Track D opened CV1 Step 2 helper/compiler work with strict guardrails: wave_start-only packet compilation derived from canonical H4 context-report truth, additive CLI hook only, and no queue/inbox/outbox or session-bus expansion.`
- `[2026-04-18][Track D] CV1-C completed (🔄 -> ✅) - Track D delivered `docs/wave3/Wave3-CV1-C-TrackD-H4-Helper-Surface-v1.md` with a thin `tools` packet compiler (`wave_start` only), non-canonical transport sidecar writing under `artifacts/<run_id>/packets/`, and bounded tests proving compile/render/write behavior while keeping Track C planning artifacts and future `h4.seq_next.v1` runnable mock-seam proof out of this step.`
- `[2026-04-18][Track C] CV1-B completed (⬜ -> ✅) - Track C delivered `h4.seq_next.v1` as a separate planning workflow (`repo_intake`, `planner`, `architect_critic`, `synthesizer`) with required `implementation_plan.md` and `acceptance_checks.json` artifact writing on the canonical `fal run` path, preserved caution/risk/non-goal surfaces in finalized output/artifacts, and kept default-mock runnable proof as an explicit shared-boundary checkpoint rather than silently widening adapter ownership.`
- `[2026-04-22][Meta] H4 live evidence blocker cleared - post-CV1 live hardening produced run `a887ffe1-617b-426b-a1bf-d7263d022673` with full manager chain, canonical `implementation_plan.md` + `acceptance_checks.json`, and `CV1-D PASS`; this clears the old missing-evidence blocker but does not auto-start `CV2` - next: treat `CV2` as ready-but-inactive optional side-vertical work until explicitly chosen.`
- `[2026-04-25][Track D] P4-A status synced - Wave 4 `P4-A` OpenAI-compatible adapter MVP is recorded complete from `docs/wave4/Wave4-W4-S1-TrackD-P4-A-OpenAI-Compatible-Adapter-MVP.md`; active W4-S1 frontier moves to parallel `P4-B` / `P4-C` - next: Track E/Track D run cross-provider smoke comparison and routing hardening when chosen.`
- `[2026-04-25][Track D] P4-C accepted after Meta re-review - routing policy hardening v2 now fail-louds malformed provider/model-policy blocks, requires resolved models for real providers, and keeps conservative fallback compatible only with `openrouter -> mock`; this satisfies the routing prerequisite for OpenRouter-first `P4-D` under the exception below.`
- `[2026-04-25][Track E] P4-B surface accepted but evidence gate remains open - cross-provider smoke helper/script/tests/doc are implemented for `h1.single.v1`, but no real `openrouter` + `openai` PASS pair is recorded yet; `P4-B` remains blocked/deferred while OpenRouter-first `P4-D` may proceed without provider-parity claims under the exception below.`
- `[2026-04-25][Meta] OpenRouter-first W4-S2 exception accepted - `P4-B` remains blocked/deferred by missing `OPENAI_API_KEY`, but `P4-D` may open as OpenRouter-first provider pressure hardening without cross-provider parity claims; final provider-parity evidence remains blocked until a real OpenAI key exists.`
- `[2026-04-26][Track D] P4-D accepted after Meta re-review - OpenRouter-first retry/backoff handling v1 is complete with opt-in retry config, fail-loud malformed retry blocks including explicit null, retry evidence preserved through direct OpenRouter and fallback-backed success paths, and no OpenAI/provider-parity claims - next: `P4-F` technical routing notes may start; `P4-E` remains optional only by explicit choice.`
- `[2026-04-27][Track D] P4-E accepted after Meta step review - optional local adapter MVP with routing integration is complete under explicit user choice, `local` remains disabled by default, requires explicit selection and a resolved model, preserves `openrouter -> mock` as the only conservative fallback route, and makes no live local/runtime/provider-parity claim - next: `P4-F` technical routing notes should incorporate P4-D + P4-E evidence.`
- `[2026-04-27][Meta] P4-F policy closeout completed - Track D technical routing notes and Meta rollout guidance now define current provider route guidance, model-tier usage, and no-claim boundaries; Wave 4 provider-expansion work is operationally closed under the OpenRouter-first exception, while `P4-B` live provider-parity evidence remains blocked/deferred until `OPENAI_API_KEY` exists.`
- `[2026-05-01][Track E] P4-B live evidence closeout completed - bounded `h1.single.v1` OpenRouter + OpenAI provider-path smoke now reaches `PASS` with matched input, no fallback, replay-ready canonical artifacts, and disclosed model provenance; this closes the old credential blocker without making provider-quality parity claims.`
- `[2026-04-27][Meta] CV2 explicitly activated - thin H5 review/gate side-vertical Step 1 is now open with `CV2-A` Track E findings-first review artifact and `CV2-B` Track D then Track E test-evidence capture/sufficiency path running in parallel; this does not introduce implementation automation or change Wave 4 provider-parity blockers.`
- `[2026-04-27][Meta] CV2 Step 1 accepted - `CV2-A` and `CV2-B` artifacts are complete, Track D fixed `RF-2026-04-27-01` in `6fb49cf`, Track E sufficiency review allows `CV2-C` to start, and no provider-parity/live OpenAI claims are introduced.`
- `[2026-04-30][Meta] CV2 thin H5 slice completed - `CV2-C` advisory commit-gate passed in `0cc3da5`, `CV2-D` private-learning closeout records cautious lessons without immediate policy/registry edits, and H4 Assist Cycle 1/2 both validated skip-first ROI behavior; provider parity remains blocked by `P4-B` live OpenAI evidence.`
- `[2026-05-06][Meta] Wave 5 closeout accepted - U5-A through U5-F are complete after Track A U5-E implementation (`257892a`), Track A review fixes (`26fa0cf`), and Track E GREEN no-claim/semantics review; Wave 5 now provides a bounded local operator workbench for browsing and acting on workflow evidence without OpenCode automation, autonomous dispatch, commit authority, provider/model ranking, or quality-scoring claims - next: Wave 6 may move to explicit planning/evidence-ledger-first kickoff only by Meta sequencing decision.`
- `[2026-05-07][Meta] Wave 6 W6-S1 sequencing opened - W6-S1 is active at sequencing level with first Track implementation target `⬜ READY` (`W6-A` Track B packet/ledger contract), the detailed private planning reference is `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md`, and the first slice is manual/semi-manual evidence-ledger capture without OpenCode API/session delivery automation.`
- `[2026-05-08][Meta] W6-S1 Step 2 accepted after review fixes - Track B `W6-B` state-machine validation and Track E `W6-C` manual evidence recorder are GREEN in `62bd245` after RED false-green findings were fixed; next: run Track C payload-semantics checkpoint, then choose the bounded `W6-D` real-loop capture target.`
- `[2026-05-08][Meta] Track C W6-D preflight payload-semantics checkpoint accepted - W6-D may proceed to Meta target/scope selection with guardrails: known commands/non-unknown tracks are stronger evidence, `payload_summary` alone is insufficient, `clean_pass` must be interpreted alongside review findings, and one seed row is not broad usefulness proof.`
- `[2026-05-11][Meta] W6-D Step 3A capture brief completed - `docs/private/Wave6-W6-S1-Meta-W6-D-Step3A-Capture-Brief.md` selects the W6-S1 Step 2 W6-B/W6-C shared-boundary review/fix loop leading to `62bd245`; next: Track E runs W6-D Step 3B capture/evaluation with W6-C and returns private evidence plus continue/narrow/stop/insufficient-data recommendation.`
- `[2026-05-11][Meta] W6-D accepted and W6-S2 opened - Track E captured `w6d-fal-w6bc-review-fix-20260508` as private single-loop seed evidence with warnings, preserved the missing historical transcript limitation, kept recorder `net_recommendation: insufficient_data`, and returned a separate `continue` handoff recommendation; next: W6-E second private loop capture is READY, while W6-G bridge/API readiness remains blocked until W6-F usefulness evidence.`
- `[2026-05-11][Meta] W6-E target selected and handoff clarified - `docs/private/Wave6-W6-S2-Meta-W6-E-Capture-Brief.md` selects `w6e-fal-project-state-protocol-20260511` as a governance/context-continuity evidence loop; W6-S2 now names Track E as the next responsible actor, W6-F as waiting, and W6-G as blocked.`

---

## 19. Final summary

This plan deliberately separates **strategic ambition** from **execution discipline**.

The project is allowed to grow toward:
- multi-agent orchestration patterns
- reusable runtime engine
- research OS usefulness
- provider diversity
- workbench UX
- evidence-backed OpenCode coordination loops

But it is only allowed to do so by moving through these earned steps:

```text
Foundation
-> Swarm-first Lab
-> Engine Hardening
-> Research OS Usefulness
-> Provider Expansion
-> Workbench
-> Evidence-backed OpenCode Coordination
```

That sequence is the core anti-chaos mechanism of the whole project.
