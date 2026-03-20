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

### Recommended early roles

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

### Early orchestration recommendation

Start simple:

1. single-agent baseline or narrow manager path
2. only later add richer handoff/parallel behavior if evidence says it helps

---

## `H5` — Implementation, Review & Commit Gate

### Purpose

Turn implementation reality into an honest review and commit-readiness decision.

### Recommended early roles

#### `implementer`

Owns:
- execution against plan
- touched-file reporting
- deviation notes
- implementation report drafting

Must not:
- self-certify quality as if review already happened

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

### Early orchestration recommendation

Start with explicit separation:

1. implementation report
2. findings-first review
3. evaluator check
4. gate decision

Do not collapse these into one opaque role early.

---

## Family-level non-goals

Early H4/H5 should not attempt:

- full autonomous PR handling
- default background coding swarms
- broad codebase-wide tool platformization
- enterprise permissions/governance infrastructure

---

## Relationship to other coding-vertical docs

- `docs/private/Coding-Vertical-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
