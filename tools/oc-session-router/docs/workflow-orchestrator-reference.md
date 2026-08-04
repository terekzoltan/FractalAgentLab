# Workflow Orchestrator Cold Reference

> Cold implementation reference retained during the Canon migration. Normal startup and after-compact hydration use `workflow-orchestrator-runbook.md`; load only the named section of this file for a concrete router-mechanics, recovery, compatibility, or worked-example question.

This is the preserved implementation reference for driving OC Session Router mechanics end-to-end. The Agent Workflow Canon owns shared lifecycle semantics, roles, authority, and terminal meaning; this reference specializes only transport, wrapper, recovery, and FAL-hook mechanics.

It reflects live target-project loops across WorldSim and RingFall. Keep target-specific facts in the target repo runtime state, not in shared defaults. Representative completed loops include:

- `P6-J(B)` after review-fix reruns
- `P7-A`
- `P7-B`
- RingFall Wave 1 contract/schema steps through W1-S6 review-fix
- later WorldSim Wave 10.5 / TR3 audit-gate loops

It is intentionally operator-oriented, not product-oriented.

Shared cross-project semantic baseline:

- the Agent Workflow Canon for lifecycle, role, authority, hydration, and terminal law
- `docs/templates/Global-Combined-Rules-Template.md`
- target-project `AGENTS.md` files are project overlays over that baseline
- this runbook remains authoritative only for OC Session Router mechanics that conform to the Canon

Authority boundary:

- the Agent Workflow Canon is the semantic authority for the shared workflow
- this file is the operational description of the live OC Session Router and how to use its mechanics
- any OC Server Orchestrator session should follow this same runbook; it is not personal operator memory
- if this runbook conflicts with the Canon on lifecycle, roles, authority, or terminal meaning, the Canon wins and this runbook carries reconcile debt until corrected
- if this runbook conflicts with a quick reference, older helper doc, or remembered habit on router mechanics, this runbook wins
- target-local runtime state remains authoritative for the current target, latest proof points, and target-specific constraints
- if a future wave/step/sprint changes router wrapper semantics, review timing, prompt-control injection, FAL sync hook usage, recovery behavior, or stop conditions, the same closeout must update this runbook

Authority order:

1. Target repo Combined / active plan / ops state for target-specific truth.
2. Agent Workflow Canon for shared lifecycle semantics, roles, authority, hydration, and terminal meaning.
3. This runbook for OC Session Router transport, wrapper, stop-condition, recovery, and FAL-hook mechanics.
4. Router artifacts and review artifacts as evidence of what happened.
5. Cheatsheets, parallel-flow docs, README snippets, and memory as convenience references only.

If intended router mechanics differ from this file, update it in the same closeout or explicitly stop and record reconcile debt. If shared semantics differ, change the Canon through its governed maintenance flow first, then align this runbook. Do not let orchestrator behavior drift into undocumented habit.

<!-- WORKFLOW-KERNEL-MAINTENANCE:v1 START -->
## Workflow Kernel Maintenance V1

`/workflow-fix` is the canonical maintainer command for changes to the OpenCode/FAL workflow kernel.

Workflow kernel surfaces that must not drift silently:

- `/workflow-fix` command and `workflow-fix` skill
- this runbook
- `/fal-orchestrate-target` command and `fal-orchestrate-target` skill
- `/fal-checkpoint-target` command and `fal-target-orchestration` skill
- `/closeout-commit` and closeout policy when closeout behavior changes
- `ops/PROJECT_STATE.md` and `ops/Combined-Execution-Sequencing-Plan.md` for active FAL sequencing/state
- OC Session Router artifacts as evidence of what happened
- FAL hygiene rules for source-of-truth order, checkpoint/evidence cadence, context hydration, compact boundaries, handoff sufficiency, reconcile debt, review-fix lineage, and explicit apply authority

Required behavior for workflow fixes:

- Use `grill-me` before generating an apply script when intent is ambiguous or architectural.
- Use `oc-toolsmith` for OpenCode command/skill file changes.
- Treat `%USERPROFILE%/.config/opencode` as the live implementation source and the Toolbox snapshot as a generated read-only mirror.
- Stage global command/skill changes as an isolated, byte-preserving baseline plus candidate in OpenCode Toolbox; validate the candidate before any live write.
- Produce one deterministic dry-run changeset bound to the exact source, workspace, contract, candidate, history, topology, and validation hashes. Apply only after the Owner approves that exact hash.
- Archive every replaced or removed byte outside live discovery, fail closed on drift or abnormal topology, roll back a failed disk phase, require a manual OpenCode restart, and verify the live registry plus regenerated snapshot afterward.
- Include a kernel coherence assessment covering runbook impact, `/workflow-fix` self-update impact, `/fal-orchestrate-target` impact, `/fal-checkpoint-target` impact, and state-doc impact.
- If behavior changes but this runbook is not updated, record why no runbook change is needed or carry explicit reconcile debt.
- Repo-local runbook changes travel as explicit workspace candidate operations in the same reviewed changeset when they are part of the kernel migration; unrelated active project files remain untouched.

This policy keeps the system fluid and adaptable while preserving a strong core that ties together owner intent, OC Server Orchestrator session routing, command/skill role behavior, FAL hygiene, and recoverable workflow state.
<!-- WORKFLOW-KERNEL-MAINTENANCE:v1 END -->

## Purpose
Use this runbook when you want one assistant or human operator to drive:

```text
Accountable Delivery Lane /seq-next
-> Meta /terv-review
-> Accountable Delivery Lane /terv-review-utan
-> Accountable Delivery Lane /implement
-> Meta /step-review
-> risk-selected typed review lanes and optional Swarm Assistant review
-> Meta final synthesis
-> Accountable Delivery Lane /step-review-utan
-> exact ACK_ONLY, or FIX_PLAN_REQUIRED plus a bounded plan ending FIX_PLAN_READY_FOR_IMPLEMENT and returning through Meta /terv-review, Delivery /terv-review-utan, /implement, Meta /step-review, and Accountable Delivery Lane /step-review-utan until an accepted synthesis receives exact ACK_ONLY
-> Meta /closeout-commit for accepted closeout, state/docs/FAL/evidence maintenance, hygiene, and explicit-path commit
-> optional batch-end compact of the Track session(s) that worked in the request
-> optional batch-end compact of Meta Coordinator
```

`Track` remains the default Delivery Lane and the shorthand used by existing router
session keys. A project overlay may authorize a bounded Specialist Delivery Lane for
an Epic. Session topology does not grant authority: a Track, specialist, Meta
Coordinator, or Swarm Assistant may orchestrate its own subagents when useful, but
the parent session retains its declared capability boundary and accountability.

Review-fix-loop-first compact exception:

- If the owner explicitly asks for review-fix-loop-first compaction, compact becomes the first operational step of the next review-fix loop, not the tail step of the previous RED loop.
- In that pattern, first capture the Track-authored fix plan and pin it as an artifact, then compact the Track session(s) from the finished RED loop first and Meta Coordinator second, and only then continue through Meta `/terv-review`, Delivery `/terv-review-utan`, and `/implement` from the ready revision.
- Do not compact immediately on raw `/step-review-utan` delivery, and do not compact the same RED loop again as batch-end tail compaction.
- Treat the pinned Track fix plan as the authority that survives compact. A compact summary is orientation only and must never replace the fix-plan artifact.
- If implementation finishes before a requested compact boundary, pin the stage-classified Track implementation report before compact; after compact, start `/step-review` from that artifact rather than from raw latest output.
- After any manual compact, record which sessions were compacted and do not compact those sessions again for the same boundary.

## Current Operating Policy

Default live mode is now:

- minimal interruption
- assistant-operated shell execution
- no routine approval prompts once the user has already said to run the loop through
- stop only for real blockers, ambiguity, or explicit user decision points

In practice:

- use `-AutoApprove` and `-AutoUseFirstStable` once the user has clearly approved the loop
- do not stop for routine `/terv-review`, `/implement`, `/step-review`, `GO`, or Swarm review forwarding
- use the OpenCode question tool only when there is a real need to stop
- keep the normal `-TimeoutMinutes 45` budget for plan, implementation, focused, standard, and bounded high-risk review waits; use `-TimeoutMinutes 60` only for an explicitly approved full adaptive Swarm review
- treat `deep` and `audit` review profiles as exceptional, not routine hardening: do not select either automatically; if the operator judges one necessary, obtain explicit owner approval with the question tool before dispatching it
- allow a high-risk profile to start a bounded, risk-targeted Swarm review automatically; full adaptive Swarm and five-to-seven typed lanes still require explicit owner approval
- if a full Swarm review has no final output at 45 minutes, inspect the Swarm transcript and pending-question API before doing anything else; when the original prompt is present and the review is still active, continue waiting through 60 minutes from prompt dispatch rather than re-sending the Swarm prompt or Meta `GO`
- if a full Swarm review still has no final output at 60 minutes, treat the run as uncertain and use the question tool instead of dispatching a duplicate review
- after a Swarm review is available, the only manual Meta continuation signal is the exact plain message `GO`; do not write a custom Meta prompt that summarizes, interprets, rephrases, or asks Meta to synthesize the Swarm result
- `run-step-review-flow.ps1` owns the normal `GO` send immediately after Swarm-prompt dispatch; manual `GO` is recovery-only and is allowed only after transcript inspection confirms that the canonical `GO` was not delivered
- a wrapper timeout or incomplete flow state does not authorize replacing the command protocol with an operator-authored Meta message; inspect the transcript and run state, then resume the wrapper or send only `GO` when its absence is proven
- after stable checkpoints, the same orchestrator session may invoke the separate `/fal-checkpoint-target` command or its guarded router helper; `/fal-orchestrate-target` itself remains transport-only
- after an accepted final synthesis has been routed through `/step-review-utan` and the Accountable Delivery Lane returns the exact terminal `ACK_ONLY`, run `/closeout-commit` in the Meta Coordinator session as the standard closeout boundary when a commit is expected
- default compact behavior for multi-step requests: compact only once at the end of the requested batch, not after every individual step, unless the user explicitly asks for a different compact boundary
- if the user explicitly asks for review-fix-loop-first compaction, capture the Track-authored fix plan after `/step-review-utan`, then compact the Track session(s) from the finished RED loop first, then any review/support session(s) that actively worked in scope, and Meta Coordinator last before the fix plan's Meta `/terv-review`
- when compacting multiple sessions for either batch-end or review-fix-loop-first compaction, compact the Track session(s) that worked in scope first, then any review/support session(s) that actively worked in scope, and Meta Coordinator last
- compact each session at most once for the same boundary and use exactly one compact method per session at that boundary

## Canonical Command And Control-Token Law

OpenCode commands own workflow prompts, role instructions, review semantics, and transition behavior. The router operator transports those commands and documented control tokens; it must not replace them with improvised orchestration prompts.

Hard rules:

- If the runbook names a command, invoke that command. Do not write a plain-message approximation of `/terv-review`, `/terv-review-utan`, `/implement`, `/step-review`, `/step-review-utan`, `/closeout-commit`, or another canonical command.
- If the runbook names a literal control token, send that token exactly. For the step-review phase transition, the complete manual message is `GO`; do not add a prefix, suffix, explanation, Swarm summary, requested verdict, or next-step instruction.
- Do not combine multiple canonical transitions into one operator-authored message. A custom message such as `GO: synthesize this review`, a review summary followed by `GO`, or a request to issue final synthesis is a protocol violation even when its factual content is correct.
- Do not summarize, reinterpret, or re-prompt content that a command already owns. Pinned command output and exact forwarded review artifacts are authoritative; operator-authored context is not a substitute.
- Convenience, token saving, timeout recovery, stale wrapper state, or fear of duplicate sends does not authorize changing the protocol. Resolve transport uncertainty first, then perform only the missing canonical action.
- A Meta `FINAL STEP REVIEW SYNTHESIS` is an internal workflow milestone, not an operator stop boundary. Immediately route the exact final synthesis to the Accountable Delivery Lane with `/step-review-utan`; do not report the step-review as complete, pause for ordinary confirmation, or interpret a request ending at "final synthesis" as permission to omit route-back.
- `/step-review-utan` is mandatory after every valid final synthesis regardless of `GREEN`, `YELLOW`, or `RED`. The Track needs the exact result to acknowledge acceptance, preserve constraints, or produce the next fix plan. Stop before route-back only for a real transport/auth failure, ambiguous or invalid synthesis, duplicate-send uncertainty, or an explicit owner instruction to pause before delivery.

Timeout/recovery decision table:

| Proven transcript/run state | Only allowed continuation |
|---|---|
| Swarm prompt was not delivered | Resume the wrapper from the saved run or repeat only the canonical prompt-dispatch stage |
| Swarm prompt was delivered and Meta `GO` is absent | Send exactly `GO` as a plain message |
| Meta `GO` is already present | Do not send `GO` again |
| Swarm review completed but the wrapper has not captured it | Pin or capture the exact Swarm output; do not replace it with an operator summary |
| Exact Swarm review still needs forwarding | Use the wrapper's canonical forwarding stage or forward the exact review body required by that stage, without interpretation |
| Final synthesis is missing | Continue waiting or resume the canonical stage; do not ask Meta in a custom prompt to synthesize |
| Valid final synthesis exists and `/step-review-utan` is absent | Immediately route the exact synthesis through `/step-review-utan`; final synthesis alone is not completion |
| `/step-review-utan` delivery is ambiguous | Inspect the Track transcript and live command delivery state; do not resend until absence is proven |
| Delivery remains ambiguous | Stop and inspect artifacts, transcript, pending questions, and run state; use the question tool if ambiguity remains |

The orchestrator may write a custom plain message only where this runbook explicitly defines a plain-message payload, or where a genuine user-owned decision has no canonical command/control-token path. Recovery is not such an exception when the missing action is already named by the runbook.

Question-tool stop conditions:

- wrong project or wrong session appears selected
- latest output candidate is ambiguous
- command/send would likely duplicate a previously sent step
- server error or resume state is unclear
- a config-time command, skill, agent, plugin, or model-routing change requires an OpenCode/router server restart
- Swarm prompt extraction fails
- final verdict is not clearly actionable
- the next step requires a user decision, not just execution
- a post-compact latest output looks summary-like or suspicious for the expected workflow stage
- compact status is uncertain after a timeout, retry, or manual operator action
- implementation would require creating or switching to a new detached/isolated worktree, temporary clone, or alternate implementation root that the owner did not explicitly approve
- the user explicitly asked for approval-heavy mode

Do not use question-tool interruptions just because the router is about to send a normal next-step command.

Server restart ownership rule:

- The orchestrator must never stop, kill, start, or restart an OpenCode/router server process.
- When a config-time change requires reload, stop with the question tool and ask the owner to restart it. State the affected port/server, the exact reason reload is required, and what live registry or smoke check will run afterward.
- An apply script may report that restart is required, but it must not perform the restart.
- After the owner confirms restart, perform read-only health and `/command` registry verification before resuming workflow traffic.
- If the owner says they already restarted the server, do not restart it again. Verify only.
- A timeout, stale registry, failed command lookup, or convenience never authorizes an orchestrator-managed restart.

Incident logging rule:

- When a real router/workflow malfunction is diagnosed, record it in `ops/Workflow-Incident-Backlog.md` with symptom, trigger, impact, current mitigation, and future hardening ideas.
- Before repeating a recovery pattern for a similar failure class, quickly check `ops/Workflow-Incident-Backlog.md` so known pitfalls like duplicate sends, classifier gaps, or timeout/resume traps are not reintroduced.

## Stage-Aware Output Selection

Candidate selection must be workflow-stage aware, not only "latest stable assistant text" aware.

Required policy:

- Treat session-progress chatter as non-authoritative unless the current stage explicitly expects it.
- Do not accept a candidate only because it is recent, stable, or above a character-count threshold.
- Prefer explicit stage markers over generic assistant text whenever a stage contract exists.
- If a saved pinned artifact exists for the needed stage, prefer it over raw latest-output fallback.

Common non-authoritative progress examples:

- "I'll verify..."
- "I'm checking..."
- "Now I'm reviewing..."
- "Build/test passed, now final checks..."
- `WAITING FOR GO`
- short reviewer/status updates that describe work in progress but are not the final stage output

Canonical stage envelopes are exact, ordered producer/consumer contracts:

- initial Delivery plan: `EPIC IMPLEMENTATION PLAN` plus the Canon fields and final route/readiness lines;
- Meta plan review: `META PLAN REVIEW` plus one `Plan class`, one `GREEN|YELLOW|RED`, and the exact Delivery action;
- Delivery revision: the complete corrected plan plus `DELIVERY PLAN REVISION`, byte-identical repeated Target/Epic/lane/final-plan identities, `PLAN_REVISION_COMPLETE`, and one disposition;
- implementation: `IMPLEMENTATION RESULT` plus exact route and one implementation terminal;
- Meta phase 1: top-level `SWARM ASSISTANT PROMPT`, a complete `/swarm-review` packet, and final `WAITING FOR GO`;
- Swarm lane evidence: top-level `SWARM REVIEW RESULT`, one `Verdict: APPROVE|APPROVE WITH FIXES|BLOCK`, and advisory-authority line;
- Meta final synthesis: the full Canon `FINAL STEP REVIEW SYNTHESIS` field block;
- Delivery response: exactly one Canon response-class envelope;
- closeout: the full Canon `CLOSEOUT + COMMIT RESULT` field block.

Fail-closed rule:

- If the latest assistant message does not match the expected stage kind, do not route it.
- Continue waiting, inspect more candidates, or use a pinned artifact.
- `fix_plan_ready_for_meta_review` is retired. A step-review fix plan must use `FIX_PLAN_READY_FOR_IMPLEMENT`; the review-fix helper routes it through one Meta `/terv-review` and Delivery `/terv-review-utan` before `/implement`.
- Prefer parsed OpenCode `info.time.created` timestamps over target-local message-order assumptions; nested Unix-millisecond timestamps are authoritative when present.
- Historical review formats are audit evidence only. Never classify or route them as a current terminal unless they contain the complete exact canonical envelope.
- If ambiguity remains after inspection, stop and use the question tool instead of forwarding a progress note as if it were a final output.

## Command Subtask And Prompt-Brevity Checks

Before routing a command into a long-lived Track or Meta session, inspect the command frontmatter when continuity matters:

- `subtask: true` runs the command in an isolated child session even when the router sends it to the correct parent session ID.
- The router's `Agent: <default session agent>` does not override a command's own `agent:` or `subtask:` frontmatter.
- Do not assume the parent session consumed or retained the child result. Verify the parent ACK and child output separately.
- If the next workflow step depends on same-session continuity, stop and ask before using a `subtask: true` command, or change the command through the approved workflow-fix/toolsmith path.
- The global `/terv-review-utan` command uses `agent: plan` without `subtask: true`; its result remains in the routed parent session. A process started before this command change must be restarted before its command registry is trusted.
- Router command transports query the live OpenCode `/command` registry before sending `/terv-review-utan` or `/step-review-utan`. If the live entry reports `subtask: true`, routing fails before delivery with a restart instruction; the disk file alone is not sufficient evidence that a long-running server reloaded the change.
- Do not bypass this gate with a direct command POST. Abort any already-running parent session that begins implementation after receiving a child-plan result, inventory any isolated worktree it created, and preserve the plan output as evidence only.

Keep recovery and corrective prompts compact:

- Send the decision delta, artifact/message ID, exact next action, and prohibitions; do not paste full historical reviews when a pinned artifact already exists.
- Prefer a pinned artifact path plus a short summary over duplicating the artifact body in an extra message.
- Do not repeat repo status, test logs, or unchanged context already injected by the target command.
- For operator correction/recovery messages, target roughly 1,500 characters or less unless the receiving command contract requires a full body.
- When a full review body is required, avoid duplicating it in `ReviewFocus`, wrapper notes, and follow-up messages.

## Post-Handoff ACK Verification

After routing `/terv-review-utan` or `/step-review-utan`, do not treat packet delivery alone as proof that the target Track has consumed the handoff.

Known rare failure mode:

- The command route can succeed, but the receiving session may produce no useful Track output because it hit a token/context limit while processing the handoff.
- This is most risky before `/implement`, because starting implementation from an unconsumed or partially consumed Meta review can bypass required plan-review constraints.

Required operator behavior:

- Before an initial `/implement`, use the pinned final Delivery plan and its delivery receipt; verify that the exact plan reflects the Meta plan-review result and ends `IMPLEMENT_READY`. Do not recover implementation authority from an unpinned latest-output read.
- If the final plan artifact, hash-bound receipt, or `/terv-review-utan` delivery proof is missing or inconsistent, stop and reconcile the saved run/transcript instead of selecting another recent message by recency.
- If the user manually re-sends or re-requests `/terv-review-utan`, resume only after a provably newer Delivery artifact contains the exact `DELIVERY PLAN REVISION` fields and ordered `PLAN_REVISION_COMPLETE` plus one disposition.
- For review-fix cycles, the source is the exact pinned final synthesis, pinned Delivery response containing the Track-authored fix plan and `FIX_PLAN_READY_FOR_IMPLEMENT`, and the hash-bound delivery receipt proving that response belongs to the same Target/Epic/Candidate/Accountable Lane tuple. The review-fix wrapper validates those three artifacts; raw latest output, the Meta packet alone, and operator summaries are not inputs.

## Post-Compact Latest-Output Guard

Compact/summarize output can appear as a normal assistant message and therefore can poison latest-output routing if the workflow relies on a raw "current latest" fallback.

Required operator behavior for review-fix loops:

- If review-fix-loop-first compaction is in use, capture and pin the Track-authored fix plan before compact.
- After compact, pass the pinned Track fix plan to the review-fix helper; do not rely on raw latest-output fallback.
- If compact occurs after `/implement`, capture and pin the implementation report before compact, then pass that exact report into the next `/step-review`. The post-compact summary is not an implementation report even when it describes implemented changes.
- If the operator reports a manual compact, treat that as an explicit boundary signal: mark the affected sessions compacted, hydrate from canonical plans and pinned artifacts, and skip router-driven summarize for those sessions at that boundary.
- Route from the pinned fix-plan artifact, or fail closed and inspect more candidates/artifacts.
- If a candidate after compact looks like a broad session summary rather than a Track-authored fix plan, stop and inspect instead of routing it; if the next action remains ambiguous, use the question tool and surface that the workflow state looks suspicious.
- For parallel review-fix loops, do not use this compact-first pattern unless lane-specific fix-plan artifacts are pinned first; otherwise serialize or ask.

## FAL Checkpoint Hook Policy

Stable target-project boundaries should either run the FAL checkpoint policy, explicitly record that no sync is needed, or record reconcile debt. The semantic sources are the Agent Workflow Canon FAL adapter and the installed `/fal-checkpoint-target` contract; project plans that introduced the hooks are implementation provenance only.

Authority order for these hooks:

1. Target Combined / active wave plan / target detail docs / target ops state.
2. Pinned router artifacts and review artifacts.
3. FAL aggregate evidence in the FAL control repo.
4. Target `.fal/ACTIVE_CONTEXT.*` as FAL mirror state only.
5. Compact/session memory as orientation cache only.

Required serial hook points:

- `meta_plan_review_done` after a stable Meta plan review and `/terv-review-utan` route-back, or explicit route-back debt.
- `step_review_done` after final step-review synthesis and `/step-review-utan` route-back.
- `review_fix_done` after an accepted review-fix cycle final synthesis and route-back.
- `handoff_done` when the next actor should continue without full transcript access.

Conditional hook points:

- `implementation_done` only when implementation evidence must be preserved before a long interruption, handoff, or compact boundary.
- `pre_compact_checkpoint` and `post_compact_hydration` only from explicit compact-boundary signals. The router must not infer a compact event or invoke unattended compact unless the reviewed effective policy and strict target event authorize that exact boundary. Without that pair, it may only recommend compact and ask the operator.

Clean closeout requires a pinned artifact, separated `workflow_verdict` / `domain_verdict` / `routing_verdict`, current target FAL mirror/evidence or explicit reconcile debt / no-sync-needed reason, handoff sufficiency when relevant, and no missing final synthesis. If any of those are absent, do not claim clean closeout.

Fail closed and use the question tool or explicit reconcile debt when repo/session ownership is ambiguous, a pinned artifact is missing, latest output may be stale, duplicate-send risk exists, server/auth state blocks safe routing, compact boundary status is unsafe/unknown, or a no-go scope would be opened.

Current helper safeguards: transport wrappers never write FAL inline. They require a pinned source, classify it against the requested checkpoint stage, and may persist a dry-run proposal plus a separate `/fal-checkpoint-target` dispatch packet. Only that separate command may apply an authorized FAL write. Parallel wrappers preserve lane-level artifacts; a combined final synthesis is referenced evidence only, never all-lane clean-closeout proof by itself.

<!-- COMPACT-BOUNDARY-ADVISORY:v1 START -->
## Compact V2 Policy Adapter

OpenCode supports `/compact` in the TUI and exposes `POST /session/:id/summarize` in the server API. OpenCode message payloads include provider-observed usage for completed assistant requests, and OpenCode 1.18 exposes active messages after the last compaction through `GET /api/session/:id/context`. Neither surface is an exact provider-reported measurement of the context being assembled right now.

Policy:

- Telemetry remains read-only evidence. Only the reviewed
  `opencode-compact-policy/v1` adapter plus a strict target event may authorize
  compact at `before_dispatch`, `after_stage_output`, or `epic_closeout`.
- Do not compact during mid-review, unresolved fix-cycle ambiguity, stale latest-output ambiguity, duplicate-send risk, missing pinned artifact, or before the next frontier is pinned.
- Safe boundaries include accepted plan review, accepted implementation evidence after pinned diff/test state, accepted final step-review synthesis, accepted review-fix closeout, explicit handoff after next action is pinned, or closeout after state/evidence is current.
- `auto_safe` is fluidity-first: ordinary `normal` and `unknown` work continues;
  `warn` acts at the first proven safe boundary; `critical` blocks only a new long
  stage; `over_limit` permits bounded recovery rather than automatic compact.
- `recommend`, `ask`, and `disabled` never auto-compact. A target override may
  only tighten the global mode, thresholds, retries, exclusions, or gates; it may
  add but never remove a global evaluation check. Required gates are enforced
  against the event's `satisfied_gates` set before compact action.
- Accepted `epic_closeout` compacts only ledger participants, ordered Delivery,
  review/support, then Meta/Orchestrator with stable logical-label tie-breaking.
- Use `scripts/session-context-status.ps1` for normal read-only pressure checks. It keeps the latest completed provider observation separate from a derived active-context estimate and never treats cumulative session billing/cache totals as current context.
- If token telemetry is unavailable or inconclusive, fall back to boundary safety, not fake precision.
- For router-driven server compaction, the canonical API method is `POST /session/:id/summarize` with an explicit body containing `providerID` and `modelID`.
- A generic router message send whose text happens to be `/compact` is not a canonical compact transport and must not be used as proof that compaction happened.
- The OpenCode TUI `/compact` remains valid as an explicit manual operator action inside that session.
- For any single session at a single compact boundary, choose exactly one compact method and run it at most once.
- A durable boundary lock spans participant merge, V2 boundary write, run-ledger
  recovery, transport, hydration, and resume. `UNCERTAIN` or any outstanding
  participant intent blocks later event IDs for that boundary until explicit
  reconciliation.
- Persist one hash-bound intent before summarize. Continue only after exactly one
  attributable new marker. Timeout, exception, competing marker/intent, unmatched
  response identity, or ambiguous resume is `UNCERTAIN`: no hydration, resume, or
  blind retry. One retry is possible only after explicit pre-acceptance rejection,
  unchanged markers, and no competing intent.
- If an operator already compacted a session manually for the current boundary, record that session as done and skip router-driven compaction for that same boundary.

Token telemetry:

- Use `scripts/session-context-status.ps1 -Target <logical-name>` for one mapped session, `-SessionId <id>` for one explicit session, or `-AllMapped` for the bounded registry set.
- Default pressure thresholds are 75% warning and 87.5% critical, which correspond to 300K and 350K for a 400K context model.
- Pressure only recommends a safe compact boundary. Checkpoint and workflow authority still decide whether compact is permitted.
- `ops/temp/probe-opencode-token-usage.ps1` remains a historical diagnostics probe, not the normal current-pressure interface.
<!-- COMPACT-BOUNDARY-ADVISORY:v1 END -->

## Post-Step-Review Closeout + Commit Law

`/closeout-commit` is now the canonical post-review closeout command for OC Server Orchestrator workflows.

Session routing rule:

- Send `/closeout-commit` to the Meta Coordinator session, not to the Track session.
- The Accountable Delivery Lane owns work through `/step-review-utan`; accepted closeout requires its exact `ACK_ONLY`, while any other valid terminal routes elsewhere.
- Meta Coordinator owns the final accepted closeout command, commit decision, and post-closeout compact sequencing.

When an accepted step is expected to update state/docs/evidence and produce a local commit, do not skip this boundary. It is the standard place for final maintenance, FAL/evidence checks, hygiene, explicit staging, and commit decision.

Use it only after all three gates hold:

- Meta issued an accepted final synthesis with no unresolved blocking/major finding and every accepted residual on an active route;
- the exact synthesis was routed through `/step-review-utan` to the Accountable Delivery Lane; and
- the lane's resulting terminal is exactly `ACK_ONLY`, not a generic acknowledgement, fix plan, or summary.

Purpose:

- apply only the exact governance/closeout delta set enumerated in the accepted final synthesis, such as target state, Combined status, durable finding routes, and accepted evidence pointers
- reject any omitted behavior-changing source, test, config, runbook, command, skill, or policy change and route it back through a frozen candidate and review-fix loop
- run final hygiene checks before commit
- stage only explicit intended pathspecs
- commit the accepted closeout/code/state/docs patch when gates pass

Hard gates:

- do not run `/closeout-commit` as a substitute for review-fix when the step-review is RED or has unresolved blocking/major findings
- do not run `/closeout-commit` without the exact prior `ACK_ONLY` terminal from `/step-review-utan`
- do not commit YELLOW work unless every residual finding has an explicit active gate and the final Meta decision says commit is allowed
- do not use `git add .`
- do not force-add ignored operational files unless explicitly authorized for that step
- do not push
- do not invoke unattended `/compact`; at most recommend it at a safe accepted boundary and require explicit operator approval
- do not infer implicit compact-event detection
- do not open P8/full orchestrator/bridge/API/public-output scope just because closeout is running

Operational meaning:

- the router itself still must not silently automate commits or pushes
- `/closeout-commit` is an explicit operator/Meta command, not an unattended router side effect
- the command invocation authorizes a local commit only after it re-checks state, diff, verification, ownership, and explicit file scope
- if closeout discovers a real code/workflow defect, it must stop and route back to review-fix or implementation instead of patching broad behavior under a closeout label

Post-closeout compact order:

- only after accepted Meta closeout and commit/no-commit decision is finalized
- default: compact once at the end of the requested batch, not after every accepted step
- review-fix-loop-first compaction is a separate owner-requested pattern; it happens before the next `/implement` only after the Track-authored fix plan is captured
- if batch-end compact is used, compact each Track session that actively worked in the batch first, then each review/support session that actively worked in the batch, and compact Meta Coordinator last
- if the user explicitly requests per-step compaction for accepted steps, compact each Track session that actively worked in the just-closed step first, then each review/support session that actively worked in that step, and compact Meta Coordinator last
- do not compact the same session twice for the same boundary, and do not mix compact methods for that same session/boundary pair
- if closeout is blocked, unresolved, or still waiting on a final synthesis or exact `ACK_ONLY`, do not compact that step as cleanly closed

Recommended input shape:

```text
/closeout-commit
Target: <wave / step / sequence item>
Track: <Track / role>
Final synthesis: <pinned accepted synthesis identity and selected verdict>
Commit message: <step-specific commit message>

Step-review / handoff:
<paste final accepted synthesis and the resulting exact ACK_ONLY terminal>

Closeout scope:
<state/docs/FAL/evidence/maintenance items to update>

Allowed commit paths:
<one intended path per line>

FAL sync:
none | dry-run | apply

Verification to run:
<commands or derive relevant checks>

Notes / exclusions:
<forbidden scope, ignored local surfaces, target repo caveats>
```

Minimum closeout hygiene:

- read `ops/PROJECT_STATE.md` and relevant Combined/target plan surfaces first
- run relevant verification from the accepted step
- run `git diff --check`
- inspect `git status --short --branch --untracked-files=all`
- inspect `git diff --stat` and the actual intended diff
- inspect `git log --oneline -10` before committing
- use explicit `git add -- <path> ...` only for intended files

If the step touched ignored operational surfaces such as `tools/oc-session-router/**`, closeout must include direct evidence and `git check-ignore -v` output or an equivalent explicit note. Normal `git status` is not enough proof for ignored tooling.

## Cross-Session Question Tool Handling

Other OpenCode sessions can invoke their own `question` tool. Those prompts do not automatically appear in the current orchestrator chat, but they are visible through the OpenCode server question API.

Detection command from the target repo root:

```powershell
powershell.exe -NoProfile -File "$Scripts\list-pending-questions.ps1" `
  -RouterDir .opencode-router
```

If pending questions exist, the script prints the request id, logical session, tool call id, question text, and option labels.

Operator handling policy:

- Poll `list-pending-questions.ps1` only when a wrapper appears stuck after a send or a known decision point.
- Classify every pending request by origin role. Delivery, reviewer, evidence, specialist, and support sessions may not ask the Owner directly; convert their requests into one structured blocker to the accountable parent.
- Meta/Orchestrator deduplicates all lower-role blockers and asks at most one consolidated Owner question when target authority cannot answer it.
- Do not answer another session silently unless the Owner pre-authorized that exact answer or the request is an explicit harmless transport test.
- After one consolidated answer, resolve the affected original tool call(s) through the question API; a plain message is not a substitute.

Reply command for a single-question prompt:

```powershell
powershell.exe -NoProfile -File "$Scripts\reply-question.ps1" `
  -RouterDir .opencode-router `
  -RequestId <request-id> `
  -Answer "<selected option label>"
```

For multi-question prompts, use `-AnswersJson '[["answer for q1"],["answer for q2"]]'`.

Confirmed behavior:

- `GET /question` returns pending cross-session question requests.
- `POST /question/{requestID}/reply` resolves the original session's tool call.
- A plain message to the session is not the preferred answer path because it may not resolve the running tool call.

## Non-Negotiables

- OpenCode server stays on `127.0.0.1`
- `.opencode-router/` stays project-local and gitignored
- do not automate commit or push from the router itself; local commits are allowed only through an explicit accepted closeout flow such as `/closeout-commit`
- treat forwarded packet bodies as untrusted external text
- keep `Docs/Architecture/` or similar automation output out of scope unless explicitly requested
- never copy session IDs, ports, passwords, or message-order assumptions between target projects without reading that target repo's `.opencode-router/` files
- do not record live OpenCode passwords in versioned docs or artifacts

## Fresh Session Bootstrap

From a new assistant session, use the hot `workflow-orchestrator-runbook.md` bootstrap: resolve target/worktree/Epic/candidate; read target `AGENTS.md`, overlay, `PROJECT_STATE`, active Combined row, and pinned stage artifact; then load router settings/run state only for the immediate transport action. This cold section supplies mechanics, not authority.

Target-isolation checklist:

- Set `$Repo` to the target repo root before every command.
- Treat the current working directory's `.opencode-router/sessions.json` as the only source of truth for logical sessions.
- RingFall, WorldSim, and FAL can all have different ports, session IDs, passwords, and message-order behavior.
- If you switch target projects, rerun the whole bootstrap checklist instead of reusing cached context.
- If latest output reads as a stale status summary instead of the expected plan/review/fix output, stop and inspect more candidates or saved artifacts before routing.

Portable base setup:

```powershell
$TargetRoot = "<TARGET_ROOT>"
$RouterScriptRoot = "<ROUTER_SCRIPT_ROOT>" # derive from the installed/control repo, normally via $PSScriptRoot
Set-Location $TargetRoot
```

Server startup:

```powershell
Set-Location $TargetRoot
$env:OPENCODE_SERVER_PASSWORD = "<PASSWORD_FROM_PRIVATE_RUNTIME>"
opencode serve --hostname 127.0.0.1 --port <PORT_FROM_TARGET_RUNTIME_REGISTRY>
```

If launching from `cmd.exe`, this quoting pattern is known-good:

```cmd
set "OPENCODE_SERVER_PASSWORD=YOUR_PASSWORD" && powershell.exe -NoProfile -File "..."
```

Server/auth handling:

- `401 Unauthorized` means the operator password does not match the target OpenCode server. Ask the user for the correct password or use a user-provided value for that target only.
- Connection refused / cannot connect means the target server is down or unreachable. Stop and ask; do not silently restart or change background servers.
- Do not guess a password from another target project.
- After changing auth, verify with read-only `read-latest-output.ps1` before sending commands.

## Project-Local Router Settings

Use the target repo's `.opencode-router/router-settings.json`. The following shape is known-good for current local targets:

```json
{
  "message_order": "oldest_first",
  "poll_seconds": 15,
  "timeout_minutes": 45,
  "stable_polls": 2,
  "limit": 5,
  "candidate_count": 3,
  "min_output_chars": 150,
  "swarm_review_depth": "auto"
}
```

Notes:

- `oldest_first` matched the live WorldSim and RingFall server behavior better than newest-first selection.
- `min_output_chars=100` can help shorter WorldSim outputs; `150` worked well for RingFall's longer Meta/Track packets.
- `limit=5` is suitable only for short/fresh sessions. Long-lived Meta/Swarm sessions may need a much larger target-local window, such as `limit=2000` with a bounded `candidate_count`.
- `timeout_minutes=45` is the normal default. Keep that project-local default for ordinary work; pass `-TimeoutMinutes 60` explicitly to `run-step-review-flow.ps1` for `high_risk`, `deep`, or `audit` reviews that resolve to a full Swarm review.
- Prefer the project-local setting over shared memory. If selection looks wrong, inspect multiple candidates before routing.

Endpoint model-shape rule:

- The message endpoint accepts the structured provider/model object used by `New-OCRouterMessageRequestBodyObject`.
- The command endpoint accepts a provider/model string such as `openai/gpt-5.6-sol`; `New-OCRouterCommandRequestBodyObject` must not serialize that field as an object.
- `Expected string | null ... at ["model"]` identifies a request-shape failure, but a wrapper POST exception still remains delivery-uncertain until its durable intent and recipient transcript are reconciled. Correct the request body only after non-delivery is proven; never use the error text alone as resend authority.

## Canonical Commands

Replace the sample values with the exact active Combined row and pinned run artifacts. `Target` is the project/repository binding; `Epic` is the delivery identity and must be distinct. Serial wrappers require the explicit Accountable Lane ID/class/profile tuple. Parallel Track lanes may use `session-key|Target|Epic`, which resolves deterministically to `<Track role label>|TRACK|<session-key>`. A non-Track Accountable Lane must use the explicit six-field form `session-key|Target|Epic|accountable-lane-id|lane-class|lane-profile`, where lane class is `TRACK`, `SPECIALIST_DELIVERY`, or `GOVERNANCE`; a three-field non-Track spec is rejected rather than inferred. A step-review wrapper obtains and pins `Candidate` from the exact `IMPLEMENTATION RESULT`; it has no operator-supplied `-Candidate` parameter. Review-fix wrappers instead require the already-reviewed Candidate plus the exact synthesis/Delivery-response/receipt lineage described below.

Start full plan-review loop, including `seq-next`:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-plan-review-flow.ps1" `
  -Track track-b `
  -Target "WorldSim" `
  -Epic "P7-B" `
  -AccountableLaneId "Track B" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-b `
  -StartSeqNext `
  -AutoUseFirstStable `
  -AutoApprove
```

`-StartSeqNext` is the source mode in this example: the wrapper dispatches `/seq-next` and pins the resulting exact plan. When `/seq-next` was already completed, omit `-StartSeqNext` and pass `-PinnedTrackOutputPath <exact-plan-artifact>` with the same Target/Epic/Accountable Lane tuple. The two source modes are mutually exclusive.

For initial implementation, dispatch canonical command `implement` through the current command endpoint under the Transport Law, with a persisted pre-send intent bound to the pinned final Delivery plan and its receipt. Wait for and pin the exact `IMPLEMENTATION RESULT` before starting serial step review. The retired `invoke-command-and-wait.ps1` path is not a live or recovery path.

Run the full guided step-review flow:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-step-review-flow.ps1" `
  -Track track-b `
  -Target "WorldSim" `
  -Epic "P7-B" `
  -Wave "P7" `
  -AccountableLaneId "Track B" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-b `
  -SwarmReviewDepth standard `
  -AutoApprove `
  -AutoUseFirstStable
```

Run a cheaper guided re-review without Swarm Assistant:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-step-review-flow.ps1" `
  -Track track-b `
  -Target "WorldSim" `
  -Epic "P7-B" `
  -Wave "P7" `
  -AccountableLaneId "Track B" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-b `
  -SkipSwarmReview `
  -MetaInternalLanes 1 `
  -AutoApprove `
  -AutoUseFirstStable
```

RingFall-style Meta-only review with three internal Meta lanes:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-step-review-flow.ps1" `
  -Track track-e `
  -Target "RingFall" `
  -Epic "W1-S6-C1-I-C1-J" `
  -Wave "W1" `
  -AccountableLaneId "Track E" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-e `
  -SkipSwarmReview `
  -MetaInternalLanes 3 `
  -AutoApprove `
  -AutoUseFirstStable
```

Resume a partial step-review flow. The saved run pins Target, Epic, Candidate, Accountable Lane tuple, artifacts, and review controls; supplied resume values must match it:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-step-review-flow.ps1" `
  -Track track-b `
  -Target "WorldSim" `
  -Epic "P7-B" `
  -Wave "P7" `
  -AccountableLaneId "Track B" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-b `
  -Resume `
  -RunId <runId> `
  -AutoApprove `
  -AutoUseFirstStable
```

Run canonical fix cycle 1 after Track already produced the fix plan:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-review-fix-cycle.ps1" `
  -Track track-b `
  -Target "WorldSim" `
  -Epic "P7-B" `
  -Wave "P7" `
  -Candidate "sha256:<reviewed-candidate>" `
  -AccountableLaneId "Track B" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-b `
  -PinnedFinalSynthesisPath ".opencode-router\step-review-runs\<runId>\05-meta-final-synthesis.md" `
  -PinnedDeliveryResponsePath ".opencode-router\step-review-runs\<runId>\06-track-delivery-response.md" `
  -PinnedDeliveryReceiptPath ".opencode-router\step-review-runs\<runId>\step-review-delivery-receipt.json" `
  -AutoApprove `
  -AutoUseFirstStable
```

Run canonical fix cycle 2+:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-review-fix-cycle.ps1" `
  -Track track-b `
  -Target "WorldSim" `
  -Epic "P7-B" `
  -Wave "P7" `
  -Candidate "sha256:<cycle-1-reviewed-candidate>" `
  -AccountableLaneId "Track B" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-b `
  -PinnedFinalSynthesisPath ".opencode-router\step-review-runs\<cycle-1-step-runId>\05-meta-final-synthesis.md" `
  -PinnedDeliveryResponsePath ".opencode-router\step-review-runs\<cycle-1-step-runId>\06-track-delivery-response.md" `
  -PinnedDeliveryReceiptPath ".opencode-router\step-review-runs\<cycle-1-step-runId>\step-review-delivery-receipt.json" `
  -CycleIndex 2 `
  -AutoApprove `
  -AutoUseFirstStable
```

At a stable checkpoint, select `-FalSyncCheckpoint` only on a wrapper that supports it and supply that wrapper's complete FAL identity tuple. The wrapper may persist a proposal and receipt; it never applies a FAL write inline. Dispatch canonical `/fal-checkpoint-target` separately, bound to the exact proposal, pinned source artifact, receipt, Target/Epic/Candidate/Accountable Lane identity, and explicit write authority. A helper-level `-Apply` switch is not a live substitute for that command boundary.

After a manual detour, reconcile missing checkpoints lane by lane from their pinned authoritative artifacts and receipts. Record proposal/dispatched/verified/failed state or explicit reconcile debt; do not batch-infer acceptance or generate an apply from session memory.

Parallel plan review for multiple lanes:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-plan-review-flow.ps1" `
  -Lane @(
    "track-c|WorldSim|P7-C",
    "track-a|WorldSim|P7-D"
  ) `
  -StartSeqNext `
  -AutoUseFirstStable `
  -AutoApprove
```

For example, an overlay-authorized non-Track lane uses a six-field entry such as `simulation-delivery|WorldSim|P7-SIM|Simulation Delivery|SPECIALIST_DELIVERY|simulation-delivery-v1`; the session key and capability profile must already exist in target runtime policy. Do not shorten that entry to three fields.

Parallel plan review for 5 lanes:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-plan-review-flow.ps1" `
  -Lane @(
    "track-a|WorldSim|W7.6-P2-A",
    "track-b|WorldSim|W7.6-P2-B",
    "track-c|WorldSim|W7.6-P2-C",
    "track-d|WorldSim|W7.6-P2-D",
    "track-e|WorldSim|W7.6-P2-E"
  ) `
  -StartSeqNext `
  -AutoUseFirstStable `
  -AutoApprove
```

Parallel step review for multiple lanes:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-step-review-flow.ps1" `
  -Lane @(
    "track-c|WorldSim|P7-C",
    "track-a|WorldSim|P7-D"
  ) `
  -FalSyncCheckpoint `
  -FalTargetRepoPath $Repo `
  -FalProjectId worldsim `
  -FalProjectName WorldSim `
  -SwarmReviewDepth standard `
  -AutoUseFirstStable `
  -AutoApprove
```

Parallel transport may persist lane-level FAL checkpoint proposals and a reconcile summary, but it never applies FAL writes inline. Apply authority belongs to separate `/fal-checkpoint-target` dispatches bound to pinned lane artifacts. Mixed or failed checkpoint results remain explicit reconcile debt; inability to preserve the summary is a hard evidence failure.

Resume a parallel plan-review run. Saved lane records restore each exact Target/Epic/Accountable Lane tuple:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-plan-review-flow.ps1" `
  -Lane @(
    "track-c|WorldSim|P7-C",
    "track-a|WorldSim|P7-D"
  ) `
  -Resume `
  -RunId <runId> `
  -AutoUseFirstStable `
  -AutoApprove
```

Resume a parallel step-review run. Saved lane records restore each tuple and pinned implementation Candidate:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-step-review-flow.ps1" `
  -Lane @(
    "track-c|WorldSim|P7-C",
    "track-a|WorldSim|P7-D"
  ) `
  -Resume `
  -RunId <runId> `
  -AutoUseFirstStable `
  -AutoApprove
```

Run a parallel review-fix cycle for failed lanes only. `SourceManifestPath` is mandatory and its version-1 `lanes` array must contain exactly one entry per `-Lane`, with no missing or extra entry fields:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-review-fix-cycle.ps1" `
  -Lane @(
    "track-c|WorldSim|P7-C",
    "track-a|WorldSim|P7-D"
  ) `
  -SourceManifestPath ".opencode-router\review-fix-inputs\P7-C-P7-D-cycle-1.json" `
  -AutoUseFirstStable `
  -AutoApprove
```

Each manifest lane entry must contain exactly: `track_key`, `wave`, `candidate`, `accountable_lane_id`, `accountable_lane_class`, `accountable_lane_profile`, `final_synthesis_path`, `delivery_response_path`, `delivery_receipt_path`, and `fal_checkpoint_proposal_path`. Use `NONE` for `fal_checkpoint_proposal_path` when no proposal belongs to the source receipt. Paths resolve relative to the manifest directory and must identify the exact pinned lane artifacts; the wrapper verifies their hashes, strict output classes, delivery receipt, Target/Epic/Candidate, and Accountable Lane tuple before dispatch.

When only one implementation reaches `REVIEW_READY`, the top-level parallel review-fix run remains authoritative and invokes the serial **step-review** child for that one candidate. It does not switch to a serial review-fix wrapper or emit a separate fallback-state contract.

Resume a parallel review-fix cycle:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-parallel-review-fix-cycle.ps1" `
  -Lane @(
    "track-c|WorldSim|P7-C",
    "track-a|WorldSim|P7-D"
  ) `
  -SourceManifestPath ".opencode-router\review-fix-inputs\P7-C-P7-D-cycle-1.json" `
  -Resume `
  -RunId <runId> `
  -AutoUseFirstStable `
  -AutoApprove
```

Inspect any parallel run and get the exact resume command:

```powershell
powershell.exe -NoProfile -File "$Scripts\inspect-parallel-run.ps1" `
  -RunId <runId>
```

## Canonical End-to-End Loop

### 1. Plan Review

Run `run-plan-review-flow.ps1 -StartSeqNext`.

Meta plan-review isolation rule:

- Meta plan-review is a single Coordinator review of the Track-authored `/seq-next` plan and target evidence.
- Do not ask Meta to launch subagents, internal review lanes, or a Swarm review while producing `/terv-review` output.
- The global `/terv-review` command may use the canonical `plan-review` method skill only when that skill remains direct and non-delegating. It must not invoke a prompt pattern that fans the review out or creates a second review authority.
- The Track must not launch review-domain, review-architecture, review-security, reviewer, critic, Swarm, or equivalent review subagents while producing or refining the plan. Repo exploration needed to ground the plan is allowed; parallel review fan-out is not.
- Escalate implementation risk through the later `/step-review` stage instead; plan review remains a direct Meta-to-Track review, not an early duplicate of implementation review.
- There is exactly one plan-review pass. No Meta verdict permits a second `/terv-review` for the same plan.

Expected sequence:

```text
Track /seq-next
-> exact Track plan artifact pinned and stage/Target/Epic/Accountable Lane classified
-> Meta /terv-review
-> Meta review output selected
-> Track /terv-review-utan
```

Plan-review verdict routing is mandatory:

- `GREEN`, `YELLOW`, and `RED` are Meta-only verdicts. Route every verdict exactly once with `/terv-review-utan`.
- `/terv-review-utan` applies every required correction to the `/seq-next` plan. Its normal and strongly preferred result is an implementation-ready corrected plan. It does not emit a second color verdict, approve its own revision, or request another `/terv-review`.
- A completed Track response must emit `PLAN_REVISION_COMPLETE` and exactly one disposition: `IMPLEMENT_READY` or `IMPLEMENT_BLOCKED`.
- `IMPLEMENT_READY` proceeds to `/implement`, regardless of the original Meta color, because the Track has incorporated the one-pass review into the final implementation plan.
- `IMPLEMENT_BLOCKED` is exceptional. Use it only when the input is not the expected Meta review, or implementation is genuinely impossible because a named owner decision, authority boundary, dependency, or external prerequisite remains unresolved. Discomfort, minor uncertainty, or ordinary plan correction is not a block.
- If resolving the review requires material scope, ownership, contract, dependency, or sequencing expansion, start a new `/seq-next` plan instead of re-reviewing or disguising the expansion as a revision.

Optional FAL sync point:

- after stable plan review, pin the final corrected Delivery plan and its receipt as the implementation-authority frontier;
- a transport wrapper may persist a dry-run checkpoint proposal or explicit reconcile debt;
- any write requires a separate `/fal-checkpoint-target` command with pinned artifact and explicit authority;
- never substitute the older Meta review for the final Delivery revision or claim clean checkpoint from transport alone.

### 2. Implementation

Dispatch canonical command `implement` through the current command endpoint from the Accountable Delivery Lane, bound to the pinned final plan/receipt and a persisted dispatch intent. Pin the exact `IMPLEMENTATION RESULT` and its Candidate identity before invoking `run-step-review-flow.ps1`. Do not use the retired `invoke-command-and-wait.ps1` helper for new work or recovery.

Implementation workspace selection:

- The existing target worktree is the default implementation root. A dirty worktree, overlapping user changes, inconvenient branch state, or cleaner evidence setup does not by itself authorize creating or switching to a detached/isolated worktree, temporary clone, or alternate implementation root.
- Before creating or selecting a new implementation root, stop and use the question tool. Explain the concrete collision, the proposed root/base, how changes would later be integrated, and the simpler alternatives, then obtain explicit owner approval.
- Do not treat a Track plan, Meta plan-review suggestion, automation default, or generic permission to implement as approval for a new worktree strategy unless it explicitly authorizes that root/worktree choice.
- If safe implementation in the existing worktree is impossible and owner approval is unavailable, report the blocker instead of silently increasing workflow complexity.
- An already-created alternate root may be continued only after the owner explicitly accepts that specific root and continuation path. That acceptance does not authorize creating another root.

Delivery-Lane delegation budget:

- The Accountable Delivery Lane implements the accepted plan, runs deterministic verification, and performs a direct diff self-review.
- It may orchestrate implementation or advisory subagents when that materially helps complete the accepted plan. Delegation does not widen scope, mutation authority, acceptance authority, or ownership; the parent lane remains accountable for synthesis and evidence.
- Avoid repeated independent review fan-out after every mutable fix/test pass. Freeze the implementation candidate before the acceptance `/step-review` transaction.
- Independent acceptance lanes belong to `/step-review`, where Meta selects as many typed subagents as the concrete risks justify. Lane count is policy data, not a fixed topology.
- A subagent discovery that changes scope, ownership, contracts, dependencies, or sequencing routes back through the parent lane and the canonical blocker/replan policy; it does not silently create a new authority.

Expected result:

- Track returns an implementation brief with files changed, acceptance coverage, verification, and readiness.

### 3. Step Review

Run `run-step-review-flow.ps1`.

Expected sequence:

```text
Track implementation output
-> Meta /step-review
-> Meta resolves the candidate-bound risk profile and typed lanes
-> when Swarm is selected: emit SWARM ASSISTANT PROMPT
-> when Swarm is selected: send the exact prompt with bounded depth controls
-> send GO to Meta at the command-defined phase boundary
-> when Swarm is selected: receive and forward the exact Swarm review
-> receive FINAL STEP REVIEW SYNTHESIS
-> immediately send the exact synthesis through /step-review-utan to the Accountable Delivery Lane
```

Important current behavior:

- when risk selection enables Swarm, invoke command `swarm-review` through the command endpoint with the extracted packet as arguments;
- resolve the actual Swarm session/agent/model from target runtime policy; topology never grants authority;
- the wrapper may add candidate-bound review controls only as command arguments covered by the accepted envelope;
- the wrapper sends Meta `GO` immediately after Swarm prompt dispatch; it does not wait for Swarm output before Meta internal lanes start
- Do not replace `GO` with a custom orchestration prompt. The command contract, pinned phase artifacts, and forwarded Swarm review are the authoritative input. If manual recovery is required after Swarm completion, first prove from the Meta transcript that `GO` is missing, then send exactly `GO` and nothing else.
- `GO` is not shorthand for an operator-authored instruction. Never send `GO: ...`, `GO` plus a review summary, or a custom request for `FINAL STEP REVIEW SYNTHESIS`.
- If the wrapper timed out after Swarm dispatch but before persisting `sent_go_to_meta`, reconcile the transcript first. When the prompt exists and `GO` does not, the recovery action is the one-word message `GO`; do not resume a stage that would duplicate prompt dispatch and do not invent a replacement prompt.
- Never stop the normal flow at `FINAL STEP REVIEW SYNTHESIS`. The wrapper must continue directly to `/step-review-utan`, and manual recovery must do the same after validating the synthesis and proving route-back is absent.
- A user request phrased as "continue through final synthesis", "get the final synthesis", or equivalent still includes the mandatory `/step-review-utan` route-back unless the owner explicitly says to pause before Track delivery. The synthesis is the payload for the final handoff, not the end of the routed review transaction.
- The review transaction is complete only after `sent_step_review_utan_to_track` is persisted or equivalent transcript evidence proves the exact synthesis reached the Track command. `meta_final_received` alone is incomplete state.
- `-SwarmReviewDepth auto|full|standard|focused|quick` controls Swarm review breadth when Swarm is enabled
- `-SwarmReviewFocus "..."` adds one operator focus line to the Swarm prompt when Swarm is enabled
- `-MetaModel` and `-SwarmMessageModel` select explicit request models; the server body uses `{providerID, modelID}` rather than relying on the session agent alone
- if the user explicitly asks for no Swarm Assistant, use `-SkipSwarmReview` and an explicit `-MetaInternalLanes` value; do not route a Swarm prompt in that run
- Swarm Assistant is a peer review/gate session and may orchestrate its own QA, reviewer, critic, test, security, or domain subagents within the dispatched envelope. Their topology and model roster may evolve; Swarm Assistant remains responsible for one evidence-bound synthesis and never gains Meta acceptance authority.

Optional FAL sync point:

- final synthesis, Delivery response, checkpoint, and closeout are separate events;
- before the Delivery response, a wrapper may record only non-acceptance routing evidence, never `step_review_done`, `review_fix_done`, or clean closeout;
- after exact Delivery response, a separate `/fal-checkpoint-target` may consume the pinned synthesis, response, candidate, and receipts;
- no checkpoint result substitutes for target acceptance or closeout.

### 4. Review-Fix Cycle

If the final synthesis assigns accepted fixes or otherwise does not permit `ACK_ONLY`:

1. let Track produce a fix plan ending with `FIX_PLAN_READY_FOR_IMPLEMENT`
2. if the owner explicitly requested review-fix-loop-first compaction, capture and pin that Track-authored fix plan, then compact the Track session(s) from the finished RED loop first, then any review/support session(s) that actively worked in that loop, and Meta Coordinator last before the fix plan's Meta `/terv-review`
3. run `run-review-fix-cycle.ps1` with the exact Target/Epic/Wave/Candidate/Accountable Lane tuple plus `PinnedFinalSynthesisPath`, `PinnedDeliveryResponsePath`, and `PinnedDeliveryReceiptPath`; it validates their lineage and the fix-plan response class, routes the exact fix plan once through Meta `/terv-review` and Delivery `/terv-review-utan`, runs `/implement` only from the pinned ready revision, and then runs the next `/step-review`
4. if accepted fixes still remain after the next synthesis and route-back, repeat with `-CycleIndex 2`, then `3`, and so on

Before starting a review-fix wrapper, resolve the exact pinned final synthesis, exact pinned Delivery response containing `FIX_PLAN_READY_FOR_IMPLEMENT`, and its delivery receipt from the completed step-review run. Verify that all three bind the same Target/Epic/reviewed Candidate/Accountable Lane tuple and that the receipt hashes the synthesis and response artifacts. A partial status, post-review acknowledgement, raw latest-output read, compact summary, copied transcript block, or operator-created summary is not an admissible substitute. After review-fix-loop-first compaction, use the same pinned paths and receipt. Route that exact fix plan once through `/terv-review`, route its exact `Plan class: REVIEW_FIX_PLAN` review once through `/terv-review-utan`, and implement only the pinned ready revision.

If any branch was driven partly manually, reconcile each pinned lane artifact/receipt through the separate `/fal-checkpoint-target` boundary before treating the outer FAL loop as synchronized.

Current parallel FAL checkpoint rule:

- `run-parallel-plan-review-flow.ps1`, `run-parallel-step-review-flow.ps1`, and `run-parallel-review-fix-cycle.ps1` accept `-FalSyncCheckpoint`
- `-FalSyncApply` remains in the parallel plan/step parameter surface only as a rejected compatibility switch: passing it always throws the scripts' explicit retired-switch error. It grants no apply authority and must not appear in a live invocation. `run-parallel-review-fix-cycle.ps1` does not accept it.
- parallel transport writes one generated proposal/marker artifact per lane under the run directory;
- the reconcile summary records proposed/dispatched/verified/failed counts and lane-level pinned sources;
- separate `/fal-checkpoint-target` commands own any explicitly authorized writes;
- mixed outcomes remain lane-specific; do not infer all-lane clean closeout from a combined final verdict
- on any post-dispatch failure, reconcile the persisted dispatch intent and returned transport identity before resume; neither an exception nor a recent transcript message alone proves delivery or absence

Target and Epic bindings remain unchanged across review-fix cycles. Increment `CycleIndex`, bind `Candidate` to the candidate reviewed by the source synthesis, and let the next `/implement` produce the new Candidate for the next review. Use the wrapper-generated run ID or an explicit unique `RunId`; do not encode a cycle by changing the project/repository Target.

Risk-selected review profile for every fix cycle:

- Recompute review breadth from the frozen candidate and unresolved findings on every cycle; cycle number is a risk signal, not a topology selector.
- Use Meta alone for a genuinely narrow recheck, add only the typed lanes needed by the remaining risks, and add bounded risk-targeted Swarm when the candidate is high risk.
- Repeated RED outcomes may justify broader coverage, but never automatically authorize full adaptive Swarm or five-to-seven typed lanes. Those expanded profiles still require explicit Owner approval.
- Pass explicit wrapper controls for the resolved profile. If the wrapper cannot express it safely, stop instead of falling back to a historical cycle-number default.

Repeated narrow-slice policy:

- Review breadth escalation does not authorize unbounded acceptance growth.
- If cycle 2 remains RED, freeze the remaining acceptance contract before cycle 3.
- After a frozen final cycle, route newly discovered non-critical completeness improvements to named debt and close when the frozen requirements pass.
- Continue beyond the frozen final cycle only for a critical regression, security/data-integrity issue, or explicit owner approval.

Explicit review-depth overrides:

- `-SkipSwarmReview`
- `-UseSwarmReview`
- `-ReviewProfile quick|focused|standard|high_risk|deep|wide|audit|custom`
- `-MetaInternalLanes 0..7`
- a pinned Owner-approval receipt for five-to-seven lanes or full/adaptive Swarm
- `-ReviewLanes lane1,lane2`
- `-ReviewFocus "..."`
- `-SwarmReviewDepth auto|full|standard|focused|quick`
- `-SwarmReviewFocus "..."`
- optional target-registry path/profile ID resolved from router settings, with path/hash/version pinned in run state

Operator selection policy:

- Pick the Meta/Swarm controls intentionally before launching `run-step-review-flow.ps1` or `run-parallel-step-review-flow.ps1`; do not blindly use the heaviest default for every step.
- Resolve breadth from the frozen candidate: low-risk work may use Meta alone; one concrete risk gets one targeted lane; multi-surface standard risk gets the relevant bounded lane set; high-risk work may automatically add a bounded Swarm review. Do not add a lane merely to satisfy a fixed count.
- Resolve the complete acceptance-review depth before the first `/step-review` dispatch. If the implementation plan, Track report, Meta decision, or target policy says that a deep review is mandatory, the selected `/step-review` must satisfy that requirement in the same review transaction or stop for an owner/Meta depth decision before dispatch. Do not run a focused review that is guaranteed to end with "GREEN, but another mandatory review is still required."
- Review depth is coverage-driven while named profiles remain stable contracts. Internal typed-lane count and external Swarm are independent axes: `deep`/`audit` select five internal lanes and `wide` selects seven, each approval-gated; none automatically forces full/adaptive Swarm. A smaller risk-selected topology uses `quick`, `focused`, `standard`, `high_risk`, or an explicitly declared `custom` profile instead of redefining `deep`.
- Reuse prior independent evidence instead of reflexively duplicating it. If a current, candidate-bound external Swarm review already covers correctness and broad system risk, a later final acceptance review may disable Swarm and select only the missing architecture, evidence, domain, determinism, performance, or ownership lanes.
- Before dispatch, state which concrete risks each selected lane closes and why omitted lanes or external Swarm are unnecessary. The Meta main pass still covers every mandatory review domain regardless of lane count.
- A review advertised as the final acceptance Step Review must end with one actionable routing result and every verdict must first route through `/step-review-utan`. `GREEN` is ready for that mandatory route-back, not for closeout by itself; only the resulting exact `ACK_ONLY` is closeout-ready. Accepted findings instead produce the Accountable Delivery Lane fix plan -> Meta `/terv-review` -> Delivery `/terv-review-utan` -> `/implement` -> `/step-review` loop. Only a material scope, ownership, contract, dependency, or sequencing change restarts at `/seq-next`; bounded fix plans receive one direct Meta plan review rather than a new `/seq-next` or repeated review. The review must not defer an unnamed or already-known mandatory review after declaring its own focused scope GREEN.
- If review breadth proves insufficient during execution but no implementation defect has yet been established, do not publish a misleading final `GREEN` plus mandatory-review blocker. Label the output as a non-final pre-review/intake result, preserve the evidence, and complete the missing coverage before issuing `FINAL STEP REVIEW SYNTHESIS`.
- If the task is small, docs-only, or a narrow fix, prefer `-SkipSwarmReview -MetaInternalLanes 1` or `-UseSwarmReview -SwarmReviewDepth focused -MetaInternalLanes 1`.
- If the task touches runtime behavior, schemas/contracts, security, persistence, cross-track ownership, or broad refactors, prefer `-ReviewProfile high_risk` before considering deeper escalation.
- `deep`, `audit`, and `wide` are expanded internal-review profiles. Five to seven lanes and full/adaptive external Swarm require a verified, candidate-bound Owner-approval receipt whose identity/hash is persisted and rechecked on resume; a boolean switch or free-text claim is insufficient.
- If a materially different five-to-seven-lane or full adaptive review is required and the user has not accepted the cost/latency tradeoff, stop and ask with the question tool instead of guessing. Ordinary bounded risk selection remains autonomous.

Meta-only review best practice:

- Use `-SkipSwarmReview -MetaInternalLanes 1` for trivial docs/metaops or narrow re-reviews.
- Use `-SkipSwarmReview -MetaInternalLanes 3` when the user wants no external Swarm but still wants a stronger Meta-internal review.
- Use an explicit 2-3 lane custom set with `-SkipSwarmReview` when prior candidate-bound Swarm evidence already exists and the final acceptance gap is concentrated in named domains. This can satisfy a broad acceptance requirement when the lane selection plus Meta main pass covers every declared risk; it does not satisfy or redefine the named `deep` profile, and lane count is not a quality score.
- Use `-UseSwarmReview -SwarmReviewDepth focused -MetaInternalLanes 1` for narrow but non-trivial fixes where Swarm is useful but exhaustive gates are not.
- Use `-ReviewProfile high_risk` for four-lane risk-selected review. Use `deep` for five lanes and `wide` for all seven only after explicit question-tool owner approval. `wide` does not silently select or escalate external Swarm; external Swarm depth is an independent, explicitly resolved axis.

Typed lane contract:

- 0 lanes: Meta-only complete review
- 1 lane: one risk-selected specialist
- 2 lanes: correctness/business/regression plus tests/evidence
- 3 lanes: standard lanes, adding scope/acceptance/ownership
- 4 lanes: standard lanes plus a pre-resolved security, architecture, or domain specialist
- 5 lanes: standard lanes plus security and architecture
- 6 lanes: five-lane set plus domain specialist
- 7 lanes: all typed lanes, adding regression and edge cases (`wide`)

Runtime and model routing policy:

- This runbook defines stable review capabilities and authority, not a permanent vendor, model, effort, plugin schema, or session roster.
- Before a typed-lane or external-Swarm dispatch, resolve the current runtime/project routing reference only when the selected topology needs it. Do not load a model briefing for Meta-only review or preserve temporary provider incidents in this hot runbook.
- Select each lane from the concrete risk it closes. Project type alone never forces a security, architecture, domain, or regression lane; project overlays may declare current mandatory coverage with evidence.
- Treat model availability and plugin registry shape as runtime facts. A missing or anomalous capability permits at most one bounded fallback already proven safe and idempotent for that dispatch; otherwise stop, preserve evidence, and return one consolidated decision/blocker upward.
- Experimental modes, full external Swarm, and five-to-seven typed lanes remain capability-probe-gated and Owner-approved. Ordinary bounded risk selection remains autonomous.
- Meta owns the final acceptance synthesis and records the resolved lane purpose, session/agent assignment, evidence surface, and any fallback or escalation reason. A lane or its subagents never gain authority from the selected model or topology.
- External Swarm review remains isolated from unrelated local plan lifecycles and cannot mutate the frozen implementation candidate.

## Parallel Lane Pattern

When Combined explicitly says two Tracks can proceed after the same prerequisite, use the parallel wrappers instead of manual copy/paste.

This pattern is valid for any orchestrator session and any lane count from 2 upward as long as the lanes are ownership-disjoint and Combined explicitly allows parallelism.

Pattern:

```text
Track C /seq-next
Track A /seq-next
-> dispatch all lane commands first
-> one combined Meta /terv-review
-> split Meta response blocks
-> Track C /terv-review-utan
-> Track A /terv-review-utan
-> Track C /implement
-> Track A /implement
-> dispatch all lane commands first
-> wait for both
-> one combined Meta /step-review
-> one combined Swarm prompt with Swarm depth controls
-> send GO to Meta immediately after prompt dispatch
-> one Swarm review
-> one combined final synthesis
-> split step-review-utan blocks back to each Track
```

The parser depends on explicit markers. See `parallel-lane-flow.md`.

Current wrapper behavior for 3-5+ lanes:

- `run-parallel-plan-review-flow.ps1` sends all pending `/seq-next` commands first, then waits for unfinished plan outputs in one shared poll loop
- `run-parallel-step-review-flow.ps1` sends all pending `/implement` commands first, then waits for unfinished implementation outputs in one shared poll loop
- when `-WaitForTrackResponses` is active, post-`/step-review-utan` Track responses are also gathered in one shared poll loop
- `run-parallel-review-fix-cycle.ps1` resumes with `-Resume -RunId <id>` while repeating the exact mandatory `-Lane` collection and `-SourceManifestPath`; the manifest hash and lane bindings must match saved state
- `inspect-parallel-run.ps1` is the canonical read-only entrypoint for checking run status, missing artifacts, and exact resume commands before resuming

If some lanes finish cleanly and others do not, only the failed lanes should be included in the next parallel review-fix cycle.

## Step-Review Runtime Artifacts

Each guided step-review run writes to:

```text
.opencode-router/step-review-runs/<runId>/
```

Important files:

- `state.json`
- `01-track-implementation.md`
- `02-meta-phase1.md`
- `03-swarm-prompt.md`
- `04-swarm-review.md`
- `05-meta-final-synthesis.md`

If a run stops mid-way, inspect `state.json` first, then resume with the same `runId`.

Completion invariant:

- `05-meta-final-synthesis.md` proves that Meta produced the final payload; it does not prove that the Track received it.
- A serial step-review run is complete only when `state.json` contains `sent_step_review_utan_to_track` and `completed_at`, or equivalent transcript evidence has been reconciled into the run state.
- Do not present final synthesis to the operator as a completed step-review while route-back remains pending.

## Known Working Semantics

These are now confirmed live semantics, not just theory:

- Meta `/step-review` is multi-phase.
- When the resolved profile includes Swarm, the first Meta phase produces the exact `/swarm-review` prompt and waits for `GO`; a Meta-only profile follows the command's explicit skip path.
- Invoke the extracted `swarm-review` command through the command endpoint with its packet as arguments; do not send the slash-command packet as an ordinary message.
- The router may inject `ROUTER SWARM REVIEW CONTROLS` after `/swarm-review` before forwarding the prompt.
- Meta `GO` can be sent immediately after selected Swarm prompt dispatch; the wrapper should not wait for Swarm output first.
- The resulting exact `SWARM REVIEW RESULT` evidence block is returned to Meta as a plain message. Swarm Assistant may internally orchestrate bounded review/QA subagents, but returns one advisory lane result under its session authority.
- Only the final Meta synthesis decides `GREEN` vs `RED`.
- Review-fix cycles can be driven repeatedly without manual copy/paste when the next exact synthesis/Delivery-response/receipt triple is pinned and bound to the reviewed Candidate.

## Known Issues And Workarounds

- If a guided step-review run stops after a preview or after `GO`, use `-Resume -RunId <runId>`.
- If final synthesis already exists in `05-meta-final-synthesis.md`, do not restart the whole run or inspect raw latest output for authority. Resume the existing run and validate the pinned synthesis, Delivery response, delivery receipt, dispatch intent, and Candidate binding.
- If the script crashes after sending `/step-review-utan`, verify whether Track already received the final synthesis before rerunning anything.
- If message extraction looks wrong, use `dump-message-parts.ps1` and `read-latest-output.ps1` before sending anything.
- If a strict expected-kind wait reports a newer diagnostic-only candidate, use the emitted message identity and mismatch reasons to inspect the exact transcript. The candidate remains non-authoritative even when it contains plausible headings or terminal words. Fix the producer's canonical envelope or reconcile through the saved wrapper run; do not lower the classifier, route the raw message generically, or resend the preceding command.
- In the shared and standalone waits updated by this hardening, `MinOutputChars` applies only when no strict output kind is requested. The strict output/context contract determines typed terminal eligibility, while progress-like and mismatched outputs remain diagnostic-only regardless of length.
- A bounded command POST exception means `delivery-uncertain`, not `not delivered`. Preserve the pending intent and packet, compare the recipient transcript against the recorded raw pre-send baseline, and complete or explicitly recover the saved transaction before any new dispatch.
- Parallel wrappers are fail-closed. If block extraction fails, recover from `.opencode-router/parallel-runs/<runId>/` with `extract-track-response-block.ps1`.
- Parallel review-fix cycles are lane-selective: only failed lanes should continue.
- A post-send exception does not authorize reading the latest Meta output and guessing whether `/terv-review` ran. Reconcile the wrapper's persisted dispatch intent, returned transport identity, transcript, and pinned stage artifact; resume only after duplicate-send state is proven.
- Generic `route-latest-output.ps1` / `route-packet.ps1` recovery is not a substitute for wrapper resume. Do not create or send a new packet when the wrapper has a saved run and hash-bound intent.
- `wait-latest-output.ps1` uses `-Session`, not `-From`. Use `-AcceptCurrentLatestAsNew` only when a fast reply likely arrived before the baseline was established.
- When `wait-latest-output.ps1` receives an `id:<message-id>` baseline, it expands the read window to at least 200 messages and considers only raw messages after that baseline. A text-less progress baseline must never permit an older classified review to be forwarded as new output.
- If the baseline is no longer visible even in the expanded window, the helper fails closed. Inspect the transcript with `dump-message-parts.ps1` and pin the current stage artifact before any manual recovery.
- If a combined wrapper observes a status message instead of the expected plan, stop and validate the wrapper run's pinned stage artifact and context contract; do not manually route a recency-selected block.
- Serial and parallel initial-plan wrappers bind `Plan class: EPIC_PLAN`. Review-fix wrappers require `FIX_PLAN_READY_FOR_IMPLEMENT`, bind `Plan class: REVIEW_FIX_PLAN`, and complete one Meta review plus one Delivery revision before implementation.
- FAL checkpointing is a separate `/fal-checkpoint-target` dispatch. Transport wrappers may persist a proposal but never call an inline `-Apply` sync path. The retained parallel plan/step `-FalSyncApply` parameter is compatibility-only and deterministically rejects every invocation; it is not a supported mode.
- If OpenCode returns `401`, fix auth first. If it cannot connect, ask the user rather than restarting servers.

Resume pattern after an interrupted serial plan-review run, but only after read-only reconciliation proves there is no unresolved pending intent or duplicate-send ambiguity:

```powershell
powershell.exe -NoProfile -File "$Scripts\run-plan-review-flow.ps1" `
  -Track track-e `
  -Target "RingFall" `
  -Epic "W1-S6-C1-I-C1-J" `
  -AccountableLaneId "Track E" `
  -AccountableLaneClass TRACK `
  -AccountableLaneProfile track-e `
  -Resume `
  -RunId <runId> `
  -AutoUseFirstStable `
  -AutoApprove
```

## Worked Examples

### WorldSim P7-B

P7-B is a historical proof that the loop works end-to-end.

Observed sequence:

1. Initial `seq-next` + Meta plan review.
2. Track revised the plan after Meta `YELLOW` guidance.
3. First implementation pass reached `RED` in step-review.
4. Fix cycle 1 also reached `RED`.
5. Fix cycle 2 reached `GREEN`.
6. Final commit recorded as `42e0117 feat(track-b): add p7-b forward bases`.

Rough durations:

- initial `seq-next` + plan-review loop: about 2.5 minutes
- first implementation + full step-review: about 16 to 18 minutes
- fix cycle 1: about 20 minutes
- fix cycle 2: about 8 to 10 minutes

Main lesson:

- the workflow is stable enough to run with minimal interruption
- the operator should only stop on real blockers or ambiguity
- repeated review-fix cycles are normal and should be expected

Later WorldSim Wave 10.5 / TR3 audit-gate loops also validated the operator workflow. Treat target-repo runtime state and current target docs as the authority for the latest proof point, not this shared runbook.

### RingFall W1-S6

RingFall Wave 1 Step 6 is a historical proof that target-specific Meta-only review controls work.

Observed sequence:

1. `track-e` ran `/seq-next W1-S6-C1-I-C1-J Track E`.
2. Meta plan review returned `YELLOW / approve with changes`; Track E implemented with those constraints.
3. Step review ran with `-SkipSwarmReview -MetaInternalLanes 3`.
4. Review found a concrete CostEvent invalid-fixture overlap plus docs/governance cleanup.
5. Track E produced a fix plan; the historical run then used a legacy Meta `GREEN` fix-plan approval that is not part of the current canonical route.
6. Fix implement and Meta-only re-review returned `APPROVED`, low risk.

Main lessons:

- Target sequence docs decide the next track/target; do not infer from prior project habits.
- `approve with changes` is implementation-ready only if the Track can incorporate the mandatory changes without expanding scope.
- Current bounded review-fix plans use one direct Meta `/terv-review` and one Delivery `/terv-review-utan` correction before `/implement` and `/step-review`; do not copy the historical ad hoc approval or repeat the same review.
- A Meta-only 3-lane review is a useful middle path when the user does not want Swarm Assistant but still wants more than a shallow re-review.
- Review-fix closeout can be green while residual cross-track semantic reviews remain routed to the next gate.

Later WorldSim and other target loops may supersede this as the freshest proof of specific review-control behavior. Keep the runbook focused on stable live semantics and use target-local runtime state for the newest proof examples.

## End-Of-Loop Verification

After accepted closeout, always check:

```powershell
git status --short --branch
git log --oneline -5
```

Also inspect the final synthesis artifact if needed:

```text
.opencode-router/step-review-runs/<runId>/05-meta-final-synthesis.md
```

## New Session Handoff Checklist

If another session or operator takes over, restore target authority first: target `AGENTS.md`/overlay, `PROJECT_STATE`, active Combined Epic row, and pinned current-stage artifact. Then read the hot `tools/oc-session-router/docs/workflow-orchestrator-runbook.md`; add target `.opencode-router` settings/state only when routing or resuming. Open this cold reference, the cheatsheet, or Swarm mechanics only for one named uncertainty. That is normally sufficient without rebuilding the entire history.
