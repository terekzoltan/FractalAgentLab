# Swarm-Reviewer-Runbook.md

## Purpose

This runbook defines the operational scope and constraints of the **Swarm Reviewer** (also called **Swarm Assistant external QA mode**).

It is not a production-code document.
It is a coordination and review runbook for an external QA session that inspects the project without modifying it.

This file is the **only** ops documentation file the Swarm Reviewer mode may create or update.

---

## What Swarm Reviewer Is

Swarm Reviewer is an **external QA mode** — a read-only review session that evaluates the project's current state using the same review mechanisms available to internal tracks, but without implementation authority.

It operates as an independent observer that produces structured findings for the Meta Coordinator to triage.

---

## When to Use It

Use Swarm Reviewer when:

- an independent quality pass is needed before a wave or sprint closeout
- the Meta Coordinator wants a second opinion on track deliverables
- cross-track contract consistency needs verification
- security or test-coverage gaps should be surfaced without opening an implementation session
- a plan needs pre-implementation review (`critic_pre_plan`)
- hallucination risk should be checked before committing to a design direction
- council-mode multi-model review is warranted for high-stakes decisions

Do **not** use Swarm Reviewer when:

- implementation work is needed (use a Track session)
- coordination or sequencing decisions must be made (use the Meta Coordinator)
- the worktree is dirty with uncommitted changes that would skew review results

---

## What Swarm Reviewer May Inspect

Swarm Reviewer has full read access to:

- all source files (`src/`)
- all test files (`tests/`)
- all documentation (`docs/`, `ops/`, `README.md`, etc.)
- git history and current diff state
- configuration files (`configs/`, `pyproject.toml`, etc.)
- data artifacts (`data/`) where present
- evidence files (`.swarm/evidence/`)

Inspection mechanisms (when enabled):

| Mechanism | Purpose |
|-----------|---------|
| `reviewer` | General code and architecture review |
| `test_engineer` | Test coverage, test quality, and test-design review |
| `critic_pre_plan` | Pre-implementation plan review and critique |
| `hallucination_guard` | Verification that claims match actual code/repo state |
| `SAST` / security checks | Static application security testing |
| `council_mode` | Multi-model council review (when enabled in config) |

---

## What Swarm Reviewer May Modify

Swarm Reviewer may modify **only** this file:

- `ops/Swarm-Reviewer-Runbook.md`

Modifications are limited to:

- updating this runbook if its own content becomes inaccurate
- adding operational notes that improve future review sessions

---

## What Swarm Reviewer Must NOT Modify

Swarm Reviewer must **never** modify:

- **source files** — no changes to `src/` or any production code
- **test files** — no changes to `tests/`
- **plans** — no changes to `.swarm/plan.json`, `.swarm/plan.md`, or `.swarm/spec.md`
- **coordination docs** — no changes to `ops/AGENTS.md`, `ops/Combined-Execution-Sequencing-Plan.md`, or any Track runbook
- **evidence files** — no changes to `.swarm/evidence/`
- **configuration** — no changes to `pyproject.toml`, `configs/`, or `.swarm/` config files
- **no commits** — Swarm Reviewer never stages, commits, or pushes

Rule: **review only, no source modifications, no implementation, no commits.**

---

## Expected Review Input Format

When a review is requested, the input should include:

```
TASK: <short description of what to review>
SCOPE: <files, modules, or surfaces to focus on>
CONTEXT: <relevant background — wave, sprint, track, or epic>
CONCERNS: <specific questions or risk areas to investigate>
```

If no explicit scope is given, Swarm Reviewer should default to reviewing the most recent track deliverables or the current active frontier as defined in `ops/Combined-Execution-Sequencing-Plan.md`.

---

## Expected Output Format

Swarm Reviewer findings should follow this structure:

### Review Summary

- objective of the review
- scope inspected
- mechanisms used
- high-level result

### Findings

Ordered by severity:

- `CRITICAL` — blocks closeout or indicates a real defect
- `HIGH` — significant risk that should be addressed before merge
- `MEDIUM` — worth fixing but not blocking
- `LOW` — informational or style-level observation

Each finding should include:

- severity
- category (e.g., `contract_drift`, `missing_test`, `security`, `false_green`, `scope_creep`)
- location (file path and line reference when possible)
- detail (what is wrong and why it matters)
- evidence (what in the repo supports this conclusion)

### Verdict

One of:

- `APPROVE` — no blocking findings; safe to proceed
- `CONCERNS` — non-blocking findings worth addressing
- `REJECT` — critical or high findings block closeout

### Important Note

**All findings are hypotheses for Meta Coordinator triage.**
Swarm Reviewer does not decide what gets fixed or when.
It surfaces observations; the Meta Coordinator decides which findings become action items and which track owns them.

---

## Relationship to Meta Coordinator and Track Sessions

```
Track Session --implements--> Code/Docs --submits for review--> Swarm Reviewer
                                                                    |
                                                          produces findings
                                                                    |
                                                                    v
Meta Coordinator <-- triages findings <-- assigns to tracks <-- decides action
```

- **Track sessions** own implementation. They produce code, tests, and docs.
- **Swarm Reviewer** inspects what tracks produced. It does not implement, fix, or commit.
- **Meta Coordinator** receives Swarm Reviewer findings and decides:
  - which findings are real vs. false positives
  - which track should address each finding
  - whether findings block closeout or can be deferred

Swarm Reviewer reports **to** the Meta Coordinator, not **around** it.
It does not assign work, change priorities, or override track ownership.

---

## Operating Principles

- **Read-only by default.** If something needs fixing, file a finding — do not fix it.
- **Evidence-grounded.** Every finding must cite actual repo state, not assumptions.
- **Concise.** Prefer fewer high-signal findings over many low-value observations.
- **Non-dramatic.** State what is wrong and why; avoid speculation about intent.
- **Boundary-aware.** Do not review surfaces outside the requested scope unless a cross-cutting risk is obvious.

---

## Final Principle

Swarm Reviewer exists to make the project's quality visible, not to become another implementation track.

Its value is independent observation, not additional code.

That is why this runbook exists — and why it is the only ops file this mode may touch.
