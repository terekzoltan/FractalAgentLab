# OpenCode Session Router

This directory is the FAL transport and evidence adapter for Agent Workflow Canon.
It is not project truth and does not grant workflow authority.

## Load order

1. Use `docs/workflow-orchestrator-runbook.md` as the small operational entry point.
2. Open `docs/workflow-orchestrator-reference.md` only for a named transport,
   recovery, schema, or wrapper question.
3. Resolve current sessions only through the owner-protected control plane and
   current project authority through the target project's `AGENTS.md`, state,
   Combined Epic, role runbook, and pinned phase artifact.

## Safety boundary

- `scripts/Invoke-OCRouter.ps1` is the sole lifecycle command entrypoint. It runs
  exactly one `new-run`, `invoke-stage`, `resolve-stage`, or `get-run` operation,
  emits JSON with `auto_advance: false`, and never installs or builds at dispatch.
- The TypeScript core under `runtime/` derives run and stage authority from the
  protected registry plus current target state, Combined span, pinned artifact,
  overlay, and role. Request files are untrusted instructions and cannot supply a
  server endpoint, session ID, command body, or output path.
- Runtime release `0.2.0` keeps protocol identity
  `fal-explicit-stage-router/v1` independent from AWC. Active production modes
  require AWC `4.1.1`; AWC `3.1` remains fixture/input compatibility only.
- The fixed owner-protected layout is
  `%LOCALAPPDATA%\FractalAgentLab\oc-router\{control,runtime,receipts}`.
  `Initialize-OCRouterControlPlane.ps1 -Action Bootstrap` creates `DISABLED`
  defaults and owner+SYSTEM-only ACLs; `-Action Verify` is read-only. The retired
  `init-router-runtime.ps1` never creates an alternate registry.
- The launcher and Node runtime independently resolve the OS LocalApplicationData
  KnownFolder; caller environment values are comparison-only. The protected v2
  registry binds an exact domain-hashed `p0b_isolation_root`, and every synthetic
  target/server directory must be a reparse-free descendant before any probe.
- Modes are `DISABLED` (default kill switch), `P0B_ISOLATED` (short-lived
  synthetic one-use grant), and `PRODUCTION_RESPONSE_FIRST` (requires a nonzero
  P0B proof-bound install receipt). The protected receipt path is registry-owned,
  never request- or environment-selectable. No real-project P0B send is part of
  the offline suite.
- An accepted P0B transport proof survives an ordinary server restart and
  forward OpenCode patch updates on the same strict `major.minor` line.
  Production admission binds stable server semantics; each dispatch separately
  pins the current server process from its baseline through immediate pre-POST
  and post-response revalidation. Exact-version reuse still requires the exact
  proven binary. Downgrade, minor/major change, prerelease/nonstandard version,
  router-attestation change, or a stable capability mismatch requires a new
  isolated P0B proof.
- Installed `/command` is response-first. Audited `step-start`, `step-finish`,
  reasoning, and synthetic/ignored text are hashed but not treated as output;
  tool/subtask/file/patch/unknown parts fail closed. Snapshot GET is diagnostic
  unless assistant ID, parent, session, and terminal hash match exactly. SSE is
  probed and recorded but remains disabled.
- `Prepare-OCRouterStage.ps1` is the bounded no-send source-hash helper. It hashes
  only sources explicitly named by the operator and emits candidate manifest and
  state packet files; invocation remains a separate explicit transaction.
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
  adapter. Non-dry operation resolves the exact target root, literal loopback
  origin, private session, timeout, and one-use authority only through the same
  attested KnownFolder control plane as lifecycle dispatch; caller arguments and
  target-local `sessions.json` are expectations/fixture input, never production
  authority. It consumes telemetry at declared events, checks participant transport
  state, persists a minimal intent, verifies one marker, invokes
  `/after-compact <project-id> <role>`, and never routes workflow.
- `scripts/invoke-session-compact-flow.ps1` is retained Compact V2 reference source
  only. Active Orchestrator paths must not invoke it.
- Compact authority stdout contains status and digests only. The active Lite adapter
  reads the raw root/origin/session packet from the owner-only
  `runtime\compact-authority-handoffs` handoff and deletes it immediately; stale
  crash remnants expire after 15 minutes.
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
