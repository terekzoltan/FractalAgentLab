$ErrorActionPreference = 'Stop'

function Get-CompactLiteDecision {
  param(
    [ValidateSet('before_dispatch','after_stage_output','epic_closeout')][string]$EventType,
    $PolicyResolution,$Telemetry,[string]$ProfileId,
    [ValidateSet('SETTLED','PENDING','UNCERTAIN')][string]$LifecycleIntentState='SETTLED',
    [ValidateSet('SETTLED','PENDING','UNCERTAIN')][string]$CompactIntentState='SETTLED'
  )
  if (-not [bool]$PolicyResolution.valid) { return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='POLICY_RESOLUTION_INVALID'} }
  if (-not [bool]$PolicyResolution.automatic_action_allowed) { return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='PROJECT_POLICY_REJECTED'} }
  $policy=$PolicyResolution.effective_policy
  if(@($policy.checks)-cnotcontains $EventType){return [pscustomobject]@{disposition='CONTINUE';reason='EVENT_NOT_SELECTED'}}
  if(@($policy.excluded_role_profiles)-ccontains $ProfileId){return [pscustomobject]@{disposition='CONTINUE';reason='PROFILE_EXCLUDED'}}
  if([string]$policy.mode-ceq'disabled'){return [pscustomobject]@{disposition='CONTINUE';reason='POLICY_DISABLED'}}
  if(@($policy.required_gates).Count){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='POLICY_REQUIRED_GATES_UNSUPPORTED_BY_LITE'}}
  $telemetryPolicy=Get-CompactFlowProperty -Value $Telemetry -Name policy
  if([string](Get-CompactFlowProperty $telemetryPolicy identity '')-cne[string]$PolicyResolution.effective_policy_sha256-or
     [double](Get-CompactFlowProperty $telemetryPolicy warn_ratio -1)-ne[double]$policy.warn_ratio-or
     [double](Get-CompactFlowProperty $telemetryPolicy critical_ratio -1)-ne[double]$policy.critical_ratio){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='POLICY_TELEMETRY_MISMATCH'}}
  $pressure=[string](Get-CompactFlowProperty (Get-CompactFlowProperty $Telemetry pressure) state unknown)
  $closeout=$EventType-ceq'epic_closeout'-and[bool]$policy.compact_epic_participants_after_closeout
  if(-not$closeout-and$pressure-in@('normal','unknown')){return [pscustomobject]@{disposition='CONTINUE';reason=$(if($pressure-ceq'unknown'){'UNKNOWN_NONBLOCKING'}else{'PRESSURE_NORMAL'})}}
  if(-not$closeout-and$pressure-ceq'warn'-and-not[bool]$policy.compact_warn_at_first_safe_boundary){return [pscustomobject]@{disposition='CONTINUE';reason='WARN_AUTO_COMPACT_DISABLED'}}
  if($pressure-ceq'over_limit'){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='OVER_LIMIT_BOUNDED_RECOVERY_ONLY'}}
  if([string](Get-CompactFlowProperty (Get-CompactFlowProperty $Telemetry session) state unknown)-cne'idle'){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='SESSION_NOT_IDLE'}}
  if($LifecycleIntentState-cne'SETTLED'){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason="LIFECYCLE_INTENT_$LifecycleIntentState"}}
  if($CompactIntentState-cne'SETTLED'){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason="COMPACT_INTENT_$CompactIntentState"}}
  $model=Get-CompactFlowProperty $Telemetry model
  if([string]::IsNullOrWhiteSpace([string](Get-CompactFlowProperty $model provider_id ''))-or[string]::IsNullOrWhiteSpace([string](Get-CompactFlowProperty $model model_id ''))){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason='PROVIDER_MODEL_UNAVAILABLE'}}
  if([string]$policy.mode-in@('ask','recommend')){return [pscustomobject]@{disposition='WAIT_SAFE_BOUNDARY';reason=$(if([string]$policy.mode-ceq'ask'){'OWNER_CONFIRMATION_REQUIRED'}else{'COMPACT_RECOMMENDED'})}}
  return [pscustomobject]@{disposition='AUTO_COMPACT';reason=$(if($closeout){'ACCEPTED_CLOSEOUT'}else{"PRESSURE_$($pressure.ToUpperInvariant())"})}
}

function New-CompactLiteIntent {
  param([string]$AttemptId,[string]$LogicalSessionRef,[string]$RoleHint,[string]$EventType,[string]$PolicyIdentity,[string]$ProviderId,[string]$ModelId,[string]$MarkerBaselineDigest)
  foreach($value in @($AttemptId,$LogicalSessionRef)){if(-not(Test-CompactFlowStableId $value)){throw 'Compact Lite stable identity has an unsafe shape.'}}
  if(-not(Test-CompactFlowLogicalSessionRef $LogicalSessionRef)){throw 'Logical participant has an unsafe shape.'}
  if($RoleHint-cnotmatch'^[A-Za-z0-9 .-]{1,80}$'){throw 'Role hint has an unsafe shape.'}
  foreach($value in @($PolicyIdentity,$MarkerBaselineDigest)){if($value-cnotmatch'^[a-f0-9]{64}$'){throw 'Compact Lite identity must be lowercase SHA-256.'}}
  foreach($value in @($ProviderId,$ModelId)){
    if($value-cnotmatch'^[A-Za-z0-9][A-Za-z0-9._:@+~-]{0,159}$'-or$value-cmatch'(?i)(^|[._:@+~-])(password|credential|api[_-]?key|bearer|token|secret|sk)(?:$|[._:@+~-])'){throw 'Compact Lite provider/model identity has an unsafe shape.'}
  }
  $intent=[pscustomobject][ordered]@{schema_version='compact-lite-intent/v1';contract='opencode-compact-lite/v1';attempt_id=$AttemptId;logical_session_ref=$LogicalSessionRef;role_hint=$RoleHint;event_type=$EventType;policy_identity=$PolicyIdentity;provider_identity=('sha256:'+(Get-CompactFlowSha256Text $ProviderId));model_identity=('sha256:'+(Get-CompactFlowSha256Text $ModelId));marker_baseline_digest=$MarkerBaselineDigest;created_utc=[datetime]::UtcNow.ToString('o');transport_state='PENDING'}
  Assert-CompactFlowPrivacySafeValue -Value $intent -Path intent
  return $intent
}

function New-CompactLiteResult {
  param([string]$LogicalSessionRef,[string]$RoleHint,[string]$EventType,$PolicyResolution,$Telemetry,[string]$Disposition,[string]$Reason,[bool]$CompactPerformed,[string]$MarkerDisposition,[string]$RestoreStatus,[int]$RetryCount=0)
  $result=[pscustomobject][ordered]@{schema_version='compact-lite-result/v1';contract='opencode-compact-lite/v1';logical_session_ref=$LogicalSessionRef;role_hint=$RoleHint;event_type=$EventType;policy_identity=[string]$PolicyResolution.effective_policy_sha256;pressure_state=[string](Get-CompactFlowProperty (Get-CompactFlowProperty $Telemetry pressure) state unknown);session_state=[string](Get-CompactFlowProperty (Get-CompactFlowProperty $Telemetry session) state unknown);disposition=$Disposition;compact_performed=$CompactPerformed;marker_disposition=$MarkerDisposition;restore_status=$RestoreStatus;workflow_command_sent=$false;reason=$Reason;privacy=[pscustomobject][ordered]@{raw_session_ids_emitted=$false;credentials_emitted=$false;endpoints_emitted=$false;ports_emitted=$false;transcripts_emitted=$false;absolute_roots_emitted=$false};retry_count=$RetryCount;terminal=$true}
  Assert-CompactFlowPrivacySafeValue -Value $result -Path result
  return $result
}

function New-CompactLiteLedger { param([string]$AttemptId,[string]$State,$Intent,$Result=$null,[string]$MarkerIdentity='UNDECLARED')
  $updatedUtc = [datetime]::UtcNow.ToString('o')
  $transition = [pscustomobject][ordered]@{state=$State;marker_identity=$MarkerIdentity;updated_utc=$updatedUtc}
  $ledger=[pscustomobject][ordered]@{schema_version='compact-lite-ledger/v1';contract='opencode-compact-lite/v1';attempt_id=$AttemptId;state=$State;terminal=($null-ne$Result);intent=$Intent;marker_identity=$MarkerIdentity;result=$Result;transitions=@($transition);updated_utc=$updatedUtc}
  Assert-CompactFlowPrivacySafeValue -Value $ledger -Path ledger
  return $ledger
}

function Merge-CompactLiteLedgerTransition {
  param($PriorLedger, $NextLedger)
  if ($null -eq $PriorLedger) { return $NextLedger }
  if ([string]$PriorLedger.attempt_id -cne [string]$NextLedger.attempt_id) { throw 'Compact Lite ledger attempt identity changed.' }
  if ((Get-CompactFlowObjectIdentity -Value $PriorLedger.intent) -cne (Get-CompactFlowObjectIdentity -Value $NextLedger.intent)) { throw 'Compact Lite ledger intent identity changed.' }
  $merged = [pscustomobject][ordered]@{
    schema_version = [string]$NextLedger.schema_version
    contract = [string]$NextLedger.contract
    attempt_id = [string]$NextLedger.attempt_id
    state = [string]$NextLedger.state
    terminal = [bool]$NextLedger.terminal
    intent = $NextLedger.intent
    marker_identity = [string]$NextLedger.marker_identity
    result = $NextLedger.result
    transitions = @(@($PriorLedger.transitions) + @($NextLedger.transitions))
    updated_utc = [string]$NextLedger.updated_utc
  }
  Assert-CompactFlowPrivacySafeValue -Value $merged -Path ledger
  return $merged
}

function Get-CompactLiteDurableMarkerIdentity {
  param([string]$MarkerIdentity)
  if ([string]::IsNullOrWhiteSpace($MarkerIdentity) -or $MarkerIdentity -ceq 'UNDECLARED') { return 'UNDECLARED' }
  return 'sha256:' + (Get-CompactFlowSha256Text -Text $MarkerIdentity)
}

function Get-CompactLiteMarkerAttribution {
  param($Before,$After,[int64]$IntentEpochMs,[string]$TransportStatus,[string]$ResponseMarkerIdentity='')
  return Get-CompactFlowMarkerAttribution $Before $After ($IntentEpochMs + 1) $TransportStatus $ResponseMarkerIdentity 1 $false
}

function Get-CompactLitePriorDisposition { param($PriorRun)
  if($null-eq$PriorRun){return [pscustomobject]@{disposition='READY';reason='NO_PRIOR_ATTEMPT'}}
  if(-not(Test-CompactLiteLedgerShape -Ledger $PriorRun)){return [pscustomobject]@{disposition='COMPACT_UNCERTAIN';reason='PRIOR_LEDGER_MALFORMED'}}
  if(-not[bool]$PriorRun.terminal){return [pscustomobject]@{disposition='COMPACT_UNCERTAIN';reason='PRIOR_ATTEMPT_REQUIRES_RECONCILIATION'}}
  $result=Get-CompactFlowProperty $PriorRun result
  if($null-eq$result){return [pscustomobject]@{disposition='COMPACT_UNCERTAIN';reason='PRIOR_LEDGER_TERMINAL_MISSING_RESULT'}}
  if([bool]$result.compact_performed-and[string]$result.restore_status-in@('RESTORED','DEGRADED')){return [pscustomobject]@{disposition='ALREADY_COMPACTED';reason='ATTEMPT_ALREADY_COMPACTED'}}
  return [pscustomobject]@{disposition=[string]$result.disposition;reason='ATTEMPT_ALREADY_SETTLED'}
}

function Test-CompactLiteLedgerShape {
  param($Ledger, [string]$ExpectedAttemptId = '')
  if ($null -eq $Ledger -or [string]$Ledger.schema_version -cne 'compact-lite-ledger/v1' -or [string]$Ledger.contract -cne 'opencode-compact-lite/v1') { return $false }
  $LedgerFields=@('schema_version','contract','attempt_id','state','terminal','intent','marker_identity','result','transitions','updated_utc')
  if(@(Get-CompactFlowPropertyNames $Ledger).Count-ne$LedgerFields.Count-or@((Get-CompactFlowPropertyNames $Ledger)|Where-Object{$LedgerFields-cnotcontains$_}).Count){return $false}
  if (-not (Test-CompactFlowStableId ([string]$Ledger.attempt_id)) -or (-not [string]::IsNullOrWhiteSpace($ExpectedAttemptId) -and [string]$Ledger.attempt_id -cne $ExpectedAttemptId)) { return $false }
  $Nonterminal = @('INTENT_PERSISTED','MARKER_VERIFIED','RESTORE_PENDING')
  $Terminal = @('COMPACTED_RESTORED','COMPACTED_DEGRADED','COMPACT_UNCERTAIN','COMPACT_FAILED','RESTORE_UNCERTAIN')
  $State = [string]$Ledger.state
  if ($State -notin @($Nonterminal + $Terminal) -or $Ledger.terminal-isnot[bool]-or [bool]$Ledger.terminal -ne ($State -in $Terminal)) { return $false }
  $Intent=$Ledger.intent
  $IntentFields=@('schema_version','contract','attempt_id','logical_session_ref','role_hint','event_type','policy_identity','provider_identity','model_identity','marker_baseline_digest','created_utc','transport_state')
  if($null-eq$Intent-or@(Get-CompactFlowPropertyNames $Intent).Count-ne$IntentFields.Count-or@((Get-CompactFlowPropertyNames $Intent)|Where-Object{$IntentFields-cnotcontains$_}).Count){return $false}
  if([string]$Intent.schema_version-cne'compact-lite-intent/v1'-or[string]$Intent.contract-cne'opencode-compact-lite/v1'-or[string]$Intent.attempt_id-cne[string]$Ledger.attempt_id-or-not(Test-CompactFlowLogicalSessionRef ([string]$Intent.logical_session_ref))-or[string]$Intent.role_hint-cnotmatch'^[A-Za-z0-9 .-]{1,80}$'-or[string]$Intent.event_type-cnotin@('before_dispatch','after_stage_output','epic_closeout')-or[string]$Intent.policy_identity-cnotmatch'^[a-f0-9]{64}$'-or[string]$Intent.provider_identity-cnotmatch'^sha256:[a-f0-9]{64}$'-or[string]$Intent.model_identity-cnotmatch'^sha256:[a-f0-9]{64}$'-or[string]$Intent.marker_baseline_digest-cnotmatch'^[a-f0-9]{64}$'-or[string]$Intent.transport_state-cne'PENDING'){return $false}
  $IntentTime=[datetime]::MinValue
  if(-not[datetime]::TryParse([string]$Intent.created_utc,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind,[ref]$IntentTime)){return $false}
  $Transitions=@($Ledger.transitions)
  if($Transitions.Count-lt1-or$Transitions.Count-gt4){return $false}
  $TransitionStates=New-Object Collections.Generic.List[string];$PriorTime=[datetime]::MinValue
  foreach($Transition in $Transitions){
    if($null-eq$Transition-or@((Get-CompactFlowPropertyNames $Transition)|Where-Object{@('state','marker_identity','updated_utc')-cnotcontains$_}).Count-or@(Get-CompactFlowPropertyNames $Transition).Count-ne3){return $false}
    $TransitionState=[string]$Transition.state;$TransitionMarker=[string]$Transition.marker_identity;$TransitionTime=[datetime]::MinValue
    if($TransitionState-notin@($Nonterminal+$Terminal)-or-not[datetime]::TryParse([string]$Transition.updated_utc,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::RoundtripKind,[ref]$TransitionTime)-or$TransitionTime-lt$PriorTime){return $false}
    if($TransitionState-in@('MARKER_VERIFIED','RESTORE_PENDING','COMPACTED_RESTORED','COMPACTED_DEGRADED','RESTORE_UNCERTAIN')){if($TransitionMarker-cnotmatch'^sha256:[a-f0-9]{64}$'){return $false}}elseif($TransitionMarker-cne'UNDECLARED'){return $false}
    $TransitionStates.Add($TransitionState);$PriorTime=$TransitionTime
  }
  $Sequence=@($TransitionStates.ToArray())-join'|'
  if($Sequence-cnotin@('INTENT_PERSISTED','INTENT_PERSISTED|COMPACT_UNCERTAIN','INTENT_PERSISTED|COMPACT_FAILED','INTENT_PERSISTED|MARKER_VERIFIED','INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING','INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING|RESTORE_UNCERTAIN','INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING|COMPACTED_RESTORED','INTENT_PERSISTED|MARKER_VERIFIED|RESTORE_PENDING|COMPACTED_DEGRADED')-or[string]$TransitionStates[$TransitionStates.Count-1]-cne$State-or[string]$Ledger.updated_utc-cne[string]$Transitions[$Transitions.Count-1].updated_utc){return $false}
  $ExpectedMarker=if($State-in@('MARKER_VERIFIED','RESTORE_PENDING','COMPACTED_RESTORED','COMPACTED_DEGRADED','RESTORE_UNCERTAIN')){'^sha256:[a-f0-9]{64}$'}else{'^UNDECLARED$'}
  if([string]$Ledger.marker_identity-cnotmatch$ExpectedMarker){return $false}
  if ($State -in $Nonterminal) { return $null -eq $Ledger.result }
  $Result=$Ledger.result
  $ResultFields=@('schema_version','contract','logical_session_ref','role_hint','event_type','policy_identity','pressure_state','session_state','disposition','compact_performed','marker_disposition','restore_status','workflow_command_sent','reason','privacy','retry_count','terminal')
  if($null-eq$Result-or@(Get-CompactFlowPropertyNames $Result).Count-ne$ResultFields.Count-or@((Get-CompactFlowPropertyNames $Result)|Where-Object{$ResultFields-cnotcontains$_}).Count-or[string]$Result.schema_version-cne'compact-lite-result/v1'-or[string]$Result.contract-cne'opencode-compact-lite/v1'-or[string]$Result.logical_session_ref-cne[string]$Intent.logical_session_ref-or[string]$Result.role_hint-cne[string]$Intent.role_hint-or[string]$Result.event_type-cne[string]$Intent.event_type-or[string]$Result.policy_identity-cne[string]$Intent.policy_identity-or$Result.terminal-isnot[bool]-or-not[bool]$Result.terminal-or$Result.compact_performed-isnot[bool]-or$Result.workflow_command_sent-isnot[bool]-or[bool]$Result.workflow_command_sent-or[int]$Result.retry_count-lt0-or[int]$Result.retry_count-gt1-or[string]::IsNullOrWhiteSpace([string]$Result.reason)){return $false}
  $Privacy=$Result.privacy;$PrivacyFields=@('raw_session_ids_emitted','credentials_emitted','endpoints_emitted','ports_emitted','transcripts_emitted','absolute_roots_emitted')
  if($null-eq$Privacy-or@(Get-CompactFlowPropertyNames $Privacy).Count-ne$PrivacyFields.Count-or@((Get-CompactFlowPropertyNames $Privacy)|Where-Object{$PrivacyFields-cnotcontains$_}).Count){return $false}
  foreach($Field in $PrivacyFields){if((Get-CompactFlowProperty $Privacy $Field)-isnot[bool]-or[bool](Get-CompactFlowProperty $Privacy $Field)){return $false}}
  $Expected=@{
    COMPACTED_RESTORED=@('COMPACTED_RESTORED',$true,'ONE_NEW_ATTRIBUTED','RESTORED')
    COMPACTED_DEGRADED=@('COMPACTED_DEGRADED',$true,'ONE_NEW_ATTRIBUTED','DEGRADED')
    COMPACT_UNCERTAIN=@('COMPACT_UNCERTAIN',$false,'UNATTRIBUTABLE','NOT_ATTEMPTED')
    COMPACT_FAILED=@('COMPACT_FAILED',$false,'PRE_ACCEPTANCE_REJECTED','NOT_ATTEMPTED')
    RESTORE_UNCERTAIN=@('COMPACT_UNCERTAIN',$true,'ONE_NEW_ATTRIBUTED','NOT_ATTEMPTED')
  }[$State]
  if([string]$Result.disposition-cne[string]$Expected[0]-or[bool]$Result.compact_performed-ne[bool]$Expected[1]-or[string]$Result.marker_disposition-cne[string]$Expected[2]-or[string]$Result.restore_status-cne[string]$Expected[3]){return $false}
  return $true
}

function Get-CompactLiteRestoreReport { param([string]$Text,[string]$ExpectedProject,[string]$ExpectedRole)
  $normalized = $Text.Replace("`r`n", "`n").TrimEnd("`r", "`n")
  if ($normalized -match '```') { throw 'After-compact output cannot use fenced machine fields.' }
  $lines = @($normalized -split "`n")
  if ($lines.Count -ne 9 -or $lines[0] -cne 'AFTER COMPACT RESTORE') { throw 'After-compact output does not match the exact active contract.' }
  $patterns = @(
    '^Project: ([A-Za-z0-9._-]+|UNRESOLVED)$',
    '^Role: (.+)$',
    '^Restore status: (RESTORED|DEGRADED)$',
    '^Loaded basis: (.+)$',
    '^Unavailable or warnings: (.+)$',
    '^Current phase: (.+)$',
    '^Declared next actor / command: (.+)$',
    '^Workflow command sent: (false)$'
  )
  $values = New-Object Collections.Generic.List[string]
  for ($index = 0; $index -lt $patterns.Count; $index++) {
    $match = [regex]::Match($lines[$index + 1], $patterns[$index])
    if (-not $match.Success) { throw "After-compact output line $($index + 2) is invalid." }
    $values.Add($match.Groups[1].Value.Trim())
  }
  if ($values[0] -cne $ExpectedProject) { throw 'After-compact project does not match the admitted project.' }
  if ($values[1] -cne $ExpectedRole) { throw 'After-compact role does not match the requested role.' }
  if($values[2]-ceq'RESTORED'){
    foreach($required in @('After-Compact procedure','role runbook','target bootloader','target state')){if($values[3]-cnotmatch[regex]::Escape($required)){throw "RESTORED output lacks required loaded basis '$required'."}}
    if($values[4]-cne'none'-or$values[5]-ceq'UNKNOWN'-or$values[6]-ceq'UNKNOWN'){throw 'RESTORED output cannot retain warnings or unknown state authority.'}
  }
  return [pscustomobject]@{status=$values[2];workflow_command_sent=$false}
}

function Invoke-CompactLiteMachine {
  param([string]$AttemptId,[string]$LogicalSessionRef,[string]$RoleHint,[string]$EventType,$PolicyResolution,$Telemetry,[scriptblock]$GetMarkers,[scriptblock]$SendSummarize,[scriptblock]$Restore,[scriptblock]$Persist=$null,[string]$ProfileId,[string]$LifecycleIntentState='SETTLED',[string]$CompactIntentState='SETTLED')
  $decision=Get-CompactLiteDecision -EventType $EventType -PolicyResolution $PolicyResolution -Telemetry $Telemetry -ProfileId $ProfileId -LifecycleIntentState $LifecycleIntentState -CompactIntentState $CompactIntentState
  if([string]$decision.disposition-cne'AUTO_COMPACT'){return New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry ([string]$decision.disposition) ([string]$decision.reason) $false NOT_EVALUATED NOT_ATTEMPTED}
  $before=&$GetMarkers;$model=$Telemetry.model
  $intent=New-CompactLiteIntent $AttemptId $LogicalSessionRef $RoleHint $EventType ([string]$PolicyResolution.effective_policy_sha256) ([string]$model.provider_id) ([string]$model.model_id) ([string]$before.digest)
  if($null-ne$Persist){&$Persist (New-CompactLiteLedger $AttemptId INTENT_PERSISTED $intent)}
  $intentMs=[DateTimeOffset]::Parse([string]$intent.created_utc).ToUnixTimeMilliseconds();$retryCount=0;$transport=&$SendSummarize
  if([string]$transport.status-in@('timeout','exception','interrupted')){$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN TRANSPORT_COMPLETION_UNCERTAIN $false UNATTRIBUTABLE NOT_ATTEMPTED;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId COMPACT_UNCERTAIN $intent $r)};return $r}
  try{$after=&$GetMarkers}catch{$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN MARKER_OBSERVATION_UNCERTAIN $false UNATTRIBUTABLE NOT_ATTEMPTED;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId COMPACT_UNCERTAIN $intent $r)};return $r}
  if([string]$transport.status-ceq'rejected_before_acceptance'){$retry=Get-CompactFlowRetryDecision rejected_before_acceptance $before $after 1 0 ([int]$PolicyResolution.effective_policy.maximum_retry_count);if(-not$retry.retry_allowed){if([string]$before.digest-cne[string]$after.digest){$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN MARKERS_CHANGED_AFTER_REJECTION $false UNATTRIBUTABLE NOT_ATTEMPTED}else{$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_FAILED ([string]$retry.reason) $false PRE_ACCEPTANCE_REJECTED NOT_ATTEMPTED};if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId ([string]$r.disposition) $intent $r)};return $r};$retryCount=1;$transport=&$SendSummarize;if([string]$transport.status-cne'success'){$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN RETRY_RESULT_UNCERTAIN $false UNATTRIBUTABLE NOT_ATTEMPTED 1;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId COMPACT_UNCERTAIN $intent $r)};return $r};try{$after=&$GetMarkers}catch{$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN MARKER_OBSERVATION_UNCERTAIN $false UNATTRIBUTABLE NOT_ATTEMPTED 1;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId COMPACT_UNCERTAIN $intent $r)};return $r}}
  if([string]::IsNullOrWhiteSpace([string]$transport.marker_identity)){$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN RESPONSE_MARKER_IDENTITY_MISSING $false UNATTRIBUTABLE NOT_ATTEMPTED $retryCount;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId COMPACT_UNCERTAIN $intent $r)};return $r}
  $attribution=Get-CompactLiteMarkerAttribution $before $after $intentMs ([string]$transport.status) ([string]$transport.marker_identity)
  if([string]$attribution.disposition-cne'MARKER_VERIFIED'){$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN ([string]$attribution.reason) $false UNATTRIBUTABLE NOT_ATTEMPTED $retryCount;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId COMPACT_UNCERTAIN $intent $r)};return $r}
  $durableMarkerIdentity=Get-CompactLiteDurableMarkerIdentity ([string]$attribution.marker_identity)
  if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId MARKER_VERIFIED $intent $null $durableMarkerIdentity);&$Persist(New-CompactLiteLedger $AttemptId RESTORE_PENDING $intent $null $durableMarkerIdentity)}
  try{$restoreResult=&$Restore}catch{$restoreReason=switch -Regex ([string]$_.Exception.Message){'^After-compact command response lacks a correlation identity\.$'{'RESTORE_COMMAND_IDENTITY_MISSING';break}'^After-compact restore output (?:timed out|is ambiguous for the command correlation identity)\.$'{'RESTORE_OUTPUT_UNCORRELATED';break}default{'RESTORE_COMPLETION_UNCERTAIN'}};$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry COMPACT_UNCERTAIN $restoreReason $true ONE_NEW_ATTRIBUTED NOT_ATTEMPTED $retryCount;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId RESTORE_UNCERTAIN $intent $r $durableMarkerIdentity)};return $r}
  if([string]$restoreResult.status-cnotin@('RESTORED','DEGRADED')-or[bool]$restoreResult.workflow_command_sent){throw 'After-compact restore violated Compact Lite.'}
  $disposition=if([string]$restoreResult.status-ceq'RESTORED'){'COMPACTED_RESTORED'}else{'COMPACTED_DEGRADED'};$r=New-CompactLiteResult $LogicalSessionRef $RoleHint $EventType $PolicyResolution $Telemetry $disposition ONE_MARKER_AND_ONE_ROLE_RESTORE $true ONE_NEW_ATTRIBUTED ([string]$restoreResult.status) $retryCount;if($null-ne$Persist){&$Persist(New-CompactLiteLedger $AttemptId $disposition $intent $r $durableMarkerIdentity)};return $r
}
