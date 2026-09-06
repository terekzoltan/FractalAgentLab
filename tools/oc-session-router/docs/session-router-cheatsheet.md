# Router V2 command reference

Use `scripts/Invoke-OCRouter.ps1` with explicit `-Action`. These are syntax
references for already authorized work, not a pilot sequence.

| Need | Facade arguments |
|---|---|
| Interface | `-Action help` |
| Register scope | `-Action open-work -RequestPath <work.json>` |
| One stage or clarification | `-Action submit -RequestPath <action.json>` |
| Work progress | `-Action inspect -WorkId <work-id>` |
| Operation facts | `-Action inspect -OperationId <operation-id>` |
| Private result | `-Action read-result -OperationId <operation-id>` |
| Observe until boundary | `-Action wait -OperationId <operation-id> -WaitMilliseconds <0..3600000>` |
| One recovery pass | `-Action reconcile -OperationId <operation-id>` |
| Record accountable meaning | `-Action interpret -RequestPath <interpretation.json>` |
| Lane status/context | `-Action observe-session -WorkId <work-id> -Role <configured-role>` |
| Lane compact | `-Action compact -RequestPath <compact.json>` |
| Minimal role restore | `-Action restore -RequestPath <restore.json>` |
| Owner pause/resume | `-Action record-pause -RequestPath <pause.json>` |
| Preserve old evidence, NO_SEND | `-Action import-legacy -RequestPath <import.json>` |

Every action may use `-StateRoot <absolute-private-root>` and
`-ConfigPath <private-config.json>`. The default root is
`%LOCALAPPDATA%\FractalAgentLab\oc-router\v2`; config defaults to
`router-config.json` there. Quote paths and IDs as ordinary PowerShell arguments.
No password/server/registry/P0B parameters exist. Process username defaults to
`opencode`; the process supplies credentials only when network access is needed.

The alternate status facade is exactly
`scripts/session-context-status.ps1 -WorkId <work-id> -Role <configured-role>`,
with optional state/config paths. It uses the same V2 observer and store.

## Keep these distinctions visible

- `DELIVERED` is not acceptance; `COMPLETED` with no usable output is not green.
  Read the evidence and record responsible interpretation before dependent work.
- Reuse the same action key to inspect/resume the same request. Changed input is a
  conflict. New keys are for real later stages/repairs, never uncertain resends.
- A wait deadline ends observation. It does not cancel the retaining request or
  prove that work stopped. Agents have no abort/kill/interrupt action.
- Last-call token pressure is advisory. Missing optional telemetry means unknown.
  Actual addressing/scope conflicts still block new sends.
- At a safe idle lane boundary: compact once, verify its effect, restore role
  context, then explicitly choose the original workflow's next action. Recognize
  native/manual compaction; do not compact again because its summary reports old
  input usage. Orchestrator compaction and session interruption belong to the Owner.
- Import preserves a pause and cannot send. Restart does not require new P0B.
  Neither migration nor late completion silently unpauses a project.

[Request fields and errors](workflow-orchestrator-reference.md) ·
[Lifecycle ownership](workflow-orchestrator-runbook.md) ·
[Private configuration](../config/README.md) ·
[Managed tooling installer](../../workflow-tooling/README.md)

This is candidate operating guidance. The bounded live compatibility check,
single useful full-lifecycle pilot and release/adoption closure remain separate.
