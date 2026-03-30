# Wave0-F0-M-Artifact-Contract.md

## Purpose

This document defines the Wave 0 `F0-M` Track B artifact write path and artifact shapes.

Scope is limited to first stored run and trace artifacts for downstream Track E smoke/replay consumption.

---

## Ownership

- Epic: `F0-M`
- Co-owned execution assignment: `Track B -> Track E`
- This document covers the Track B implementation side.

---

## Implemented Paths

Configured base directory comes from runtime config (`paths.data_dir`, default: `data`).

Wave 0 artifact paths:

- run artifact: `data/runs/<run_id>.json`
- trace artifact: `data/traces/<run_id>.jsonl`

Implemented writer module:

- `src/fractal_agent_lab/tracing/artifact_writer.py`

CLI integration point:

- `src/fractal_agent_lab/cli/app.py`

---

## Canonical Run Artifact Shape (`.json`)

Serialized from canonical `RunState`.

Core keys include:

- `run_id`
- `workflow_id`
- `status`
- `input_payload`
- `output_payload`
- `step_results`
- `errors`
- `context`
- `trace_event_ids`
- `created_at`
- `started_at`
- `completed_at`
- `schema_version`

Serialization rules:

- datetimes are ISO-8601 strings
- enums are serialized as their `.value`
- output is ASCII-safe JSON (`ensure_ascii=True`)

---

## Canonical Trace Artifact Shape (`.jsonl`)

One JSON object per line, each line representing a canonical `TraceEvent`.

Core keys per event include:

- `event_id`
- `run_id`
- `sequence`
- `event_type`
- `timestamp`
- `source`
- `step_id`
- `parent_event_id`
- `correlation_id`
- `payload`
- `schema_version`

Serialization rules:

- event order is preserved from in-memory emitter order
- datetimes and enums use the same normalization as run artifacts
- file is newline-delimited JSON for replay/smoke friendliness

---

## Runtime Behavior in Wave 0

- Artifact writing is executed after every CLI run completion (success or failure).
- Artifact write failures do not corrupt run execution result; CLI emits warning to stderr.
- This keeps `F0-M` resilient while still preserving the main run lifecycle contract.

---

## Validation Performed

- `python -m compileall src`
- CLI run smoke with mock provider:
  - generated `data/runs/<run_id>.json`
  - generated `data/traces/<run_id>.jsonl`

Observed result:

- artifact files are created and readable
- run and trace content aligns with Track B canonical schemas

---

## Downstream Handoff (Track E)

Track E can now:

- consume stored trace events from `data/traces/*.jsonl`
- consume stored run envelopes from `data/runs/*.json`
- define replay/smoke acceptance checks on explicit artifact shapes

Track E should next record:

- replay-read assumptions
- required invariants for acceptance (sequence ordering, required fields, failure coverage)

Track E validation handoff document:

- `docs/wave0/Wave0-F0-M-Artifact-Validation.md`
