# V2 interface and recovery reference

## Continuity advice

`observe-session` exposes `budget` (tokens/basis) and `continuity`. Ordinary
operation inspect/wait/reconcile results include the same concise advice from the
latest stored observation for that role, with age/freshness. Old records can show
`OBSERVE_BEFORE_WORK`; reading completed results never requires a live server.
`lastCallTokens` is the last successful completed provider call, not exact active
context. Error/aborted placeholders are not usage observations. Successful calls
without usage do not cause fallback to an older token-rich call; zero-only usage
remains unconfirmed, not evidence of empty context. Summary-call usage is stale
pre-compaction evidence, not a new compact trigger.
The default compact threshold is 60% of usable input budget. The orchestrator
checks advice before new work and runs existing compact -> restore when warranted.
Advice does not grant maintenance authority or send a successor.

`capabilityScope=OBSERVATION_ACTION_ONLY_NOT_MAINTENANCE_ELIGIBILITY` explicitly
qualifies the legacy read-only `capabilities` fields. `mayCompact:false` there
does NOT prohibit a separate compact request. Missing catalog diagnostics remain
visible in observation `limitations`; no optional telemetry gap is an admission gate.

Public entry: `../scripts/Invoke-OCRouter.ps1`. `-Action` is required. Shared
options are `-StateRoot` and `-ConfigPath`; their CLI equivalents are
`--state-root` and `--config`. The private state-root default is
`%LOCALAPPDATA%\FractalAgentLab\oc-router\v2`; the config default is
`router-config.json` inside it.

The facade runs `runtime/dist/src/v2/cli.js` with `--experimental-sqlite` and
preserves JSON/exit status. Unicode JSON escapes keep values portable through
Windows PowerShell output code pages. It does not install, build, read credentials
from parameters or select a legacy engine.

## Actions

| Action | Facade arguments | CLI arguments | Effects |
|---|---|---|---|
| `help` | none | none | Local interface description |
| `open-work` | `-RequestPath` | `--request` | Register local work; no server required |
| `submit` | `-RequestPath` | `--request` | Prepare one lifecycle or clarification action |
| `compact` | `-RequestPath` | `--request` | Prepare lane maintenance when safe |
| `restore` | `-RequestPath` | `--request` | Prepare installed `/after-compact` |
| `inspect` | `-OperationId` or `-WorkId` | `--operation-id` or `--work-id` | Local status/result metadata |
| `read-result` | `-OperationId` | `--operation-id` | Explicit private retained-output read |
| `read-source` | `-WorkId -SourceId`, optional `-Heading` or `-StartLine -EndLine`; alternatively `-RequestPath` | matching kebab-case flags or `--request` | Offline frozen-source read; no JSON file or new operation required |
| `refresh-state` | `-WorkId` | `--work-id` | Local write to an Owner-enrolled observed-progress block only; no server/send |
| `wait` | `-OperationId`, optional `-WaitMilliseconds` | `--operation-id`, optional `--wait-ms` | GET reconciliation and advisory observation |
| `reconcile` | `-OperationId` | `--operation-id` | One bounded GET recovery pass |
| `interpret` | `-RequestPath` | `--request` | Record responsible result interpretation |
| `observe-session` | `-WorkId`, `-Role` | `--work-id`, `--role` | GET session telemetry; update observed progress |
| `record-pause` | `-RequestPath` | `--request` | Record actual Owner pause/resume instruction |
| `import-legacy` | `-RequestPath` | `--request` | NO_SEND import of preserved V1 evidence |

These action flags are exact; unrelated action-specific arguments are rejected by
the CLI. `execute-operation` is an internal retaining executor, not an operator
entrypoint. There is no public abort, kill or interrupt action.

`wait` defaults to 3,600,000 ms and accepts 0 through 3,600,000. Zero performs one
stored-state snapshot without network; use `reconcile` for a fresh bounded read.
The loop budget is checked between bounded reads, not a deadline
that cancels an in-flight OpenCode command. Waits stop on completion, ambiguity,
Owner pause or budget expiry; repeated observation uses the same operation.

Network actions inherit `OPENCODE_SERVER_PASSWORD` and optional
`OPENCODE_SERVER_USERNAME` (default `opencode`) from the launching process.
Keep them outside request files and repositories. Local inspection, result reads,
pause/interpretation and NO_SEND import do not require server credentials.
Configuration requirements are in [config/README](../config/README.md).

## Work and action requests

Examples below are synthetic interface shapes, not runnable pilot instructions
or Owner approval.

`open-work` records this explicit envelope:

```json
{
  "workId": "example-E17",
  "target": "example-project",
  "directory": "C:/projects/example",
  "instructionReference": "owner-instruction:E17",
  "scope": "Complete the accepted E17 plan, in-scope review repairs and approved local closeout commit. No push or deploy.",
  "allowedEffects": ["READ_ONLY", "WORKSPACE_WRITE", "LOCAL_COMMIT", "SESSION_MAINTENANCE"],
  "stoppingPoint": "Stop after approved local closeout and report unresolved items."
}
```

Include only effects covered by the actual instruction. Reopening an unchanged
work is idempotent; changing its recorded envelope under the same `workId` is a
conflict. Project plans may evolve within that envelope.

`submit` accepts `workId`, `actionKey`, `recipientRole`, optional `kind`
(default `LIFECYCLE`), `command`, `arguments`, `predecessor` and `sources`:

```json
{
  "workId": "example-E17",
  "actionKey": "E17/plan-review/1",
  "recipientRole": "meta",
  "command": "terv-review",
  "arguments": "Review this plan against the recorded scope and cited evidence.",
  "predecessor": "op-from-plan",
  "sources": [
    {"operationId": "op-from-plan"},
    {"path": "ops/PROJECT_STATE.md"}
  ]
}
```

`predecessor` must be completed in the same work. A source is either
`{"path":"relative/file","sha256":"optional expected digest"}` or
`{"operationId":"completed-operation-in-this-work"}`. File references stay inside
the target; the router freezes their contents/digests and rechecks them before
sending. Result references carry the retained result without requiring a copied
snapshot of all project authority.

### Source presentation (not evidence removal)

Each source accepts `mode`: `auto` (default), `inline`, `reference` or `excerpt`.
Auto references sources above16KiB; restore auto references all sources. Explicit
inline remains available. Excerpt requires exactly one selector:
`{"path":"docs/Combined.md","mode":"excerpt","heading":"## Current Epic"}` or
`{"operationId":"op-prior","mode":"excerpt","lines":{"start":1,"end":20}}`.
Headings must be unique exact Markdown headings outside fenced examples; line
ranges are1-based inclusive. Bad/ambiguous selections fail before preparation;
they are never silently truncated. Duplicate identical presentations collapse.

The full snapshot remains in the existing operation record, even for excerpts.
Reference packets supply the exact facade path, StateRoot and JSON reader request:
`{"workId":"example-E17","sourceId":"<64-hex frozen source ID>"}`.
Pass its values directly as `read-source -WorkId ... -SourceId ...` against that
StateRoot, with optional `-Heading` or `-StartLine/-EndLine`; no file creation is
needed by a read-only reviewer. Alternatively an existing JSON request may supply
the same data with `heading` or `lines`; do not mix the two forms.
The reader validates the handle in that same work and
does not read a newer filesystem revision or create a lifecycle operation.
Retrieve essential plan/evidence before acting; a reference is not an approval.

Normal operation views include `packet` byte counts, top sources and an advisory
warning above32KiB. These are bytes, not tokens, and never a new admission gate.

### Observed state projection

Explicit target enrollment is documented in config/README.md. Without it no file
is written. Existing mutation boundaries (open-work, submit/restore/compact,
executor return, interpret and record-pause) refresh the marked block only.
Inspect, read-result/read-source, wait/reconcile and observe-session do not write
project files. After read-only reconciliation, use refresh-state when needed;
no extra Meta turn. The response distinguishes UPDATED/UNCHANGED/NOT_ENROLLED,
DEFERRED and DRIFT_RECOVERABLE without undoing successful operation facts.

The writer serializes cooperating processes and compares the whole file before
replacement. It preserves an unexpected displaced version as a `.replaced`
recovery file; never delete it as generic cleanup. Resolve actual Owner-edit
conflict before dependent mutation. A mere missing optional projection does not
block unrelated work. Windows File.Replace is the supported writer; other hosts
return DEFERRED rather than use an unsafe fallback.

Only the validly enrolled generated block is excluded from new pre-send authority
comparison; full original source/digest is retained. Old pending whole-file state
sources defer projection refresh until they settle, without rewriting their inputs.
The same tracked state file can become projection-only dirty after closeout. Report
that fact; never amend, auto-commit or reopen product work to chase the view.

The same action key and same request retrieve the existing operation. Different
input under that key is `INPUT_CONFLICT`. Use a new key for a genuine subsequent
stage, clarification or repair; never use one to disguise a resend.

For clarification, set `kind: "CLARIFICATION"` and put the bounded question in
`arguments`. The router uses a prompt, not a pretend slash command. For example,
ask where an existing test report is recorded; do not request implementation again.
The existing result can remain a source.

`restore` uses the same request shape, forces `RESTORE` and `after-compact`,
and supplies project/profile plus minimal current-work context. `sources` are
optional, useful current references. The orchestrator separately chooses any later
lifecycle action.

`compact` accepts:

```json
{
  "workId": "example-E17",
  "actionKey": "E17/delivery-compact/1",
  "recipientRole": "delivery",
  "predecessor": "op-last-completed"
}
```

Optional `model` is `{"providerID":"provider","modelID":"model"}`; otherwise
the available session observation/configured model supplies it. The effective
compaction-agent model may differ; requested/effective metadata records this
without inventing another model admission gate. Empty sessions and already
completed native compaction return a no-send disposition.

## Interpretation, pause and import

`interpret` accepts `operationId`, `responsibleRole`, `decision` and nonempty
`evidenceReferences`; optional `resultDigest` binds the selected retained result.
The role must equal that operation's recipient. A stored interpretation is
immutable. Missing output/evidence warrants an explicit unresolved decision or
bounded clarification, never fabricated acceptance.

`record-pause` accepts `workId`, `paused` and `instructionReference`.
`paused: false` requires the actual Owner resume instruction. Pausing affects new
router dispatch, not remote interruption or erasure of a late result.

`import-legacy` accepts `workId`, an absolute private `legacyRoot`, old `runId`,
old `operationId`, configured `recipientRole` and `pauseReference`. It reads
`runs/<runId>/run.json` and the old operation's intent/records/evidence, verifies
their identity/provenance, and imports idempotently. It never writes originals,
contacts OpenCode during import or makes the imported operation executable.
The work is paused. Accepted artifacts remain historical evidence, not a new
verification of product correctness. Unresolved imports can later use GET-only
`reconcile`; preserve their uncertainty and Owner pause.

## Operational facts and failure handling

`inspect` derives progress from the store. Delivery is `NOT_SENT`, `POSSIBLE` or
`DELIVERED`; execution is prepared/pending or completed/failed. `outputAvailable`
and `interpretation` answer separate questions. A completed empty answer is not
green. A known-delivered malformed answer remains delivered.

The store atomically creates an action and participant claim, then records
dispatch-started before submission. HTTP status alone is not root correlation.
A retaining executor owns the actual POST connection; a caller's observation
timeout does not terminate it. Restart/death after dispatch-started leaves possible
delivery and no automatic replay.

| Condition | Handling |
|---|---|
| `WORK_PAUSED` | Preserve the instruction; observation may continue |
| `PARTICIPANT_BUSY` / unavailable required activity | Wait/read; do not interrupt |
| Address/project/session or scope/effect conflict | Stop affected dispatch and resolve it |
| `SOURCE_CHANGED` / `COMMAND_CHANGED_BEFORE_SEND` | Review the changed input; do not overwrite frozen provenance |
| Possible delivery, incomplete body or unavailable history | Reconcile the same operation, never blind retry |
| Several attributable terminal candidates | Preserve ambiguity; do not pick the newest text |
| Optional token/catalog telemetry unavailable | Report unknown advisory data, not a universal blocker |

Command recovery uses recorded message/parent identity or preserved dispatch-time
evidence. It follows opaque history cursors; a bounded page limit does not prove
absence. Old results do not depend on today's command template or a fresh send
capability. Ordinary server restart rechecks addressing and supported behavior
without a new P0B approval.

SQLite state uses WAL. Keep its files together and use a coherent closed/supported
backup; copying an active main database alone is not a backup. Never clear claims
or delete unresolved history to make a resend fit. These safeguards coordinate
participating clients in a personal system; they do not prevent all manual UI
activity or provide adversarial OS isolation.

See the [operating runbook](workflow-orchestrator-runbook.md) and
[versioned installer](../../workflow-tooling/README.md). Source, installed bytes,
loaded behavior, qualification and project resumption remain distinct.
