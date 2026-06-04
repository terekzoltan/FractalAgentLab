# Wave7 W7-A-B Contract Compatibility Review v1

## Status

Track B contract compatibility review artifact for `W7-A-B`.

Execution mode: `opencode_assisted`

Scope verdict: `contract_compatibility_review_only`

W7-B implementation allowed: `false`

Bridge/API/session delivery allowed: `false`

Controller mode allowed: `false`

Browser-side execution allowed: `false`

Commit/push automation allowed: `false`

Raw transcript default allowed: `false`

Reviewed inputs:

- `ops/PROJECT_STATE.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `docs/private/Wave7-W7-A-META1-Contract-Adoption-Review-v1.md`
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md`
- `docs/private/External-Project-Packet-Fields-v01.md`
- existing `run_state.v1`, `trace_event.v1`, W6 packet/ledger/state-machine contracts, and W6 path-safety precedent

## Track B Verdict

`compatible_with_required_contract_changes_before_w7_a_acceptance`

Track B accepts the W7-A direction as compatible with the existing FAL run/trace/artifact spine only if the contract changes below are made or explicitly accepted as deferred by Meta before W7-A final acceptance.

The main compatibility condition is that Wave 7 represents an OpenCode-backed loop as ingested evidence, not as FAL-native workflow execution or controller authority.

Critical interpretation:

- `run_state.v1.status=succeeded` means ingest/normalization success only.
- `run_state.v1.status=succeeded` does not mean OpenCode implementation passed review.
- `run_state.v1.status=succeeded` does not imply `closed_pass`, review success, clean evidence, or commit readiness.

## Compatibility Matrix

| Surface | Track B compatibility verdict | Required interpretation or change |
|---|---|---|
| `run_state.v1` | Compatible with constraints | Use `workflow_id: opencode.meta_track.loop.v1`; keep run status about FAL ingest/normalization, while OpenCode loop outcome lives in `output_payload.final_output` and sidecars. |
| `trace_event.v1` | Compatible for MVP without enum expansion | Use existing generic events such as `run_started`, `step_started`, `step_completed`, `run_completed`, `run_failed`, and `run_cancelled` with W7 payload markers. New W7 event enum values require a later explicit contract gate. |
| `data/artifacts/<run_id>/...` | Compatible | Required sidecars can live under the existing artifact spine if path-safe `run_id` rules are enforced. |
| W6 `w6.packet.v1` | Compatible only as reused packet law | W7 must not redefine packet stages, decisions, validation status, or transition closure semantics. |
| `packet_ledger.json` | Compatible as derived sidecar evidence | `packet_ledger.json` is a derived sidecar over packet refs and selected outputs, not W6 packet law replacement. |
| W6-B `validate_w6_packet_history(...)` | Must remain authoritative for W6 packet-transition truth | W7 sidecar validation cannot set `closed_pass`, clean-pass, or commit readiness independently of W6-B transition validation when W6 packet evidence is present. |
| W6.5 `external_project_context.v0` | Compatible as reused context model | Reuse this model under `context.target_project_context`; do not invent a parallel target-project identity model. |
| `loop_entry_mode` and W6.5 `automation_mode` | Compatible if distinct | `automation_mode` records how the external/project session was assisted; `loop_entry_mode` records how the FAL ingest/run representation was initiated. If both are present, they must not contradict each other. |
| privacy/retention fields | Compatible only if machine-readable | Retention, body retention, raw transcript rejection, privacy classification, and public export state must be validator-ready, not prose-only. |

## Required Contract Changes Before W7-A Acceptance

1. Rename Wave 7 sidecar schema labels.

The W7-A draft currently uses `w8.*.v1` examples inside a Wave 7 contract. These should become:

```yaml
packet_ledger_schema: w7.packet_ledger.v1
selected_outputs_schema: w7.selected_outputs.v1
review_synthesis_schema: w7.review_synthesis.v1
approval_log_schema: w7.approval_log.v1
ingest_report_schema: w7.ingest_report.v1
opencode_loop_summary_schema: w7.opencode_loop_summary.v1
```

Track B does not see a compatibility reason to keep `w8.*.v1` labels in W7-A.

2. Define `opencode_loop_summary.json` or explicitly mark it deferred.

Track B recommendation: keep `opencode_loop_summary.json` required for W7-A, but define it minimally.

Recommended minimal fields:

```yaml
schema_version: w7.opencode_loop_summary.v1
run_id: string
workflow_id: opencode.meta_track.loop.v1
target_project_id: string
external_loop_id: string
sequence_ref: string
loop_entry_mode: manual | router_assisted | fal_cli_assisted
automation_mode: manual | opencode_session | router_assisted | fal_cli_assisted | semi_auto_future
terminal_stage: string
overall_outcome: green | yellow | red | mixed | blocked
final_decision: string | null
packet_count: int
approval_count: int
selected_output_count: int
warnings: array
privacy_audit_state:
  retention_mode: structured_extracts_only
  raw_transcript_retained: false
artifact_refs: array
```

If Meta or Track E decides this is too early, W7-A must mark `opencode_loop_summary.json` optional until W7-B proves the final shape.

3. State `packet_ledger.json` boundary explicitly.

`packet_ledger.json` is derived sidecar evidence, not W6 packet law replacement.

It may store ordered refs and summaries:

- packet refs
- selected output refs
- approval refs
- stage strings
- decisions copied from validated packet or review evidence
- sidecar validation state

It must not define new W6 packet stages, decisions, closure states, or `W6ValidationStatus` meanings.

4. Add path-safe ID requirements before W7-B.

Carry forward W6 path-safe ID rules for:

- `run_id`
- `target_project_id`
- `external_loop_id`
- `packet_ref`
- `selected_output_ref`
- `approval_ref`
- `checkpoint_id`
- selected output `output_id`

Required rejects:

- empty or whitespace-only values
- leading/trailing whitespace
- path separators
- traversal segments such as `.` or `..`
- reserved artifact filenames that could collide with required sidecars
- Windows reserved device names

`body_path` is not a free path segment. It must be either null or a relative private sidecar path under an allowlisted run artifact directory. Absolute paths, traversal, and paths outside `data/artifacts/<run_id>/` must be invalid unless a later explicit policy says otherwise.

5. Keep W7 sidecar validation state separate from W6 packet validation status.

W7 sidecars may use:

```yaml
validation_state: ok | warning | invalid
```

This is W7 sidecar validation state. It is not `W6ValidationStatus`, not delivery status, and not review status.

6. Make false-green invariants contract-level.

W7-A must preserve these invariants:

- Ingest success does not imply OpenCode task success.
- Delivery/router success does not imply review success.
- Selected output receipt does not imply approval.
- `green`, `pass`, `clean`, and commit-readiness claims require explicit safe review/approval evidence.
- `hold`, `blocked`, `deep_review_needed`, invalid validation, missing approval, missing review synthesis, or warning-grade transition validation cannot produce clean success.
- A W7 run may be `succeeded` as an ingest artifact while `output_payload.final_output.overall_outcome` is `yellow`, `red`, `mixed`, or `blocked`.
- W6-B `validate_w6_packet_history(...)` remains authoritative for W6 packet-transition closure when packet evidence is present.

7. Make privacy and retention validator-ready.

Required machine-readable fields:

```yaml
privacy_audit_state:
  retention_mode: structured_extracts_only
  raw_transcript_retained: false
  excerpt_max_chars: int
  body_retention_allowed: boolean
  body_path_policy: none | private_sidecar_relative_only
  thought_or_reasoning_retained: false
  privacy_classification: private_raw | private_coordination | sanitized_public_candidate | never_public
  public_export_state: blocked | not_requested | candidate_needs_review | approved
```

Track B only defines validator-ready contract requirements here. Track E remains owner of evidence/privacy sufficiency acceptance.

8. Preserve project browseability fields without taking Track A ownership.

Track B should expose stable fields for future browse/index work:

- `run_id`
- `target_project_id`
- `target_project_name`
- `sequence_ref`
- `workflow_id`
- `overall_outcome`
- `terminal_stage`
- `packet_count`
- `approval_count`
- `selected_output_count`
- warning count or warning list

Track A remains owner of browse/index UX decisions.

## Out Of Scope

This W7-A-B review does not authorize or implement:

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
- router/OpenCode storage mutation
- public export or public-safe case study
- Track E privacy/evidence acceptance decisions
- Track A browse/index implementation
- Track D router/source adapter ownership
- Track C learning extractor or suggestion semantics

## Track E Handoff

Track E should review W7-A after this compatibility review for evidence and privacy sufficiency.

Recommended Track E focus:

- Whether `structured_extracts_only` is sufficient and enforceable.
- Whether `raw_transcript_retained: false` is strong enough as a default.
- Whether bounded excerpts need a specific max char limit before W7-A acceptance.
- Whether `body_path_policy: private_sidecar_relative_only` is acceptable or should be stricter for MVP.
- Whether `overall_outcome` values and warning/invalid states prevent false-green usefulness claims.
- Whether selected outputs, review synthesis, approval logs, and packet ledger entries are enough for later evaluation without raw transcript retention.
- Whether `public_export_state` and `privacy_classification` are sufficient for no-public-release defaults.

Track B does not decide Track E acceptance.

## Meta Acceptance Inputs

Before W7-A-META2 accepts the contract, Meta should decide or require updates for:

1. Rename all W7-A sidecar examples from `w8.*.v1` to `w7.*.v1`.
2. Keep `opencode_loop_summary.json` required with the minimal contract above, or explicitly defer it from W7-A MVP.
3. Accept `packet_ledger.json` only as derived sidecar evidence and not W6 packet law replacement.
4. Require W6-style path-safe validation for W7 IDs and refs before W7-B implementation.
5. Require current `trace_event.v1` generic event compatibility for MVP, with enum expansion deferred to a later gate.
6. Require machine-readable privacy/retention fields before ingest implementation.
7. Require false-green invariants that separate ingest success, review verdict, approval state, validation state, and commit readiness.
8. Keep W7-B blocked until W7-A-E and W7-A-META2 accept the revised contract.

Recommended next role: Track E `W7-A-E` evidence/privacy review, then Meta `W7-A-META2` acceptance closeout.

## Final Track B Position

The W7-A contract direction is compatible with Track B-owned runtime/schema boundaries if it remains an evidence-ingest contract over existing FAL artifacts and does not become a new controller, packet-law replacement, or raw transcript store.

W7-B implementation remains blocked until W7-A is accepted.
