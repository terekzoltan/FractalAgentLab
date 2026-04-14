# Wave3-W3-S3-TrackA-R3-J-Trace-Browser.md

## Purpose

This document records Track A delivery for Wave 3 Sprint `W3-S3` Step 1 epic `R3-J`.

`R3-J` extends the existing trace viewer from single-run drill-down to multi-workflow browsing.

---

## Scope

In scope:

- multi-workflow trace browsing command (`trace list`)
- filterable run listing (`workflow_id`, `status`, `limit`)
- strict single-run drill-down preserved (`trace show --run-id`)
- row-level degrade policy for browse mode

Out of scope:

- compare logic across runs (`R3-K`)
- project memory semantics (`R3-I`)
- browser/workbench UI packaging (`R3-L` and later)

---

## Implemented Files

- `src/fractal_agent_lab/cli/app.py`
- `src/fractal_agent_lab/cli/trace_reader.py`
- `src/fractal_agent_lab/cli/formatting.py`
- `tests/cli/test_r3_j_trace_browser.py`
- `docs/wave3/Wave3-W3-S3-TrackA-R3-J-Trace-Browser.md`

---

## CLI Surface

New command:

- `python -m fractal_agent_lab.cli trace list`

Supported options:

- `--data-dir <path>`
- `--workflow-id <workflow_id>`
- `--status <status>`
- `--limit <int>`
- `--format text|json`

Existing command retained:

- `python -m fractal_agent_lab.cli trace show --run-id <run_id>`

---

## Browse Error Policy (R3-J)

`trace show` remains strict and fail-loud.

`trace list` uses row-level degrade to avoid collapsing multi-run browsing because of one bad artifact pair:

- missing run artifact: row remains, metadata fields stay unknown
- missing trace artifact: row remains with `trace_state=missing`
- malformed or non-monotonic trace: row remains with `trace_state=invalid` and warning
- full command failure only on discovery-layer errors (e.g. unreadable runs/traces directory)

No implicit workflow/status guessing is performed from trace payload.

---

## Persistence Contract Alignment

`R3-J` consumes canonical path helpers from shared tracing layout:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

Additive sidecar area stays visibility-only for this epic:

- `data/artifacts/<run_id>/`

No run/trace persistence contract change is introduced.

---

## Validation

Executed:

1. `python -m compileall src tests`
2. `PYTHONPATH=src python -m unittest tests.cli.test_r3_j_trace_browser tests.cli.test_l1_j_trace_viewer tests.cli.test_l1_e_h1_summary`
3. CLI smoke with real run artifacts:
   - `trace list --format text`
   - `trace list --workflow-id h1.handoff.v1 --format json`
   - `trace show --run-id <run_id>`

Observed:

- multi-workflow listing works across stored run/trace artifacts
- filter semantics remain explicit and non-guessing
- strict single-run drill-down behavior remains intact

---

## Boundaries Preserved

Track A changed CLI visibility surfaces only.

No changes were made to:

- runtime execution semantics (Track B)
- replay/eval ownership (`R3-K`, Track E)
- project memory merge/update semantics (`R3-I`, Track C)
