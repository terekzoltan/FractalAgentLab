# Wave6 Post-Closeout Ringfall And HUB Strategy v01

## Status

Meta Coordinator strategy integration decision.

Execution mode: `opencode_assisted`

Visibility / audit state:

- current `ops/PROJECT_STATE.md` and `ops/Combined-Execution-Sequencing-Plan.md` were consulted for active frontier truth
- current Wave 6 docs and W6-H closeout were consulted for sequencing boundaries
- this document originally corrected an older owner prompt that referred to W6-D as current; Wave 6 is now closed as `narrow_continue`
- no source implementation, runtime bridge, HUB code, session automation, or public release work is authorized by this document

## Decision Summary

```yaml
wave_6_5_verdict: accept_with_modifications
wave_7_verdict: accept_docs_first_direction_with_modifications
wave_6_closeout_result: narrow_continue
wave_6_closeout_confidence: medium_low
wave_6_5_status: ready_for_readiness_adoption_planning_only
active_wave_6_disruption_allowed: false
worldsim_w6i_replacement_allowed_now: false
ringfall_role: post_wave_6_adoption_readiness_target
hub_role: future_external_project_not_fal_feature
hub_implementation_authorized_now: false
opencode_bridge_or_session_delivery_authorized_now: false
```

## Current Frontier Correction

The owner proposal is strategically valid but its original operational timestamp is stale.

Current canonical state is no longer W6-D or W6-I. W6-D through W6-J are accepted, and Wave 6 closeout is accepted as `narrow_continue`.

- Wave 6 result: useful but narrow private evidence/control layer
- accepted external target evidence: WorldSim Candidate A docs-only merge-readiness loop, `accepted_with_warnings`
- public output decision: W6-J `accepted_no_release`
- closeout recommendation: `narrow_continue`, `confidence: medium_low`
- next allowed frontier: W6.5 Ringfall readiness/adoption planning only

Therefore this strategy must not restart or rewrite Wave 6. It may now guide W6.5 readiness/adoption planning only.

## Meta Questions Answered

### 1. Should Wave 6.5 exist?

Yes, with modifications.

Wave 6.5 should exist as a conditional post-Wave-6 adoption/readiness slice, not as a replacement for active W6-I. Its job is to convert Wave 6 evidence into practical Ringfall usage readiness.

Recommended name:

- Wave 6.5 - Ringfall Adoption And External Project Readiness Pack

Activation gate:

- W6-I must produce external evidence or a clear blocker
- W6-J must either complete a sanitized/no-release decision or be explicitly skipped with Meta rationale
- Wave 6 closeout must synthesize usefulness honestly
- if Wave 6 usefulness is negative or insufficient, Wave 6.5 narrows to runbook/blocker analysis instead of adoption expansion

### 2. Should Ringfall replace WorldSim as the first external target?

No, not now.

WorldSim remains the accepted W6-I target because W6-H already selected it and W6-I is open under guardrails. Replacing it now would create sequencing churn and weaken the point of W6-H acceptance.

Ringfall should become the first serious post-Wave-6 adoption target, not the first W6-I external trial, unless W6-I is blocked by a new explicit Meta decision.

### 3. Should Wave 7 be docs-only first?

Yes.

Wave 7 should define HUB compatibility contracts first. It must not build the HUB inside FAL.

Recommended name:

- Wave 7 - HUB Compatibility Layer / External Control Surface Contract

Wave 7 should make FAL observable and safely requestable by a future external HUB while preserving FAL as the workflow/evidence engine.

### 4. Which docs should be created now vs planned?

Create now:

- `docs/private/Wave6-Post-Closeout-Ringfall-HUB-Strategy-v01.md`

Created after the relevant gate opened:

- `docs/private/Wave6-Post-Closeout-Usefulness-Synthesis-v01.md`
- `docs/private/FAL-External-Project-Usage-Runbook-v01.md`
- `docs/private/External-Project-Packet-Fields-v01.md`
- `docs/private/Ringfall-Target-Readiness-Brief-v01.md`

Plan, but do not create until the relevant gate opens:

- `docs/private/Wave7-HUB-Compatibility-Layer-Plan-v01.md`
- `docs/private/External-Control-Surface-Contract-v01.md`
- `docs/private/Project-Room-Taxonomy-v01.md`
- `docs/private/Approval-Queue-State-Model-v01.md`
- `docs/private/FAL-HUB-Privacy-Boundary-v01.md`

Reason: W6.5 is now open for readiness/adoption planning only. The first W6.5 package may define the external-project usage model, target-project packet fields, and RingFall readiness brief, but it still does not authorize RingFall implementation, public output, HUB work, or bridge/API/session delivery.

### 5. Which Track owns each part?

| Work item | Primary owner | Support | Gate owner |
|---|---|---|---|
| Wave 6 closeout usefulness synthesis | Track E | Meta | Meta |
| Wave 6.5 sequencing decision | Meta | Track E | Meta |
| Ringfall target-readiness brief | Meta | Track E, Ringfall-side owner | Meta |
| FAL external-project usage runbook | Meta | Track E, Track C | Meta |
| External-project packet fields | Track B | Track C, Track E | Meta |
| Ringfall first safe sequence item selection | Meta | Ringfall-side owner, Track E | Meta |
| Wave 7 HUB compatibility plan | Meta | Track B, Track C, Track E | Meta |
| External status/export contract | Track B | Track E | Meta |
| Project room taxonomy | Track C | Meta | Meta |
| Approval queue state model | Track B | Track C, Track E | Meta |
| Privacy/export boundary | Track E | Meta | Meta |
| Future bridge/API feasibility | Track D | Track B, Track E | Meta |
| HUB display needs review | Track A | Track E | Meta |

## Sequencing After Wave 6 Closeout

The earlier W6-I/W6-J sequence is complete:

1. W6-I WorldSim docs-only external trial produced accepted warning-grade evidence.
2. W6-J public-safety/no-release decision accepted `no_public_release_now`.
3. Wave 6 usefulness synthesis accepted `narrow_continue`.
4. W6.5 may now open as RingFall readiness/adoption planning only.
5. If W6.5 later produces stable external-project conventions, Wave 7 may open as docs-first HUB compatibility contract work.

## Wave 6.5 Scope

Allowed scope:

- create Ringfall target-readiness brief
- define first safe Ringfall sequence items for FAL-driven planning/review
- produce a target-project operator runbook for using FAL outside FAL itself
- define external-project packet/evidence conventions
- record expected friction points from Wave 6 and Ringfall setup
- confirm RingFall as the first post-Wave-6 adoption/readiness target before any RingFall execution slice opens

Wave 6.5 non-goals:

- no HUB implementation
- no dashboard work
- no automatic OpenCode session mutation
- no commit/push automation
- no autonomous swarm
- no broad server/API bridge unless Wave 6 usefulness explicitly supports it and Meta opens a separate step
- no public release of private learning-loop evidence

## External-Project Packet Fields To Evaluate In Wave 6.5

Candidate fields:

- `target_project_id`
- `target_repo_path`
- `sequence_ref`
- `room_or_project_classification`
- `artifact_refs`
- `approval_needed`
- `approval_state`
- `privacy_classification`
- `target_project_owner`
- `target_project_canonical_state_refs`

These are candidate extensions or sidecar fields. They must not mutate existing W6 packet law until Track B reviews compatibility.

## Wave 7 Scope

Allowed docs-first scope:

- external status/export contract
- project room taxonomy
- approval queue state semantics
- observe vs propose-action vs request-dispatch boundary
- event/feed semantics
- privacy/export policy
- integration boundary between FAL, OpenCode, CI Guardian, and future HUB

Wave 7 non-goals:

- no HUB implementation inside FAL
- no UI/dashboard implementation by default
- no auto-dispatch/session mutation
- no commit/push automation
- no public release of private learning evidence
- no CI Guardian integration implementation unless separately sequenced

## Hard Non-Goals Preserved

- Do not reopen, rewrite, or broaden the accepted W6-I WorldSim docs-only evidence loop.
- Do not reinterpret RingFall as a replacement for W6-I; RingFall is only the next post-Wave-6 readiness/adoption planning target.
- Do not build the HUB in FAL.
- Do not add OpenCode bridge/API/session delivery while W6-G remains `do_not_implement_now` and no later explicit Meta-opened bridge step exists.
- Do not make private raw evidence public by default.
- Do not let Track A build dashboard/UI before contracts and evidence needs stabilize.
- Do not treat future project-room taxonomy as permission for autonomous swarm execution.

## Next W6.5 Packet After Meta Acceptance

The W6.5 RingFall readiness/adoption package is accepted with notes. The next active packet is RingFall Safe Slice 1, not RingFall implementation.

Meta-facing next packet:

```text
Task: Run RingFall Safe Slice 1 repo skeleton readiness review.

Owner sequence:
Meta Coordinator readiness review -> owner decision on RingFall repo/skeleton next step

Inputs:
- docs/private/FAL-External-Project-Usage-Runbook-v01.md
- docs/private/External-Project-Packet-Fields-v01.md
- docs/private/Ringfall-Target-Readiness-Brief-v01.md
- docs/private/Wave6-Post-Closeout-Usefulness-Synthesis-v01.md
- docs/private/Wave6-Post-Closeout-Ringfall-HUB-Strategy-v01.md
- ops/PROJECT_STATE.md
- ops/Combined-Execution-Sequencing-Plan.md

Required output:
- inventory of RingFall current docs/canon package versus planned monorepo skeleton
- recommendation for how to create or stage the RingFall git/monorepo skeleton
- private/public/gitignore guidance for target-local `.fal/` and future run artifacts
- explicit NOT READY / READY_WITH_GUARDRAILS decision for implementation planning

Forbidden:
- RingFall implementation work
- runtime/live-service/deploy work
- bridge/API/session delivery work
- HUB implementation
- Track A presentation or dashboard work
- public-safe claims
```

Future RingFall implementation execution remains blocked until Safe Slice 1 and later readiness gates explicitly approve it.
