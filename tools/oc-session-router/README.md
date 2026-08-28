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
  exactly one `new-run`, `new-follow-on-run`, `invoke-stage`, `install-closeout-authority`,
  `resolve-stage`, or `get-run` operation,
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
  tool/subtask/file/patch/unknown parts fail closed. Snapshot history is ordered
  chronologically, follows only the server-provided opaque next cursor within a
  finite page cap, and treats the latest pre-send message as the baseline. If the POST
  response is lost after delivery, `resolve-stage` may accept exactly one strict
  terminal bound to exactly one post-baseline root user message whose text equals
  the installed command template expanded with the pinned argument. Any missing,
  duplicate, or invalid binding remains `UNCERTAIN`; recovery never resends.
  Production reconciliation waits, by default, for at most the protected
  60-minute window and polls only GET history for that same operation. It exits
  immediately on exact correlation and never creates a new run, operation, or
  lifecycle send. SSE is probed and recorded but remains disabled.
- `Prepare-OCRouterStage.ps1` is the bounded no-send source-hash helper. It hashes
  only sources explicitly named by the operator and emits candidate manifest and
  state packet files; invocation remains a separate explicit transaction.
- A successful, valid, bound stage terminal is also an append-only router-owned
  source candidate for the next allowed stage. `get-run` exposes the exact
  `next_stage_sources` bindings; dispatch re-derives their content and hash from
  protected runtime evidence. This permits an in-run `SEQ_NEXT -> PLAN_REVIEW`
  handoff without rewriting target state or the target manifest. It does not
  auto-advance, accept arbitrary runtime content, or weaken run authority.
  A validated `IMPLEMENT` terminal also freezes the protected Git
  `changed_paths` set as hash-bound router evidence and yields a separate
  `ACCEPTANCE_EVIDENCE` projection containing that exact candidate scope plus
  its canonical acceptance/check fields and review lineage. Same-run
  `STEP_REVIEW` therefore reviews both required sources without inventing
  target evidence. Later worktree dirt cannot retroactively enlarge this set.
  `get-run` exposes a separate `continuation_requirements` entry when an allowed
  successor still needs target- or Owner-owned authority. It never advertises a
  partial `next_stage_sources` set as dispatch-ready. After `ACK_ONLY`, the same
  immutable run pauses with `OWNER_SOURCE_REQUIRED`: the router retains the
  exact synthesis, delivery response, and delta under `available_stage_sources`.
  The Owner installs one fresh `CLOSEOUT_AUTHORITY` v2 through the protected,
  no-send `install-closeout-authority` operation. No target file, manifest, or
  lifecycle state is changed by that install. Its `candidate_paths` is copied
  from the frozen reviewed candidate scope and is distinct from ambient
  worktree dirt. After validation, `get-run` exposes the complete four-source
  CLOSEOUT packet under `next_stage_sources`. Commit authority names the exact union of the frozen
  candidate paths and synthesis-enumerated governance-delta paths. The index must
  be empty before POST; the candidate may remain unstaged. The Meta closeout
  command alone applies the governance delta, stages that exact union, and
  commits it. The protected worktree proof exposes the exact pre-POST changed
  paths and requires them to equal `candidate_paths`, so an unrelated dirty path blocks before delivery rather than being
  absorbed or discovered after commit.
  A validated `FIX_PLAN_REQUIRED` response ends the current immutable review
  cycle. It establishes `REVIEW_FIX_PLAN` lineage and requires a new follow-on
  run with a monotonically incremented review cycle and exact finding lineage;
  the router never mutates cycle authority in place. The no-send
  `new-follow-on-run` operation accepts only the exact predecessor run and
  Delivery operation identities. It derives the candidate, fix plan, findings,
  and next cycle from protected terminal evidence, creates one idempotent
  successor, and projects its first `PLAN_REVIEW` source without rewriting the
  target repository or sending a lifecycle command.
  Within that follow-on run, a successful stage may carry forward an exact
  target source binding it already validated when the successor requires the
  same source class. Content and hash are still re-resolved before the next POST;
  this is binding reuse, not source trust or authority mutation.
  Non-`NONE` `Proposed closeout delta` values use the Canon's exact minified
  JSON array of `{path,field,value}` objects. Legacy path-only arrays are
  rejected rather than silently losing field/value intent. Array order is not
  semantic; the exact path/field/value set remains byte-value bound.
  An Owner refresh of the operational registry/capability may change the coarse
  registry projection hash without invalidating that run. The resolver still
  requires every semantic run-authority field, target source, current capability,
  recipient, transport, and immediate pre-POST measurement to remain valid.
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
