# Emergent-Identity-Layer-v01.md

## Purpose

This document defines a **grounded, implementation-oriented v0.1 design** for an **Emergent Identity Layer** inside the Fractal Agent Lab project.

The key idea is:

> agents should not be modeled only as static roles,
> but as evolving identity fields shaped by execution history, memory, interaction, and feedback.

However, in this project, that idea must be translated into **engineering primitives**, not poetic abstractions.

So in this document:
- identity is treated as a **measurable adaptive subsystem**
- the first implementation target is a **small, low-churn MVP**
- the design is aligned to the repo’s **actual current state**, not an imagined future platform

---

## Why this is a good fit for the current project

After reading the current repo state, the idea fits unusually well for five reasons.

### 1. The project already distinguishes stable role contracts from dynamic execution

Right now the codebase already separates:
- `AgentSpec`
- `WorkflowSpec`
- `RunState`
- `TraceEvent`
- runtime execution (`WorkflowExecutor`)
- state and tracing stores

That means static role description and dynamic runtime behavior are **already separated structurally**.
This is exactly the condition needed for an emergent identity layer.

### 2. The current runtime is intentionally minimal and extensible

The current `WorkflowExecutor` is a simple but clean shell:
- creates `RunState`
- emits lifecycle `TraceEvent`s
- delegates actual execution through `StepRunner`
- stores step results
- enforces timeout/retry/budget placeholders

That means identity can be added **around** the runtime before it needs to be deeply added **inside** the runtime.
That is ideal for a safe MVP.

### 3. The current contracts already provide low-churn extension points

The current repo has several flexible places that can carry identity-related state **without changing canonical Track B schemas immediately**:

- `AgentSpec.metadata`
- `WorkflowSpec.metadata`
- `RunState.context`
- `TraceEvent.payload`
- JSON / SQLite runtime data outside core schemas

This is a major engineering advantage.
It means identity can be introduced experimentally without destabilizing Wave 0 foundations.

### 4. The project philosophy already values trace, eval, memory, and role separation

The current docs repeatedly emphasize:
- inspectability
- replay
- baseline comparison
- memory as an explicit subsystem
- role separation across tracks and agents

An emergent identity layer fits those goals directly.
It is not random feature creep.
It naturally extends:
- Track C memory semantics
- Track E evaluation
- Track B state/tracing discipline

### 5. It creates a real differentiator without demanding immediate platform inflation

Many agent systems have:
- orchestration
- memory
- routing
- tool usage

Fewer systems meaningfully model:
- adaptive identity
- behavioral drift
- inter-agent reputation
- team-level character aggregation

This gives Fractal Agent Lab a potentially distinctive direction, but only if implemented in a controlled way.

---

## Important framing: what this is, and what it is not

### This is
- an **adaptive identity subsystem**
- an **execution-informed behavior profile**
- a possible future **routing input**
- a future **evaluation and drift-monitoring axis**
- a good bridge between systems thinking and concrete engineering

### This is not
- “building consciousness”
- free-form simulated personalities
- a license to make prompts mystical
- a reason to destabilize core runtime contracts too early
- a replacement for role definitions

The project should describe this internally and externally as:

> **adaptive identity layer for multi-agent coordination**

Optional internal nickname:
- `soulprint`

But that nickname should not be the primary engineering surface.

---

## Design stance

### Core thesis

A role is static.
An identity is dynamic.

In Fractal Agent Lab terms:
- `AgentSpec` should continue to define the **static role contract**
- the Emergent Identity Layer should define the **dynamic behavior profile**

That means:
- **role** = what the agent is supposed to be
- **identity** = how the agent is actually behaving over time

This distinction is clean, useful, and measurable.

---

## Non-goals for v0.1

To keep this grounded, the following are explicitly out of scope for the first implementation wave.

### Not in MVP
- full social simulation
- free-form agent personality writing
- identity-driven natural language style generation as the main feature
- strong autonomous policy mutation
- identity changes that rewrite core prompts automatically
- full multi-level team/system character aggregation as executable code
- reputation-driven routing before baseline workflow quality exists

### Allowed in docs but deferred in code
- self identity
- social identity
- team identity
- system identity
- agent-tool coupling style
- drift monitor

The design can describe these, but the first implementation should be much smaller.

---

## Current repo-state constraints that shape the design

This section is important because the identity layer should fit the repo as it actually exists today.

### Constraint 1 — `AgentSpec` is minimal and should remain minimal for now

Current `AgentSpec` includes:
- `agent_id`
- `role`
- `kind`
- instruction references
- model policy references
- allowed tools
- handoff targets
- metadata

This is good.
The identity layer should **not** immediately force Track B to expand this schema.

**Recommendation:**
Use `metadata` for identity policy references in early versions.

Example:
```python
metadata={
  "identity_policy_ref": "identity.default.v1",
  "identity_profile_ref": "agent://planner/default"
}
```

### Constraint 2 — `RunState` already has a flexible `context`

Current `RunState` includes:
- `context: dict[str, Any]`
- `step_results`
- `errors`
- `trace_event_ids`

This is exactly the right place for early per-run identity working state.

**Recommendation:**
Store per-run loaded identity snapshots and temporary identity signals inside `RunState.context` in early versions.

Example:
```python
run_state.context["identity"] = {
  "loaded_profiles": {...},
  "step_signals": [...],
  "update_candidates": [...]
}
```

### Constraint 3 — `TraceEvent.payload` is permissive

This is a huge advantage.
The current event schema is strict enough to be useful, but flexible enough to carry structured payloads.

**Recommendation:**
Do not add new canonical `TraceEventType`s for identity in the first MVP.
Instead, place identity-relevant structured payloads under existing event flows or emit external artifacts after the run.

This avoids premature schema churn in Track B.

### Constraint 4 — runtime execution is still early and not yet socially rich

The current runtime:
- runs steps in order
- does not yet implement real manager intelligence, handoff logic, or parallel orchestration
- does not yet store durable memory or replay artifacts deeply

That means the first identity layer should be **observational and adaptive**, not fully social.

So:
- self-profile first
- post-run update first
- routing use only after H1 baseline exists
- reputation graph later

### Constraint 5 — memory and eval tracks are still mostly pending

Because Track C and E are still early, identity must not assume:
- durable memory framework already exists
- replay is already hardened
- evaluator agents already exist

So the MVP should create a **thin identity subsystem** that can later connect to memory/eval, not depend on them immediately.

---

## Proposed terminology

Use these terms consistently.

### 1. Identity Profile
The main evolving representation of an agent’s behavioral tendencies.

Canonical engineering term.

### 2. Identity Vector
The numeric or semi-numeric state inside the profile.

### 3. Identity Snapshot
A stored view of a profile at a point in time.

### 4. Identity Update
A post-run or post-step transformation of the profile.

### 5. Identity Drift
Meaningful change in the profile over time.

### 6. Reputation Edge
One agent’s assessment of another.
Deferred beyond MVP.

### 7. Team Identity
Aggregated identity of a workflow squad or team.
Deferred beyond MVP.

### 8. Soulprint
Optional internal nickname for the identity profile concept.
Do not make this the public API name in v0.

---

## Recommended architectural placement

### New package

Add a dedicated package:

```text
src/fractal_agent_lab/identity/
```

Recommended early shape:

```text
src/fractal_agent_lab/identity/
  __init__.py
  models/
    __init__.py
    identity_profile.py
    identity_snapshot.py
  updater/
    __init__.py
    identity_update.py
    signal_rules.py
  store/
    __init__.py
    json_store.py
  routing/
    __init__.py
    identity_routing_hints.py
  drift/
    __init__.py
    drift_monitor.py
```

### Ownership
Primary owner:
- Track C

Shared dependencies:
- Track B for runtime/state/tracing boundaries
- Track E for drift/eval later

Why Track C primary?
Because the identity layer is mostly about:
- behavioral semantics
- adaptive role expression
- memory-to-character effects
- routing meaning

not raw execution primitives.

---

## MVP design principle

### The first version should be observational first, adaptive second, routing-aware third

That means:

#### Phase I — Observational
- store identity profile
- collect signals from runs
- update profile after runs
- surface profile in reports

#### Phase II — Adaptive
- use profile to adjust internal routing hints or strategy selection
- maybe choose among agent variants

#### Phase III — Social
- reputation graph
- team identity
- drift policies across groups

This phased approach matches the repo’s actual maturity.

---

## Proposed v0.1 Identity Profile

Keep the first profile deliberately small.

### Recommended initial dimensions

Use 5 dimensions first:

1. `caution`
2. `initiative`
3. `delegation`
4. `coherence`
5. `reflectiveness`

Optional later additions:
- `creativity`
- `conflict_tolerance`
- `latency_sensitivity`
- `tool_affinity`

### Why these 5 first

They map well onto the current project goals:
- caution ↔ avoids reckless output
- initiative ↔ avoids analysis paralysis
- delegation ↔ useful for multi-agent orchestration later
- coherence ↔ directly relevant to idea refinement and review quality
- reflectiveness ↔ useful for critique, revision, and self-correction

They are also understandable to humans reading traces and reports.

### Suggested data model

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass(slots=True)
class IdentityProfile:
    agent_id: str
    version: int = 1
    caution: float = 0.5
    initiative: float = 0.5
    delegation: float = 0.5
    coherence: float = 0.5
    reflectiveness: float = 0.5
    update_count: int = 0
    last_updated_at: datetime | None = None
    last_run_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
```

Range recommendation:
- normalized float `[0.0, 1.0]`

Keep it simple.
Do not over-model initially.

---

## Identity signals: what should cause updates?

Identity should not update from everything.
Only from meaningful signals.

### Good update sources in the current repo shape

Given the current implementation state, these are realistic early signal sources:

1. step success / failure
2. retry count
3. timeout or budget failure
4. contradiction or coherence flags produced by Track C logic
5. explicit “delegated / not delegated” metadata from workflow logic
6. evaluator or rubric scores later from Track E
7. human override markers later

### Important early constraint

The current runtime does **not** yet provide semantic judgment by default.
So the first signal system must be able to work with small, explicit metadata coming from:
- step outputs
- workflow wrappers
- post-run analysis

Not from magical inference.

---

## Suggested signal carrier strategy

Use a small structured convention in step outputs or run context.

### Example step output convention

A step result may optionally include:

```python
{
  "content": "...",
  "identity_signals": {
    "coherence_score": 0.82,
    "needed_revision": False,
    "delegated": False,
    "self_correction_used": True,
    "confidence": 0.71
  }
}
```

### Why this is good
- no core schema churn required immediately
- Track C can start emitting these conventions
- Track B does not need to redesign `RunState`
- Track E can later evaluate these conventions

---

## Recommended update logic

Use small, bounded updates.

### Guiding rule

No large swings from a single run.
Identity should drift gradually.

### Suggested update rule style

For each signal:
- compute a small delta
- clamp final values to `[0.0, 1.0]`
- optionally decay toward center when evidence is weak

### Example heuristics

#### If repeated errors happen during fast execution
- `caution += small amount`
- `initiative -= tiny amount`

#### If the agent produces coherent output with low retry burden
- `coherence += small amount`

#### If the workflow notes that the agent correctly routed work away from itself
- `delegation += small amount`

#### If the agent repeatedly needs revision but eventually self-corrects
- `reflectiveness += small amount`

#### If the agent blocks progress by overthinking or repeated non-answers
- `initiative += tiny corrective pressure` or
- cap `caution` growth

### Very important

The system should not assume that “more caution” is always better.
Identity is not a moral score.
It is a behavior profile.

---

## Drift concept

Identity becomes useful when it changes.
It becomes engineering-relevant when that change can be monitored.

### Drift definition

Identity drift = meaningful difference between the current profile and:
- its initial baseline
- its recent rolling baseline
- its declared role expectation

### Recommended early drift categories

1. `stable`
2. `healthy_drift`
3. `concerning_drift`
4. `role_misalignment`

### Examples

#### Healthy drift
A planner becomes slightly more cautious after repeated weak planning outcomes.

#### Concerning drift
A reviewer becomes so cautious that it slows workflows heavily without quality gain.

#### Role misalignment
A coordinator becomes too centralizing and stops delegating at all.

### MVP recommendation

Do not implement full drift monitor logic first.
Implement:
- snapshot comparison
- magnitude threshold
- simple warning classification

---

## Reputation graph: when and why

The reputation graph is powerful, but it should not be MVP.

### Why it is valuable later

It lets the system represent statements like:
- “reviewer trusts strategist on product tradeoffs”
- “coordinator sees executor as fast but noisy”
- “critic sees planner as coherent but under-delegating”

That creates a relational identity layer.

### Why it should wait

The current runtime does not yet have:
- strong inter-agent commentary patterns
- explicit peer scoring
- mature replay/eval hooks

So the first implementation should defer reputation.

### Recommendation

Include reputation in the design doc, but phase it after:
- H1 baseline
- first replay path
- first stable agent pack

---

## Fractal identity levels

This idea is one of the strongest conceptual parts of the project, but it should be phased.

### Level 1 — Agent identity
Required first.

### Level 2 — Team identity
Aggregate across agents in a workflow.

Example:
- H1 squad becomes too conservative
- architecture review squad becomes highly reflective but slow

### Level 3 — System identity
Aggregate across all workflows and teams.

Example:
- the lab as a whole trends toward coherence over exploration

### Recommendation

Only Level 1 should be implemented first.
Levels 2 and 3 can be documented as later extensions.

---

## Tool coupling style

The “sword soul” analogy translates well into engineering as tool coupling style.

This means:
- some agents become strong with search
- some with code tools
- some with memory retrieval

But this is still too early for the MVP because:
- tool layer is not mature yet
- adapter layer is still forming

### Recommendation

Do not build tool coupling into the first identity model.
Reserve a future extension field:

```python
metadata={
  "tool_affinities": {
    "search": 0.61,
    "memory": 0.42
  }
}
```

---

## Concrete MVP proposal

### MVP name
`Emergent Identity Layer (observational MVP)`

### MVP goal

After a workflow run, each agent involved should have:
- an identity profile
- a small updated vector
- a stored snapshot
- a visible change record

### MVP scope

#### Included
- identity profile store
- profile load at run start
- signal collection during or after run
- post-run profile update
- updated snapshot persistence
- profile visibility in reports or traces

#### Excluded
- reputation graph
- team/system aggregation
- automatic prompt rewriting
- identity-driven free-form conversation style
- heavy runtime refactor

---

## Integration strategy with the current codebase

This section is the most important practically.

### Rule: do not destabilize Track B foundations for this feature

The current runtime base is valuable because it is small and explicit.
The identity layer should attach to it in the least invasive way first.

### Recommended v0 integration method

#### 1. Keep core contracts unchanged initially
Do not immediately modify:
- `RunState`
- `TraceEventType`
- `WorkflowSpec`
- `AgentSpec` fields

Use their existing flexible fields instead.

#### 2. Add a new package under `src/fractal_agent_lab/identity/`
This isolates the feature and makes track ownership clearer.

#### 3. Add an external identity store
Use JSON first, SQLite later if needed.

Recommended early path:
```text
data/identity/
  planner.json
  critic.json
  synthesizer.json
```

#### 4. Load identity into `RunState.context` at run start
Example:
```python
run_state.context["identity"] = {
  "profiles": {"planner": {...}},
  "update_candidates": []
}
```

#### 5. Collect signals from step outputs or post-run analysis
Prefer low-churn wrappers around workflow execution rather than modifying core executor logic too early.

#### 6. Update identity after the run completes
A post-run service can:
- inspect `run_state`
- inspect emitted `TraceEvent`s
- inspect workflow outputs
- compute deltas
- persist updated profiles

This keeps the first implementation decoupled from executor internals.

---

## Concrete integration with existing files and docs

The user explicitly asked for guidance so that sessions understand the plan.
This is the recommended integration plan.

### 1. New document
Create:
- `docs/Emergent-Identity-Layer-v01.md`  ← this document

This becomes the canonical design reference.

### 2. Update `ops/AGENTS.md`
Recommended additions:

#### Track C section
Add to early deliverables:
- identity profile definitions
- identity signal conventions
- post-run update rules

Add to DoD guidance:
- identity behavior must be explicit and versionable

#### Track E section
Add:
- identity drift smoke checks
- profile change sanity checks

#### Risks section
Add a new risk:
- identity over-philosophizing / ungrounded drift semantics

#### Suggested future sessions
Add:
- `Identity Layer Lab`

### 3. Update `ops/Combined-Execution-Sequencing-Plan.md`
Recommended placement:

#### Wave 1
Optional design/prep only:
- define identity profile schema
- define signal carrier convention

#### Wave 2
First implementation target:
- observational identity MVP
- snapshot persistence
- drift visibility

This fits especially well under:
- `W2-S3 — Early memory and role separation hardening`

### 4. Update `ops/Meta-Coordinator-Runbook.md`
Recommended addition:

Under specialized sessions or future sessions:
- `Identity Layer Lab`

Use when:
- role/identity drift becomes unclear
- routing policy may start depending on identity
- reputation or aggregation is proposed

### 5. Update `docs/Repo-Skeleton-v01.md`
Add:
- `src/fractal_agent_lab/identity/`

Primary owner:
- Track C

Shared dependencies:
- B, E

### 6. Config integration
Recommended later additions:

`configs/runtime.example.yaml`
```yaml
identity:
  enabled: false
  store_backend: json
  data_subdir: identity
```

`configs/model_policy.example.yaml`
Possible later addition:
```yaml
identity_policy_refs: {}
```

### 7. Examples integration
Add later:
- `examples/identity/sample_profile.json`
- `examples/identity/sample_update_input.json`

### 8. Tests integration
Add later:
- `tests/identity/test_identity_update.py`
- `tests/identity/test_drift_monitor.py`

---

## Recommended implementation path by track

### Track B
Should do:
- avoid unnecessary schema churn
- expose stable trace/run/state boundaries
- optionally allow post-run hook attachment later

Should not do initially:
- own identity semantics
- expand core event enums just for identity MVP

### Track C
Primary implementation owner.

Should do:
- define `IdentityProfile`
- define signal convention
- implement update rules
- implement identity store
- implement post-run updater

### Track D
Should support only as needed.

Possible support:
- adapter outputs can optionally emit signal-friendly metadata later

But Track D should not be blocked on identity first.

### Track E
Should prepare:
- sanity checks for update stability
- regression checks for profile drift
- baseline comparison later

### Track A
Later can visualize:
- per-agent identity snapshot
- identity delta after a run
- simple drift flags in trace viewer

---

## Recommended code-level file plan

### Minimal first file set

```text
src/fractal_agent_lab/identity/
  __init__.py
  models/
    __init__.py
    identity_profile.py
  updater/
    __init__.py
    signal_rules.py
    identity_update.py
  store/
    __init__.py
    json_store.py
  drift/
    __init__.py
    drift_monitor.py
```

### Very early optional helper files

```text
src/fractal_agent_lab/identity/routing/
  __init__.py
  identity_routing_hints.py
```

---

## Suggested first executable flow

### Workflow: H1-lite observational identity pass

Use the first real hero workflow once Track C + D can execute a minimal agent pack.

#### Flow
1. load identity profiles for agents used in the workflow
2. inject loaded snapshots into `RunState.context`
3. run the workflow normally
4. inspect `run_state.step_results`
5. extract identity signals
6. compute profile deltas
7. persist updated profiles
8. produce identity change summary

#### Output example
```python
{
  "identity_updates": {
    "planner": {
      "before": {...},
      "after": {...},
      "delta": {"caution": 0.03, "coherence": 0.02}
    }
  }
}
```

This is enough to demonstrate the concept without requiring full adaptive routing yet.

---

## Example update pipeline

### Step 1 — Load
`IdentityStore.load(agent_id)`

### Step 2 — Attach
Put loaded snapshot in run context.

### Step 3 — Run
Normal runtime execution.

### Step 4 — Extract signals
Use a small extractor over:
- step results
- trace payloads
- errors
- retries

### Step 5 — Update profile
`IdentityUpdater.apply(profile, signals)`

### Step 6 — Persist snapshot
`IdentityStore.save(profile)`

### Step 7 — Emit summary artifact
Store a small run-level identity delta report.

---

## Recommended storage plan

### v0.1
Use JSON files.

Why:
- simple
- inspectable
- no Track B churn
- easy for opencode sessions to reason about
- easy to diff conceptually

### v0.2+
Optional SQLite index.

Use SQLite later for:
- snapshot history queries
- drift history
- filtering by workflow and agent

### Recommended policy
- JSON as source artifact first
- SQLite as index later, not immediately required

---

## Routing integration: when it becomes real

The identity layer becomes more than observability when it influences decisions.
But that should happen after baseline quality exists.

### Recommended routing sequence

#### Stage R0 — No routing use
Profile only observed and updated.

#### Stage R1 — Advisory routing
Coordinator or manager can read profile and produce hints.

Examples:
- use the more coherent reviewer
- prefer higher initiative for exploratory prototype path

#### Stage R2 — Soft routing policy
Workflow builder uses profile ranges as one input into agent selection.

#### Stage R3 — Strong routing policy
Identity materially changes execution paths.

Not recommended until replay/eval is stronger.

---

## Drift monitor: practical MVP

The drift monitor should begin very small.

### Input
- previous snapshot
- current snapshot
- optional role expectation range

### Output
- drift magnitude
- category
- short explanation

### Example
```python
{
  "agent_id": "planner",
  "drift_score": 0.12,
  "classification": "healthy_drift",
  "notes": [
    "caution increased after repeated revision-heavy runs",
    "coherence also improved, so drift is not currently concerning"
  ]
}
```

### Why this matters
This is the point where the identity layer becomes engineering and not just flavor.

---

## Risks and anti-patterns

### R1 — Over-philosophizing too early
Risk:
The feature becomes a worldview instead of a subsystem.

Mitigation:
Keep v0.1 tied to measurable fields and post-run updates.

### R2 — Core schema churn too early
Risk:
Track B gets destabilized for a still-experimental feature.

Mitigation:
Use `metadata`, `context`, and external stores first.

### R3 — Identity pretending to be quality
Risk:
People assume a changed profile means improved output.

Mitigation:
Require Track E baseline/eval comparison before strong claims.

### R4 — Identity vector bloat
Risk:
Too many dimensions too early.

Mitigation:
Start with 5 fields only.

### R5 — Hidden prompt mutation
Risk:
The system silently changes behavior in ways that are hard to reason about.

Mitigation:
Do not auto-rewrite prompts in v0.1.
Keep updates explicit and inspectable.

---

## Success criteria for the first identity milestone

The first identity milestone should count as successful if:

1. at least one real workflow run produces identity update output
2. the profile model is understandable to humans
3. updates are small and explainable
4. no core Track B schema had to be destabilized
5. the feature generates useful debugging or routing insight
6. the identity layer is clearly separated from role definition

---

## Recommended near-term sequence

### Now
- keep this as a design document only

### Next practical doc updates
1. update `ops/AGENTS.md`
2. update `ops/Combined-Execution-Sequencing-Plan.md`
3. update `docs/Repo-Skeleton-v01.md`

### First implementation moment
After:
- first minimal Track C agent pack exists
- first Track D adapter path exists
- first H1-lite run is real

### Best first implementation target
Wave 2, especially around:
- memory hardening
- role separation hardening
- replay visibility

Optional observational prep can start late Wave 1.

---

## Final recommendation

This idea is strong.
It is unusually aligned with the Fractal Agent Lab concept.
But its strength depends entirely on discipline.

The right way to build it is:

> not as metaphysical flavor,
> but as a small, measurable, adaptive identity subsystem.

That is the version that can later become:
- a real research angle
- a real product differentiator
- and a genuinely “fractal” mechanism across agent, team, and system levels

without destabilizing the current project.

