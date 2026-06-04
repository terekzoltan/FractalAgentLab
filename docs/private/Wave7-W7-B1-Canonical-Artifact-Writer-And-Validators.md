# Wave7 W7-B1 Canonical Artifact Writer And Validators

## Status

Track B delivery note for `W7-B1`.

Acceptance state: `accepted_after_meta_review_fix`

Execution mode: `opencode_assisted`

Scope verdict: `track_b_canonical_artifact_writer_and_validators_only`

## Delivered Scope

Track B delivered a normalized-input-only canonical artifact writer for W7 OpenCode-backed loops:

- `fractal_agent_lab.ingest` package export surface
- `write_w7_opencode_loop_artifacts(...)`
- path-safe validation for W7 IDs and refs using W6 precedent
- canonical run/trace writing through existing `RunState` / `TraceEvent` / artifact writer surfaces
- required W7 sidecar writing with `w7.*.v1` schema labels
- writer-derived `clean_pass_eligible`
- recursive fail-loud rejection of forbidden raw/reasoning fields
- narrow `step_results[*].raw` whitelist for `source_kind` and `provider` only
- fail-loud `overwrite=False` MVP behavior
- targeted tests for path safety, false-green prevention, privacy rejection, sidecar schema versions, terminal artifact refs, and artifact acceptance compatibility

## Key Contract Decisions

- W7-B1 consumes normalized mappings only; it does not read `.opencode-router/**`.
- `run_id` is caller-provided and required in MVP.
- W7-B1 does not generate `run_id` values.
- W7-B1 does not support overwrite in MVP; existing targets fail loudly.
- `run_state.v1.status=succeeded` means ingest/normalization success only.
- W7 trace output uses existing `trace_event.v1` event kinds with W7 payload markers.
- `clean_pass_eligible` is writer-derived, not caller-trusted.
- Forbidden raw/reasoning keys reject the whole normalized input with `W7OpenCodeLoopIngestError`; W7-B1 does not silently strip ambiguous input.
- The explicit forbidden key set is `reasoning`, `reasoning_text`, `thought`, `thoughts`, `chain_of_thought`, `cot`, `transcript`, `raw_transcript`, `raw_body`, and `body`.
- `step_results[*].raw` is allowed only for `source_kind` and `provider`; any other `raw` key rejects the input.
- Clean-pass eligibility requires at least one approval checkpoint with `approved is True`.
- Clean-pass eligibility requires all packet ledger entries to have `validation_state == "ok"`.
- Any writer warnings still block clean-pass eligibility.
- The terminal trace event references the concrete emitted `artifacts/<run_id>/opencode_loop_summary.json` sidecar.

## Out Of Scope

- router selected-output reading
- `.opencode-router/**` access
- CLI UX
- browser execution
- OpenCode API/session control
- commit/push automation
- public export
- `artifact_acceptance.py` changes

## Validation

Primary proof points:

- generated run/trace artifacts pass existing artifact acceptance
- sidecars carry `w7.*.v1` schema versions
- unsafe IDs are rejected before writes
- green outcomes without approval/review synthesis are rejected
- body retention remains disallowed in MVP
- forbidden raw/reasoning fields are rejected recursively before writes
- all-false approval checkpoints block green clean-pass
- packet ledger `warning` or `invalid` entries block green clean-pass
- terminal trace artifact ref resolves to the emitted summary sidecar

## Known MVP Limitations / Routed To W7-C1

- W7-B1 still writes multiple artifacts without a transaction/staging directory. If a later write fails after earlier writes succeeded, partial output can remain.
- This partial-write atomicity limitation is intentionally documented for MVP and routed to W7-C1 validation/privacy sufficiency review rather than expanded in W7-B1.

## Downstream Handoff

- Track D `W7-B2` remains responsible for adapter-owned selected-output normalization.
- Track A `W7-B3` may start after W7-B1 and W7-B2 closeout acceptance.
- Track E `W7-C1` should validate privacy/path-safety/false-green cases after W7-B1 and W7-B2 implementation.
