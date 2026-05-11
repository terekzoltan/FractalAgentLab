# Wave6 W6-S2 TrackE W6-F Usefulness Evaluation v1

## Status

Track E delivery note for `W6-F` usefulness evaluation v1.

Execution mode: `opencode_assisted`

Visibility / audit state:

- tracked W6-C recorder code, tests, and delivery notes were consulted
- tracked Wave 6 planning and usefulness-eval policy docs were consulted
- private/local W6-D and W6-E seed rows were consumed from `data/evidence/wave6/`
- W6-F private eval outputs were written under `data/evidence/wave6/eval/w6f-usefulness-evaluation-v1/`
- raw `data/evidence/wave6/**` evidence remains local/private and is not part of this tracked delivery note

## Input Evidence

W6-F evaluated existing seed rows only. It did not run a new recorder capture.

Input rows:

- `data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/usefulness_row.json`
- `data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/usefulness_row.json`

Input loop IDs:

- `w6d-fal-w6bc-review-fix-20260508`
- `w6e-fal-project-state-protocol-20260511`

Both input rows remain private seed evidence, not broad usefulness proof.

Default W6-F helper/script execution now requires these W6-D + W6-E seed rows. A one-row default invocation is rejected instead of producing advisory-positive output.

## Generated Private Outputs

```text
data/evidence/wave6/eval/w6f-usefulness-evaluation-v1/usefulness_rows.jsonl
data/evidence/wave6/eval/w6f-usefulness-evaluation-v1/usefulness_summary.json
```

These generated files are private/local Wave 6 eval evidence.

## Command

```bash
PYTHONPATH=src python scripts/run_w6_f_usefulness_evaluation.py --input-row data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/usefulness_row.json --input-row data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/usefulness_row.json
```

Exit status: `0`

## Result Summary

- schema_version: `w6.usefulness_evaluation.v1`
- input rows: `2`
- target repos: `FractalAgentLab`
- fal_only_evidence: `true`
- external_evidence_present: `false`
- overall_recommendation: `optional`
- confidence: `low`
- evidence_quality: `low`
- bridge_readiness_implication: `may_support_narrow_w6g_readiness_brief_after_meta_review_only`
- privacy_classification: `private_raw`
- public_safe: `false`
- claim_boundary: `private_w6f_usefulness_evaluation_not_broad_or_public_claim`

## Per-Class Evaluation

### `shared_boundary`

- loop: `w6d-fal-w6bc-review-fix-20260508`
- class_recommendation: `optional`
- confidence: `low`
- evidence_quality: `low`
- real_issues_caught_count: `2`
- false_positive_findings_count: `0`
- missing_tests_count: `1`
- bridge_readiness_implication: `may_support_narrow_w6g_readiness_brief_after_meta_review_only`

Interpretation:

- The ledger preserved high-value shared-boundary review/fix evidence.
- The evidence is still FAL-only, warning-grade, and one row for this class.
- This supports at most a narrow readiness-brief discussion, not bridge/API implementation.

### `governance_context_continuity`

- loop: `w6e-fal-project-state-protocol-20260511`
- class_recommendation: `optional`
- confidence: `low`
- evidence_quality: `low`
- real_issues_caught_count: `1`
- false_positive_findings_count: `0`
- missing_tests_count: `1`
- bridge_readiness_implication: `may_support_narrow_w6g_readiness_brief_after_meta_review_only`

Interpretation:

- The ledger preserved a real project-state continuity mismatch and fixed governance finding.
- The evidence depends on local-only `ops/PROJECT_STATE.md` context and is not public-case-study strength.
- This supports at most a narrow readiness-brief discussion, not bridge/API implementation.

## Recommendation Thresholds Applied

- `recommended` is intentionally unreachable from only two FAL-only, warning-grade seed rows.
- `optional` is allowed only for narrow task classes with visible audit value and explicit caveats.
- Advisory-positive `optional` / `recommended` output requires `transition_validation.source: computed_w6_b` and `transition_validation.status: pass`.
- Supported transition statuses `warning`, `fail`, and `unavailable` are accepted only as non-advisory-positive evidence and cannot support W6-G readiness implication.
- Missing, malformed, or unsupported transition validation is rejected.
- `insufficient_data` remains the default when evidence quality or quantity is weak and audit value is not visible.
- `dangerous` is reserved for failed transitions, too-lenient gates, privacy-risk signals, or high false-positive evidence.
- `not_worth_it` is reserved for overhead without audit value.

Recorder `net_recommendation` remains row-level evidence. W6-F aggregate recommendation does not overwrite it.

## Why This Does / Does Not Unblock W6-G Readiness Brief

This W6-F result may support Meta opening a narrow W6-G readiness brief because both evaluated classes show audit value and no false-positive findings.

This W6-F result does not authorize OpenCode bridge/API implementation because:

- confidence is `low`
- evidence is FAL-only
- no external target repo has been evaluated
- both rows are warning-grade with `clean_pass=false`
- recorder-level `net_recommendation` remains `insufficient_data`
- W6-G is a readiness brief gate, not an implementation gate

If Meta opens W6-G, it should remain a bridge/API readiness brief only. Any bridge/API implementation would require a later explicit Meta-opened implementation step.

W6-H/W6-I external target readiness remains a separate later gate.

## Review-Fix Changes

Meta step review initially returned RED for two false-green risks. Track E applied these review-fix changes:

- unsupported `transition_validation.status` values now raise `W6UsefulnessEvaluationError`
- missing or non-`computed_w6_b` `transition_validation.source` now raises `W6UsefulnessEvaluationError`
- supported non-pass transition statuses cannot produce `optional` or `recommended`
- default W6-F execution requires the expected W6-D + W6-E seed row loop IDs
- one-row script invocation exits non-zero with an explicit W6-D + W6-E requirement error
- W6-G remains Meta-gated and readiness-brief-only

## Verification

Targeted W6-F tests:

```bash
PYTHONPATH=src python -m unittest tests.evals.test_w6_usefulness_evaluation
PYTHONPATH=src python -m unittest tests.scripts.test_w6_f_usefulness_evaluation
```

Result: `PASS`, 15 tests total.

Manual W6-F smoke:

```bash
PYTHONPATH=src python scripts/run_w6_f_usefulness_evaluation.py --input-row data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/usefulness_row.json --input-row data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/usefulness_row.json
```

Result: `PASS`, exit status `0`.

One-row rejection smoke:

```bash
PYTHONPATH=src python scripts/run_w6_f_usefulness_evaluation.py --input-row data/evidence/wave6/loops/w6d-fal-w6bc-review-fix-20260508/usefulness_row.json
```

Result: non-zero exit with `Default W6-F usefulness evaluation requires W6-D + W6-E seed rows`.

Full relevant W6 suite:

```bash
PYTHONPATH=src python -m unittest tests.core.contracts.test_w6_packet_contract tests.core.contracts.test_w6_ledger_contract tests.core.contracts.test_w6_state_machine_contract tests.tracing.test_evidence_layout tests.evals.test_w6_manual_evidence_recorder tests.scripts.test_w6_c_manual_evidence_recorder tests.evals.test_w6_usefulness_evaluation tests.scripts.test_w6_f_usefulness_evaluation
```

Result: `PASS`, 83 tests total.

Additional checks before final handoff:

- W6-F generated summary has `privacy_classification: private_raw`.
- W6-F generated summary has `public_safe: false`.
- W6-F generated summary does not include raw packet payloads.
- W6-F generated summary caveats missing external evidence.

## No-Claim Boundary

W6-F does not claim:

- broad usefulness proof
- public case-study readiness
- OpenCode API/session delivery
- bridge/API implementation readiness
- UI/dashboard readiness
- commit automation
- push automation
- provider/model performance comparison

## Downstream Handoff

Meta should step-review W6-F and decide whether W6-G remains blocked or opens as a narrow readiness brief.

Track E recommends: `optional` for narrow readiness-brief consideration only, with `low` confidence and preserved caveats.

## Meta Closeout

Meta re-review verdict after Track E review-fix: `GREEN`.

Closeout decision:

- W6-F is accepted as low-confidence, FAL-only private advisory evidence.
- The initial RED false-green risks were fixed: unsupported transition status is rejected, missing/wrong transition source is rejected, supported non-pass transition statuses cannot produce advisory-positive output, and one-row default execution is rejected.
- `overall_recommendation: optional` is accepted only for narrow W6-G readiness-brief consideration after Meta review.
- W6-F does not authorize OpenCode bridge/API implementation, session delivery, commit automation, push automation, public case-study readiness, or dashboard work.
- W6-G may open as a narrow readiness brief only; any implementation work remains blocked until a later explicit Meta-opened step.
- W6-H/W6-I external target readiness remains a separate later gate.
