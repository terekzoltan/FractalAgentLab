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

- `scripts/Invoke-OCRouter.ps1` is the sole lifecycle command entrypoint. It runs
  exactly one `new-run`, `invoke-stage`, `resolve-stage`, or `get-run` operation,
  emits JSON with `auto_advance: false`, and never installs or builds at dispatch.
- The TypeScript core under `runtime/` derives run and stage authority from the
  protected registry plus current target state, Combined span, pinned artifact,
  overlay, and role. Request files are untrusted instructions and cannot supply a
  server endpoint, session ID, command body, or output path.
- All legacy serial, parallel, packet, latest-output routing, message, question,
  review-fix, polling, and resume senders fail closed. Historical runs remain
  readable but are not resumable.
- Router wrappers transport and pin artifacts; they do not decide acceptance.
- Step review is one Meta command stage. The wrapper supplies a frozen
  candidate/risk/budget/domain envelope; Meta owns native Task reviewer routing
  and chairing. No Swarm session, plugin-role registry, `GO`, or external review
  result forwarding is active.
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
- `scripts/invoke-session-compact-lite.ps1` is the sole active automatic compact
  adapter. It consumes telemetry at declared events, checks participant transport
  state, persists a minimal intent, verifies one marker, invokes
  `/after-compact <project-id> <role>`, and never routes workflow.
- `scripts/invoke-session-compact-flow.ps1` is retained Compact V2 reference source
  only. Active Orchestrator paths must not invoke it.
- `scripts/resolve-compact-policy.ps1` applies the complete global policy and an
  optional tighten-only target `.fal/compact-policy.json` override. Invalid or
  loosening overrides disable automatic action for that event.

Run `scripts/test-session-compact-lite.ps1` after active compact changes. Keep
`scripts/test-session-compact-flow.ps1` as retained V2 compatibility coverage.
Both use mocked transport and do not call a live summarize endpoint.

Run the explicit-stage offline suite from `runtime/` with:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm run build --silent
npm test
```
