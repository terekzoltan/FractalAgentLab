# Wave1-L1-J-Trace-Viewer.md

## Purpose

This document records Track A delivery for Wave 1 epic `L1-J`.

`L1-J` adds a basic trace viewer / timeline summary surface so stored run traces
can be inspected without raw JSONL spelunking.

---

## Scope

In scope:

- CLI-first persisted trace viewer command
- timeline summary output using enriched handoff trace fields
- linkage-aware rendering with `parent_event_id` and `correlation_id`
- focused tests for success and error paths

Out of scope:

- browser UI timeline implementation
- multi-run browsing/indexing UX
- replay orchestration features

---

## Implemented Files

- `src/fractal_agent_lab/cli/app.py`
- `src/fractal_agent_lab/cli/trace_reader.py`
- `src/fractal_agent_lab/cli/formatting.py`
- `tests/cli/test_l1_j_trace_viewer.py`
- `docs/wave1/Wave1-L1-J-Trace-Viewer.md`

---

## CLI Surface

New command:

- `python -m fractal_agent_lab.cli trace show --run-id <run_id>`

Options:

- `--data-dir <path>` (default: `data`)
- `--format text|json` (default: `text`)

Behavior:

- reads `data/traces/<run_id>.jsonl` (required)
- reads `data/runs/<run_id>.json` (optional)
- renders timeline summary with event/lane/linkage context

Wave 2 (`H2-D`) note:

- path resolution now routes through the shared persistence-layout module
- canonical run/trace file locations remain unchanged for trace-viewer compatibility

---

## Timeline Output Fields

Viewer output now exposes, per event where available:

- `sequence`, `event_type`, `source`, `step_id`
- `lane`, `turn_index`, `handoff_index`
- `from_step_id`, `to_step_id`
- `parent_event_id`, `correlation_id`

This matches the enriched handoff trace semantics delivered in `L1-H`.

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.cli.test_l1_j_trace_viewer tests.cli.test_l1_e_h1_summary`
3. CLI smoke run + trace inspect flow:
   - run an H1 variant
   - inspect the same run with `trace show`

Observed:

- trace timeline renders correctly in text mode
- JSON mode preserves linkage fields for downstream analysis
- missing trace artifact path fails loudly with non-zero exit

---

## Boundaries Preserved

Track A changed visibility surfaces only.

No changes were made to:

- runtime execution semantics (Track B)
- adapter/provider behavior (Track D)
- eval success semantics (Track E)
