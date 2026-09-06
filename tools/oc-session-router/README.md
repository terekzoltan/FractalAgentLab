# OpenCode Session Router V2

V2 is the FAL adapter for addressed OpenCode work: one operation store, one
transport implementation and an orchestrator-led lifecycle. Project instructions,
plans and acceptance remain with the Owner and the responsible project roles.

This is a source/release candidate. These docs do not claim global installation,
loaded-process qualification, an AWC 5 release or permission to resume frozen
projects. The useful real-work pilot and its quickstart remain separate
qualification deliverables.

## Entry points

- [Operating runbook](docs/workflow-orchestrator-runbook.md): lifecycle, recovery,
  clarification and lane continuity.
- [Interface reference](docs/workflow-orchestrator-reference.md): actions,
  request fields and result meanings.
- [Command reference](docs/session-router-cheatsheet.md): compact invocation syntax.
- [Private configuration](config/README.md): schema 2 and participant addressing.
- [Versioned tooling installer](../workflow-tooling/README.md): managed command,
  skill and agent deployment; installed and loaded status are separate facts.

`scripts/Invoke-OCRouter.ps1` is the public facade over
`runtime/dist/src/v2/cli.js`. It accepts `-Action`, never builds or installs during
dispatch, inherits process credentials, and returns CLI JSON/exit status.
`scripts/session-context-status.ps1` delegates to the same `observe-session` action.
There is no legacy operation alias or second mapping/controller.

Default private state is `%LOCALAPPDATA%\FractalAgentLab\oc-router\v2`:
`router-config.json` and `router.sqlite` with its SQLite WAL sidecars.
An explicit `-StateRoot` selects another private absolute root. Keep configuration,
state, raw IDs and task results outside Git.

## What the router establishes

| Fact | Meaning |
|---|---|
| Delivery | `NOT_SENT`, `POSSIBLE` or attributable `DELIVERED` |
| Execution | Prepared/pending or an observed completed/failed operation |
| Interpretation | The responsible role's recorded decision with evidence references |

A completed request is not product acceptance. Empty/missing output, missing test
evidence or unresolved findings never become green merely because a model stopped.
Use `read-result` and the responsible role's interpretation before dependent work.

Stable action keys prevent duplicate participating-client attempts. The same key
with changed input is a conflict. An uncertain send remains recoverable under its
existing identity; reconnect, timeout and process exit do not authorize resend.
A local wait ends observation without cancelling the retaining POST connection.

These are personal, same-user coordination guarantees, not adversarial OS
isolation or universal remote exactly-once delivery. Manual UI activity may bypass
router claims. Agents never abort, kill or interrupt sessions; the Owner does so
manually.

## Build and offline checks

Use the package's supported Node 22 range (`>=22.11.0 <23`) and lockfile.

```powershell
Set-Location tools/oc-session-router/runtime
npm ci
node build.mjs
npm test
```

`node build.mjs` cleans generated `dist` and then runs TypeScript compilation.
`npm test` exercises the active V2 suite; it does not run retired V1 engines.
The launcher supplies `--experimental-sqlite`. A missing build reports
`ROUTER_V2_BUILD_MISSING` rather than building on a live action.
The focused facade check is `scripts/test-v2-launcher.ps1`; it uses only disposable
local fixtures.

## Remaining release closure

Record integrated offline/Windows checks, one bounded isolated OpenCode transport
compatibility check, and the single useful full-lifecycle pilot. Qualify actual
connection/disconnection behavior and required loaded command behavior rather than
promoting synthetic HTTP tests to live proof.

Finish the reviewed source, installer/reference, consumer/adoption and retirement
changes under the actual Owner publication envelope. The Owner performs any
necessary running-service reload; normal restart requires read-only compatibility
checks, not another P0B ceremony. Preserve paused projects and coherent store
backups. Rollback cannot erase sends or re-enable a V1 writer unaware of V2 work.
