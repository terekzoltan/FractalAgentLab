# Wave7 W7-D TrackA Workbench Index Support v1

## Status

Track A delivery note for `W7-D` implementation.

## Scope

W7-D extends the existing Wave 5 local workbench generated-index model so accepted W7 OpenCode-backed loop artifacts are browseable without manual sidecar spelunking.

Implemented surface is read-only and generated-index driven:

- run browser OpenCode-backed row fields
- run-origin, target-project, and decision visibility
- trace-detail OpenCode loop drill-down
- packet/order ledger display
- selected-output structured extract display
- approval checkpoint display
- compact review synthesis display

## Accepted Inputs

W7-D consumes only accepted W7-B/C canonical artifacts:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/opencode_loop_summary.json`
- `data/artifacts/<run_id>/packet_ledger.json`
- `data/artifacts/<run_id>/selected_outputs.json`
- `data/artifacts/<run_id>/review_synthesis.json`
- `data/artifacts/<run_id>/approval_log.json`

It does not consume W7-E1 learning sidecars in this slice.

## Generated Output Policy

The workbench continues to use local generated browse artifacts under:

- `ui/public/generated/**`

These files are local/generated output. Do not commit them unless Meta explicitly asks for a generated-output evidence snapshot.

W7-D does not write new canonical artifacts under `data/**`.

## Schema Strategy

The implementation preserves the existing generated-index schema family names:

- `u5_b.run_index.v1`
- `u5_c.trace_detail.v1`

W7 fields are additive and nullable. A schema bump was intentionally avoided because existing FAL-native browse behavior remains compatible after the generator and loader update together.

## Source-Reported Field Rules

Displayed W7 fields are source-reported from accepted W7 sidecars.

Important boundary rules:

- `clean_pass_eligible` is displayed only as a source-reported ingest field.
- artifact directory presence is not accepted as clean-pass or success truth.
- `public_export_state` and privacy fields are display metadata only, not a public-release gate.
- `required_followup_count` may only come from a structured sidecar field if present; it is not derived from review prose.
- selected-output excerpts are bounded structured extracts from sidecars only.
- raw body or `body_path` content is never rendered.

## Malformed Sidecar Behavior

Malformed optional W7 sidecars degrade row/detail visibility instead of breaking the whole workbench index.

Expected behavior:

- row/detail remains visible
- explicit warning is shown
- W7 sidecars must match the expected `schema_version`
- W7 sidecars with `run_id` must match the current run; `opencode_loop_summary.json` requires a matching `run_id`
- packet, approval, selected-output, and review data are not fabricated
- the generated index/detail remains usable for canonical run/trace inspection

## Non-Goals

W7-D does not implement:

- OpenCode session control
- browser-side execution
- router mutation or discovery
- commit or push automation
- writer, adapter, memory, or identity changes
- learning candidate semantics
- privacy sufficiency validation
- public export approval

If a W7 sidecar contract gap appears, route it to Meta and the owning Track rather than adding a semantic workaround in the UI.

## Verification Commands

```powershell
$env:PYTHONPATH='src'; python -m unittest tests.scripts.test_u5_b_run_index
$env:PYTHONPATH='src'; python -m unittest tests.scripts.test_u5_c_trace_details
$env:PYTHONPATH='src'; python -m unittest tests.ingest.test_opencode_loop
$env:PYTHONPATH='src'; python -m unittest tests.evals.test_artifact_acceptance tests.tracing.test_artifact_layout
python -m compileall scripts src tests
```

```powershell
npm test -- --run
npm run typecheck
npm run build
```

Run the npm commands from `ui/`.

## W7-F Handoff Notes

W7-F usefulness review can inspect this slice for:

- whether OpenCode-backed loops are browseable from generated rows
- whether packet/order, selected output, approval, and review synthesis evidence is easier to inspect
- whether UI wording avoids false controller or task-success claims
- whether malformed W7 sidecars degrade without hiding canonical run/trace evidence
