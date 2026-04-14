# Wave3-W3-S3-R3-I-Project-Memory-v1.md

## Purpose

This document records Track C delivery for Wave 3 Sprint `W3-S3` Step 1 epic `R3-I`.

`R3-I` introduces project memory v1 (`M2`) as a durable, low-noise memory layer for stable decisions and workflow learnings.

---

## Scope

In scope:

- project-memory model and canonical JSON store
- additive project-memory context loading by `input_payload.project_id`
- bounded post-run project-memory updater for successful H2/H3 manager runs
- explicit merge/dedupe policy for anti-noise memory growth
- non-canonical per-run updater sidecar report

Out of scope:

- runtime/core schema changes
- prompt-layer durable memory writes
- sidecar-as-canonical merge behavior
- evaluator activation for H3
- H1 durable project-memory extraction

---

## Implemented Files

New:

- `src/fractal_agent_lab/memory/project_memory.py`
- `src/fractal_agent_lab/memory/project_context.py`
- `src/fractal_agent_lab/memory/project_update.py`
- `tests/memory/test_project_memory.py`
- `tests/memory/test_project_update.py`

Updated:

- `src/fractal_agent_lab/memory/json_store.py`
- `src/fractal_agent_lab/memory/__init__.py`
- `src/fractal_agent_lab/cli/app.py`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## M2 Project Memory Contract v1

Canonical durable store:

- `data/memory/projects/<project_id>.json`

Canonical model:

- schema version: `project_memory.v1`
- root keys:
  - `project_id`
  - `stable_decisions`
  - `workflow_learnings`
  - `prompt_observations`
  - `updated_at`

`prompt_observations` exists as a model surface but is not auto-inferred in this first slice.

---

## Extraction Policy v1

Project-memory update runs only when all gates hold:

- run status is `succeeded`
- explicit `project_id` exists (`input_payload.project_id` or loaded context)
- workflow is supported (`h2.manager.v1` or `h3.manager.v1`)

H2 extraction:

- `recommended_starting_slice` -> `stable_decision`
- `risk_zones[]` -> `workflow_learning`

H3 extraction:

- `strengths[]` -> `workflow_learning`
- `bottlenecks[]` -> `workflow_learning`
- `merge_risks[]` -> `workflow_learning`
- `refactor_ideas[]` -> `workflow_learning`

H1 remains outside M2 durable extraction scope in this version.

---

## Merge / Dedupe Law (Anti-Noise Core)

Dedupe key is explicit and deterministic:

- `workflow_id`
- `entry_type`
- `entry_subtype`
- normalized `content` (trimmed whitespace, collapsed spacing, case-insensitive)

Merge behavior:

- no match -> append entry (`created_count`)
- matched content seen in a new run -> increment `times_observed`, update `last_seen_run_id` and `last_updated_at` (`updated_count`)
- matched content from same run -> skip duplicate increment (`skipped_count`)

This keeps M2 memory additive but bounded, avoiding dump-everything growth.

---

## Canonical vs Non-Canonical Surfaces

Canonical truth:

- `data/memory/projects/<project_id>.json`

Non-canonical evidence/report surfaces:

- `data/artifacts/<run_id>/project_memory_update.json`
- `data/artifacts/<run_id>/memory_candidates.json`

Hard rule in `R3-I`:

- canonical project-memory merge does not consume sidecar artifacts as source truth.

---

## CLI Boundary Behavior

Run context now merges:

- session-memory context (`M1`)
- project-memory context (`M2`)

Post-run update behavior:

- project-memory updater runs as best-effort post-run service
- updater failure is warning-grade and non-fatal
- successful run is not converted to failed run by updater errors

This mirrors the accepted non-fatal updater boundary used by identity update flow.

---

## Validation

Executed:

1. `PYTHONPATH=src python -m unittest tests.memory.test_project_memory tests.memory.test_project_update`
2. `PYTHONPATH=src python -m unittest tests.memory.test_session_memory tests.memory.test_candidate_extraction`
3. `PYTHONPATH=src python -m unittest tests.evals.test_h1_memory_materiality`
4. `PYTHONPATH=src python -m unittest tests.adapters.test_h2_manager_step_runner tests.adapters.test_h3_manager_step_runner`
5. `python -m compileall src tests`

Observed:

- project-memory model/store/context/update flows pass with negative-path coverage
- existing M1/session-memory and H2-K extraction behavior remains stable
- H2/H3 adapter paths remain green with no template-law drift

---

## Downstream Handoff

- Track E `R3-K` and Track A `R3-J` can consume runs where M2 context/update surfaces now exist.
- `R3-L` evidence curation can include project-memory-aware runs without requiring runtime/schema expansion.
