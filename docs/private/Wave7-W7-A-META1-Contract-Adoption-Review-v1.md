# Wave7 W7-A META1 Contract Adoption Review v1

## Status

Meta Coordinator review artifact for `W7-A-META1`.

Execution mode: `opencode_assisted`

Visibility / audit state:

- consulted `ops/PROJECT_STATE.md` and `ops/Combined-Execution-Sequencing-Plan.md`
- consulted `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- consulted `docs/private/Wave7-OpenCode-Evidence-Learning-Layer-Plan-v1.md`
- consulted W6/W6.5 contract inputs and `ops/Review-Findings-Registry.md`
- no source implementation, ingest CLI, bridge/API/session delivery, browser-side execution, commit/push automation, public export, or raw transcript retention was authorized

## Verdict

```yaml
wave: W7
step: W7-A-META1
target: OpenCode-backed loop contract adoption review
verdict: READY_WITH_GUARDRAILS
next_step: W7-A-B Track B contract compatibility review
w7_b_implementation_allowed: false
bridge_api_session_delivery_allowed: false
controller_mode_allowed: false
raw_transcript_default_allowed: false
public_export_allowed: false
```

## Review Findings

### High

1. Sidecar schema examples use `w8.*.v1` names inside a Wave 7 contract.

Impact:

- could imply Wave 8 authority or future compatibility before W7 acceptance
- must be resolved or explicitly justified by Track B before W7-A acceptance

Required Track B action:

- rename sidecar schema examples to `w7.*.v1`, or provide a clear compatibility rationale that Meta can review

2. Path-safe ID requirements must be made explicit before ingest implementation.

Impact:

- W6 already found path traversal/collision risk in evidence path helpers
- W7 introduces `run_id`, `target_project_id`, `external_loop_id`, `packet_ref`, `selected_output_ref`, and `body_path` surfaces that can become path or privacy hazards

Required Track B action:

- carry forward W6-style validation for path-segment IDs: reject separators, traversal, empty/whitespace values, reserved artifact filenames, and Windows reserved device names

3. `opencode_loop_summary.json` is required but not yet contract-defined.

Impact:

- a required sidecar without fields weakens later browse/evidence validation

Required Track B action:

- define a minimal sidecar contract or mark it non-required for the W7-A MVP

### Medium

1. `packet_ledger.json` must remain a W7 sidecar over W6 packet/evidence law, not a replacement for `w6.packet.v1`.

Required Track B action:

- state whether packet ledger entries are derived evidence, packet refs, or canonical packet-schema extensions

2. New trace event types may exceed current `trace_event.v1` consumer expectations.

Required Track B action:

- decide whether W7 uses guarded enum expansion or existing generic event kinds with W7 payload markers for the MVP

3. False-green invariants are not yet precise enough.

Required Track B action:

- keep runtime success, review verdict, approval state, validation state, and commit-readiness separate
- block green/pass when decisions are `hold`, `blocked`, `deep_review_needed`, approvals are missing, or validation is `warning`/`invalid`

4. Privacy/retention rules need validator-ready details.

Required Track B action:

- define bounded excerpt limits, body retention policy, body path allowlist, raw transcript rejection, privacy classification requirements, and local path/session-id handling

### Low

1. `loop_entry_mode` and W6.5 `automation_mode` overlap.

Required Track B action:

- clarify whether one field maps to the other or whether both remain intentionally distinct

2. Browseability by project id is accepted as a W7-A criterion, but lookup/index expectations can stay deferred to Track A as long as Track B exposes stable artifact fields.

## Guardrails For Track B W7-A-B

Track B may proceed with `W7-A-B` only as a contract compatibility review.

Track B should answer:

1. How does the proposed run artifact stay `run_state.v1` compatible without implying FAL executed the loop?
2. What exact trace event compatibility path is accepted for `trace_event.v1` consumers?
3. Are sidecar schema labels `w7.*.v1`, and if not, why?
4. Is `packet_ledger.json` derived sidecar evidence rather than new packet law?
5. Which ID/path validator is reused or extended from W6?
6. What invariants prevent false green/pass when approval, validation, or review decision state is unsafe?
7. What is the minimal `opencode_loop_summary.json` contract?
8. What privacy fields are machine-readable and validator-ready?

Track B must not:

- implement W7-B ingest CLI yet
- mutate OpenCode sessions or storage
- authorize controller mode
- authorize browser-side execution
- authorize commit/push automation
- default to raw transcript retention
- create public/export assumptions without Track E review

## Deferred Finding Routing

`in-scope now` for W7-A-B:

- RF-2026-05-08-01 path-safe evidence IDs
- RF-2026-05-08-02 invalid closed-history false-green prevention
- RF-2026-05-08-03 clean-pass false-green prevention
- RF-2026-05-11-01 malformed validation/advisory-positive prevention
- RF-2026-05-12-01 explicit sequential role handoff wording

`not-yet-in-scope`:

- W7-B ingest CLI implementation
- W7-C validation implementation
- W7-D workbench/index implementation
- W7-E learning extractor implementation
- W7-G suggestions
- Wave 8 HUB compatibility

## Meta Decision

`W7-A-META1` returns `READY_WITH_GUARDRAILS`.

The next correct step is Track B `W7-A-B` contract compatibility review. This does not unlock W7-B implementation.

## Track B Handoff Message

Track B may start `W7-A-B` as a contract compatibility review. Please review `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md` against existing `run_state.v1`, `trace_event.v1`, W6 packet/evidence law, W6 path-safety lessons, and W6.5 `external_project_context.v0`. Return a compatibility verdict plus concrete required contract changes. Do not implement ingest CLI or artifact writers yet.
