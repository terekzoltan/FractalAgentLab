# Coding-Vertical-Artifact-Contract-v01.md

## Purpose

This document defines the intended artifact contract for the Software Delivery Loop.

The central rule is:

> if a coding-vertical run cannot be inspected afterward, it is incomplete

---

## Canonical artifact boundary

The coding vertical must not replace the current canonical artifact surfaces.

Canonical repo truth remains:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

Coding artifacts should extend that truth as sidecars or referenced attachments, not as a rival system.

Recommended local sidecar path later:

- `data/coding/<run_id>/...`

This stays compatible with the existing ignored `data/` policy.

---

## H4 artifact set

### `context_report.json`

Minimum fields:
- `repo_summary`
- `changed_surfaces`
- `relevant_docs`
- `relevant_code_areas`
- `assumptions`
- `unknowns`
- `recent_change_notes`

### `implementation_plan.md`

Minimum sections:
- task summary
- intent
- affected surfaces
- likely touched files
- step order
- dependencies
- test plan
- documentation obligations
- risks
- open questions

### `risk_register.json`

Minimum fields:
- `items[]`
  - `id`
  - `title`
  - `severity`
  - `type`
  - `description`
  - `mitigation`
  - `owner`

### `acceptance_checks.json`

Minimum fields:
- `functional_checks[]`
- `tests_required[]`
- `docs_required[]`
- `non_goals[]`
- `blocking_conditions[]`

---

## H5 artifact set

### `implementation_report.md`

Minimum sections:
- requested work summary
- execution summary
- touched files
- deviations from plan
- test actions performed
- unresolved issues
- follow-up notes

### `review_findings.json`

Minimum fields:
- `status`
- `findings[]`
  - `severity`
  - `category`
  - `title`
  - `description`
  - `file`
  - `line_ref` (best effort)
  - `why_it_matters`
  - `suggested_fix`
- `residual_risks[]`
- `testing_gaps[]`

### `test_evidence.json`

Minimum fields:
- `commands[]`
- `results[]`
- `passed`
- `failed`
- `not_run`
- `notes`

### `commit_gate.json`

Minimum fields:
- `status` (`pass`, `pass_with_warnings`, `hold`)
- `decision_summary`
- `blockers[]`
- `warnings[]`
- `required_actions[]`
- `plan_adherence_summary`
- `artifact_completeness`
- `review_confidence`

### `commit_manifest.json` (optional)

Allowed only when the gate is not `hold`.

Minimum fields:
- `recommended_commit_title`
- `recommended_commit_body`
- `scope_notes`
- `included_artifacts`
- `followup_recommendations`

---

## Versioning fields

Every structured coding artifact should later include when practical:

- `artifact_version`
- `generated_at`
- `workflow_id`
- `run_id`

---

## Validation rules

A coding-vertical run should be considered invalid if:

- `H4` claims planning but `implementation_plan.md` is missing
- `H5` claims review/gating but `review_findings.json` is missing
- `H5` claims review/gating but `commit_gate.json` is missing
- code changed and no test evidence or explicit reason exists
- coding artifacts materially contradict the canonical run/trace truth
- the artifact set hides uncertainty that the trace or review evidence clearly shows

---

## Public/private rule

Sample artifact shapes may later be public.
Realistic artifacts with strong heuristics, real repo structure, or sensitive failure evidence should remain private by default.

---

## Current stance

This contract is design-first.
It becomes executable later through `CV1` and `CV2`.

Until then, it serves as the intended memory surface for the future coding vertical.
