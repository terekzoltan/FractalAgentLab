# OpenCode Session Router

This directory is the FAL transport and evidence adapter for Agent Workflow Canon.
It is not project truth and does not grant workflow authority.

## Load order

1. Use `docs/workflow-orchestrator-runbook.md` as the small operational entry point.
2. Open `docs/workflow-orchestrator-reference.md` only for a named transport,
   recovery, schema, or wrapper question.
3. Resolve current sessions through `sessions.json` and current project authority
   through the target project's `AGENTS.md`, state, Combined Epic, role runbook,
   and pinned phase artifact.

## Safety boundary

- Router wrappers transport and pin artifacts; they do not decide acceptance.
- FAL checkpoint integration is proposal-only inside transport wrappers.
- Only a separate `/fal-checkpoint-target` dispatch may apply an authorized FAL
  checkpoint after validating the exact Target/Epic/Candidate/lane/receipt tuple.
- `scripts/invoke-command-and-wait.ps1` and
  `scripts/sync-fal-checkpoint.ps1` are retired fail-closed compatibility stubs.
- `/closeout-commit` is the only normal lifecycle commit authority. No router
  helper pushes.
- `scripts/session-context-status.ps1` reads provider-observed last-completion
  usage plus a labeled active-context estimate for one mapped, explicit, or all
  mapped sessions. It never sends, compacts, or mutates.
- `scripts/invoke-session-compact-flow.ps1` is the separate reviewed Compact V2
  adapter. It consumes telemetry only at `before_dispatch`, `after_stage_output`,
  or `epic_closeout`, requires a complete safe-boundary event, persists private
  idempotency state, uses `POST /session/:id/summarize`, verifies one attributable
  marker, runs Canon hydration, and resumes only with exact route proof.
- `scripts/resolve-compact-policy.ps1` applies the complete global policy and an
  optional tighten-only target `.fal/compact-policy.json` override. Invalid or
  loosening overrides disable automatic action for that event.

Run `scripts/test-session-compact-flow.ps1` alone after changing compact policy,
event, state-machine, transport, hydration, or resume behavior. It uses mocked
transport and does not call a live summarize endpoint.
