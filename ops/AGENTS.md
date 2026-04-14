# AGENTS.md

> Central coordination guide for the **Fractal Agent Lab** project.
> 
> This document is the shared source of truth for:
> - track ownership
> - cross-track coordination
> - Meta Coordinator workflows
> - initial execution waves
> - current status snapshots and risk notes
>
> Execution-order rule:
> - `ops/Combined-Execution-Sequencing-Plan.md` is the canonical source for active frontier, exact sprint ordering, and step-by-step execution sequencing
> - `ops/AGENTS.md` remains the canonical source for ownership, guardrails, and project-operating policy
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
> - treat workflow optimization as a standing priority; the project should improve its own operating loop in real time when repeated friction or truthfulness gaps become visible
>
> Meta Coordinator rule: **does not write production code**. Only coordination, planning, audits, reports, doc maintenance.
>
> Conversation convention:
> - when the user writes `ÉN`, it refers to the user/project owner speaking in first person

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
   - later: repo-aware software delivery planning / review / commit governance

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

## 2B. Provisional coordination hardening

Based on the first two meaningful review cycles, the project now adopts a small **provisional** hardening layer.

This should be treated as a working default, not a permanent constitution.

Current provisional rules:
- declared orchestration truth should match emitted runtime truth
- new orchestration/parser semantics need targeted negative-path tests
- smoke/eval green should mean structural completeness, not just envelope presence
- runtime/eval semantic expansion should trigger one explicit cross-surface consistency pass before sprint closeout

Canonical references:
- `ops/Meta-Hardening-Package-v01.md`
- `ops/Review-Findings-Registry.md`

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
- CLI/export surfaces stay aligned with current runtime/eval semantics for exposed workflows

**Status:** `🔄 in progress` (Wave 3 `W3-S3` Step 1 `R3-J` and Step 2 Track E evidence curation are complete; Track A now owns open Step 3 `R3-L` presentation packaging)

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
- declared orchestration truth matches emitted runtime truth
- structural workflow invariants are rejected before runtime when practical

**Status:** `🔄 in progress` (Track B completed W2-S1 `H2-A` / `H2-B` / `H2-C` / `H2-D`, W2-S3 Step 1 `H2-H` / `H2-N`, W3-S1 Step 2 `R3-A` schema review, and W3-S2 Step 2 `R3-E` schema review; next likely Track B checkpoint is Wave 3 `R3-M` schema/runtime boundary support)

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

**Status:** `🔄 in progress` (Wave 1 core closeout is complete; W2-S2 Step 2 Track C implementation batch is complete with `H2-K` + `H2-N`; Wave 3 `W3-S1` and `W3-S2` are fully complete through `R3-H`, and Track C completed `W3-S3` Step 1 `R3-I` project-memory v1 while Step 2/3 `R3-L` remain Track E/Track A owned)

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
- mock-backed orchestration evidence should fail loudly when prerequisite context is missing

**Status:** `🔄 in progress` (Wave 2 mainline is no longer active; Track D real-provider work remains a non-blocking Wave 3 side batch that can start only after `W3-S1` completes, while broader provider parity/routing hardening still belongs to Wave 4)

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
- smoke/eval green should reflect structurally complete comparison output, not envelope presence alone

**Status:** `🔄 in progress` (Wave 1 core closeout is complete; Track E completed W2-S2 `H2-E` / `H2-F` / `H2-G` plus `H2-H` draft and W2-S3 Step 2 `H2-L` / `H2-O`; in Wave 3, `W3-S1` `R3-D`, `W3-S2` `R3-H`, and `W3-S3` Step 1 `R3-K` + Step 2 `R3-L` evidence curation are complete on Track E scope; next mainline action is Track A Step 3 packaging)

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

## 3A. Runbook Family

The project maintains an explicit runbook family so the workflow can be reused more
easily in this repo and in similar repos.

Canonical runbook surfaces:

- `ops/Meta-Coordinator-Runbook.md` = how the Meta Coordinator operates
- `ops/Track-Implementation-Runbook.md` = shared default implementation-track loop
- `ops/Track-A-Runbook.md` = Track A overlay
- `ops/Track-B-Runbook.md` = Track B overlay
- `ops/Track-C-Runbook.md` = Track C overlay
- `ops/Track-D-Runbook.md` = Track D overlay
- `ops/Track-E-Runbook.md` = Track E overlay

Authority rule:

- `ops/Combined-Execution-Sequencing-Plan.md` remains canonical for active frontier and step ordering
- `ops/AGENTS.md` remains canonical for ownership and project guardrails
- the runbooks describe how each role should operate within those boundaries

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
- `cheap_worker` -> `mistral-small-3.2-24b-instruct`
- `specialist` -> `gpt-5.4-mini`
- `finalizer` -> `gpt-5.4-mini`
- rare arbitration / gate-conflict escalation -> `gpt-5.4`

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

Role intent:
- low-cost, high-frequency worker for bounded tasks
- best when the output is structural, easy to inspect, or easy to correct downstream

Should not be the default for:
- final planning authority
- high-stakes critique
- final gate or arbitration

#### Tier T2 — Mid-tier specialists
Use for:
- planner
- systems reasoning
- research synthesis
- strategy drafts

Role intent:
- main reasoning tier for workflow-specific planning and critique
- should carry most repo-aware planning, decomposition, and systems-thinking work

Typical role fit:
- `planner`
- `architect`
- `architect_critic`
- `systems`
- `critic`
- `evaluator`

#### Tier T3 — Expensive finalizers
Use for:
- final synthesis
- high-stakes critique
- architecture review final pass
- difficult arbitration

Role intent:
- final synthesis / final decision tier, not the default worker tier
- use when the workflow needs a clean bottom line, conflict resolution, or high-confidence final pass

Typical role fit:
- `synthesizer`
- `commit_gate`
- final-pass reviewer/evaluator on high-stakes workflows

Escalation note:
- if `finalizer` output still leaves unresolved gate conflict or hard arbitration ambiguity, escalate that narrow decision to `gpt-5.4` rather than upgrading the whole workflow by default

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
- representative architecture-review sections for strengths, bottlenecks, merge risks, and refactor ideas
- exact H3 section naming/order is frozen by `R3-G` as: `strengths`, `bottlenecks`, `merge_risks`, `refactor_ideas`

Likely orchestration:
- intake -> planner -> systems -> critic -> synthesizer

Executable v1 note:
- `R3-E` uses manager envelope compatibility (`step_results` + `manager_orchestration` + `final_output`)
- evaluator remains deferred from the executable v1 schema
- `R3-G` freezes H3 final section naming/order at runnable acceptance surface level; workflow-spec compatibility checks remain narrower than template-law assertions

---

### Future workflow family H4/H5 — Software Delivery Loop
**Status:** future vertical; docs-only `CV0` is now allowed after Wave 1 core closeout, but executable work remains gated

Purpose:
- turn human software-delivery intent + repo state into governed planning, review, and commit-readiness workflows

Subflows:
- `H4` — Codebase Context & Planning
- `H5` — Implementation, Review & Commit Gate

Positioning rule:
- treat this as workflow governance for software delivery
- do not frame it as a black-box "ultimate coder"
- treat it as the formalization of the current human-driven Combined-aware delivery workflow, not a detached coding fantasy

Unlock rule:
- docs/policy batch is now allowed because Wave 1 core closeout is complete
- thin `H4` pilot waits for Wave 2 contract/replay/smoke hardening to stabilize
- thin `H5` review/gate slice waits for real `H4` pilot evidence and stable artifact policy

---

## 13. Canonical repo layout

The canonical repository layout is defined by `docs/Repo-Skeleton-v01.md`.
It overrides older layout sketches, including the earlier layout in `docs/legacy/fractal_agent_lab_terv_v01.md`.

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
- session memory and identity profile foundation exist
- provider/runtime boundaries are hard enough to support a later real-provider MVP without claiming it yet

Primary track emphasis:
- B + E + C parallel (contract-dependent vs execution-dependent separation)
- D prep only

Cross-track parallelism note:
- W2-S2 runs Track E (replay/smoke) and Track C (memory/identity) foundations in parallel
- Track C work is contract-dependent (needs stable schemas), not execution-dependent (does not need replay)
- W2-S3 focuses on cross-track validation and review

CV0 side batch:
- docs-only coding vertical design runs alongside W2 mainline
- does not block or compete with W2 execution

---

## Wave 3 — Research OS usefulness
**Goal:** use it on real planning problems.

Target outcomes:
- H1, H2 stable enough
- H3 usable in draft form
- project memory begins
- one real-provider H1 path exists in MVP form without displacing the main H2/H3 usefulness work

Primary track emphasis:
- C + E + A
- D late-wave MVP side batch only

---

## Wave 4 — Provider expansion
**Goal:** widen runtime options without breaking the core.

Target outcomes:
- OpenRouter and OpenAI-compatible paths are both explicit and inspectable
- model routing policy is improved and evidence-backed
- rate-limit/backoff and failure behavior are documented and hardened
- optional local model experiments remain contained

Primary track emphasis:
- D + E

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

## Future side vertical — Software Delivery Loop

This is a planned side vertical, not a replacement for the main wave spine.

Phase rule:
- post-Wave-1 closeout: docs-only `CV0` design/policy batch
- after Wave 2 contract/replay/smoke hardening: thin `CV1` (`H4`) pilot
- only later: thin `CV2` (`H5`) review/gate slice

Control rule:
- do not let coding-vertical implementation steal focus from the current main wave
- treat repo-aware software delivery as an earned extension of the engine, not a reset of project identity
- treat the coding vertical's strongest review/gate/planning heuristics as private learning-loop assets by default

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
- execution-step headings in sequencing docs should also carry explicit status markers (`⬜`, `🔄`, `✅`, `⏸`, `🚫`)
- if multiple tracks can safely work in parallel, keep them in the same numbered step; use a later step only for real dependency or explicit optional gating
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
- Track D may prepare real-provider work during Wave 2, but the first canonical real-provider MVP belongs to a non-blocking Wave 3 side batch, not the Wave 2 mainline

#### Post-Wave-1 side-vertical rule
- docs-only future-vertical planning may start after Wave 1 closes if the main frontier is genuinely clear
- executable side-vertical work requires explicit sequencing and named prerequisites

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
- `[2026-03-11][Track E] F0-L completed (🔄 -> ✅) - docs/wave0/Wave0-Manual-Smoke-Checklist.md published with command baseline, run/trace/output checks, and gate mapping for Wave 0 anti-delusion validation - next: execute checklist outputs to support F0-M artifact/replay acceptance.`
- `[2026-03-11][Track B] F0-M Track B scope completed (🔄 -> ✅) - canonical run/trace artifact write path implemented under data/runs and data/traces with CLI integration and artifact contract doc - next: Track E validates artifact usability and finalizes F0-M acceptance gate.`
- `[2026-03-13][Track E] Ops/docs gitignore note recorded - opencode can still read local changes in ops/docs directly from filesystem, but ignored markdown will not appear in git status or normal commit flow - next: keep this constraint explicit in coordination and audit expectations.`
- `[2026-03-13][Track E] F0-M started (Track B scope ✅ -> 🔄 Track E scope) - artifact usability validation kickoff for replay/smoke acceptance using stored run and trace outputs - next: validate success/failure artifacts with explicit invariants.`
- `[2026-03-13][Track E] F0-M completed (🔄 -> ✅) - Track E validated run/trace artifact usability via src/fractal_agent_lab/evals/artifact_acceptance.py and scripts/validate_f0_m_artifact_pair.py, recorded evidence in docs/wave0/Wave0-F0-M-Artifact-Validation.md - next: proceed to L1 baseline/rubric layering.`
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
- `[2026-03-18][Meta] W1-S1-FIX-META1 completed (🔄 -> ✅) - W1-S1 stabilization batch is now formally closed, current frontier returns to L1-F/L1-G/L1-H/L1-I sequence - next: Track B begins handoff primitive work.`
- `[2026-03-18][Track B] L1-F completed (🔄 -> ✅) - handoff primitive v1 is now implemented in runtime with explicit handoff control parsing, guardrails against self-loop/revisit/unknown target, and handoff-lane traceability; runtime tests added - next: Track C executes L1-G and Track B proceeds with L1-H trace enrichment.`
- `[2026-03-18][Track C] L1-G started (⬜ -> 🔄) - H1 handoff chain variant implementation started against Track B handoff primitive v1 - next: deliver h1.handoff.v1 workflow, handoff prompt pack, and runnable binding.`
- `[2026-03-18][Track C] L1-G completed (🔄 -> ✅) - H1 handoff chain shipped as h1.handoff.v1 with handoff-specific prompt/pack wiring, registry integration, and mock/test path coverage - next: Track B closes L1-H and Track E executes L1-I comparison.`
- `[2026-03-18][Track B] L1-H completed (🔄 -> ✅) - handoff trace enrichment is now active with dedicated handoff_decided/handoff_failed events, parent/correlation linkage across handoff hops, and decision-source context in handoff lane payloads; runtime + CLI trace regressions pass - next: Track E executes L1-I comparison and Track A can proceed to L1-J timeline work on richer handoff traces.`
- `[2026-03-19][Track E] L1-I started (⬜ -> 🔄) - H1 smoke comparison implementation started for baseline vs manager vs handoff on matched input with artifact validation and normalization - next: ship comparison module, script, tests, and evidence report.`
- `[2026-03-19][Track E] L1-I completed (🔄 -> ✅) - H1 comparison harness shipped with matched-input baseline/manager/handoff runs, artifact acceptance checks, normalized output extraction, and structural trace report output - next: convert evidence into L1-K rubric gates and L1-L decision notes.`
- `[2026-03-19][Track B] W1-S2-FIX-B1/B2 completed (🔄 -> ✅) - runtime now rejects unsupported execution modes (`parallel`, `graph`) instead of silently degrading to linear, and WorkflowSpec now blocks duplicate step_id collisions at contract level with dedicated tests - next: Track E executes W1-S2-FIX-E1, then Track A executes W1-S2-FIX-A1/A2.`
- `[2026-03-19][Track E] W1-S2-FIX-E1 started (⬜ -> 🔄) - stabilization hardening started for L1-I success semantics so envelope-only comparable outputs cannot pass green - next: require full normalized comparable-key completeness and add negative tests.`
- `[2026-03-19][Track E] W1-S2-FIX-E1 completed (🔄 -> ✅) - L1-I summary/exit gating now requires full comparable-key completeness (`all_comparable_outputs_complete`), with negative tests proving incomplete normalized outputs fail green status - next: Track A completes W1-S2-FIX-A1/A2, then Meta closes W1-S2 stabilization.`
- `[2026-03-21][Track E] L1-K started (⬜ -> 🔄) - H1 manual smoke rubric v1 implementation started using stabilized L1-I structural comparison outputs and W1-S2 parity fixes - next: publish repeatable operator rubric with explicit completeness gates.`
- `[2026-03-21][Track E] L1-K completed (🔄 -> ✅) - docs/wave1/Wave1-L1-K-H1-Manual-Smoke-Rubric-v1.md published with matched-input multi-variant checks, structural completeness requirements, and PASS/PARTIAL/FAIL/BLOCKED outcomes - next: proceed to L1-L evidence prep and recommendation notes.`
- `[2026-03-22][Track E] L1-L evidence prep started (⬜ -> 🔄) - Track E started baseline comparison evidence packaging with structural summary, trace-view guidance references, and prompt provenance context - next: publish L1-L evidence-prep artifact for Meta decision closeout.`
- `[2026-03-22][Track E] L1-L evidence prep completed (🔄 -> ✅ Track E scope) - Track E delivered docs/wave1/Wave1-L1-L-H1-Evidence-Prep.md plus eval/script/test support for comparison evidence, tradeoff notes, and recommendation draft; prompt tags are captured as provenance evidence only - next: Meta finalizes L1-L decision log.`
- `[2026-03-22][Meta] L1-L completed (🔄 -> ✅) - Meta accepted the Wave 1 evidence package, set `h1.manager.v1` as the default next multi-agent reference path, preserved `h1.single.v1` as baseline anchor and `h1.handoff.v1` as a learning/reference variant, and moved the mainline frontier to W2-S1 - next: Track B starts `H2-A` / `H2-B` / `H2-C`; docs-only `CV0` is now allowed as optional side work.`
- `[2026-03-20][Track A] W1-S2-FIX-A1/A2 started (⬜ -> 🔄) - Track A stabilization implementation kicked off to restore H1 variant summary parity and preserve handoff linkage fields in CLI JSON trace export - next: ship formatter/test/doc updates for A1 and A2 acceptance.`
- `[2026-03-20][Track A] W1-S2-FIX-A1/A2 completed (🔄 -> ✅) - CLI now exposes H1 workflow-summary parity for single/manager/handoff and JSON trace linkage fields (`parent_event_id`, `correlation_id`) with regression coverage in tests/cli/test_l1_e_h1_summary.py - next: Meta executes W1-S2-FIX-META1 stabilization closeout.`
- `[2026-03-19][Meta] Future coding vertical integrated as a design-first side vertical - H4/H5 and the private learning-loop are now accepted as post-Wave-1 planning work, not immediate runtime scope - next: create private coding-vertical docs and sequencing placeholders.`
- `[2026-03-20][Meta] Coding vertical canon deepened - private H4/H5/coding-policy doc stack now exists with rollout, artifact, planning, review/gate, and learning-loop docs - next: expand Combined sequencing with explicit CV0/CV1/CV2 execution steps.`
- `[2026-03-20][Meta] Sequencing step convention tightened - execution steps now require explicit status markers and parallel-safe work should share one numbered step while true dependencies move to later steps - next: keep future sprint edits aligned with this rule.`
- `[2026-03-20][Meta] Current human workflow canonized for the coding vertical - the current Combined-driven Meta+track loop now has an explicit mapping doc so H4/H5 can automate the real workflow instead of drifting into an abstract coding-agent concept - next: use this mapping as a check during future CV0/CV1/CV2 refinement.`
- `[2026-03-20][Meta] W1-S2-FIX-META1 completed (🔄 -> ✅) - W1-S2 stabilization is now formally closed after targeted compile/test validation, and the active frontier returns to W1-S3: `L1-J` / `L1-K` / `L1-L` / `L1-M` - next: run the parallel opening step across Track A, Track E, and Track C.`
- `[2026-03-20][Track A] L1-J started (⬜ -> 🔄) - basic trace viewer/timeline summary implementation started from persisted trace artifacts so handoff-linked traces can be inspected without raw JSON spelunking - next: land `fal trace show --run-id` with linkage-aware timeline output and regression tests.`
- `[2026-03-22][Track C] L1-M started (⬜ -> 🔄) - formal H1 prompt-version tagging implementation started to surface variant/pack/role prompt provenance in summaries and artifacts - next: add prompt-tag manifest helper, pack metadata validation hardening, and additive CLI visibility.`
- `[2026-03-22][Track C] L1-M completed (🔄 -> ✅) - H1 prompt tagging is now explicit via `prompt_tags` for manager/single/handoff variants, with stronger pack metadata validation and additive summary/artifact exposure - next: Track E continues L1-L evidence prep with stable prompt provenance context.`
- `[2026-03-20][Track A] L1-J completed (🔄 -> ✅) - Track A delivered CLI-first trace viewer support via `trace show --run-id` with linkage-aware timeline rendering from stored artifacts (`parent_event_id`/`correlation_id` preserved), plus regression tests in tests/cli/test_l1_j_trace_viewer.py - next: proceed with remaining W1-S3 epics before Wave 1 closeout.`
- `[2026-03-22][Track C] L1-N/L1-O started (⬜ -> 🔄) - optional Wave 1 identity prep docs started as design-only artifacts (no code/schema/runtime changes) - next: publish profile schema draft and signal-carrier convention draft with explicit Track B compatibility boundaries.`
- `[2026-03-22][Track C] L1-N/L1-O completed (🔄 -> ✅) - design-only identity prep delivered via docs/wave1/Wave1-L1-N-Identity-Profile-Schema-Draft.md and docs/wave1/Wave1-L1-O-Identity-Signal-Carrier-Convention.md, keeping runtime contracts unchanged and preparing Wave 2 observational identity MVP semantics.`
- `[2026-03-30][Meta] Track D real-provider roadmap canonized - Wave 2 stays prep-only, Wave 3 gets the first non-blocking real-provider MVP side batch, and Wave 4 now owns provider parity/routing hardening - next: implement the documented placement in future Track D execution without displacing the mainline.`
- `[2026-04-01][Meta] CV0-A completed (⬜ -> ✅) - H4/H5 artifact contract finalized with canonical sidecar path, run/trace correlation rules, and mandatory envelope fields - next: CV0-B (Track C H4 planning prompt review) when mainline bandwidth allows.`
- `[2026-04-04][Track C] CV0-B completed (⬜ -> ✅) - docs-only H4 planning prompt/policy review delivered as a decision package with narrow-scope normalization (H4-focused), Combined-authoritative readiness/order clarification, OpenCode-anchored reaffirmation, and targeted cross-doc alignment updates without H5 gate-policy rewrite or runtime/schema/tooling claims - next: Track E executes CV0-C and Meta closes CV0 with CV1 prerequisite note.`
- `[2026-04-04][Track E] CV0-C started (⬜ -> 🔄) - docs-only H5 review/gate policy review started with strict scope boundary (policy review only, no CV2 execution claims), control-surface/OpenCode alignment checks, and false-green guardrail preservation goals - next: publish H5 review outcome package and apply targeted policy wording alignment.`
- `[2026-04-04][Track E] CV0-C completed (🔄 -> ✅) - H5 review/gate policy review delivered via docs/private/Coding-Vertical-H5-Review-Gate-Policy-Review-v01.md with explicit CV0-vs-CV2 boundary language, strengthened anti-false-green and artifact-contract-consumption wording, and cross-doc consistency updates without runtime/eval/schema/tooling changes - next: Meta executes CV0-D closeout and records CV1 prerequisite stance.`
- `[2026-04-04][Meta] CV0-D completed (⬜ -> ✅) - CV0 is now closed as a docs-only coding-vertical batch after reconciling Track C H4 and Track E H5 review outcomes; `CV1` is ready by named prerequisites but remains a side-vertical option that does not replace the active Wave 2 mainline frontier - next: continue the active mainline queue unless `CV1` is explicitly chosen.`
- `[2026-04-01][Track B] W2-S1 H2-A/H2-B/H2-C completed (🔄 -> ✅) - RunState hardened to v1 with additive lifecycle/failure fields, TraceEvent contract moved to v1, and runtime failure classification/error-envelope v1 now emits consistently to run artifacts and terminal trace payloads; artifact validation tightened (schema support, event-id uniqueness, timestamp validity, trace-id ordering) with negative-path + cross-surface tests - next: execute H2-D persistence layout hardening on top of the stabilized contracts.`
- `[2026-04-01][Track B] W2-S1 H2-D completed (🔄 -> ✅) - persistence layout hardened with centralized artifact path resolution (`runs`/`traces` canonical truth preserved), additive `artifacts/<run_id>/` sidecar-ready surface, and cross-surface writer/reader/eval alignment with new tracing layout tests - next: W2-S2 starts in parallel on Track E (`H2-E`) and Track C (`H2-I/H2-J/H2-M`) atop the stabilized contracts.`
- `[2026-04-02][Track E] H2-E started (⬜ -> 🔄) - replay foundation implementation started with strict artifact-backed scope (`run_id + data_dir`, shared path resolver, artifact_acceptance preflight) and no rerun/smoke overreach - next: deliver reconstruction module, script, tests, and Wave 2 implementation note.`
- `[2026-04-02][Track E] H2-E completed (🔄 -> ✅) - Track E shipped artifact-backed replay/read/reconstruction via src/fractal_agent_lab/evals/artifact_replay.py and scripts/run_h2_e_artifact_replay.py, with v0/v1 compatibility, linkage-aware timeline/orchestration/failure summaries, and preflight-blocking negative-path tests - next: proceed to H2-F/H2-G while Track C closes H2-I/H2-J/H2-M.`
- `[2026-04-03][Track C] H2-M started (⬜ -> 🔄) - Identity profile foundation implementation started with strict scope (`IdentityProfile` + `IdentitySnapshot` + JSON store) and no updater/drift/routing/runtime-schema expansion - next: deliver identity models/store code, tests, and Wave 2 implementation note.`
- `[2026-04-03][Track C] H2-M completed (🔄 -> ✅) - Identity profile model v0 delivered via `IdentityProfile`/`IdentitySnapshot` models and `JSONIdentityStore` under src/fractal_agent_lab/identity/, with roundtrip + negative-path tests and no updater/drift/routing/runtime-schema spillover - next: continue W2-S2 Step 1 closeout on H2-I/H2-J in parallel Track C sessions.`
- `[2026-04-03][Track C] H2-I/H2-J started (⬜ -> 🔄) - Track C opened W2-S2 Step 1 closeout batch: H2-I session-memory v1 foundation (`input_payload.session_id` lookup, no new CLI surface) and H2-J H1 manager role-boundary cleanup - next: align pack validation/tests and land memory store/context load surfaces.`
- `[2026-04-03][Track C] H2-I/H2-J completed (🔄 -> ✅) - H2-J removed misleading manager-pack handoff topology and aligned validation/tests to manager authority (`manager_spec` + manager control); H2-I delivered M1 session-memory foundation via JSON store + context injection from `input_payload.session_id` + optional sidecar snapshot, with negative-path/context-pass-through tests and no H2-K/H2-N spillover - next: proceed to H2-K/H2-N and Track E H2-F/H2-G progression.`
- `[2026-04-03][Track E] H2-F/H2-G started (⬜ -> 🔄) - Track E opened W2-S2 Step 2 with strict scope guardrails: H2-F replay-backed stored-artifact smoke only, H2-G additive baseline/provenance tags only, no rerun-default and no scoring/schema churn - next: deliver eval modules/scripts/tests and Wave 2 doc.`
- `[2026-04-03][Track E] H2-F/H2-G completed (🔄 -> ✅) - H2-F shipped via h1_smoke_suite over replay artifacts with completeness + linkage-aware gates, H2-G shipped via h1_baseline_tags with policy-aligned baseline roles and provenance-only prompt tags, plus scripts/tests/docs and no canonical artifact schema mutations - next: proceed to H2-H draft while Track C advances H2-K/H2-N.`
- `[2026-04-03][Track C] H2-N started (⬜ -> 🔄) - post-run identity updater implementation started with strict scope: signal-envelope normalizer + derived fallback + bounded profile update + snapshot append + per-run sidecar, config-gated and non-fatal from CLI post-run path - next: deliver updater module, tests, and Wave 2 implementation note without runtime/schema churn.`
- `[2026-04-03][Track C] H2-K started (⬜ -> 🔄) - memory candidate extraction policy v1 implementation started with strict guardrails: success-only + session-tagged-only + H1-first deterministic extraction, optional non-canonical sidecar artifact output, and no canonical session-store mutation - next: deliver extractor module, tests, and Wave 2 implementation note.`
- `[2026-04-03][Track C] H2-K completed (🔄 -> ✅) - memory candidate extraction policy v1 shipped with deterministic success-only/session-tagged H1 extraction, non-canonical `memory_candidates.json` sidecar output under `data/artifacts/<run_id>/`, and test coverage proving failed/no-session gating plus canonical session-store non-mutation - next: continue H2-N updater work and hand off H2-K outputs to Track E H2-L evaluation.`
- `[2026-04-03][Track C] H2-N completed (🔄 -> ✅) - identity updater v0 delivered with `identity.signal.v0` normalization, explicit-over-fallback merge, bounded profile updates, profile save + snapshot append, and non-canonical `identity_update.json` sidecar output; CLI integration is config-gated and wrapped by dedicated non-fatal error handling - next: hand off to Track B H2-N boundary review and Track E H2-O dependency chain.`
- `[2026-04-03][Track E] H2-H draft started (⬜ -> 🔄) - Track E opened W2-S2 Step 3 as a doc-only regression-checklist draft from H2-E/H2-F/H2-G evidence, with strict bucket semantics and no hidden contract enforcement - next: publish the checklist and hand off Track B confirmation candidates for W2-S3.`
- `[2026-04-03][Track E] H2-H draft completed (🔄 -> ✅ Track E draft scope) - docs/wave2/Wave2-W2-S2-TrackE-H2-H-Draft-Regression-Checklist.md published with explicit three-bucket separation (enforced now / observed expectations / Track B confirmation candidates), RF-2026-03-19-02 false-green anchor retained, and Track C references kept as compatibility watchpoints only - next: Track B executes W2-S3 H2-H contract confirmation scope (still open).`
- `[2026-04-04][Track B] W2-S3 Step 1 H2-H/H2-N completed (🔄 -> ✅) - Track B confirmed shared contract boundaries for H2-H (including draft doc/code consistency corrections) and completed H2-N runtime-boundary review with explicit additive-sidecar decisions (orphan-tolerant updater behavior, provenance simplification acceptance, and supported wrapper/orchestration dependency surfaces), plus targeted negative-path tests - next: Track E executes W2-S3 Step 2 (`H2-L` / `H2-O`).`
- `[2026-04-04][Track E] H2-L/H2-O started (⬜ -> 🔄) - Track E opened W2-S3 Step 2 with manager-first H2-L session-memory materiality eval and run-id-first H2-O identity drift smoke, preserving no-schema-churn/no-routing/no-prompt-rewrite boundaries - next: deliver eval modules/scripts/tests and Wave 2 implementation note.`
- `[2026-04-05][Track E] H2-L/H2-O completed (🔄 -> ✅) - H2-L now validates canonical session-memory load-path usage without mutating persistent store state across paired branches, and H2-O now requires real updater evidence, honors configured identity-store subdirs, validates present canonical artifacts, and still keeps orphan sidecars warning-grade only; scripts/tests/docs updated accordingly - next: Meta executes Wave 2 closeout sequencing.`
- `[2026-04-05][Meta] Wave 2 closeout completed (🔄 -> ✅) - lightweight runtime/eval/CLI consistency pass found no new closeout blocker, Wave 3 mainline is now activated at W3-S1 Step 1 (`R3-A` H2 workflow schema v1), `CV1` remains optional side-vertical work only by explicit activation, and the Wave 3 real-provider side batch remains gated until W3-S1 completion.`
- `[2026-04-10][Track C] R3-A completed (⬜ -> ✅) - H2 workflow schema v1 delivered as `h2.manager.v1` with explicit five-role topology (`synthesizer` manager + `intake`/`planner`/`architect`/`critic` workers), stable schema refs/metadata, and manager-runtime compatibility tests that prove explicit control turns (not fallback-only success); no runtime churn, no registry wiring, and no H2 agent-pack implementation in this step - next: Track B reviews R3-A schema contract and Track C proceeds to R3-B role pack.`
- `[2026-04-10][Track B] R3-A schema review completed (🔄 -> ✅ Track B scope) - Track B confirmed H2 manager-schema/runtime compatibility and hardened WorkflowSpec manager invariants so missing/unknown/duplicate manager-worker topology and manager-entrypoint mismatch are rejected before runtime, with targeted negative-path tests - next: Track C continues R3-B and Track B returns at R3-E schema review.`
- `[2026-04-10][Track C] R3-B completed (⬜ -> ✅) - H2 manager role pack v1 delivered under `agents/h2` with explicit intake/planner/architect/critic/synthesizer separation, prompt-version metadata discipline, manager-only pack validation (no handoff topology), registry wiring for `h2.manager.v1`, and H2-specialized mock manager behavior with strict upstream-context guards; runnable mock-path tests confirm explicit delegate/finalize turn evidence and block fallback-only false-green acceptance - next: Track C proceeds to R3-C while Track E opens R3-D skeleton prep after R3-B.`
- `[2026-04-10][Track E] R3-D skeleton prep started (⬜ -> 🔄) - Track E opened W3-S1 Step 3 docs-first H2 smoke-rubric skeleton work on top of R3-A review + R3-B runnable evidence, with explicit provisional-only semantics and no eval module/script/runtime expansion - next: publish skeleton artifact and keep finalization gated on R3-C.`
- `[2026-04-10][Track E] R3-D skeleton prep completed (stays 🔄 at epic level) - Track E published docs/wave3/Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-Skeleton.md with explicit Step-3 scope boundaries (current runnable evidence vs deferred finalization), preserving that final smoke rubric freeze belongs to Step 4 after R3-C - next: finalize R3-D once R3-C is complete.`
- `[2026-04-10][Track C] R3-C completed (⬜ -> ✅) - H2 output-template v1 is now frozen with canonical section ordering and planner-owned `recommended_starting_slice`; H2 prompt semantics were tightened with selective role-level version bumps, and mock finalization now enforces stricter structured-output guards (including implementation-wave item shape) so template completeness failures cannot pass as green finalization - next: Track E finalizes R3-D in W3-S1 Step 4; Track C returns at R3-E after W3-S1 completion.`
- `[2026-04-11][Track E] R3-D finalize started (⬜ -> 🔄) - Track E opened `W3-S1` Step 4 finalize for the final `h2.manager.v1` smoke-rubric v1 using frozen `R3-C` template constraints; the Step-3 skeleton remains as the immutable audit artifact.`
- `[2026-04-11][Track E] R3-D finalized (🔄 -> ✅) - Track E published `docs/wave3/Wave3-W3-S1-TrackE-R3-D-H2-Smoke-Rubric-v1.md` as final v1 after `R3-C`, and moved `W3-S1` mainline forward to `W3-S2` Step 1 / `R3-E`; side work keeps `R3-H` tied to finalization semantics and no runtime/contract changes.`
- `[2026-04-11][Track C] R3-E completed (⬜ -> ✅) - Track C delivered `h3.manager.v1` schema baseline with explicit `synthesizer` manager topology (`intake`/`planner`/`systems`/`critic` workers), root workflow exports, and workflow-spec tests proving manager-envelope compatibility (`step_results` + `manager_orchestration` + `final_output`) with explicit no-freeze guardrail for H3 section naming/order until `R3-G`; next: Track B reviews `R3-E` and Track C proceeds to `R3-F`.`
- `[2026-04-12][Track B] R3-E schema review completed (🔄 -> ✅ Track B scope) - Track B confirmed H3 schema/runtime boundary compatibility as docs-only confirmation (no new generic manager contract gap found), kept deferred section-law freeze explicitly outside `R3-E`, and closed review with green validation; next: Track C continues `R3-F` in the parallel W3-S2 Step 2 lane.`
- `[2026-04-12][Track C] R3-F completed (⬜ -> ✅) - Track C delivered H3 manager role pack v1 under `agents/h3` with explicit intake/planner/systems/critic/synthesizer separation, manager-only pack validation (no handoff topology), `h3.manager.v1` registry wiring, and H3-specialized mock manager behavior with strict upstream-context plus malformed-output fail-loud checks; runnable tests prove explicit delegate/finalize turn evidence while keeping section naming/order as current runnable defaults only (exact freeze deferred to `R3-G`).`
- `[2026-04-12][Track E] R3-H skeleton prep started (⬜ -> 🔄) - Track E opened W3-S2 Step 3 docs-first H3 smoke-review skeleton work using `R3-E` + Track B `R3-E` review + `R3-F` runnable evidence, with strict provisional-only boundaries and no eval/runtime/schema expansion - next: publish Step-3 skeleton artifact and keep finalize gated on `R3-G`.`
- `[2026-04-12][Track E] R3-H skeleton prep completed (stays 🔄 at epic level) - Track E published `docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-Skeleton.md` as the Step-3 provisional artifact (`current runnable evidence` vs deferred `R3-G` section-law freeze), and preserved Step-4 finalize as the post-`R3-G` gate.`
- `[2026-04-12][Track C] R3-G completed (⬜ -> ✅) - Track C froze H3 output sections v1 (`strengths`, `bottlenecks`, `merge_risks`, `refactor_ideas`) with synthesizer prompt/pack version alignment (`h3.prompt.v2`, `h3/synthesizer/v2`) and exact-order runnable acceptance assertions in H3 manager adapter tests, while preserving manager-envelope compatibility boundaries and evaluator deferral.`
- `[2026-04-13][Track E] R3-H finalize started (⬜ -> 🔄) - Track E opened W3-S2 Step 4 finalize using frozen `R3-G` section-law, kept Step-3 skeleton immutable as historical evidence, and maintained docs-first/no-scope-creep boundaries - next: publish final H3 smoke review v1 and close W3-S2.`
- `[2026-04-13][Track E] R3-H finalized (🔄 -> ✅) - Track E published `docs/wave3/Wave3-W3-S2-TrackE-R3-H-H3-Smoke-Review-v1.md` as final manual rubric v1, completed W3-S2 Step 4, and moved Track E mainline forward to W3-S3 Step 1 (`R3-K`).`
- `[2026-04-14][Track E] R3-K started (⬜ -> 🔄) - Track E opened W3-S3 Step 1 comparison work with explicit split: H1 replay-backed variant comparison surfaces reused, H2 replay-backed multi-run comparability surface added for `h2.manager.v1`; no winner-scoring and no CLI artifact-path claims.`
- `[2026-04-14][Track E] R3-K completed (🔄 -> ✅) - Track E delivered `docs/wave3/Wave3-W3-S3-TrackE-R3-K-H1-H2-Comparison-v1.md` plus H2 compare contracts/projections/report+script and fail-loud tests, and moved Track E to W3-S3 Step 2 `R3-L` wait-state behind `R3-I` completion.`
- `[2026-04-14][Track A] R3-J started (⬜ -> 🔄) - Track A opened W3-S3 Step 1 viewer uplift for multi-workflow browsing while preserving strict single-run drill-down behavior in `trace show` - next: add `trace list` with explicit browse failure policy and filters.`
- `[2026-04-14][Track A] R3-J completed (🔄 -> ✅) - Track A shipped multi-workflow trace browsing via `trace list` with workflow/status filters, row-level degrade warnings for broken artifact rows, and preserved fail-loud `trace show` semantics, with regression coverage in tests/cli/test_r3_j_trace_browser.py.`
- `[2026-04-14][Track C] R3-I completed (⬜ -> ✅) - Track C delivered project-memory v1 (`M2`) with explicit `project_id`-keyed canonical store (`data/memory/projects/<project_id>.json`), additive project-memory context loading, and non-fatal post-run updater flow for successful `h2.manager.v1`/`h3.manager.v1` runs, with deterministic anti-noise merge/dedupe and explicit canonical-vs-sidecar separation.`
- `[2026-04-14][Track E] R3-L evidence curation completed (⬜ -> ✅ Track E Step 2 scope) - Track E delivered `docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md` and explicit-run-id helper/script/tests (`r3_l_evidence_curation`) with disclosure and schema-version-labeled curated manifest; bounded H2 current-corpus sweep truth is explicit (`comparison_ready: false`), H1 is marked replay-backed historical evidence, and M2 remains not demonstrated on selected runs - next: Track A executes W3-S3 Step 3 presentation packaging.`

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

### Session: Coding Vertical Lab
Focus:
- H4/H5 workflow-family design
- repo-aware planning/review contracts
- artifact and gate discipline
- private learning-loop distillation

Use when:
- software-delivery workflow design needs canonization
- coding review/gate policies need revision
- coding-vertical sequencing or ownership is unclear
- repeated coding-review evidence should feed private heuristics

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

## 25. Current future/private design set in scope

These are not the active implementation frontier, but they are now canonical future-design surfaces for the coding vertical:

1. `docs/private/Coding-Vertical-v01.md`
2. `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
3. `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
4. `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
5. `docs/private/Coding-Vertical-Artifact-Contract-v01.md`
6. `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
7. `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
8. `docs/private/Coding-Vertical-Learning-Loop-v01.md`
9. `docs/private/Coding-Vertical-H4-Planning-Prompt-Review-v01.md`
10. `docs/private/Coding-Vertical-H5-Review-Gate-Policy-Review-v01.md`
11. `docs/private/Model-Reasoning-Effort-Policy-Note-v01.md`

**CV0 execution status:** complete; `CV0-A`/`CV0-B`/`CV0-C`/`CV0-D` are now closed, and `CV1` is ready by named prerequisites but remains subordinate to the active mainline frontier in Combined.

Rule:
- CV0 runs alongside Wave 2 mainline as docs-only design work
- CV0 may start CV0-1 in parallel with W2-S1, but Track C/E involvement waits for mainline bandwidth availability
- treat these docs as the input/output surface for CV0, not as permission to skip W2 mainline priorities

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
