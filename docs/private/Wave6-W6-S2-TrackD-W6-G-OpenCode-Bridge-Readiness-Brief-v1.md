# Wave6 W6-S2 TrackD W6-G OpenCode Bridge Readiness Brief v1

## Status

Track D readiness draft for `W6-G`.

Execution mode: `opencode_assisted`.

Scope verdict: `docs_only_readiness_brief`.

Final W6-G acceptance status: `not_final_until_track_b_support_and_meta_step_review`.

## Explicit Verdict

```yaml
verdict: do_not_implement_now
allowed_verdict_values:
  - do_not_implement_now
  - defer_pending_external_target
  - narrow_spike_only_later
  - implement_now_disallowed
fallback_future_option: narrow_spike_only_later
fallback_future_option_conditions:
  - future Meta-opened step only
  - no direct OpenCode storage mutation
  - no hidden background execution
  - Track B packet/state/ledger support review completed first
  - failed delivery remains visible and recorded
```

Track D recommendation: do not build OpenCode bridge/API/session delivery in `W6-G`.

The strongest acceptable future direction is a later, explicitly Meta-opened, no-mutation feasibility spike. That spike should remain narrower than delivery automation and should first prove OpenCode API assumptions without weakening the W6 packet/state/ledger contracts.

## Purpose

`W6-G` decides whether OpenCode bridge/API work is justified after the Wave 6 evidence-ledger slice produced enough value to discuss bridge readiness.

This brief answers that question from Track D's bridge/router/transport perspective. It does not implement transport, define new packet law, or make final Meta acceptance decisions.

## Inputs Reviewed

- `ops/PROJECT_STATE.md`
- `ops/Combined-Execution-Sequencing-Plan.md` W6-S2 / W6-G section
- `ops/AGENTS.md` Track D and Track B status notes
- `ops/Track-D-Runbook.md`
- `ops/Track-Implementation-Runbook.md`
- `docs/private/OpenCode-Orchestration-Layer-v01.md`
- `docs/private/Coordination-Layer-Packet-Bus-v02.md`
- `docs/private/Wave6-OpenCode-Evidence-Ledger-Detailed-Plan-v1.md`
- `docs/private/Coding-Vertical-Usefulness-Eval-v01.md`
- `docs/private/Wave6-W6-S2-TrackE-W6-E-Second-Loop-Capture.md`
- `docs/private/Wave6-W6-S2-TrackE-W6-F-Usefulness-Evaluation-v1.md`

Source-surface check method:

- searched `src/**/*.py` for `OpenCode API`
- searched `src/**/*.py` for `bridge`
- searched `src/**/*.py` for `session bus`

Observed source-surface result:

- no `OpenCode API` source implementation found
- no `session bus` source implementation found
- `bridge` appears only in W6 usefulness-evaluation readiness-implication wording, not as a transport surface

## W6-F Evidence Caveat Summary

`W6-F` supports only a narrow readiness discussion:

- `overall_recommendation: optional`
- `confidence: low`
- `evidence_quality: low`
- `fal_only_evidence: true`
- `external_evidence_present: false`
- `bridge_readiness_implication: may_support_narrow_w6g_readiness_brief_after_meta_review_only`

Important limits carried forward:

- the evaluated rows are FractalAgentLab-only
- no external target repository loop has been evaluated
- both evaluated classes are warning-grade or low-confidence evidence
- W6-F explicitly does not authorize OpenCode API/session delivery
- W6-F explicitly does not authorize commit or push automation
- W6-H/W6-I external target readiness remains separate

## Decision Matrix

| Option | Current verdict | Why |
|---|---|---|
| `do_not_implement_now` | selected | W6-F is optional, low-confidence, FAL-only evidence; external API assumptions are unverified; delivery would outrun the evidence. |
| `defer_pending_external_target` | viable later | W6-H/W6-I may produce external target evidence, but that work is not opened by W6-G. |
| `narrow_spike_only_later` | viable only under later Meta step | A no-mutation feasibility spike may be useful after Track B support review and explicit Meta opening. |
| `implement_now_disallowed` | enforced boundary | W6-G is a readiness brief, not a delivery step. |

## OpenCode Integration Assumptions

Unverified assumptions that block delivery work now:

- supported OpenCode API/server surfaces are stable enough for external orchestration
- session targeting and message delivery can be done without hidden mutation of OpenCode internals
- delivery failures can be observed by FAL and represented without inventing new packet semantics
- output receipt can be tied back to a W6 packet/ledger entry without ambiguity
- credentials, local paths, and session identifiers can be handled without leaking private workflow evidence
- direct command-assisted OpenCode remains insufficient for the target task class

Track D should not treat these assumptions as true until a later approved feasibility step verifies them.

## Storage / Session Mutation Risk Review

Hard boundaries:

- no direct mutation of OpenCode storage internals
- no hidden background execution
- no unattended session chaining
- no implicit commit or push path
- no raw private evidence forwarding into public or external surfaces

Primary risks:

- a transport layer could mutate session state in ways the operator cannot inspect
- a bridge could bypass the packet state machine and recreate false-green behavior
- delivery retries could duplicate or reorder packets without ledger truth
- received output could be mistaken for validated packet evidence
- private prompts, findings, or heuristics could leak through forwarded payloads

Required future controls before any delivery spike:

- explicit no-mutation adapter boundary
- visible failure envelope for failed delivery
- traceable delivery attempt record
- operator-visible handoff surface
- Track B validation that packet/ledger truth remains authoritative

## Delivery Vs Capture Distinction

Current allowed layer:

- record packets
- validate packet history
- record private evidence rows
- evaluate usefulness from recorded evidence
- write readiness and risk briefs

Deferred delivery layer:

- send packets to OpenCode sessions
- receive output from sessions
- route packets between sessions
- retry failed delivery
- schedule or chain work

Forbidden in W6-G:

- bridge/API/session delivery implementation
- automatic delivery
- session bus work
- direct storage mutation
- commit automation
- push automation

## Track B Support Required Before Completion

Track B support review is required before final W6-G acceptance.

Track B should validate or reject these questions:

- Can a future no-mutation feasibility spike consume `w6.packet.v1` without adding packet stages?
- Can failed delivery be represented by existing packet/ledger artifacts, or must it remain out of scope?
- Would receiving OpenCode outputs require new transition law?
- Would delivery attempts need a new validation status, or can they remain non-canonical attempt evidence?
- Does any proposed bridge boundary weaken `validate_w6_packet_history(...)` or commit-ready false-green protections?

Track D does not define new packet stages, transition law, or ledger semantics in this draft.

## What Track D Does Not Decide

Track D does not decide:

- final W6-G acceptance
- W6 packet/state/ledger contract truth
- W6-H/W6-I external target readiness
- public case-study readiness
- commit or push policy
- whether a future bridge spike is opened

## Acceptance Criteria Check

- W6-G brief says bridge/API/session delivery implementation is not permitted: satisfied.
- W6-G brief says W6-F evidence is optional, low-confidence, and FAL-only: satisfied.
- W6-G brief says Track B support is required before final W6-G acceptance: satisfied.
- W6-G brief contains a decision matrix and explicit recommendation: satisfied.
- W6-G brief contains no-mutation storage/session risk review: satisfied.

## Downstream Handoff

Next sequence:

1. Track D draft readiness brief: this document.
2. Track B support review for packet/state/ledger implications.
3. Meta step review for final W6-G decision.

Recommended next role: Track B.

Recommended Track B review posture: support review only; no bridge/API/session delivery implementation.

## Residual Risks

- Evidence remains FAL-only and low-confidence.
- External target repository evidence is still missing.
- OpenCode API assumptions are unverified.
- A future spike could create workflow theater if it does not reduce review or gate risk.
- A future delivery surface could leak private workflow heuristics if public/private boundaries are not enforced.

## No-Claim Boundary

This brief does not claim:

- broad Wave 6 usefulness proof
- external target readiness
- OpenCode API/session delivery support
- bridge/API delivery readiness
- commit automation
- push automation
- public release readiness
- Track B contract approval
