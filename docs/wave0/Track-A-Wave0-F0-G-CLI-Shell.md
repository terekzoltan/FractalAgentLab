# Track A Wave 0 - F0-G CLI Shell

## Purpose

This document records the Wave 0 Track A implementation scope for `F0-G`.

The goal is a minimal CLI shell that can launch a workflow through the Track B
executor boundary and present a readable run outcome.

## Implemented Scope

- CLI entrypoint for module execution: `python -m fractal_agent_lab.cli`
- `run` command: `fal run <workflow-id>` shape via module invocation
- `list-workflows` command for discoverability
- Text and JSON output modes
- Optional trace timeline summary output
- Wave 0 mock step runner for demonstration without provider integration

## Commands

Assuming `src/` is on `PYTHONPATH`:

- `python -m fractal_agent_lab.cli list-workflows`
- `python -m fractal_agent_lab.cli run wave0.demo`
- `python -m fractal_agent_lab.cli run wave0.demo --show-trace`
- `python -m fractal_agent_lab.cli run wave0.demo --format json`
- `python -m fractal_agent_lab.cli run wave0.demo --input-json '{"idea":"agent lab"}'`

## Input Contract (Wave 0)

- `--input-json` must be a JSON object string

Example:

- `{"idea":"my startup concept"}`

## Output Contract (Wave 0)

Text output includes:

- `run_id`
- `workflow_id`
- `status`
- step completion count
- schema version and timestamps
- errors (if present)

Optional trace summary includes ordered event timeline with sequence and step id.

JSON output includes:

- `summary` object with run lifecycle fields
- optional `trace_summary` object when `--show-trace` is enabled

## Ownership and Boundaries

This implementation stays in Track A ownership areas:

- `src/fractal_agent_lab/cli/`

It consumes Track B contracts without redefining them:

- `RunState`
- `TraceEvent`
- `WorkflowExecutor`

It intentionally does not implement:

- provider execution semantics (Track D)
- prompt semantics (Track C)
- runtime state logic changes (Track B)

## Known Limits

- No packaged `fal` binary entrypoint yet
- No persisted trace artifact browser yet
- Only a built-in demo workflow is wired in Wave 0

## Files Added for F0-G

- `src/fractal_agent_lab/cli/__main__.py`
- `src/fractal_agent_lab/cli/app.py`
- `src/fractal_agent_lab/cli/formatting.py`
- `src/fractal_agent_lab/cli/mock_runner.py`
- `src/fractal_agent_lab/cli/workflow_registry.py`
- `docs/wave0/Track-A-Wave0-F0-G-CLI-Shell.md`
