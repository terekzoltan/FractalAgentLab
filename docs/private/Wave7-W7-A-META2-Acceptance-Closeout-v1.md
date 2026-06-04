# Wave7 W7-A-META2 Acceptance Closeout v1

## Status

Meta Coordinator acceptance closeout for `W7-A`.

Execution mode: `opencode_assisted`

Scope verdict: `contract_acceptance_closeout_only`

W7-A contract verdict: `accepted_with_contract_revisions`

W7-B implementation allowed immediately: `false`

W7-B implementation planning allowed: `true`

Bridge/API/session delivery allowed: `false`

Controller mode allowed: `false`

Browser-side execution allowed: `false`

Commit/push automation allowed: `false`

Raw transcript default allowed: `false`

Reviewed inputs:

- `docs/private/Wave7-W7-A-META1-Contract-Adoption-Review-v1.md`
- `docs/private/Wave7-W7-A-B-Contract-Compatibility-Review-v1.md`
- `docs/private/Wave7-W7-A-E-Evidence-Privacy-Review-v1.md`
- `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`
- `src/fractal_agent_lab/evals/artifact_acceptance.py`
- `ops/PROJECT_STATE.md`
- `ops/Combined-Execution-Sequencing-Plan.md`

## Meta Decision

`W7-A` is accepted after contract revisions.

The accepted contract remains evidence-layer-first. It represents OpenCode-backed loops as FAL-ingested run/trace/artifact evidence and does not authorize FAL to control OpenCode sessions, browser execution, commits, pushes, or router mutation.

`W7-B` may open for Track B / Track D planning and Meta plan review. Production/source implementation remains blocked until those plans are reviewed and file scope is declared.

## Revisions Applied To W7-A Contract

Meta applied the required Track B and Track E changes to `docs/private/Wave7-W7-A-OpenCode-Backed-Loop-Contract-v1.md`:

1. `w8.*.v1` sidecar schema labels changed to `w7.*.v1`.
2. `opencode_loop_summary.json` is required for W7-A MVP.
3. `output_payload.step_results` is required for succeeded W7 runs to stay compatible with current artifact acceptance.
4. `privacy_audit_state` is machine-readable and required for MVP.
5. Excerpt bounds are explicit with `excerpt_max_chars` and truncation fields.
6. MVP body retention defaults to `body_retention_allowed: false` and `body_path_policy: none`.
7. Public export remains blocked/not-requested/candidate-only unless a separate export-review artifact exists.
8. False-green rules separate FAL ingest success from OpenCode task success, review approval, validation state, clean-pass eligibility, and commit readiness.
9. Trace event enum expansion is deferred; W7 MVP remains compatible with existing `trace_event.v1` generic events plus payload markers.

## Acceptance Conditions For W7-B Planning

Track B / Track D W7-B planning may start only under these constraints:

- plan first, implementation second
- no source code changes until Meta reviews the Track plan
- no router/OpenCode session mutation
- no browser-side OpenCode control
- no commit/push automation
- no raw transcript hoarding
- no public export
- disjoint file scope required before parallel Track B / Track D implementation
- Track E validation/privacy cases must be planned before W7-C

## W7-B Planning Handoff

Recommended next planning split:

1. Track B `W7-B1` plan: canonical artifact writer, validators, path-safe IDs, run/trace/artifact shape, and compatibility tests.
2. Track D `W7-B2` plan: local router/OpenCode selected-output reader/adapter only, no session control or mutation.
3. Meta review: verify disjoint file scopes and dependency order before implementation.

Required W7-B acceptance focus:

- generated artifacts include `output_payload.step_results`
- `opencode_loop_summary.json` exists and carries privacy/false-green summary fields
- sidecars use `w7.*.v1` schema labels
- path-safe validation covers `run_id`, `target_project_id`, `external_loop_id`, refs, and `body_path` if ever allowed
- privacy audit state is machine-readable
- invalid or warning validation cannot produce clean-green claims

## Explicit Non-Goals Preserved

W7-A acceptance does not authorize:

- OpenCode bridge/API/session delivery
- controller mode
- automatic dispatch
- browser-side execution
- commit/push automation
- raw transcript retention by default
- public release or public-safe case study
- HUB implementation
- Track A workbench implementation before W7-B/C artifact shape stabilizes
- Track C learning/suggestion implementation before accepted ingest artifacts exist

## Final Meta Position

`W7-A` is accepted as a contract gate. Wave 7 may proceed to `W7-B` planning under the existing serial/parallel rules, with implementation still gated by Track-authored plans, Meta plan review, and scope containment.
