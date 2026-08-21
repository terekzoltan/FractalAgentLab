[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')
. (Join-Path $PSScriptRoot 'session-compact-flow-core.ps1')
. (Join-Path $PSScriptRoot 'session-compact-lite-core.ps1')

$failures = New-Object System.Collections.Generic.List[string]
function Assert-LiteEqual($Actual, $Expected, [string]$Label) {
  if ([string]$Actual -cne [string]$Expected) { $failures.Add("$Label expected '$Expected', got '$Actual'.") }
}
function Assert-LiteTrue([bool]$Condition, [string]$Label) {
  if (-not $Condition) { $failures.Add("$Label expected true.") }
}
function Assert-LiteThrows([scriptblock]$Action, [string]$ExpectedMessage, [string]$Label) {
  try { & $Action; $failures.Add("$Label expected an exception.") }
  catch { if (-not $_.Exception.Message.Contains($ExpectedMessage)) { $failures.Add("$Label expected '$ExpectedMessage', got '$($_.Exception.Message)'.") } }
}

function New-LitePolicy([string]$Mode = 'auto_safe') {
  [pscustomobject]@{
    valid=$true; automatic_action_allowed=$true; effective_policy_sha256=('a' * 64)
    effective_policy=[pscustomobject]@{
      mode=$Mode; warn_ratio=0.5; critical_ratio=0.62
      checks=@('before_dispatch','after_stage_output','epic_closeout')
      excluded_role_profiles=@(); compact_epic_participants_after_closeout=$true
      compact_warn_at_first_safe_boundary=$true
      maximum_retry_count=1;required_gates=@()
    }
  }
}
function New-LiteTelemetry([string]$Pressure = 'warn', [string]$State = 'idle') {
  [pscustomobject]@{
    pressure=[pscustomobject]@{state=$Pressure}
    session=[pscustomobject]@{state=$State}
    model=[pscustomobject]@{provider_id='provider';model_id='model'}
    policy=[pscustomobject]@{identity=('a' * 64);warn_ratio=0.5;critical_ratio=0.62}
  }
}
function New-MarkerSet([object[]]$Markers = @()) {
  [pscustomobject]@{count=$Markers.Count;digest=(Get-CompactFlowObjectIdentity -Value @($Markers));markers=@($Markers)}
}

$policy = New-LitePolicy
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry normal)).disposition 'CONTINUE' 'normal pressure'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry unknown)).disposition 'CONTINUE' 'unknown pressure'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn busy)).disposition 'WAIT_SAFE_BOUNDARY' 'warn busy'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -LifecycleIntentState PENDING).disposition 'WAIT_SAFE_BOUNDARY' 'pending lifecycle intent'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry critical) -LifecycleIntentState UNCERTAIN).disposition 'WAIT_SAFE_BOUNDARY' 'uncertain lifecycle intent'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry critical) -CompactIntentState PENDING).disposition 'WAIT_SAFE_BOUNDARY' 'pending compact intent'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn)).disposition 'AUTO_COMPACT' 'warn idle'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry critical)).disposition 'AUTO_COMPACT' 'critical idle'
$rejectedOverridePolicy = New-LitePolicy; $rejectedOverridePolicy.automatic_action_allowed = $false
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $rejectedOverridePolicy -Telemetry (New-LiteTelemetry critical)).disposition 'WAIT_SAFE_BOUNDARY' 'rejected project policy fails closed at critical pressure'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $rejectedOverridePolicy -Telemetry (New-LiteTelemetry critical)).reason 'PROJECT_POLICY_REJECTED' 'rejected project policy reports its blocking reason'
$excludedPolicy = New-LitePolicy; $excludedPolicy.effective_policy.excluded_role_profiles = @('worldsim.meta')
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $excludedPolicy -Telemetry (New-LiteTelemetry warn) -ProfileId worldsim.meta).reason 'PROFILE_EXCLUDED' 'excluded profile'
$gatedPolicy = New-LitePolicy; $gatedPolicy.effective_policy.required_gates = @('owner-ready')
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $gatedPolicy -Telemetry (New-LiteTelemetry warn)).reason 'POLICY_REQUIRED_GATES_UNSUPPORTED_BY_LITE' 'caller-supplied gates unsupported'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $gatedPolicy -Telemetry (New-LiteTelemetry warn)).disposition 'WAIT_SAFE_BOUNDARY' 'unsupported caller gates block safely'
$warnDisabledPolicy = New-LitePolicy; $warnDisabledPolicy.effective_policy.compact_warn_at_first_safe_boundary = $false
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $warnDisabledPolicy -Telemetry (New-LiteTelemetry warn)).reason 'WARN_AUTO_COMPACT_DISABLED' 'warn auto compact policy is honored'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $warnDisabledPolicy -Telemetry (New-LiteTelemetry critical)).disposition 'AUTO_COMPACT' 'warn setting does not disable critical compact'
$eventPolicy = New-LitePolicy; $eventPolicy.effective_policy.checks = @('after_stage_output')
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $eventPolicy -Telemetry (New-LiteTelemetry warn)).reason 'EVENT_NOT_SELECTED' 'event not selected'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution (New-LitePolicy ask) -Telemetry (New-LiteTelemetry warn)).reason 'OWNER_CONFIRMATION_REQUIRED' 'ask never auto compacts'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution (New-LitePolicy recommend) -Telemetry (New-LiteTelemetry warn)).reason 'COMPACT_RECOMMENDED' 'recommend never emits undeclared terminal'
$badTelemetry = New-LiteTelemetry warn; $badTelemetry.policy.identity = ('b' * 64)
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry $badTelemetry).reason 'POLICY_TELEMETRY_MISMATCH' 'policy telemetry mismatch'
$missingModel = New-LiteTelemetry warn; $missingModel.model.model_id = ''
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry $missingModel).reason 'PROVIDER_MODEL_UNAVAILABLE' 'provider model required'
Assert-LiteEqual (Get-CompactLiteDecision -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry over_limit)).reason 'OVER_LIMIT_BOUNDED_RECOVERY_ONLY' 'over-limit recovery only'

$before = New-MarkerSet
$marker = [pscustomobject]@{identity='marker-1';created_epoch_ms=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 60000}
$oneMarkerSet = New-MarkerSet @($marker)
$restoreCalls = 0
$result = Invoke-CompactLiteMachine -AttemptId attempt-1 -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { $oneMarkerSet } } -SendSummarize { [pscustomobject]@{status='success';marker_identity='marker-1'} } -Restore { $script:restoreCalls++; [pscustomobject]@{status='RESTORED';workflow_command_sent=$false} }
Assert-LiteEqual $result.disposition 'COMPACTED_RESTORED' 'verified compact restore'
Assert-LiteEqual $script:restoreCalls 1 'restore invoked once'
Assert-LiteEqual $result.workflow_command_sent $false 'no workflow command'
Assert-LiteEqual (@($result.PSObject.Properties.Name) -join '|') 'schema_version|contract|logical_session_ref|role_hint|event_type|policy_identity|pressure_state|session_state|disposition|compact_performed|marker_disposition|restore_status|workflow_command_sent|reason|privacy|retry_count|terminal' 'result fields'

$script:liteMarkerRead = 0
$script:restoreCalls = 0
$degraded = Invoke-CompactLiteMachine -AttemptId attempt-2 -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { $oneMarkerSet } } -SendSummarize { [pscustomobject]@{status='success';marker_identity='marker-1'} } -Restore { $script:restoreCalls++; [pscustomobject]@{status='DEGRADED';workflow_command_sent=$false} }
Assert-LiteEqual $degraded.disposition 'COMPACTED_DEGRADED' 'degraded restore is nonblocking'

$timeout = Invoke-CompactLiteMachine -AttemptId attempt-3 -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { $before } -SendSummarize { [pscustomobject]@{status='timeout';marker_identity=''} } -Restore { throw 'must not restore' }
Assert-LiteEqual $timeout.disposition 'COMPACT_UNCERTAIN' 'timeout uncertainty'
Assert-LiteEqual $timeout.retry_count 0 'timeout never retries'

$script:liteMarkerRead = 0; $persistedMarkerFailure = New-Object Collections.Generic.List[object]
$markerReadFailure = Invoke-CompactLiteMachine -AttemptId attempt-marker-read-failure -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { throw 'marker query failed' } } -SendSummarize { [pscustomobject]@{status='success';marker_identity='marker-1'} } -Restore { throw 'must not restore' } -Persist { param($ledger) $persistedMarkerFailure.Add($ledger) }
Assert-LiteEqual $markerReadFailure.disposition 'COMPACT_UNCERTAIN' 'post-send marker observation failure is terminal uncertainty'
Assert-LiteEqual (@($persistedMarkerFailure | ForEach-Object { $_.state }) -join '|') 'INTENT_PERSISTED|COMPACT_UNCERTAIN' 'marker observation failure persists terminal uncertainty'

$sendCount = 0; $script:liteMarkerRead = 0
$retried = Invoke-CompactLiteMachine -AttemptId attempt-4 -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -lt 2) { $before } else { $oneMarkerSet } } -SendSummarize { $script:sendCount++; if ($script:sendCount -eq 1) { [pscustomobject]@{status='rejected_before_acceptance';marker_identity=''} } else { [pscustomobject]@{status='success';marker_identity='marker-1'} } } -Restore { [pscustomobject]@{status='RESTORED';workflow_command_sent=$false} }
Assert-LiteEqual $retried.disposition 'COMPACTED_RESTORED' "single safe retry ($($retried.reason))"
Assert-LiteEqual $script:sendCount 2 'retry count bounded'

$script:liteMarkerRead = 0
$zero = Invoke-CompactLiteMachine -AttemptId attempt-5 -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { $before } -SendSummarize { [pscustomobject]@{status='success';marker_identity=''} } -Restore { throw 'must not restore' }
Assert-LiteEqual $zero.disposition 'COMPACT_UNCERTAIN' 'zero marker uncertainty'

$twoMarkers = New-MarkerSet @($marker, [pscustomobject]@{identity='marker-2';created_epoch_ms=$marker.created_epoch_ms})
$script:liteMarkerRead = 0
$multiple = Invoke-CompactLiteMachine -AttemptId attempt-6 -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { $twoMarkers } } -SendSummarize { [pscustomobject]@{status='success';marker_identity='marker-1'} } -Restore { throw 'must not restore' }
Assert-LiteEqual $multiple.disposition 'COMPACT_UNCERTAIN' 'multiple marker uncertainty'
$equalTimeMarker = New-MarkerSet @([pscustomobject]@{identity='equal-time';created_epoch_ms=1000})
Assert-LiteEqual (Get-CompactLiteMarkerAttribution $before $equalTimeMarker 1000 success equal-time).disposition 'UNCERTAIN' 'marker must be strictly after intent time'

$script:liteMarkerRead = 0
$mismatchedMarker = Invoke-CompactLiteMachine -AttemptId attempt-marker-mismatch -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { $oneMarkerSet } } -SendSummarize { [pscustomobject]@{status='success';marker_identity='different-marker'} } -Restore { throw 'must not restore' }
Assert-LiteEqual $mismatchedMarker.disposition 'COMPACT_UNCERTAIN' 'response marker identity mismatch'

$script:liteMarkerRead = 0; $script:sendCount = 0
$changedBeforeRetry = Invoke-CompactLiteMachine -AttemptId attempt-retry-changed -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { $oneMarkerSet } } -SendSummarize { $script:sendCount++; [pscustomobject]@{status='rejected_before_acceptance';marker_identity=''} } -Restore { throw 'must not restore' }
Assert-LiteEqual $changedBeforeRetry.disposition 'COMPACT_UNCERTAIN' 'changed marker is uncertain'
Assert-LiteEqual $script:sendCount 1 'changed marker prevents second send'

$script:liteMarkerRead = 0; $persisted = New-Object Collections.Generic.List[object]
$restoreUncertain = Invoke-CompactLiteMachine -AttemptId attempt-restore-uncertain -ProfileId worldsim.meta -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyResolution $policy -Telemetry (New-LiteTelemetry warn) -GetMarkers { if ($script:liteMarkerRead++ -eq 0) { $before } else { $oneMarkerSet } } -SendSummarize { [pscustomobject]@{status='success';marker_identity='marker-1'} } -Restore { throw 'restore timeout' } -Persist { param($ledger) $persisted.Add($ledger) }
Assert-LiteEqual $restoreUncertain.disposition 'COMPACT_UNCERTAIN' 'restore uncertainty'
Assert-LiteEqual $restoreUncertain.compact_performed $true 'restore uncertainty preserves compact fact'
Assert-LiteEqual (@($persisted | ForEach-Object { $_.state }) -join '|') 'INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING|RESTORE_UNCERTAIN' 'durable transition callbacks'
Assert-LiteTrue (@($persisted | Where-Object { $_.marker_identity -eq 'marker-1' }).Count -eq 0) 'raw marker identity is never persisted'
Assert-LiteTrue (@($persisted | Where-Object { $_.marker_identity -match '^sha256:[a-f0-9]{64}$' }).Count -eq 3) 'durable marker identity is hashed'

$intent = New-CompactLiteIntent -AttemptId attempt-7 -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyIdentity ('a' * 64) -ProviderId provider -ModelId model -MarkerBaselineDigest ('b' * 64)
$intentJson = $intent | ConvertTo-Json -Depth 10 -Compress
Assert-LiteTrue (-not ($intentJson -match '"(session_id|credential|endpoint|port|transcript|route_body|target_root|next_command)"\s*:')) 'intent privacy'
Assert-LiteEqual (@($intent.PSObject.Properties.Name) -join '|') 'schema_version|contract|attempt_id|logical_session_ref|role_hint|event_type|policy_identity|provider_identity|model_identity|marker_baseline_digest|created_utc|transport_state' 'minimal intent fields'
Assert-LiteTrue ([string]$intent.provider_identity -match '^sha256:[a-f0-9]{64}$' -and [string]$intent.model_identity -match '^sha256:[a-f0-9]{64}$') 'provider/model are durable only as hashes'
Assert-LiteTrue (-not ($intentJson -match '"provider"|"model"')) 'raw provider/model values are not durable'
Assert-LiteThrows { New-CompactLiteIntent -AttemptId unsafe-model -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyIdentity ('a' * 64) -ProviderId provider -ModelId 'secret-token' -MarkerBaselineDigest ('b' * 64) } 'provider/model identity has an unsafe shape' 'credential-shaped model rejected before persistence'

$settledPriorIntent = New-CompactLiteIntent -AttemptId prior-settled -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyIdentity ('a' * 64) -ProviderId provider -ModelId model -MarkerBaselineDigest ('b' * 64)
$settledPriorResult = New-CompactLiteResult meta 'Meta Coordinator' before_dispatch $policy (New-LiteTelemetry warn) COMPACTED_RESTORED settled $true ONE_NEW_ATTRIBUTED RESTORED
$settledPriorLedger = Merge-CompactLiteLedgerTransition $null (New-CompactLiteLedger prior-settled INTENT_PERSISTED $settledPriorIntent)
$settledPriorLedger = Merge-CompactLiteLedgerTransition $settledPriorLedger (New-CompactLiteLedger prior-settled MARKER_VERIFIED $settledPriorIntent $null ('sha256:' + ('c' * 64)))
$settledPriorLedger = Merge-CompactLiteLedgerTransition $settledPriorLedger (New-CompactLiteLedger prior-settled RESTORE_PENDING $settledPriorIntent $null ('sha256:' + ('c' * 64)))
$settledPriorLedger = Merge-CompactLiteLedgerTransition $settledPriorLedger (New-CompactLiteLedger prior-settled COMPACTED_RESTORED $settledPriorIntent $settledPriorResult ('sha256:' + ('c' * 64)))
Assert-LiteEqual (Get-CompactLitePriorDisposition -PriorRun $settledPriorLedger).disposition 'ALREADY_COMPACTED' 'settled duplicate'
$uncertainPriorResult = New-CompactLiteResult meta 'Meta Coordinator' before_dispatch $policy (New-LiteTelemetry warn) COMPACT_UNCERTAIN uncertain $false marker NOT_ATTEMPTED
$uncertainPriorLedger = Merge-CompactLiteLedgerTransition $null (New-CompactLiteLedger prior-settled INTENT_PERSISTED $settledPriorIntent)
$uncertainPriorLedger = Merge-CompactLiteLedgerTransition $uncertainPriorLedger (New-CompactLiteLedger prior-settled COMPACT_UNCERTAIN $settledPriorIntent $uncertainPriorResult)
Assert-LiteEqual (Get-CompactLitePriorDisposition -PriorRun $uncertainPriorLedger).disposition 'COMPACT_UNCERTAIN' 'uncertain prior result'
Assert-LiteEqual (Get-CompactLitePriorDisposition -PriorRun ([pscustomobject]@{terminal=$true;state='FUTURE'})).reason 'PRIOR_LEDGER_MALFORMED' 'malformed prior ledger fails closed'
$illegalTerminal = $settledPriorLedger | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$illegalTerminal.result.compact_performed = $false
Assert-LiteTrue (-not (Test-CompactLiteLedgerShape $illegalTerminal)) 'terminal result/state mismatch fails closed'
$illegalTransition = $settledPriorLedger | ConvertTo-Json -Depth 20 | ConvertFrom-Json
$illegalTransition.transitions[1].state = 'RESTORE_PENDING'
Assert-LiteTrue (-not (Test-CompactLiteLedgerShape $illegalTransition)) 'illegal transition order fails closed'
Assert-LiteEqual (Get-CompactLitePriorDisposition -PriorRun $null).disposition 'READY' 'new attempt remains eligible'

$mergedLedger = $null
foreach ($ledger in $persisted) { $mergedLedger = Merge-CompactLiteLedgerTransition $mergedLedger $ledger }
Assert-LiteEqual (@($mergedLedger.transitions | ForEach-Object { $_.state }) -join '|') 'INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING|RESTORE_UNCERTAIN' 'ledger transition history'
Assert-LiteThrows { $otherIntent = New-CompactLiteIntent -AttemptId other-attempt -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyIdentity ('a' * 64) -ProviderId provider -ModelId model -MarkerBaselineDigest ('b' * 64); Merge-CompactLiteLedgerTransition $mergedLedger (New-CompactLiteLedger other-attempt INTENT_PERSISTED $otherIntent) } 'attempt identity changed' 'ledger attempt drift'

$restoredBasis = 'After-Compact procedure; role runbook; target bootloader; target state'
$parsedRestore = Get-CompactLiteRestoreReport -ExpectedProject worldsim -ExpectedRole 'Meta Coordinator' -Text "AFTER COMPACT RESTORE`nProject: worldsim`nRole: Meta Coordinator`nRestore status: RESTORED`nLoaded basis: $restoredBasis`nUnavailable or warnings: none`nCurrent phase: SEQ_NEXT`nDeclared next actor / command: Meta Coordinator / /seq-next`nWorkflow command sent: false"
Assert-LiteEqual $parsedRestore.status 'RESTORED' 'strict restore output parser'
Assert-LiteThrows { Get-CompactLiteRestoreReport -ExpectedProject worldsim -ExpectedRole 'Meta Coordinator' -Text "AFTER COMPACT RESTORE`nProject: worldsim`nRole: Meta Coordinator`nRestore status: RESTORED`nLoaded basis: Canon and state`nUnavailable or warnings: none`nCurrent phase: SEQ_NEXT`nDeclared next actor / command: Meta Coordinator / /seq-next`nWorkflow command sent: false" } 'lacks required loaded basis' 'RESTORED requires concrete basis'
Assert-LiteThrows { Get-CompactLiteRestoreReport -ExpectedProject worldsim -ExpectedRole 'Meta Coordinator' -Text "AFTER COMPACT RESTORE`nProject: worldsim`nRole: Meta Coordinator`nRestore status: RESTORED`nLoaded basis: $restoredBasis`nUnavailable or warnings: state drift`nCurrent phase: SEQ_NEXT`nDeclared next actor / command: Meta Coordinator / /seq-next`nWorkflow command sent: false" } 'cannot retain warnings' 'RESTORED cannot carry warnings'
$oldOutputRejected = $false
try { $null = Get-CompactLiteRestoreReport -ExpectedProject worldsim -ExpectedRole 'Meta Coordinator' -Text "Hydration action: ROUTE_READY`nWorkflow command sent: false" } catch { $oldOutputRejected = $true }
Assert-LiteTrue $oldOutputRejected 'old route-ready output rejected'
$extraOutputRejected = $false
try { $null = Get-CompactLiteRestoreReport -ExpectedProject worldsim -ExpectedRole 'Meta Coordinator' -Text "AFTER COMPACT RESTORE`nProject: worldsim`nRole: Meta Coordinator`nRestore status: RESTORED`nLoaded basis: $restoredBasis`nUnavailable or warnings: none`nCurrent phase: SEQ_NEXT`nDeclared next actor / command: Meta Coordinator / /seq-next`nWorkflow command sent: false`nReadiness: READY" } catch { $extraOutputRejected = $true }
Assert-LiteTrue $extraOutputRejected 'extra restore output rejected'
Assert-LiteThrows { Get-CompactLiteRestoreReport -ExpectedProject worldsim -ExpectedRole 'Track B' -Text "AFTER COMPACT RESTORE`nProject: worldsim`nRole: Meta Coordinator`nRestore status: RESTORED`nLoaded basis: $restoredBasis`nUnavailable or warnings: none`nCurrent phase: SEQ_NEXT`nDeclared next actor / command: Meta Coordinator / /seq-next`nWorkflow command sent: false" } 'role does not match' 'restore role mismatch'

$invokerPath = Join-Path $PSScriptRoot 'invoke-session-compact-lite.ps1'
$invokerSource = Get-Content -Raw -LiteralPath $invokerPath
$invokerCommandCalls = [regex]::Matches($invokerSource, '(?:New-OCRouterCommandRequestBodyObject|&\$newCommandRequest)\s+-Command\s+([A-Za-z0-9-]+)')
Assert-LiteEqual $invokerCommandCalls.Count 1 'one command call exists in active Lite invoker'
if ($invokerCommandCalls.Count -eq 1) { Assert-LiteEqual $invokerCommandCalls[0].Groups[1].Value 'after-compact' 'active Lite command is after-compact only' }
Assert-LiteTrue (-not ($invokerSource -match '(?i)\$(?:EventPath|ActiveRoute|CompactBoundary|Combined|HydrationBudget|RouteInput|NextCommand)\b')) 'no retired route or hydration gate input in active invoker'
Assert-LiteTrue (-not ($invokerSource -match "-Command\s+(?:seq-next|implement|terv-review|step-review|closeout-commit|fal-checkpoint-target)\b")) 'no lifecycle command dispatch in active invoker'
Assert-LiteTrue (-not ($invokerSource -match 'code-ge400|rejected_before_acceptance')) 'HTTP failures never claim proven pre-acceptance rejection'
Assert-LiteTrue ($invokerSource.Contains("'resolve-compact-authority'") -and $invokerSource.Contains("'consume-compact-authority'") -and $invokerSource.Contains('Assert-CompactLiteProtectedAuthorityStable')) 'non-dry Compact resolves, consumes, and revalidates protected authority'
Assert-LiteTrue ($invokerSource.Contains('Enter-OCRouterParticipantTransportLock -RunDir $routerRoot -PrivateSessionId $sessionId')) 'active Compact fence derives from the exact private session identity'
$unexpectedV2Callers = @()
foreach ($sourceFile in @(Get-ChildItem -LiteralPath $PSScriptRoot -File -Filter '*.ps1')) {
  if ($sourceFile.Name -in @('invoke-session-compact-flow.ps1','test-session-compact-flow.ps1')) { continue }
  if ([IO.File]::ReadAllText($sourceFile.FullName) -match '(?m)(?:&\s*\(?\s*Join-Path|powershell(?:\.exe)?\b|-File\s+).*invoke-session-compact-flow\.ps1') { $unexpectedV2Callers += $sourceFile.Name }
}
Assert-LiteEqual $unexpectedV2Callers.Count 0 'no active router source calls retained V2 invoker'
$tokens = $null; $parseErrors = $null
$invokerAst = [Management.Automation.Language.Parser]::ParseFile($invokerPath, [ref]$tokens, [ref]$parseErrors)
foreach ($functionName in @('Resolve-CompactLiteLocalRoot','Read-CompactLitePinnedLocalJsonFile','Resolve-CompactLitePolicy','Assert-CompactLiteCloseoutProof','Get-CompactLiteSessionId','Test-CompactLiteParticipantReference','Get-CompactLiteLifecycleIntentState','Get-CompactLiteParticipantCompactState','Get-CompactLiteResponseIdentity','Assert-CompactLiteAdmission')) {
  $definition = @($invokerAst.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $functionName }, $true))
  if ($definition.Count -ne 1) { $failures.Add("invoker helper '$functionName' missing or ambiguous."); continue }
  . ([scriptblock]::Create($definition[0].Extent.Text))
}

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ("compact-lite-test-" + [guid]::NewGuid().ToString('N'))
try {
  $routerFixture = Join-Path $fixtureRoot '.opencode-router'
  $canonFixture = Join-Path $fixtureRoot 'canon'
  [void](New-Item -ItemType Directory -Path (Join-Path $routerFixture 'packet-runs') -Force)
  [void](New-Item -ItemType Directory -Path (Join-Path $routerFixture 'inflight') -Force)
  [void](New-Item -ItemType Directory -Path (Join-Path $canonFixture 'registry\projects') -Force)
  [IO.File]::WriteAllText((Join-Path $routerFixture 'packet-runs\pending.json'), '{"status":"pending","to":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'PENDING' 'packet-runs to-field pending intent'
  [IO.File]::WriteAllText((Join-Path $routerFixture 'packet-runs\pending.json'), '{"status":"dispatched","transport_status":"accepted","to":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'SETTLED' 'accepted dispatch settles intent'
  [IO.File]::WriteAllText((Join-Path $routerFixture 'inflight\uncertain.json'), '{"status":"pending","transport_status":"uncertain","recipient":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'UNCERTAIN' 'inflight uncertain transport'
  [IO.File]::WriteAllText((Join-Path $routerFixture 'inflight\uncertain.json'), '{"status":"future_state","recipient":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'UNCERTAIN' 'unknown relevant intent fails closed'
  Remove-Item -LiteralPath (Join-Path $routerFixture 'inflight\uncertain.json') -Force
  [void](New-Item -ItemType Directory -Path (Join-Path $routerFixture 'outbox') -Force)
  [IO.File]::WriteAllText((Join-Path $routerFixture 'outbox\pending.json'), '{"status":"pending","recipient":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'PENDING' 'outbox pending intent is scanned'
  Remove-Item -LiteralPath (Join-Path $routerFixture 'outbox\pending.json') -Force
  $transportLock=Enter-OCRouterParticipantTransportLock -RunDir $routerFixture -Participant meta
  try {
    Assert-LiteThrows { Start-OCRouterDispatchIntent -RunDir (Join-Path $routerFixture 'packet-runs') -Transition race-fixture -Recipient meta -Kind command -Operation implement -Payload payload -BaselineIdentity baseline -CandidateIdentity candidate -Stage stage } 'locked by Compact or lifecycle dispatch' 'dispatch cannot cross compact transport mutex'
    $commonLiteral=(Join-Path $PSScriptRoot 'oc-router-common.ps1').Replace("'","''");$routerLiteral=$routerFixture.Replace("'","''")
    $oldErrorActionPreference=$ErrorActionPreference;try{$ErrorActionPreference='Continue';$sameParticipantOutput=@(& powershell.exe -NoProfile -Command ". '$commonLiteral'; try { `$childLock=Enter-OCRouterParticipantTransportLock -RunDir '$routerLiteral' -Participant meta; `$childLock.Dispose(); exit 0 } catch { Write-Output `$_.Exception.Message; exit 23 }" 2>&1);$sameParticipantExit=$LASTEXITCODE;$otherParticipantOutput=@(& powershell.exe -NoProfile -Command ". '$commonLiteral'; try { `$childLock=Enter-OCRouterParticipantTransportLock -RunDir '$routerLiteral' -Participant track-b; `$childLock.Dispose(); exit 0 } catch { Write-Output `$_.Exception.Message; exit 24 }" 2>&1);$otherParticipantExit=$LASTEXITCODE}finally{$ErrorActionPreference=$oldErrorActionPreference}
    Assert-LiteTrue ($sameParticipantExit -eq 23 -and ($sameParticipantOutput -join "`n") -match 'locked by Compact or lifecycle dispatch') 'same participant is excluded across a child process'
    Assert-LiteTrue ($otherParticipantExit -eq 0) ('different participant proceeds across a child process: '+($otherParticipantOutput -join "`n"))
  }
  finally { $transportLock.Dispose() }
  $otherParticipantLock=Enter-OCRouterParticipantTransportLock -RunDir $routerFixture -Participant meta
  try{$otherIntent=Start-OCRouterDispatchIntent -RunDir (Join-Path $routerFixture 'packet-runs\other-participant') -Transition other-race-fixture -Recipient track-b -Kind command -Operation implement -Payload payload -BaselineIdentity baseline -CandidateIdentity candidate -Stage stage;Assert-LiteTrue $otherIntent.should_send 'different participant dispatch proceeds while meta compact lock is held'}finally{$otherParticipantLock.Dispose()}
  Assert-LiteTrue ($null -eq (Enter-OCRouterParticipantTransportLock -RunDir (Join-Path $fixtureRoot 'ordinary\missing-run') -Participant meta)) 'transport lock ancestor scan terminates at the drive root when no router root exists'
  $senderSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'send-message.ps1'))
  Assert-LiteTrue ($senderSource.Contains('Enter-OCRouterParticipantTransportLock') -and $senderSource.Contains('Start-OCRouterDispatchIntentCore') -and $senderSource.Contains('Complete-OCRouterDispatchIntent')) 'direct message sender uses participant exclusion and durable intent'
  $guardFixture=Join-Path $fixtureRoot 'guarded-router-root';[void](New-Item -ItemType Directory -Path $guardFixture)
  $guard=Open-CompactFlowDirectoryGuard -Path $guardFixture
  try{$renameBlocked=$false;try{Rename-Item -LiteralPath $guardFixture -NewName 'replaced-router-root'}catch{$renameBlocked=$true};Assert-LiteTrue $renameBlocked 'held directory guard prevents split-lock replacement';if(-not$renameBlocked){Rename-Item -LiteralPath (Join-Path $fixtureRoot 'replaced-router-root') -NewName 'guarded-router-root'}}finally{$guard.Dispose()}
  [void](New-Item -ItemType Directory -Path (Join-Path $routerFixture 'compact-runs') -Force)
  [IO.File]::WriteAllText((Join-Path $routerFixture 'compact-runs\retained.json'), '{"schema_version":"compact-run-ledger/v1","runs":[{"logical_session_ref":"meta","state":"UNCERTAIN","terminal":true}]}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'UNCERTAIN' 'retained V2 uncertainty is scanned'
  [IO.File]::WriteAllText((Join-Path $routerFixture 'compact-runs\retained.json'), '{"schema_version":"compact-run-ledger/v1","runs":[{"logical_session_ref":"meta","state":"INTENT_PERSISTED","terminal":false}]}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'PENDING' 'retained V2 pending intent is scanned'
  Remove-Item -LiteralPath (Join-Path $routerFixture 'compact-runs') -Recurse -Force
  $aggregateParticipantDir=Join-Path $routerFixture 'compact-lite-runs\aggregate';[void](New-Item -ItemType Directory -Path $aggregateParticipantDir -Force)
  foreach($index in 1..9){[IO.File]::WriteAllText((Join-Path $aggregateParticipantDir ("bulk-$index.json")),('{}'+(' '*950000)),(New-Object Text.UTF8Encoding($false)))}
  Assert-LiteEqual (Get-CompactLiteParticipantCompactState $aggregateParticipantDir) 'UNCERTAIN' 'participant aggregate evidence bytes are bounded before parse'
  Remove-Item -LiteralPath $aggregateParticipantDir -Recurse -Force
  [IO.File]::WriteAllText((Join-Path $routerFixture 'packet-runs\oversized.json'), (' ' * 1048577), (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'UNCERTAIN' 'oversized intent evidence fails closed before JSON allocation'
  Remove-Item -LiteralPath (Join-Path $routerFixture 'packet-runs\oversized.json') -Force
  [void](New-Item -ItemType Directory -Path (Join-Path $routerFixture 'plan-review-runs\nested') -Force)
  [IO.File]::WriteAllText((Join-Path $routerFixture 'plan-review-runs\nested\intent.json'), '{"status":"pending","recipient":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'PENDING' 'plan-review run intent is scanned'
  Remove-Item -LiteralPath (Join-Path $routerFixture 'plan-review-runs') -Recurse -Force
  [void](New-Item -ItemType Directory -Path (Join-Path $routerFixture 'parallel-runs\nested') -Force)
  [IO.File]::WriteAllText((Join-Path $routerFixture 'parallel-runs\nested\intent.json'), '{"status":"pending","to":"meta"}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteEqual (Get-CompactLiteLifecycleIntentState $routerFixture meta) 'PENDING' 'parallel run intent is scanned'
  Remove-Item -LiteralPath (Join-Path $routerFixture 'parallel-runs') -Recurse -Force
  Assert-LiteEqual (Get-CompactLiteResponseIdentity ([pscustomobject]@{compactionId='marker-response'})) 'marker-response' 'response marker identity'
  Assert-LiteEqual (Get-CompactLiteSessionId ([pscustomobject]@{sessionId='runtime-session'})) 'runtime-session' 'session mapping shape'
  [IO.File]::WriteAllText((Join-Path $fixtureRoot 'AGENTS.md'), 'WorldSim fixture root', (New-Object Text.UTF8Encoding($false)))
  [void](New-Item -ItemType Directory -Path (Join-Path $canonFixture 'canon') -Force)
  $contractFixturePath=Join-Path $canonFixture 'canon\CANONICAL-CONTRACT.json'
  $profileFixturePath=Join-Path $canonFixture 'registry\projects\worldsim.json'
  [IO.File]::WriteAllText($contractFixturePath, '{"canon_version":"4.0.0","compact_lite_contract":{"contract":"opencode-compact-lite/v1","active_path_after_apply":"COMPACT_LITE_ONLY"}}', (New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($profileFixturePath, '{"schema_version":"2","project_id":"worldsim","synchronization_identity":"worldsim-compact-lite-v1","enrollment_status":"LEGACY_VALIDATED","canon_compatibility":{"maximum_major_version":4},"root_locator":{"markers":[{"path":"AGENTS.md","contains":"WorldSim"}]},"profiles":[{"profile_id":"worldsim.meta","base_capability":"META"}]}', (New-Object Text.UTF8Encoding($false)))
  $contractFixtureSha=(Get-FileHash -LiteralPath $contractFixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $profileFixtureSha=(Get-FileHash -LiteralPath $profileFixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-CompactLiteAdmission $canonFixture $fixtureRoot worldsim worldsim.meta meta 'Meta Coordinator' $contractFixtureSha $profileFixtureSha
  Assert-LiteThrows { Assert-CompactLiteAdmission $canonFixture $fixtureRoot worldsim worldsim.meta track-a 'Meta Coordinator' $contractFixtureSha $profileFixtureSha } 'Logical participant does not match' 'profile-role cannot target another participant session'
  Assert-LiteThrows { Assert-CompactLiteAdmission $canonFixture $fixtureRoot worldsim worldsim.meta meta 'Track B' $contractFixtureSha $profileFixtureSha } 'Role hint does not match' 'profile-role admission mismatch'
  $worldsimProfile=Get-Content -Raw -LiteralPath $profileFixturePath|ConvertFrom-Json;$worldsimProfile.profiles=@($worldsimProfile.profiles)+@([pscustomobject]@{profile_id='worldsim.track-a';base_capability='DELIVERY';accountable_lane='TRACK_A'});[IO.File]::WriteAllText($profileFixturePath,($worldsimProfile|ConvertTo-Json -Depth 20 -Compress),(New-Object Text.UTF8Encoding($false)));$profileFixtureSha=(Get-FileHash -LiteralPath $profileFixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-LiteThrows { Assert-CompactLiteAdmission $canonFixture $fixtureRoot worldsim worldsim.track-a track-a 'Track B' $contractFixtureSha $profileFixtureSha } 'exact admitted profile' 'cross-track role hint is rejected'
  [IO.File]::WriteAllText((Join-Path $fixtureRoot 'AGENTS.md'), 'Different project', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteThrows { Assert-CompactLiteAdmission $canonFixture $fixtureRoot worldsim worldsim.meta meta 'Meta Coordinator' $contractFixtureSha $profileFixtureSha } 'Target root does not match' 'target root marker mismatch'
  [IO.File]::WriteAllText((Join-Path $fixtureRoot 'AGENTS.md'), 'WorldSim fixture root', (New-Object Text.UTF8Encoding($false)))

  Remove-Item -LiteralPath (Join-Path $routerFixture 'packet-runs\pending.json') -Force
  [IO.File]::WriteAllText((Join-Path $routerFixture 'sessions.json'), '{"server":"https://example.invalid","sessions":{"meta":{"sessionId":"runtime-session"}}}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteThrows { Get-OCRouterConfig -RouterDir $routerFixture } 'literal 127.0.0.1 endpoint' 'untrusted router config cannot redirect credentials off loopback'
  [IO.File]::WriteAllText((Join-Path $routerFixture 'sessions.json'), '{"server":"http://127.0.0.1:4096","sessions":{"meta":{"sessionId":"runtime-session"}}}', (New-Object Text.UTF8Encoding($false)))
Assert-LiteEqual $PSDefaultParameterValues['Invoke-RestMethod:MaximumRedirection'] 0 'all common router REST calls default to no redirects'
  $routePacketSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'route-packet.ps1'))
  Assert-LiteTrue ($routePacketSource.Contains('Get-OCRouterConfig -RouterDir $RouterDir') -and -not $routePacketSource.Contains('Get-Content $SessionsPath -Raw | ConvertFrom-Json')) 'route-packet cannot bypass the loopback-validating config loader'
  $globalPolicyFixture = Join-Path $fixtureRoot 'compact-policy.json'
  [IO.File]::WriteAllText($globalPolicyFixture, '{"schema_version":"1","contract":"opencode-compact-policy/v1","scope":"global","mode":"auto_safe","checks":["before_dispatch","after_stage_output","epic_closeout"],"warn_ratio":0.5,"critical_ratio":0.62,"compact_warn_at_first_safe_boundary":true,"block_long_stage_at_critical":true,"compact_epic_participants_after_closeout":true,"safe_boundary_required":true,"maximum_retry_count":1,"project_override":"tighten_only","excluded_role_profiles":[],"required_gates":[]}', (New-Object Text.UTF8Encoding($false)))
  $globalPolicyFixtureSha=(Get-FileHash -LiteralPath $globalPolicyFixture -Algorithm SHA256).Hash.ToLowerInvariant()
  $fixtureScripts = Join-Path $fixtureRoot 'scripts'
  [void](New-Item -ItemType Directory -Path $fixtureScripts)
  Copy-Item -Path (Join-Path $PSScriptRoot '*.ps1') -Destination $fixtureScripts
  $telemetryStub = @'
[CmdletBinding()]
param([string]$SessionId,[string]$Server,[double]$WarnRatio,[double]$CriticalRatio,[string]$PolicyIdentity)
[pscustomobject]@{pressure=[pscustomobject]@{state='warn'};session=[pscustomobject]@{state='idle'};model=[pscustomobject]@{provider_id='provider';model_id='model'};policy=[pscustomobject]@{identity=$PolicyIdentity;warn_ratio=$WarnRatio;critical_ratio=$CriticalRatio}}|ConvertTo-Json -Depth 10 -Compress
'@
  [IO.File]::WriteAllText((Join-Path $fixtureScripts 'session-context-status.ps1'), $telemetryStub, (New-Object Text.UTF8Encoding($false)))
  $fixtureInvoker = Join-Path $fixtureScripts 'invoke-session-compact-lite.ps1'
  $invokeArgs = @{ProjectId='worldsim';ProfileId='worldsim.meta';AttemptId='dry-run';TargetRoot=$fixtureRoot;CanonRoot=$canonFixture;CanonContractSha256=$contractFixtureSha;ProjectProfileSha256=$profileFixtureSha;Target='meta';RoleHint='Meta Coordinator';EventType='before_dispatch';Server='http://127.0.0.1:4096';GlobalPolicyPath=$globalPolicyFixture;GlobalPolicySha256=$globalPolicyFixtureSha;DryRun=$true;TestOnlyLegacyAuthority=$true}
  $installedLegacyArgs=@{}+$invokeArgs;$installedLegacyArgs.Remove('DryRun')
  Assert-LiteThrows { & $invokerPath @installedLegacyArgs } 'restricted to temporary copied fixtures' 'installed active Compact cannot select target-local legacy authority'
  $dryResult = ([string](& $fixtureInvoker @invokeArgs) | ConvertFrom-Json)
  Assert-LiteEqual $dryResult.disposition 'WAIT_SAFE_BOUNDARY' 'dry-run uses declared terminal'
  Assert-LiteEqual $dryResult.reason 'DRY_RUN_WOULD_AUTO_COMPACT' 'dry-run reports would-compact'
  Assert-LiteEqual $dryResult.workflow_command_sent $false 'dry-run never dispatches workflow'
  Assert-LiteTrue (-not (($dryResult | ConvertTo-Json -Depth 10 -Compress) -match 'runtime-session|127\.0\.0\.1|4096')) 'invoker result privacy'
  $invalidServerArgs = @{} + $invokeArgs; $invalidServerArgs.Server = 'http://127.0.0.1:70000'
  Assert-LiteThrows { & $fixtureInvoker @invalidServerArgs } 'explicit independently supplied loopback endpoint' 'invalid server rejected'
  $localhostArgs = @{} + $invokeArgs; $localhostArgs.Server = 'http://localhost:4096'
  Assert-LiteThrows { & $fixtureInvoker @localhostArgs } 'explicit independently supplied loopback endpoint' 'hostname loopback rejected'
  $closeoutArgs = @{} + $invokeArgs; $closeoutArgs.EventType = 'epic_closeout'
  Assert-LiteThrows { & $fixtureInvoker @closeoutArgs } 'pinned candidate-bound CLOSED receipt' 'closeout requires interface proof'
  $closeoutReceipt = Join-Path $fixtureRoot 'closeout-receipt.md'
  [IO.File]::WriteAllText($closeoutReceipt, "# Closeout`nrouting_verdict: CLOSED`n", (New-Object Text.UTF8Encoding($false)))
  $closeoutArgs.CloseoutReceiptPath = 'closeout-receipt.md'
  $closeoutArgs.CloseoutReceiptSha256 = (Get-FileHash -LiteralPath $closeoutReceipt -Algorithm SHA256).Hash.ToLowerInvariant()
  $closeoutArgs.CloseoutCandidateId = 'closeout-candidate'
  Assert-LiteThrows { & $fixtureInvoker @closeoutArgs } 'canonical closeout output contract' 'two-line closeout prose rejected'
  $closeoutText=@('CLOSEOUT + COMMIT RESULT','Target: worldsim','Epic: fixture-epic','Accountable Lane / class / profile: Delivery / SPECIALIST_DELIVERY / fixture','workflow_verdict: COMPLETE','domain_verdict: ACCEPTED','routing_verdict: CLOSED','next_role_action: NONE','State/Combined/findings/evidence reconciliation: result=PASS; details=reconciled','Candidate identity: closeout-candidate','Staged explicit paths: NONE','Verification: result=PASS; candidate=closeout-candidate; committed_tree=NOT_APPLICABLE; details=verified','Commit: NO_COMMIT reason=maintenance','Push: NOT_PERFORMED')-join"`n"
  [IO.File]::WriteAllText($closeoutReceipt, $closeoutText, (New-Object Text.UTF8Encoding($false)))
  $closeoutArgs.CloseoutReceiptSha256 = (Get-FileHash -LiteralPath $closeoutReceipt -Algorithm SHA256).Hash.ToLowerInvariant()
  $heldCloseout=Assert-CompactLiteCloseoutProof $fixtureRoot worldsim epic_closeout 'closeout-receipt.md' $closeoutArgs.CloseoutReceiptSha256 closeout-candidate
  try { $closeoutReplacementBlocked=$false;try{[IO.File]::WriteAllText($closeoutReceipt,'replacement')}catch{$closeoutReplacementBlocked=$true};Assert-LiteTrue $closeoutReplacementBlocked 'closeout snapshot remains pinned against replacement' }
  finally { $heldCloseout.stream.Dispose() }
  $closeoutResult = ([string](& $fixtureInvoker @closeoutArgs) | ConvertFrom-Json)
  Assert-LiteEqual $closeoutResult.reason 'DRY_RUN_WOULD_AUTO_COMPACT' 'pinned CLOSED receipt admits closeout evaluation'

  [IO.File]::WriteAllText((Join-Path $routerFixture 'sessions.json'), '{"server":"http://127.0.0.1:4096","sessions":{"meta":{"sessionId":"runtime-session"},"alias":{"sessionId":"runtime-session"}}}', (New-Object Text.UTF8Encoding($false)))
  Assert-LiteThrows { & $fixtureInvoker @invokeArgs } 'Multiple logical participants map' 'duplicate runtime mapping rejected'
  [IO.File]::WriteAllText((Join-Path $routerFixture 'sessions.json'), '{"server":"http://127.0.0.1:4096","sessions":{"meta":{"sessionId":"runtime-session"}}}', (New-Object Text.UTF8Encoding($false)))

  $runRoot = Join-Path $routerFixture 'compact-lite-runs'
  [void](New-Item -ItemType Directory -Path $runRoot -Force)
  $lock = [IO.File]::Open((Join-Path $runRoot 'meta.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  try {
    $lockedArgs = @{} + $invokeArgs; $lockedArgs.Remove('DryRun'); $lockedArgs.AttemptId = 'lock-attempt'
    $lockedResult = ([string](& $fixtureInvoker @lockedArgs) | ConvertFrom-Json)
    Assert-LiteEqual $lockedResult.reason 'PARTICIPANT_COMPACT_LOCKED' 'participant lock prevents concurrent summarize'
    Assert-LiteEqual $lockedResult.compact_performed $false 'locked invocation does not compact'
  }
  finally { $lock.Dispose() }

  $priorAttemptDir = Join-Path $runRoot 'meta'
  [void](New-Item -ItemType Directory -Path $priorAttemptDir -Force)
  $settledIntent = New-CompactLiteIntent -AttemptId settled-attempt -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyIdentity ('a' * 64) -ProviderId provider -ModelId model -MarkerBaselineDigest ('b' * 64)
  $settledCompactResult = New-CompactLiteResult meta 'Meta Coordinator' before_dispatch (New-LitePolicy) (New-LiteTelemetry warn) COMPACTED_RESTORED ONE_MARKER_AND_ONE_ROLE_RESTORE $true ONE_NEW_ATTRIBUTED RESTORED
  $priorAttempt = Merge-CompactLiteLedgerTransition $null (New-CompactLiteLedger settled-attempt INTENT_PERSISTED $settledIntent)
  $priorAttempt = Merge-CompactLiteLedgerTransition $priorAttempt (New-CompactLiteLedger settled-attempt MARKER_VERIFIED $settledIntent $null ('sha256:' + ('c' * 64)))
  $priorAttempt = Merge-CompactLiteLedgerTransition $priorAttempt (New-CompactLiteLedger settled-attempt RESTORE_PENDING $settledIntent $null ('sha256:' + ('c' * 64)))
  $priorAttempt = Merge-CompactLiteLedgerTransition $priorAttempt (New-CompactLiteLedger settled-attempt COMPACTED_RESTORED $settledIntent $settledCompactResult ('sha256:' + ('c' * 64)))
  [IO.File]::WriteAllText((Join-Path $priorAttemptDir 'settled-attempt.json'), ($priorAttempt | ConvertTo-Json -Depth 10 -Compress), (New-Object Text.UTF8Encoding($false)))
  $settledArgs = @{} + $invokeArgs; $settledArgs.Remove('DryRun'); $settledArgs.AttemptId = 'settled-attempt'
  $settledResult = ([string](& $fixtureInvoker @settledArgs) | ConvertFrom-Json)
  Assert-LiteEqual $settledResult.disposition 'ALREADY_COMPACTED' 'same attempt is idempotent'
  Assert-LiteEqual $settledResult.compact_performed $true 'same attempt preserves compact result'

  $uncertainIntent = New-CompactLiteIntent -AttemptId uncertain-attempt -LogicalSessionRef meta -RoleHint 'Meta Coordinator' -EventType before_dispatch -PolicyIdentity ('a' * 64) -ProviderId provider -ModelId model -MarkerBaselineDigest ('b' * 64)
  $uncertainResult = New-CompactLiteResult meta 'Meta Coordinator' before_dispatch (New-LitePolicy) (New-LiteTelemetry warn) COMPACT_UNCERTAIN TRANSPORT_COMPLETION_UNCERTAIN $false UNATTRIBUTABLE NOT_ATTEMPTED
  $uncertainLedger = Merge-CompactLiteLedgerTransition $null (New-CompactLiteLedger uncertain-attempt INTENT_PERSISTED $uncertainIntent)
  $uncertainLedger = Merge-CompactLiteLedgerTransition $uncertainLedger (New-CompactLiteLedger uncertain-attempt COMPACT_UNCERTAIN $uncertainIntent $uncertainResult)
  [IO.File]::WriteAllText((Join-Path $priorAttemptDir 'uncertain-attempt.json'), ($uncertainLedger | ConvertTo-Json -Depth 20 -Compress), (New-Object Text.UTF8Encoding($false)))
  $newAttemptArgs = @{} + $invokeArgs; $newAttemptArgs.Remove('DryRun'); $newAttemptArgs.AttemptId = 'new-attempt'
  $newAttemptResult = ([string](& $fixtureInvoker @newAttemptArgs) | ConvertFrom-Json)
  Assert-LiteEqual $newAttemptResult.disposition 'WAIT_SAFE_BOUNDARY' 'new attempt blocked by prior uncertainty'
  Assert-LiteEqual $newAttemptResult.reason 'COMPACT_INTENT_UNCERTAIN' 'participant uncertainty reason'

  Remove-Item -LiteralPath (Join-Path $priorAttemptDir 'uncertain-attempt.json') -Force
  $global:mockContextReads = 0; $global:mockSummarizePosts = 0; $global:mockCommandPosts = 0; $global:mockAfterCompactArguments = ''
  function global:Invoke-RestMethod {
    param([string]$Method,[string]$Uri,$Headers,[string]$ContentType,$Body,[int]$TimeoutSec,[int]$MaximumRedirection)
    if ($Method -ceq 'Get' -and $Uri -match '/api/session/.+/context$') {
      $global:mockContextReads++
      if ($global:mockContextReads -eq 1) { return @() }
      return @([pscustomobject]@{type='compaction';markerID='marker-e2e';time=[pscustomobject]@{created=([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+1000)}})
    }
    if ($Method -ceq 'Post' -and $Uri -match '/summarize$') { $global:mockSummarizePosts++; return [pscustomobject]@{markerID='marker-e2e'} }
    if ($Method -ceq 'Get' -and $Uri -match '/command\?directory=') { return @([pscustomobject]@{name='after-compact'}) }
    if ($Method -ceq 'Post' -and $Uri -match '/command$') { $global:mockCommandPosts++; $global:mockAfterCompactArguments=[string](($Body|ConvertFrom-Json).arguments); return [pscustomobject]@{id='command-receipt'} }
    if ($Method -ceq 'Get' -and $Uri -match '/message\?limit=40$') {
      $baseline=[pscustomobject]@{id='baseline-message';role='assistant';parts=@([pscustomobject]@{type='text';text='prior output'})}
      if ($global:mockCommandPosts -eq 0) { return @($baseline) }
      $restoreText="AFTER COMPACT RESTORE`nProject: worldsim`nRole: Meta Coordinator`nRestore status: RESTORED`nLoaded basis: After-Compact procedure; role runbook; target bootloader; target state`nUnavailable or warnings: none`nCurrent phase: SEQ_NEXT`nDeclared next actor / command: Meta Coordinator / /seq-next`nWorkflow command sent: false"
      return @([pscustomobject]@{id='unrelated-message';role='assistant';parts=@([pscustomobject]@{type='text';text=$restoreText})},[pscustomobject]@{id='restore-message';parentID='command-receipt';role='assistant';parts=@([pscustomobject]@{type='text';text=$restoreText})},$baseline)
    }
    throw "Unexpected mocked request: $Method $Uri"
  }
  try {
    $normalArgs = @{} + $invokeArgs; $normalArgs.Remove('DryRun'); $normalArgs.AttemptId='normal-attempt';$normalArgs.RestoreTimeoutSeconds=5
    $normalResult = ([string](& $fixtureInvoker @normalArgs) | ConvertFrom-Json)
    Assert-LiteEqual $normalResult.disposition 'COMPACTED_RESTORED' "normal invoker path restores ($($normalResult.reason))"
    Assert-LiteEqual $global:mockSummarizePosts 1 'normal invoker summarizes once'
    Assert-LiteEqual $global:mockCommandPosts 1 'normal invoker sends after-compact once'
    Assert-LiteEqual $global:mockAfterCompactArguments 'worldsim Meta Coordinator' 'after-compact receives exact admitted project and role'
    $normalLedgerPath = Join-Path $priorAttemptDir 'normal-attempt.json'
    Assert-LiteTrue (Test-Path -LiteralPath $normalLedgerPath -PathType Leaf) 'normal invoker ledger exists'
    if (Test-Path -LiteralPath $normalLedgerPath -PathType Leaf) {
      $normalLedger = Get-Content -Raw -LiteralPath $normalLedgerPath | ConvertFrom-Json
      Assert-LiteEqual (@($normalLedger.transitions | ForEach-Object { $_.state }) -join '|') 'INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING|COMPACTED_RESTORED' 'normal invoker persists full transitions'
      Assert-LiteTrue ([string]$normalLedger.marker_identity -match '^sha256:[a-f0-9]{64}$') 'normal invoker persists hashed marker'
      Assert-LiteTrue (-not (($normalLedger | ConvertTo-Json -Depth 20 -Compress) -match 'runtime-session|marker-e2e|127\.0\.0\.1|4096')) 'normal ledger excludes runtime identities'
    }
  }
  finally { Remove-Item -LiteralPath Function:\global:Invoke-RestMethod -ErrorAction SilentlyContinue;Remove-Variable -Scope Global -Name mockContextReads,mockSummarizePosts,mockCommandPosts,mockAfterCompactArguments -ErrorAction SilentlyContinue }
}
finally {
  if (Test-Path -LiteralPath $fixtureRoot -PathType Container) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force }
}

$activeRunbook = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot '..\docs\workflow-orchestrator-runbook.md')
Assert-LiteTrue ($activeRunbook.Contains('invoke-session-compact-lite.ps1')) 'active runbook invokes Compact Lite'
Assert-LiteTrue ($activeRunbook.Contains('No active Orchestrator route invokes them.')) 'old V2 invoker is reference-only'
$questionReplySource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'reply-question.ps1'))
Assert-LiteTrue ($questionReplySource.Contains('FAL_EXPLICIT_STAGE_ROUTER_RETIRED') -and $questionReplySource.Contains('Get-ExactQuestionRequest') -and $questionReplySource.Contains('Enter-OCRouterParticipantTransportLock') -and $questionReplySource.Contains('Start-OCRouterDispatchIntentCore') -and $questionReplySource.Contains('MaximumRedirection 0')) 'retired question reply fails closed and retains safe reference transport'
  $sendMessageSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'send-message.ps1'))
  Assert-LiteTrue ($sendMessageSource.Contains('Resolve-OCRouterLiteralLoopbackServer') -and $sendMessageSource.Contains('-ceq $Target') -and $sendMessageSource.Contains('MaximumRedirection 0')) 'direct sender requires canonical target and literal no-redirect loopback transport'
  $senderFixture=Join-Path $fixtureRoot 'sender-router';[void](New-Item -ItemType Directory -Path $senderFixture)
  [IO.File]::WriteAllText((Join-Path $senderFixture 'sessions.json'),'{'+'"server":"http://127.0.0.1:4096","sessions":{"meta":{"sessionId":"runtime-session","title":"Meta"}}}',(New-Object Text.UTF8Encoding($false)))
  $oldErrorActionPreference=$ErrorActionPreference;try{$ErrorActionPreference='Continue';$caseOutput=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'send-message.ps1') -Target Meta -Text test -RouterDir $senderFixture -PreviewOnly 2>&1);$caseExit=$LASTEXITCODE;[IO.File]::WriteAllText((Join-Path $senderFixture 'sessions.json'),'{'+'"server":"https://attacker.example","sessions":{"meta":{"sessionId":"runtime-session","title":"Meta"}}}',(New-Object Text.UTF8Encoding($false)));$remoteOutput=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'send-message.ps1') -Target meta -Text test -RouterDir $senderFixture -PreviewOnly 2>&1);$remoteExit=$LASTEXITCODE}finally{$ErrorActionPreference=$oldErrorActionPreference}
  Assert-LiteTrue ($caseExit -ne 0 -and ($caseOutput -join "`n") -match 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED') 'legacy direct sender fails closed before target resolution'
  Assert-LiteTrue ($remoteExit -ne 0 -and ($remoteOutput -join "`n") -match 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED') 'legacy direct sender cannot reach a credential-bearing transport path'
$activeCallerFiles = @(
  (Join-Path $PSScriptRoot '..\docs\workflow-orchestrator-runbook.md'),
  (Join-Path $PSScriptRoot '..\README.md')
)
foreach ($callerFile in $activeCallerFiles) {
  $callerText = Get-Content -Raw -LiteralPath $callerFile
  Assert-LiteTrue (-not ($callerText -match '(?m)^\s*(?:&|powershell(?:\.exe)?\b).*invoke-session-compact-flow\.ps1')) "no active V2 caller in $([IO.Path]::GetFileName($callerFile))"
}

if ($failures.Count -gt 0) {
  Write-Host "SESSION COMPACT LITE TEST FAILED ($($failures.Count))" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
  exit 1
}
Write-Host 'SESSION COMPACT LITE TEST PASSED' -ForegroundColor Green
