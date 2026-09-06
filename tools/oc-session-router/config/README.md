# Private Router V2 configuration

The runtime consumes one private `router-config.json` with `schemaVersion: 2`.
Optional top-level `compactThresholdRatio` defaults to `0.60` (finite, from
`0.02` through `0.99`). It controls advisory idle-lane maintenance, not send
permission. The warning threshold is at most `0.50`, below the compact threshold.
Omission needs no configuration migration. Pressure uses the matched model's input
limit, or an explicitly labelled reserve-adjusted/context-only estimate. Never
manually copy one model's capacity into every role.
Default location: `%LOCALAPPDATA%\FractalAgentLab\oc-router\v2`, or the selected
`-StateRoot`. `-ConfigPath` may name another private config file. Do not commit
actual session IDs, endpoints, workstation paths, credentials or runtime state.

This example is entirely synthetic and must be replaced with verified bindings:

```json
{
  "schemaVersion": 2,
  "targets": {
    "example-project": {
      "namespace": "example-opencode-instance",
      "project": "REPLACE_WITH_VERIFIED_OPENCODE_PROJECT_ID",
      "directory": "C:/projects/example",
      "origin": "http://127.0.0.1:4096",
      "roles": {
        "delivery": {
          "session": "ses_REPLACE_DELIVERY",
          "profile": "example-delivery",
          "capability": "DELIVERY"
        },
        "meta": {
          "session": "ses_REPLACE_META",
          "profile": "example-meta",
          "capability": "META"
        },
        "support": {
          "session": "ses_REPLACE_SUPPORT",
          "profile": "example-support",
          "capability": "SUPPORT"
        },
        "orchestrator": {
          "session": "ses_REPLACE_ORCHESTRATOR",
          "profile": "example-orchestrator",
          "capability": "ORCHESTRATOR"
        }
      }
    }
  }
}
```

## Meaning of the binding

The target key (`example-project`) is the logical `target` in a work envelope.
`project` is the actual OpenCode project ID verified from the selected session,
not a display name. `directory` is the exact absolute target/worktree scope.
`origin` must be HTTP on supported loopback: `127.0.0.1`, `localhost` or `[::1]`.
Redirects and URL credentials are forbidden.

`namespace` identifies the intended OpenCode instance consistently across ordinary
restarts/port changes. The tuple `namespace + project + session` owns participant
exclusion. Aliases for the same participant must use the same tuple. Do not create
a new namespace merely to bypass an unresolved claim, or infer that unrelated
servers are equivalent.

Each role maps to a verified session and the installed project/role `profile` used
by `/after-compact`. `capability` is `DELIVERY`, `META`, `SUPPORT` or `ORCHESTRATOR`.
Independent Delivery and Meta cannot share a session. Configure participants once,
then reuse these bindings; fresh addressing/activity checks do not require a
per-stage P0B receipt.

Optional role fields are `allowedCommands` (a narrowing allowlist), `agent`,
`model` (`provider/model`), `variant` and `contextLimit`. Agent/model/profile names
must describe actual available configuration, not promises invented by this
example. A configured context-limit override applies only when its model matches
the observed/configured model. Missing optional telemetry is reported unavailable.

Installed slash-command definitions may supply their own agent/model/subtask
behavior. The router freezes selected command semantics and rechecks them before
a new send. In particular, a configured compaction agent may use a different
summary model; requested and effective model metadata remain distinct.

## Commands, credentials and scope

Core lifecycle role/effect rules are in V2: Meta handles `wave-start`,
`terv-review`, `step-review` and approved `closeout-commit`; Delivery handles
`seq-next`, `terv-review-utan`, `implement` and `step-review-utan`.
A target may declare additional reviewed `commands` as
`{"command-name":{"capability":"SUPPORT","effect":"READ_ONLY"}}`. These cannot
override core lifecycle rules. Custom effects are `READ_ONLY`, `WORKSPACE_WRITE`
or `LOCAL_COMMIT`; commits require Meta capability. Configuration does not grant
the Owner authority missing from a work envelope.

Network actions inherit `OPENCODE_SERVER_PASSWORD` and optional
`OPENCODE_SERVER_USERNAME` from the process; username defaults to `opencode`.
There are no password parameters or credential fields in this JSON. Avoid logging
the environment. Local work registration/inspection needs no running server.

Register a meaningful `WorkContext` separately: instruction reference, scope,
allowed effects and stopping point, not merely an Epic label. Requests carry a
work ID, action key, recipient and relevant sources/results. They do not copy
session credentials or the whole authority snapshot.

After an ordinary server restart, verify current session/project/worktree and
supported command behavior read-only. Reuse the same durable action for recovery;
do not demand fresh P0B or discard known results because a template changed.
Actual identity conflicts prevent new sends. Owner pauses survive maintenance
and NO_SEND legacy import.

See [request shapes](../docs/workflow-orchestrator-reference.md),
[operating guidance](../docs/workflow-orchestrator-runbook.md), and the
[versioned installer](../../workflow-tooling/README.md) for managed definitions.
This configuration is a candidate interface, not proof of installation, loaded
state, live qualification or project-resumption authority.
