# Wave1-L1-E-H1-Run-Summary.md

## Purpose

This document records Track A delivery for Wave 1 epic `L1-E`.

`L1-E` improves CLI run summary readability for `h1.manager.v1` so users can
understand manager-path outcomes without scanning raw payloads.

---

## Scope

In scope:

- H1-aware summary formatting in text output
- H1-aware summary envelope additions in JSON output
- manager-orchestration readability additions (turn count and finalize reason)
- trace summary enrichment for manager/worker lanes and agent-level events

Out of scope:

- baseline-vs-manager comparison UX (`L1-D` and Track E owned)
- trace viewer surface (`L1-J`)
- runtime contract or adapter behavior changes

---

## Implemented Files

- `src/fractal_agent_lab/cli/formatting.py`
- `src/fractal_agent_lab/cli/app.py`
- `tests/cli/test_l1_e_h1_summary.py`
- `docs/Wave1-L1-E-H1-Run-Summary.md`

---

## Text Summary Improvements

For all workflows, text summary keeps the Wave 0 core run fields.

For `h1.manager.v1`, text summary now adds:

- `workflow_summary` section with key H1 final output fields
  - `clarified_idea`
  - `recommended_mvp_direction`
  - compact lists for assumptions, weak points, alternatives, validation steps
- `orchestration_summary` section
  - manager step id
  - worker step ids
  - turn count
  - finalize reason (when present)
- artifact paths (run and trace) when artifact writing succeeds

---

## JSON Summary Improvements

`summary` remains the top-level run envelope from `F0-H`.

Additive fields introduced by `L1-E`:

- `workflow_summary` (H1-specific readable extraction)
- `orchestration_summary` (manager turns and control context)

`trace_summary` now additionally includes:

- `event_counts`
- `lane_counts`
- `max_turn_index`

This keeps backward compatibility while making manager-path runs easier to inspect.

---

## Validation

Executed:

1. `python -m compileall src`
2. `PYTHONPATH=src python -m unittest tests.cli.test_l1_e_h1_summary`
3. `PYTHONPATH=src python -m fractal_agent_lab.cli run h1.manager.v1 --show-trace`
4. `PYTHONPATH=src python -m fractal_agent_lab.cli run h1.manager.v1 --format json --show-trace`

Observed:

- manager-path output is readable in text mode
- JSON output includes stable summary plus H1/orchestration sections
- trace summary shows lane and turn context without runtime contract changes

---

## Boundaries Preserved

Track A changed presentation only.

No changes were made to:

- `WorkflowSpec` or manager contract schema ownership (Track B)
- runtime execution semantics (Track B)
- provider contracts and adapter behavior (Track D)
- prompt semantics (Track C)
