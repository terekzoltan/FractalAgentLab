# Wave2-W2-S3-TrackE-H2-L-H2-O.md

## Purpose

This document records Track E implementation for Wave 2 Sprint `W2-S3` Step 2:

- `H2-L` evaluate whether session memory helps H1 materially
- `H2-O` identity drift smoke checks v0

Both epics are implemented as bounded eval-layer work.

---

## Scope Guardrails

`H2-L`:

- fresh-run eval is allowed and required
- manager variant is mandatory; single/handoff are additive
- eval uses canonical session-memory load path (`load_session_memory_context`)
- eval restores any pre-existing session-store state after each pair run
- structural pass/fail is separated from materiality signal
- observed output deltas are reported as evidence, not quality-proof claims
- no automatic merge from `memory_candidates.json` into canonical session memory

`H2-O`:

- run-id-first identity drift smoke over updater outputs
- requested runs must surface real updater evidence; missing sidecars fail smoke
- sidecar payload binding must match the requested run (`run_id`, and `workflow_id` when canonical run is present)
- updated agents must resolve through the configured identity store subdir
- coarse deterministic drift classification only
- orphan updater behavior remains warning-grade (non-fatal by itself)
- no identity routing / prompt rewriting / schema churn

Out of scope:

- deterministic rerun guarantees
- quality winner selection
- canonical runtime/schema contract changes

---

## Implemented Files

New eval modules:

- `src/fractal_agent_lab/evals/h1_memory_materiality.py`
- `src/fractal_agent_lab/evals/identity_drift_smoke.py`

New scripts:

- `scripts/run_h2_l_h1_memory_materiality.py`
- `scripts/run_h2_o_identity_drift_smoke.py`

New tests:

- `tests/evals/test_h1_memory_materiality.py`
- `tests/evals/test_identity_drift_smoke.py`

Updated exports:

- `src/fractal_agent_lab/evals/__init__.py`

---

## H2-L Report Shape

`run_h2_l_h1_memory_materiality(...)` returns:

- `report_version`
- `created_at`
- `evaluation_scope`
- `input_payload`
- `memory_seed_summary`
- `pairs[]`
- `summary`
- `known_limits`

Critical summary split:

- `structural_ready`
- `materiality_signal`
- `recommendation`

Current materiality labels are intentionally conservative:

- `difference_observed`
- `no_difference_observed`
- `not_structurally_ready`

This preserves anti-false-green discipline while avoiding overclaim on mock-backed materiality outcomes.

---

## H2-O Report Shape

`run_h2_o_identity_drift_smoke(...)` returns:

- `report_version`
- `created_at`
- `run_scope`
- `runs[]`
- `agents[]`
- `summary`
- `known_limits`

Critical summary fields:

- `all_updates_parseable`
- `all_profiles_parseable`
- `all_snapshots_parseable`
- `all_runs_have_update_sidecar`
- `all_runs_have_update_evidence`
- `all_sidecars_match_requested_runs`
- `has_update_evidence`
- `all_updated_agents_have_profiles`
- `all_updated_agents_have_snapshots`
- `all_present_canonical_artifacts_valid`
- `all_deltas_bounded`
- `no_runaway_drift`
- `orphan_updates_detected`
- `drift_smoke_passed`

Orphan updater sidecar presence is warning-grade context and does not fail smoke by itself.

---

## Validation

Executed checks:

1. `PYTHONPATH=src python -m unittest tests.evals.test_h1_memory_materiality tests.evals.test_identity_drift_smoke`
2. `PYTHONPATH=src python -m unittest tests.identity.test_identity_updater tests.memory.test_session_memory tests.memory.test_candidate_extraction`

Observed:

- H2-L validates canonical seeded-session load path, restores pre-existing session-store state, and keeps structural vs materiality semantics separate.
- H2-O validates bounded identity-drift smoke, requires real updater evidence, supports configured identity-store subdirs, and preserves Track B accepted orphan-warning behavior.

---

## Downstream Handoff

- `H2-L` and `H2-O` provide the W2-S3 validation lane evidence required before Wave 2 closeout decisions.
- Follow-up tightening should remain bounded and evidence-led, without promoting eval-local semantics into runtime contract law by default.
