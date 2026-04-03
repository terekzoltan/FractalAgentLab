# Wave2-W2-S2-TrackC-H2-N.md

## Purpose

This document records Track C implementation for Wave 2 Sprint `W2-S2` epic `H2-N`:

- Identity signal convention + post-run updater v0

The implementation follows strict scope guardrails:

- no `RunState` / `TraceEvent` / `AgentSpec` / `WorkflowSpec` schema churn
- no executor hook or runtime branching changes
- no drift monitor, no routing, no prompt rewrite
- no eval-layer coupling

---

## Scope

In scope:

- explicit identity signal envelope normalizer (`identity.signal.v0`)
- documented derived fallback signals from existing runtime artifacts
- bounded post-run identity updater
- profile load/create -> update -> save
- snapshot append
- per-run sidecar `data/artifacts/<run_id>/identity_update.json`
- CLI post-run integration behind `runtime_config.identity.enabled`
- explicit non-fatal error boundary for updater failures

Out of scope:

- explicit producer rollout as completion requirement
- drift classification (`H2-O`)
- identity-informed routing
- core runtime contract changes

---

## Implemented Files

### New

- `src/fractal_agent_lab/identity/updater/signal_rules.py`
- `src/fractal_agent_lab/identity/updater/identity_update.py`
- `tests/identity/test_identity_updater.py`

### Updated

- `src/fractal_agent_lab/identity/updater/__init__.py`
- `src/fractal_agent_lab/identity/__init__.py`
- `src/fractal_agent_lab/cli/app.py`

---

## Signal Convention and Fallback

Primary explicit carrier consumed:

- `run_state.step_results[step_id]["output"]["identity_signals"]`

Supported normalized fields (`identity.signal.v0`):

- `coherence_score` (float, clamped to `[0,1]`)
- `confidence` (float, clamped to `[0,1]`)
- `needed_revision` (bool)
- `delegated` (bool)
- `self_correction_used` (bool)

Derived fallback (documented, bounded):

- retry evidence from `trace_event.step_completed.payload.attempts > 1` -> `needed_revision=true`
- manager/handoff delegation evidence from orchestration payload -> `delegated=true`
- failed/timed_out runs -> `needed_revision=true` for executed agents

Precedence rule:

- explicit normalized signals override fallback values for the same agent/field

---

## Post-run Updater Behavior

Updater integration point:

- CLI post-run service call in `src/fractal_agent_lab/cli/app.py`

Execution gate:

- enabled only when `runtime_config.identity.enabled` is true

Store backend:

- currently `json` only (`identity.store_backend`)

Update semantics:

- small bounded updates only
- profile fields remain clamped in `[0,1]`
- `profile_version` increments by one per updated agent
- `update_count`, `last_updated_at`, `last_run_id` update together

Persistence:

- profile persisted via `JSONIdentityStore.save_profile`
- snapshot appended via `JSONIdentityStore.save_snapshot`
- sidecar report written to `data/artifacts/<run_id>/identity_update.json`

---

## Failure Safety

`H2-N` updater execution is best-effort and non-fatal.

CLI now has a dedicated updater error boundary for non-filesystem failures such as:

- malformed signal envelope
- invalid profile payloads
- identity-store parse/load errors

Updater failures log warning to stderr and do not convert successful runs into failed runs.

---

## Validation

Executed:

1. `PYTHONPATH=src python -m unittest tests.identity.test_identity_updater tests.identity.test_identity_models tests.identity.test_json_store`
2. `PYTHONPATH=src python -m unittest tests.memory.test_session_memory tests.cli.test_l1_e_h1_summary tests.adapters.test_h1_manager_step_runner`
3. `PYTHONPATH=src python -m unittest tests.cli.test_l1_j_trace_viewer tests.agents.test_h1_pack`

Observed:

- explicit signal extraction works
- malformed explicit payloads are ignored safely
- explicit-over-fallback precedence holds
- bounded clamp/update fields are correct
- snapshot append and sidecar output are produced
- CLI run remains successful when updater raises (non-fatal boundary)

---

## Downstream Handoff

- Track B can now run `H2-N` boundary review (`W2-S3`) against implemented updater surfaces without core schema churn.
- Track E can consume updater outputs for future drift sanity checks (`H2-O`) after boundary review.
