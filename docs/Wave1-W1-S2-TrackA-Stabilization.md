# Wave1-W1-S2-TrackA-Stabilization.md

## Purpose

This document records Track A implementation for the Wave 1 `W1-S2` stabilization fixes:

- `W1-S2-FIX-A1`
- `W1-S2-FIX-A2`

These are parity/fidelity hardening changes, not new orchestration features.

---

## Scope

In scope:

- H1 variant summary parity for CLI text/JSON output
- JSON trace export parity with canonical `TraceEvent` linkage fields
- regression tests for single/manager/handoff summary surfaces

Out of scope:

- runtime execution semantics or workflow contract changes
- eval comparison success criteria logic
- trace viewer UI implementation (`L1-J`)

---

## Implemented Changes

### `W1-S2-FIX-A1` — H1 summary parity across variants

Updated summary extraction in:

- `src/fractal_agent_lab/cli/formatting.py`

Behavior change:

- `workflow_summary` now works for all H1 variants:
  - `h1.single.v1` from `output_payload.step_results.single.output`
  - `h1.manager.v1` from `output_payload.final_output`
  - `h1.handoff.v1` from `output_payload.final_output`
- shared comparable fields are aligned with Track E normalization keys:
  - `clarified_idea`
  - `strongest_assumptions`
  - `weak_points`
  - `alternatives`
  - `recommended_mvp_direction`
  - `next_3_validation_steps`
- manager orchestration summary remains manager-specific

### `W1-S2-FIX-A2` — JSON trace linkage parity

Updated JSON trace event export in:

- `src/fractal_agent_lab/cli/formatting.py`

Behavior change:

- each `trace_summary.events[]` item now includes:
  - `parent_event_id`
  - `correlation_id`
- handoff chain linkage survives CLI JSON output, not just raw artifacts

---

## Tests Added / Updated

- `tests/cli/test_l1_e_h1_summary.py`
  - verifies text summary parity for `h1.single.v1`, `h1.manager.v1`, `h1.handoff.v1`
  - verifies JSON `workflow_summary` parity for all H1 variants
  - verifies manager-only `orchestration_summary` behavior remains intact
  - verifies handoff JSON trace includes linkage fields and populated linkage values

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.cli.test_l1_e_h1_summary`
3. CLI smoke script over all H1 variants for summary/trace parity checks

Observed:

- all H1 variants now expose comparable workflow summary surfaces
- manager orchestration detail remains manager-specific
- handoff JSON trace output retains parent/correlation linkage

---

## Boundaries Preserved

Track A changed presentation/export surfaces only.

No changes were made to:

- runtime execution semantics (Track B)
- workflow contract enforcement (Track B)
- eval gating logic (Track E)
- adapter/provider behavior (Track D)
