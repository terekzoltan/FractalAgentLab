# Combined Execution Sequencing Plan

**Project:** Fractal Agent Lab  
**Owner:** Meta Coordinator  
**Scope:** Track-level execution ordering for the A1 + A2 + A3 hybrid roadmap  
**Intent:** turn `ops/AGENTS.md` from a coordination map into an actually executable wave / sprint plan  
**Status:** active planning document  
**Last updated:** 2026-04-25

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

### Session labels used in execution tables
- `Meta Coordinator session` = coordination/status/review/planning only
- `Track A agent session` = UX / CLI / trace viewer implementation session
- `Track B agent session` = runtime / state / execution implementation session
- `Track C agent session` = agent logic / prompts / memory / identity implementation session
- `Track D agent session` = provider / adapter / routing implementation session
- `Track E agent session` = eval / replay / smoke / benchmark implementation session
- When multiple epics are listed on one row, the default meaning is: run them as one focused batch in the same session unless the notes say otherwise

### Execution-step structuring rule
- if two or more tracks can work in parallel safely, keep them in the same numbered step
- if one item must wait for another, move it to the next numbered step
- use a separate later step only for true dependency, true gating, or explicit optional/conditional work

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
   - `ops/AGENTS.md`
   - this `ops/Combined-Execution-Sequencing-Plan.md`
   - any directly referenced plan for the workflow / track

2. If prerequisites are not `✅`, the track agent must explicitly report:
   - `NOT READY`
   - blocking prerequisite
   - allowed fallback work, if any

3. If prerequisites are complete, the track agent reports:
   - `READY`
   - epic name
   - expected owned files / areas

4. When implementation starts:
   - epic status becomes `⬜ -> 🔄`

5. When local implementation is done:
   - run acceptance gate
   - if required, request cross-track verification
   - only then mark `✅`

6. A consuming track must not silently adapt to a broken producer contract.
   - if schema mismatch appears, create a coordinator-visible note
   - add uzenofal entry if shared contract changed

7. If an epic changes a shared schema, these are mandatory:
   - schema version note
   - affected tracks listed
   - replay / smoke impact noted

8. A wave is not complete until all **mandatory** epics of that wave are `✅` and open risks are documented.

9. Public portfolio repo sync is **not** implied by epic completion.
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
- 🚫 **P4-B** cross-provider smoke comparison (`openrouter` vs `openai`) — **Owner: Track E + Track D**
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

**🚫/✅ Step 2 — comparison evidence is blocked, routing hardening is complete**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | 🚫 P4-B | P4-A ✅ | Comparison helper/script/tests/doc are implemented, but live `PASS` evidence is blocked by missing `OPENAI_API_KEY`; no provider-parity claim is made |
| Track D agent session | ✅ P4-C | P4-A ✅ | Routing policy hardening v2 landed: malformed config blocks fail loudly, real providers require resolved models, and `conservative_mock` stays bounded to `openrouter -> mock` |

Pragmatic gate decision:
- `P4-B` remains blocked/deferred until an `OPENAI_API_KEY` exists and a real `openrouter` + `openai` run pair reaches `PASS`
- because the operator runtime is OpenRouter-first, `P4-D` may open as **OpenRouter-first rate-limit/backoff hardening** without claiming cross-provider parity
- this exception does not mark `P4-B` complete and does not permit provider-quality or OpenAI-live claims

#### Sprint W4-S2 — Rate-limit/backoff and optional local widening

Epics:
- ⬜ **P4-D** rate-limit/backoff handling v1 — **Owner: Track D**
- ⬜ **P4-E** optional local or secondary adapter experiment — **Owner: Track D**
- ⬜ **P4-F** routing notes: which tasks deserve which model tier — **Owner: Track D + Meta**

**Sequential ordering:**
1. P4-D is the mainline hardening unit and may start under the OpenRouter-first exception above
2. P4-E is an optional side lane only by explicit choice; do not open it just because P4-D is open
3. P4-F after P4-D (and optionally incorporating P4-E evidence if that experiment ran)

**P4-E execution rule:**
- P4-E is explicitly optional and non-blocking for Wave 4 closure
- If separate session capacity exists: P4-E may run as a side lane alongside P4-D
- If no separate capacity: P4-E runs after P4-D completes
- P4-E must stay isolated from mainline provider paths regardless of timing

**Execution assignment for co-owned epic:**
- `P4-F`: **Track D -> Meta**
  - Track D prepares technical routing evidence and model-tier recommendations
  - Meta finalizes policy note and cross-track rollout guidance

### Sprint W4-S2 — Execution Steps

**⬜ Step 1 — Track D hardens rate-limit/backoff behavior (P4-E may run as side lane if capacity exists)**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | P4-D | P4-A ✅ + P4-C ✅ + P4-B implementation surface accepted / OpenAI live evidence deferred | OpenRouter-first provider pressure-handling; must not claim cross-provider parity |
| Track D agent session (optional side lane) | P4-E | P4-D explicitly allowed or complete | Optional only by separate explicit choice; keep isolated from mainline paths |

**⬜ Step 2 — Track D prepares routing guidance**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | P4-F (technical routing notes) | P4-D ✅ | Prepare evidence-backed model-tier recommendations, incorporating `P4-E` only if that experiment actually ran |

**⬜ Step 3 — Meta finalizes the rollout note**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | P4-F (policy closeout) | P4-F technical routing notes ✅ | Convert technical notes into cross-track guidance without reopening adapter design |

### Wave 4 gate to close the wave
- same workflow can run through at least two real adapter routes
- routing policy is documented and evidence-backed
- rate-limit/backoff behavior is documented and bounded
- core logic does not fork per provider

Current exception note:
- OpenAI-compatible adapter behavior is proven by adapter-boundary/fake-transport evidence, but live OpenAI evidence is deferred until an `OPENAI_API_KEY` exists
- Wave 4 may continue through OpenRouter-first hardening because the operator runtime path is OpenRouter-first
- final provider-parity claims remain blocked until `P4-B` live evidence reaches `PASS`

---

## Wave 5 — Workbench

**Wave goal:** move from engine quality to usability and portfolio presentation.  
**Primary value:** trace browsing, run management, easier demoability.  
**Constraint:** presentation cannot outrun reliability.

### Wave 5 mandatory outputs
- minimal web UI exists
- trace browsing is no longer painful
- run/result comparison is visible
- portfolio-quality narrative exists around the system

### Wave 5 sprint breakdown

#### Sprint W5-S1 — Minimal web shell

Epics:
- ⬜ **U5-A** web shell / local UI — **Owner: Track A**
- ⬜ **U5-B** run listing and run detail page — **Owner: Track A**
- ⬜ **U5-C** trace timeline page — **Owner: Track A**

**Sequential ordering:**
1. U5-A first (web shell is the foundation)
2. U5-B and U5-C can proceed in parallel after U5-A

### Sprint W5-S1 — Execution Steps

**⬜ Step 1 — Track A builds the web shell first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | U5-A | Wave 4 ✅ | Presentation starts only after the system deserves one |

**⬜ Step 2 — run browsing and trace browsing consume the shell in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | U5-B | U5-A ✅ | Build run listing/detail on top of the shell |
| Track A agent session | U5-C | U5-A ✅ | Build the trace timeline page without hiding the underlying trace reality |

#### Sprint W5-S2 — Workbench primitives

Epics:
- ⬜ **U5-D** workflow launch form — **Owner: Track A**
- ⬜ **U5-E** compare two runs — **Owner: Track A + Track E**
- ⬜ **U5-F** inspect stored project memory and eval summary — **Owner: Track A**

**Sequential ordering:**
1. U5-D first (launch form is prerequisite for useful comparison)
2. U5-E comparison spec and U5-F can proceed in parallel after U5-D
3. U5-E UX implementation after the comparison spec exists

**Execution assignment for co-owned epic:**
- `U5-E`: **Track E -> Track A**
  - Track E defines comparison metrics and validation expectations
  - Track A implements UX and interaction flow for run comparison

### Sprint W5-S2 — Execution Steps

**⬜ Step 1 — Track A lands the workflow launch primitive first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | U5-D | U5-A ✅ + U5-B ✅ + U5-C ✅ | Launching workflows through the UI should come after basic browsing already works |

**⬜ Step 2 — Track E defines comparison semantics while Track A can build memory/eval inspection in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | U5-E (comparison spec/metrics) | U5-D ✅ | Define comparison semantics before UI implementation guesses |
| Track A agent session | U5-F | U5-D ✅ | Memory/eval inspection depends on the workbench shell, not on comparison semantics |

**⬜ Step 3 — Track A implements comparison UX on top of Track E's comparison semantics**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | U5-E (UX implementation) | U5-E comparison spec ✅ + U5-D ✅ | Run comparison UX should consume Track E's validation semantics instead of guessing them |

### Wave 5 gate to close the wave:**
- system is presentable without manually spelunking folders
- portfolio/demo narrative is supported by the UI
- UI does not hide key trace/eval realities

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
Wave 0 is complete.
Wave 1 core closeout is complete through `L1-J` / `L1-K` / `L1-L` / `L1-M`.
Wave 2 Sprint `W2-S1` is complete (`H2-A` / `H2-B` / `H2-C` / `H2-D` ✅).
Wave 2 Sprint `W2-S2` is complete through Step 3 (`H2-E` / `H2-F` / `H2-G` + `H2-H` draft).
Wave 2 Sprint `W2-S3` is complete through Step 2 (`H2-H` confirmation + `H2-N` boundary review + `H2-L` + `H2-O` ✅).
Wave 2 closeout is now accepted.
The immediate mainline frontier is now:

- Wave 3 `W3-S1` Step 2 is complete (`R3-A` schema review ✅ + `R3-B` role pack ✅)
- Wave 3 `W3-S1` Step 3 is complete (`R3-C` output-template freeze ✅ + `R3-D` skeleton prep ✅)
- Wave 3 `W3-S1` Step 4 is complete (`R3-D` final smoke rubric ✅)
- `W3-S2` Step 1 is complete (`R3-E` ✅).
- `W3-S2` Step 2 is complete (`R3-E` schema review ✅ + `R3-F` role pack ✅).
- `W3-S2` Step 3 is complete (`R3-G` ✅ + `R3-H` skeleton prep ✅).
- `W3-S2` Step 4 is complete (`R3-H` finalize ✅).
- `W3-S3` Step 1 is complete (`R3-I` ✅ + `R3-J` ✅ + `R3-K` ✅).
- `W3-S3` Step 2 is complete (`R3-L` evidence curation ✅).
- `W3-S3` Step 3 is complete (`R3-L` presentation packaging ✅).
- Wave 3 side batch Step 1 is complete (`R3-M` ✅ with `h1.single.v1` anchor).
- Wave 3 side batch Step 2 is complete (`R3-N` ✅ + `R3-O` ✅).
- Wave 3 side batch Step 3 is complete (`R3-O` Track B boundary review ✅ + `R3-P` Track E smoke/evidence ✅).
- `CV1` may be activated only by explicit side-vertical choice and it still must not replace or slow the mainline frontier
- Wave 3 closeout is now complete across both the mainline and the real-provider side batch; broader provider parity/routing hardening remains Wave 4 scope
- the coding-vertical reorientation batch is now closed at Meta level: `CV1` remains optional, but its canon is now explicitly packet/compiler-first with near `enter-only` operator flow as the first UX target and guarded dispatch deferred to later expansion

Wave 2 closeout consistency note:
- runtime truth checked: W2-S3 semantics remain bounded at runtime/CLI boundaries (`load_session_memory_context`, post-run identity updater gating)
- eval/report truth checked: `H2-L` and `H2-O` docs and exported eval surfaces match the accepted boundaries and warning/failure semantics
- CLI/export truth checked: no new closeout blocker found; current CLI/export surfaces remain consistent enough for Wave 3 activation

### W1-S2 stabilization batch — Execution Steps

**✅ Step 1 — Track B closes the runtime/contract findings first**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | ✅ W1-S2-FIX-B1, ✅ W1-S2-FIX-B2 | L1-F ✅ + L1-G ✅ + L1-H ✅ + L1-I ✅ | Runtime/contract truth first: unsupported-mode rejection and duplicate-step invariant hardening |

**✅ Step 2 — Track E hardens smoke-comparison correctness**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | ✅ W1-S2-FIX-E1 | W1-S2-FIX-B1 ✅ + W1-S2-FIX-B2 ✅ | Comparison should only go green when normalized outputs are structurally complete |

Status note:
- W1-S2 review found four main issues: unsupported-mode fallback, false-green smoke criteria, duplicate-step invariant gap, and CLI/JSON trace visibility inconsistency.
- Canonical review-finding IDs: `RF-2026-03-19-01` through `RF-2026-03-19-05` in `ops/Review-Findings-Registry.md`.
- `W1-S2-FIX-B1` completed: unsupported execution modes (`parallel`, `graph`) now fail explicitly instead of degrading to `linear`.
- `W1-S2-FIX-B2` completed: duplicate workflow `step_id` values are now rejected at `WorkflowSpec` contract level.
- `W1-S2-FIX-E1` completed: L1-I comparison now requires full comparable-key completeness (not envelope presence), with strict script exit gating and negative tests for missing normalized keys.
- `W1-S2-FIX-A1` completed: CLI summary now provides comparable H1 workflow-summary parity for `h1.single.v1`, `h1.manager.v1`, and `h1.handoff.v1`.
- `W1-S2-FIX-A2` completed: CLI JSON trace export now preserves `parent_event_id` and `correlation_id` fields for linkage-aware analysis.

**✅ Step 3 — Track A restores CLI/trace visibility parity**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | ✅ W1-S2-FIX-A1, ✅ W1-S2-FIX-A2 | W1-S2-FIX-B1 ✅ + W1-S2-FIX-B2 ✅ | Restore H1 variant summary parity and preserve handoff linkage in JSON trace output |

**✅ Step 4 — Meta closes the stabilization detour and restores the normal frontier**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | ✅ W1-S2-FIX-META1 | W1-S2-FIX-B1 ✅ + W1-S2-FIX-B2 ✅ + W1-S2-FIX-E1 ✅ + W1-S2-FIX-A1 ✅ + W1-S2-FIX-A2 ✅ | Confirms W1-S2 is hardened enough and returns the active frontier to `L1-J` / `L1-K` / `L1-L` / `L1-M` |

### Current operational rule
If you want to know "which session do I run next?", use this order:

1. optional side-vertical `CV1` work only if explicitly chosen, justified, and it does not slow mainline progress
2. Wave 3 real-provider side-batch MVP (`R3-M` / `R3-N` / `R3-O` / `R3-P`) is complete; broader provider parity/routing hardening remains Wave 4 scope

Reference:
- `docs/wave1/Wave1-L1-L-H1-Decision-Log.md`
- `ops/Review-Findings-Registry.md`

### Future coding vertical insertion note (not active frontier yet)

This is a planned side-vertical sequence, not the mainline queue.

Wave 1 core closeout is complete, `CV0` is closed, and `CV1` is implemented.
The original `CV1-META1` closeout kept `CV2` blocked because local `h4.seq_next.v1` evidence was missing at that time.
Post-closeout live hardening later produced a canonically complete `h4.seq_next.v1` evidence run, so the missing-evidence blocker is now cleared.
`CV2` remains optional side-vertical work and must still be explicitly activated before any H5 implementation starts.

Use this in the following order:

1. Meta-led `CV0` design/policy batch after `W1-S2-FIX-META1` and `L1-J` / `L1-K` / `L1-L` / `L1-M`
2. thin `CV1` (`H4`) pilot only after `H2-A` through `H2-H`
3. thin `CV2` (`H5`) review/gate slice only after `CV1` is accepted and coding artifacts are stable enough to judge honestly

References:
- `docs/Coding-Vertical-Adopt-Adapt-Defer-v01.md`
- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`

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
- this clears the old missing-evidence blocker, but does not automatically start `CV2`

#### `CV2` — Thin `H5` review/gate slice

**Status:** `⬜ ready but not active; post-CV1 live H4 evidence cleared the old missing-evidence blocker, but CV2 requires explicit activation before work starts`  
**Owner priority:** Track E, with Track D support and Meta closeout

Epics:
- ⬜ **CV2-A** findings-first review artifact — **Owner: Track E**
- ⬜ **CV2-B** test-evidence capture artifact — **Owner: Track D + Track E**
- ⬜ **CV2-C** explicit commit-gate artifact — **Owner: Track E**
- ⬜ **CV2-D** policy feedback loop and private-learning note — **Owner: Meta Coordinator**

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

**⬜ Step 1 — review findings and test evidence are gathered in parallel**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | CV2-A | CV1-META1 ✅ + H4 evidence ✅ | Findings should be primary, severity-ordered, and artifactized |
| Track D + Track E session | CV2-B | CV1-META1 ✅ + H4 evidence ✅ | Capture actual test evidence or an explicit reason why it does not exist |

**⬜ Step 2 — Track E makes the commit-gate decision only after review and evidence exist**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | CV2-C | CV2-A ✅ + CV2-B ✅ | Gate status must stay explicit: `pass`, `pass_with_warnings`, or `hold` |

**⬜ Step 3 — Meta feeds durable lessons back into the private coding-vertical policy layer**

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | CV2-D | CV2-C ✅ | Distill durable lessons cautiously; do not overfit a single cycle into doctrine |

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

---

## 19. Final summary

This plan deliberately separates **strategic ambition** from **execution discipline**.

The project is allowed to grow toward:
- multi-agent orchestration patterns
- reusable runtime engine
- research OS usefulness
- provider diversity
- workbench UX

But it is only allowed to do so by moving through these earned steps:

```text
Foundation
-> Swarm-first Lab
-> Engine Hardening
-> Research OS Usefulness
-> Provider Expansion
-> Workbench
```

That sequence is the core anti-chaos mechanism of the whole project.
