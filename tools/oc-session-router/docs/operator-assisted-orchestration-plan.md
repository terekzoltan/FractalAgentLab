# Operator-Assisted Orchestration Plan

Status: `SUPERSEDED / NON-OPERATIONAL`

The historical multi-stage operator wrapper is retired. Operators invoke one
explicit stage through `Invoke-OCRouter.ps1`; no run-to-completion route remains.

This document plans the next OC Session Router hardening step after the latest-output and guided step-review MVPs.

## Current Understanding

The router should reduce copy/paste between OpenCode sessions without becoming silent autopilot.

Target operating model:

```text
router/assistant prepares the next workflow action
-> human previews and approves
-> exactly one approved send/command happens
-> router waits for the next output
-> repeat
```

The same tool should work for WorldSim, FractalAgentLab, and future repos. Project-specific session IDs stay local to each repo.

## Confirmed Decisions

- Keep `.opencode-router/sessions.json` per project because session IDs differ per repo/workspace.
- Do not hardcode WorldSim defaults in versioned scripts.
- Most logical names are shared across projects: `meta`, `track-a` through `track-e`, `swarm-assistant`, optionally `smr-analyst`.
- Keep CLI/script-driven operation.
- Add assistant-operated mode later, where an assistant runs the scripts but asks the user for approval before every send/command.
- `/seq-next <target> <Track X>` should support both modes:
  - manual Track start remains allowed;
  - router-started seq-next can be added as an explicit option.
- Full step-review must preserve the current multi-phase Meta + Swarm Assistant semantics.

## Main Goal

Create a safer orchestration layer where the human mostly approves discrete transitions instead of manually copying outputs.

End-to-end target flow:

```text
1. /seq-next <target> <Track X>
2. Track plan output -> Meta /terv-review
3. Meta review output -> Track /terv-review-utan
4. Track /implement
5. Track implementation output -> Meta /step-review
6. Meta phase 1 output -> Swarm Assistant prompt
7. Send GO to Meta
8. Swarm review output -> Meta message
9. Meta final synthesis -> Track /step-review-utan
10. Human/Meta decides closeout, commit, next step, or review-fix loop
```

No commit, push, or closeout action should happen automatically.

## Phase 1: Resume-Safe Step Review

Priority: highest.

Problem:

- Current `run-step-review-flow.ps1` can guide the full flow.
- If it fails halfway, restarting risks duplicate `/step-review`, duplicate Swarm prompt, or duplicate `GO`.

Plan:

- Add `-Resume -RunId <id>` support to `run-step-review-flow.ps1`.
- Persist step state in `.opencode-router/step-review-runs/<runId>/state.json`.
- Store all major artifacts:
  - `01-track-implementation.md`
  - `02-meta-phase1.md`
  - `03-swarm-prompt.md`
  - `04-swarm-review.md`
  - `05-meta-final-synthesis.md`
- On resume, inspect completed steps and ask before continuing from the next incomplete step.
- Never re-send a completed cross-session action unless the user explicitly confirms a resend.

Suggested first resume behavior:

```text
Detected completed steps:
- sent_step_review_to_meta
- meta_phase1_received
- sent_prompt_to_swarm_assistant

Next suggested step:
- send GO to Meta

Continue? [y/N]
```

Acceptance:

- A failed Swarm prompt send can resume without rerunning Meta `/step-review`.
- A failed post-GO wait can resume without resending `GO` unless explicitly approved.
- State/artifacts stay under `.opencode-router/` only.

## Phase 2: Seq-Next Entry Point

Priority: high after resume.

Add a script or mode for the first step:

```powershell
run-plan-review-flow.ps1 `
  -Track track-b `
  -Target P6-E `
  -StartSeqNext
```

Two supported modes:

```text
Manual seq-next mode:
  human runs /seq-next in Track
  router reads latest Track output
  router sends Meta /terv-review after approval

Router-started seq-next mode:
  router sends /seq-next <target> <Track X> to Track after approval
  router waits for Track output
  router sends Meta /terv-review after approval
```

Default should remain manual or explicit. Do not auto-run `/seq-next` unless the command includes a clear flag such as `-StartSeqNext`.

Acceptance:

- Manual seq-next path still works.
- Router-started seq-next path asks before sending `/seq-next`.
- Router-started path waits for output and shows preview before Meta route.

## Phase 3: Project Defaults And Profiles

Current reality:

- Session IDs must be project-local.
- Common behavior may be shared across projects:
  - `AssumeOldestFirst`
  - `PollSeconds`
  - `TimeoutMinutes`
  - logical role names

Recommended model:

```text
.opencode-router/sessions.json       # project-local session IDs
.opencode-router/router-settings.json # project-local defaults, optional
tools/oc-session-router/profiles/      # optional versioned reusable profiles later
```

Do not hardcode WorldSim in scripts.

Example project-local settings:

```json
{
  "profile": "worldsim-like",
  "message_order": "oldest_first",
  "poll_seconds": 15,
  "timeout_minutes": 45,
  "roles": {
    "meta": "meta",
    "swarm_assistant": "swarm-assistant",
    "smr_analyst": "smr-analyst"
  }
}
```

Clarification:

- CLI parameters mean every run passes settings manually, e.g. `-AssumeOldestFirst -PollSeconds 20 -TimeoutMinutes 60`.
- Profiles mean defaults can be loaded so the user does not repeat common flags.
- Project-local settings are safer than global defaults for session identity.
- Versioned reusable profiles can exist later for non-secret shared defaults only.

Acceptance:

- Running from WorldSim root uses WorldSim `.opencode-router/sessions.json`.
- Running from FAL root uses FAL `.opencode-router/sessions.json`.
- No project profile stores session IDs in versioned files.

## Phase 4: Assistant-Operated Mode

Goal:

Allow an assistant session to run router PowerShell commands while the human approves each transition through the assistant UI.

Operating model:

```text
assistant determines next safe router command
assistant shows concise preview and asks approval with question tool
human approves or rejects
assistant runs exactly that one command
assistant reports result and next suggested action
```

Rules:

- No silent autopilot.
- No automatic commit/push.
- No high-risk transition without explicit approval.
- The assistant must not guess target/Track if ambiguous.
- If a script produces a preview, the assistant should summarize it and ask before live send.

Useful future wrapper:

```text
assistant-operated-runbook.md
```

This runbook should define:

- allowed commands the assistant may run;
- required approval points;
- stop conditions;
- how to recover from partial runs;
- what to report after each action.

Acceptance:

- User can operate a full plan/review/step-review sequence from one OpenCode session with approvals.
- Assistant uses PowerShell scripts as the execution surface.
- User still controls sends and commands.

## Phase 5: Optional Event Stream Later

Defer event streams.

Current polling model is simpler:

```text
manual trigger -> GET latest messages -> preview -> approval -> route
```

Future model may be:

```text
GET /event or SDK subscribe
-> detect output-done event
-> create candidate action
-> approval queue
```

Do not implement this before resume and project defaults are stable.

## Open Questions

- Resume granularity should start minimal and safe; exact automation can be tightened after more live failures.
- It is still unclear whether OpenCode message ordering is stable across all projects. Keep `AssumeOldestFirst` configurable.
- Thinking effort configuration may require OpenCode-specific command/session/model API support. Do not guess undocumented fields.

## Recommended Next Implementation

Implement in this order:

1. `run-step-review-flow.ps1 -Resume -RunId <id>`.
2. Optional `.opencode-router/router-settings.json` loading.
3. `run-plan-review-flow.ps1` with manual and `-StartSeqNext` modes.
4. Assistant-operated runbook, then optional assistant wrapper behavior.

Readiness: READY for Phase 1 implementation planning.
