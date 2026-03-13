# Combined Execution Sequencing Plan

**Project:** Fractal Agent Lab  
**Owner:** Meta Coordinator  
**Scope:** Track-level execution ordering for the A1 + A2 + A3 hybrid roadmap  
**Intent:** turn `ops/AGENTS.md` from a coordination map into an actually executable wave / sprint plan  
**Status:** active planning document  
**Last updated:** 2026-03-09

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
- `F0-L` moved through `🔄` and is now complete: Track E shipped `docs/Wave0-Manual-Smoke-Checklist.md` with Wave 0 scope boundaries, execution commands, pass/fail labels, and gate mapping to prevent smoke-theater claims.
- `F0-M` moved through `🔄` and is now complete on Track B scope: run artifact write path and trace artifact write path are implemented with canonical shape serialization under `data/runs/<run_id>.json` and `data/traces/<run_id>.jsonl`, integrated into CLI run execution after each run.
- `F0-M` moved through `🔄` and is now complete on Track E scope: artifact usability validation is complete for both success and failure paths, with acceptance constraints codified in `src/fractal_agent_lab/evals/artifact_acceptance.py` and evidence documented in `docs/Wave0-F0-M-Artifact-Validation.md`.

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
- ⬜ **L1-A** H1 workflow schema v1 — **Owner: Track C** (Track B reviews schema contract)
- ⬜ **L1-B** Manager orchestration primitive stabilized — **Owner: Track B**
- ⬜ **L1-C** H1 agent pack v1: intake / planner / critic / synthesizer — **Owner: Track C**
- ⬜ **L1-D** H1 baseline single-agent reference path — **Owner: Track E** (Track C provides single-agent config)
- ⬜ **L1-E** Run summary output improves for H1 — **Owner: Track A**

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

#### Sprint W1-S2 — Handoff variant for H1

**Owner priority:** B + C + D

Epics:
- ⬜ **L1-F** Handoff primitive v1 — **Owner: Track B**
- ⬜ **L1-G** H1 handoff chain variant — **Owner: Track C** (with Track B support)
- ⬜ **L1-H** Trace event enrichment for handoffs — **Owner: Track B**
- ⬜ **L1-I** H1 smoke comparison: baseline vs manager vs handoff — **Owner: Track E**

**Sequential ordering:**
1. L1-F first (handoff primitive must exist)
2. L1-G and L1-H can proceed in parallel after L1-F
3. L1-I after L1-G and L1-H (comparison needs both variants + enriched traces)

**Prerequisites:**
- `L1-A` through `L1-D` must be `✅`

**Track readiness:**
- Track A trace viewer is `READY` for basic timeline after `L1-H`
- Track E replay can begin only after at least two saved variant runs exist

#### Sprint W1-S3 — First visibility hardening

**Owner priority:** A + E, with B/C patching as needed

Epics:
- ⬜ **L1-J** Basic trace viewer / timeline summary — **Owner: Track A**
- ⬜ **L1-K** H1 manual smoke rubric v1 — **Owner: Track E**
- ⬜ **L1-L** H1 baseline comparison notes and decision log — **Owner: Track E + Meta**
- ⬜ **L1-M** prompt version tagging for H1 agent pack — **Owner: Track C**

All four epics can proceed in parallel (no inter-dependencies within this sprint).

**Execution assignment for co-owned epic:**
- `L1-L`: **Track E -> Meta**
  - Track E prepares comparison evidence and evaluation notes
  - Meta finalizes decision log and coordination implications

#### Wave 1 optional identity prep (design only, no implementation)

- ⬜ **L1-N** Identity profile schema design draft — **Owner: Track C**
- ⬜ **L1-O** Identity signal carrier convention draft — **Owner: Track C** (Track B reviews for runtime compatibility)

These are design/doc artifacts only. They prepare the observational identity MVP for Wave 2 without requiring code changes.
Reference: `docs/Emergent-Identity-Layer-v01.md`

**Wave 1 gate to close the wave:**
- H1 works in at least one multi-agent mode
- there is a visible trace trail
- there is at least one explicit comparison to a single-agent baseline
- H1 output is good enough to use on a real idea, even if imperfect

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
- ⬜ **H2-A** `RunState` hardening v1 — **Owner: Track B**
- ⬜ **H2-B** `TraceEvent` versioned contract v1 — **Owner: Track B**
- ⬜ **H2-C** failure classification and error envelope v1 — **Owner: Track B**
- ⬜ **H2-D** run persistence layout for runs/traces/artifacts — **Owner: Track B**

**Sequential ordering:**
1. H2-A, H2-B, H2-C can proceed in parallel (independent schema work)
2. H2-D after H2-A, H2-B, H2-C (persistence layout depends on final schema shapes)

**Prerequisites:**
- Wave 1 complete

**Track readiness:**
- Track A trace viewer enhancements wait for `H2-B`
- Track E replay waits for `H2-D`
- Track C memory extraction waits for stable trace/run persistence layout

#### Sprint W2-S2 — Replay and smoke discipline

**Owner priority:** E + B

Epics:
- ⬜ **H2-E** Replay capability for at least H1 — **Owner: Track E** (Track B provides persistence hooks)
- ⬜ **H2-F** Smoke suite v1 for H1 — **Owner: Track E**
- ⬜ **H2-G** baseline run capture and comparison tags — **Owner: Track E**
- ⬜ **H2-H** simple regression checklist for shared schemas — **Owner: Track E + Track B**

**Sequential ordering:**
1. H2-E first (replay capability is foundational for the rest)
2. H2-F and H2-G can proceed in parallel after H2-E
3. H2-H after H2-F and H2-G (regression checklist needs smoke + baselines defined)

**Execution assignment for co-owned epic:**
- `H2-H`: **Track E -> Track B**
  - Track E drafts regression checklist and replay assertions
  - Track B confirms schema-level enforceability and contract alignment

**Prerequisites:**
- `H2-A` through `H2-D` must be `✅`

#### Sprint W2-S3 — Early memory and role separation hardening

**Owner priority:** C, with B and E support

Epics:
- ⬜ **H2-I** Session memory v1 (M1 only) — **Owner: Track C**
- ⬜ **H2-J** agent role boundary cleanup for H1 — **Owner: Track C**
- ⬜ **H2-K** memory candidate extraction policy v1 — **Owner: Track C** (Track E evaluates)
- ⬜ **H2-L** evaluate whether session memory helps H1 materially — **Owner: Track E**
- ⬜ **H2-M** Identity profile model v0 (`IdentityProfile` + `IdentitySnapshot` + JSON store) — **Owner: Track C**
- ⬜ **H2-N** Identity signal convention + post-run updater v0 — **Owner: Track C** (Track B reviews runtime boundary)
- ⬜ **H2-O** Identity drift smoke checks v0 — **Owner: Track E**

**Sequential ordering:**
1. H2-I and H2-J can start in parallel (session memory + role cleanup are independent)
2. H2-K after H2-I (extraction policy depends on memory foundation)
3. H2-L after H2-I and H2-K (evaluation needs memory to exist)
4. H2-M can start in parallel with H2-I/H2-J (identity model is independent of memory)
5. H2-N after H2-M (updater needs identity model)
6. H2-O after H2-M and H2-N (drift checks need profile + updater)

Reference for H2-M/N/O: `docs/Emergent-Identity-Layer-v01.md`

**Wave 2 gate to close the wave:**
- H1 can be replayed
- H1 has smoke checks
- state and trace are stable enough for downstream consumers
- session memory exists in minimal form, or a documented decision says why it is deferred
- identity profile model exists and at least one post-run update produces observable output, or a documented decision says why it is deferred

### Wave 2 anti-scope-creep rule
No provider-agnostic abstraction expansion beyond what is needed to keep the core clean.
Wave 2 is about trustworthiness, not ecosystem breadth.

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

### Wave 3 sequencing principle
Wave 3 is where the project starts behaving like a **research OS**, not just an orchestration lab.
Track C rises sharply in strategic importance, but E must continue to protect against self-deception.

### Wave 3 sprint breakdown

#### Sprint W3-S1 — H2 Project Decomposition

**Owner priority:** C + B + E

Epics:
- ⬜ **R3-A** H2 workflow schema v1 — **Owner: Track C** (Track B reviews schema contract)
- ⬜ **R3-B** H2 architect / planner / critic role pack — **Owner: Track C**
- ⬜ **R3-C** H2 sequencing and risk-zone output template — **Owner: Track C**
- ⬜ **R3-D** H2 smoke rubric — **Owner: Track E**

**Sequential ordering:**
1. R3-A first (schema must exist before roles wire to it)
2. R3-B after R3-A
3. R3-C after R3-B (output template uses the role pack)
4. R3-D after R3-C (smoke rubric needs complete workflow to check)

**Prerequisites:**
- Wave 2 complete

#### Sprint W3-S2 — H3 Architecture Review (draft quality)

**Owner priority:** C + E, supported by B/A

Epics:
- ⬜ **R3-E** H3 workflow schema v1 — **Owner: Track C** (Track B reviews)
- ⬜ **R3-F** H3 systems / critic / synthesizer role pack — **Owner: Track C**
- ⬜ **R3-G** H3 output sections: strengths / bottlenecks / merge risks / refactor ideas — **Owner: Track C**
- ⬜ **R3-H** H3 draft smoke review — **Owner: Track E**

**Sequential ordering:**
1. R3-E first (schema)
2. R3-F after R3-E (role pack binds to schema)
3. R3-G after R3-F (output sections use role pack)
4. R3-H after R3-G (smoke review needs complete workflow)

**Prerequisites:**
- `R3-A` through `R3-D` strongly recommended complete first

#### Sprint W3-S3 — Project memory and visibility uplift

**Owner priority:** C + A + E

Epics:
- ⬜ **R3-I** Project memory v1 (M2) for stable decisions and workflow learnings — **Owner: Track C**
- ⬜ **R3-J** trace viewer improvements for multi-workflow browsing — **Owner: Track A**
- ⬜ **R3-K** compare multiple runs/variants for H1/H2 — **Owner: Track E**
- ⬜ **R3-L** portfolio-quality example runs documented — **Owner: Track A + Track E**

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
- at least two meaningful adapters exist
- model routing policy is explicit
- one non-primary adapter path is smoke-tested
- provider-specific behavior does not leak into core workflow logic

### Wave 4 sprint breakdown

#### Sprint W4-S1 — Adapter boundary formalization

Epics:
- ⬜ **P4-A** adapter interface contract v1 — **Owner: Track D** (Track B reviews boundary)
- ⬜ **P4-B** OpenRouter/OpenAI-compatible parity pass — **Owner: Track D**
- ⬜ **P4-C** provider config and model-tier policy file — **Owner: Track D**

**Sequential ordering:**
1. P4-A first (adapter contract must stabilize before parity work)
2. P4-B and P4-C can proceed in parallel after P4-A

#### Sprint W4-S2 — Optional local or secondary provider experiment

Epics:
- ⬜ **P4-D** LocalModelAdapter stub or limited implementation — **Owner: Track D**
- ⬜ **P4-E** smoke comparison: primary vs secondary adapter — **Owner: Track E**
- ⬜ **P4-F** routing notes: which tasks deserve which model tier — **Owner: Track D + Meta**

**Sequential ordering:**
1. P4-D first (local adapter must exist)
2. P4-E after P4-D (comparison needs second adapter)
3. P4-F after P4-E (routing notes informed by comparison results)

**Execution assignment for co-owned epic:**
- `P4-F`: **Track D -> Meta**
  - Track D prepares technical routing evidence and model-tier recommendations
  - Meta finalizes policy note and cross-track rollout guidance

### Wave 4 gate to close the wave:**
- same workflow can run through at least two adapter routes
- core logic does not fork per provider
- routing policy is documented and understandable

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

#### Sprint W5-S2 — Workbench primitives

Epics:
- ⬜ **U5-D** workflow launch form — **Owner: Track A**
- ⬜ **U5-E** compare two runs — **Owner: Track A + Track E**
- ⬜ **U5-F** inspect stored project memory and eval summary — **Owner: Track A**

**Sequential ordering:**
1. U5-D first (launch form is prerequisite for useful comparison)
2. U5-E and U5-F can proceed in parallel after U5-D

**Execution assignment for co-owned epic:**
- `U5-E`: **Track E -> Track A**
  - Track E defines comparison metrics and validation expectations
  - Track A implements UX and interaction flow for run comparison

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
| 2 | Engine hardening | lead | adapt roles/memory | support | co-lead | stable trace UI |
| 3 | Research OS usefulness | schema authority | lead | support | co-lead | visibility uplift |
| 4 | Provider expansion | protect core | minor | lead | compare | optional UI support |
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

This is the recommended near-term order after creating this document.

### Step 1
Track B begins:
- `F0-A`
- `F0-B`
- `F0-C`

### Step 2
While B works, parallel prep only:
- Track D drafts adapter contract note
- Track A drafts CLI command shape
- Track C drafts H1 role definitions
- Track E drafts manual smoke template

### Step 3
Once `F0-B/F0-C` are `✅`:
- Track D begins minimal adapter
- Track A begins CLI shell
- Track C begins minimal H1-lite agent pack

### Step 4
Once first run works:
- Track E defines and executes the first smoke
- Track A improves readability
- Meta Coordinator records first true cross-track handoff state

### Step 5
Wave 1 begins only after:
- first run exists
- first trace exists
- first smoke exists

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
5. `docs/Track-E-Smoke-Rubric-v0.md`

---

## 17. Open design questions intentionally left unresolved

These are **not blockers** for Wave 0, but will matter later.

1. How rich should the long-term memory merge policy become?
2. Should local models matter for real use or only experimentation?
3. When should explicit graph workflows replace simpler orchestration?
4. How soon should project memory become visible in the UI?
5. What exact eval rubric best predicts “actually helpful” outputs for H1/H2/H3?

These remain open by design so that implementation can teach the architecture.

---

## 18. Initial uzenofal entries for sequencing kickoff

- `[2026-03-06][Meta] Combined execution sequencing plan initialized - wave ladder and turn-gate protocol established - next: Track B Wave 0 foundation kickoff.`
- `[2026-03-06][Meta] Early orchestration policy resolved - Wave 1 defaults to manager + limited handoff, graph hardening deferred - next: encode in Track B/C workflow design.`
- `[2026-03-06][Meta] Hero workflow unlock order fixed - H1 first, H2 second, H3 third - next: create H1 workflow plan.`
- `[2026-03-06][Meta] Overbuild risk explicitly gated - provider expansion and workbench delayed until core earns it - next: keep Wave 0 and Wave 1 narrow.`
- `[2026-03-09][Meta] Emergent Identity Layer integrated into sequencing plan - observational MVP targets W2-S3 (H2-M/N/O), optional design prep in W1-S3 (L1-N/O), Track C primary owner - next: create identity/ package skeleton.`
- `[2026-03-09][Meta] Track ownership and sequential ordering added to all epics across all waves - every epic now has explicit owner and ordering constraints documented.`
- `[2026-03-09][Track D] F0-F implemented - StepRunner adapter boundary, MockAdapter path, and provider routing shell are active - next: wire CLI config loading path for F0-I.`
- `[2026-03-09][Track D] F0-I implemented - CLI now loads runtime/providers/model policy config and applies provider selection shell through adapter step runner - next: coordinate smoke/acceptance with Track A/E.`
- `[2026-03-09][Track A] F0-G completed - CLI shell now runs Wave 0 demo workflow through runtime executor with list-workflows/run commands and optional trace summary - next: complete F0-H formatting hardening.`
- `[2026-03-09][Track A] F0-H completed - minimal run summary contract now standardized across text/json output for Wave 0 CLI runs - next: proceed to W0-S3 dependencies with Track C/E.`
- `[2026-03-11][Track E] F0-L started (⬜ -> 🔄) - manual smoke checklist implementation kicked off against Wave 0 runnable path and Track B runtime contracts - next: publish executable checklist with acceptance labels.`
- `[2026-03-11][Track E] F0-L completed (🔄 -> ✅) - Wave 0 manual smoke checklist published in docs/Wave0-Manual-Smoke-Checklist.md with command baseline, trace/run checks, and outcome taxonomy - next: use checklist outputs to support F0-M artifact/replay validation.`
- `[2026-03-13][Track E] Coordination doc visibility note recorded - ops/docs markdown remains locally readable by opencode even when ignored by git, but those changes are not visible in git status or standard commit flow - next: treat documentation auditability separately from local read access.`
- `[2026-03-13][Track E] F0-M started (Track B scope ✅ -> 🔄 Track E scope) - artifact usability validation began for stored run/trace outputs with explicit replay-smoke invariants - next: validate success and failure artifact pairs.`
- `[2026-03-13][Track E] F0-M completed (🔄 -> ✅) - Track E acceptance passed for run/trace artifact usability with validator module, script, and validation report - next: move to L1 baseline and smoke rubric layering.`

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
