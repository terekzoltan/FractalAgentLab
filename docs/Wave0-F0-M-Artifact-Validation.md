# Wave0-F0-M-Artifact-Validation.md

## Purpose

This document records Wave 0 `F0-M` Track E validation results.

Track B delivered artifact writing. Track E validates whether those artifacts are usable for:

- manual smoke acceptance,
- replay preparation,
- and anti-delusion quality checks.

---

## Ownership and Scope

- Epic: `F0-M`
- Execution assignment: `Track B -> Track E`
- This document covers Track E acceptance validation only.

In scope:

- run artifact (`data/runs/<run_id>.json`) usability validation
- trace artifact (`data/traces/<run_id>.jsonl`) usability validation
- cross-artifact consistency checks
- success and failure path validation

Out of scope:

- deterministic full replay execution
- benchmark scoring
- LLM judge evaluation

---

## Validation Baseline

Validation command used:

```bash
PYTHONPATH=src python scripts/validate_f0_m_artifact_pair.py <run_id>
```

Validation logic location:

- `src/fractal_agent_lab/evals/artifact_acceptance.py`

---

## Evidence Runs

### Success path

- workflow: `h1.lite`
- run id: `2e4bc064-b8dd-4eda-a236-b768e551e59a`
- artifact validation result: `passed=true`

Files:

- `data/runs/2e4bc064-b8dd-4eda-a236-b768e551e59a.json`
- `data/traces/2e4bc064-b8dd-4eda-a236-b768e551e59a.jsonl`

### Failure path

- workflow: `h1.lite`
- forced mode: `--provider openai` (Wave 0 adapter intentionally not wired)
- run id: `64fc725b-581c-414b-b35b-490cd4ffcc98`
- artifact validation result: `passed=true`

Files:

- `data/runs/64fc725b-581c-414b-b35b-490cd4ffcc98.json`
- `data/traces/64fc725b-581c-414b-b35b-490cd4ffcc98.jsonl`

---

## Acceptance Constraints (Track E)

An artifact pair is accepted when all are true:

1. Run artifact exists and parses as JSON object.
2. Trace artifact exists and parses as JSONL object stream.
3. Run artifact has required Wave 0 fields (`run_id`, `workflow_id`, `status`, `schema_version`, lifecycle timestamps, `trace_event_ids`).
4. Trace events have required fields (`event_id`, `run_id`, `event_type`, `sequence`, `timestamp`, `payload`, `schema_version`).
5. Trace `sequence` is strictly increasing.
6. Trace starts with `run_started`.
7. Terminal event matches run status (`run_completed`, `run_failed`, `run_timed_out`, `run_cancelled`).
8. All trace event `run_id` values match run artifact `run_id`.
9. `trace_event_ids` count in run artifact matches trace event count.
10. Success runs include non-empty `output_payload.step_results`.

---

## Result

`PASS` for Track E Wave 0 `F0-M` validation scope.

Interpretation:

- artifact shape is usable for smoke evidence,
- artifact shape is usable for replay-read preparation,
- success and failure paths are both covered with stored artifacts.

---

## Known Limits (Explicit)

Still not covered by this Wave 0 validation:

- deterministic re-execution replay from artifacts
- provider/environment snapshot reproducibility
- baseline quality scoring across variants

These are later-wave concerns and should not be implied by `F0-M` completion.

---

## Next Step

1. Use validator output as input to `L1-D` baseline reference path checks.
2. Create `docs/Track-E-Smoke-Rubric-v0.md` using this artifact acceptance layer.
3. Keep acceptance rules version-aligned with schema changes from Track B.
