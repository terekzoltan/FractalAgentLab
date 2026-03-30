# Wave1-W1-S2-Stabilization-Plan.md

## Purpose

This document records the post-review stabilization plan for Wave 1 Sprint `W1-S2`.

`L1-F` through `L1-I` are implemented, but review found a small set of issues that should be corrected before treating the sprint as fully hardened.

This is a **stabilization mini-batch**, not a new feature sprint.

---

## Why this plan exists

The W1-S2 review found four meaningful concerns:

1. unsupported execution modes (`parallel`, `graph`) silently degrade to `linear`
2. smoke comparison success criteria can false-pass incomplete comparable outputs
3. core workflow contracts still allow duplicate `step_id` collisions
4. CLI summary / JSON trace output under-represent handoff and baseline visibility

These issues are small enough to fix quickly, but important enough that they should not be dragged into `L1-J` / `L1-K` / `L1-L` without an explicit stabilization pass.

---

## Scope

In scope:

- W1-S2 post-review stabilization
- runtime/contract correctness fixes
- eval smoke correctness hardening
- CLI / trace summary consistency fixes
- missing tests for new invariants

Out of scope:

- new orchestration features
- winner selection or decision logging (`L1-L`)
- benchmark expansion
- provider/runtime expansion beyond current Wave 1 scope

---

## Canonical findings this plan addresses

### F1 — Unsupported execution-mode fallback
- `parallel` / `graph` currently run as `linear` instead of failing explicitly

### F2 — Smoke comparison false-green path
- comparison success currently checks only envelope presence, not complete comparable-key population

### F3 — Workflow structural invariant gap
- duplicate `step_id` values are still accepted and can silently clobber prior step results

### F4 — CLI visibility inconsistency
- handoff/single variants do not receive workflow/final-output summary parity
- JSON trace output omits `parent_event_id` / `correlation_id`

---

## Ownership and execution policy

This stabilization batch is intentionally split by ownership boundary.

- **Track B** owns runtime truth and shared workflow contract invariants
- **Track E** owns comparison/eval correctness
- **Track A** owns CLI summary and trace-view-facing output fidelity
- **Meta Coordinator** closes the stabilization batch and restores the normal frontier

Rule:
- do not fix eval success semantics before Track B clarifies unsupported-mode and workflow-contract truth
- do not widen CLI visibility rules until the underlying runtime/eval semantics are stable enough to expose faithfully

---

## W1-S2 Stabilization — Execution Steps

### Step 1 — Track B closes the runtime/contract issues first

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | `W1-S2-FIX-B1`, `W1-S2-FIX-B2` | W1-S2 implemented + review findings accepted | Treat as one stabilization batch because both issues concern canonical runtime/contract truth |

#### `W1-S2-FIX-B1`
Reject unsupported runtime modes explicitly instead of degrading them to `linear`.

Expected outcome:
- `parallel` and `graph` are not silently executed as `linear`
- emitted execution metadata cannot misrepresent unsupported orchestration as a valid linear run
- dedicated tests prove the behavior

#### `W1-S2-FIX-B2`
Harden `WorkflowSpec` structural validation for duplicate step identities.

Minimum expectations:
- duplicate `step_id` values are rejected at spec/contract level
- any newly introduced invariant has targeted tests

---

### Step 2 — Track E hardens smoke-comparison correctness

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track E agent session | `W1-S2-FIX-E1` | `W1-S2-FIX-B1` ✅ + `W1-S2-FIX-B2` ✅ | Comparison should only go green when the normalized output is actually complete enough to compare |

#### `W1-S2-FIX-E1`
Tighten L1-I success criteria so missing comparable keys cannot produce a green summary/exit code.

Expected outcome:
- `all_comparable_outputs_present` reflects full comparable-output completeness, not just envelope existence
- script exit code fails when normalized output is structurally incomplete
- tests cover at least one negative case with missing comparable keys

---

### Step 3 — Track A restores CLI/trace visibility parity

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track A agent session | `W1-S2-FIX-A1`, `W1-S2-FIX-A2` | `W1-S2-FIX-B1` ✅ + `W1-S2-FIX-B2` ✅ | Visibility should mirror real runtime/eval truth, not invent a new summary contract |

#### `W1-S2-FIX-A1`
Extend workflow/final-output summary handling so handoff and single variants are not second-class in CLI output.

Expected outcome:
- `h1.single.v1`, `h1.manager.v1`, and `h1.handoff.v1` all expose useful comparable summary surfaces
- manager-specific orchestration summary remains manager-specific, but workflow-level summary becomes H1-variant aware

#### `W1-S2-FIX-A2`
Include `parent_event_id` and `correlation_id` in JSON trace output.

Expected outcome:
- handoff linkage survives JSON export
- downstream trace viewers / analysis scripts can reconstruct handoff chains more faithfully

---

### Step 4 — Meta Coordinator performs stabilization closeout

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | `W1-S2-FIX-META1` | `W1-S2-FIX-B1` ✅ + `W1-S2-FIX-B2` ✅ + `W1-S2-FIX-E1` ✅ + `W1-S2-FIX-A1` ✅ + `W1-S2-FIX-A2` ✅ | Meta does not implement code here; it confirms the stabilization batch is complete and restores the normal Wave 1 frontier |

#### `W1-S2-FIX-META1`
Close the stabilization batch and re-open the correct next frontier.

Expected outcome:
- W1-S2 can be treated as hardened enough for downstream use
- current frontier returns to `L1-J` / `L1-K` / `L1-L` / `L1-M`, not ad hoc W1-S2 bugfix drift

---

## Recommended next session order

If you want the exact order of sessions to run, use this:

1. `Track B agent session` -> `🔄 W1-S2-FIX-B1`, `🔄 W1-S2-FIX-B2`
2. `Track E agent session` -> `🔄 W1-S2-FIX-E1`
3. `Track A agent session` -> `🔄 W1-S2-FIX-A1`, `🔄 W1-S2-FIX-A2`
4. `Meta Coordinator session` -> `🔄 W1-S2-FIX-META1`

---

## Acceptance gate for this stabilization batch

The stabilization batch should count as complete if:

1. unsupported execution modes no longer degrade silently to `linear`
2. duplicate `step_id` values are rejected before runtime clobbering can happen
3. L1-I comparison only passes when comparable output fields are actually complete
4. handoff/single CLI summary output is no longer materially poorer than manager output for the shared H1 comparable surface
5. JSON trace output preserves `parent_event_id` and `correlation_id`

---

## After this plan completes

Once the stabilization batch is complete, the intended active frontier returns to:

- `L1-J` — basic trace viewer / timeline summary
- `L1-K` — H1 manual smoke rubric v1
- `L1-L` — H1 baseline comparison notes and decision log
- `L1-M` — prompt version tagging for H1 agent pack

This plan is therefore a **short corrective detour**, not a replacement for normal Wave 1 sequencing.

---

## Execution Status Update (2026-03-20)

Track B scope is complete:

- `W1-S2-FIX-B1` = ✅
- `W1-S2-FIX-B2` = ✅

Track E scope is complete:

- `W1-S2-FIX-E1` = ✅

Track A scope is complete:

- `W1-S2-FIX-A1` = ✅
- `W1-S2-FIX-A2` = ✅

Track B implementation report:

- `docs/wave1/Wave1-W1-S2-TrackB-Stabilization.md`

Track E implementation references:

- `src/fractal_agent_lab/evals/h1_smoke_comparison.py`
- `scripts/run_l1_i_h1_smoke_comparison.py`
- `tests/evals/test_h1_smoke_comparison.py`

Track A implementation references:

- `src/fractal_agent_lab/cli/formatting.py`
- `tests/cli/test_l1_e_h1_summary.py`
- `docs/wave1/Wave1-W1-S2-TrackA-Stabilization.md`

Meta closeout is complete:

- `W1-S2-FIX-META1` = ✅

Meta validation executed during closeout:

- `python -m compileall src tests`
- `PYTHONPATH=src python -m unittest tests.runtime.test_execution_mode_truth tests.evals.test_h1_smoke_comparison tests.cli.test_l1_e_h1_summary`

Observed closeout result:

- the stabilization mini-batch is accepted as complete
- the active frontier returns to `L1-J` / `L1-K` / `L1-L` / `L1-M`
