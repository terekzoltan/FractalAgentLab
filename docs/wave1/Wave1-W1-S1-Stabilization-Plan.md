# Wave1-W1-S1-Stabilization-Plan.md

## Purpose

This document records the post-review stabilization plan for Wave 1 Sprint `W1-S1`.

It exists because `L1-A` through `L1-E` are implemented, but the review found a small set of issues that should be corrected before treating the sprint as fully hardened.

This is a **stabilization mini-batch**, not a new feature wave.

---

## Why this plan exists

The W1-S1 review found four meaningful concerns:

1. `h1.single.v1` reports `execution_mode=manager` while actually running the linear executor path
2. manager control parsing accepts only the first discovered control envelope instead of the first valid one
3. the H1 manager mock path is permissive enough to hide orchestration-order regressions
4. the agreed default model-tier direction was regressed back to older defaults

These issues are small enough to fix quickly, but important enough that they should not be mixed into later Wave 1 work without an explicit plan.

---

## Scope

In scope:

- W1-S1 post-review stabilization
- runtime/contract correctness fixes
- mock strictness hardening where it affects test honesty
- default model-tier policy re-alignment
- missing guardrail tests for the new manager primitive

Out of scope:

- new orchestration features
- handoff implementation (`L1-F` and later)
- replay/eval expansion beyond the current W1-S1 findings
- public README or portfolio polishing

---

## Canonical findings this plan addresses

### F1 — Baseline execution-mode mismatch
- `h1.single.v1` currently reports manager execution while actually using the linear branch

### F2 — Manager control parsing edge case
- invalid top-level `control` currently masks valid nested `output.control` or `raw.control`

### F3 — Mock permissiveness hides ordering bugs
- H1 manager mock workers can succeed with too little upstream context

### F4 — Model-tier default regression
- repo defaults should align to the current intended direction:
  - `cheap_worker` -> `gpt-4o-mini`
  - `specialist` -> `gpt-5.4-nano`
  - `finalizer` -> `gpt-5.4-mini`

---

## Ownership and execution policy

This stabilization batch is intentionally split by ownership boundary.

- **Track B** owns runtime/contract truth
- **Track D** owns adapter/mock behavior and model-tier config surface
- **Meta Coordinator** records policy truth and sequencing adjustments

Rule:
- do not fix runtime semantics in a Track D session
- do not fix mock/test honesty first if the Track B runtime contract is still unresolved

---

## W1-S1 Stabilization — Execution Steps

### Step 1 — Track B closes the runtime/contract issues first

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track B agent session | `W1-S1-FIX-B1`, `W1-S1-FIX-B2`, `W1-S1-FIX-B3` | W1-S1 implemented + review findings accepted | Treat as one stabilization batch because all three concern runtime/contract truth |

#### `W1-S1-FIX-B1`
Fix the `h1.single.v1` execution-mode contract mismatch.

Expected outcome:
- execution metadata matches actual executor path
- trace/report consumers cannot mistake the baseline for manager orchestration

#### `W1-S1-FIX-B2`
Fix manager-control parsing so the first **valid** control envelope wins.

Expected outcome:
- invalid top-level control does not suppress a valid nested control
- permissive parsing remains pragmatic rather than fragile

#### `W1-S1-FIX-B3`
Add missing guardrail tests around the manager primitive.

Minimum test additions:
- invalid delegate target
- revisit rejection when revisits are disabled
- max-turn exhaustion
- fallback path when no manager control envelope is present

---

### Step 2 — Track D hardens the mock path after Track B truth is stable

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Track D agent session | `W1-S1-FIX-D1`, `W1-S1-FIX-D2` | `W1-S1-FIX-B1` ✅ + `W1-S1-FIX-B2` ✅ | Mock behavior should follow the stabilized runtime contract, not guess ahead of it |

#### `W1-S1-FIX-D1`
Harden `MockAdapter` H1 manager workers so ordering mistakes become visible.

Expected outcome:
- planner should not look healthy without the expected intake context
- critic should not silently pass with unrealistic missing context if that would hide manager-order mistakes

#### `W1-S1-FIX-D2`
Re-align model-tier defaults to the current intended baseline.

Canonical default direction:
- `cheap_worker` -> `gpt-4o-mini`
- `specialist` -> `gpt-5.4-nano`
- `finalizer` -> `gpt-5.4-mini`

Expected touchpoints:
- `configs/model_policy.example.yaml`
- any tests that intentionally assert those tier names/models
- any docs that explicitly call these defaults out as current policy

---

### Step 3 — Meta Coordinator performs stabilization closeout

| Session | Epic(s) | Prereq | Notes |
|---------|---------|--------|-------|
| Meta Coordinator session | `W1-S1-FIX-META1` | `W1-S1-FIX-B1` ✅ + `W1-S1-FIX-B2` ✅ + `W1-S1-FIX-B3` ✅ + `W1-S1-FIX-D1` ✅ + `W1-S1-FIX-D2` ✅ | Meta does not implement code here; it confirms the stabilization batch is complete and records the next Wave 1 frontier |

#### `W1-S1-FIX-META1`
Close the stabilization batch and re-open the correct next frontier.

Expected outcome:
- W1-S1 can be treated as hardened enough for downstream use
- current frontier returns to `L1-F` / `L1-H` / `L1-I` sequence, not ad hoc bugfix drift

---

## Recommended next session order

If you want the exact order of sessions to run, use this:

1. `Track B agent session` -> `🔄 W1-S1-FIX-B1`, `🔄 W1-S1-FIX-B2`, `🔄 W1-S1-FIX-B3`
2. `Track D agent session` -> `🔄 W1-S1-FIX-D1`, `🔄 W1-S1-FIX-D2`
3. `Meta Coordinator session` -> `🔄 W1-S1-FIX-META1`

---

## Acceptance gate for this stabilization batch

The stabilization batch should count as complete if:

1. `h1.single.v1` no longer misreports orchestration mode
2. manager control parsing honors the first valid control envelope
3. manager runtime guardrails have dedicated tests
4. mock-path ordering regressions are less likely to pass silently
5. current default model-tier docs/config align again to:
   - `gpt-4o-mini`
   - `gpt-5.4-nano`
   - `gpt-5.4-mini`

---

## After this plan completes

Once the stabilization batch is complete, the intended active frontier returns to:

- `L1-F` — handoff primitive v1
- `L1-G` — H1 handoff chain variant
- `L1-H` — trace event enrichment for handoffs
- `L1-I` — baseline vs manager vs handoff comparison

This plan is therefore a **short corrective detour**, not a replacement for normal Wave 1 sequencing.

---

## Closeout Status

`W1-S1-FIX-META1` is now complete.

The stabilization batch is treated as closed, and the active frontier has returned to:

1. `L1-F`
2. `L1-G`
3. `L1-H`
4. `L1-I`

---

## Execution Status Update (2026-03-18)

Track B scope is complete:

- `W1-S1-FIX-B1` = ✅
- `W1-S1-FIX-B2` = ✅
- `W1-S1-FIX-B3` = ✅
- `W1-S1-FIX-B4` = ✅

Track B implementation report:

- `docs/wave1/Wave1-W1-S1-TrackB-Stabilization.md`
