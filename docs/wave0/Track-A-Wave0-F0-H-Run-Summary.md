# Track A Wave 0 - F0-H Run Summary

## Purpose

This document records the Wave 0 Track A implementation for `F0-H`.

`F0-H` improves run output formatting so a user can understand execution
outcome quickly without opening raw runtime objects.

## Scope Implemented

- Stable run summary fields in text mode
- Stable run summary envelope in JSON mode
- Optional trace summary output with event counts and timeline
- Success and failure path formatting through the same summary contract

## Summary Contract v0.1

Required fields:

- `run_id`
- `workflow_id`
- `status`
- `steps_total`
- `steps_completed`
- `errors_count`
- `trace_events_count`
- `started_at`
- `completed_at`

Text mode includes the above fields plus error lines when present.

JSON mode includes:

- top-level `summary` object
- optional `trace_summary` when `--show-trace` is enabled

## Commands Used for Validation

Assuming `src/` is on `PYTHONPATH`:

- `PYTHONPATH=src python -m fractal_agent_lab.cli run wave0.demo`
- `PYTHONPATH=src python -m fractal_agent_lab.cli run wave0.demo --show-trace`
- `PYTHONPATH=src python -m fractal_agent_lab.cli run wave0.demo --format json --show-trace`
- `PYTHONPATH=src python -m fractal_agent_lab.cli run wave0.demo --provider does_not_exist --show-trace`

## Boundaries Preserved

Track A changed presentation only.

No changes were made to:

- runtime execution semantics
- canonical runtime state model
- provider contracts
- prompt or memory semantics

## Files Updated for F0-H

- `src/fractal_agent_lab/cli/formatting.py`
- `src/fractal_agent_lab/cli/app.py`
- `docs/wave0/Track-A-Wave0-F0-H-Run-Summary.md`
