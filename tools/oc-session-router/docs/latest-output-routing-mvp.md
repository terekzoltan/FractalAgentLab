# Latest Output Routing MVP

Status: `SUPERSEDED / NON-OPERATIONAL`

Latest-output selection cannot route or send. Read-only diagnostics may inspect
output without writing artifacts; only an exact target-authoritative stage input
can enter the explicit-stage runtime.

This document records the latest-output MVP for OC Session Router. The initial scripts are implemented, but the message schema should still be reviewed against live OpenCode output before relying on auto-selection.

## Goal

Reduce manual copy/paste by reading the latest assistant output from one OpenCode session and routing it to another session through the existing approval-gated command routing flow.

First valuable target:

```text
Track latest output -> preview -> Meta /terv-review command
```

Second target after that:

```text
Meta latest output -> preview -> Track /terv-review-utan command
```

## Confirmed API Basis

OpenCode server has a documented read endpoint:

```text
GET /session/:id/message
```

It lists session messages, supports an optional `limit` parameter, and returns message objects shaped like:

```text
{ info, parts }[]
```

Useful endpoint set:

```text
GET  /session/:id/message              # list messages
GET  /session/:id/message/:messageID   # message detail, if needed
POST /session/:id/message              # normal chat message, slash commands are not expanded
POST /session/:id/command              # slash command invocation
GET  /event                            # future event stream option, not first MVP
```

## Non-Goals For This MVP

- No event-stream watcher.
- No automatic background forwarding.
- No full step-review + Swarm Assistant state machine.
- No auto `/implement`.
- No auto commit or push.
- No writes to versioned files with runtime output.
- No W6 canonical evidence claim.

## Script 1: `read-latest-output.ps1`

Path:

```text
tools/oc-session-router/scripts/read-latest-output.ps1
```

Responsibilities:

- Resolve `-From <logical-session-name>` through `.opencode-router/sessions.json`.
- Call `GET /session/{sessionID}/message?limit=<N>`.
- Find the latest assistant-like text output.
- Print a preview.
- Optionally save to `.opencode-router/artifacts/latest-<from>-<timestamp>.md`.

Safety constraints:

- Read-only.
- No session mutation.
- No packet movement.
- No send.
- No commit.
- No versioned runtime output.

Suggested command:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/read-latest-output.ps1 `
  -From track-a `
  -Limit 5
```

Default behavior selects the latest assistant-like text output and previews it. Manual candidate selection is available with `-InteractiveSelect`.
Reasoning/thought/analysis parts are filtered by default. Use `-IncludeReasoningParts` only for debugging.

If extraction still includes unexpected content, inspect the raw message part metadata:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/dump-message-parts.ps1 `
  -From track-a `
  -Limit 3
```

## Latest Assistant Selection Rule

The script must not assume the last message is always the right output.

Candidate selection should prefer the most recent message that:

- appears to be an assistant response based on `info`, if role/type metadata exists;
- or at least does not appear to be a user message;
- contains text-like parts;
- is non-empty;
- is not tool-only or file-only.

If the message schema is ambiguous during debugging, use `-InteractiveSelect` to show candidate summaries and ask for explicit selection:

```text
Latest assistant candidates found:
1. ...
2. ...
3. ...
Use candidate? [1/2/3/N]
```

This is safer than silently forwarding the wrong output when session ordering or role metadata looks suspicious.

## Script 2: `route-latest-output.ps1`

Path:

```text
tools/oc-session-router/scripts/route-latest-output.ps1
```

Example usage:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/route-latest-output.ps1 `
  -From track-a `
  -To meta `
  -Stage plan_ready_for_meta_review `
  -Target P6-D(A_part) `
  -PreviewOnly
```

Responsibilities:

1. Read the latest assistant output from `-From`.
2. Build an in-memory packet or a runtime artifact + packet.
3. Show preview with:
   - From session
   - To session
   - Stage
   - Command
   - Argument mode
   - Target + Track prefix, when relevant
   - Latest output preview
4. In `-PreviewOnly`, do not send anything.
5. In live mode, ask for explicit approval before calling the existing route/command endpoint logic.

Preferred internal split:

```text
read-latest-output.ps1      = read-only session output extraction
packet creation helper      = converts selected output to router packet shape
route-packet.ps1            = routing + approval + command/message endpoint
route-latest-output.ps1     = convenience wrapper over the above
```

The wrapper avoids duplicating command routing by creating a temporary or runtime packet and delegating to `route-packet.ps1`.

Preview-only mode uses a temporary inline-body packet and deletes it after preview. Live mode writes a runtime artifact and packet under `.opencode-router/`, then lets `route-packet.ps1` handle preview, approval, send, and processed movement.

## Smoke Checks

Read-only latest output preview:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/read-latest-output.ps1 `
  -From track-a `
  -Limit 5
```

Route latest output preview-only:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/route-latest-output.ps1 `
  -From track-a `
  -To meta `
  -Stage plan_ready_for_meta_review `
  -Target P6-D(A_part) `
  -PreviewOnly
```

Optional live route, explicitly approval-gated:

```powershell
pwsh -NoProfile -File tools/oc-session-router/scripts/route-latest-output.ps1 `
  -From track-a `
  -To meta `
  -Stage plan_ready_for_meta_review `
  -Target P6-D(A_part)
```

Live route must still show preview and ask `[y/N]` before sending.

## Guided Step-Review Follow-On

Latest-output reading unlocked the later guided `run-step-review-flow.ps1` orchestration. The current guided order is:

```text
Meta step-review Phase 1 output
-> extract SWARM ASSISTANT PROMPT
-> route to swarm-assistant
-> ask before sending go
-> collect Swarm output
-> forward to Meta after approval
-> final synthesis
```

What still remains deferred is silent/autonomous progression without explicit approvals.

## Future Operator-Assisted Automation Idea

Because the router entrypoints are plain PowerShell commands, an assistant running in the same workspace can later orchestrate the sequence directly while preserving human control.

Potential workflow:

```text
assistant runs read/route/invoke PowerShell scripts
-> assistant previews the next action
-> assistant asks the human for approval before send/command/route
-> assistant executes only the approved next step
-> assistant reports the result and waits for the next approval point
```

This could reduce manual terminal work without becoming unattended autonomy. Approval should still be required before cross-session sends, `/implement`, `/step-review`, commit, push, or any high-risk transition.

Do not implement this as silent autopilot. Treat it as assistant-operated, human-approved orchestration.
