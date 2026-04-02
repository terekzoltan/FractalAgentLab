# Coding-Vertical-Artifact-Contract-v01.md

**Contract status:** canonical (finalized 2026-04-01 via CV0-A)

## Purpose

This document defines the canonical artifact contract for the Software Delivery Loop.

The central rule is:

> if a coding-vertical run cannot be inspected afterward, it is incomplete

---

## Canonical artifact boundary

The coding vertical must not replace the current canonical artifact surfaces.

Canonical repo truth remains:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`

Coding artifacts extend that truth as sidecars, not as a rival system.

### Canonical sidecar path

```
data/artifacts/<run_id>/
├── context_report.json       # H4
├── implementation_plan.md    # H4
├── risk_register.json        # H4
├── acceptance_checks.json    # H4
├── implementation_report.md  # H5
├── review_findings.json      # H5
├── test_evidence.json        # H5
├── commit_gate.json          # H5
└── commit_manifest.json      # H5 (optional)
```

This path is canonical and stays compatible with the existing ignored `data/` policy.
Coding-vertical artifacts reserve filenames inside the shared per-run sidecar directory instead of defining a parallel root.

### Run/trace correlation rule

Every coding-vertical artifact set must be traceable to a canonical run:

1. The sidecar directory name **must** match a valid `run_id` from `data/runs/`
2. Every structured JSON artifact **must** include the `run_id` field in its envelope
3. If the canonical run artifact (`data/runs/<run_id>.json`) does not exist, the coding artifacts are orphaned and invalid
4. Coding artifacts may reference trace events via `correlation_id` or `event_id` when linking to specific execution moments

### Artifact envelope rule

Every structured coding artifact (JSON) must include this envelope:

```json
{
  "artifact_type": "<artifact_name>",
  "artifact_version": "1.0",
  "run_id": "<run_id>",
  "workflow_id": "<h4|h5>",
  "generated_at": "<ISO8601 timestamp>",
  ...artifact-specific fields...
}
```

Markdown artifacts (`implementation_plan.md`, `implementation_report.md`) should include a YAML frontmatter block with the same fields when practical.

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

Every structured coding artifact must include in its envelope:

- `artifact_type` — the artifact name (e.g., `context_report`, `commit_gate`)
- `artifact_version` — semantic version of the artifact schema (start with `1.0`)
- `run_id` — the canonical run this artifact belongs to
- `workflow_id` — `h4` or `h5`
- `generated_at` — ISO8601 timestamp

These fields are mandatory for all JSON artifacts.
For markdown artifacts, include them in YAML frontmatter when practical.

---

## Validation rules

A coding-vertical run should be considered invalid if:

- `H4` claims planning but `implementation_plan.md` is missing
- `H5` claims review/gating but `review_findings.json` is missing
- `H5` claims review/gating but `commit_gate.json` is missing
- code changed and no test evidence or explicit reason exists
- coding artifacts materially contradict the canonical run/trace truth
- the artifact set hides uncertainty that the trace or review evidence clearly shows
- the `run_id` in the artifact envelope does not match a valid canonical run
- required envelope fields are missing from JSON artifacts

---

## Public/private rule

Sample artifact shapes may later be public.
Realistic artifacts with strong heuristics, real repo structure, or sensitive failure evidence should remain private by default.

---

## Current stance

This contract is **canonical** as of CV0-A (2026-04-01).

It becomes executable through `CV1` and `CV2`.
Until then, it serves as the binding specification for the future coding vertical.

Changes to this contract require Meta Coordinator review and explicit versioning.
