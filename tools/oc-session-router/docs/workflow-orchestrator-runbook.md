# V2 orchestrator operating runbook

The existing project orchestrator chooses each action. The router records
addressing, attempts, observations and results; it neither grades the product nor
sends the next lifecycle stage automatically.

## Establish the work

Read the target's applicable instructions, current state/Combined entry, relevant
plan/evidence and the assigned role. Use the actual Owner instruction to record a
work envelope: target/worktree, scope, allowed effects, instruction reference and
stopping point. Chat approval may cover the Epic, useful repairs and reviewed local
closeout/commit together. Configuration or a JSON field does not manufacture
missing approval, and commit permission does not imply push/deployment permission.

Resolve participant roles from the [private V2 configuration](../config/README.md).
A role name is not a guessed session title. The configured namespace, verified
OpenCode project ID and session identify the participant across aliases/restarts.
Keep independent author and Meta reviewer sessions distinct.

Project plans remain editable within the accepted scope. Each action preserves
the inputs used for that action; later plan revisions do not rewrite old evidence.
A materially different work envelope requires the corresponding Owner decision.

## Preserve the lifecycle

Use stage-sized source packets: active Combined section, required plan/result and
targeted code reads, not whole roadmap/code/history copies. Auto sources above16KiB
become retrievable frozen references; restore defaults to references. Explicit
inline/excerpt choices remain available and the full source is retained. Read
required referenced content via the supplied reader before dependent work. Packet
size advice never licenses dropping acceptance requirements or creates a new stop.

For an Owner-enrolled observed state block, existing mutation responses include
stateProjection status. After a read-only result/reconciliation, refresh-state
can synchronize recorded progress without a Meta call. Never edit the human
baseline from router metadata. A stale phase line is not permission to replay a
completed action. Resolve real authority conflicts, preserve pause and current
scope; missing optional projection only leaves visible view debt.

| Action | Accountable recipient |
|---|---|
| `/wave-start` when explicitly opening a Wave | Meta |
| `/seq-next` plan | Delivery |
| `/terv-review` independent plan review | Meta |
| `/terv-review-utan` plan response/revision | Delivery |
| `/implement` accepted implementation | Delivery |
| `/step-review` independent review/synthesis | Meta |
| `/step-review-utan` Delivery response/repair disposition | Delivery |
| `/closeout-commit` reviewed local closeout | Meta |

Do not merge stages or substitute a clarification for required review. Meta retains
review judgment and appropriate independent reviewer selection under the current
Canon. A session label, available model or successful transport is not acceptance.

Submit one addressed action using a stable `actionKey`, concise arguments and the
relevant file/result references. Inspect/read the result, record the responsible
role's interpretation, then choose the next retained stage. The CLI returns
`autoAdvance: false`. `predecessor` links a completed operation in the same work;
a `sources` result reference carries the actual prior output without manual copying.

Use new action keys for genuine later stages and repair cycles in the same work.
Several substantive repair cycles are allowed when evidence shows progress.
Unchanged retries retrieve the existing action; changing an uncertain action's key
to repeat the work defeats recovery and is not permitted. Repeated lack of progress
calls for a scoped decision, not a hard two-cycle cap or invented findings.

## Read the evidence before progressing

Delivery, execution and interpretation are separate. `DELIVERED` survives unusual
text. `COMPLETED` says execution ended; `outputAvailable: false` is not a green
review, and text alone does not prove tests, authorization or candidate identity.

Use `inspect` for concise facts and `read-result` for the private retained output.
For a missing explanation, submit a bounded `CLARIFICATION` to the existing
responsible role with one precise question and relevant result references. It uses
a separate prompt through the same claims/transport. It does not resend
implementation, change acceptance or expand scope. Escalate material scope,
authority, identity or evidence conflicts to the accountable role/Owner.

When delivery is `POSSIBLE` or the response is incomplete, use `wait` or `reconcile`
on that operation. They perform bounded GET observation; a wait deadline does not
abort the target. Preserve the operation and participant claim while uncertain.
A missing transcript page, an idle session or a dead local process proves neither
rollback nor permission to resend.

## Observe and maintain lane continuity

The runtime attempts advisory status/context observation before new lane work,
after result handling and during waits with backoff. The orchestrator remains
responsible for inspecting freshness and deciding whether maintenance is useful.
`observe-session` and the context-status facade use the same work/role mapping.

Token counts describe the last successful completed provider call (including
tool-call steps), not exact current context. Aborted/failed empty assistant
records do not replace it; newer activity remains visible as stale/unknown.
Even successful zero-only telemetry does not prove an empty context.
The default advisory warning/compact ratios are `0.5`/`0.60` of the usable input
budget, not blindly the whole context window. `compactThresholdRatio` is the one
optional configuration override. Reports distinguish input-limit from estimated
context-minus-output/context-only basis; they never claim exact active context.
Missing optional catalog/tokens/history stays visibly unavailable; it is not a universal lifecycle
blocker. A new send still needs verified addressing, permitted scope/effect and a
safe idle participant. Catalog reads have their own 16 MiB cap; other response
caps are unchanged. A read failure carries its sanitized reason.

Before new addressed work and after handling a result, inspect the concise
`continuity` advice in observe/inspect/wait/reconcile output. Older than two minutes,
wrong participant, changed head or intervening activity: refresh with
`observe-session`. A recent stored observation is not proof of a currently idle
session. The legacy `capabilities.mayCompact:false` describes the read-only GET
action ONLY, never a prohibition on the separate compact action.

At `COMPACT_THEN_RESTORE_BEFORE_WORK`, perform the following maintenance routine
within the existing SESSION_MAINTENANCE envelope without a fresh Owner question.
Use stable action keys, preserve completed product result/source references and
the original intended action. BUSY means wait without interruption; already
compacted means check/finish restoration rather than compact again. Unknown
telemetry is neither a compact ban nor a green pressure result: inspect its cause,
use matching known limits when available, and make a bounded evidence-based
decision. No universal guessed token threshold or mandatory telemetry gate.

At an idle boundary, preserve the continuation/result references, request one
`compact` operation, and observe its actual completion. The shared SQL claim and
fresh pre-send head check protect coordinated participants. Summarize uses
`auto: false` so it does not inject a product-work continuation. A completed native
or manual compaction can return `ALREADY_COMPACTED`; high pre-compaction usage on
its summary is stale, not a reason to compact again.

Then request `restore` for the same project/role, supplying only useful current
artifact references. It invokes installed `/after-compact` with minimal work
context, never a new plan or implementation. A blocked phase does not prevent
reading role/project instructions. Report performed/deferred maintenance and its
reason. The active orchestrator owns this routine, without a daemon, hidden
successor send or a model call per telemetry sample.
Continue the original authorized lifecycle only
when the actual Owner pause permits it.

The Owner compacts orchestrator sessions manually. Agents never abort, kill or
interrupt a busy lane to compact it. Observing Owner interruption records partial
or failed execution; it does not imply rollback.

## Restart, import and closure

Ordinary restart needs fresh read-only addressing/activity/command compatibility
checks, not a new P0B approval. Historical result recovery uses preserved
provenance rather than today's command template. A real addressing or scope
conflict stops affected sends; unrelated work need not stop.

`import-legacy` is NO_SEND: it reads preserved V1 records, imports evidence into
the same V2 store and keeps the work paused. It neither changes originals nor
replays a lifecycle command. Reconcile unresolved history read-only and preserve
the Owner pause; release it only against the actual subsequent instruction.

Use the [interface reference](workflow-orchestrator-reference.md) for request
fields and the [versioned installer](../../workflow-tooling/README.md) for managed
source/deployment closure. This candidate runbook is not live qualification or
authority to unfreeze a project.
