# Wave6 W6-S1 TrackB W6-B State Machine Validator

## Status

Track B delivery note for `W6-B` packet state-machine validation.

Execution mode: `opencode_assisted`

Visibility / audit state:

- git-visible code and tests were updated
- local-only `ops/` coordination docs were consulted
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md` remains untracked local/private context

## Scope Delivered

Track B delivered the W6-B contract layer only:

- `W6LoopFinalState` state vocabulary
- `W6StateMachineValidationResult` result object
- `validate_w6_packet_history(...)` over W6-A packet validation results
- transition-history validation for W6-S1 packet loops
- false-green guards for missing greenlight, missing plan acknowledgement, blocked/hold/deep-review paths, and fix cycles
- targeted negative-path tests

## Contract Decisions

### Input Model

- The validator consumes ordered `W6PacketValidationResult` values from W6-A validation.
- Input order is authoritative; the validator does not sort by timestamp.
- Invalid W6-A packets fail state-machine validation and cannot become clean history evidence.
- Warning-grade W6-A packets can still pass state-machine validation when transition rules pass; warnings are propagated.
- All packets in one history must share `loop_id`.
- `packet_id` values must be unique within the history.
- `parent_packet_id`, when present, must reference an earlier packet in the same history.
- `sequence_ref` mismatch inside one loop is warning-grade in W6-B.

### Final States

The W6-B final-state vocabulary is:

- `awaiting_plan_review`
- `awaiting_plan_ack`
- `awaiting_implementation`
- `awaiting_step_review`
- `fix_required`
- `hold`
- `extension_required`
- `closed_pass`
- `blocked`

### Transition Rules

- A plan review requires a preceding `plan_ready_for_meta_review` packet.
- `plan_review_acknowledged` is valid after `greenlit`, `changes_requested`, or `blocked` plan-review decisions.
- `implementation_done` requires `meta_plan_review_done: greenlit` plus `plan_review_acknowledged`.
- `changes_requested` returns the loop to `awaiting_plan_review` after acknowledgement.
- `blocked` moves the loop to `blocked` after acknowledgement.
- A blocked loop can continue only with a new `plan_ready_for_meta_review` packet.
- The new plan packet after `blocked` should document the unblock/replan rationale in its existing plan payload fields; W6-B does not add a new payload schema field.
- `step_review_done` requires a preceding `implementation_done` or `review_fix_done`.
- `step_review_done: pass` is not closed until `step_review_acknowledged`.
- `step_review_done: fix_required` requires `review_fix_done` before another passing review can close the loop.
- `step_review_done: hold` is not pass and is not commit-ready.
- `step_review_done: deep_review_needed` becomes `extension_required`; it is not pass, not closed, and not an automatic fix cycle.
- `closed_pass` sets `closed=True` and `commit_ready_candidate=True` only as a contract-level candidate state.
- Invalid whole histories never expose `closed=True`, `commit_ready_candidate=True`, or `final_state=closed_pass`.

## Explicit Non-Goals

Not delivered under `W6-B`:

- evidence recorder or writer behavior
- usefulness/eval scoring semantics
- OpenCode bridge/API/session delivery
- UI/dashboard work
- commit or push automation
- new deep-review packet family
- payload semantic classification beyond W6-A stage-local required fields

## Downstream Handoff

### W6-C / Track E

Track E can use `validate_w6_packet_history(...)` before recording a loop as clean evidence. Track E still owns recorder behavior, evidence sufficiency fields, usefulness row shape, finding interpretation, and false-green evaluation semantics.

### Track C Checkpoint

Track C remains the checkpoint for payload meaning if W6-C relies on payload content as workflow evidence. W6-B validates transition order and contract states, not prompt or role semantics.

## Validation

Targeted tests cover:

- happy path closure with `closed_pass`
- `changes_requested` reset through a new plan
- `blocked` reset through a new plan
- missing greenlight rejection
- missing plan acknowledgement rejection
- blocked path rejection without new plan
- fix-required cycle rejection without `review_fix_done`
- fix-required cycle closure after `review_fix_done` and passing acknowledgement
- post-closure packet rejection without commit-ready flags
- `hold` not becoming closed or commit-ready
- `deep_review_needed` becoming `extension_required`
- invalid W6-A packet rejection
- warning propagation from W6-A validation
- duplicate packet IDs
- mixed loop IDs
- unknown, future, and self parent refs
- warning-grade `sequence_ref` mismatch
