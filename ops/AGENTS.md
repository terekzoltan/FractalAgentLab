# AGENTS.md

> Central coordination guide for the **Fractal Agent Lab** project.
> 
> This document is the shared source of truth for:
> - track ownership
> - dependency ordering
> - cross-track coordination
> - Meta Coordinator workflows
> - initial execution waves
> - current status and risk notes
>
> Project identity: **A1 + A2 + A3 hybrid**
> - **A1** = Agent Lab (experimentation)
> - **A2** = Agent Engine (reusable runtime)
> - **A3** = Research OS (idea/project refinement workflows)
>
> High-level philosophy:
> - own the **core agent model**
> - start with **Swarm-style orchestration** for learning and fast prototyping
> - build stronger **trace / eval / state** from the beginning
> - keep provider-agnostic expansion possible, but not required in v1
>
> Meta Coordinator rule: **does not write production code**. Only coordination, planning, audits, reports, doc maintenance.

---

## 1. Project north star

The project is a **personal multi-agent lab + reusable engine** that should eventually help build and sharpen the later product direction (the B-plan thinking/exoskeleton system).

The first real goal is **not** “general agent internet” or “full autonomy”, but this:

1. Run multiple specialized agents in clear workflows.
2. Make the system inspectable through traces and replay.
3. Compare orchestration styles against baselines.
4. Build reusable runtime pieces that can later power a product.
5. Use the system on real problems:
   - startup idea refinement
   - project decomposition
   - architecture review

---

## 2. Primary repo intent

This repo should evolve through the following layers:

### Layer 0 — Lab
- learn orchestration patterns
- compare manager vs handoff vs parallel fan-out
- test agent role boundaries

### Layer 1 — Engine
- reusable core agent abstraction
- runtime adapters
- state store
- trace store
- workflow execution layer

### Layer 2 — Research OS
- concrete user-facing workflows
- repeatable output quality
- eval + replay
- practical use on real ideas/projects

### Layer 3 — Workbench
- CLI
- trace viewer
- minimal web UI
- later full agent workbench

---

## 2A. Repo visibility policy

Fractal Agent Lab officially uses a **dual-repo model**:

- **private lab repo** = canonical source of truth
- **public portfolio repo** = curated mirror / showcase only

Hard rules:
- `ops/` coordination artifacts remain private-only
- the private repo owns full planning, research, and coordination history
- nothing is published automatically because it exists in the private repo
- public sync is an explicit Meta-reviewed release action

Canonical policy document:
- `docs/Repo-Visibility-and-Release-Policy-v01.md`

---

## 3. Track structure

There are **5 coding tracks** + **1 Meta Coordinator**.

### Track A — UX / CLI / Trace Viewer
**Mission:** entrypoints and visibility.

**Owns:**
- CLI entrypoint
- command UX
- run output formatting
- trace timeline / trace viewer
- later minimal web UI
- later workbench shell

**Should NOT own:**
- core execution semantics
- provider contracts
- memory merge logic

**Early deliverables:**
- `fal run ...` CLI shape
- human-readable run summary
- trace timeline JSON/markdown viewer
- later minimal browser-based trace page

**Definition of Done (high level):**
- user can start a workflow from CLI
- run result is understandable without reading raw JSON
- trace is explorable enough to debug failures

**Status:** `🔄 in progress` (Wave 1 W1-S1: L1-E completed; next Track A milestone is L1-J after L1-H)

---

### Track B — Core Runtime / State / Execution Engine
**Mission:** the heart of the system.

**Owns:**
- run lifecycle
- workflow executor
- orchestration primitives
- state transitions
- retry / timeout / budget mechanics
- event model
- shared runtime schemas

**Should NOT own:**
- agent-specific domain prompts
- provider-specific API details beyond contracts
- final presentation UI

**Early deliverables:**
- `RunState`
- `TraceEvent`
- workflow execution loop
- manager / handoff / parallel execution primitives
- budget / timeout guards

**Definition of Done (high level):**
- workflows can execute deterministically enough to debug
- run state survives across steps in one run
- failures are observable and classified

**Status:** `🔄 in progress` (Wave 1 stabilization: W1-S1-FIX-B1/B2/B3/B4 complete; waiting D/Meta closeout before L1-F)

---

### Track C — Agent Logic / Prompts / Memory Semantics
**Mission:** specialize the intelligence layer.

**Owns:**
- agent role definitions
- prompt system
- workflow-specific agent packs
- memory extraction policy
- memory compression / merge semantics
- planner / critic / synthesizer logic

**Should NOT own:**
- transport/runtime details
- UI
- provider auth and request plumbing

**Early deliverables:**
- intake agent
- planner agent
- critic / falsifier agent
- strategist / systems agent
- synthesizer agent
- memory candidate extraction rules
- identity profile definitions (`IdentityProfile` model)
- identity signal conventions (step output → identity signal mapping)
- post-run identity update rules

**Definition of Done (high level):**
- agent roles are clearly separated
- prompts are versioned and comparable
- memory policy is explicit, not accidental
- identity behavior is explicit and versionable (profile changes traceable per run)

**Status:** `🔄 in progress` (Wave 1: L1-A/L1-C complete; ready to support L1-D/L1-E)

---

### Track D — Provider / Tool / Adapter Boundary
**Mission:** connect the core to actual models and tools.

**Owns:**
- provider adapters
- OpenAI/OpenRouter integration
- future local model bridge
- model routing policy
- tool wrappers
- handoff bridge abstractions

**Should NOT own:**
- product logic
- high-level memory semantics
- UI

**Early deliverables:**
- OpenAI-compatible adapter
- OpenRouter adapter
- provider contract interface
- model policy config
- later local model stub

**Definition of Done (high level):**
- same logical workflow can run against adapter boundary cleanly
- provider swap does not break business logic
- model selection policy is explicit and inspectable

**Status:** `🔄 in progress` (Wave 1 stabilization: W1-S1-FIX-D1/D2 complete; waiting Meta closeout before L1-F)

---

### Track E — Eval / Replay / QA / Bench
**Mission:** make the system measurable.

**Owns:**
- eval harness
- baseline comparisons
- replay tools
- smoke checks
- acceptance rubrics
- workflow benchmark dataset

**Should NOT own:**
- core provider integration
- agent prompt authoring beyond judge/eval roles
- UI beyond eval output support

**Early deliverables:**
- smoke suite for hero workflows
- replay from stored trace inputs
- first eval rubric
- baseline: single-agent vs multi-agent
- identity drift smoke checks (profile change sanity after runs)
- identity profile regression checks (update stability)

**Definition of Done (high level):**
- at least one workflow is measurable against a baseline
- failures can be replayed
- quality regressions are visible early
- identity profile updates are sanity-checked (no runaway drift)

**Status:** `🔄 in progress` (Wave 1: L1-D complete; baseline/rubric comparison layering in progress)

---

### Meta Coordinator — Coordination only
**Mission:** synchronize everything without becoming another implementation track.

**Hard rule:**
- **No production code.**
- Only docs, reports, plans, status maintenance, dependency checks, risk updates, onboarding summaries.

**Owns:**
- `AGENTS.md` maintenance
- wave / sprint sequencing
- dependency graph upkeep
- conflict scans
- status sync
- risk registry
- strategic recommendations
- onboarding snapshots

**Status:** `✅ active role`

---

## 4. Dependency graph

### High-level dependency logic

```text
Track B
├── Track C
├── Track D
├── Track E
└── Track A
```

Interpretation:
- **Track B** is the foundation.
- **Track C** depends on runtime/state primitives from B.
- **Track D** depends on core contracts from B.
- **Track E** depends on runnable workflows and trace outputs from B/C/D.
- **Track A** depends on enough runtime/trace shape from B and useful outputs from E.

### Allowed dependency directions

- A -> B, E
- C -> B
- D -> B
- E -> B, C, D
- Meta Coordinator -> all docs/status, but no production code ownership

### Forbidden dependency directions

- B -> A
- B -> provider-specific business logic from D
- B -> prompt semantics from C
- C -> A
- D -> A
- C <-> D direct tight coupling unless through declared contracts

### Merge-risk zones

| Zone | Risk | Mitigation |
|------|------|------------|
| MR-1 | Shared schema churn (`RunState`, `TraceEvent`, workflow contracts) | Track B owns canonical schema; others propose changes through coordinator |
| MR-2 | Prompt/schema mismatch between C and runtime validation in B | shared Pydantic schemas + smoke tests |
| MR-3 | Adapter abstraction drift between B and D | explicit adapter contract doc and smoke test |
| MR-4 | Trace viewer breakage when trace event shape changes | Track A only consumes versioned trace schema |
| MR-5 | Eval invalidated by workflow changes | Track E maintains baseline version tags |

---

## 5. Core technical stance

### Chosen architecture style

**Hybrid architecture**

```text
Core Agent Model (own)
+ Swarm-style orchestration patterns
+ Agents SDK-inspired tracing / handoff discipline
+ explicit state store
+ eval & replay layer
+ later optional provider-agnostic expansion
```

### What this means concretely

- The **inside** of the project should be your own conceptual model.
- Swarm-style handoffs are used as a **learning and prototyping shape**, not as the permanent definition of the system.
- Agents SDK ideas such as **handoffs, traces, session-style thinking, and guardrails** should influence the runtime design.
- Provider-agnostic expansion is a **later concern**, not a v1 tax.

---

## 6. Runtime strategy

### Runtime policy
**Chosen direction:** `sajat core + tobb adapter`

Meaning:
- the project defines its own internal runtime abstractions
- one adapter can be Swarm-like / simple API-driven
- later another adapter can target a richer runtime or different provider environment

### Initial runtime adapters

**v1 target adapters:**
1. `OpenAICompatibleAdapter`
2. `OpenRouterAdapter`
3. `MockAdapter` for offline/smoke/replay testing

**Later possible adapters:**
4. `LocalModelAdapter`
5. `HaystackStyleAdapter`
6. `AgentSDKAdapter`

---

## 7. Orchestration strategy

**Chosen direction:** hybrid orchestration.

The engine should support these patterns:

### Pattern O1 — Manager
One coordinator decides which sub-agents run.

Use for:
- idea refinement
- project decomposition
- safe first workflows

### Pattern O2 — Handoff
An agent explicitly transfers control to another.

Use for:
- Swarm-style learning
- specialist routing
- conversational chains

### Pattern O3 — Parallel fan-out / fan-in
Multiple specialists run in parallel and are later synthesized.

Use for:
- critique from multiple perspectives
- systems/product/research parallel reads
- eval comparisons

### Pattern O4 — Workflow graph
Explicit multi-step graph with typed state edges.

Use for:
- hardening later hero workflows
- replayable production-ish paths

**Practical recommendation:**
- v1 starts with O1 + O2
- v1.5 adds O3
- later O4 becomes the hardening path for stable workflows

---

## 8. Memory strategy

**Current choice:** gradual rollout from A -> D.

That means memory should not be overbuilt on day 1.

### Memory phases

#### M0 — No durable memory
- one run only
- all context passed directly
- easiest debug mode

#### M1 — Session memory
- short-lived session context
- useful for one user/project thread
- enough for first workflow continuity

#### M2 — Project memory
- durable notes for one repo or one idea stream
- store stable decisions, workflow learnings, prompt observations

#### M3 — Long-term heuristic memory
- reusable patterns across runs/projects
- only high-signal items survive
- must be curated / merged, not blindly appended

### Memory policy principles

- memory is **earned**, not dumped
- all stored memory needs a **reason**
- memory merge should prefer **deduplicated structured notes**
- replayable runs matter more than aggressive memory in early phases

---

## 9. Eval strategy

**Target direction:** all four, but not at once.

### Eval ladder

#### E0 — Manual review
Use first.

#### E1 — Smoke checks
Basic acceptance for hero workflows.

#### E2 — LLM judge / rubric
Use after outputs are stable enough.

#### E3 — Replay + comparison
Replay same input across orchestration variants.

#### E4 — Benchmark dataset
Small curated set of recurring test cases.

### Practical rollout

- v1: E0 + E1
- v1.1: E2
- v1.2: E3
- later: E4

---

## 10. Productization ladder

### Phase P0 — CLI only
- core commands
- run summaries
- trace export

### Phase P1 — CLI + trace viewer
- local trace inspection
- timeline view
- run comparison

### Phase P2 — minimal web UI
- launch workflow
- inspect results
- browse traces

### Phase P3 — full agent workbench
- workflow selection
- run management
- memory inspection
- eval dashboard
- prompt/version comparisons

---

## 11. Model / provider policy

### Current stance
- OpenRouter-first / OpenAI-compatible is acceptable
- local models are a future extension
- ChatGPT subscription is useful for ideation/coding help, but does **not** replace app runtime/provider budgeting

### Internal model policy

Use model tiers instead of one-model-for-all:

Current default direction (explicitly confirmed, but still revisitable later):
- `cheap_worker` -> `gpt-4o-mini`
- `specialist` -> `gpt-5.4-nano`
- `finalizer` -> `gpt-5.4-mini`

Note:
- these are current defaults, not permanent promises
- revisit when the small/cheap model landscape shifts materially

#### Tier T1 — Cheap workers
Use for:
- routing
- decomposition
- formatting
- simple criticism
- structure normalization

#### Tier T2 — Mid-tier specialists
Use for:
- planner
- systems reasoning
- research synthesis
- strategy drafts

#### Tier T3 — Expensive finalizers
Use for:
- final synthesis
- high-stakes critique
- architecture review final pass
- difficult arbitration

**Rule:** avoid all-premium-by-default architecture.

---

## 12. Hero workflows

These are the first workflows the whole system should optimize around.

### Workflow H1 — Startup idea refinement
**Priority:** highest

Input:
- rough startup / product / agent system idea

Output:
- clarified idea
- assumptions
- weak points
- alternatives
- recommended MVP direction

Likely orchestration:
- intake -> planner -> systems/product/critic -> synthesizer

---

### Workflow H2 — Project decomposition
**Priority:** high

Input:
- a broad project idea or goal

Output:
- tracks / modules / phases / dependency order
- suggested implementation waves
- risk zones

Likely orchestration:
- intake -> planner -> architect -> critic -> synthesizer

---

### Workflow H3 — Architecture review
**Priority:** later in first wave set

Input:
- repo structure / system plan / architecture notes

Output:
- strong points
- bottlenecks
- merge-risk zones
- refactor suggestions

Likely orchestration:
- intake -> planner -> systems -> critic -> synthesizer -> evaluator

---

## 13. Canonical repo layout

The canonical repository layout is defined by `docs/Repo-Skeleton-v01.md`.
It overrides older layout sketches, including the earlier layout in `docs/fractal_agent_lab_terv_v01.md`.

```text
repo/
├── ops/
│   ├── AGENTS.md
│   ├── Combined-Execution-Sequencing-Plan.md
│   └── Meta-Coordinator-Runbook.md
├── docs/
├── src/
│   └── fractal_agent_lab/
│       ├── core/
│       │   ├── contracts/
│       │   ├── events/
│       │   ├── models/
│       │   └── errors/
│       ├── runtime/
│       ├── agents/
│       ├── workflows/
│       ├── adapters/
│       ├── tools/
│       ├── state/
│       ├── memory/
│       ├── identity/
│       ├── tracing/
│       ├── evals/
│       ├── cli/
│       └── shared/
├── tests/
├── data/
├── examples/
├── scripts/
├── configs/
└── ui/
```

---

## 14. Initial file ownership hints

### Track A likely file areas
- `src/fractal_agent_lab/cli/*`
- `ui/*`
- `examples/*`

### Track B likely file areas
- `src/fractal_agent_lab/core/*`
- `src/fractal_agent_lab/runtime/*`
- `src/fractal_agent_lab/state/*`
- `src/fractal_agent_lab/tracing/*` for canonical trace contracts and event-writing boundaries

### Track C likely file areas
- `src/fractal_agent_lab/agents/*`
- `src/fractal_agent_lab/workflows/*`
- `src/fractal_agent_lab/memory/*`
- `src/fractal_agent_lab/identity/*` (primary owner; shared deps: B for runtime boundaries, E for drift/eval)

### Track D likely file areas
- `src/fractal_agent_lab/adapters/*`
- `src/fractal_agent_lab/tools/*`
- `configs/*`

### Track E likely file areas
- `src/fractal_agent_lab/evals/*`
- `tests/*`
- `src/fractal_agent_lab/tracing/*` for replay/eval consumption
- `examples/*` for smoke and benchmark fixtures

---

## 15. Wave-based rollout

## Wave 0 — Foundation
**Goal:** make the project runnable and structurally sane.

Target outcomes:
- repo skeleton exists
- `ops/AGENTS.md` exists
- first core schemas exist
- basic CLI exists
- one mockable run path exists

Primary track emphasis:
- B first
- D minimal
- A minimal

---

## Wave 1 — Swarm-first lab
**Goal:** learn orchestration patterns fast.

Target outcomes:
- first multi-agent workflow runs
- handoff pattern works
- manager pattern works
- output is inspectable

Primary hero workflow:
- H1 startup idea refinement

---

## Wave 2 — Engine hardening
**Goal:** stop being a toy.

Target outcomes:
- state becomes explicit
- traces are structured
- replay works for at least one workflow
- eval smoke exists

Primary track emphasis:
- B + E

---

## Wave 3 — Research OS usefulness
**Goal:** use it on real planning problems.

Target outcomes:
- H1, H2 stable enough
- H3 usable in draft form
- project memory begins

Primary track emphasis:
- C + E + A

---

## Wave 4 — Provider expansion
**Goal:** widen runtime options without breaking the core.

Target outcomes:
- multiple provider adapters
- model routing policy improved
- optional local model experiments

Primary track emphasis:
- D

---

## Wave 5 — Workbench
**Goal:** usability and portfolio presentation.

Target outcomes:
- minimal web UI
- better trace browsing
- presentable system for demo/portfolio

Primary track emphasis:
- A + E

---

## 16. Wave turn-gate protocol (all track agents)

Purpose:
- enforce dependency order
- prevent premature coding on blocked epics
- keep multi-track work synchronized

Rules:
- before starting any epic, the track agent must read current wave/sprint status
- if prerequisites are incomplete, agent must explicitly report `NOT READY`
- if prerequisites are complete, agent reports `READY`
- when implementation begins: `⬜ -> 🔄`
- after acceptance/smoke gate passes: `🔄 -> ✅`
- one track must **not** mark another track’s work `✅` without explicit confirmation
- if shared schema/contract changed, uzenofal entry is mandatory

---

## 17. Initial wave ordering guidance

### Safe default ordering

#### Wave 0
- B first
- D minimal adapter stubs
- A minimal CLI shell
- C only after core schemas exist
- E only after first runnable path exists

#### Wave 1
- B + C + D coordinated
- A consumes trace output after schema stabilizes
- E builds first smoke baseline after first workflow completes

#### Wave 2+
- parallelism increases, but only through declared contracts

---

## 18. Uzenofal (cross-track notes)

Purpose:
- short practical notes that affect multiple tracks

Format:
- `[YYYY-MM-DD][Track] short title - impact - next step`

Entries:
- `[2026-03-06][Meta] ops/AGENTS.md initialized - central coordination layer established - next: create Combined-Execution-Sequencing-Plan.md.`
- `[2026-03-06][Track B] Core-first dependency policy accepted - runtime/state becomes the foundation - next: define RunState, TraceEvent, WorkflowSpec.`
- `[2026-03-06][Track C] Hero workflow priority accepted - H1 startup idea refinement first, H2 project decomposition second - next: define initial agent pack.`
- `[2026-03-06][Track D] Provider stance accepted - OpenRouter/OpenAI-compatible first, local later - next: define adapter contract.`
- `[2026-03-06][Track E] Eval ladder accepted - start with manual + smoke before judge/replay/dataset hardening - next: draft first smoke rubric.`
- `[2026-03-08][Meta] Repo spine physically established - ops/docs/src-fractal_agent_lab layout now exists - next: Track B contracts kickoff.`
- `[2026-03-08][Meta] Track B prep roadmap created - first implementation burst now has concrete contract-first guidance - next: implement F0-B through F0-E.`
- `[2026-03-08][Track B] F0-B canonical schemas implemented - RunState/TraceEvent/WorkflowSpec/AgentSpec now exist under core ownership boundaries - next: downstream tracks consume without redefining contracts.`
- `[2026-03-08][Track B] F0-C/F0-D/F0-E foundations implemented - executor skeleton, trace emitter primitive, runtime error taxonomy, and timeout/retry/budget placeholders are active - next: Track D/A begin W0-S2 against these boundaries.`
- `[2026-03-09][Meta] Emergent Identity Layer design doc accepted - Track C primary owner, observational MVP targeting Wave 2 (W2-S3), identity profile/signal/update/drift design grounded in current repo state - next: update coordination docs, create identity/ package skeleton.`
- `[2026-03-09][Track D] F0-F delivered - adapter boundary contract, MockAdapter path, and provider routing shell implemented against StepRunner - next: integrate CLI config loading for provider selection.`
- `[2026-03-09][Track D] F0-I delivered - CLI run now loads runtime/providers/model policy configs and supports provider override shell through adapter step runner - next: handoff smoke validation with Track A/E.`
- `[2026-03-09][Track A] F0-G CLI shell implemented - module CLI now supports run/list workflows against Track B executor boundary with text/json output and optional trace summary - next: finalize minimal run summary contract (F0-H).`
- `[2026-03-09][Track A] F0-H run summary output implemented - stable summary fields now present in text/json with optional trace summary envelope - next: coordinate W0-S2 closeout and Track E smoke alignment.`
- `[2026-03-11][Track C] F0-J started (⬜ -> 🔄) - H1-lite minimal agent pack implementation kickoff with strict role boundaries and prompt versioning - next: implement pack files and validation helpers.`
- `[2026-03-11][Track C] F0-J completed (🔄 -> ✅) - H1-lite agent pack delivered under src/fractal_agent_lab/agents/h1_lite with intake/planner/synthesizer prompts, AgentSpec bindings, and role/handoff validation - next: begin F0-K workflow wiring.`
- `[2026-03-11][Track C] F0-K started (⬜ -> 🔄) - H1-lite workflow runnable path kickoff against F0-J pack and existing CLI/adapter boundary - next: wire workflow registry and agent-spec binding into CLI execution path.`
- `[2026-03-11][Track C] F0-K completed (🔄 -> ✅) - runnable h1.lite workflow path implemented with workflow module, registry mapping, and CLI step-runner agent-pack binding - next: Track E executes F0-L and Track B/E finalize F0-M artifacts.`
- `[2026-03-11][Track E] F0-L started (⬜ -> 🔄) - Wave 0 manual smoke checklist implementation started against runnable h1.lite path and Track B contracts - next: publish checklist with explicit PASS/PARTIAL/FAIL/BLOCKED outcomes.`
- `[2026-03-11][Track E] F0-L completed (🔄 -> ✅) - docs/Wave0-Manual-Smoke-Checklist.md published with command baseline, run/trace/output checks, and gate mapping for Wave 0 anti-delusion validation - next: execute checklist outputs to support F0-M artifact/replay acceptance.`
- `[2026-03-11][Track B] F0-M Track B scope completed (🔄 -> ✅) - canonical run/trace artifact write path implemented under data/runs and data/traces with CLI integration and artifact contract doc - next: Track E validates artifact usability and finalizes F0-M acceptance gate.`
- `[2026-03-13][Track E] Ops/docs gitignore note recorded - opencode can still read local changes in ops/docs directly from filesystem, but ignored markdown will not appear in git status or normal commit flow - next: keep this constraint explicit in coordination and audit expectations.`
- `[2026-03-13][Track E] F0-M started (Track B scope ✅ -> 🔄 Track E scope) - artifact usability validation kickoff for replay/smoke acceptance using stored run and trace outputs - next: validate success/failure artifacts with explicit invariants.`
- `[2026-03-13][Track E] F0-M completed (🔄 -> ✅) - Track E validated run/trace artifact usability via src/fractal_agent_lab/evals/artifact_acceptance.py and scripts/validate_f0_m_artifact_pair.py, recorded evidence in docs/Wave0-F0-M-Artifact-Validation.md - next: proceed to L1 baseline/rubric layering.`
- `[2026-03-17][Track E] L1-D started (⬜ -> 🔄) - H1 single-agent baseline reference path implementation kicked off to create Wave 1 comparison anchor against h1.manager.v1 - next: ship baseline workflow/agent wiring with tests and validation note.`
- `[2026-03-17][Track E] L1-D completed (🔄 -> ✅) - single-agent H1 baseline shipped as h1.single.v1 with baseline pack/registry wiring, mock comparison-friendly output shape, and workflow+adapter test coverage - next: use this baseline for L1-I/L1-L evidence and rubric tuning.`
- `[2026-03-17][Track C] L1-A started (⬜ -> 🔄) - Wave 1 H1 workflow schema v1 kickoff started against stabilized manager primitive - next: publish explicit manager/worker schema contract in workflows module.`
- `[2026-03-17][Track C] L1-A completed (🔄 -> ✅) - H1 manager workflow schema v1 delivered in src/fractal_agent_lab/workflows/h1.py with manager spec fields, schema refs, and workflow tests validating runtime compatibility - next: begin L1-C H1 agent pack v1 against this contract.`
- `[2026-03-17][Track C] L1-C started (⬜ -> 🔄) - H1 full role pack v1 implementation started against L1-A schema and L1-B manager runtime - next: deliver intake/planner/critic/synthesizer prompts and registry binding.`
- `[2026-03-17][Track C] L1-C completed (🔄 -> ✅) - H1 pack v1 shipped under src/fractal_agent_lab/agents/h1 with critic role, role-level prompt versions, manager-control synthesizer prompt, h1.manager.v1 registry binding, and mock manager-path tests - next: handoff to Track E (L1-D) and Track A (L1-E).`
- `[2026-03-17][Track A] L1-E started (⬜ -> 🔄) - H1 manager run summary readability implementation started in Track A CLI formatting layer against stabilized L1-C output shape - next: add H1-focused summary sections in text/json outputs.`
- `[2026-03-17][Track A] L1-E completed (🔄 -> ✅) - CLI summary now extracts H1 final output and manager orchestration context with lane/turn-aware trace rollups, plus coverage in tests/cli/test_l1_e_h1_summary.py - next: handoff readable manager evidence to Track E while waiting for L1-H before L1-J timeline UI work.`
- `[2026-03-18][Track B] W1-S1-FIX-B1/B2/B3 completed (🔄 -> ✅) - h1.single.v1 execution-mode mismatch fixed to linear, manager parser now selects first valid control envelope, and dedicated runtime guardrail tests added for invalid target/revisit/max-turn/fallback - next: Track D executes W1-S1-FIX-D1/D2, then Meta closes stabilization batch.`
- `[2026-03-18][Track B] W1-S1-FIX-B4 completed (🔄 -> ✅) - execution-mode truth hardened end-to-end: h1.lite and wave0.demo now declare linear, runtime emits effective branch mode, and WorkflowSpec rejects manager worker sets containing the manager step - next: Track D continues W1-S1-FIX-D1/D2 with stable runtime contracts.`
- `[2026-03-18][Track D] W1-S1-FIX-D1 completed (🔄 -> ✅) - MockAdapter manager workers now enforce upstream context requirements so planner/critic ordering regressions fail loudly instead of passing silently - next: complete W1-S1-FIX-D2 model-tier default realignment.`
- `[2026-03-18][Track D] W1-S1-FIX-D2 completed (🔄 -> ✅) - model-tier defaults restored to gpt-4o-mini / gpt-5.4-nano / gpt-5.4-mini with adapter+CLI fixtures aligned - next: Meta executes W1-S1-FIX-META1 stabilization closeout.`

---

## 19. Risks and mitigations

### R1 — Overbuilding too early
**Risk:** project becomes a framework graveyard before one workflow becomes useful.

**Mitigation:** hero workflow first, generalization second.

### R2 — Too much autonomy too early
**Risk:** system appears impressive but becomes opaque and hard to debug.

**Mitigation:** trace-first, replay-first, explicit state.

### R3 — Provider lock-in too soon
**Risk:** implementation shape bends too much around one API.

**Mitigation:** internal contracts + adapters.

### R4 — Prompt chaos
**Risk:** many agents, unclear boundaries, overlapping prompts.

**Mitigation:** version prompts and enforce sharp role boundaries.

### R5 — Memory bloat
**Risk:** long-term memory turns into noise.

**Mitigation:** staged memory rollout and merge policies.

### R6 — Eval debt
**Risk:** workflows look good but do not measurably improve.

**Mitigation:** baseline comparison from early stage.

### R7 — Identity over-philosophizing
**Risk:** emergent identity layer becomes ungrounded drift semantics or poetic abstraction instead of a measurable adaptive subsystem.

**Mitigation:** keep identity tied to measurable profile fields, explicit post-run update rules, and concrete signal sources. No auto-prompt rewriting in v0. Defer reputation graph and team/system aggregation until after H1 baseline exists.

---

## 20. Meta Coordinator workflows

These workflows are run in the dedicated Meta Coordinator session/chat.

### 20.1 `agents-maintenance`
Purpose:
- keep `ops/AGENTS.md` current

When:
- every Meta Coordinator session opening

Steps:
1. Read full `ops/AGENTS.md`.
2. Check track statuses.
3. Trim uzenofal if it grows too large.
4. Update stale references.
5. Output: `ops/AGENTS.md` edit or “no changes needed”.

---

### 20.2 `arch-audit`
Purpose:
- compare declared architecture with actual repo structure and dependencies

When:
- weekly or before larger merges

Output:
- report of OK / VIOLATION / UNLISTED dependency situations

---

### 20.3 `dod-check`
Purpose:
- review whether track-level Definition of Done criteria are genuinely met

When:
- sprint end / milestone gate

Output:
- track-by-track progress report

---

### 20.4 `plans-review`
Purpose:
- review consistency between `ops/AGENTS.md` and plan documents

When:
- when new plan docs appear

Output:
- broken references / missing docs / stale assumptions report

---

### 20.5 `conflict-scan`
Purpose:
- catch cross-track collisions early

When:
- weekly or when shared schemas change

Typical hotspots:
- `RunState`
- `TraceEvent`
- workflow contracts
- adapter interfaces
- prompt schemas

Output:
- warning list + mitigation suggestion

---

### 20.6 `sprint-plan`
Purpose:
- close current sprint and propose next one

When:
- every sprint boundary

Output:
- short closeout + next sprint recommendation

---

### 20.7 `risk-update`
Purpose:
- update risk registry

When:
- whenever architecture, provider, or workflow scope changes materially

Output:
- added/removed/changed risks

---

### 20.8 `project-futures`
Purpose:
- creative strategic thinking about future tracks, sessions, and architecture decisions

When:
- monthly or at major phase boundaries

Output:
- new possible tracks, sessions, workbench ideas, expansion paths

---

### 20.9 `onboarding-snapshot(all)`
Purpose:
- generate current project state summary for a fresh session/agent

When:
- after milestone changes or before opening new specialized coordination chats

Output:
- short per-track current state briefing

---

### 20.10 `full-sweep`
Purpose:
- run all major coordination workflows in sequence

When:
- monthly or milestone / phase transition

Order:
1. `agents-maintenance`
2. `arch-audit`
3. `dod-check`
4. `plans-review`
5. `conflict-scan`
6. `sprint-plan`
7. `risk-update`
8. `project-futures`
9. `onboarding-snapshot(all)`

Output:
- consolidated markdown report

---

## 21. Suggested dedicated future sessions

These are not mandatory now, but likely useful later.

### Session: Workflow Hardening Coordinator
Focus:
- stabilize hero workflows H1/H2/H3
- compare orchestration variants
- drive replay/eval improvements

### Session: Provider & Model Routing Lab
Focus:
- compare provider adapters
- tune model tier policy
- test local/provider mix

### Session: Memory Design Lab
Focus:
- memory extraction
- consolidation rules
- long-term heuristic filtering

### Session: Eval & Replay Lab
Focus:
- smoke suite
- replay tools
- benchmark dataset growth

### Session: Identity Layer Lab
Focus:
- emergent identity profile design and implementation
- identity signal conventions and update rules
- drift monitoring and classification
- routing policy when identity-informed routing becomes viable
- reputation graph and team/system aggregation (later phases)

Use when:
- role/identity drift semantics become unclear
- routing policy may start depending on identity
- reputation or team-level aggregation is proposed

---

## 22. Initial acceptance gates

### Wave 0 acceptance
- repo structure exists
- `ops/AGENTS.md` exists
- one runnable mock path exists
- no obvious ownership ambiguity between tracks

### Wave 1 acceptance
- one multi-agent hero workflow runs end-to-end
- trace exists and is inspectable
- at least one orchestration variant can be compared

### Wave 2 acceptance
- replay exists for at least one run type
- smoke eval exists
- runtime contracts are stable enough for multiple tracks to work in parallel

---

## 23. Current strategic priority order

### Priority order (philosophy)
1. **A — engineering-grade agent runtime**
2. **B — thinking exoskeleton lab**
3. **C — emergent multi-agent experimentation**

### Priority order (practical)
1. Hero workflow usefulness
2. Reusable engine core
3. Trace/eval discipline
4. Portfolio-ready usability
5. Wider provider/model expansion

---

## 24. What success looks like in 2–3 weeks

A strong near-term success state would be:

- there is a working CLI-driven multi-agent system
- H1 startup idea refinement works end-to-end
- there is a clear trace per run
- orchestration is not magical black-box behavior
- at least one baseline comparison exists
- the repo already looks like a serious portfolio project

---

## 25. Immediate next documents to create

1. `docs/Workflow-H1-Idea-Refinement-Plan.md`
2. `docs/Track-D-Adapter-Contract.md`
3. `docs/Track-E-Smoke-Rubric-v0.md`

---

## 26. Current state snapshot

| Area | State |
|------|-------|
| Project concept | defined |
| Track model | defined |
| Hero workflows | defined |
| Runtime choice | hybrid, own core + adapters |
| Orchestration choice | hybrid |
| Memory choice | gradual rollout |
| Eval choice | phased ladder |
| UI plan | CLI -> trace viewer -> web UI -> workbench |
| Provider plan | OpenRouter/OpenAI-compatible first |
| Meta Coordinator | active by design |

---

*End of AGENTS.md*
