# Router V2 quickstart

Use this guide for already authorized, isolated work. Router V2 is a candidate: it
does not establish global installation, loaded behavior, live qualification,
release, or permission to resume another project. The Owner supplies scope and
side-effect authority; the orchestrator chooses each lifecycle action.

## Start safely

Use Node `>=22.11.0 <23` and an existing built `runtime/dist/src/v2/cli.js`. The
facade never builds or installs during dispatch. From the repository root, inspect
the local interface without creating router state or contacting OpenCode:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action help
```

Router state and `router-config.json` are private. Their default root is
`%LOCALAPPDATA%\FractalAgentLab\oc-router\v2`; use `-StateRoot` and `-ConfigPath`
for another private current configuration. Verify its target, project, directory,
role and session bindings before network work. Never put credentials in requests
or Git. Network actions inherit the documented credential environment variables.

The following request bodies are synthetic shapes, not approval or live pilot
instructions. Store actual request files outside the repository. In the commands,
request variables name those private files; `$WorkId` and `$OperationId` hold
values returned by the router.

## Open work

An `open-work` request fixes the target envelope and allowed effects locally. It
does not contact the server.

```json
{
  "workId": "example-quickstart",
  "target": "example-project",
  "directory": "SYNTHETIC_ABSOLUTE_PROJECT_DIRECTORY",
  "instructionReference": "example-owner-instruction",
  "scope": "Complete one reviewed documentation Epic and its authorized local closeout. No push or deploy.",
  "allowedEffects": ["READ_ONLY", "WORKSPACE_WRITE", "LOCAL_COMMIT", "SESSION_MAINTENANCE"],
  "stoppingPoint": "Stop after reviewed local closeout and report unresolved items."
}
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action open-work -RequestPath $WorkRequest
```

Use only effects granted by the Owner. Reopening the identical envelope is
idempotent; changing it under the same `workId` is a conflict.

## Submit and observe

The first operation can omit `predecessor`:

```json
{
  "workId": "example-quickstart",
  "actionKey": "example-quickstart/plan/1",
  "recipientRole": "delivery",
  "command": "seq-next",
  "arguments": "Plan the authorized synthetic documentation Epic.",
  "sources": [{"path": "plans/epics/EXAMPLE.md"}]
}
```

A later operation may name a predecessor. When present, it must be a completed
operation in the same work. A predecessor enforces order; a `sources` entry carries
frozen file or retained-result content.

```json
{
  "workId": "example-quickstart",
  "actionKey": "example-quickstart/plan-review/1",
  "recipientRole": "meta",
  "command": "terv-review",
  "arguments": "Review the exact retained plan.",
  "predecessor": "op-example-completed-plan",
  "sources": [{"operationId": "op-example-completed-plan"}]
}
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action submit -RequestPath $ActionRequest
```

`submit` is not a dry run: after safe preparation it can start a retaining
executor and deliver work. Reusing the same `actionKey` with identical input finds
the same operation. Changed input produces `INPUT_CONFLICT`; a new key is only for
a genuine later stage, clarification or repair, never an uncertain resend.

Inspect concise operation or work facts, then explicitly read private output when
needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action inspect -OperationId $OperationId
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action inspect -WorkId $WorkId
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action read-result -OperationId $OperationId
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action observe-session -WorkId $WorkId -Role delivery
```

`observe-session` performs GET telemetry for the configured role. Keep retained
result text private. Delivery is `NOT_SENT`, `POSSIBLE`, or
`DELIVERED`; execution is separately prepared/pending or completed/failed.
`outputAvailable` and the responsible role's immutable interpretation are further
separate facts. Completion or text alone is never product acceptance.

## Recover without resending

Use the same operation identity. A zero wait is a stored snapshot without network:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action wait -OperationId $OperationId -WaitMilliseconds 0
```

`reconcile` returns an ordinary prepared operation or an already-completed
operation from stored state. For dispatched unresolved work, it may perform one
bounded GET recovery pass. A nonzero `wait` may repeat bounded reconciliation and
advisory observation until completion, ambiguity, Owner pause, or budget expiry.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action reconcile -OperationId $OperationId
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action wait -OperationId $OperationId -WaitMilliseconds 60000
```

A local wait ending reports `sessionInterrupted: false`; it never cancels the
retaining POST or proves remote work stopped. `POSSIBLE`, incomplete output, and
unavailable history require inspection or reconciliation of the same operation,
never blind retry. Preserve ambiguity rather than choosing convenient output.

After reading a completed result, the operation's recipient records its meaning:

```json
{
  "operationId": "op-example-completed-review",
  "responsibleRole": "meta",
  "decision": "EXAMPLE_REVIEW_RECORDED",
  "evidenceReferences": ["example-retained-result-reference"]
}
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action interpret -RequestPath $InterpretationRequest
```

Missing output or evidence remains unresolved; do not fabricate acceptance.

## Compact and minimally restore

At a verified idle lane boundary, preserve useful completed references and compact
once. The predecessor is optional, but when supplied it follows the same
completed-operation, same-work rule.

```json
{
  "workId": "example-quickstart",
  "actionKey": "example-quickstart/delivery-compact/1",
  "recipientRole": "delivery",
  "predecessor": "op-example-completed-stage"
}
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action compact -RequestPath $CompactRequest
```

An empty or already compacted session can return a no-send disposition. Otherwise
compact may send maintenance work. Observe its actual completion before restore.

```json
{
  "workId": "example-quickstart",
  "actionKey": "example-quickstart/delivery-restore/1",
  "recipientRole": "delivery",
  "predecessor": "op-example-completed-compact",
  "sources": [{"path": "ops/PROJECT_STATE.md"}]
}
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/oc-session-router/scripts/Invoke-OCRouter.ps1 -Action restore -RequestPath $RestoreRequest
```

Restore may send installed `/after-compact`, but only to rebuild minimal role/work
context. It never selects or repeats lifecycle work. The orchestrator selects the
next authorized action. Agents do not abort, kill, or interrupt sessions; only the
Owner does so. The Owner also compacts orchestrator sessions manually.

## Action effects

| Class | Actions | Meaning |
|---|---|---|
| Local/no-send | `help`, `open-work`, `inspect`, `read-result`, `interpret`, `record-pause`, `import-legacy`, `wait` with zero | May read or update private local state but does not contact OpenCode |
| GET observation/recovery | `observe-session`, plus nonzero `wait` or `reconcile` for dispatched unresolved work | May read current telemetry/history without resending the operation |
| Possible delivery | `submit`, `compact`, `restore` | Can initiate a retaining lifecycle or maintenance request after admission checks |

## Troubleshooting

| Condition | Safe response |
|---|---|
| `ROUTER_V2_BUILD_MISSING` | Build separately only under explicit authority; the facade never builds during dispatch |
| Missing store or credentials | Select the intended private state; credentials are needed only for network work and remain process-private |
| `WORK_PAUSED` | Preserve the Owner instruction; observe only until an actual Owner resume exists |
| `PARTICIPANT_BUSY` or unavailable activity | Wait/read; never interrupt the participant |
| Invalid predecessor | Use no predecessor for the first operation, or a completed operation from the same work |
| Changed source, command, identity, scope, or effect | Stop the affected dispatch and resolve the conflict; do not overwrite frozen provenance |
| `POSSIBLE`, incomplete body, or missing history | Reconcile the same operation; do not change keys to resend |
| Empty completed output | Keep acceptance unresolved and use bounded clarification if appropriate |
| Missing optional token/catalog telemetry | Report it as unknown advisory data, not a universal blocker |

See the [interface and recovery reference](workflow-orchestrator-reference.md),
[operating runbook](workflow-orchestrator-runbook.md),
[command reference](session-router-cheatsheet.md),
[private configuration guide](../config/README.md), and
[managed tooling guide](../../workflow-tooling/README.md).
