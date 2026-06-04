# Wave7 W7-B2 TrackD Router Selected-Output Reader v1

## Status

Track D implementation note for `W7-B2`.

Acceptance state: `accepted_after_meta_review_fix`

Execution mode: `opencode_assisted`

Scope verdict: `adapter_reader_only`

## Scope

This Track D slice implements a provisional, fixture-compatible, read-only selected-output reader under adapter ownership.

In scope:

- `src/fractal_agent_lab/adapters/opencode_router_sources.py`
- `tests/adapters/test_opencode_router_sources.py`
- this delivery note

Out of scope:

- `src/fractal_agent_lab/ingest/**`
- canonical artifact writer behavior
- CLI commands
- sidecar writing
- trace writing
- `.opencode-router/**` mutation
- `.opencode/**` mutation
- `data/**` writes
- OpenCode API/session control
- browser execution
- commit/push automation

## Implemented Direction

Track D now exposes a minimal selected-output adapter contract:

- JSON-first selected-output fixture support
- optional markdown fallback as warning-grade bounded excerpt only
- machine-readable warning codes
- path/root validation for local source reads
- explicit omission of thought/reasoning-like fields

The output is an adapter-level extract shape for downstream Track B consumption. It is not a canonical artifact schema.

## Provisional Input Contract

Required JSON fields:

- `stage`
- `source_kind`
- `summary`

Allowed `source_kind` values in JSON:

- `router_selected_output`
- `selected_output_file`

Optional JSON fields:

- `source_session`
- `message_id`
- `decision`
- `selected_text`
- `artifact_refs`
- `metadata`

## Adapter Output Contract

The reader returns a normalized extract with these fields:

- `stage`
- `source_kind`
- `source_path`
- `source_session`
- `message_id`
- `decision`
- `summary`
- `selected_text_excerpt`
- `excerpt_truncated`
- `artifact_refs`
- `warnings`

Important boundaries:

- `source_path` is audit-only
- `artifact_refs` are audit-only and not canonical guarantees
- no raw body field is exposed
- no approval, clean-pass, commit-readiness, or review-success claim is produced

## Warning Codes

- `artifact_refs_audit_only`
- `excerpt_truncated`
- `markdown_fallback_warning_grade`
- `missing_optional_metadata`
- `thought_or_reasoning_omitted`

## Privacy / Safety Rules

- default bounded excerpt max remains `4000`
- no thought/reasoning propagation
- markdown fallback remains warning-grade only
- no writes to router state or FAL canonical artifact paths

## Verification

Targeted tests cover:

- valid JSON normalization
- missing required field failure
- invalid JSON failure
- root-escape failure
- thought/reasoning omission
- markdown fallback warning behavior
- no-write side-effect proof
- non-int and bool `excerpt_max_chars` rejection through `OpenCodeRouterSourceError`

## Downstream Handoff

Track B may consume the normalized extract shape later from adapter-owned code, but Track B remains owner of:

- canonical artifact writer
- validators
- run/trace/artifact shape
- `output_payload.step_results`
- `opencode_loop_summary.json`

This Track D slice does not authorize broader ingest, controller, router mutation, or session delivery work.
