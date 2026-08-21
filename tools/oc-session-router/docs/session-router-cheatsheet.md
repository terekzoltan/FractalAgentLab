# Session Router Quick Index

## Current lifecycle entrypoint

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Initialize-OCRouterControlPlane.ps1 -Action Bootstrap
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Initialize-OCRouterControlPlane.ps1 -Action Verify
$env:OPENCODE_SERVER_USERNAME = '<process-only username>'
$env:OPENCODE_SERVER_PASSWORD = Read-Host 'Process-only local password'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Invoke-OCRouter.ps1 -Operation new-run -RequestPath '<run-request.v1 path>'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Invoke-OCRouter.ps1 -Operation invoke-stage -RequestPath '<stage-request.v1 path>'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Invoke-OCRouter.ps1 -Operation resolve-stage -RunId '<run ID>' -OperationId '<operation ID>'
```

Each invocation performs at most one stage and returns `auto_advance: false`.
Legacy wrapper examples below are historical only and now fail closed.

No-send source preparation (the spec must name every authority source):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Prepare-OCRouterStage.ps1 -TargetRoot '<TARGET_ROOT>' -SpecificationPath '<router-stage-prepare-spec.v1.json>' -OutputDirectory '<PRE-CREATED_PRIVATE_OUTPUT>'
```

Review and adopt the candidate manifest/state packet separately. Preparation does
not send; invocation never selects sources. Runtime `0.2.0` defaults to
`DISABLED`. `P0B_ISOLATED` is one-use synthetic-only, and production requires a
separate nonzero P0B proof-bound receipt. Active modes require AWC `4.1.1`; SSE is
always disabled. Keep OpenCode sharing disabled in config and process environment.
Bind the synthetic target beneath the registry-owned, reparse-free
`p0b_isolation_root`; its domain hash must match the capability receipt.

```powershell
Set-Location <TARGET_ROOT>
$env:OPENCODE_SERVER_PASSWORD = Read-Host "Temporary local server password"
opencode serve --hostname <LOOPBACK_HOST> --port <PORT>
```

Replace the password placeholder locally before running the command. Never place
the real credential in this file, an event, a policy, or normal command output.

- Hot path: `workflow-orchestrator-runbook.md`
- Triggered detail: `workflow-orchestrator-reference.md`
- Production session mapping: fixed owner-protected `control\control-registry.json`
- Target-local `../sessions.json`: dry-run/legacy fixture input only
- Review policy examples: `../config/`
- Contract and regression tests: `../scripts/test-review-routing.ps1`

Native step review:

```powershell
powershell.exe -NoProfile -File scripts/Invoke-OCRouter.ps1 -Operation invoke-stage -RequestPath '<STEP_REVIEW stage-request.v1 path>'
```

The protected stage request selects Meta as recipient and pins the exact
implementation/evidence sources. Meta chooses native review domains and generic
reviewer profiles inside that single command stage. Retired lifecycle wrappers and
historical Swarm runs may be inspected read-only but are never dispatched or resumed.

Read-only context pressure:

```powershell
..\scripts\session-context-status.ps1 -Target meta
..\scripts\session-context-status.ps1 -AllMapped
```

The report uses the latest completed provider observation plus a separately
labeled active-context estimate. It never compacts a session.

Compact Lite policy and safe-boundary evaluation:

```powershell
..\scripts\resolve-compact-policy.ps1 -GlobalPolicyPath <GLOBAL_POLICY> -ProjectPolicyPath <TARGET_POLICY> -AsJson
..\scripts\invoke-session-compact-lite.ps1 -ProjectId <PROJECT> -ProfileId <PROFILE> -AttemptId <ATTEMPT> -TargetRoot <TARGET_ROOT> -CanonRoot <CANON_ROOT> -CanonContractSha256 <CONTRACT_SHA256> -ProjectProfileSha256 <PROFILE_SHA256> -Target <LOGICAL_PARTICIPANT> -RoleHint <ROLE> -EventType before_dispatch -Server <LITERAL_127.0.0.1_SERVER> -GlobalPolicyPath <GLOBAL_POLICY> -GlobalPolicySha256 <POLICY_SHA256> -DryRun
```

Remove `-DryRun` only when the attempt is authoritative, every safe-boundary field
is proven, and the policy permits action. Non-dry Compact ignores caller selection:
the attested launcher resolves and live-revalidates the exact protected target,
literal loopback server instance, session, capability, and timeout, then consumes a
P0B grant before the first POST. The adapter never prints the server, credential,
raw session ID, transcript, or route artifact body.
Its raw protected authority is read from an owner-only ephemeral handoff and
deleted immediately; normal launcher output contains status and digests only.

Legacy one-shot command waiting and direct FAL sync are retired. Dispatch the
canonical command through the current endpoint with a persisted intent, pin the
exact response artifact and Candidate, and use a separate authorized
`/fal-checkpoint-target` dispatch for any FAL write.
