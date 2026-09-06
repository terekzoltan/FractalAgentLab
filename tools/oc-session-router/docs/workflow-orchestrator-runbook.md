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

Token counts describe the last completed provider call, not exact current context.
The default advisory warning/critical ratios are `0.5`/`0.62`. Missing optional
catalog/tokens/history stays visibly unavailable; it is not a universal lifecycle
blocker. A new send still needs verified addressing, permitted scope/effect and a
safe idle participant.

At an idle boundary, preserve the continuation/result references, request one
`compact` operation, and observe its actual completion. The shared SQL claim and
fresh pre-send head check protect coordinated participants. Summarize uses
`auto: false` so it does not inject a product-work continuation. A completed native
or manual compaction can return `ALREADY_COMPACTED`; high pre-compaction usage on
its summary is stale, not a reason to compact again.

Then request `restore` for the same project/role, supplying only useful current
artifact references. It invokes installed `/after-compact` with minimal work
context, never a new plan or implementation. A blocked phase does not prevent
reading role/project instructions. Continue the original authorized lifecycle only
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
