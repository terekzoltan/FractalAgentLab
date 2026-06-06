# Wave7 W7-E2 TrackE Learning Privacy Validation v1

## Status

Track E validation artifact for `W7-E2`.

Execution mode: `opencode_assisted`

Scope verdict: `track_e_learning_privacy_validation_only`

```yaml
review_verdict: APPROVE_WITH_RESIDUAL_RISK
privacy_verdict: PASS
deidentification_verdict: PASS_WITH_RESIDUAL_RISK
candidate_quality_verdict: PASS
identity_authority_verdict: PASS
w7_f_unblocked: true
residual_risk: substring de-identification tests cover current structured leakage classes but do not mathematically prove semantic non-leakage
```

## Reviewed Inputs

- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/PROJECT_STATE.md`
- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md`
- `docs/private/Wave7-W7-C1-TrackE-Ingest-Validation-Privacy-Sufficiency-v1.md`
- `docs/private/Wave7-W7-E1-TrackC-Project-Global-Learning-Input-Semantics-v1.md`
- `docs/private/Wave7-W7-D-OpenCode-Learning-State-And-Suggestions-v1.md`
- `src/fractal_agent_lab/memory/opencode_learning.py`
- `tests/memory/test_w7_opencode_learning.py`
- `tests/memory/test_w7_e2_opencode_learning_validation.py`

## Scope Boundary

```yaml
allowed_files:
  - docs/private/Wave7-W7-E2-TrackE-Learning-Privacy-Validation-v1.md
  - tests/memory/test_w7_e2_opencode_learning_validation.py
  - ops/PROJECT_STATE.md
production_code_changes_allowed: false
new_reusable_eval_module_allowed: false
```

Track E did not modify `src/fractal_agent_lab/memory/opencode_learning.py`, the W7-B/C canonical artifact contract, ingest writer, router adapter, workbench UI, CLI, or identity store.

## W7-E1 Sidecar Authority Boundary

The W7-E1 `opencode_learning_update.json` sidecar remains Track C extraction evidence only.

Required boundary retained:

```yaml
track_e_validation_claim: false
```

This W7-E2 artifact, not the W7-E1 sidecar, carries the Track E validation claim.

## Public Export State Decision

W7-E2 does not introduce a new learning input eligibility gate based on `public_export_state`.

Instead, W7-E2 validates that accepted W7-E1 learning outputs stay private/local and do not make a public export or release-approval claim.

## Coverage Matrix

| W7-E2 focus | Evidence | Result |
|---|---|---|
| Global de-identification | `test_w7_e2_global_learning_is_deidentified_and_low_confidence` rejects target name, project id text, repo path, Windows path fragments, raw selected excerpt text, and raw run ids in global output | PASS_WITH_RESIDUAL_RISK |
| Non-public defaults | `test_w7_e2_dry_run_and_write_outputs_stay_private_local` proves dry-run writes nothing and write mode stays under local/private temp `memory/**` and `artifacts/<run_id>/opencode_learning_update.json` paths | PASS |
| Sidecar authority wording | W7-E2 tests assert `track_e_validation_claim: false` and no public export approval claim in W7-E1 sidecar output | PASS |
| No identity-driven routing authority | `test_w7_e2_learning_sidecar_has_no_identity_routing_or_control_authority` asserts no identity paths and no routing/control authority keys in sidecar or candidates | PASS |
| Candidate quality and noise control | `test_w7_e2_project_candidates_are_bounded_and_deduped` asserts allowed workflow-learning subtypes, useful source paths, ignored blank/non-string final-output values, and same-run dedupe | PASS |
| W7-F gate | W7-E2 validation and targeted regressions pass; no privacy/authority defect found in Track E scope | PASS |

## Residual Risk

Substring-based de-identification tests can prove the current structured leakage classes are covered, including target names, target repo paths, Windows path fragments, raw selected excerpts, and raw run ids.

They do not mathematically prove semantic non-leakage. Future global-learning expansion must preserve explicit de-identification review rather than treating this W7-E2 pass as permanent semantic safety proof.

## Defect Routing Rule

If a future W7-E2 rerun finds a privacy or authority defect:

- set `w7_f_unblocked: false`
- do not patch production code inside the Track E validation lane
- route learning helper semantics issues to Track C
- route canonical artifact or sidecar contract issues to Track B
- route sequencing or re-contract decisions to Meta
- rerun Track E validation after the owner fix or Meta re-contract

## Non-Goals Preserved

W7-E2 does not implement:

- new reusable eval module
- production learning helper changes
- automatic `fal ingest router-loop` integration
- CLI changes
- router/session mutation
- OpenCode bridge/API/session delivery
- UI/workbench changes
- ingest schema changes
- advisory suggestions
- identity-driven routing
- public export

## Verification Plan

Required focused commands:

```powershell
$env:PYTHONPATH='src'; python -m unittest tests.memory.test_w7_opencode_learning
$env:PYTHONPATH='src'; python -m unittest tests.memory.test_w7_e2_opencode_learning_validation
$env:PYTHONPATH='src'; python -m unittest tests.memory.test_project_update tests.memory.test_project_memory
$env:PYTHONPATH='src'; python -m unittest discover -s tests/ingest -p "test_opencode_loop.py"
$env:PYTHONPATH='src'; python -m unittest tests.evals.test_artifact_acceptance tests.tracing.test_artifact_layout
python -m compileall src tests
git diff --check -- docs/private/Wave7-W7-E2-TrackE-Learning-Privacy-Validation-v1.md tests/memory/test_w7_e2_opencode_learning_validation.py ops/PROJECT_STATE.md
```

## Final Track E Position

W7-E2 validates W7-E1 learning/privacy boundaries sufficiently for the next Wave 7 gate.

Final verdict is `APPROVE_WITH_RESIDUAL_RISK`: privacy, candidate quality, sidecar authority, and no-identity-routing checks pass, while semantic non-leakage remains a bounded residual risk.

Recommendation: W7-F usefulness evaluation may start after Meta step-review accepts this W7-E2 outcome.
