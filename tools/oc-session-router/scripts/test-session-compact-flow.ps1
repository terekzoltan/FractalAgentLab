[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')
. (Join-Path $PSScriptRoot 'session-compact-flow-core.ps1')

$Failures = New-Object System.Collections.Generic.List[string]
function Assert-True { param([bool]$Condition,[string]$Message) if (-not $Condition) { $Failures.Add($Message) } }
function Assert-Equal { param($Actual,$Expected,[string]$Message) if ([string]$Actual -cne [string]$Expected) { $Failures.Add("$Message`: expected '$Expected', got '$Actual'") } }
function Assert-Near { param([double]$Actual,[double]$Expected,[string]$Message) if ([Math]::Abs($Actual-$Expected) -gt 0.000001) { $Failures.Add("$Message`: expected '$Expected', got '$Actual'") } }
function Assert-Throws { param([scriptblock]$Action,[string]$Message) $Threw=$false;try{& $Action}catch{$Threw=$true};if(-not $Threw){$Failures.Add($Message)} }

function New-TestPolicy {
  return [pscustomobject][ordered]@{
    schema_version='1'; contract='opencode-compact-policy/v1'; scope='global'; mode='auto_safe'
    checks=@('before_dispatch','after_stage_output','epic_closeout'); warn_ratio=0.5; critical_ratio=0.62
    compact_warn_at_first_safe_boundary=$true; block_long_stage_at_critical=$true
    compact_epic_participants_after_closeout=$true; safe_boundary_required=$true
    maximum_retry_count=1; project_override='tighten_only'; excluded_role_profiles=@(); required_gates=@()
  }
}

function New-TestParticipant {
  param([string]$Ref='delivery-main',[string]$Class='DELIVERY',[string]$Profile='fal.compact-v2-maintainer',[string]$Resume='ROUTE_READY')
  $Participant=[ordered]@{
    logical_session_ref=$Ref; profile_id=$Profile; role_hint=$(if($Class -ceq 'DELIVERY'){'Compact V2 Workflow Maintainer'}elseif($Class -ceq 'REVIEW_SUPPORT'){'SMR Analyst'}else{'Meta Coordinator'})
    participation_class=$Class; compact_order=1; resume_mode=$Resume; expected_next_actor='Meta'
    expected_next_command=$(if($Resume -in @('ROUTE_READY','AUTO_RESUME')){'/step-review'}else{'NONE'})
    route_input=$(if($Resume -in @('ROUTE_READY','AUTO_RESUME')){[pscustomobject]@{mode='PINNED_ARTIFACT';path='plans/epics/COMPACT-V2.md';sha256='1111111111111111111111111111111111111111111111111111111111111111';logical_identity='compact-v2-candidate'}}else{[pscustomobject]@{mode='NOT_APPLICABLE'}})
  }
  if($Resume -in @('ROUTE_READY','AUTO_RESUME')){$Participant.selected_command_identity='2222222222222222222222222222222222222222222222222222222222222222'}
  return [pscustomobject]$Participant
}

function New-TestEvent {
  param([string]$Type='before_dispatch',[bool]$Safe=$true,[object[]]$Participants=@((New-TestParticipant)))
  $Proof=[pscustomobject][ordered]@{stage_output_complete=$Safe;stage_output_classified=$Safe;stage_artifact_pinned=$Safe;stage_artifact_hash_verified=$Safe;state_combined_agree=$Safe;participant_idle=$Safe;no_unresolved_question=$Safe;route_exact=$Safe;transport_settled=$Safe;prior_compact_certain=$Safe}
  $Event=[ordered]@{
    schema_version='1';contract='compact-flow-event/v1';event_id='event-1';event_type=$Type;boundary_id='boundary-1';project_id='fixture'
    wave_id='W1';epic_id='COMPACT-V2';workflow_phase='STEP_REVIEW';state_revision='state-v1';candidate_identity='compact-v2-candidate'
    configuration_identity='config-v1';combined_row_identity='combined-v1';safe_boundary=$Proof;duplicate_send_disposition='SETTLED';satisfied_gates=@()
    host_attestation=[pscustomobject]@{opencode_version='1.18.7';opencode_launcher_identity=('e'*64);command_registry_identity=('f'*64);after_compact_command_identity=('9'*64)}
    active_route=[pscustomobject]@{profile_id='fal.compact-v2-maintainer';generation_id=('a'*64);state_sha256=('b'*64);combined_sha256=('c'*64);stage_sha256=('d'*64)}
    participants=$Participants;unresolved_blocker_codes=@();created_utc=[datetime]::UtcNow.ToString('o')
  }
  if($Type -ceq 'before_dispatch'){$Event.sender_logical_ref='delivery-main';$Event.recipient_logical_ref='meta-main'}
  if($Type -ceq 'after_stage_output'){$Event.stage_artifact=[pscustomobject]@{path='plans/epics/COMPACT-V2.md';sha256='1111111111111111111111111111111111111111111111111111111111111111';logical_identity='compact-v2-candidate'}}
  if($Type -ceq 'epic_closeout'){$Event.closeout=[pscustomobject]@{receipt_path='evidence/closeout.md';receipt_identity='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';routing_verdict='CLOSED'}}
  return [pscustomobject]$Event
}

function New-TestTelemetry {
  param([string]$Pressure='warn',[string]$State='idle',[bool]$HasModel=$true,$PolicyResolution=$null)
  $TelemetryPolicy = if ($null -eq $PolicyResolution) { $script:TestPolicyResolution } else { $PolicyResolution }
  return [pscustomobject]@{schema_version='session-context-status/v1';session=[pscustomobject]@{state=$State};policy=[pscustomobject]@{identity=[string]$TelemetryPolicy.effective_policy_sha256;warn_ratio=[double]$TelemetryPolicy.effective_policy.warn_ratio;critical_ratio=[double]$TelemetryPolicy.effective_policy.critical_ratio};model=[pscustomobject]@{provider_id=$(if($HasModel){'provider'}else{$null});model_id=$(if($HasModel){'model'}else{$null})};pressure=[pscustomobject]@{state=$Pressure}}
}

$Global=New-TestPolicy
$Policy=Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global
$script:TestPolicyResolution=$Policy
Assert-True $Policy.valid 'Global policy must resolve.'
Assert-True $Policy.automatic_action_allowed 'Global policy must permit automatic action.'

$Tight=[pscustomobject]@{schema_version='1';contract='opencode-compact-policy/v1';scope='project_override';mode='ask';checks=@('before_dispatch','after_stage_output','epic_closeout');warn_ratio=0.40;critical_ratio=0.55;maximum_retry_count=0;excluded_role_profiles=@('fixture.skip');required_gates=@('owner-ready')}
$TightResult=Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global -ProjectOverride $Tight
Assert-Equal $TightResult.effective_policy.mode 'ask' 'Project override may tighten mode.'
Assert-Near $TightResult.effective_policy.warn_ratio 0.40 'Project override may lower warning threshold.'
Assert-Equal $TightResult.effective_policy.maximum_retry_count 0 'Project override may lower retry count.'
Assert-True $TightResult.automatic_action_allowed 'Valid tightening override must remain automatic-policy valid.'
$RemovedCheck=[pscustomobject]@{schema_version='1';contract='opencode-compact-policy/v1';scope='project_override';checks=@('after_stage_output','epic_closeout')}
$RemovedCheckResult=Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global -ProjectOverride $RemovedCheck
Assert-True (-not $RemovedCheckResult.automatic_action_allowed) 'Project override must not remove a mandatory global event check.'

$Loose=[pscustomobject]@{schema_version='1';contract='opencode-compact-policy/v1';scope='project_override';warn_ratio=0.60}
$LooseResult=Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global -ProjectOverride $Loose
Assert-True (-not $LooseResult.automatic_action_allowed) 'Loosening override must disable automatic action.'
Assert-True (@($LooseResult.diagnostics).Count -eq 1) 'Loosening override must emit one diagnostic.'
Assert-Throws { Assert-CompactFlowStrictJson -Text '{"a":1,"nested":{"x":1,"x":2}}' -Label 'duplicate fixture' } 'Recursive duplicate JSON members must fail.'
$DeepJson='0';for($Depth=0;$Depth-lt65;$Depth++){$DeepJson='{"x":'+$DeepJson+'}'}
Assert-Throws { Assert-CompactFlowStrictJson -Text $DeepJson -Label 'deep fixture' } 'JSON nesting over the fixed maximum must fail.'

$Event=New-TestEvent
Assert-True (Assert-CompactFlowEvent -Event $Event) 'Valid event must pass.'
$UuidEvent=New-TestEvent
$UuidEvent.participants[0].logical_session_ref='123e4567-e89b-12d3-a456-426614174000'
Assert-Throws { Assert-CompactFlowEvent -Event $UuidEvent } 'UUID-shaped participant reference must fail.'
$PrivacyEvent=New-TestEvent
$PrivacyEvent.participants[0] | Add-Member -NotePropertyName session_id -NotePropertyValue 'ses_private'
Assert-Throws { Assert-CompactFlowEvent -Event $PrivacyEvent } 'Concrete session field must fail event validation.'
$NestedPrivacyEvent=New-TestEvent
$NestedPrivacyEvent.participants[0].route_input | Add-Member -NotePropertyName route_body -NotePropertyValue 'ses_private'
Assert-Throws { Assert-CompactFlowEvent -Event $NestedPrivacyEvent } 'Nested route-input privacy fields must fail event validation.'
$EmptyRouteExtra=New-TestEvent
$EmptyRouteExtra.participants[0].route_input=[pscustomobject]@{mode='EXACT_EMPTY';path='unexpected.md'}
Assert-Throws { Assert-CompactFlowEvent -Event $EmptyRouteExtra } 'EXACT_EMPTY route input must reject artifact fields.'
$NestedHostEvent=New-TestEvent
$NestedHostEvent.host_attestation | Add-Member -NotePropertyName endpoint -NotePropertyValue 'http://127.0.0.1'
Assert-Throws { Assert-CompactFlowEvent -Event $NestedHostEvent } 'Nested host-attestation endpoint fields must fail event validation.'
$MissingAfterCompactIdentityEvent=New-TestEvent
$MissingAfterCompactIdentityEvent.host_attestation.PSObject.Properties.Remove('after_compact_command_identity')
Assert-Throws { Assert-CompactFlowEvent -Event $MissingAfterCompactIdentityEvent } 'Missing pinned after-compact command identity must block before transport.'
$BadCloseout=New-TestEvent -Type epic_closeout
$BadCloseout.closeout.routing_verdict='CONTINUE'
Assert-Throws { Assert-CompactFlowEvent -Event $BadCloseout } 'Closeout event without CLOSED receipt must fail.'

$Normal=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure normal) -ProfileId 'fal.compact-v2-maintainer'
$Warn=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure warn) -ProfileId 'fal.compact-v2-maintainer'
$Critical=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure critical) -ProfileId 'fal.compact-v2-maintainer'
$Unknown=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure unknown) -ProfileId 'fal.compact-v2-maintainer'
$Over=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure over_limit) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $Normal.disposition CONTINUE 'Normal pressure must stay fluid.'
Assert-Equal $Warn.disposition AUTO_COMPACT 'Warn at safe boundary must auto compact.'
Assert-Equal $Critical.disposition AUTO_COMPACT 'Critical at safe boundary must auto compact.'
Assert-Equal $Unknown.disposition CONTINUE 'Unknown pressure must not block ordinary work.'
Assert-Equal $Over.disposition PROOF_REQUIRED 'Over-limit must allow bounded recovery only.'
$MismatchedTelemetry=New-TestTelemetry -Pressure critical
$MismatchedTelemetry.policy.identity='different-policy'
$PolicyMismatch=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry $MismatchedTelemetry -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $PolicyMismatch.disposition BLOCKED 'Telemetry policy identity mismatch must block automatic action.'
$MismatchedRatios=New-TestTelemetry -Pressure critical
$MismatchedRatios.policy.warn_ratio=0.49
$RatioMismatch=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry $MismatchedRatios -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $RatioMismatch.reason POLICY_TELEMETRY_MISMATCH 'Telemetry threshold mismatch must use the exact parity failure.'
$Unsafe=Get-CompactFlowPressureDecision -Event (New-TestEvent -Safe $false) -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure critical) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $Unsafe.disposition PROOF_REQUIRED 'Unsafe critical boundary must stop before compact.'
$Busy=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure warn -State busy) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $Busy.disposition PROOF_REQUIRED 'Busy participant must not compact.'
$NoModel=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure warn -HasModel $false) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $NoModel.disposition PROOF_REQUIRED 'Missing provider/model must require proof.'
$GateEvent=New-TestEvent
$GateDecision=Get-CompactFlowPressureDecision -Event $GateEvent -PolicyResolution $TightResult -Telemetry (New-TestTelemetry -PolicyResolution $TightResult) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $GateDecision.disposition PROOF_REQUIRED 'Missing required policy gate must prevent action.'
$GateEvent.satisfied_gates=@('owner-ready')
$SatisfiedGateDecision=Get-CompactFlowPressureDecision -Event $GateEvent -PolicyResolution $TightResult -Telemetry (New-TestTelemetry -PolicyResolution $TightResult) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $SatisfiedGateDecision.disposition CONFIRM 'Satisfied required policy gate must allow the tightened ask decision.'
$Closeout=Get-CompactFlowPressureDecision -Event (New-TestEvent -Type epic_closeout) -PolicyResolution $Policy -Telemetry (New-TestTelemetry -Pressure unknown) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $Closeout.disposition AUTO_COMPACT 'Accepted closeout must compact actual participants regardless of pressure.'
$RecommendPolicy=New-TestPolicy;$RecommendPolicy.mode='recommend';$RecommendResolution=Resolve-CompactFlowPolicyObjects -GlobalPolicy $RecommendPolicy;$Recommend=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $RecommendResolution -Telemetry (New-TestTelemetry -PolicyResolution $RecommendResolution) -ProfileId 'fal.compact-v2-maintainer'
$AskPolicy=New-TestPolicy;$AskPolicy.mode='ask';$AskResolution=Resolve-CompactFlowPolicyObjects -GlobalPolicy $AskPolicy;$Ask=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $AskResolution -Telemetry (New-TestTelemetry -PolicyResolution $AskResolution) -ProfileId 'fal.compact-v2-maintainer'
$DisabledPolicy=New-TestPolicy;$DisabledPolicy.mode='disabled';$DisabledResolution=Resolve-CompactFlowPolicyObjects -GlobalPolicy $DisabledPolicy;$Disabled=Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $DisabledResolution -Telemetry (New-TestTelemetry -PolicyResolution $DisabledResolution) -ProfileId 'fal.compact-v2-maintainer'
Assert-Equal $Recommend.disposition RECOMMEND 'Recommend mode must not compact automatically.'
Assert-Equal $Ask.disposition CONFIRM 'Ask mode must require confirmation.'
Assert-Equal $Disabled.disposition CONTINUE 'Disabled mode must remain fluid without compact.'

$Delivery=New-TestParticipant -Ref 'z-delivery' -Class DELIVERY
$Review=New-TestParticipant -Ref 'a-review' -Class REVIEW_SUPPORT -Profile 'fixture.review' -Resume HYDRATE_ONLY
$Meta=New-TestParticipant -Ref 'a-meta' -Class META_ORCHESTRATOR -Profile 'fixture.meta' -Resume HYDRATE_ONLY
$Ordered=Merge-CompactFlowParticipants -Incoming @($Meta,$Review,$Delivery,$Delivery)
Assert-Equal $Ordered.Count 3 'Participant ledger must deduplicate exact repeats.'
Assert-Equal $Ordered[0].logical_session_ref 'z-delivery' 'Delivery must compact first.'
Assert-Equal $Ordered[1].logical_session_ref 'a-review' 'Review support must compact second.'
Assert-Equal $Ordered[2].logical_session_ref 'a-meta' 'Meta must compact last.'
$Conflict=New-TestParticipant -Ref 'z-delivery' -Class DELIVERY
$Conflict.role_hint='Different Role'
Assert-Throws { Merge-CompactFlowParticipants -Incoming @($Delivery,$Conflict) } 'Conflicting participant duplicates must fail.'
$WireBoundary=New-CompactFlowBoundary -Event $Event -Participants @($Event.participants)
Assert-Equal $WireBoundary.participants[0].resume_mode AUTO_RESUME 'ROUTE_READY event must map to the backward-readable Canon capsule input.'
Assert-True ($null -eq $WireBoundary.host_attestation.PSObject.Properties['after_compact_command_identity']) 'Canon capsule must not copy the FAL-only after-compact identity field.'
Assert-Equal $WireBoundary.host_attestation.command_registry_identity $Event.host_attestation.command_registry_identity 'Canon capsule must preserve command-registry identity.'

$Before=Get-CompactFlowMarkerSet -ActiveContext @([pscustomobject]@{type='compaction';id='old';time=[pscustomobject]@{created=1000}})
$After=Get-CompactFlowMarkerSet -ActiveContext @([pscustomobject]@{type='compaction';id='old';time=[pscustomobject]@{created=1000}},[pscustomobject]@{type='compaction';id='new';time=[pscustomobject]@{created=3000}})
$Attributed=Get-CompactFlowMarkerAttribution -Before $Before -After $After -IntentEpochMs 2000 -TransportStatus success -ResponseMarkerIdentity new
Assert-Equal $Attributed.disposition MARKER_VERIFIED 'Exactly one matching post-intent marker must verify.'
$Timeout=Get-CompactFlowMarkerAttribution -Before $Before -After $After -IntentEpochMs 2000 -TransportStatus timeout
Assert-Equal $Timeout.disposition UNCERTAIN 'Timeout must always be uncertain.'
$MultipleAfter=Get-CompactFlowMarkerSet -ActiveContext @([pscustomobject]@{type='compaction';id='old';time=[pscustomobject]@{created=1000}},[pscustomobject]@{type='compaction';id='new-a';time=[pscustomobject]@{created=3000}},[pscustomobject]@{type='compaction';id='new-b';time=[pscustomobject]@{created=3001}})
$Competing=Get-CompactFlowMarkerAttribution -Before $Before -After $MultipleAfter -IntentEpochMs 2000 -TransportStatus success
Assert-Equal $Competing.disposition UNCERTAIN 'Competing markers must be uncertain.'
$CompetingIntent=Get-CompactFlowMarkerAttribution -Before $Before -After $After -IntentEpochMs 2000 -TransportStatus success -OutstandingIntentCount 2
Assert-Equal $CompetingIntent.disposition UNCERTAIN 'Competing compact intents must be uncertain.'
$Contradiction=Get-CompactFlowMarkerAttribution -Before $Before -After $After -IntentEpochMs 2000 -TransportStatus success -ResponseMarkerIdentity other
Assert-Equal $Contradiction.disposition BLOCKED 'Contradictory response marker must block.'
$Retry=Get-CompactFlowRetryDecision -TransportStatus rejected_before_acceptance -Before $Before -After $Before -OutstandingIntentCount 1 -RetryCount 0 -MaximumRetryCount 1
Assert-True $Retry.retry_allowed 'Explicit pre-acceptance rejection may retry once with unchanged markers.'
$NoRetry=Get-CompactFlowRetryDecision -TransportStatus timeout -Before $Before -After $Before -OutstandingIntentCount 1 -RetryCount 0 -MaximumRetryCount 1
Assert-True (-not $NoRetry.retry_allowed) 'Timeout must never authorize retry.'

$UncertainLedger=[pscustomobject]@{runs=@([pscustomobject]@{event_id='event-1';logical_session_ref='delivery-main';state='UNCERTAIN';terminal=$true;compact_performed=$false})}
$UncertainPrior=Get-CompactFlowPriorRunDisposition -RunDocument $UncertainLedger -EventId 'event-2' -LogicalSessionRef 'delivery-main'
Assert-Equal $UncertainPrior.disposition BLOCKED 'A new event must not resend after an uncertain boundary run.'
$OutstandingLedger=[pscustomobject]@{runs=@([pscustomobject]@{event_id='event-1';logical_session_ref='delivery-main';state='INTENT_PERSISTED';terminal=$false;compact_performed=$false})}
$OutstandingPrior=Get-CompactFlowPriorRunDisposition -RunDocument $OutstandingLedger -EventId 'event-2' -LogicalSessionRef 'delivery-main'
Assert-Equal $OutstandingPrior.disposition BLOCKED 'A new event must not resend while a boundary intent is outstanding.'
$CompactedLedger=[pscustomobject]@{runs=@([pscustomobject]@{event_id='event-1';logical_session_ref='delivery-main';state='COMPLETE';terminal=$true;compact_performed=$true})}
$CompactedPrior=Get-CompactFlowPriorRunDisposition -RunDocument $CompactedLedger -EventId 'event-2' -LogicalSessionRef 'delivery-main'
Assert-Equal $CompactedPrior.disposition ALREADY_COMPACTED 'A participant must compact at most once across event IDs in one boundary.'

function Invoke-TestMachine {
  param([string]$Transport='success',[string]$HydrationAction='AUTO_RESUME',[bool]$Manual=$false,[bool]$CompetingMarkers=$false,[int]$Outstanding=1,$StateOrder=$null)
  $Now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+10000
  $Empty=Get-CompactFlowMarkerSet -ActiveContext @()
  $PostItems=@([pscustomobject]@{type='compaction';id='marker-1';time=[pscustomobject]@{created=$Now}})
  if($CompetingMarkers){$PostItems+= [pscustomobject]@{type='compaction';id='marker-2';time=[pscustomobject]@{created=$Now+1}}}
  $Post=Get-CompactFlowMarkerSet -ActiveContext $PostItems
  $MarkerState=[pscustomobject]@{calls=0}
  $GetMarkers={ $MarkerState.calls=[int]$MarkerState.calls+1; if($MarkerState.calls -eq 1){$Empty}else{$Post} }.GetNewClosure()
  $Send={ [pscustomobject]@{status=$Transport;marker_identity=$(if($Transport -ceq 'success' -and -not $CompetingMarkers){'marker-1'}else{''});outstanding_intent_count=$Outstanding;competing_manual_signal=$false} }.GetNewClosure()
  $Hydrate={ [pscustomobject]@{verification='PASS';confidence=$(if($HydrationAction -ceq 'BLOCKED'){'FAILED'}else{'VERIFIED'});action=$HydrationAction;route_input=[pscustomobject]@{mode='PINNED_ARTIFACT';status='EXACT';sha256=('1'*64);logical_identity='compact-v2-candidate'}} }.GetNewClosure()
  $Persist={param($State)if($null -ne $StateOrder){$StateOrder.Add([string]$State.state)}}.GetNewClosure()
  $ActiveRouteReceipt=[pscustomobject]@{generation_id=('a'*64);source_identities=[pscustomobject]@{state_sha256=('b'*64);combined_sha256=('c'*64);stage_sha256=('d'*64)}}
  return Invoke-CompactFlowParticipantMachine -Event (New-TestEvent) -PolicyResolution $Policy -Participant (New-TestParticipant) -Telemetry (New-TestTelemetry) -GetMarkers $GetMarkers -SendSummarize $Send -Hydrate $Hydrate -Persist $Persist -ManualCompact $Manual -ActiveRouteReceipt $ActiveRouteReceipt
}

$Success=Invoke-TestMachine
Assert-Equal $Success.disposition ROUTE_READY "Successful compact/hydrate must stop route-ready ($($Success.reason))."
Assert-Equal $Success.run_state.state ROUTE_READY "Successful state machine must end ROUTE_READY ($($Success.reason))."
Assert-True $Success.run_state.compact_performed 'Successful marker verification must record compact_performed.'
Assert-True ([string]$Success.run_state.summarize_intent_sha256 -match '^[a-f0-9]{64}$') 'Summarize intent must be hash-bound.'
Assert-Equal $Success.run_state.route_ready_receipt.command_sent $false 'Route-ready receipt must prove no workflow command was sent.'
Assert-Equal $Success.run_state.active_route_receipt.generation_id ('a'*64) 'Route-ready run state must bind the verified manifest generation.'
$StateOrder=New-Object System.Collections.Generic.List[string]
$OrderedRouteReady=Invoke-TestMachine -StateOrder $StateOrder
Assert-Equal $OrderedRouteReady.disposition ROUTE_READY 'Ordered route-ready fixture must stop without dispatch.'
Assert-True ($StateOrder.IndexOf('HYDRATION_VERIFIED') -ge 0 -and $StateOrder.IndexOf('HYDRATION_VERIFIED') -lt $StateOrder.IndexOf('ROUTE_READY')) 'Hydration verification must persist before ROUTE_READY.'
Assert-True ($StateOrder.IndexOf('RESUME_SENT') -lt 0 -and $StateOrder.IndexOf('POST') -lt 0) 'Compact terminal must never persist or invoke workflow-stage dispatch.'
Assert-True (-not (Get-Command Invoke-CompactFlowParticipantMachine).Parameters.ContainsKey('Resume')) 'Compact state machine must expose no workflow-stage Resume callback.'
$CompactInvokerSource=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'invoke-session-compact-flow.ps1')
Assert-True ($CompactInvokerSource -match 'if \(-not \$DryRun\)[\s\S]{0,160}reference-only') 'Retained V2 must fail before any non-dry summarize path.'
Assert-True ($CompactInvokerSource.IndexOf("if (-not `$DryRun)",[StringComparison]::Ordinal) -ge 0 -and $CompactInvokerSource.IndexOf("if (-not `$DryRun)",[StringComparison]::Ordinal) -lt $CompactInvokerSource.IndexOf('Resolve-CompactFlowLocalRoot -Path $TargetRoot',[StringComparison]::Ordinal)) 'Retained V2 non-dry refusal must precede target reads and summarize.'
$CommandBodySites=[regex]::Matches($CompactInvokerSource,"New-OCRouterCommandRequestBodyObject\s+-Command\s+([^\r\n]+)")
Assert-Equal $CommandBodySites.Count 1 'Compact invoker must construct exactly one command POST body.'
Assert-True ($CommandBodySites[0].Groups[1].Value -match "^'after-compact'") 'The only compact command POST body must be /after-compact.'
Assert-True ($CompactInvokerSource -notmatch 'New-OCRouterCommandRequestBodyObject\s+-Command\s+\$Command') 'Compact invoker must not construct a workflow-stage command body.'
Assert-True ($CompactInvokerSource -match 'Get-CompactFlowLiveCommandIdentity\s+-Entries\s+\$CommandEntries\s+-CommandName\s+''after-compact''') 'Compact invoker must reverify the pinned after-compact command identity immediately before hydration transport.'
$oldErrorActionPreference=$ErrorActionPreference;try{$ErrorActionPreference='Continue';$retainedOutput=@(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'invoke-session-compact-flow.ps1') -EventPath 'missing-event' -TargetRoot 'missing-target' -CanonRoot 'missing-canon' -GlobalPolicyPath 'missing-policy' 2>&1);$retainedExit=$LASTEXITCODE}finally{$ErrorActionPreference=$oldErrorActionPreference}
Assert-True ($retainedExit -ne 0 -and ($retainedOutput -join "`n") -match 'reference-only; non-dry execution is retired') 'Retained V2 non-dry process invocation must refuse before reading missing targets or policy.'
$TimedOut=Invoke-TestMachine -Transport timeout
Assert-Equal $TimedOut.disposition UNCERTAIN 'Summarize timeout must terminate UNCERTAIN.'
$MarkerConflict=Invoke-TestMachine -CompetingMarkers $true
Assert-Equal $MarkerConflict.disposition UNCERTAIN 'Competing marker machine must terminate UNCERTAIN.'
$IntentConflict=Invoke-TestMachine -Outstanding 2
Assert-Equal $IntentConflict.disposition UNCERTAIN 'Competing intent machine must terminate UNCERTAIN.'
$HydrationBlocked=Invoke-TestMachine -HydrationAction BLOCKED
Assert-Equal $HydrationBlocked.disposition BLOCKED "Blocked hydration must prevent resume ($($HydrationBlocked.reason))."
$Manual=Invoke-TestMachine -Manual $true
Assert-Equal $Manual.disposition MANUAL_COMPACT 'Manual compact must skip router summarize.'
Assert-Throws { Move-CompactFlowRunState -RunState $Success.run_state -NextState RESUME_SENT } 'Terminal state must not transition or dispatch.'
Assert-True (($Success | ConvertTo-Json -Depth 20) -notmatch 'ses_private') 'Machine output must not disclose raw session IDs.'

Assert-Throws { Assert-OCRouterParentSessionCommandSafe -Server 'http://unused' -Headers @{} -CommandName 'step-review-utan' -CommandEntries @([pscustomobject]@{name='step-review-utan';subtask=$true}) } 'Stale subtask=true command must block parent-session resume.'
Assert-OCRouterParentSessionCommandSafe -Server 'http://unused' -Headers @{} -CommandName 'step-review-utan' -CommandEntries @([pscustomobject]@{name='step-review-utan';subtask=$false})

$RetryNow=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+10000
$RetryEmpty=Get-CompactFlowMarkerSet -ActiveContext @()
$RetryPost=Get-CompactFlowMarkerSet -ActiveContext @([pscustomobject]@{type='compaction';id='retry-marker';time=[pscustomobject]@{created=$RetryNow}})
$RetryMarkerState=[pscustomobject]@{calls=0};$RetrySendState=[pscustomobject]@{calls=0}
$RetryMarkers={ $RetryMarkerState.calls=[int]$RetryMarkerState.calls+1;if($RetryMarkerState.calls -lt 3){$RetryEmpty}else{$RetryPost} }.GetNewClosure()
$RetrySend={ $RetrySendState.calls=[int]$RetrySendState.calls+1;if($RetrySendState.calls -eq 1){[pscustomobject]@{status='rejected_before_acceptance';marker_identity='';outstanding_intent_count=1;competing_manual_signal=$false}}else{[pscustomobject]@{status='success';marker_identity='retry-marker';outstanding_intent_count=1;competing_manual_signal=$false}} }.GetNewClosure()
$RetryHydrate={ [pscustomobject]@{verification='PASS';confidence='VERIFIED';action='AUTO_RESUME';route_input=[pscustomobject]@{mode='PINNED_ARTIFACT';status='EXACT';sha256=('1'*64);logical_identity='compact-v2-candidate'}} }
$RetryMachine=Invoke-CompactFlowParticipantMachine -Event (New-TestEvent) -PolicyResolution $Policy -Participant (New-TestParticipant) -Telemetry (New-TestTelemetry) -GetMarkers $RetryMarkers -SendSummarize $RetrySend -Hydrate $RetryHydrate
Assert-Equal $RetryMachine.disposition ROUTE_READY 'One proven retry may finish route-ready without dispatch.'
Assert-Equal $RetrySendState.calls 2 'One proven retry must send exactly twice.'

$BaselineFailure={ throw 'marker read failed' }
$Unused={ throw 'must not run' }
$BaselineMachine=Invoke-CompactFlowParticipantMachine -Event (New-TestEvent) -PolicyResolution $Policy -Participant (New-TestParticipant) -Telemetry (New-TestTelemetry) -GetMarkers $BaselineFailure -SendSummarize $Unused -Hydrate $Unused
Assert-Equal $BaselineMachine.disposition PROOF_REQUIRED 'Missing marker baseline must stop before summarize.'
$PreflightMachine=Invoke-CompactFlowParticipantMachine -Event (New-TestEvent) -PolicyResolution $Policy -Participant (New-TestParticipant) -Telemetry (New-TestTelemetry) -GetMarkers $Unused -SendSummarize $Unused -Hydrate $Unused -PreflightDisposition BLOCKED
Assert-Equal $PreflightMachine.disposition BLOCKED 'Failed Canon preflight must block before marker or summarize access.'

$HydrationThrow={ throw 'hydration transport ambiguous' }
$MarkerStateForHydration=[pscustomobject]@{calls=0};$HydrationMarkers={ $MarkerStateForHydration.calls=[int]$MarkerStateForHydration.calls+1;if($MarkerStateForHydration.calls -eq 1){$RetryEmpty}else{$RetryPost} }.GetNewClosure()
$SuccessSend={ [pscustomobject]@{status='success';marker_identity='retry-marker';outstanding_intent_count=1;competing_manual_signal=$false} }
$HydrationUnknown=Invoke-CompactFlowParticipantMachine -Event (New-TestEvent) -PolicyResolution $Policy -Participant (New-TestParticipant) -Telemetry (New-TestTelemetry) -GetMarkers $HydrationMarkers -SendSummarize $SuccessSend -Hydrate $HydrationThrow
Assert-Equal $HydrationUnknown.disposition UNCERTAIN 'Ambiguous hydration completion must stop without resume.'

$Temp=Join-Path ([IO.Path]::GetTempPath()) ('compact-flow-test-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $Temp)
try {
  $Route=Join-Path $Temp 'route.md'; [IO.File]::WriteAllText($Route,'route payload',(New-Object Text.UTF8Encoding($false)))
  $RouteHash=Get-CompactFlowFileSha256 -Path $Route
  $Snapshot=Open-CompactFlowRouteSnapshot -Root $Temp -RelativePath 'route.md' -ExpectedSha256 $RouteHash
  Assert-Equal $Snapshot.sha256 $RouteHash 'Held route snapshot must match expected hash.'
  Assert-Equal $Snapshot.final_path ([IO.Path]::GetFullPath($Route)) 'Held route snapshot must prove the final handle path.'
  Assert-Equal $Snapshot.link_count 1 'Held route snapshot must prove one final-handle link.'
  Assert-Throws { [IO.File]::Move($Route,(Join-Path $Temp 'replacement.md')) } 'Held route handle must prevent source replacement before send completion.'
  $Snapshot.stream.Dispose()
  Assert-Throws { Open-CompactFlowRouteSnapshot -Root $Temp -RelativePath '..\outside.md' -ExpectedSha256 $RouteHash } 'Route path escape must fail.'
  Assert-Throws { Open-CompactFlowRouteSnapshot -Root $Temp -RelativePath 'route.md:stream' -ExpectedSha256 $RouteHash } 'Alternate-data-stream route input must fail.'
  Assert-Throws { Open-CompactFlowRouteSnapshot -Root $Temp -RelativePath 'route.md' -ExpectedSha256 ('f'*64) } 'Route source drift must fail.'
  $HardLink=Join-Path $Temp 'route-link.md'; $null=& fsutil.exe hardlink create $HardLink $Route 2>$null
  if($LASTEXITCODE -eq 0){Assert-Throws { Open-CompactFlowRouteSnapshot -Root $Temp -RelativePath 'route.md' -ExpectedSha256 $RouteHash } 'Multi-link route input must fail.';Remove-Item -LiteralPath $HardLink -Force}else{$Failures.Add('Hard-link fixture could not be created.')}

  $LockPath=Join-Path $Temp 'locks\boundary.lock';[void](New-Item -ItemType Directory -Path (Split-Path -Parent $LockPath) -Force)
  $FirstLock=[IO.File]::Open($LockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
  try { Assert-Throws { $SecondLock=[IO.File]::Open($LockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$SecondLock.Dispose() } 'A concurrent boundary lifecycle must not acquire the held lock.' } finally { $FirstLock.Dispose() }

  $Outside=Join-Path $Temp 'outside';$Inside=Join-Path $Temp 'inside';[void](New-Item -ItemType Directory -Path $Outside);[void](New-Item -ItemType Directory -Path $Inside);[IO.File]::WriteAllText((Join-Path $Outside 'junction-route.md'),'junction payload')
  $Junction=Join-Path $Inside 'link';$null=& cmd.exe /c "mklink /J `"$Junction`" `"$Outside`"" 2>$null
  if($LASTEXITCODE -eq 0){Assert-Throws { Resolve-CompactFlowContainedFile -Root $Inside -RelativePath 'link\junction-route.md' } 'Reparse-point route path must fail.';$null=& cmd.exe /c "rmdir `"$Junction`""}else{$Failures.Add('Junction fixture could not be created.')}

  $Atomic=Join-Path $Temp 'atomic\state.json'; Write-CompactFlowAtomicJson -Path $Atomic -Value ([pscustomobject]@{state='ONE'}); Write-CompactFlowAtomicJson -Path $Atomic -Value ([pscustomobject]@{state='TWO'})
  Assert-Equal ((Get-Content -Raw -LiteralPath $Atomic|ConvertFrom-Json).state) TWO 'Atomic state write must replace complete JSON.'

  $GlobalPath=Join-Path $Temp 'global.json'; [IO.File]::WriteAllText($GlobalPath,($Global|ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false)))
  $FalDir=Join-Path $Temp '.fal';[void](New-Item -ItemType Directory -Path $FalDir);$ProjectPath=Join-Path $FalDir 'compact-policy.json';[IO.File]::WriteAllText($ProjectPath,($Tight|ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false)))
  $ResolvedJson=& (Join-Path $PSScriptRoot 'resolve-compact-policy.ps1') -GlobalPolicyPath $GlobalPath -ProjectPolicyPath $ProjectPath -AsJson
  $Resolved=$ResolvedJson|ConvertFrom-Json
  Assert-Equal $Resolved.effective_policy.mode ask 'Policy entrypoint must apply valid project tightening.'

  $Target=Join-Path $Temp 'target';$EventDir=Join-Path $Target '.opencode-router\compact-events';[void](New-Item -ItemType Directory -Path $EventDir -Force)
  $Sessions=[pscustomobject]@{server='http://127.0.0.1:4096';sessions=[pscustomobject]@{'delivery-main'=[pscustomobject]@{sessionId='ses_private'}}}
  [IO.File]::WriteAllText((Join-Path $Target '.opencode-router\sessions.json'),($Sessions|ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false)))
  $DryEvent=New-TestEvent;$DryEventPath=Join-Path $EventDir 'event-1.json';[IO.File]::WriteAllText($DryEventPath,($DryEvent|ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
  function Invoke-RestMethod {
    param($Method,$Uri,$Headers,$ContentType,$Body,$TimeoutSec)
    if($Uri -match '/session/status$'){return [pscustomobject]@{ses_private=[pscustomobject]@{type='idle'}}}
    if($Uri -match '/provider$'){return [pscustomobject]@{all=@([pscustomobject]@{id='openai';models=[pscustomobject]@{'gpt-test'=[pscustomobject]@{id='gpt-test';providerID='openai';limit=[pscustomobject]@{context=400000;input=400000;output=100000}}}})}}
    if($Uri -match '/session/ses_private$'){return [pscustomobject]@{model=[pscustomobject]@{providerID='openai';modelID='gpt-test'}}}
    if($Uri -match '/session/ses_private/message'){return @([pscustomobject]@{info=[pscustomobject]@{id='latest';role='assistant';providerID='openai';modelID='gpt-test';time=[pscustomobject]@{created=1000;completed=1001};tokens=[pscustomobject]@{input=300000;output=10000;reasoning=0;total=315000;cache=[pscustomobject]@{read=5000;write=0}}};parts=@([pscustomobject]@{type='text';text='private'})})}
    if($Uri -match '/api/session/ses_private/context'){return @([pscustomobject]@{type='assistant';time=[pscustomobject]@{created=1000}})}
    throw "Unexpected mocked REST request: $Method $Uri"
  }
  $FalRoot=Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot));$CanonRoot=Join-Path (Split-Path -Parent $FalRoot) 'Agent-Workflow-Canon'
  $DryJson=& (Join-Path $PSScriptRoot 'invoke-session-compact-flow.ps1') -EventPath $DryEventPath -TargetRoot $Target -CanonRoot $CanonRoot -RouterDir '.opencode-router' -Server 'http://127.0.0.1:4096' -GlobalPolicyPath $GlobalPath -DryRun
  $DryResult=$DryJson|ConvertFrom-Json
  Assert-Equal $DryResult.results[0].disposition AUTO_COMPACT 'Dry-run entrypoint must consume telemetry and classify warn pressure.'
  Assert-True (-not ([string]$DryJson).Contains('ses_private')) 'Dry-run output must not disclose the mapped raw session ID.'
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $Target '.fal\compact-boundaries\boundary-1.json'))) 'Dry-run must not write a boundary.'

  $MalformedGlobalPath=Join-Path $Temp 'malformed-global.json';[IO.File]::WriteAllText($MalformedGlobalPath,'{"schema_version":"1",',(New-Object Text.UTF8Encoding($false)))
  $InvalidPolicyJson=& (Join-Path $PSScriptRoot 'resolve-compact-policy.ps1') -GlobalPolicyPath $MalformedGlobalPath -AsJson
  $InvalidPolicy=$InvalidPolicyJson|ConvertFrom-Json
  Assert-True (-not [bool]$InvalidPolicy.valid) 'Malformed global policy must return a structured invalid resolution.'
  Assert-True (-not [bool]$InvalidPolicy.automatic_action_allowed) 'Malformed global policy must never permit compact action.'
  $InvalidFlowJson=& (Join-Path $PSScriptRoot 'invoke-session-compact-flow.ps1') -EventPath $DryEventPath -TargetRoot $Target -CanonRoot (Join-Path $Temp 'missing-canon') -RouterDir 'invalid-router' -Server 'not-a-server' -GlobalPolicyPath $MalformedGlobalPath -DryRun
  $InvalidFlow=$InvalidFlowJson|ConvertFrom-Json
  Assert-Equal $InvalidFlow.results[0].disposition CONTINUE 'Malformed global policy must not block unrelated workflow routing.'
  Assert-Equal $InvalidFlow.results[0].reason GLOBAL_POLICY_INVALID_NO_COMPACT 'Malformed global policy must return the exact no-compact reason.'
  Assert-Equal $InvalidFlow.boundary_path UNDECLARED 'Malformed global policy must stop before boundary persistence.'
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $Target '.fal\compact-boundaries\boundary-1.json'))) 'Malformed global policy must not write a boundary.'
  Remove-Item function:Invoke-RestMethod
} finally { if(Test-Path -LiteralPath $Temp){Remove-Item -LiteralPath $Temp -Recurse -Force} }

foreach($SchemaName in @('compact-policy.schema.json','compact-flow-event.schema.json')){
  $SchemaPath=Join-Path (Join-Path $PSScriptRoot '..\config') $SchemaName
  try{$Schema=Get-Content -Raw -LiteralPath $SchemaPath|ConvertFrom-Json;Assert-Equal $Schema.additionalProperties $false "$SchemaName must reject unknown top-level fields."}catch{$Failures.Add("$SchemaName is not valid JSON: $($_.Exception.Message)")}
}

if($Failures.Count -gt 0){Write-Error("SESSION COMPACT FLOW TEST FAILED`n- "+($Failures -join "`n- "));exit 1}
Write-Output 'SESSION COMPACT FLOW TEST PASSED'
