# Wave5 W5-S1 TrackA U5-C Trace Timeline

## Status

Track A implementation delivery note for `U5-C`.

Execution mode: `opencode_assisted`.

Visibility / audit state: git-visible UI code, generator script, tests, docs, and local
ignored generated trace-detail outputs under `ui/public/generated/traces/`.

## Scope

Implemented a generated trace-detail-backed single-run trace timeline page on top of the
Wave 5 shell and the committed U5-B run browser.

In scope:

- generated strict-valid trace detail files from canonical artifacts
- single-run trace timeline page
- handoff consumption from U5-B (`runId`, `traceArtifactPath`, `traceState`)
- explicit missing/invalid/degraded states
- canonical sequence-ordered event list
- event filtering by type, lane, step, and failure-only mode
- parent/correlation visibility where present
- collapsed raw payload preview for local/private debugging
- validation/degrade banner

Out of scope and intentionally not implemented:

- replay execution
- eval scoring
- cross-run comparison
- workflow launch
- packet generation
- graph workflow visualization beyond simple lane/step grouping
- trace editing or repair
- backend/API service

## Generated Trace Detail Boundary

Generator command from `ui/`:

```bash
npm run build:traces
```

Default input:

```text
../data
```

Default output:

```text
ui/public/generated/traces/<run_id>.json
```

The generated trace details are local/private derived surfaces, served by Vite, and
gitignored through `/ui/public/generated/`.

Each `build:traces` run removes existing `ui/public/generated/traces/*.json` outputs
before writing the fresh strict-valid set, so stale trace detail files are not retained
for runs that become missing/invalid.

Canonical truth remains:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

## Invalid Trace Rule

Strict-invalid traces must not render timeline events.

Rules applied:

- no ready timeline detail file is written for strict-invalid traces
- UI shows invalid state from the run index and warnings
- missing traces show a hard missing state
- generated trace detail files exist only for strict-valid traces
- generated stale detail files are cleaned before the new strict-valid set is written

## Schema

Schema version:

```text
u5_c.trace_detail.v1
```

Top-level fields:

- `schema_version`
- `generated_at`
- `run_id`
- `workflow_id`
- `status`
- `run_artifact_path`
- `trace_artifact_path`
- `summary`
- `validation`
- `events`

Validation fields:

- `trace_state`
- `warnings`
- `timestamp_order`
- `linkage_state`

Event fields:

- `event_id`
- `sequence`
- `timestamp`
- `event_type`
- `source`
- `step_id`
- `parent_event_id`
- `correlation_id`
- `lane`
- `turn_index`
- `handoff_index`
- `from_step_id`
- `to_step_id`
- `is_failure`
- `payload_summary`
- `payload`

## Display Rules

- Timeline order follows canonical `sequence`.
- Timestamp issues create warnings only; they do not reorder events.
- Missing explicit `parent_event_id` targets create linkage warnings.
- Correlation partiality alone is not treated as an error.
- Unknown event types remain visible and are not dropped.
- Raw payload is collapsed by default behind `<details>`.

## U5-B Handoff Consumption

Consumed fields from the U5-B run browser:

- `runId`
- `traceArtifactPath`
- `traceState`

Behavior:

- selecting “Open trace timeline” opens the Trace page
- valid targets load generated trace details
- missing/invalid targets render no fake timeline

## Validation Commands

Commands run during implementation:

```bash
python -m unittest tests.scripts.test_u5_c_trace_details
cd ui && npm run build:traces -- --data-dir ../data
cd ui && npm run typecheck
cd ui && npx vitest --environment jsdom --run src/App.test.tsx
cd ui && npm run build
PYTHONPATH=src python -m unittest tests.cli.test_l1_j_trace_viewer
PYTHONPATH=src python -m unittest tests.cli.test_r3_j_trace_browser
```

Results:

- U5-C generator tests passed: `7` tests.
- Generated trace detail smoke passed: `92` detail files, `0` skipped, `0` warnings on the current local corpus.
- Typecheck passed.
- Targeted UI trace/run test file passed: `12` tests.
- Production build passed.
- CLI `trace show` regression passed with `PYTHONPATH=src`: `4` tests.
- CLI trace-browser regression passed with `PYTHONPATH=src`: `3` tests.

Note: the session blocked `npm test -- --run` as a full-suite invocation. The equivalent
targeted UI file run via `npx vitest --environment jsdom --run src/App.test.tsx` passed.

## Known Limits

- Trace detail files can become stale after local `data/` changes; rerun `npm run build:traces`.
- The trace page is read-only.
- Very large traces rely on filtering and compact rendering rather than virtualization.
- Raw payloads are local/private derived data and should not be treated as public artifacts.

## Non-Goals Preserved

The Trace page does not claim:

- replay execution exists
- eval scoring/comparison exists
- launch or packet behavior exists
- graph workflow visualization exists beyond simple grouping
- generated trace details replace canonical trace truth
