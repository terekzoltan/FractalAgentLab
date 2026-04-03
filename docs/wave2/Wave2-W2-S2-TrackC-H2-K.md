# Wave2-W2-S2-TrackC-H2-K.md

## Purpose

This document records Track C implementation for Wave 2 Sprint `W2-S2` epic `H2-K`:

- memory candidate extraction policy v1

The implementation follows strict scope discipline:

- success-only extraction
- session-tagged only extraction
- H1-only first pass
- deterministic rule-based extraction
- optional non-canonical sidecar output only
- no canonical session-memory store mutation

---

## Scope

In scope:

- deterministic memory candidate extraction from successful H1 runs
- extraction gated by `session_id` (session-tagged runs only)
- support for `h1.manager.v1`, `h1.handoff.v1`, `h1.single.v1`
- per-run sidecar artifact at `data/artifacts/<run_id>/memory_candidates.json`

Out of scope:

- canonical session-memory writes/merge/dedup policy
- memory usefulness evaluation (`H2-L`)
- identity signal/update behavior (`H2-N`)
- runtime/core schema changes

---

## Implemented Files

### New

- `src/fractal_agent_lab/memory/candidate_extraction.py`
- `tests/memory/test_candidate_extraction.py`

### Updated

- `src/fractal_agent_lab/memory/__init__.py`
- `src/fractal_agent_lab/cli/app.py`

### Coordination updates

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## Policy Shape (v1)

Eligibility:

- run status must be `succeeded`
- workflow must be H1 variant (`manager`/`handoff`/`single`)
- session id must exist (`context.session_id` or `input_payload.session_id`)

Extraction sources:

- manager/handoff: `output_payload.final_output`
- single: `output_payload.step_results.single.output`

Candidate classes:

- `decision`
- `risk`
- `next_step`

Candidate metadata includes:

- `schema_version`
- `run_id`
- `workflow_id`
- `session_id`
- `candidate_type`
- `content`
- `reason`
- `source_path`
- `confidence`

---

## Sidecar Artifact Contract

When a run is eligible, H2-K writes:

- `data/artifacts/<run_id>/memory_candidates.json`

Artifact fields:

- `artifact_type` = `memory_candidates`
- `artifact_version` = `1.0`
- `candidate_schema_version` = `memory.candidate.v1`
- `run_id`, `workflow_id`, `generated_at`, `session_id`
- `candidate_count`
- `candidates`

Important:

- this artifact is non-canonical evidence
- canonical session-memory truth remains under `data/memory/sessions/<session_id>.json`

---

## Validation

Executed:

1. `PYTHONPATH=src python -m unittest tests.memory.test_candidate_extraction tests.memory.test_session_memory tests.agents.test_h1_pack`
2. `PYTHONPATH=src python -m unittest tests.cli.test_l1_e_h1_summary tests.cli.test_l1_j_trace_viewer tests.adapters.test_h1_manager_step_runner`

Observed:

- H2-K extraction gates work (`no session_id`, `failed`, `timed_out` -> no candidates)
- manager/handoff/single extraction paths are covered
- sidecar writing works and remains non-canonical
- canonical session-memory JSON remains unchanged during extraction
- no regressions in tested manager/CLI paths

---

## Downstream Handoff

- `H2-L` can evaluate whether extracted candidate policy materially helps H1.
- `H2-N` can proceed independently as identity updater work on top of H2-M foundations.
