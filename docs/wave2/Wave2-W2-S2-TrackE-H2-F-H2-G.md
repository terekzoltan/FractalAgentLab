# Wave2-W2-S2-TrackE-H2-F-H2-G.md

## Purpose

This document records Track E delivery for Wave 2 Sprint `W2-S2` epics `H2-F` and `H2-G`.

- `H2-F` delivers replay-backed stored-artifact smoke gates for H1.
- `H2-G` delivers additive baseline/provenance comparison tagging for H1 run sets.

---

## Scope Guardrails

`H2-F` scope:

- H1-only stored-artifact smoke by run ID
- mandatory `artifact_acceptance` + `artifact_replay`
- no fresh execution path by default
- fail-loud structural checks for invalid/incomplete variants
- preserve comparable completeness discipline (not envelope-only)

`H2-G` scope:

- thin additive baseline/provenance tagging
- no quality scoring or winner selection
- no prompt-tag scoring
- no canonical run/trace schema mutation

Out of scope:

- deterministic rerun
- same-input rerun/compare
- sidecar requirements
- replay engine redesign

---

## Implemented Files

Shared Track E-local contracts/projections:

- `src/fractal_agent_lab/evals/h1_eval_contracts.py`
- `src/fractal_agent_lab/evals/h1_eval_projections.py`

Shared replay-backed H1 set loader:

- `src/fractal_agent_lab/evals/h1_artifact_set.py`

`H2-F`:

- `src/fractal_agent_lab/evals/h1_smoke_suite.py`
- `scripts/run_h2_f_h1_smoke_suite.py`
- `tests/evals/test_h1_smoke_suite.py`

`H2-G`:

- `src/fractal_agent_lab/evals/h1_baseline_tags.py`
- `scripts/run_h2_g_h1_baseline_tags.py`
- `tests/evals/test_h1_baseline_tags.py`

Adjusted surfaces:

- `src/fractal_agent_lab/evals/artifact_replay.py` (adds H1 projection block)
- `src/fractal_agent_lab/evals/h1_smoke_comparison.py` (uses shared eval contracts/projections)
- `src/fractal_agent_lab/evals/__init__.py`

Status surfaces updated:

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/AGENTS.md`

---

## H2-F Smoke Report Shape

`run_h1_smoke_suite_by_run_ids(...)` returns:

- `report_version`
- `created_at`
- `variants[]` with per-variant:
  - expected/observed workflow id
  - run id + artifact paths
  - artifact validation
  - replay readiness
  - comparable output completeness
  - orchestration/linkage/failure summaries
  - explicit smoke checks
- `summary` with:
  - `all_required_variants_present`
  - `all_workflow_matches_expected`
  - `all_artifacts_valid`
  - `all_replay_ready`
  - `all_comparable_outputs_complete`
  - `handoff_linkage_preserved`
  - `all_variant_specific_checks_passed`
  - `smoke_passed`

---

## H2-G Tag Report Shape

`capture_h1_baseline_tags_by_run_ids(...)` returns:

- `report_version`
- `created_at`
- `comparison_group_id`
- `comparison_contract`
- `baseline_posture`
- `variants[]` with per-variant:
  - `workflow_id`
  - `run_id`
  - `comparison_role`
  - workflow metadata
  - artifact paths
  - replay/validation snapshot
  - `prompt_tags` (provenance only)
- `summary` with:
  - `all_required_variants_present`
  - `all_replay_ready`
  - `all_roles_assigned`
  - `tag_capture_ready`

Canonical comparison posture captured:

- `h1.single.v1` -> `baseline_anchor`
- `h1.manager.v1` -> `default_multi_agent_reference`
- `h1.handoff.v1` -> `reference_variant`

Reference:

- `docs/wave1/Wave1-L1-L-H1-Decision-Log.md`

---

## Validation

Executed checks:

1. `python -m compileall src tests scripts`
2. `PYTHONPATH=src python -m unittest tests.evals.test_artifact_replay tests.evals.test_h1_smoke_suite tests.evals.test_h1_baseline_tags tests.evals.test_h1_smoke_comparison tests.evals.test_h1_evidence_prep`

Observed:

- H2-F passes valid stored-trio smoke and fails loudly on:
  - incomplete comparable outputs
  - missing handoff linkage
- H2-G captures canonical baseline roles and remains additive/provenance-only

---

## Downstream Handoff

- `H2-H` draft is now unblocked from Track E side (`H2-F` + `H2-G` available).
- `H2-L` and `H2-O` can reuse H2-F/H2-G evidence discipline in W2-S3.
