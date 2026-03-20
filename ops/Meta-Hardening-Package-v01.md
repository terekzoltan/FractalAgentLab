# Meta-Hardening-Package-v01.md

## Purpose

This document records a **provisional meta hardening package** derived from the first two meaningful implementation review cycles:

- Wave 1 Sprint `W1-S1` review
- Wave 1 Sprint `W1-S2` review

The goal is to reduce repeated failure patterns **without** overreacting and turning the project into a heavy process machine.

This package is intentionally light.
It is based on limited evidence and should be treated as a **working default**, not a permanent constitution.

---

## Why this exists

Two review cycles are enough to justify a few preventive rules, but not enough to redesign the whole planning system.

The review findings already show repeated patterns around:

- runtime truth drift
- false-green smoke/eval paths
- missing structural invariants
- surface inconsistency across runtime / eval / CLI

Those patterns are now strong enough to justify a small hardening layer in planning and closeout logic.

---

## Scope

In scope:

- a few preventive planning rules
- light additions to acceptance and closeout expectations
- clearer use of the review findings registry

Out of scope:

- heavy review bureaucracy
- new permanent coordinator roles
- roadmap reprioritization based on only two review cycles
- enterprise-style compliance checklists for every epic

---

## Provisional hardening rules

### Rule H1 — Declared orchestration truth must match runtime truth

If a workflow or runtime path declares an orchestration mode, the emitted runtime behavior and metadata must agree.

Implication:
- unsupported modes should fail closed rather than silently degrade
- new orchestration modes need at least one explicit truth-check test cluster

Why this is justified already:
- repeated `runtime_truth_drift` findings appeared across W1-S1 and W1-S2

---

### Rule H2 — New orchestration semantics require negative-path tests

Happy-path tests are not enough for:

- new control-envelope parsing
- new orchestration branches
- new workflow-structure invariants

Minimum expectation:
- every such change should ship with at least one targeted negative-path test group

Why this is justified already:
- multiple review findings were not “feature missing” problems, but edge-case acceptance gaps

---

### Rule H3 — Structural workflow invariants should be enforced before runtime when practical

If a workflow can be rejected safely at spec/contract load time, prefer that over allowing runtime clobbering or ambiguous behavior.

Typical examples:
- duplicate `step_id`
- invalid manager/handoff references
- unsupported execution-mode combinations

Why this is justified already:
- repeated issues came from contract gaps that runtime then had to compensate for imperfectly

---

### Rule H4 — Smoke/eval green must mean structural completeness, not envelope presence

If an eval or smoke path claims two outputs are comparable, the required normalized fields must actually be populated.

Implication:
- green summary / exit status should not depend only on envelope existence

Why this is justified already:
- false-green risk has now appeared in both mock-path and eval-path form

---

### Rule H5 — Mock-backed orchestration evidence must fail loudly on missing prerequisite context

If a mock path is used to support orchestration confidence, it should not quietly succeed when upstream context is missing in ways that would hide ordering bugs.

Why this is justified already:
- permissive mock behavior already produced misleading confidence once

---

### Rule H6 — Runtime/eval semantic expansion requires one cross-surface consistency pass before sprint closeout

When a sprint changes what a workflow means or exposes, check at least these surfaces before closing:

- runtime truth
- eval/report truth
- CLI/export truth

This is not a full audit.
It is a lightweight consistency pass for semantic expansions.

Why this is justified already:
- multiple findings came from one layer becoming richer while another still reflected an older mental model

---

## What should NOT be changed yet

Because the evidence base is still small, the following should **not** be changed yet:

1. Do not create a heavy permanent review bureaucracy.
2. Do not force a large mandatory checklist on every epic.
3. Do not reprioritize the whole roadmap around these issues.
4. Do not add cross-surface audit requirements to every trivial change.
5. Do not overfit provider/model governance from one drift incident.
6. Do not draw orchestration-quality conclusions (manager vs handoff) from correctness findings alone.

---

## Recommended integration level

These rules should be integrated lightly:

- `ops/AGENTS.md` gets short operational expectations
- `ops/Combined-Execution-Sequencing-Plan.md` gets small planning/acceptance language updates
- `ops/Meta-Coordinator-Runbook.md` gets explicit use of findings-based hardening review

Do **not** spread this package into too many separate documents yet.

---

## Review threshold for making these rules stronger

If similar patterns appear in one or two more review cycles, then it becomes reasonable to:

- strengthen acceptance gates further
- add a more explicit invariant checklist template for new orchestration features
- require formal cross-surface closeout on every semantic sprint

Until then, keep this package lightweight and evidence-led.
