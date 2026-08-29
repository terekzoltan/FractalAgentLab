# Workflow Orchestrator Runbook

## Mission

This is the hot bootloader for an OC Session Router Orchestrator. Project files own project truth; commands own stage prompts; Meta owns review decisions; the Accountable Delivery Lane owns planning and implementation. FAL supplies transport, evidence, and continuity only. Load the cold `workflow-orchestrator-reference.md` by named section when implementation mechanics or historical compatibility are actually needed.

## Minimal target-first hydration

Load in this order:

1. Resolve and verify the target repository, worktree, active Wave/Epic, candidate, and logical sessions.
2. Read target-root `AGENTS.md` and only the relevant project overlay.
3. Read target `PROJECT_STATE` and the exact active Combined Epic row plus direct prerequisites/handoffs.
4. Read the current pinned plan, implementation brief, final synthesis, acknowledgement, or fix plan for the expected stage.
5. Read this runbook.
6. Read target-local router settings/session map and saved run state only when routing or resuming.
7. Read only the FAL checkpoint, ledger row, or incident pointer required for the immediate action.

Do not infer target state from FAL state, process working directory, latest-output memory, or compact summaries. Complete plans, transcripts, domain docs, and the cold router reference remain on demand. Normal hydration uses one primary role runbook and at most one triggered event procedure.

## Bootstrap and identity

Derive router scripts from the installed/control repository script root and target values from the target runtime registry. Documentation uses `<TARGET_ROOT>`, `<CONTROL_ROOT>`, and `<PORT>` placeholders; never copy workstation paths, credentials, session IDs, or private endpoints into versioned files.

Before every dispatch prove: target root/worktree, Epic, candidate, lifecycle stage, sender/recipient role, exact input artifact and hash, command name, duplicate-send state, and allowed side effects. A familiar session label alone is insufficient. Accountable lanes and reviewer capabilities come from target overlays/runtime profiles; never infer authority from arbitrary session keys or project names.

The production-router operator contract is runtime `0.2.0`, protocol
`fal-explicit-stage-router/v1`, and this fixed Windows layout:

```text
%LOCALAPPDATA%\FractalAgentLab\oc-router\
  control\control-registry.json
  control\retention-policy.json
  control\capability-receipts\
  runtime\p0b-isolation\
  runtime\compact-authority-handoffs\
  runtime\quarantine\
  runtime\diagnostics\
  runtime\validated-evidence\
  runtime\runs\<run>\operations\<operation>\
  runtime\{dispatch-leases,semantic-actions,capability-uses}\
  receipts\
```

The three authority-ledger directories are non-expiring duplicate-send state;
terminal run/operation evidence expires at 180 days, while active, nonterminal,
or uncertain evidence is preserved. Purge is allowed only under `DISABLED` and
emits a count/hash-only receipt under `receipts`.

The default test seam fixes `p0b_isolation_root` at `runtime\p0b-isolation`. A
real Owner-gated pilot may instead bind an explicitly protected workspace-local
synthetic root and its domain hash in the registry and capability receipt. Every
P0B target/server directory must be a reparse-free descendant of that exact root.
Node independently queries the OS KnownFolder; `LOCALAPPDATA` and router-root
environment values cannot relocate production authority.

Run `Initialize-OCRouterControlPlane.ps1 -Action Bootstrap` once and then
`-Action Verify`; bootstrap never accepts a different root and starts in
`DISABLED`. Every fixed path has effective access only for the current owner and
Local System; inherited rules are accepted only from that verified owner-only
parent. Set OpenCode Basic credentials in the current process only. Do not set
router-root or registry variables: the launcher derives the OS KnownFolder paths,
verifies them, and sets those values only in its scrubbed child environment. It
also forces `OPENCODE_AUTO_SHARE=false`; the isolated OpenCode configuration must
declare `share: "disabled"`. `init-router-runtime.ps1` is retired.

Before editing target state, run `Prepare-OCRouterStage.ps1` with an explicitly
named target root, closed preparation spec, and pre-created output directory. It
does no network I/O and never chooses authority sources; it produces a candidate
stage-source manifest, its exact hash, and a candidate state packet. Owner review
and target-state adoption are separate from the later explicit
`Invoke-OCRouter.ps1` transaction.

## Canonical lifecycle

```text
Delivery /seq-next
-> Meta /terv-review
-> Delivery /terv-review-utan
-> Delivery /implement
-> Meta /step-review
-> Delivery /step-review-utan
-> FIX_PLAN_REQUIRED -> new incremented review-cycle run
   or ACK_ONLY -> Owner no-send closeout-authority install
               -> same-run Meta /closeout-commit
```

`/terv-review` is one direct Meta pass and its canonical envelope includes `Plan class`. `/terv-review-utan` normally ends `PLAN_REVISION_COMPLETE` and `IMPLEMENT_READY`; `IMPLEMENT_BLOCKED` is exceptional. The corrected plan and summary repeat Target, Epic, lane, and one opaque final plan identity byte-identically, then route directly to `/implement`. Every final step-review color routes through `/step-review-utan`. Only exact `ACK_ONLY` is closeout-eligible. `FIX_PLAN_REQUIRED ... FIX_PLAN_READY_FOR_IMPLEMENT` declares fix-plan completeness and establishes `REVIEW_FIX_PLAN` lineage, but it ends the current immutable review-cycle run. Start a follow-on run with an incremented `Review cycle`, the exact accepted finding IDs, and that fix plan; then route once through Meta `/terv-review` plus Delivery `/terv-review-utan`. Only the resulting ready revision routes to `/implement`. `UNCLEAR` routes upward. Meta color never substitutes for the Delivery response class.

## Transport law

- Use `scripts/Invoke-OCRouter.ps1` as the sole lifecycle command entrypoint.
  Create one immutable run, then invoke exactly one explicit stage. The router
  returns allowed-next metadata and stops; the Orchestrator chooses any later
  stage in a separate transaction.
- Before a later in-run stage, call `get-run`. If `next_stage_sources` contains
  the requested stage, copy those exact bindings into `expected_sources`. These
  sources are derived only from earlier `SUCCEEDED / VALID / BOUND` terminal
  evidence in the same run and are revalidated before POST. For example, a
  successful `/seq-next` plan becomes the exact `PLAN` input to `/terv-review`;
  no target manifest edit or follow-on run is required for that handoff.
  A restart-time Owner capability/admission refresh likewise needs no new run
  when every semantic run-authority field remains identical. The fresh registry,
  capability, recipient, server instance, and transport are still revalidated
  before operation creation and immediately before POST.
- Treat `next_stage_sources` as dispatch-ready only when it contains the complete
  ordered source set. When `continuation_requirements` instead names
  `TARGET_SOURCE_REQUIRED`, perform the target/Owner preflight for the listed
  source classes and do not send the stage yet. Preserve the exact
  `available_stage_sources` bindings as evidence; they are not readiness.
  `FOLLOW_ON_RUN_REQUIRED` means the current review cycle is complete and
  immutable. Invoke the no-send `new-follow-on-run` operation with only the
  exact predecessor run and successful `FIX_PLAN_REQUIRED` Delivery operation.
  The router derives and installs the protected fix-plan source, increments the
  review cycle, and returns one idempotent successor with a complete
  `PLAN_REVIEW` projection. Do not create a plain `new-run`, inject findings, or
  rewrite target state merely to bridge this boundary. `OWNER_SOURCE_REQUIRED` after
  `ACK_ONLY` is different: keep the same run and invoke the Owner-only, no-send
  `install-closeout-authority` operation. It validates the current worktree and
  stores only the fresh authority in protected FAL runtime; it does not write the
  target repository. Re-run `get-run`, then use the complete projected CLOSEOUT
  packet for one explicit Meta `/closeout-commit` stage.
  The supported launcher form is
  `Invoke-OCRouter.ps1 -Operation install-closeout-authority -RequestPath <intent.json>`;
  it never performs a POST or creates a lifecycle operation.
  The follow-on launcher form is
  `Invoke-OCRouter.ps1 -Operation new-follow-on-run -RequestPath <follow-on-run-request.v1.json>`;
  it also performs no POST and the request contains only
  `predecessor_run_id` plus `delivery_operation_id`.
  Never infer `CLOSEOUT_AUTHORITY` from router output or synthesize Owner commit
  authority. Use `CLOSEOUT_AUTHORITY` v2 and copy its `candidate_paths` from the
  frozen reviewed candidate scope. For a commit, authorize the exact union of frozen candidate paths
  and synthesis-enumerated governance-delta paths with an empty index. Do not
  pre-stage them: Meta `/closeout-commit` applies the delta, stages the exact
  union, and commits. Protected changed paths must equal the authority-bound
  candidate paths; any ambient unrelated path blocks before POST.
- Router-owned output promotion is source adoption, not stage execution:
  `auto_advance` remains false, every command remains an explicit transaction,
  and missing, conflicting, tampered, cross-run, or invalid predecessor evidence
  blocks before POST. Target-owned sources remain required for any source class
  that no successful predecessor output can supply.
  A successful `PLAN_REVISION` may mint a new opaque final plan identity. The
  following `IMPLEMENT` request MUST use that promoted `REVISED_PLAN` identity;
  the earlier revision request's input identity remains provenance and does not
  override the validated final artifact.
  When consecutive stages require the same target-owned source class, `get-run`
  may carry forward the exact binding already validated by the preceding
  successful stage. The resolver still reloads and hashes its current bytes
  immediately before dispatch; no state or manifest rewrite is implied.
  A successful `IMPLEMENT` promotes both its validated terminal and a derived,
  hash-bound acceptance receipt. The receipt contains only the protected
  candidate/review lineage plus the terminal's canonical `Acceptance mapping`
  and `Checks/results`; it is not an independent acceptance verdict.
  The terminal's `Candidate identity/worktree limitations` field must begin with
  the request's exact candidate token. The next character, when present, must be
  outside the opaque-ID alphabet; no new punctuation grammar is imposed on Canon.
  For closeout, a non-`NONE` `Proposed closeout delta` is the Canon's exact
  minified JSON array of `{path,field,value}` objects, not a path-only array;
  compare it as an exact set, independent of entry order.
- The launcher accepts only request/run/operation identities. Protected process
  configuration supplies the runtime root and control registry; the engine, not
  the request, resolves target authority, origin, recipient, sources, command, and
  deterministic argument bytes.
- The synchronous `/command` assistant response is the primary candidate. If an
  accepted response is non-canonical after OpenCode automatic compact/resume, one
  read-only `resolve-stage` may recover exactly one strict assistant child of the
  frozen expanded command root. This exception is available only for
  `FAILED_OUTPUT / RESPONSE_ACCEPTED / OUTPUT_VALIDATION_FAILED`; it revalidates
  current authority, privacy, source lineage, shape, and binding, preserves the
  original failure digest, and never resends. Missing, stale, or multiple strict
  children remain failed closed. A
  timeout or 5xx leaves the operation `UNCERTAIN`; `resolve-stage` is read-only and
  cannot resend. In production its default bounded wait polls the same operation's
  GET history for up to 60 minutes and exits as soon as one exact terminal is
  available. Do not create a replacement operation or run while this reconciliation
  is waiting; an explicit shorter operator wait may be selected when needed.
  Production lifecycle admission should normally bind a 60-minute command timeout;
  the bounded policy permits 2-60 minutes. Timeout never authorizes a retry.
  Repeating `resolve-stage` after an operation is already `SUCCEEDED` is
  idempotent and returns the stored validated result without another snapshot
  read, state mutation, or transport action.
  Installed message history is interpreted chronologically, paged only through
  the server-provided opaque cursor under fixed page/byte caps, and uses the
  latest pre-send message as baseline. When no synchronous receipt exists, recovery
  requires exactly one post-baseline root user message equal to the current
  installed command template expanded with the pinned argument, plus exactly one
  strict terminal assistant child that passes current authority, privacy, lineage,
  and output-binding validation. Installed `step-start`/`step-finish` and
  explicitly audited reasoning parts are hashed and ignored; ambiguous roots,
  multiple strict terminals, tool/subtask/file/patch/unknown parts, or any drift
  remain `UNCERTAIN` without resend.
- `DISABLED` is the default kill switch. `P0B_ISOLATED` admits only a short-lived,
  one-use synthetic grant; it is consumed immediately before the sole POST and
  stays consumed after timeout, 4xx/5xx, malformed response, or crash. A later
  attempt needs a new Owner-reviewed grant and isolated session.
- `PRODUCTION_RESPONSE_FIRST` requires a separate production-install receipt
  bound to a nonzero accepted P0B proof. Active modes require AWC `4.1.1`; legacy
  AWC `3.1` inputs never authorize production. SSE may be probed for evidence but
  `enabled` remains false.
- An ordinary OpenCode server restart reuses the installed production authority
  after live revalidation of the same binary, version, health, OpenAPI, semantic
  command roster, target directory, session set, and authorized commands. The
  new process identity is pinned for the individual dispatch and must remain
  unchanged through immediate pre-POST and post-response checks. A restart
  during that window fails closed without resend. Routine forward patch updates
  on the same strict `major.minor` line need a fresh installed receipt but may
  reuse the accepted proof. Exact-version binary drift, downgrade, minor/major
  change, prerelease/nonstandard version, router-attestation change, or stable
  capability drift requires a new isolated P0B proof.
- Lifecycle dispatch and Compact share the same persistent participant fence.
- A pre-operation failure reports a bounded privacy-safe class:
  `PARTICIPANT_FENCE_BLOCKED`, `DISPATCH_LEASE_BLOCKED`, or
  `SNAPSHOT_BASELINE_BLOCKED`; generic `BLOCKED` is reserved for failures that
  cannot be classified without exposing private material.
- Snapshot baselines may hash completed historical `tool` and `patch` parts from
  a mature session. They never execute or persist their payloads, never treat
  them as terminal text, and still reject active tools, identity drift, unknown
  part types, and malformed shapes.
  The runtime holds an OS-level `FileShare.None` lease through response handling
  and rechecks it with protected authority immediately before POST.
- Invoke every known slash command through the command endpoint, excluding the leading slash.
- Native `/step-review` has no plain-message control token or external review-session handoff. Meta dispatches configured read-only reviewers through native Task calls inside the command stage.
- Forward the exact pinned artifact body or an immutable resolvable pointer with identity and integrity proof; never replace it with a summary.
- Hold one exclusive run lock. Persist an atomic, hash-bound pre-send intent before every dispatch and the returned receipt/message identity afterward. On resume, verify artifact hashes and strict output class; an unresolved pending intent stops for read-only reconciliation and is never auto-resent. Progress chatter is not a terminal artifact.
- Never resend when delivery is ambiguous. Inspect run state/transcript read-only; if proof remains unavailable, stop.
- Strict stage classification and diagnostic discovery are separate. A newer unclassified or progress-like assistant message may produce a diagnostic-only reconciliation record, but it is never selected, saved as stage authority, or routed. In the shared and standalone typed waits, a strict stage contract, not `MinOutputChars`, proves a terminal artifact.
- Legacy packet, serial, parallel, review-fix, latest-output routing, message,
  question, polling, and resume scripts are historical fail-closed surfaces. They
  cannot be used as an alternate sender or recovery path.
- AC87 retention is fixed: ephemeral Compact handoffs 15 minutes, quarantine 7
  days, diagnostics 30 days, validated
  evidence 180 days, no raw reasoning/event retention, no public export, and
  sanitized count/hash-only purge receipts.

## Native risk-selected review

The Orchestrator freezes the candidate and supplies only the review envelope: target/Epic/lane identity, acceptance and evidence pointers, actual risk, budget policy, assignment cap, requested domains if any, and an exact Owner override when present. Meta owns routing and chairing: it selects domain-plus-generic-profile assignments, launches native read-only Task reviewers, inspects their receipts, and emits the sole `FINAL STEP REVIEW SYNTHESIS`.

Use the smallest sufficient current Canon shape: `META_ONLY` 0, `FOCUSED` 1-2, `STANDARD` 2-3, `DEEP` 4-5, or `WIDE` 6-7. `EXPANDED_AUDIT` 8-10 requires an exact candidate-bound Owner envelope; more than ten is invalid. `conserve`, `balanced`, `quality_first`, and `exact` constrain optional coverage but never lower a mandatory safety floor. Legacy `quick|focused|standard|high_risk|deep|audit|wide|custom` values are shape aliases only; they do not name reviewers or authorize a topology.

New assignments use one primary and at most two compatible secondary review domains plus one verified generic profile from the live 11-profile roster. Do not pre-register reviewer names through a plugin, call a lane launcher, use `review-sol-pro`, silently substitute a model, or uniformly weaken reviewers merely because fan-out grew. A missing required profile gets one declared compatible fallback with a recorded deviation or the stage returns `BLOCKED`.

Each assignment receipt binds assignment ID, domains, question, candidate, agent/model/effort, effective status, evidence, findings, limitations, and fallback/deviation. Final synthesis must use the current Canon `Review routing:` field and account for every surfaced finding. Historical `.swarm` artifacts are cold provenance only; never replay their prompt, `GO`, result, or session frontier.

## FAL checkpoint separation

Transport wrappers do not write FAL. At a stable boundary they may persist a proposal/receipt and dispatch a separate `/fal-checkpoint-target` with a pinned authoritative target artifact. `SyncMode: apply` requires explicit FAL write authority. Delivery, Delivery response, checkpoint, target closeout, and any separate FAL closeout are distinct events. A sent command, checkpoint, or Meta color never proves acceptance. Pin the final revised plan after plan review—not the older Meta review—as the implementation-authority frontier.

## Questions, anomalies, and compact

Delivery, reviewer, evidence, specialist, and support roles return one structured blocker to their accountable parent. Meta/Orchestrator deduplicates blockers and asks at most one consolidated Owner question when target authority cannot decide. While unanswered, remain blocked.

On abnormal identity, transport, auth, duplicate-send, or output-class state: freeze sends and mutation; load the Canon Incident Recovery Runbook as the one event procedure; perform bounded read-only diagnosis and at most one proven-idempotent retry. Never explore with arbitrary console commands, restart/kill Owner-managed processes, rewrite state, guess credentials, or try speculative recovery variants.

When a strict classifier rejects a newer assistant output, inspect its diagnostic record and exact transcript message. If the producer violated the canonical schema, repair that envelope through the saved wrapper state only. If the output is canonical but the classifier disagrees, freeze routing and use `/workflow-fix`; do not insert an extra lifecycle stage or bypass the wrapper's pending intent with generic packet routing.

For the explicit-stage runtime, repair means a new target-authoritative artifact
and a later explicit operation after state revalidation. Never edit operation
state, replay a legacy wrapper, or substitute compact/latest-output text.

Compact Lite is the sole active automatic compact path. The production
`Invoke-OCRouter.ps1 -Operation invoke-stage` launcher now performs the
`before_dispatch` Compact Lite hook before operation creation and the
`after_stage_output` hook after the settled stage result. The Orchestrator must
not skip, duplicate, or separately emulate those two checks. Invoke
`invoke-session-compact-lite.ps1` directly only for `epic_closeout`, an explicitly
named operator diagnostic, or a test/dry-run. Non-dry operation resolves the target root, server instance,
private session, timeout, and capability grant only through the attested fixed
KnownFolder control plane. Target-local `sessions.json` and caller `-Server` are
dry-run/test expectations and cannot authorize a production POST. It requires
policy-selected pressure, participant `idle`,
summarize availability, and no participant-scoped pending or uncertain lifecycle
or compact intent. It persists one minimal intent, requires one attributable
marker, consumes any P0B grant after intent while the private-session fence is
held, revalidates the measured authority immediately before both POSTs, invokes
`/after-compact <project-id> <role>` once, accepts `RESTORED` or `DEGRADED`, and
stops with `workflow_command_sent: false`. Timeout or ambiguous marker state is
`COMPACT_UNCERTAIN` without blind retry. State/Combined/stage identities, route
input, Active Route, capsules, command identity, and hydration budget are not gates.
Normal Compact launcher output is a closed status/digest projection. Raw target,
origin, and private-session authority crosses only an owner-only ephemeral runtime
handoff that Lite deletes after reading; crash remnants are purged after 15 minutes.

Retained Compact V2 reference: the active-route writer/verifier consumes only the static Canon profile locators
plus current target state, the state-selected Combined span, and the state-pinned
artifact. `VERIFY` is read-only; `WRITE` uses a flushed same-directory temporary
file and publishes `ACTIVE_ROUTE.json` last. Caller/event fields are expectations,
not alternate truth. A source, generation, path, worktree, privacy, schema, or
optimistic-concurrency mismatch blocks and preserves the prior valid manifest.
Receipts contain only target-relative paths and sanitized source identities.
Enrollment must first add the exact target-state labels `Combined selector`,
`Pinned artifact`, `Pinned artifact SHA-256`, `Pinned artifact logical identity`,
`Next actor`, and `Next command`, plus the existing state revision, Wave, Epic,
phase, candidate, and configuration labels. The static Canon profile must expose
`authority_locators` and `active_route_locator`. Missing migration labels or
locators block; the writer never infers them from the event, old manifest,
capsule, summary, router state, or FAL mirror.

The retained V2 compact adapter resolves one effective policy identity and warning/critical
ratio pair, passes all three into telemetry, and blocks if the telemetry report
does not repeat them exactly. A valid status-map omission proves `idle` only when
the target has one valid router mapping and direct target-session lookup succeeds;
mapping, status-map, 404, and required-telemetry failures remain distinct,
redacted fail-closed results.

Before a retained V2 non-dry compact capsule is persisted, the adapter verifies the event's
active-route generation and state/Combined/stage source hashes. The event must
also bind the fresh command-registry identity and exact `/after-compact` command
identity; both are reverified before preflight and immediately before the sole
command POST. Missing or changed identity blocks without sending. It then persists
one summarize intent, accepts only one attributable new compaction marker, and
treats timeout, competing marker or intent, and ambiguous hydration delivery as
`UNCERTAIN` without blind retry. Manual compact is recorded and never repeated for
the same participant/boundary. After one verified marker it runs target-first
Canon hydration, sends only `/after-compact <project-id> <role>`, verifies that report against
the direct Canon result, persists `ROUTE_READY` with `command_sent: false`, and
stops. Compatibility parsing may accept Canon `AUTO_RESUME`, but compact never
sends `/seq-next`, `/implement`, `/terv-review`, `/step-review`, or another
workflow-stage command. A later explicit continue is a separate transaction that
must re-read all authority and duplicate-send state. Summaries remain orientation
only.

`invoke-session-compact-flow.ps1`, its event schema, capsules, Active Route, and
route-ready output are reference-only. No active Orchestrator route invokes them.

## Closeout and cold references

After exact `ACK_ONLY`, install the fresh Owner closeout authority in protected runtime without a target write, then use the same run's complete CLOSEOUT projection. `/closeout-commit` may apply only synthesis-enumerated governance/closeout deltas, verify and stage explicit target paths, and commit without push. Behavior-changing source, tests, config, runbooks, commands, skills, and policy must already be in the frozen reviewed candidate. Target and FAL transactions remain separate.

Open `workflow-orchestrator-reference.md` selectively for: stage-aware output selection; native review envelopes and receipts; wrapper/runtime artifacts; parallel lanes; legacy-frontier blocking; ACK and compact guards; or incident recovery. See `../config/README.md` only when adding target review-domain mappings or exact Owner budget envelopes. Canon role, output, hydration, recovery, closeout, and FAL-adapter runbooks override contradictory cold legacy text.
