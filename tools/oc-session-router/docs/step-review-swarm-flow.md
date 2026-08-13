# Step-Review + Swarm Assistant Flow

Status: `SUPERSEDED / NON-OPERATIONAL`

Historical Swarm prompts, sessions, `GO`, and result forwarding are provenance
only. Current `/step-review` is one explicit command stage; Meta owns native Task
review routing and final synthesis.

This document describes the step-review + Swarm Assistant orchestration design. The first guided implementation exists as `tools/oc-session-router/scripts/run-step-review-flow.ps1`.

## Current Manual Semantics

The `/step-review` command is multi-phase:

1. First call generates a copyable `/swarm-review` prompt for the Swarm Assistant and stops at `WAITING FOR GO`.
2. After `GO`, Meta runs its internal reviewer burst and produces a `META STEP REVIEW DRAFT` while Swarm Assistant can review in parallel.
3. After the Swarm review is sent back to Meta, Meta produces the final synthesis.
4. Only the final synthesis decides step readiness or commit status.

## Guided Router State Machine

The guided script is built from explicit primitives:

- Send `implementation_done` packet to Meta through `/step-review`.
- Read latest Meta output.
- Extract the Swarm Assistant prompt block.
- Then send the extracted prompt to `swarm-assistant` as a plain message after preview and approval, with `agent=architect` and an explicit `model={providerID,modelID}` request object. The extracted prompt starts at `/swarm-review`; the preceding `SWARM ASSISTANT PROMPT:` marker is not forwarded.
- Inject router Swarm review controls when `-SwarmReviewDepth` is set or resolved from `auto`.
- Send `GO` to Meta immediately after the Swarm prompt dispatch; do not wait for Swarm output before letting Meta run its internal lanes.
- Read latest Swarm Assistant output.
- Preview and approve forwarding the Swarm review to Meta as a plain message.
- Read final Meta synthesis.
- Route final synthesis to the originating Track with `/step-review-utan`.

Command:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/run-step-review-flow.ps1 `
  -Track track-b `
  -Target P6-E `
  -AssumeOldestFirst
```

Runtime artifacts are written under:

```text
.opencode-router/step-review-runs/<runId>/
```

Resume command:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/run-step-review-flow.ps1 `
  -Resume `
  -RunId <runId>
```

## Safety Requirements

- Every cross-session send remains previewed and approval-gated.
- Extracted Swarm review output remains private runtime state.
- Temporary orchestration state remains under `.opencode-router/` or another gitignored local runtime directory.
- No automatic commit or push behavior is introduced.
- No server exposure beyond local `127.0.0.1` binding is assumed.

## Review Depth Controls

The guided wrappers support separate review-depth controls:

- `-ReviewProfile quick|focused|standard|high_risk|deep|wide|audit|custom` selects the default lane and Swarm policy.
- `-ProjectReviewContext auto|fal|triageci|worldsim|ringfall|custom` selects domain-risk defaults.
- `-MetaInternalLanes 0..7` controls Meta Coordinator internal review breadth.
- `-ReviewLanes lane1,lane2` selects up to seven explicit typed lanes for a custom review.
- `-ExpandedReviewApproved` is mandatory after question-tool owner approval for any 5-7 lane review.
- `-ReviewFocus "..."` influences risk-lane selection and is forwarded to Swarm when no separate Swarm focus is set.
- `-SkipSwarmReview` / `-UseSwarmReview` controls whether the external Swarm roundtrip exists.
- `-SwarmReviewDepth auto|full|standard|focused|quick` controls how deep the Swarm Assistant should go when Swarm is enabled.
- `-SwarmReviewFocus "..."` adds one operator focus line to the Swarm prompt.
- `-MetaModel` and `-SwarmMessageModel` set explicit per-request models for the Meta and Swarm sessions.

Typed lane order is correctness/business/regression, tests/evidence, and scope/acceptance/ownership. Four-lane review adds one pre-resolved risk specialist. Five lanes add security and architecture, six add domain, and seven add regression/edge cases as the `wide` profile. Meta always performs an independent complete pass and emits a coverage matrix, including in zero-lane mode. Meta reads `review-model-routing-briefing.md` before choosing Luna/Terra/Sol tier agents or reasoning presets.

`auto` keeps full review for explicit full escalation or contract-risk changes, uses `standard` for normal first-pass reviews, and uses `focused` for lighter fix-cycle reviews. The resolved profile, lane IDs, selection reason, project context, model profile, and request models are persisted in run state and reused on resume.

## Still Deferred

- No silent autopilot.
- No event-stream watcher.
- No automatic commit or push.
- No automatic interpretation of pass/fix-required beyond forwarding the final synthesis to the Track.

Resume support now exists through:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/run-step-review-flow.ps1 `
  -Resume `
  -RunId <runId>
```
