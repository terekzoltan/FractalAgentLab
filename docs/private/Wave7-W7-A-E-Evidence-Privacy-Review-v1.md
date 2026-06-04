# Wave7 W7-A-E Evidence Privacy Review v1

## Status

Track E evidence/privacy review artifact for `W7-A-E`.

Execution mode: `opencode_assisted`

Scope verdict: `evidence_privacy_review_only`

W7-B implementation allowed: `false`

Bridge/API/session delivery allowed: `false`

Controller mode allowed: `false`

Browser-side execution allowed: `false`

Commit/push automation allowed: `false`

Raw transcript default allowed: `false`

Reviewed inputs:

- `ops/PROJECT_STATE.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `docs/private/Wave7-W7-A-B-Contract-Compatibility-Review-v1.md`
- `docs/private/External-Project-Packet-Fields-v01.md`
- `src/fractal_agent_lab/evals/artifact_acceptance.py`

## Track E Verdict

`acceptable_direction_with_required_contract_changes_before_w7_a_acceptance`

Track E accepts the W7-A direction as evidence/privacy-compatible only if the contract is revised or Meta explicitly routes the required changes before W7-A final acceptance.

The direction is correct: selected structured extracts, review syntheses, approval checkpoints, packet refs, and privacy audit state are the right evidence surface. The current draft is not yet sufficient for implementation because several privacy and false-green fields remain prose-level or under-specified.

## Required Changes Before W7-A Acceptance

1. Keep `raw_transcript_retained: false` as a hard default.

Full raw session history, hidden chain-of-thought, thought/reasoning parts, and prompt corpora must not become canonical W7 evidence by default. Any later exception must be private-only, explicit, and separately reviewed.

2. Make privacy audit state required and machine-readable.

Required fields for W7-A MVP:

```yaml
privacy_audit_state:
  retention_mode: structured_extracts_only
  raw_transcript_retained: false
  excerpt_max_chars: int
  body_retention_allowed: false
  body_path_policy: none
  thought_or_reasoning_retained: false
  privacy_classification: private_raw | private_coordination | sanitized_public_candidate | never_public
  public_export_state: blocked | not_requested | candidate_needs_review
```

Track E recommends the MVP default above be stricter than Track B's compatibility allowance: `body_retention_allowed: false` and `body_path_policy: none`. A later explicit gate may allow `private_sidecar_relative_only`, but W7-A should not require retained bodies to be useful.

3. Bound selected output excerpts explicitly.

`selected_outputs.json.outputs[].excerpt` and `step_results[*].output.selected_text_excerpt` must be bounded by `privacy_audit_state.excerpt_max_chars` or an equivalent per-output field. The W7-A contract should not leave excerpt length as prose-only.

Recommended MVP rule:

```yaml
excerpt_max_chars: 4000
excerpt_truncation_required: true
```

The exact number can be changed by Meta, but the contract must contain a validator-ready maximum before W7-B.

4. Resolve `output_payload.step_results` compatibility.

Current artifact acceptance requires succeeded runs to include non-empty `output_payload.step_results`. The W7-A draft currently defines top-level `step_results` and `output_payload.final_output`, but does not require `output_payload.step_results`.

Required contract rule before W7-A acceptance:

```yaml
step_results: object
output_payload:
  step_results: object
  final_output: object
```

For W7-A MVP, `output_payload.step_results` should contain the selected stage-level evidence objects used by artifact acceptance and eval/replay consumers. Top-level `step_results` may remain for `run_state.v1` envelope compatibility, but W7 must not rely only on the top-level copy.

5. Keep sidecar validation separate from success and approval.

W7 sidecars may use:

```yaml
validation_state: ok | warning | invalid
```

But this state must not imply review approval, packet-law closure, delivery success, commit readiness, or clean pass. Invalid validation must block clean outcomes. Warning validation may allow a yellow/mixed evidence outcome but must not produce a clean-green claim.

6. Require approval and review evidence for green claims.

`overall_outcome: green` must require explicit approval/review evidence, not just successful ingest. At minimum, W7-A should require:

```yaml
approval_count: int
review_synthesis_present: boolean
validation_state: ok | warning | invalid
clean_pass_eligible: boolean
```

`clean_pass_eligible` must be false when approval is missing, review synthesis is missing, validation is invalid, warnings are unresolved, or the loop ended in hold/blocked/deep-review-needed state.

7. Rename Wave 7 sidecar schemas from `w8.*.v1` to `w7.*.v1`.

This is both a Track B compatibility issue and a Track E evidence-governance issue. Schema names are audit labels; keeping `w8.*.v1` inside W7 evidence would make later validation and provenance reports ambiguous.

8. Keep public export blocked by default.

W7-A artifacts must not mark public release as approved by ingest. `approved` should be unavailable unless a separate export-review artifact exists. The W7-A MVP should prefer:

```yaml
public_export_state: blocked | not_requested | candidate_needs_review
```

Track E recommends excluding `approved` from the W7-A ingest-time value set, or allowing it only with an explicit `public_export_review_ref`.

9. Add privacy and evidence fields to `opencode_loop_summary.json`.

Track E agrees with Track B that `opencode_loop_summary.json` should be required for W7-A MVP rather than deferred. It should include:

```yaml
schema_version: w7.opencode_loop_summary.v1
run_id: string
workflow_id: opencode.meta_track.loop.v1
target_project_id: string
external_loop_id: string
overall_outcome: green | yellow | red | mixed | blocked
terminal_stage: string
packet_count: int
approval_count: int
selected_output_count: int
review_synthesis_present: boolean
validation_state: ok | warning | invalid
clean_pass_eligible: boolean
warnings: array
privacy_audit_state: object
artifact_refs: array
```

This gives Track A and later Track E checks a compact summary without requiring raw transcript reads.

## Sufficiency Assessment

### Structured extracts only

Verdict: sufficient if enforced by fields, not prose.

The W7-A draft's design rule is correct, but W7-B must be able to validate it. Track E requires explicit `retention_mode`, `raw_transcript_retained`, `thought_or_reasoning_retained`, excerpt limit, and body retention fields.

### Bounded selected outputs

Verdict: conditionally sufficient.

Selected outputs can support review/eval/learning without raw transcript retention if each output has stage, source session, optional message id, summary, bounded excerpt, privacy classification, and body-retention policy. The current draft has most of this but lacks explicit excerpt bounds and a strict MVP body policy.

### False-green prevention

Verdict: directionally strong, but requires machine-readable gates.

The W7-A and W7-A-B drafts correctly separate ingest success from OpenCode task success. Track E requires validator-ready fields so later helpers cannot claim green from envelope success alone.

### Privacy classification and public export

Verdict: sufficient only after default-safe value restrictions.

`privacy_classification` and `public_export_state` are the right fields. For W7-A MVP, public export must remain blocked/not-requested/candidate-only unless a separate export review exists.

### Evidence without raw transcript retention

Verdict: sufficient for W7-A if summary sidecars are required.

Packet ledger, selected outputs, review synthesis, approval log, ingest report, and `opencode_loop_summary.json` are enough for the first evidence layer. They are not enough for public release, model-quality claims, or broad usefulness claims without later evaluation.

## Out Of Scope

This W7-A-E review does not authorize or implement:

- W7-B ingest CLI
- artifact writer implementation
- router adapter
- OpenCode bridge/API/session delivery
- browser control
- commit/push automation
- controller mode
- source code changes
- test implementation
- data/evidence writes
- public export or public-safe case study
- learning extractor implementation
- workbench/index implementation

## Meta Acceptance Inputs

Before `W7-A-META2` accepts the contract, Meta should require a W7-A contract revision or explicit acceptance note covering:

1. `output_payload.step_results` compatibility with current artifact acceptance.
2. `w8.*.v1` to `w7.*.v1` sidecar schema rename.
3. Required `opencode_loop_summary.json` with privacy and false-green summary fields.
4. Machine-readable `privacy_audit_state` with strict MVP defaults.
5. Explicit excerpt bounds.
6. Default `body_retention_allowed: false` and `body_path_policy: none`, unless Meta explicitly accepts a private-sidecar exception.
7. Public export blocked/not-requested/candidate-only unless a separate export review exists.
8. Clean-green prevention fields such as `review_synthesis_present`, `validation_state`, and `clean_pass_eligible`.

Recommended next role: Meta Coordinator `W7-A-META2` acceptance closeout after the W7-A contract is revised or the required changes are explicitly routed.

## Final Track E Position

W7-A is privacy/evidence-compatible in direction, but not implementation-ready until the contract turns privacy retention, selected-output bounds, false-green rules, public-export defaults, and `output_payload.step_results` compatibility into validator-ready requirements.

W7-B implementation remains blocked until W7-A is accepted.
