# Wave2-W2-S2-TrackC-H2-M.md

## Purpose

This document records Track C implementation for Wave 2 Sprint `W2-S2` epic `H2-M`:

- Identity profile model v0 (`IdentityProfile` + `IdentitySnapshot` + JSON store)

The implementation follows strict scope discipline:

- no identity updater logic (`H2-N`)
- no drift logic (`H2-O`)
- no routing semantics
- no Track B runtime/schema churn

---

## Scope

In scope:

- `IdentityProfile` model with bounded dimension validation/clamping
- `IdentitySnapshot` model for run-linked profile capture
- JSON-backed identity store for profile and snapshot persistence
- package exports and tests for model/store behavior

Out of scope:

- session memory loading/extraction (`H2-I`/`H2-K`)
- identity signal updater pipeline (`H2-N`)
- drift monitoring (`H2-O`)
- executor, `RunState`, or `TraceEvent` schema changes

---

## Implemented Files

### New

- `src/fractal_agent_lab/identity/models/identity_profile.py`
- `src/fractal_agent_lab/identity/models/identity_snapshot.py`
- `src/fractal_agent_lab/identity/store/json_store.py`
- `tests/identity/__init__.py`
- `tests/identity/test_identity_models.py`
- `tests/identity/test_json_store.py`

### Updated

- `src/fractal_agent_lab/identity/__init__.py`
- `src/fractal_agent_lab/identity/models/__init__.py`
- `src/fractal_agent_lab/identity/store/__init__.py`

---

## Model Contract (`H2-M`)

`IdentityProfile` v0 fields:

- `agent_id`
- `profile_version`
- `vector_version`
- `baseline_ref`
- `caution`
- `initiative`
- `delegation`
- `coherence`
- `reflectiveness`
- `update_count`
- `last_updated_at`
- `last_run_id`
- `metadata`

Behavioral dimensions are normalized to `[0.0, 1.0]` and `update_count` remains non-negative.

`IdentitySnapshot` v0 fields:

- `agent_id`
- `profile`
- `captured_at`
- `run_id`
- `reason`
- `schema_version` (`identity.snapshot.v0`)

Snapshot profile ownership is enforced (`snapshot.agent_id == profile.agent_id`).

---

## JSON Store Contract

`JSONIdentityStore` default storage root:

- `data/identity/`

Profile storage:

- `data/identity/<agent_id>.json`

Snapshot storage:

- `data/identity/snapshots/<agent_id>.jsonl`

Notes:

- this store is Track C-owned identity persistence
- it does not replace canonical run/trace artifacts
- per-run sidecar usage (`data/artifacts/<run_id>/...`) remains optional and outside this epic

---

## Validation

Executed:

1. `PYTHONPATH=src python -m unittest tests.identity.test_identity_models tests.identity.test_json_store`
2. `python -m compileall src tests`

Observed:

- identity model/store tests pass (roundtrip + negative-path checks)
- project compile pass succeeds with new identity package code

---

## Downstream Impact

- `H2-N` can build identity updater logic on top of stable `IdentityProfile` / `IdentitySnapshot` / store primitives.
- `H2-O` can later consume snapshots for drift sanity checks.
- runtime boundaries remain unchanged and Track B contract ownership is preserved.
