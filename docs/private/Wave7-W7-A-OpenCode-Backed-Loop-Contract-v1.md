# Wave7 W7-A OpenCode-Backed Loop Contract v1

## Status

Private W7-A contract proposal revised after Track B `W7-A-B` and Track E `W7-A-E` review.

This document defines the first recommended canonical contract for representing a real OpenCode-driven Meta/Track loop inside FAL's existing `data/runs`, `data/traces`, and `data/artifacts` spine.

It does not authorize:

- session control from FAL
- browser-side execution
- automatic commit/push
- full raw transcript retention by default

## Authority

- `docs/private/OpenCode-Orchestration-Layer-v01.md` defines the strategic rule that OpenCode is the execution hand and FAL is the intelligence/evidence layer.
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md` defines the accepted evidence-ledger-first posture.
- `docs/private/External-Project-Packet-Fields-v01.md` defines useful external-project sidecar context that this contract should reuse where applicable.
- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md` defines the broader Wave 7 direction.

## Purpose

FAL already has a strong canonical artifact spine:

- `data/runs/<run_id>.json`
- `data/traces/<run_id>.jsonl`
- `data/artifacts/<run_id>/...`

What is missing today is a canonical way to represent a real OpenCode-backed loop so that:

- the Wave 5 workbench can browse it
- replay/eval tools can inspect it
- memory/identity layers can learn from it
- project-local and cross-project comparisons can use it

`W7-A` defines that canonical shape.

## Contract Goal

Represent one real OpenCode-driven development loop as one FAL run artifact plus trace and sidecars.

Target loop examples:

- Track `/seq-next` -> Meta `/terv-review` -> Track `/implement` -> Meta `/step-review`
- plan review loop that ends before implementation because of block/hold
- review-fix loop after `fix_required`

The contract should preserve evidence and learning value without requiring full raw transcript storage.

## Core Design Rule

Only selected, structured, operator-relevant evidence becomes canonical by default.

Canonical by default:

- packet stages
- stage decisions
- selected output extracts
- review syntheses
- approval checkpoints
- artifact references
- validation state

Not canonical by default:

- full raw session history
- thought/reasoning parts
- hidden chain-of-thought
- every intermediate message

## Canonical Workflow Identity

Recommended Wave 7 workflow id:

```text
opencode.meta_track.loop.v1
```

This value means:

- the run came from a real OpenCode-driven Meta/Track loop
- the run was ingested into FAL after or during execution
- the run was not executed by the native FAL runtime planner itself

## Run Identity Model

### Rule

For the `W7-A` MVP, one FAL run should correspond to one OpenCode loop.

Recommended identifiers:

```yaml
run_id: ocloop-<target_project_id>-<sequence_ref_safe>-<timestamp>
context:
  external_loop_id: same_as_run_id
```

Reason:

- keeps joins simple in the first slice
- avoids a second identity layer before usefulness is proven

Later, if one external loop needs multiple derived FAL views, `external_loop_id` may stay stable while `run_id` diverges. That is explicitly deferred.

## Loop Boundary Rule

The contract must represent a meaningful loop boundary, not arbitrary message chunks.

Recommended loop close conditions:

- final Meta synthesis or Track acknowledgement recorded
- blocked/hold stop state recorded
- review-fix handoff emitted and finalized for the current pass
- operator closes loop explicitly because execution stopped at a known stage

Do not create a new canonical FAL run for every single packet or single message.

## Canonical Run Artifact Shape

The run artifact should remain `run_state.v1` compatible.

Recommended required top-level values:

```yaml
run_id: string
workflow_id: opencode.meta_track.loop.v1
status: succeeded | failed | cancelled
input_payload: object
output_payload: object
step_results: object
errors: array
failure: object | null
context: object
trace_event_ids: array
status_transitions: array
created_at: iso8601-string
started_at: iso8601-string | null
completed_at: iso8601-string | null
schema_version: run_state.v1
```

### Recommended `input_payload`

```yaml
target_project_id: string
target_project_name: string
target_repo_path: string
sequence_ref: string
target_track: string
meta_track_pair: string
loop_entry_mode: manual | router_assisted | fal_cli_assisted
entry_stage: string
source_refs: array
```

### Recommended `context`

`context` should hold external-project and control-plane metadata that is useful for later replay and learning.

Recommended fields:

```yaml
external_loop_id: string
target_project_context:
  schema_version: external_project_context.v0
  ...
router_context:
  router_kind: oc_session_router
  router_dir: string
  server_mode: local_password_basic_auth
approval_policy:
  policy_id: string
  approval_mode: explicit_checkpoint
privacy_audit_state:
  retention_mode: structured_extracts_only
  raw_transcript_retained: false
```

### Recommended `output_payload`

`output_payload` should summarize the loop, not duplicate every selected artifact.

Recommended fields:

```yaml
step_results:
  stage_id:
    agent_id: string
    step_id: string
    output:
      extract_ref: string
      summary: string
      decision: string | null
      stage: string
      source_session: string
      message_id: string | null
      selected_text_excerpt: string | null
    raw:
      source_kind: router_selected_output
      provider: opencode
final_output:
  overall_outcome: green | yellow | red | mixed | blocked
  terminal_stage: string
  final_decision: string | null
  next_recommended_action: string
  blocking_conditions: array
  required_followups: array
  accepted_scope_summary: string
  key_findings: array
  artifact_refs: array
  learning_candidate_refs: array
  approval_count: int
  review_synthesis_present: boolean
  validation_state: ok | warning | invalid
  clean_pass_eligible: boolean
```

Compatibility rule: succeeded W7 runs must include non-empty `output_payload.step_results` because current FAL artifact acceptance validates that field. Top-level `step_results` remains part of the `run_state.v1` envelope; W7 must not rely only on the top-level copy.

## `step_results` Meaning In An OpenCode-Backed Loop

`step_results` should contain selected stage-level evidence objects, not raw session dumps.

Recommended `step_results` keys:

```yaml
track_seq_next
meta_plan_review
track_plan_review_after
track_implement
meta_step_review_phase1
swarm_review
meta_final_synthesis
track_step_review_after
```

Each present `step_results[step_id]` object should contain:

```yaml
agent_id: string
step_id: string
output:
  extract_ref: string
  summary: string
  decision: string | null
  stage: string
  source_session: string
  message_id: string | null
  selected_text_excerpt: string | null
raw:
  source_kind: router_selected_output
  provider: opencode
```

The `selected_text_excerpt` should be bounded. The full selected body should live in sidecars only if policy allows it.

MVP excerpt rule:

```yaml
excerpt_max_chars: 4000
excerpt_truncation_required: true
```

## Canonical Sidecars

Recommended sidecars under:

```text
data/artifacts/<run_id>/
```

Required Wave 7 sidecars:

- `opencode_loop_summary.json`
- `packet_ledger.json`
- `selected_outputs.json`
- `review_synthesis.json`
- `approval_log.json`
- `ingest_report.json`

Optional later sidecars:

- `memory_candidates.json`
- `identity_update.json`
- `global_learning_candidates.json`

## Sidecar Contracts

### `opencode_loop_summary.json`

Purpose:

- provide a compact run summary for browse/eval/privacy checks
- avoid requiring raw transcript reads for common review questions

Required fields:

```yaml
schema_version: w7.opencode_loop_summary.v1
run_id: string
workflow_id: opencode.meta_track.loop.v1
target_project_id: string
external_loop_id: string
sequence_ref: string
loop_entry_mode: manual | router_assisted | fal_cli_assisted
automation_mode: manual | opencode_session | router_assisted | fal_cli_assisted | semi_auto_future
overall_outcome: green | yellow | red | mixed | blocked
terminal_stage: string
final_decision: string | null
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

### `packet_ledger.json`

Purpose:

- preserve the ordered packet/story of the loop
- allow packet-first audit without requiring trace replay knowledge

Recommended fields:

```yaml
schema_version: w7.packet_ledger.v1
run_id: string
loop_id: string
entries:
  - sequence: int
    stage: string
    producer: string
    consumer: string
    source_command: string
    decision: string | null
    packet_ref: string | null
    selected_output_ref: string | null
    approval_ref: string | null
    summary: string
    validation_state: ok | warning | invalid
```

### `selected_outputs.json`

Purpose:

- hold selected assistant outputs that were important enough to capture
- give the workbench and learning layers a stable structured input

Recommended fields:

```yaml
schema_version: w7.selected_outputs.v1
run_id: string
outputs:
  - output_id: string
    stage: string
    source_session: string
    message_id: string | null
    capture_mode: latest_output_selected
    summary: string
    excerpt: string | null
    excerpt_max_chars: int
    excerpt_truncated: boolean
    body_path: string | null
    body_retention_allowed: boolean
    body_path_policy: none | private_sidecar_relative_only
    privacy_classification: string
```

### `review_synthesis.json`

Purpose:

- store the distilled findings and final verdict path

Recommended fields:

```yaml
schema_version: w7.review_synthesis.v1
run_id: string
plan_review:
  verdict: string | null
  summary: string | null
step_review:
  phase1_summary: string | null
  swarm_verdict: string | null
  final_verdict: string | null
  final_summary: string | null
```

### `approval_log.json`

Purpose:

- preserve operator approval checkpoints so later audit can distinguish human-approved sends from pure automation

Recommended fields:

```yaml
schema_version: w7.approval_log.v1
run_id: string
checkpoints:
  - checkpoint_id: string
    action_kind: command_send | message_send | packet_route
    target_session: string
    stage: string | null
    approved: true | false
    approved_at: iso8601-string | null
    approval_mode: explicit_user_checkpoint
```

### `ingest_report.json`

Purpose:

- preserve what the ingest layer did or skipped

Recommended fields:

```yaml
schema_version: w7.ingest_report.v1
run_id: string
ingest_version: string
warnings: array
skipped_outputs: array
retention_mode: structured_extracts_only
raw_transcript_retained: false
thought_or_reasoning_retained: false
public_export_state: blocked | not_requested | candidate_needs_review
```

## Trace Contract

### Design rule

The trace should represent loop events, not internal OpenCode storage details.

### Recommended event model

Wave 7 MVP must stay compatible with the existing `trace_event.v1` event vocabulary. The implementation may encode W7-specific meaning using generic event kinds plus payload markers. New W7 event enum values require a later explicit Track B contract gate.

Target event semantics for a later enum-expansion gate:

- `run_started`
- `packet_recorded`
- `approval_requested`
- `approval_granted`
- `approval_declined`
- `command_dispatched`
- `message_dispatched`
- `selected_output_recorded`
- `review_synthesis_recorded`
- `learning_candidates_recorded`
- `run_completed`
- `run_failed`
- `run_cancelled`

The implementation may temporarily encode some of these as existing generic event kinds plus payload markers if enum expansion is staged separately, but the contract target should stay explicit.

### Required trace payload fields

Every loop trace event should carry enough payload to reconstruct the operator story.

Recommended payload fields:

```yaml
target_project_id: string
sequence_ref: string
stage: string | null
source_session: string | null
target_session: string | null
source_command: string | null
decision: string | null
summary: string | null
artifact_ref: string | null
validation_state: ok | warning | invalid | null
```

## Project Context Reuse

The external-project context should reuse the Wave 6.5 sidecar direction rather than inventing a second target-project model.

Recommended `context.target_project_context` source:

- `external_project_context.v0` fields from `docs/private/External-Project-Packet-Fields-v01.md`

This preserves:

- target project identity
- target repo path and kind
- safe slice
- approval policy id
- automation mode
- evidence root
- privacy posture

## Privacy And Retention Rules

Default Wave 7 retention policy:

- structured extracts only
- bounded excerpts allowed
- full bodies retained only when explicitly policy-allowed and still private

Hard default rules:

- no thought/reasoning parts
- no hidden chain-of-thought retention
- no raw transcript publication
- no public-safe assumption without explicit export review

Required machine-readable MVP privacy state:

```yaml
privacy_audit_state:
  retention_mode: structured_extracts_only
  raw_transcript_retained: false
  excerpt_max_chars: 4000
  body_retention_allowed: false
  body_path_policy: none
  thought_or_reasoning_retained: false
  privacy_classification: private_raw | private_coordination | sanitized_public_candidate | never_public
  public_export_state: blocked | not_requested | candidate_needs_review
```

MVP body-retention rule: `body_retention_allowed` defaults to `false` and `body_path_policy` defaults to `none`. A later explicit privacy gate may allow `private_sidecar_relative_only`, but W7-A does not require retained bodies.

Public export rule: W7-A ingest must not set public export to `approved` unless a separate export-review artifact exists and is referenced. Without that artifact, public export remains `blocked`, `not_requested`, or `candidate_needs_review`.

## False-Green Rules

The run artifact status records FAL ingest/normalization success, not OpenCode task success.

Required invariants:

- `run_state.v1.status=succeeded` does not imply review success, approval, clean evidence, usefulness, or commit readiness.
- `overall_outcome: green` requires approval evidence and review synthesis evidence.
- `clean_pass_eligible` must be false when approval is missing, review synthesis is missing, validation is invalid, warnings are unresolved, or the loop ended in hold/blocked/deep-review-needed state.
- `validation_state: warning` may allow yellow or mixed outcomes, but must not produce clean-green claims.
- `validation_state: invalid` must block green and clean-pass claims.

## Learning Feed Rules

The contract should explicitly support later learning layers.

Allowed inputs to project/global memory from this run:

- final synthesis verdicts
- repeated cautions
- repeated blockers
- repeated approval-policy notes
- repeated validation expectations
- repo-specific review/gate lessons

Not allowed as direct memory facts:

- every raw paragraph of a selected output
- unreduced prompt corpora
- chain-of-thought fragments

## Acceptance Criteria

`W7-A` is ready only if:

- one OpenCode-backed loop can be represented as a canonical FAL run/trace/artifact set
- the run is browseable by run id and project id
- packet order and approval checkpoints are reconstructable
- selected outputs are available without requiring raw transcript retention
- privacy posture is explicit and machine-readable
- succeeded runs include non-empty `output_payload.step_results`
- W7 sidecar schema labels use `w7.*.v1`, not `w8.*.v1`
- `opencode_loop_summary.json` exists with privacy and false-green summary fields
- excerpt and body-retention rules are validator-ready
- public export remains blocked/not-requested/candidate-only unless a separate export review exists
- project-local and future global learning layers have stable input surfaces
- the contract does not require FAL to replace OpenCode as the execution hand

## Explicit Non-Goals

`W7-A` does not define:

- UI rendering details
- ingest CLI command implementation behavior
- commit/push policy
- browser control behavior
- global memory scoring semantics
- identity-driven routing authority
