# Coding-Vertical-H4-H5-Workflow-Family-v01.md

## Purpose

This document sketches the future H4/H5 workflow families for the Software Delivery Loop.

It is intentionally design-first.
It does not imply that the runtime modules already exist.

---

## Family naming rule

Early coding-vertical implementation should follow the current repo's family-based style.

Prefer early shapes like:

- `src/fractal_agent_lab/agents/h4/`
- `src/fractal_agent_lab/agents/h5/`
- `src/fractal_agent_lab/workflows/h4.py`
- `src/fractal_agent_lab/workflows/h5.py`

Avoid over-fragmenting the first version into many micro-packages unless runtime reality later proves the split necessary.

---

## Human-workflow compatibility rule

The first H4/H5 versions should feel like the current human-driven workflow made more explicit and more inspectable.

They should preserve:

- current source-of-truth discipline
- current Combined-aware sequencing behavior
- current findings-first review expectations
- current willingness to block commit when the state is not safe

Reference:
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`

---

## `H4` — Codebase Context & Planning

### Purpose

Turn software-delivery intent + repo state into an execution-ready plan artifact.

`CV0-B` note:

- current Track C review scope is `H4` planning prompt/policy refinement
- `H5` gate-policy redesign remains out of scope for this step

`CV0-B` review outcome reference:

- `docs/private/Coding-Vertical-H4-Planning-Prompt-Review-v01.md`

### Recommended early roles

Recommended early modes:

- `wave_start` -> context refresh / frontier grounding
- `seq_next` -> readiness + detailed plan generation
- later `plan_review` -> plan critique / readiness critique / sequencing critique

Near-term execution model:

- `H4` is a planning companion for OpenCode sessions
- it should improve the current human loop, not replace the main shell or repo operator
- it should produce packet-friendly planning outputs before any broader dispatch/session-bus ambition

#### `repo_intake`

Owns:
- repo state inspection
- relevant doc references
- affected-surface map
- likely touched-file hypotheses
- unknowns and assumptions

Must not:
- pretend execution certainty
- silently invent implementation decisions before repo intake is complete

#### `planner`

Owns:
- step ordering
- dependency map
- test intent
- documentation obligations
- plan structure

Must not:
- handwave shared-zone risk
- omit verification expectations

#### `architect_critic`

Owns:
- contract-drift warnings
- merge-risk warnings
- hidden complexity notes
- architecture-boundary critique

Must not:
- rewrite the whole plan into a different project

#### `synthesizer`

Owns:
- final plan normalization
- artifact formatting
- acceptance-check finalization

Must not:
- hide unresolved uncertainty to make the plan look cleaner

### Recommended role-to-artifact mapping (`H4`)

- `repo_intake` -> `context_report.json`
- `planner` -> `implementation_plan.md`
- `architect_critic` -> `risk_register.json`
- `synthesizer` -> `acceptance_checks.json` and final plan normalization

Early pilot note:

- first executable `CV1` may keep `risk_register` embedded as a section inside `implementation_plan.md`
- the minimum useful early artifact set is therefore:
  - `context_report.json`
  - `implementation_plan.md`
  - `acceptance_checks.json`

Reference contract:
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`

Operator-transport note:

- these artifacts may later be rendered into packet-friendly forms for OpenCode session transport
- that rendering does not make the transport packet itself canonical artifact truth

### Early orchestration recommendation

Start simple:

1. `WAVE START` + `SEQ NEXT` first
2. narrow 2/3-stage manager path first
3. optional single-agent baseline for comparison
4. only later add richer handoff/parallel behavior if evidence says it helps

Automation stance:

- `WAVE START` should stay partially automated because manual judgment still matters for drift/context recovery
- `SEQ NEXT` can be much more strongly automated as a planning/readiness companion
- `plan_review` should remain H4-adjacent and findings-first, not become implementation review or code review

Helper-layer note:

- any early `CV1-C` helper layer should stay very thin
- good examples:
  - repo snapshot helper
  - changed-surface helper
  - touched-files / touched-zones helper
  - artifact-writing helper
-  packet-rendering helper
-  queue/inbox/outbox helper only if it stays local and narrow
- avoid broad repo tool platformization or shell replacement

Coordination-layer note:

- early H4 should align with a coordination-layer / packet-compiler direction
- guarded dispatch and richer session transport belong later, not in the first thin slice

Boundary reminder:

- orchestration authority belongs to workflow/control semantics
- do not encode manager authority through pack-level handoff topology shortcuts

---

## `H5` — Implementation, Review & Commit Gate

`CV0-B` scope reminder:

- this section is retained as family context
- detailed review/gate policy remains canonical in `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `CV0-C` performs docs-only policy review and alignment; it does not imply executable `CV2` gate behavior

`CV0-C` review outcome reference:

- `docs/private/Coding-Vertical-H5-Review-Gate-Policy-Review-v01.md`

### Purpose

Turn implementation reality into an honest review and commit-readiness decision.

Near-term boundary:

- actual implementation remains primarily OpenCode-session work
- early executable `CV2` should review and evaluate implementation reality, not replace the implementer
- early executable `CV2` may emit packet-friendly review/gate outputs, but should not imply autonomous action from that alone

### Recommended early roles

#### `implementer`

Owns:
- execution against plan
- touched-file reporting
- deviation notes
- implementation report drafting

Must not:
- self-certify quality as if review already happened

Executable-scope note:

- keep `implementer` as family context for now
- do not make it part of the first thin executable `CV2` slice

#### `reviewer`

Owns:
- bugs
- regressions
- contract mismatches
- testing gaps
- findings-first review output

Must not:
- hide issues behind summary language
- collapse review into implementation self-justification

#### `evaluator`

Owns:
- plan adherence
- artifact completeness
- evidence sufficiency
- residual risk summary

Must not:
- confuse style preference with acceptance evidence

#### `commit_gate`

Owns:
- `pass` / `pass_with_warnings` / `hold`
- blocker list
- warnings list
- required-actions list

Must not:
- blur the decision into vague confidence language

Authority note:

- early `commit_gate` output should remain advisory only
- do not imply autonomous commit authority by default
- packetization or command-friendly rendering does not change this authority boundary

### Early orchestration recommendation

Start with explicit separation:

1. findings-first review
2. evaluator check
3. optional advisory gate output only after evidence is strong enough

Do not collapse these into one opaque role early.

Early evidence note:

- the first executable slice may keep test evidence embedded inside review/evaluator artifacts
- a separate `test_evidence.json` should remain optional until there is evidence that the extra artifact is worth the overhead

---

## Family-level non-goals

Early H4/H5 should not attempt:

- full autonomous PR handling
- default background coding swarms
- broad codebase-wide tool platformization
- enterprise permissions/governance infrastructure
- workbench-first expansion before packet transport pain is reduced

---

## Relationship to other coding-vertical docs

- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `docs/private/Coordination-Layer-Packet-Bus-v01.md`
