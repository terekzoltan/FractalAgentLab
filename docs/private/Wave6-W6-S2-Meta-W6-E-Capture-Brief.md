# Wave6 W6-S2 Meta W6-E Capture Brief

## Status

Meta Coordinator capture brief for `W6-E` Step 1.

Execution mode: `manual_policy_driven`

Visibility / audit state:

- git-visible commits and governance docs were consulted
- local-only `ops/` coordination docs were consulted for current sequencing and project-state truth
- no raw `data/evidence/wave6/**` artifact was consulted while writing this brief
- conclusions depend partly on local-only `ops/PROJECT_STATE.md` state because the selected loop is explicitly about state-continuity governance

Readiness verdict: `GREEN` for Track E W6-E capture/evaluation, with the guardrails below.

## Purpose

`W6-E` must add a second private evidence loop with a different task/risk shape from `W6-D`.

`W6-D` tested whether the ledger could preserve a high-severity implementation review/fix loop. `W6-E` should test whether the ledger can preserve a governance and context-continuity loop where the main risk is stale coordination state rather than production-code failure.

## Selected Target

Capture target:

- loop: Project State Continuity Protocol creation, Hungarian state requirement, commit, compact restore, stale next-action detection, and state repair
- loop id: `w6e-fal-project-state-protocol-20260511`
- target repo: `FractalAgentLab`
- task type: `project_state_continuity_governance_loop`
- complexity class: `governance_context_continuity`
- mode: `fal_evidence_backed`

Primary reason:

- The loop is materially different from W6-D: it is a Meta/governance workflow with local-only state, tracked policy docs, a compact-restore check, and a real stale-state mismatch that was fixed before green readiness.

Recommended recorder fields:

```text
schema_version: w6.manual_evidence_input.v1
loop_id: w6e-fal-project-state-protocol-20260511
target_repo: FractalAgentLab
sequence_ref: W6-S2/W6-E/step1-second-task-class-evidence-loop
task_type: project_state_continuity_governance_loop
complexity_class: governance_context_continuity
mode: fal_evidence_backed
net_recommendation: insufficient_data
```

`net_recommendation` should remain `insufficient_data` unless the capture itself clearly shows the ledger is useful, harmful, or too costly for this task class. W6-E is still evidence expansion, not bridge/API readiness.

## Ownership Boundaries

Meta Coordinator owns:

- target selection
- this capture brief
- privacy and no-claim boundaries
- final decision after Track E returns W6-E evidence

Track E owns:

- W6-C recorder input assembly
- running the recorder
- private output inspection
- usefulness interpretation for this second task class
- continue / narrow / stop / insufficient-data recommendation to Meta

Selected originating role/source context:

- Meta Coordinator is the selected evidence-source role for this W6-E target.
- There is no new production-code Track implementation ownership in this target.
- Track E should treat this as a governance/context-continuity loop, not as Track E implementation work.

## Required Packet Chain

Track E should build one recorder input whose packets form this state-machine path:

| Order | Packet ID | Stage | Decision | Preferred source_command | Meaning |
|---|---|---|---|---|---|
| 1 | `w6e-governance-plan-ready` | `plan_ready_for_meta_review` | null | `manual_operator_action` | User requested the project-state continuity fix and Hungarian state rules; Meta prepared the governance scope |
| 2 | `w6e-governance-plan-review` | `meta_plan_review_done` | `greenlit` | `manual_operator_action` | Meta accepted the governance/documentation scope and no-production-code boundary |
| 3 | `w6e-governance-plan-ack` | `plan_review_acknowledged` | null | `manual_operator_action` | Meta proceeded with tracked governance docs plus local ops updates |
| 4 | `w6e-governance-done` | `implementation_done` | null | `manual_operator_action` | Protocol docs were updated and committed in `01f35d4`; local `ops/PROJECT_STATE.md` was created |
| 5 | `w6e-context-restore-yellow` | `step_review_done` | `fix_required` | `manual_operator_action` | After compact restore, the state file was found mostly correct but stale because it still said governance docs needed commit |
| 6 | `w6e-state-fix-done` | `review_fix_done` | null | `manual_operator_action` | Local `ops/PROJECT_STATE.md` was corrected to point to W6-E target selection/capture brief |
| 7 | `w6e-ready-green` | `step_review_done` | `pass` | `manual_operator_action` | Meta readiness became GREEN for W6-E target selection and Track E handoff |
| 8 | `w6e-tracke-ack` | `step_review_acknowledged` | null | `manual_operator_action` | Track E may capture/evaluate the selected governance loop from this brief |

Rules:

- Use only known `source_command` values.
- Use `Meta Coordinator` as the originating role/source context, not `unknown`.
- Every packet must use the same `loop_id` and `sequence_ref`.
- `parent_packet_id` should reference the immediately prior packet after the first packet.
- `privacy_classification` must be `private_raw`.
- Do not use `sanitized_public` in recorder packets.

## Review Findings To Preserve

This W6-E target has no known high-severity production-code review findings.

Track E should still preserve the governance finding if represented in the recorder input:

| Finding ID | Severity | Status | Owner Context | Summary |
|---|---|---|---|---|
| `W6E-STATE-STALE-NEXT-ACTION` | `medium` | `fixed` | Meta Coordinator | `ops/PROJECT_STATE.md` was structurally valid and Hungarian, but stale after `01f35d4` because its next action still said to commit governance docs |

Finding rules:

- Do not inflate this into a high-severity implementation defect.
- Do not claim production-code test coverage from this loop.
- If Track E decides this is only a warning, record it as warning-grade state-continuity evidence rather than a formal review finding.

## Required Payload Semantics

`payload_summary` is only an index. It is not semantic proof.

Packet payloads should carry enough concrete evidence for Track E to audit:

- user request: Hungarian `ops/PROJECT_STATE.md`, required `wave / sprint / step / epic`, and shared bootloader only
- changed tracked docs: `docs/private/Project-State-Continuity-Protocol-v01.md`, `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- commit: `01f35d4 Add project state continuity protocol`
- local-only state: `ops/PROJECT_STATE.md`
- compact restore result: readiness was `YELLOW` only because of stale next-action wording
- fix result: readiness moved to `GREEN` after `ops/PROJECT_STATE.md` pointed to W6-E target selection/capture brief
- no-claim boundary: this is governance/context-continuity evidence, not OpenCode bridge/API readiness

## Evidence References To Prefer

Track E should prefer concrete, durable references over chat-memory-only claims:

- commit `01f35d4 Add project state continuity protocol`
- `docs/private/Project-State-Continuity-Protocol-v01.md`
- `docs/private/Coding-Vertical-Review-Gate-Policy-v01.md`
- `ops/PROJECT_STATE.md`
- `ops/Combined-Execution-Sequencing-Plan.md`
- `ops/Meta-Coordinator-Runbook.md`
- `docs/private/Wave6-W6-S2-Meta-W6-E-Capture-Brief.md`

Important evidence boundary:

- `ops/PROJECT_STATE.md` and the wider `ops/` docs are ignored/local-only.
- Track E must report that this W6-E target depends on local-only state evidence.
- Do not present the local-only state file as a public case-study artifact.

## Final Status Rules

Track E should choose `final_status` as follows:

- `pass`: only if the recorder input validates, the loop closes cleanly, the stale-state mismatch is represented accurately, and no missing required governance evidence remains.
- `pass_with_warnings`: use if the loop is useful but depends materially on local-only state, chat-derived context, or non-test verification.
- `hold`: use if the loop is too Meta/self-referential to support W6-F usefulness evaluation without another target.
- `blocked`: use if the capture cannot be assembled without fabricating packet history or violating private/local boundaries.

Even if the recorder returns `clean_pass: true`, Track E must separately interpret the governance/state finding. Clean transition validation is not proof that the state-continuity protocol was useful.

## Required W6-E Outputs

Track E must produce private/local outputs through W6-C:

```text
data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/packets/*.json
data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/ledger.json
data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/review_findings.json
data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/usefulness_row.json
data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/summary.md
```

Track E should also return a short handoff to Meta with:

- recorder command used
- script exit status
- output paths
- `final_status`
- `clean_pass`
- computed transition validation status
- review findings count and statuses
- missing/skipped checks count
- recommendation: `continue`, `narrow`, `stop`, or `insufficient_data`

## Suggested Recorder Command

After assembling the private operator input JSON, Track E should run:

```bash
PYTHONPATH=src python scripts/run_w6_c_manual_evidence_recorder.py --input <operator-input-json> --data-dir data
```

The operator input JSON is private raw evidence. It does not become public-safe merely because the recorder accepts it.

## Acceptance Criteria

W6-E capture/evaluation is acceptable only if:

- recorder input validates without partial writes
- output is under `data/evidence/wave6/loops/w6e-fal-project-state-protocol-20260511/`
- transition validation source and status are clearly reported
- the stale-state mismatch is either recorded as `W6E-STATE-STALE-NEXT-ACTION` or explicitly treated as warning-grade evidence
- `usefulness_row.json` distinguishes governance/context-continuity usefulness from implementation-review usefulness
- `summary.md` does not claim broad usefulness proof, public case-study readiness, OpenCode automation, bridge/API delivery, commit automation, or push automation
- Track E gives Meta a continue/narrow/stop/insufficient-data recommendation

## Risks And Edge Cases

- This target is Meta/governance-heavy; Track E must not overstate it as proof for coding implementation loops.
- Local-only `ops/` evidence is useful for private learning but weaker for public/sanitized claims.
- The loop contains a fixed state mismatch, not a production-code bug.
- If this target feels too self-referential, Track E should say so and recommend narrowing or selecting a third loop before W6-F.
- W6-E still cannot justify W6-G bridge/API readiness by itself.

## Next Gate

Track E may start W6-E capture/evaluation from this brief.

Meta should not open W6-F until Track E returns W6-E evidence and Meta accepts the result as useful enough for combined W6-D + W6-E evaluation.
