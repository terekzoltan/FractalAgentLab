# Coding-Vertical-v01.md

## Purpose

This document defines the future **Software Delivery Loop** vertical for Fractal Agent Lab.

It exists to turn repo-aware software work into an inspectable workflow family instead of an opaque coding-agent blob.

This vertical belongs **inside** Fractal Agent Lab.
It is not a separate repo or separate engine at this stage.

---

## Positioning

The coding vertical should be framed as:

- better control over coding agents
- an auditable multi-agent delivery loop
- repo-aware planning + review + commit gate
- workflow governance for software delivery

Avoid framing it as:

- the ultimate autonomous coder
- a magic swarm
- a prompt app
- a replacement for the whole project identity

---

## Why it fits this repo

The current repo already optimizes for:

- inspectability
- replayability
- artifact-first thinking
- explicit orchestration
- evaluation as architecture
- dual-repo privacy boundaries

That makes software delivery a strong future vertical, because it is a real, hard domain that benefits from exactly those properties.

---

## Human workflow origin

This vertical should be understood as a formalization of the current human-driven workflow already used in this repo.

It grows from a real pattern:

- refresh repo context and active frontier
- determine what is actually ready next
- plan against current repo state and coordination docs
- implement against an accepted plan
- review findings first
- gate commit safety explicitly

Reference:
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`

---

## Workflow family

The vertical is split into two future workflow families.

### `H4` — Codebase Context & Planning

Purpose:
- turn human software-delivery intent + actual repo state into an explicit implementation plan

Expected outputs:
- normalized task brief
- affected surfaces
- likely touched files
- dependency notes
- risk register
- implementation plan
- acceptance checks

### `H5` — Implementation, Review & Commit Gate

Purpose:
- turn accepted plan + changed repo state into a disciplined review/gate process

Expected outputs:
- implementation report
- findings-first review
- test evidence
- residual risk summary
- plan-adherence note
- commit-gate decision

---

## Core design rules

### 1. Artifact-first

Every meaningful coding-vertical run should leave inspectable artifacts.

### 2. Repo-aware

Planning and review must be grounded in actual repository state, not only the user prompt.

### 3. Governance before autonomy

The vertical exists to improve controllability and truthfulness first.
High-autonomy behavior is a later earned option, not the starting point.

### 4. Private leverage stays private by default

The best heuristics, prompt variants, failure corpora, and benchmark gold sets should remain private unless there is a deliberate release reason.

### 5. No competing source of truth

This vertical must extend the existing repo contracts.
It must not create a rival canonical runtime or artifact regime.

---

## Integration boundaries

### Current execution model

Short- and medium-term, the coding vertical should be treated as **OpenCode-anchored**.

That means:

- OpenCode remains the main execution shell for repo access, file edits, search, git, test runs, and multi-session usage
- Fractal Agent Lab adds the workflow-intelligence layer on top of that shell
- `H4/H5` should improve the current workflow, not try to replace the execution environment immediately

This is the preferred current direction.

### Later optional evolution

A more hybrid model may be explored later.

In that model:

- OpenCode still remains in use
- but Fractal Agent Lab gradually adds small standardized wrappers for repeated repo operations
- those wrappers may later reduce dependence on raw tool calls without requiring a full custom IDE/runtime first

This is a later option, not the primary near-term target.

### What this vertical may do later

- add repo-aware planning workflows
- add findings-first review workflows
- add explicit commit-gate outputs
- add coding-specific eval and benchmark surfaces
- add targeted repo-tool wrappers

### What this vertical must not do early

- replace the main wave spine
- force a big runtime rewrite
- assume auto-commit authority by default
- turn prompt packs into the main source of truth
- publish the strongest private operating knowledge casually

---

## Relation to the main wave plan

The coding vertical is a **side vertical**.
It does not replace Wave 2 engine hardening or Wave 3 research-OS usefulness.

It also does not replace the current human-driven Meta/track loop.
Its first job is to formalize and gradually automate that loop.

Current intended unlock order:

1. Wave 1 core closeout is complete, so docs-only `CV0` is now allowed
2. keep `CV0` optional and non-blocking relative to the Wave 2 mainline
3. allow a thin `CV1` (`H4`) pilot only after Wave 2 run/trace/replay/smoke hardening is in place
4. allow a thin `CV2` (`H5`) review/gate slice only after `CV1` exists and evidence is good enough to support honest gating

---

## Ownership stance

### Meta Coordinator

Owns:
- positioning
- sequencing
- privacy boundary enforcement
- integration with `ops/` coordination docs

### Track C

Owns:
- H4/H5 role definitions
- seed prompts
- workflow-family behavior design

### Track D

Owns later:
- repo inspection wrappers
- test/format/commit tool boundaries

### Track E

Owns later:
- review-quality evals
- plan-adherence checks
- commit-readiness evaluation logic

### Track B

Owns only where needed:
- shared runtime/artifact contract changes
- canonical trace/run boundaries

---

## Canonical supporting docs

- `docs/Coding-Vertical-Adopt-Adapt-Defer-v01.md`
- `docs/private/Coding-Vertical-Human-Workflow-Mapping-v01.md`
- `docs/private/Coding-Vertical-H4-H5-Workflow-Family-v01.md`
- `docs/private/Coding-Vertical-Rollout-Plan-v01.md`
- `docs/private/Coding-Vertical-Artifact-Contract-v01.md`
- `docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `docs/private/Coding-Vertical-Learning-Loop-v01.md`

---

## Current stance summary

The Software Delivery Loop is now a serious future vertical for Fractal Agent Lab.

It is:
- strategically accepted
- docs-first
- governance-first
- private-leverage-aware

It is not:
- immediate top-of-queue runtime work
- a literal drop-in rewrite
- a reason to abandon the current Wave 1 closeout and Wave 2 hardening spine
