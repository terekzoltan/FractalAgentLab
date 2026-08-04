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

## Canonical lifecycle

```text
Delivery /seq-next
-> Meta /terv-review
-> Delivery /terv-review-utan
-> Delivery /implement
-> Meta /step-review
-> Delivery /step-review-utan
-> FIX_PLAN_REQUIRED loop or ACK_ONLY -> Meta /closeout-commit
```

`/terv-review` is one direct Meta pass and its canonical envelope includes `Plan class`. `/terv-review-utan` normally ends `PLAN_REVISION_COMPLETE` and `IMPLEMENT_READY`; `IMPLEMENT_BLOCKED` is exceptional. The corrected plan and summary repeat Target, Epic, lane, and one opaque final plan identity byte-identically, then route directly to `/implement`. Every final step-review color routes through `/step-review-utan`. Only exact `ACK_ONLY` is closeout-eligible. `FIX_PLAN_REQUIRED ... FIX_PLAN_READY_FOR_IMPLEMENT` declares fix-plan completeness and routes once through Meta `/terv-review` plus Delivery `/terv-review-utan`; only the resulting ready revision routes to `/implement`. `UNCLEAR` routes upward. Meta color never substitutes for the Delivery response class.

## Transport law

- Invoke every known slash command through the command endpoint, excluding the leading slash.
- Use ordinary messages only for the single literal `GO` control token and for returning the exact external `SWARM REVIEW RESULT` evidence block to Meta.
- Forward the exact pinned artifact body or an immutable resolvable pointer with identity and integrity proof; never replace it with a summary.
- Hold one exclusive run lock. Persist an atomic, hash-bound pre-send intent before every dispatch and the returned receipt/message identity afterward. On resume, verify artifact hashes and strict output class; an unresolved pending intent stops for read-only reconciliation and is never auto-resent. Progress chatter is not a terminal artifact.
- Never resend when delivery is ambiguous. Inspect run state/transcript read-only; if proof remains unavailable, stop.
- Strict stage classification and diagnostic discovery are separate. A newer unclassified or progress-like assistant message may produce a diagnostic-only reconciliation record, but it is never selected, saved as stage authority, or routed. In the shared and standalone typed waits, a strict stage contract, not `MinOutputChars`, proves a terminal artifact.
- A packet or wrapper command POST uses a bounded client wait and a durable pre-send intent. Timeout, client interruption, or another POST exception leaves the intent pending/delivery-uncertain and the packet in place. Reconcile from the recorded raw baseline; never treat the exception as proof of non-delivery or permission to resend.

## Risk-selected review

Use the smallest evidence topology covering actual risk: `quick` is direct Meta; `focused` uses one typed lane; `standard` uses up to three; `high_risk` uses up to four and may use bounded Swarm; `deep`/`audit` use five; `wide` uses seven; `custom` names its lanes. Five-to-seven lanes or full/adaptive Swarm require a resolvable Owner-approval receipt bound to target/Epic, candidate, profile, depth, and lanes; pin its path/identity and hash in run state and revalidate it on resume. Project identity and fix-cycle number are signals, never topology authority. Recompute risk from the frozen candidate and unresolved findings on every cycle. Swarm is advisory and emits exactly one lane verdict: `APPROVE`, `APPROVE WITH FIXES`, or `BLOCK`; Meta alone emits `FINAL STEP REVIEW SYNTHESIS`.

## FAL checkpoint separation

Transport wrappers do not write FAL. At a stable boundary they may persist a proposal/receipt and dispatch a separate `/fal-checkpoint-target` with a pinned authoritative target artifact. `SyncMode: apply` requires explicit FAL write authority. Delivery, Delivery response, checkpoint, target closeout, and any separate FAL closeout are distinct events. A sent command, checkpoint, or Meta color never proves acceptance. Pin the final revised plan after plan review—not the older Meta review—as the implementation-authority frontier.

## Questions, anomalies, and compact

Delivery, reviewer, evidence, specialist, and support roles return one structured blocker to their accountable parent. Meta/Orchestrator deduplicates blockers and asks at most one consolidated Owner question when target authority cannot decide. While unanswered, remain blocked.

On abnormal identity, transport, auth, duplicate-send, or output-class state: freeze sends and mutation; load the Canon Incident Recovery Runbook as the one event procedure; perform bounded read-only diagnosis and at most one proven-idempotent retry. Never explore with arbitrary console commands, restart/kill Owner-managed processes, rewrite state, guess credentials, or try speculative recovery variants.

When a strict classifier rejects a newer assistant output, inspect its diagnostic record and exact transcript message. If the producer violated the canonical schema, repair that envelope through the saved wrapper state only. If the output is canonical but the classifier disagrees, freeze routing and use `/workflow-fix`; do not insert an extra lifecycle stage or bypass the wrapper's pending intent with generic packet routing.

Compact V2 is fluidity-first and event-driven, not a watchdog. The read-only
`session-context-status.ps1` report never authorizes mutation; the separately
reviewed policy adapter may act only at `before_dispatch`, `after_stage_output`,
or `epic_closeout` with a complete target-owned event and safe-boundary proof.
`normal` and ordinary `unknown` continue. `warn` waits for the first safe boundary;
`critical` prevents a new long stage until compact or a human route; `over_limit`
permits bounded recovery only. Accepted closeout processes actual participants in
Delivery, review/support, then Meta/Orchestrator order.

The adapter persists one intent before canonical server summarize, accepts only
one attributable new compaction marker, and treats timeout, competing marker or
intent, and ambiguous resume delivery as `UNCERTAIN` without blind retry. Manual
compact is recorded and never repeated for the same participant/boundary. After a
verified marker it runs target-first Canon hydration; only verifier `PASS`, exact
route input, current command identity, parent-session safety, and settled
duplicate-send state permit automatic resume. Summaries remain orientation only.

## Closeout and cold references

After exact `ACK_ONLY`, `/closeout-commit` may apply only synthesis-enumerated governance/closeout deltas, verify and stage explicit target paths, and commit without push. Behavior-changing source, tests, config, runbooks, commands, skills, and policy must already be in the frozen reviewed candidate. Target and FAL transactions remain separate.

Open `workflow-orchestrator-reference.md` selectively for: command/control-token mechanics; stage-aware output selection; ACK and compact guards; wrapper/runtime artifacts; parallel lanes; legacy compatibility; incident workarounds; or worked examples. See `../config/README.md` only when adding target review profiles or approval receipts. Canon role, output, hydration, recovery, closeout, and FAL-adapter runbooks override contradictory cold legacy text.
