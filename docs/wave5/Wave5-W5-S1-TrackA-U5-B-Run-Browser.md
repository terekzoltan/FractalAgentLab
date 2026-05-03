# Wave5 W5-S1 TrackA U5-B Run Browser

## Status

Track A implementation delivery note for `U5-B`.

Execution mode: `opencode_assisted`.

Visibility / audit state: git-visible UI code, generator script, tests, docs, and
gitignore update. Local generated indexes under `ui/public/generated/` are ignored and
not canonical truth.

## Scope

Implemented a generated-index-backed run browser on top of the U5-A local evidence
observatory shell.

In scope:

- derived run index generation from canonical `data/` artifacts
- run list page
- run detail panel
- artifact existence indicators
- workflow/status/provider/model/fallback disclosure where present
- row-level missing/invalid artifact visibility
- workflow/status filters
- deterministic limit/sort behavior inherited from the trace-browser row source
- U5-C trace-target handoff contract

Out of scope and intentionally not implemented:

- trace event timeline rendering
- eval scoring or run comparison semantics
- artifact editing, deletion, or repair
- provider/model quality ranking
- workflow launch
- packet generation
- backend/API service
- OpenCode automation

## Generated Index Boundary

Generator command from `ui/`:

```bash
npm run build:index
```

Default input:

```text
../data
```

Default output:

```text
ui/public/generated/run-index.json
```

The generated output is served locally by Vite. It is a private, local, derived browse
artifact and is gitignored by `/ui/public/generated/`.

The generated index is not canonical evidence truth. Canonical truth remains:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

## Schema

Schema version:

```text
u5_b.run_index.v1
```

Top-level fields:

- `schema_version`
- `generated_at`
- `data_dir`
- `summary`
- `runs`
- `warnings`

Run-row fields:

- `run_id`
- `workflow_id`
- `status`
- `started_at`
- `completed_at`
- `run_artifact_path`
- `trace_artifact_path`
- `artifact_dir_path`
- `has_run_artifact`
- `has_trace_artifact`
- `has_artifact_dir`
- `sidecar_files`
- `trace_state`
- `trace_event_count`
- `trace_schema_versions`
- `provider_names`
- `model_names`
- `fallback_state`
- `row_state`
- `warnings`

## Degrade Policy

- Missing `data/runs` directory: warning-grade empty/partial index.
- Missing `data/traces` directory: warning-grade empty/partial index.
- Missing run artifact: visible `missing_run_artifact` row when discovered from trace.
- Missing trace artifact: visible `missing_trace_artifact` row when discovered from run.
- Invalid run artifact: visible `invalid_run_artifact` where possible.
- Invalid trace artifact: visible `invalid_trace_artifact` with warning.
- Unknown workflow/status/provider/model fields render as `unknown`, not inferred.

Trace validation rule:

- JSONL non-empty lines must parse as JSON objects.
- Trace event list must be non-empty.
- Each event `sequence` must be an integer.
- `sequence` must be strictly increasing.

## Provider / Model Disclosure

Provider, model, and fallback values are disclosure-only. They are extracted from emitted
run artifact fields using a conservative allowlist and are never inferred from provider
configuration.

The UI does not compare provider quality and does not render a provider leaderboard.

## U5-C Handoff Contract

The U5-B detail panel can pass a trace target to the Trace placeholder.

Handoff fields:

- `runId`
- `traceArtifactPath`
- `traceState`

Guaranteed fields:

- selected run id
- canonical trace artifact path reference
- trace state vocabulary: `ok`, `missing`, `invalid`

Optional fields for later U5-C consumption:

- trace event count
- trace schema versions
- row warnings

U5-B does not render a trace event timeline.

## Validation Commands

Commands run during implementation:

```bash
python -m unittest tests.scripts.test_u5_b_run_index
cd ui && npm test -- --run
cd ui && npm run build:index -- --data-dir ../data
cd ui && npm run typecheck
cd ui && npm run build
PYTHONPATH=src python -m unittest tests.cli.test_r3_j_trace_browser
```

Results:

- U5-B generator tests passed: `7` tests.
- UI component tests passed: `7` tests.
- Generated index smoke passed: `92` local run rows, `0` warnings.
- Typecheck passed.
- Production build passed.
- CLI trace-browser regression passed with `PYTHONPATH=src`: `3` tests.
- Generated output safety check passed: `ui/public/generated/` appears as ignored and is not staged.

Note: running `python -m unittest tests.cli.test_r3_j_trace_browser` without `PYTHONPATH=src`
failed because this repo does not expose `src/fractal_agent_lab` on the default Python
module path in that shell. The regression passed after setting `PYTHONPATH=src`.

## Known Limits

- The generated index can become stale after local `data/` changes; rerun `npm run build:index`.
- URL routing is not required for U5-B acceptance.
- Copy buttons are not required for U5-B acceptance.
- Provider/model extraction is intentionally conservative and may show `unknown` for older artifacts.
- The run browser is read-only.

## Non-Goals Preserved

The UI does not claim:

- trace timelines are implemented
- workflow launch is active
- packet generation is active
- OpenCode automation exists
- provider/model ranking exists
- eval scoring/comparison exists
- derived index truth replaces canonical artifacts
