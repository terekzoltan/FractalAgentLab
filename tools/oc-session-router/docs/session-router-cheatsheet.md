# Session Router Quick Index

```powershell
Set-Location <TARGET_ROOT>
$env:OPENCODE_SERVER_PASSWORD = "<PASSWORD_FROM_PRIVATE_RUNTIME>"
opencode serve --hostname <LOOPBACK_HOST> --port <PORT>
```

Replace the password placeholder locally before running the command. Never place
the real credential in this file, an event, a policy, or normal command output.

- Hot path: `workflow-orchestrator-runbook.md`
- Triggered detail: `workflow-orchestrator-reference.md`
- Runtime session mapping: `../sessions.json`
- Review policy examples: `../config/`
- Contract and regression tests: `../scripts/test-review-routing.ps1`

Read-only context pressure:

```powershell
..\scripts\session-context-status.ps1 -Target meta
..\scripts\session-context-status.ps1 -AllMapped
```

The report uses the latest completed provider observation plus a separately
labeled active-context estimate. It never compacts a session.

Compact V2 policy and event evaluation:

```powershell
..\scripts\resolve-compact-policy.ps1 -GlobalPolicyPath <GLOBAL_POLICY> -ProjectPolicyPath <TARGET_POLICY> -AsJson
..\scripts\invoke-session-compact-flow.ps1 -EventPath <EVENT_FILE> -TargetRoot <TARGET_ROOT> -CanonRoot <CANON_ROOT> -GlobalPolicyPath <GLOBAL_POLICY> -DryRun
```

Remove `-DryRun` only when the event is authoritative, every safe-boundary field
is proven, the policy permits action, and the configured loopback server belongs
to the target session map. The adapter never prints the server, credential, raw
session ID, transcript, or route artifact body.

Legacy one-shot command waiting and direct FAL sync are retired. Dispatch the
canonical command through the current endpoint with a persisted intent, pin the
exact response artifact and Candidate, and use a separate authorized
`/fal-checkpoint-target` dispatch for any FAL write.
