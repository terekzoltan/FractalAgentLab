# Coordination-Layer-Packet-Bus-v02

## Status

Private Wave 6 packet/state design note.

This document narrows the broader `v01` packet-bus direction into the Wave 6 MVP loop.

Authority:

- `docs/private/Coordination-Layer-Packet-Bus-v01.md` remains the broader packet-law and transport-ladder reference.
- `docs/private/OpenCode-Orchestration-Layer-v01.md` explains the Wave 6 strategic correction.
- This document defines the MVP packet family, state machine, and evidence-ledger fields for the OpenCode Meta/Track development loop.

## Design Intent

The Wave 6 MVP is not a universal packet platform.

It only proves this loop:

> Track plans -> Meta reviews -> Track acknowledges -> Track implements -> Meta reviews -> Track fixes or proceeds -> evidence is recorded.

OpenCode remains the session runtime. Fractal Agent Lab records, validates, and later evaluates the loop.

## MVP Packet Types

Packet scope is intentionally limited to the Meta/Track implementation loop.

Allowed MVP stages:

- `plan_ready_for_meta_review`
- `meta_plan_review_done`
- `plan_review_acknowledged`
- `implementation_done`
- `step_review_done`
- `step_review_acknowledged`
- `review_fix_done`

Allowed MVP decisions:

- `greenlit`
- `changes_requested`
- `blocked`
- `pass`
- `fix_required`
- `hold`
- `deep_review_needed`

Deferred packet families:

- `wave_start`
- `seq_next` as a general command family beyond `plan_ready_for_meta_review`
- `launch`
- `reminder`
- `compact`
- `commit_decision`
- UI-originated packets
- future session-bus packets

## Minimum Packet Envelope

Every MVP packet should carry this envelope:

```yaml
schema_version: w6.packet.v1
packet_id: string
loop_id: string
stage: string
producer: meta | track | router
consumer: meta | track | router
originating_track: track_a | track_b | track_c | track_d | track_e | meta | unknown
target_track: track_a | track_b | track_c | track_d | track_e | meta | unknown
sequence_ref: string
source_command: string
decision: string | null
created_at: iso8601-string
parent_packet_id: string | null
artifact_refs: array
payload_summary: string
payload: object
visibility_audit_state: string
privacy_classification: private_raw | sanitized_public | mixed
validation: object
```

Field intent:

- `loop_id` groups one plan/review/implementation/review/fix cycle.
- `stage` is the state-machine position.
- `source_command` records the OpenCode command or operator action that produced the packet.
- `decision` is nullable because not every packet is a decision packet.
- `artifact_refs` links plans, docs, run artifacts, diffs, tests, or review notes without embedding everything inline.
- `privacy_classification` prevents accidental public-case-study leakage.
- `validation` records schema validation and transition checks.

## Stage Payload Requirements

### `plan_ready_for_meta_review`

Producer:

- Track session

Consumer:

- Meta Coordinator

Required payload:

- implementation plan summary
- assumptions
- risks
- dependencies
- affected files or surfaces
- proposed acceptance checks
- explicit non-goals

Decision:

- null

### `meta_plan_review_done`

Producer:

- Meta Coordinator

Consumer:

- originating Track

Required payload:

- findings-first plan review
- required plan changes
- blockers
- residual risks
- Meta guidance
- track-facing handoff summary

Decision:

- `greenlit`
- `changes_requested`
- `blocked`

### `plan_review_acknowledged`

Producer:

- Track session

Consumer:

- Meta Coordinator or router

Required payload:

- consumed review packet reference
- Track response
- planned next action

Decision mapping:

- `greenlit` -> Track may proceed to implementation
- `changes_requested` -> Track revises plan and re-emits `plan_ready_for_meta_review`
- `blocked` -> Track stops and reports blocker

### `implementation_done`

Producer:

- Track session

Consumer:

- Meta Coordinator

Required payload:

- implementation summary
- changed files
- tests/checks run
- missing tests or skipped checks
- deviations from accepted plan
- known gaps
- exact review request

Decision:

- null

### `step_review_done`

Producer:

- Meta Coordinator

Consumer:

- originating Track

Required payload:

- findings-first implementation review
- missing tests
- required fixes
- residual risks
- commit-readiness recommendation
- whether deep review is needed

Decision:

- `pass`
- `fix_required`
- `hold`
- `deep_review_needed`

### `step_review_acknowledged`

Producer:

- Track session

Consumer:

- Meta Coordinator or router

Required payload:

- consumed review packet reference
- Track response
- final completion acknowledgement or next action

Decision:

- null

### `review_fix_done`

Producer:

- Track session

Consumer:

- Meta Coordinator

Required payload:

- fixed findings
- files changed during fix
- validation rerun summary
- residual risk note
- re-review request

Decision:

- null

## MVP State Transitions

Allowed transitions:

```text
plan_ready_for_meta_review
  -> meta_plan_review_done

meta_plan_review_done(decision=greenlit)
  -> plan_review_acknowledged
  -> implementation_done

meta_plan_review_done(decision=changes_requested)
  -> plan_review_acknowledged
  -> plan_ready_for_meta_review

meta_plan_review_done(decision=blocked)
  -> plan_review_acknowledged
  -> hold/stop

implementation_done
  -> step_review_done

step_review_done(decision=pass)
  -> step_review_acknowledged
  -> loop complete

step_review_done(decision=fix_required)
  -> step_review_acknowledged
  -> review_fix_done
  -> step_review_done

step_review_done(decision=hold)
  -> step_review_acknowledged
  -> hold/stop

step_review_done(decision=deep_review_needed)
  -> deep review extension route
```

Blocked transitions:

- `implementation_done` before a `greenlit` Meta plan review
- `pass` without a prior implementation review packet
- `review_fix_done` without a prior `fix_required`
- commit-readiness before `pass` or explicit `hold` resolution
- packet forwarding when schema validation fails
- raw output forwarding without packet validation and provenance

## Evidence Ledger Fields

The evidence ledger should store one row/event per packet transition.

Minimum event fields:

```yaml
ledger_schema_version: w6.evidence_ledger.v1
loop_id: string
packet_id: string
stage: string
decision: string | null
producer: string
consumer: string
originating_track: string
sequence_ref: string
created_at: iso8601-string
received_at: iso8601-string | null
artifact_refs: array
changed_files: array
tests_run: array
missing_tests: array
findings_count: integer | null
accepted_findings_count: integer | null
rejected_findings_count: integer | null
manual_intervention_count: integer | null
copy_paste_avoided_count: integer | null
privacy_classification: string
validation_status: pass | fail | warning
validation_warnings: array
```

The first implementation may keep this as local/private evidence. It does not need to become a public schema before usefulness is proven.

## Validation Rules

Hard validation failures:

- missing `packet_id`
- missing `loop_id`
- unknown `stage`
- unknown `decision` where a decision is required
- invalid producer/consumer pair
- transition violates the allowed state machine
- packet claims public/sanitized status while containing private raw evidence markers

Warning-grade validation issues:

- missing optional metrics
- unknown Track label
- missing copy-paste estimate
- missing manual intervention estimate
- incomplete artifact references when the packet is still useful for manual audit

## Router / Bridge Boundary

The router/bridge may eventually deliver packets to OpenCode sessions through supported OpenCode API/server surfaces.

MVP boundary:

- recording packets is allowed first
- delivering packets is second
- receiving outputs is third
- direct mutation of OpenCode storage internals is forbidden
- hidden background execution is forbidden
- failed delivery must be visible and recorded

## Commit Boundary

Commit readiness may be recorded as evidence.

The MVP must not execute commits or pushes.

Commit execution remains an operator / explicit Meta-approved action outside W6 packet automation.

## Public Sanitization Boundary

Raw packets and ledger rows are private by default.

Public case-study extraction must remove or generalize:

- exact prompt text
- secrets or environment values
- repo-private file paths when sensitive
- private gate heuristics
- failure-corpus details that reveal operating edge
- target-repo confidential context

Sanitized output can retain:

- stage flow
- high-level timing/friction metrics
- counts of findings and fixes
- non-sensitive summary of value or failure
- generalized lessons

## Readiness For Implementation

Implementation readiness is YELLOW until:

- Wave 5 closes or Meta explicitly re-sequences W6 prep
- at least one real loop candidate is selected
- privacy/storage path is chosen
- OpenCode server/API assumptions are verified
- validation rules are accepted by Meta and Track B
