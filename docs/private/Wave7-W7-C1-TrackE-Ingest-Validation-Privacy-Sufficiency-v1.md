# Wave7 W7-C1 TrackE Ingest Validation Privacy Sufficiency v1

## Status

Track E validation/privacy sufficiency artifact for `W7-C1`.

Execution mode: `opencode_assisted`

Scope verdict: `track_e_validation_privacy_sufficiency_only`

```yaml
review_verdict: APPROVE_WITH_RESIDUAL_RISK
privacy_verdict: PASS
false_green_verdict: PASS
partial_write_policy: accepted_low_residual_risk
w7_d_workbench_unblocked: true
w7_e_learning_unblocked: true
production_code_changes_allowed: false
route_defects_to_owner_tracks: true
```

## Reviewed Inputs

- `ops/PROJECT_STATE.md`
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `docs/private/Wave7-W7-A-E-Evidence-Privacy-Review-v1.md`
- `docs/private/Wave7-W7-B1-Canonical-Artifact-Writer-And-Validators.md`
- `docs/private/Wave7-W7-B2-TrackD-Router-Selected-Output-Reader-v1.md`
- `docs/private/Wave7-W7-B3-TrackA-Ingest-CLI-UX-v1.md`
- `src/fractal_agent_lab/ingest/opencode_loop.py`
- `src/fractal_agent_lab/adapters/opencode_router_sources.py`
- `src/fractal_agent_lab/cli/app.py`

## Allowed File Scope

```yaml
allowed_files:
  - docs/private/Wave7-W7-C1-TrackE-Ingest-Validation-Privacy-Sufficiency-v1.md
  - tests/ingest/test_opencode_loop.py
  - tests/adapters/test_opencode_router_sources.py
  - tests/cli/test_w7_b3_ingest_cli.py
production_code_changes_allowed: false
```

Track E did not change production writer, adapter, or CLI source.

## Stop And Route Rule

```yaml
if_production_defect_found:
  action: stop_and_route
  writer_or_schema_owner: Track B
  adapter_owner: Track D
  cli_owner: Track A
  sequencing_or_acceptance_ambiguity_owner: Meta
  meta_decision_required_before_fix: true
```

## Findings

### RF-2026-06-04-01 - Step-result excerpts are validator-bounded

Disposition: fixed by Track B validator hardening; pending Meta closeout.

The W7-A Track E privacy requirement says selected output excerpts and `step_results[*].output.selected_text_excerpt` must be bounded by `privacy_audit_state.excerpt_max_chars` or an equivalent per-output field.

Track B hardened `src/fractal_agent_lab/ingest/opencode_loop.py` so `step_results[*].output.selected_text_excerpt` remains optional, rejects non-string values when present, and rejects strings exceeding `privacy_audit_state.excerpt_max_chars`. Existing `selected_outputs.outputs[*].excerpt` bounds remain enforced.

Rerun evidence:

- `test_w7_c1_rejects_step_result_selected_text_excerpt_over_privacy_limit`
- `test_w7_c1_rejects_non_string_step_result_selected_text_excerpt`
- existing valid `selected_text_excerpt` payload fixtures still pass

Impact: the W7-C1 blocking privacy gap is resolved for Track E sufficiency purposes, pending Meta closeout of `RF-2026-06-04-01`.

## Coverage Matrix

| W7-C1 focus | Evidence | Result |
|---|---|---|
| Malformed source data | `test_w7_c1_rejects_missing_source_file`, `test_w7_c1_rejects_directory_source`, `test_w7_c1_rejects_unsupported_json_source_kind` | PASS |
| Path traversal | `test_w7_c1_rejects_unsafe_external_loop_id`, `test_w7_c1_rejects_unsafe_packet_selected_output_and_approval_refs`, existing router-root escape test | PASS |
| Missing approvals | existing green-without-review/approval tests plus all-checkpoints-unapproved test | PASS |
| Unsupported retention | `test_w7_c1_rejects_raw_transcript_retention`, `test_w7_c1_rejects_thought_or_reasoning_retention`, body retention tests | PASS |
| Bounded selected outputs | `test_w7_c1_rejects_selected_output_excerpt_over_limit`, `test_w7_c1_rejects_step_result_selected_text_excerpt_over_privacy_limit`, `test_w7_c1_rejects_non_string_step_result_selected_text_excerpt`, existing valid selected excerpt fixtures | PASS |
| False-green loop outcomes | packet warning/invalid, no review, no approval, and CLI false-green tests | PASS |
| Preview/write CLI behavior | W7-C1 preview/write text boundary tests and existing JSON/write tests | PASS |
| Partial artifact failure/cleanup policy | existing-target preflight rejects before write; no mid-write atomicity guarantee exists | LOW residual accepted |

## Partial-Write Policy

```yaml
partial_write_policy: accepted_low_residual_risk
```

W7-C1 may accept partial-write as LOW residual only under these constraints:

- overwrite preflight is covered and fails before writing when targets already exist
- no clean-pass claim may be inferred from directory or sidecar presence alone
- downstream W7-D/W7-E consumers must rely on canonical acceptance validation, not `data/artifacts/<run_id>/` directory presence
- if a later mid-write failure produces misleading clean-pass or privacy exposure, Track B must own the fix before downstream use

This residual does not block W7-C1 by itself. After the Track B excerpt-bound fix, no remaining W7-C1 privacy or false-green finding blocks downstream approval.

## Non-Goals Preserved

W7-C1 does not implement:

- OpenCode bridge/API/session delivery
- browser-side OpenCode control
- router mutation
- automatic dispatch
- commit/push automation
- public export
- HUB work
- W7-D workbench implementation
- W7-E learning-state implementation

## Downstream Decision

```yaml
w7_d_workbench_unblocked: true
w7_e_learning_unblocked: true
```

Reason: Track B now enforces validator coverage for `step_results[*].output.selected_text_excerpt` against `privacy_audit_state.excerpt_max_chars`, while existing selected-output, retention, false-green, adapter, CLI, and partial-write checks remain passing. Downstream consumers must still rely on canonical acceptance validation rather than artifact directory presence.

## Verification Plan

Required focused commands:

```powershell
$env:PYTHONPATH='src'; python -m unittest discover -s tests/ingest -p "test_opencode_loop.py"
$env:PYTHONPATH='src'; python -m unittest tests.adapters.test_opencode_router_sources
$env:PYTHONPATH='src'; python -m unittest tests.cli.test_w7_b3_ingest_cli
$env:PYTHONPATH='src'; python -m unittest tests.evals.test_artifact_acceptance tests.tracing.test_artifact_layout
python -m compileall src tests
git diff --check -- docs/private/Wave7-W7-C1-TrackE-Ingest-Validation-Privacy-Sufficiency-v1.md tests/ingest/test_opencode_loop.py tests/adapters/test_opencode_router_sources.py tests/cli/test_w7_b3_ingest_cli.py
```

## Final Track E Position

W7-C1 reran the validation/privacy sufficiency gate after the Track B validator hardening.

Final verdict is `APPROVE_WITH_RESIDUAL_RISK`: privacy and false-green sufficiency pass, with partial-write policy retained as accepted low residual risk.

Recommendation: unblock W7-D workbench and W7-E learning-state consumers after Meta closes `RF-2026-06-04-01`.
