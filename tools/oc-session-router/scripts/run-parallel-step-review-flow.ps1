param(
  [string[]]$Lane = @(),

  [string]$Meta = "meta",
  [string]$SwarmAssistant = "swarm-assistant",

  [int]$PollSeconds = 15,
  [int]$TimeoutMinutes = 45,
  [int]$Limit = 5,
  [int]$CandidateCount = 3,
  [int]$StablePolls = 2,
  [int]$MinOutputChars = 150,

  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,

  [switch]$AssumeOldestFirst,
  [switch]$IncludeReasoningParts,
  [switch]$AutoUseFirstStable,
  [switch]$AutoApprove,
  [int]$MetaInternalLanes = -1,
  [switch]$SkipSwarmReview,
  [switch]$UseSwarmReview,
  [switch]$ForceFullReview,
  [string]$ReviewProfile = "auto",
  [string]$ProjectReviewContext = "auto",
  [string]$ReviewFocus = "",
  [string[]]$ReviewLanes = @(),
  [switch]$ExpandedReviewApproved,
  [string]$OwnerApprovalRecord = "",
  [string]$OwnerApprovalCostEnvelope = "",
  [string]$ReviewRegistryPath = "",
  [string]$ModelProfile = "economy",
  [string]$MetaModel = "openai/gpt-5.6-sol",
  [string]$SwarmMessageModel = "openai/gpt-5.6-sol",
  [string]$SwarmReviewDepth = "auto",
  [string]$SwarmReviewFocus = "",
  [int]$ReviewCycleIndex = 0,
  [switch]$SkipImplement,
  [switch]$WaitForTrackResponses,
  [string]$PinnedImplementationManifestPath = "",
  [string]$PinnedImplementationManifestSha256 = "",
  [string]$Wave = "",
  [switch]$FalSyncCheckpoint,
  [switch]$FalSyncApply,
  [string]$FalProjectId = "",
  [string]$FalProjectName = "",
  [ValidateSet('auto', 'git', 'non_git', 'declared_equivalent')]
  [string]$FalTargetRepoKind = 'auto',
  [string]$FalTargetRepoPath = "",
  [string]$FalTargetWorktreePath = "",
  [string]$FalTargetHead = "",
  [string]$FalTargetRef = "",
  [string]$FalTargetStatus = "",
  [string]$FalControlRoot = "",
  [switch]$Resume,
  [string]$RunId = ""
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: parallel lifecycle dispatch is unavailable.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

function Save-ParallelStepRunText {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$Text
  )

  $Path = Join-Path $RunDir $Name
  Write-OCRouterAtomicTextFile -Path $Path -Text $Text
  return $Path
}

function Save-ParallelStepRunState {
  param(
    [string]$RunDir,
    [object]$State
  )

  $Path = Join-Path $RunDir "state.json"
  Write-OCRouterAtomicJsonFile -Path $Path -Value $State
}

function Load-ParallelStepRunState {
  param([string]$RunDir)

  $Path = Join-Path $RunDir "state.json"
  if (-not (Test-Path $Path)) {
    throw "Missing parallel step-review state file: $Path"
  }

  return Get-Content $Path -Raw | ConvertFrom-Json
}

function Ensure-ParallelStepStateField {
  param(
    [object]$Object,
    [string]$Name,
    [object]$Value
  )

  if ($Object -is [System.Collections.IDictionary]) {
    if (-not $Object.Contains($Name)) {
      $Object[$Name] = $Value
    }
  }
  elseif ($null -eq $Object.PSObject.Properties[$Name]) {
    Add-Member -InputObject $Object -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function Get-ParallelStepLaneState {
  param(
    [object]$State,
    [string]$TrackKey
  )

  foreach ($LaneState in @($State.lanes)) {
    if ([string]$LaneState.track_key -eq $TrackKey) {
      return $LaneState
    }
  }

  throw "Missing step-review lane state for track '$TrackKey'."
}

function Ensure-ParallelStepLaneDefaults {
  param([object]$LaneState)

  Ensure-ParallelStepStateField -Object $LaneState -Name "implement_baseline_identity" -Value ([string]$LaneState.implement_baseline_identity)
  Ensure-ParallelStepStateField -Object $LaneState -Name "implement_baseline_message_id" -Value ([string]$LaneState.implement_baseline_message_id)
  Ensure-ParallelStepStateField -Object $LaneState -Name "sent_implement" -Value ([bool]$LaneState.sent_implement)
  Ensure-ParallelStepStateField -Object $LaneState -Name "implementation_received" -Value ([bool]$LaneState.implementation_received)
  Ensure-ParallelStepStateField -Object $LaneState -Name "implementation_message_id" -Value ([string]$LaneState.implementation_message_id)
  Ensure-ParallelStepStateField -Object $LaneState -Name "implementation_candidate_identity" -Value ([string]$LaneState.implementation_candidate_identity)
  Ensure-ParallelStepStateField -Object $LaneState -Name "candidate_identity" -Value ([string]$LaneState.candidate_identity)
  Ensure-ParallelStepStateField -Object $LaneState -Name "step_review_utan_baseline_identity" -Value ([string]$LaneState.step_review_utan_baseline_identity)
  Ensure-ParallelStepStateField -Object $LaneState -Name "step_review_utan_baseline_message_id" -Value ([string]$LaneState.step_review_utan_baseline_message_id)
  Ensure-ParallelStepStateField -Object $LaneState -Name "sent_step_review_utan" -Value ([bool]$LaneState.sent_step_review_utan)
  Ensure-ParallelStepStateField -Object $LaneState -Name "track_response_received" -Value ([bool]$LaneState.track_response_received)
  Ensure-ParallelStepStateField -Object $LaneState -Name "track_response_mode" -Value ([string]$LaneState.track_response_mode)
  Ensure-ParallelStepStateField -Object $LaneState -Name "closeout_disposition" -Value ([string]$LaneState.closeout_disposition)
  Ensure-ParallelStepStateField -Object $LaneState -Name "accepted_finding_ids" -Value @($LaneState.accepted_finding_ids)
  Ensure-ParallelStepStateField -Object $LaneState -Name "track_response_message_id" -Value ([string]$LaneState.track_response_message_id)
  Ensure-ParallelStepStateField -Object $LaneState -Name "track_response_sha256" -Value ([string]$LaneState.track_response_sha256)
  Ensure-ParallelStepStateField -Object $LaneState -Name "delivery_receipt_path" -Value ([string]$LaneState.delivery_receipt_path)
  Ensure-ParallelStepStateField -Object $LaneState -Name "fal_checkpoint_identity" -Value $null
  Ensure-ParallelStepStateField -Object $LaneState -Name "fal_checkpoint_identity_sha256" -Value ([string]$LaneState.fal_checkpoint_identity_sha256)
  Ensure-ParallelStepStateField -Object $LaneState -Name "fal_checkpoint_operation_path" -Value ([string]$LaneState.fal_checkpoint_operation_path)
  Ensure-ParallelStepStateField -Object $LaneState -Name "fal_checkpoint_operation_sha256" -Value ([string]$LaneState.fal_checkpoint_operation_sha256)
}

function Get-ParallelStepPinnedImplementationEntry {
  param([object]$Manifest, [string]$TrackKey)

  $Matches = @($Manifest.entries | Where-Object { [string]$_.track_key -ceq $TrackKey })
  if ($Matches.Count -ne 1) {
    throw "Pinned implementation manifest must contain exactly one entry for '$TrackKey'."
  }
  return $Matches[0]
}

function Resolve-ParallelStepPinnedImplementationManifest {
  param(
    [string]$ManifestPath,
    [string]$ManifestSha256,
    [object[]]$Lanes
  )

  if ([string]::IsNullOrWhiteSpace($ManifestPath) -or [string]::IsNullOrWhiteSpace($ManifestSha256)) {
    throw 'Pinned implementation manifest path and SHA256 are both required.'
  }
  if ($ManifestSha256 -notmatch '^[0-9A-Fa-f]{64}$') {
    throw 'Pinned implementation manifest SHA256 must be exactly 64 hexadecimal characters.'
  }
  if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    throw "Pinned implementation manifest is missing: $ManifestPath"
  }
  $ResolvedManifestPath = (Resolve-Path -LiteralPath $ManifestPath -ErrorAction Stop).Path
  $ObservedManifestHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedManifestPath).Hash
  if ($ObservedManifestHash -cne $ManifestSha256.ToUpperInvariant()) {
    throw 'Pinned implementation manifest hash drift.'
  }
  $ManifestDocument = Get-Content -LiteralPath $ResolvedManifestPath -Raw | ConvertFrom-Json
  $TopLevelSchema = @($ManifestDocument.PSObject.Properties.Name | Sort-Object) -join "`n"
  $ExpectedTopLevelSchema = @('lanes','version') -join "`n"
  if ($TopLevelSchema -cne $ExpectedTopLevelSchema -or [int]$ManifestDocument.version -ne 1) {
    throw 'Pinned implementation manifest must use the exact version-1 {version,lanes} schema.'
  }
  if (@($ManifestDocument.lanes).Count -ne @($Lanes).Count) {
    throw 'Pinned implementation manifest lane count does not match the exact child lane set.'
  }

  $ExpectedEntryNames = @(
    'track_key','target','epic','candidate','accountable_lane_id','accountable_lane_class','accountable_lane_profile',
    'artifact_path','artifact_sha256','producer_message_id','candidate_identity'
  )
  $ManifestDirectory = Split-Path -Parent $ResolvedManifestPath
  $ResolvedEntries = @()
  foreach ($LaneItem in $Lanes) {
    $Matches = @($ManifestDocument.lanes | Where-Object { [string]$_.track_key -ceq [string]$LaneItem.track_key })
    if ($Matches.Count -ne 1) {
      throw "Pinned implementation manifest must contain exactly one lane '$($LaneItem.track_key)'."
    }
    $Entry = $Matches[0]
    $EntrySchema = @($Entry.PSObject.Properties.Name | Sort-Object) -join "`n"
    if ($EntrySchema -cne (@($ExpectedEntryNames | Sort-Object) -join "`n")) {
      throw "Pinned implementation entry '$($LaneItem.track_key)' has missing or extra fields."
    }
    foreach ($Field in $ExpectedEntryNames) {
      if ([string]::IsNullOrWhiteSpace([string]$Entry.$Field)) {
        throw "Pinned implementation entry '$($LaneItem.track_key)' field '$Field' is missing."
      }
    }
    if ([string]$Entry.target -cne [string]$LaneItem.target -or
        [string]$Entry.epic -cne [string]$LaneItem.epic_id -or
        [string]$Entry.accountable_lane_id -cne [string]$LaneItem.accountable_lane -or
        [string]$Entry.accountable_lane_class -cne [string]$LaneItem.lane_class -or
        [string]$Entry.accountable_lane_profile -cne [string]$LaneItem.lane_profile) {
      throw "Pinned implementation lane identity drift for '$($LaneItem.track_key)'."
    }
    if ([string]$Entry.artifact_sha256 -notmatch '^[0-9A-Fa-f]{64}$') {
      throw "Pinned implementation artifact SHA256 is invalid for '$($LaneItem.track_key)'."
    }
    $ArtifactCandidatePath = if ([IO.Path]::IsPathRooted([string]$Entry.artifact_path)) { [string]$Entry.artifact_path } else { Join-Path $ManifestDirectory ([string]$Entry.artifact_path) }
    if (-not (Test-Path -LiteralPath $ArtifactCandidatePath -PathType Leaf)) {
      throw "Pinned implementation artifact is missing for '$($LaneItem.track_key)': $ArtifactCandidatePath"
    }
    $ResolvedArtifactPath = (Resolve-Path -LiteralPath $ArtifactCandidatePath -ErrorAction Stop).Path
    $ObservedArtifactHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedArtifactPath).Hash
    if ($ObservedArtifactHash -cne ([string]$Entry.artifact_sha256).ToUpperInvariant()) {
      throw "Pinned implementation artifact hash drift for '$($LaneItem.track_key)'."
    }
    if ([string]$Entry.candidate_identity -cne "id:$([string]$Entry.producer_message_id)") {
      throw "Pinned implementation producer/candidate identity drift for '$($LaneItem.track_key)'."
    }
    $ImplementationText = Get-Content -LiteralPath $ResolvedArtifactPath -Raw
    $ImplementationContext = [pscustomobject]@{
      target = [string]$LaneItem.target
      epic = [string]$LaneItem.epic_id
      accountable_lane = [string]$LaneItem.accountable_lane
      lane_class = [string]$LaneItem.lane_class
      lane_profile = [string]$LaneItem.lane_profile
    }
    if (-not (Test-OCRouterExpectedOutputKind -Text $ImplementationText -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext)) {
      throw "Pinned implementation context drift for '$($LaneItem.track_key)'."
    }
    $ObservedCandidate = Get-OCRouterTopLevelFieldValue -Text $ImplementationText -Field 'Candidate identity/worktree limitations'
    if ([string]$ObservedCandidate -cne [string]$Entry.candidate) {
      throw "Pinned implementation Candidate drift for '$($LaneItem.track_key)'."
    }
    $ResolvedEntries += [pscustomobject]@{
      track_key = [string]$Entry.track_key
      target = [string]$Entry.target
      epic = [string]$Entry.epic
      candidate = [string]$Entry.candidate
      accountable_lane_id = [string]$Entry.accountable_lane_id
      accountable_lane_class = [string]$Entry.accountable_lane_class
      accountable_lane_profile = [string]$Entry.accountable_lane_profile
      artifact_path = $ResolvedArtifactPath
      artifact_sha256 = $ObservedArtifactHash
      producer_message_id = [string]$Entry.producer_message_id
      candidate_identity = [string]$Entry.candidate_identity
      text = $ImplementationText
    }
  }
  return [pscustomobject]@{
    path = $ResolvedManifestPath
    sha256 = $ObservedManifestHash
    entries = @($ResolvedEntries)
  }
}

function Publish-ParallelStepFalCheckpointProposal {
  param(
    [string]$RunDir,
    [object]$LaneItem,
    [object]$LaneState,
    [string]$FinalArtifactPath,
    [object]$FinalArtifactPin,
    [string]$ResponseArtifactPath,
    [string]$DispatchIntentPath,
    [string]$Meta,
    [string]$Wave,
    [string]$Stage,
    [string]$ProjectId,
    [string]$ProjectName,
    [string]$TargetRepoKind,
    [string]$TargetRepoRoot,
    [string]$TargetWorktree,
    [string]$TargetHead,
    [string]$TargetRef,
    [string]$TargetStatus,
    [string]$ControlRoot
  )

  Assert-OCRouterArtifactPin -Pin $FinalArtifactPin | Out-Null
  $ResolvedFinalArtifactPath = (Resolve-Path -LiteralPath $FinalArtifactPath -ErrorAction Stop).Path
  if ([string]$FinalArtifactPin.path -cne $ResolvedFinalArtifactPath) {
    throw "Parallel step-review FAL checkpoint artifact path drift for lane '$($LaneItem.track_key)'."
  }

  $ExpectedCheckpointIdentity = New-OCRouterFalCheckpointIdentity `
    -TargetProjectId $ProjectId `
    -TargetRepoKind $TargetRepoKind `
    -TargetRepoRoot $TargetRepoRoot `
    -TargetWorktree $TargetWorktree `
    -TargetHead $TargetHead `
    -TargetRef $TargetRef `
    -TargetStatus $TargetStatus `
    -Wave $Wave `
    -Epic ([string]$LaneItem.epic_id) `
    -Stage $Stage `
    -Candidate ([string]$LaneItem.candidate_identity) `
    -AccountableLaneId ([string]$LaneItem.accountable_lane) `
    -AccountableLaneClass ([string]$LaneItem.lane_class) `
    -AccountableLaneProfile ([string]$LaneItem.lane_profile) `
    -LogicalSender $Meta `
    -LogicalRecipient ([string]$LaneItem.track_key) `
    -SourceSession $Meta `
    -ArtifactIdentity ([string]$FinalArtifactPin.candidate_identity) `
    -ArtifactPath $ResolvedFinalArtifactPath `
    -ArtifactHash ([string]$FinalArtifactPin.sha256) `
    -ArtifactProducer ([string]$FinalArtifactPin.producer_message_id) `
    -ControlRoot $ControlRoot `
    -SyncMode 'dry_run'
  $ExpectedCheckpointHash = Get-OCRouterFalCheckpointIdentityHash -Identity $ExpectedCheckpointIdentity

  if ($null -eq $LaneState.fal_checkpoint_identity) {
    $LaneState.fal_checkpoint_identity = $ExpectedCheckpointIdentity
    $LaneState.fal_checkpoint_identity_sha256 = $ExpectedCheckpointHash
  }
  else {
    Assert-OCRouterFalCheckpointIdentity -Identity $LaneState.fal_checkpoint_identity | Out-Null
    $SavedCheckpointHash = Get-OCRouterFalCheckpointIdentityHash -Identity $LaneState.fal_checkpoint_identity
    if ([string]$LaneState.fal_checkpoint_identity_sha256 -cne $SavedCheckpointHash -or $SavedCheckpointHash -cne $ExpectedCheckpointHash) {
      throw "Pinned FAL checkpoint identity drift for lane '$($LaneItem.track_key)'."
    }
  }
  $CheckpointIdentity = $LaneState.fal_checkpoint_identity

  if ([string]::IsNullOrWhiteSpace([string]$LaneState.delivery_receipt_path)) {
    $LaneState.delivery_receipt_path = Write-OCRouterArtifactDeliveryReceipt `
      -RunDir $RunDir `
      -Name ("step-review-delivery-{0}" -f $LaneItem.safe_name) `
      -ArtifactPath $ResolvedFinalArtifactPath `
      -ProducerSession $Meta `
      -Command 'step-review' `
      -Target ([string]$LaneItem.target) `
      -Recipient ([string]$LaneItem.track_key) `
      -DeliveryProven $true `
      -ResponseClass ([string]$LaneState.track_response_mode) `
      -ResponseArtifactPath $ResponseArtifactPath `
      -ResponseMessageId ([string]$LaneState.track_response_message_id) `
      -DispatchIntentPath $DispatchIntentPath `
      -FalCheckpointIdentity $CheckpointIdentity
  }
  else {
    Assert-OCRouterArtifactDeliveryReceipt `
      -ReceiptPath ([string]$LaneState.delivery_receipt_path) `
      -ArtifactPath $ResolvedFinalArtifactPath `
      -ProducerSession $Meta `
      -Command 'step-review' `
      -Target ([string]$LaneItem.target) `
      -Recipient ([string]$LaneItem.track_key) `
      -ResponseClass ([string]$LaneState.track_response_mode) `
      -ResponseArtifactPath $ResponseArtifactPath `
      -ResponseMessageId ([string]$LaneState.track_response_message_id) `
      -DispatchIntentPath $DispatchIntentPath `
      -FalCheckpointIdentity $CheckpointIdentity | Out-Null
  }

  if ([string]::IsNullOrWhiteSpace([string]$LaneState.fal_checkpoint_operation_path)) {
    $Proposal = Write-OCRouterFalCheckpointTargetProposal `
      -RunDir $RunDir `
      -Name ("psr-{0}" -f $LaneItem.safe_name) `
      -ProjectName $ProjectName `
      -Target ([string]$LaneItem.target) `
      -CheckpointIdentity $CheckpointIdentity `
      -ReceiptPath ([string]$LaneState.delivery_receipt_path) `
      -DeliveryResponseClass ([string]$LaneState.track_response_mode)
    $LaneState.fal_checkpoint_operation_path = [string]$Proposal.path
    $LaneState.fal_checkpoint_operation_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$Proposal.path)).Hash
  }
  else {
    Assert-OCRouterFalCheckpointTargetProposal `
      -ProposalPath ([string]$LaneState.fal_checkpoint_operation_path) `
      -CheckpointIdentity $CheckpointIdentity `
      -ProjectName $ProjectName `
      -Target ([string]$LaneItem.target) `
      -ReceiptPath ([string]$LaneState.delivery_receipt_path) `
      -DeliveryResponseClass ([string]$LaneState.track_response_mode) | Out-Null
    $ObservedProposalHash = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneState.fal_checkpoint_operation_path)).Hash
    if ([string]$LaneState.fal_checkpoint_operation_sha256 -cne $ObservedProposalHash) {
      throw "Pinned FAL checkpoint proposal hash drift for lane '$($LaneItem.track_key)'."
    }
  }

  return [pscustomobject]@{
    checkpoint_identity = $CheckpointIdentity
    receipt_path = [string]$LaneState.delivery_receipt_path
    proposal_path = [string]$LaneState.fal_checkpoint_operation_path
  }
}

function Invoke-ParallelCommand {
  param(
    [string]$LogicalName,
    [object]$Entry,
    [string]$Server,
    [hashtable]$Headers,
    [string]$Command,
    [string]$Arguments,
    [string]$PreviewTitle,
    [string]$Model = "",
    [string]$RunDir,
    [string]$Transition,
    [string]$BaselineIdentity,
    [string]$CandidateIdentity,
    [string]$Stage,
    [switch]$AutoApprove
  )

  $CommandName = $Command.Trim().TrimStart("/")
  Write-Host ""
  Write-Host "=== Command Send Preview ===" -ForegroundColor Cyan
  Write-Host "Step:     $PreviewTitle"
  Write-Host "Target:   $LogicalName -> $($Entry.title)"
  Write-Host "Command:  /$CommandName"
  Write-Host "Endpoint: command"
  Write-Host "Model:    $(if ([string]::IsNullOrWhiteSpace($Model)) { '<default session model>' } else { $Model })"
  Write-Host "Arguments preview:" -ForegroundColor Yellow
  Write-OCRouterTextPreview -Text $Arguments

  Assert-OCRouterParentSessionCommandSafe `
    -Server $Server `
    -Headers $Headers `
    -CommandName $CommandName

  if ($AutoApprove) {
    Write-Host "AutoApprove active. Sending command without local prompt." -ForegroundColor Yellow
  }
  else {
    $Answer = Read-Host "Run /$CommandName on '$LogicalName'? [y/N]"
    if ($Answer -ne "y" -and $Answer -ne "Y") {
      throw "Command send declined: /$CommandName -> $LogicalName"
    }
  }

  $Uri = "$Server/session/$($Entry.sessionId)/command"
  $BodyObject = New-OCRouterCommandRequestBodyObject -Command $CommandName -Arguments $Arguments -Model $Model
  $Body = $BodyObject | ConvertTo-Json -Depth 10
  $Intent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition $Transition -Recipient $LogicalName -Kind command -Operation $CommandName -Payload $Body -BaselineIdentity $BaselineIdentity -CandidateIdentity $CandidateIdentity -Stage $Stage
  if (-not [bool]$Intent.should_send) { return $Intent.intent }
  $Response = Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $Body
  $Completed = Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) -TransportStatus 'accepted'
  Write-Host "Sent command /$CommandName to $LogicalName." -ForegroundColor Green
  return $Completed
}

function Send-ParallelMessage {
  param(
    [string]$LogicalName,
    [object]$Entry,
    [string]$Server,
    [hashtable]$Headers,
    [string]$Text,
    [string]$PreviewTitle,
    [string]$Agent = "",
    [string]$Model = "",
    [string]$RunDir,
    [string]$Transition,
    [string]$BaselineIdentity,
    [string]$CandidateIdentity,
    [string]$Stage,
    [switch]$AutoApprove
  )

  $Uri = "$Server/session/$($Entry.sessionId)/message"

  Write-Host ""
  Write-Host "=== Message Send Preview ===" -ForegroundColor Cyan
  Write-Host "Step:     $PreviewTitle"
  Write-Host "Target:   $LogicalName -> $($Entry.title)"
  Write-Host "Endpoint: message"
  Write-Host "Agent:    $(if ([string]::IsNullOrWhiteSpace($Agent)) { '<default session agent>' } else { $Agent })"
  Write-Host "Model:    $(if ([string]::IsNullOrWhiteSpace($Model)) { '<default session model>' } else { $Model })"
  Write-Host "Message preview:" -ForegroundColor Yellow
  Write-OCRouterTextPreview -Text $Text

  if ($AutoApprove) {
    Write-Host "AutoApprove active. Sending message without local prompt." -ForegroundColor Yellow
  }
  else {
    $Answer = Read-Host "Send message to '$LogicalName'? [y/N]"
    if ($Answer -ne "y" -and $Answer -ne "Y") {
      throw "Message send declined: $LogicalName"
    }
  }

  $BodyObject = New-OCRouterMessageRequestBodyObject -Text $Text -Agent $Agent -Model $Model

  $Body = $BodyObject | ConvertTo-Json -Depth 10
  $Intent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition $Transition -Recipient $LogicalName -Kind message -Operation 'plain-message' -Payload $Body -BaselineIdentity $BaselineIdentity -CandidateIdentity $CandidateIdentity -Stage $Stage
  if (-not [bool]$Intent.should_send) { return $Intent.intent }
  $Response = Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $Body
  $Completed = Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) -TransportStatus 'accepted'
  Write-Host "Sent message to $LogicalName." -ForegroundColor Green
  return $Completed
}

$Settings = Get-OCRouterSettings -RouterDir $RouterDir
$PollSeconds = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "PollSeconds" -CurrentValue $PollSeconds -SettingName "poll_seconds")
$TimeoutMinutes = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "TimeoutMinutes" -CurrentValue $TimeoutMinutes -SettingName "timeout_minutes")
$Limit = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "Limit" -CurrentValue $Limit -SettingName "limit")
$CandidateCount = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "CandidateCount" -CurrentValue $CandidateCount -SettingName "candidate_count")
$StablePolls = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "StablePolls" -CurrentValue $StablePolls -SettingName "stable_polls")
$MinOutputChars = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "MinOutputChars" -CurrentValue $MinOutputChars -SettingName "min_output_chars")
$SwarmReviewDepth = [string](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "SwarmReviewDepth" -CurrentValue $SwarmReviewDepth -SettingName "swarm_review_depth")
if (-not $PSBoundParameters.ContainsKey('ReviewRegistryPath')) {
  $ReviewRegistryPath = [string](Get-OCRouterSettingValue -Settings $Settings -Name 'review_registry_path' -DefaultValue '')
}
if (-not $PSBoundParameters.ContainsKey("AssumeOldestFirst")) {
  $MessageOrder = [string](Get-OCRouterSettingValue -Settings $Settings -Name "message_order" -DefaultValue "")
  if ($MessageOrder -eq "oldest_first") {
    $AssumeOldestFirst = $true
  }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

if ($UseSwarmReview -or $ForceFullReview) {
  throw "Active Swarm review transport is retired. Run a fresh candidate-bound native /step-review."
}

if ($PSBoundParameters.ContainsKey("MetaInternalLanes") -and ($MetaInternalLanes -lt 0 -or $MetaInternalLanes -gt 7)) {
  throw "MetaInternalLanes must be between 0 and 7 when explicitly set."
}

$SwarmReviewDepth = Normalize-OCRouterSwarmReviewDepth -Depth $SwarmReviewDepth
if ($SwarmReviewDepth -notin @('auto', 'none')) {
  throw "SwarmReviewDepth is retired. Use the native review budget/cap envelope."
}
$SkipSwarmReview = $true
$ReviewProfile = Normalize-OCRouterReviewProfile -Profile $ReviewProfile
$ProjectReviewContext = Normalize-OCRouterProjectReviewContext -Context $ProjectReviewContext
if ([string]::IsNullOrWhiteSpace($SwarmReviewFocus) -and -not [string]::IsNullOrWhiteSpace($ReviewFocus)) {
  $SwarmReviewFocus = $ReviewFocus
}

if ($ReviewCycleIndex -lt 0) {
  throw "ReviewCycleIndex must be 0 or greater."
}
$PinnedManifestParameterNames = @('PinnedImplementationManifestPath','PinnedImplementationManifestSha256')
$PinnedManifestExplicitCount = @($PinnedManifestParameterNames | Where-Object { $PSBoundParameters.ContainsKey($_) }).Count
if ($PinnedManifestExplicitCount -notin @(0, $PinnedManifestParameterNames.Count)) {
  throw 'Pinned implementation manifest path and SHA256 must be provided together.'
}
if ($PinnedManifestExplicitCount -eq $PinnedManifestParameterNames.Count) {
  if ([string]::IsNullOrWhiteSpace($PinnedImplementationManifestPath) -or [string]::IsNullOrWhiteSpace($PinnedImplementationManifestSha256)) {
    throw 'Pinned implementation manifest path and SHA256 cannot be blank.'
  }
  $PinnedImplementationManifestPath = (Resolve-Path -LiteralPath $PinnedImplementationManifestPath -ErrorAction Stop).Path
  $PinnedImplementationManifestSha256 = $PinnedImplementationManifestSha256.Trim().ToUpperInvariant()
}
if ($FalSyncApply) {
  throw 'FalSyncApply is retired. Parallel step review may emit proposal-only /fal-checkpoint-target operations after exact Delivery responses; it never applies them inline.'
}
$WaitForTrackResponses = $true

$Config = Get-OCRouterConfig -RouterDir $RouterDir
$AssumeNewestFirst = -not $AssumeOldestFirst
$ResolvedFalTargetRepoPath = ''
$ResolvedFalTargetWorktreePath = ''
$ResolvedFalControlRoot = ''
$ResolvedFalTargetRepoKind = ''

$RunRoot = Join-Path $RouterDir "parallel-runs"
$RunDir = ""
$State = $null
$LaneSpecs = @()

if ($Resume) {
  if ([string]::IsNullOrWhiteSpace($RunId)) {
    throw "-RunId is required with -Resume."
  }

  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  trap { if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }; throw }
  $State = Load-ParallelStepRunState -RunDir $RunDir
  foreach ($Field in @(
    "sent_meta_step_review",
    "meta_baseline_before_step_review",
    "meta_baseline_message_id_before_step_review",
    "meta_phase1_received",
    "sent_prompt_to_swarm_assistant",
    "swarm_baseline_before_prompt",
    "swarm_baseline_message_id_before_prompt",
    "sent_go_to_meta",
    "swarm_review_received",
    "sent_swarm_review_to_meta",
    "meta_baseline_before_swarm_review",
    "meta_baseline_message_id_before_swarm_review",
    "meta_final_received",
    "skip_implement",
    "wait_for_track_responses",
    "review_cycle_index",
    "effective_meta_internal_lanes",
    "effective_skip_swarm_review",
    "effective_swarm_review_depth",
    "swarm_review_focus",
    "review_controls_source",
    "contract_risk_paths",
    "completed_at"
  )) {
    Ensure-ParallelStepStateField -Object $State -Name $Field -Value $State.$Field
  }
  Ensure-ParallelStepStateField -Object $State -Name "review_profile" -Value $ReviewProfile
  Ensure-ParallelStepStateField -Object $State -Name "project_review_context" -Value $ProjectReviewContext
  Ensure-ParallelStepStateField -Object $State -Name "review_focus" -Value $ReviewFocus
  Ensure-ParallelStepStateField -Object $State -Name "review_lanes" -Value @($ReviewLanes)
  Ensure-ParallelStepStateField -Object $State -Name "lane_selection_reason" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "model_profile" -Value $ModelProfile
  Ensure-ParallelStepStateField -Object $State -Name "expanded_review_approved" -Value ([bool]$ExpandedReviewApproved)
  Ensure-ParallelStepStateField -Object $State -Name "owner_approval_record" -Value $OwnerApprovalRecord
  Ensure-ParallelStepStateField -Object $State -Name "owner_approval_cost_envelope" -Value $OwnerApprovalCostEnvelope
  Ensure-ParallelStepStateField -Object $State -Name "review_registry_path" -Value $ReviewRegistryPath
  Ensure-ParallelStepStateField -Object $State -Name "review_registry_sha256" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "review_registry_version" -Value 0
  Ensure-ParallelStepStateField -Object $State -Name "owner_approval_sha256" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "owner_approval_version" -Value 0
  Ensure-ParallelStepStateField -Object $State -Name "owner_approval_identity" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "model_routing_policy_version" -Value 3
  Ensure-ParallelStepStateField -Object $State -Name "luna_retry_limit" -Value 1
  Ensure-ParallelStepStateField -Object $State -Name "meta_model" -Value $MetaModel
  Ensure-ParallelStepStateField -Object $State -Name "swarm_message_model" -Value $SwarmMessageModel
  Ensure-ParallelStepStateField -Object $State -Name "swarm_dispatch_intent_path" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "surfaced_finding_ids" -Value @()
  Ensure-ParallelStepStateField -Object $State -Name "meta_final_artifact_pin" -Value $null
  Ensure-ParallelStepStateField -Object $State -Name "pinned_implementation_manifest_path" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "pinned_implementation_manifest_sha256" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "wave" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_sync_checkpoint" -Value $false
  Ensure-ParallelStepStateField -Object $State -Name "fal_project_id" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_project_name" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_target_repo_kind" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_target_repo_path" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_target_worktree_path" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_target_head" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_target_ref" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_target_status" -Value ""
  Ensure-ParallelStepStateField -Object $State -Name "fal_control_root" -Value ""

  if (-not $PSBoundParameters.ContainsKey("ExpandedReviewApproved")) {
    $ExpandedReviewApproved = [bool]$State.expanded_review_approved
  }

  foreach ($LaneState in @($State.lanes)) {
    Ensure-ParallelStepLaneDefaults -LaneState $LaneState
    if ($null -eq $LaneState.PSObject.Properties['epic_id'] -or [string]::IsNullOrWhiteSpace([string]$LaneState.epic_id)) {
      throw "Saved run uses the legacy ambiguous track|target ABI and cannot be resumed. Start a new run with track|project-target|epic."
    }
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.accountable_lane) -or
        [string]::IsNullOrWhiteSpace([string]$LaneState.lane_class) -or
        [string]::IsNullOrWhiteSpace([string]$LaneState.lane_profile)) {
      throw "Saved run lacks the explicit accountable lane/class/profile identity for '$($LaneState.track_key)' and cannot be resumed safely."
    }
    $LaneSpecs += "{0}|{1}|{2}|{3}|{4}|{5}" -f $LaneState.track_key, $LaneState.target, $LaneState.epic_id, $LaneState.accountable_lane, $LaneState.lane_class, $LaneState.lane_profile
  }

  if ($Lane.Count -gt 0) {
    $Requested = @(ConvertTo-OCRouterLaneCollection -LaneSpecs $Lane -Config $null | ForEach-Object {
      "{0}|{1}|{2}|{3}|{4}|{5}" -f $_.track_key, $_.target, $_.epic_id, $_.accountable_lane, $_.lane_class, $_.lane_profile
    } | Sort-Object)
    $Saved = @($LaneSpecs | Sort-Object)
    if (($Requested -join "`n") -cne ($Saved -join "`n")) {
      throw "Provided -Lane values do not match the saved run state."
    }
  }

  if (-not $PSBoundParameters.ContainsKey("WaitForTrackResponses")) {
    $WaitForTrackResponses = [bool]$State.wait_for_track_responses
  }
  elseif ($WaitForTrackResponses -ne [bool]$State.wait_for_track_responses) {
    throw "Resume WaitForTrackResponses '$WaitForTrackResponses' does not match saved run setting '$($State.wait_for_track_responses)'."
  }

  if (-not $PSBoundParameters.ContainsKey("SkipImplement")) {
    $SkipImplement = [bool]$State.skip_implement
  }
  elseif ($SkipImplement -ne [bool]$State.skip_implement) {
    throw "Resume SkipImplement '$SkipImplement' does not match saved run setting '$($State.skip_implement)'."
  }

  if ($PinnedManifestExplicitCount -eq 0) {
    $PinnedImplementationManifestPath = [string]$State.pinned_implementation_manifest_path
    $PinnedImplementationManifestSha256 = [string]$State.pinned_implementation_manifest_sha256
  }
  elseif ($PinnedImplementationManifestPath -cne [string]$State.pinned_implementation_manifest_path -or
          $PinnedImplementationManifestSha256 -cne [string]$State.pinned_implementation_manifest_sha256) {
    throw 'Resume pinned implementation manifest path/hash does not match saved state.'
  }

  if (-not $PSBoundParameters.ContainsKey("ReviewCycleIndex")) {
    $ReviewCycleIndex = [int]$State.review_cycle_index
  }
  Ensure-ParallelStepStateField -Object $State -Name "meta" -Value $Meta
  Ensure-ParallelStepStateField -Object $State -Name "swarm_assistant" -Value $SwarmAssistant
  if (-not $PSBoundParameters.ContainsKey("Meta")) {
    $Meta = [string]$State.meta
  }
  elseif ($Meta -ne [string]$State.meta) {
    throw "Resume Meta '$Meta' does not match saved run Meta '$($State.meta)'."
  }
  if (-not $PSBoundParameters.ContainsKey("SwarmAssistant")) {
    $SwarmAssistant = [string]$State.swarm_assistant
  }
  elseif ($SwarmAssistant -ne [string]$State.swarm_assistant) {
    throw "Resume SwarmAssistant '$SwarmAssistant' does not match saved run SwarmAssistant '$($State.swarm_assistant)'."
  }
  foreach ($Binding in @(
    @{ Parameter = "ReviewProfile"; Field = "review_profile" },
    @{ Parameter = "ProjectReviewContext"; Field = "project_review_context" },
    @{ Parameter = "ReviewFocus"; Field = "review_focus" },
    @{ Parameter = "OwnerApprovalRecord"; Field = "owner_approval_record" },
    @{ Parameter = "OwnerApprovalCostEnvelope"; Field = "owner_approval_cost_envelope" },
    @{ Parameter = "ReviewRegistryPath"; Field = "review_registry_path" },
    @{ Parameter = "ModelProfile"; Field = "model_profile" },
    @{ Parameter = "MetaModel"; Field = "meta_model" },
    @{ Parameter = "SwarmMessageModel"; Field = "swarm_message_model" }
  )) {
    $SavedValue = [string]$State.($Binding.Field)
    if (-not $PSBoundParameters.ContainsKey($Binding.Parameter)) {
      Set-Variable -Name $Binding.Parameter -Value $SavedValue
    }
    elseif ((Get-Variable -Name $Binding.Parameter -ValueOnly) -ne $SavedValue) {
      throw "Resume $($Binding.Parameter) does not match saved run value '$SavedValue'."
    }
  }
  if (-not $PSBoundParameters.ContainsKey("ReviewLanes")) {
    $ReviewLanes = @($State.review_lanes)
  }
  elseif ((@($ReviewLanes) -join ",") -ne (@($State.review_lanes) -join ",")) {
    throw "Resume ReviewLanes do not match the saved run value."
  }

  if (-not $PSBoundParameters.ContainsKey('FalSyncCheckpoint')) {
    $FalSyncCheckpoint = [bool]$State.fal_sync_checkpoint
  }
  elseif ([bool]$FalSyncCheckpoint -ne [bool]$State.fal_sync_checkpoint) {
    throw "Resume FalSyncCheckpoint does not match the saved run value '$($State.fal_sync_checkpoint)'."
  }
  foreach ($Binding in @(
    @{ Parameter = 'Wave'; Field = 'wave' },
    @{ Parameter = 'FalProjectId'; Field = 'fal_project_id' },
    @{ Parameter = 'FalProjectName'; Field = 'fal_project_name' },
    @{ Parameter = 'FalTargetRepoKind'; Field = 'fal_target_repo_kind' },
    @{ Parameter = 'FalTargetRepoPath'; Field = 'fal_target_repo_path' },
    @{ Parameter = 'FalTargetWorktreePath'; Field = 'fal_target_worktree_path' },
    @{ Parameter = 'FalTargetHead'; Field = 'fal_target_head' },
    @{ Parameter = 'FalTargetRef'; Field = 'fal_target_ref' },
    @{ Parameter = 'FalTargetStatus'; Field = 'fal_target_status' },
    @{ Parameter = 'FalControlRoot'; Field = 'fal_control_root' }
  )) {
    if (-not $PSBoundParameters.ContainsKey($Binding.Parameter)) {
      Set-Variable -Name $Binding.Parameter -Value ([string]$State.($Binding.Field))
    }
  }
}
else {
  if ($Lane.Count -lt 2) {
    throw "Parallel step review needs at least two -Lane '<track-key>|<project-or-repo-target>|<epic>' values."
  }

  $LaneSpecs = @($Lane)
  if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = "parallel-step-review-{0}" -f (Get-OCRouterSafeTimestamp)
  }

  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  trap { if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }; throw }
  if (Test-Path (Join-Path $RunDir "state.json")) {
    throw "Parallel run directory already exists. Use a different -RunId: $RunDir"
  }

  New-Item -ItemType Directory -Force $RunDir | Out-Null
}

if ($FalSyncCheckpoint) {
  if ([string]::IsNullOrWhiteSpace($Wave)) {
    throw 'Wave is required when FalSyncCheckpoint is enabled; the checkpoint tuple may not infer Wave from Epic.'
  }
  $ResolvedFalTargetRepoPath = if ([string]::IsNullOrWhiteSpace($FalTargetRepoPath)) { (Get-Location).Path } else { (Resolve-Path -LiteralPath $FalTargetRepoPath -ErrorAction Stop).Path }
  $ResolvedFalTargetWorktreePath = if ([string]::IsNullOrWhiteSpace($FalTargetWorktreePath)) { $ResolvedFalTargetRepoPath } else { (Resolve-Path -LiteralPath $FalTargetWorktreePath -ErrorAction Stop).Path }
  $ResolvedFalControlRoot = if ([string]::IsNullOrWhiteSpace($FalControlRoot)) { (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..') -ErrorAction Stop).Path } else { (Resolve-Path -LiteralPath $FalControlRoot -ErrorAction Stop).Path }
  $ResolvedFalTargetRepoKind = $FalTargetRepoKind.Trim().ToLowerInvariant()
  if ($ResolvedFalTargetRepoKind -ceq 'auto') {
    $GitProbe = @()
    if ($null -ne (Get-Command git -ErrorAction SilentlyContinue)) {
      $GitProbe = @(& git -C $ResolvedFalTargetWorktreePath rev-parse --is-inside-work-tree 2>$null)
    }
    $ResolvedFalTargetRepoKind = if ($LASTEXITCODE -eq 0 -and (($GitProbe -join '').Trim() -ceq 'true')) { 'git' } else { 'non_git' }
  }
  if ($ResolvedFalTargetRepoKind -cne 'git') {
    if ([string]::IsNullOrWhiteSpace($FalTargetHead)) { $FalTargetHead = 'NOT_APPLICABLE' }
    if ([string]::IsNullOrWhiteSpace($FalTargetRef)) { $FalTargetRef = 'NOT_APPLICABLE' }
    if ([string]::IsNullOrWhiteSpace($FalTargetStatus)) { $FalTargetStatus = if ($ResolvedFalTargetRepoKind -ceq 'declared_equivalent') { 'declared' } else { 'unversioned' } }
  }
  if ([string]::IsNullOrWhiteSpace($FalProjectId)) { $FalProjectId = (Split-Path $ResolvedFalTargetRepoPath -Leaf).ToLowerInvariant() }
  if ([string]::IsNullOrWhiteSpace($FalProjectName)) { $FalProjectName = Split-Path $ResolvedFalTargetRepoPath -Leaf }

  if ($Resume) {
    foreach ($Pair in @(
      @('wave', $Wave), @('fal_project_id', $FalProjectId), @('fal_project_name', $FalProjectName),
      @('fal_target_repo_kind', $ResolvedFalTargetRepoKind), @('fal_target_repo_path', $ResolvedFalTargetRepoPath),
      @('fal_target_worktree_path', $ResolvedFalTargetWorktreePath), @('fal_target_head', $FalTargetHead),
      @('fal_target_ref', $FalTargetRef), @('fal_target_status', $FalTargetStatus), @('fal_control_root', $ResolvedFalControlRoot)
    )) {
      if ([string]$State.($Pair[0]) -cne [string]$Pair[1]) {
        throw "Resume FAL checkpoint binding '$($Pair[0])' does not match the saved run value."
      }
    }
  }
}

$Lanes = @(ConvertTo-OCRouterLaneCollection -LaneSpecs $LaneSpecs -Config $Config)
if ($Lanes.Count -lt 2) {
  throw "Parallel step review needs at least two lanes."
}
$PinnedImplementationManifest = $null
if (-not [string]::IsNullOrWhiteSpace($PinnedImplementationManifestPath) -or
    -not [string]::IsNullOrWhiteSpace($PinnedImplementationManifestSha256)) {
  if (-not $SkipImplement) {
    throw 'Pinned implementation manifest is valid only with -SkipImplement; the child must not dispatch /implement.'
  }
  $PinnedImplementationManifest = Resolve-ParallelStepPinnedImplementationManifest `
    -ManifestPath $PinnedImplementationManifestPath `
    -ManifestSha256 $PinnedImplementationManifestSha256 `
    -Lanes $Lanes
}

if (-not $Resume) {
  $State = [ordered]@{
    run_id = $RunId
    created_at = (Get-Date).ToString("o")
    mode = "parallel-step-review"
    meta = $Meta
    swarm_assistant = $SwarmAssistant
    skip_implement = [bool]$SkipImplement
    wait_for_track_responses = [bool]$WaitForTrackResponses
    review_cycle_index = $ReviewCycleIndex
    effective_meta_internal_lanes = -1
    effective_skip_swarm_review = $false
    effective_swarm_review_depth = ""
    swarm_review_focus = ""
    review_controls_source = ""
    contract_risk_paths = @()
    review_profile = $ReviewProfile
    project_review_context = $ProjectReviewContext
    review_focus = $ReviewFocus
    review_lanes = @($ReviewLanes)
    lane_selection_reason = ""
    model_profile = $ModelProfile
    expanded_review_approved = [bool]$ExpandedReviewApproved
    owner_approval_record = $OwnerApprovalRecord
    owner_approval_cost_envelope = $OwnerApprovalCostEnvelope
    review_registry_path = $ReviewRegistryPath
    review_registry_sha256 = ""
    review_registry_version = 0
    owner_approval_sha256 = ""
    owner_approval_version = 0
    owner_approval_identity = ""
    model_routing_policy_version = 3
    luna_retry_limit = 1
    meta_model = $MetaModel
    swarm_message_model = $SwarmMessageModel
    sent_meta_step_review = $false
    meta_baseline_before_step_review = ""
    meta_baseline_message_id_before_step_review = ""
    meta_phase1_received = $false
    sent_prompt_to_swarm_assistant = $false
    swarm_baseline_before_prompt = ""
    swarm_baseline_message_id_before_prompt = ""
    swarm_dispatch_intent_path = ""
    sent_go_to_meta = $false
    swarm_review_received = $false
    surfaced_finding_ids = @()
    sent_swarm_review_to_meta = $false
    meta_baseline_before_swarm_review = ""
    meta_baseline_message_id_before_swarm_review = ""
    meta_final_received = $false
    meta_final_artifact_pin = $null
    pinned_implementation_manifest_path = $PinnedImplementationManifestPath
    pinned_implementation_manifest_sha256 = $PinnedImplementationManifestSha256
    wave = $Wave
    fal_sync_checkpoint = [bool]$FalSyncCheckpoint
    fal_project_id = $FalProjectId
    fal_project_name = $FalProjectName
    fal_target_repo_kind = $ResolvedFalTargetRepoKind
    fal_target_repo_path = $ResolvedFalTargetRepoPath
    fal_target_worktree_path = $ResolvedFalTargetWorktreePath
    fal_target_head = $FalTargetHead
    fal_target_ref = $FalTargetRef
    fal_target_status = $FalTargetStatus
    fal_control_root = $ResolvedFalControlRoot
    completed_at = ""
    lanes = @($Lanes | ForEach-Object {
      [ordered]@{
        track_key = $_.track_key
        role_label = $_.role_label
        target = $_.target
        epic_id = $_.epic_id
        accountable_lane = $_.accountable_lane
        lane_class = $_.lane_class
        lane_profile = $_.lane_profile
        implement_baseline_identity = ""
        implement_baseline_message_id = ""
        sent_implement = $false
        implementation_received = $false
        implementation_message_id = ""
        implementation_candidate_identity = ""
        candidate_identity = ""
        step_review_utan_baseline_identity = ""
        step_review_utan_baseline_message_id = ""
        sent_step_review_utan = $false
        track_response_received = $false
        track_response_mode = ""
        closeout_disposition = ""
        accepted_finding_ids = @()
        track_response_message_id = ""
        track_response_sha256 = ""
        delivery_receipt_path = ""
        fal_checkpoint_identity = $null
        fal_checkpoint_identity_sha256 = ""
        fal_checkpoint_operation_path = ""
        fal_checkpoint_operation_sha256 = ""
      }
    })
  }
  Save-ParallelStepRunState -RunDir $RunDir -State $State
}
foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneItem.track_key
  $LaneItem | Add-Member -NotePropertyName candidate_identity -NotePropertyValue ([string]$LaneState.candidate_identity) -Force
}

$MetaEntry = Get-OCRouterSessionEntry -Config $Config -Name $Meta
$Server = $Config.server.TrimEnd("/")
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password

Write-Host "=== OC Session Router Parallel Step Review Flow ===" -ForegroundColor Cyan
Write-Host "Run ID:          $RunId"
Write-Host "Run dir:         $RunDir"
Write-Host "Mode:            $(if ($Resume) { 'resume' } else { 'new' })"
Write-Host "Meta:            $Meta -> $($MetaEntry.title)"
Write-Host "Review transport: native Meta Task fan-out (no Swarm session)"
Write-Host "AutoApprove:     $AutoApprove"
Write-Host "Review cycle:    $ReviewCycleIndex"
Write-Host "Model profile:   $ModelProfile"
Write-Host "Meta model:      $MetaModel"
Write-Host "Swarm model:     $SwarmMessageModel"
Write-Host "SkipImplement:   $SkipImplement"
Write-Host "Wait responses:  $WaitForTrackResponses"
Write-Host "Lane count:      $($Lanes.Count)"
foreach ($LaneItem in $Lanes) {
  Write-Host "- $($LaneItem.track_key) -> target=$($LaneItem.target); epic=$($LaneItem.epic_id)"
}
Write-Host ""

$LaneReadUris = @{}
foreach ($LaneItem in $Lanes) {
  $LaneReadUris[$LaneItem.track_key] = "$Server/session/$($LaneItem.session_entry.sessionId)/message?limit=$Limit"
}

$LaneTexts = @{}
$PendingImplementationWaits = New-Object System.Collections.Generic.List[object]
foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneItem.track_key
  $ImplementationContext = [pscustomobject]@{ target = $LaneItem.target; epic = $LaneItem.epic_id; accountable_lane = $LaneItem.accountable_lane; lane_class = $LaneItem.lane_class; lane_profile = $LaneItem.lane_profile }
  $PinnedImplementationEntry = if ($null -eq $PinnedImplementationManifest) { $null } else { Get-ParallelStepPinnedImplementationEntry -Manifest $PinnedImplementationManifest -TrackKey $LaneItem.track_key }
  if ([bool]$LaneState.implementation_received) {
    $ArtifactPath = Join-Path $RunDir ("01-{0}-implementation.md" -f $LaneItem.safe_name)
    if (-not (Test-Path $ArtifactPath)) {
      throw "Missing saved implementation artifact for resumed lane '$($LaneItem.track_key)': $ArtifactPath"
    }

    $SavedImplementation = Get-Content $ArtifactPath -Raw
    if (-not (Test-OCRouterExpectedOutputKind -Text $SavedImplementation -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext)) { throw "Saved implementation binding drift for '$($LaneItem.track_key)'." }
    $SavedCandidate = Get-OCRouterTopLevelFieldValue -Text $SavedImplementation -Field 'Candidate identity/worktree limitations'
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.candidate_identity) -or [string]$LaneState.candidate_identity -cne $SavedCandidate) { throw "Saved implementation candidate binding drift for '$($LaneItem.track_key)'." }
    if ($null -ne $PinnedImplementationEntry -and (
        (Get-FileHash -Algorithm SHA256 -LiteralPath $ArtifactPath).Hash -cne [string]$PinnedImplementationEntry.artifact_sha256 -or
        [string]$LaneState.implementation_message_id -cne [string]$PinnedImplementationEntry.producer_message_id -or
        [string]$LaneState.implementation_candidate_identity -cne [string]$PinnedImplementationEntry.candidate_identity -or
        [string]$LaneState.candidate_identity -cne [string]$PinnedImplementationEntry.candidate)) {
      throw "Saved child implementation drifted from the exact pinned parent handoff for '$($LaneItem.track_key)'."
    }
    $LaneItem.candidate_identity = $SavedCandidate
    $LaneTexts[$LaneItem.track_key] = $SavedImplementation
    Write-Host "Resume: using saved implementation output for $($LaneItem.role_label)." -ForegroundColor Cyan
    continue
  }

  if ($null -ne $PinnedImplementationEntry) {
    $PinnedChildArtifactPath = Join-Path $RunDir ("01-{0}-implementation.md" -f $LaneItem.safe_name)
    Copy-Item -LiteralPath ([string]$PinnedImplementationEntry.artifact_path) -Destination $PinnedChildArtifactPath -Force
    $PinnedChildArtifactHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $PinnedChildArtifactPath).Hash
    if ($PinnedChildArtifactHash -cne [string]$PinnedImplementationEntry.artifact_sha256) {
      throw "Pinned child implementation copy hash drift for '$($LaneItem.track_key)'."
    }
    $LaneTexts[$LaneItem.track_key] = [string]$PinnedImplementationEntry.text
    $LaneState.implementation_message_id = [string]$PinnedImplementationEntry.producer_message_id
    $LaneState.implementation_candidate_identity = [string]$PinnedImplementationEntry.candidate_identity
    $LaneState.candidate_identity = [string]$PinnedImplementationEntry.candidate
    $LaneItem.candidate_identity = [string]$PinnedImplementationEntry.candidate
    $LaneState.implementation_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
    Write-Host "Using exact pinned implementation handoff for $($LaneItem.role_label); session-latest selection is disabled." -ForegroundColor Cyan
    continue
  }

  if ($SkipImplement) {
    $Candidate = Get-OCRouterLatestCandidate -Uri $LaneReadUris[$LaneItem.track_key] -Headers $Headers -CandidateCount $CandidateCount -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts $IncludeReasoningParts -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext
    if ($null -eq $Candidate) {
      throw "No latest implementation report found for lane '$($LaneItem.track_key)' while -SkipImplement is active."
    }

    Write-Host ""
    Write-OCRouterSelectedCandidateSummary -Candidate $Candidate
    Write-Host "$($LaneItem.role_label) latest implementation output preview (SkipImplement):" -ForegroundColor Yellow
    Write-OCRouterTextPreview -Text $Candidate.Text

    $LaneTexts[$LaneItem.track_key] = $Candidate.Text
    Save-ParallelStepRunText -RunDir $RunDir -Name ("01-{0}-implementation.md" -f $LaneItem.safe_name) -Text $Candidate.Text | Out-Null
    $LaneState.implementation_message_id = [string]$Candidate.MessageId
    $LaneState.implementation_candidate_identity = Get-OCRouterCandidateIdentity -Candidate $Candidate
    $LaneState.candidate_identity = Get-OCRouterTopLevelFieldValue -Text $Candidate.Text -Field 'Candidate identity/worktree limitations'
    $LaneItem.candidate_identity = [string]$LaneState.candidate_identity
    $LaneState.implementation_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
    continue
  }

  if (-not [bool]$LaneState.sent_implement) {
    $Baseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $LaneReadUris[$LaneItem.track_key] -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $LaneState.implement_baseline_message_id = [string]$Baseline.MessageId
    $LaneState.implement_baseline_identity = "id:$($Baseline.MessageId)"
    Save-ParallelStepRunState -RunDir $RunDir -State $State

    Invoke-ParallelCommand -LogicalName $LaneItem.track_key -Entry $LaneItem.session_entry -Server $Server -Headers $Headers -Command "implement" -Arguments "" -PreviewTitle "$($LaneItem.role_label) /implement" -RunDir $RunDir -Transition ("implement-{0}" -f $LaneItem.safe_name) -BaselineIdentity ([string]$LaneState.implement_baseline_identity) -CandidateIdentity ([string]$LaneItem.epic_id) -Stage 'implementation_dispatch' -AutoApprove:$AutoApprove | Out-Null
    $LaneState.sent_implement = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  else {
    Write-Host "Resume: skipping already-sent /implement for $($LaneItem.role_label)." -ForegroundColor Cyan
  }

  $PendingImplementationWaits.Add([pscustomobject]@{
    track_key = $LaneItem.track_key
    safe_name = $LaneItem.safe_name
    label = "$($LaneItem.role_label) implement output"
    uri = $LaneReadUris[$LaneItem.track_key]
    baseline_identity = [string]$LaneState.implement_baseline_identity
    baseline_message_id = [string]$LaneState.implement_baseline_message_id
    expected_output_context = $ImplementationContext
  }) | Out-Null
}

if ($PendingImplementationWaits.Count -gt 0) {
  $OnImplementationCompleted = {
    param($LaneWait, $Candidate)

    $LaneTexts[$LaneWait.track_key] = $Candidate.Text
    Save-ParallelStepRunText -RunDir $RunDir -Name ("01-{0}-implementation.md" -f $LaneWait.safe_name) -Text $Candidate.Text | Out-Null
    $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneWait.track_key
    $LaneState.implementation_message_id = [string]$Candidate.MessageId
    $LaneState.implementation_candidate_identity = Get-OCRouterCandidateIdentity -Candidate $Candidate
    $LaneState.candidate_identity = Get-OCRouterTopLevelFieldValue -Text $Candidate.Text -Field 'Candidate identity/worktree limitations'
    $LaneRuntime = @($Lanes | Where-Object { [string]$_.track_key -ceq [string]$LaneWait.track_key })[0]
    $LaneRuntime.candidate_identity = [string]$LaneState.candidate_identity
    $LaneState.implementation_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }

  Wait-OCRouterParallelOutputs -LaneContexts @($PendingImplementationWaits.ToArray()) -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'track_implementation_report' -AutoUseFirstStable:$AutoUseFirstStable -OnLaneCompleted $OnImplementationCompleted | Out-Null
}
foreach ($LaneItem in $Lanes) {
  if ([string]::IsNullOrWhiteSpace([string]$LaneItem.candidate_identity)) { throw "Lane '$($LaneItem.track_key)' lacks a pinned Candidate identity." }
}

$HadResolvedReviewControls = -not [string]::IsNullOrWhiteSpace([string]$State.review_controls_source)
$ApprovalTarget = @($Lanes | ForEach-Object { "$($_.track_key)=$($_.target)" }) -join ';'
$ApprovalEpic = @($Lanes | ForEach-Object { "$($_.track_key)=$($_.epic_id)" }) -join ';'
$ApprovalCandidate = @($Lanes | ForEach-Object {
  $Identity = Get-OCRouterTopLevelFieldValue -Text ([string]$LaneTexts[$_.track_key]) -Field 'Candidate identity/worktree limitations'
  "$($_.track_key)=$Identity"
}) -join ';'
$ReviewControls = Resolve-OCRouterReviewControls `
  -ReviewCycleIndex $ReviewCycleIndex `
  -RequestedMetaInternalLanes $(if ($HadResolvedReviewControls) { [int]$State.effective_meta_internal_lanes } else { $MetaInternalLanes }) `
  -ExplicitMetaInternalLanes ($HadResolvedReviewControls -or $PSBoundParameters.ContainsKey('MetaInternalLanes')) `
  -ExplicitSkipSwarmReview $(if ($HadResolvedReviewControls) { [bool]$State.effective_skip_swarm_review } else { $PSBoundParameters.ContainsKey('SkipSwarmReview') }) `
  -ExplicitUseSwarmReview $(if ($HadResolvedReviewControls) { -not [bool]$State.effective_skip_swarm_review } else { $PSBoundParameters.ContainsKey('UseSwarmReview') }) `
  -ForceFullReview:$ForceFullReview `
  -ReviewProfile $(if ($HadResolvedReviewControls) { [string]$State.review_profile } else { $ReviewProfile }) `
  -ExplicitReviewProfile ($HadResolvedReviewControls -or $PSBoundParameters.ContainsKey('ReviewProfile')) `
  -ProjectReviewContext $(if ($HadResolvedReviewControls) { [string]$State.project_review_context } else { $ProjectReviewContext }) `
  -ReviewFocus $ReviewFocus `
  -RequestedReviewLanes $(if ($HadResolvedReviewControls) { @($State.review_lanes) } else { $ReviewLanes }) `
  -ExplicitReviewLanes ($HadResolvedReviewControls -or $PSBoundParameters.ContainsKey('ReviewLanes')) `
  -ExpandedReviewApproved ([bool]$ExpandedReviewApproved) `
  -OwnerApprovalRecord $OwnerApprovalRecord `
  -ReviewRegistryPath $ReviewRegistryPath `
  -RequestedSwarmReviewDepth $SwarmReviewDepth `
  -ApprovalTarget $ApprovalTarget `
  -ApprovalEpic $ApprovalEpic `
  -ApprovalCandidate $ApprovalCandidate `
  -ApprovalCostEnvelope $OwnerApprovalCostEnvelope `
  -ImplementationTexts @($LaneTexts.Values)

if ($HadResolvedReviewControls) {
  foreach ($Pin in @(
    @{ Name = 'review registry path'; Saved = [string]$State.review_registry_path; Current = [string]$ReviewControls.review_registry_path },
    @{ Name = 'review registry hash'; Saved = [string]$State.review_registry_sha256; Current = [string]$ReviewControls.review_registry_sha256 },
    @{ Name = 'review registry version'; Saved = [string]$State.review_registry_version; Current = [string]$ReviewControls.review_registry_version },
    @{ Name = 'owner approval path'; Saved = [string]$State.owner_approval_record; Current = [string]$ReviewControls.owner_approval_record },
    @{ Name = 'owner approval hash'; Saved = [string]$State.owner_approval_sha256; Current = [string]$ReviewControls.owner_approval_sha256 },
    @{ Name = 'owner approval identity'; Saved = [string]$State.owner_approval_identity; Current = [string]$ReviewControls.owner_approval_identity }
  )) {
    if ($Pin.Saved -cne $Pin.Current) { throw "Resume review-control drift for $($Pin.Name)." }
  }
}
$State.review_cycle_index = [int]$ReviewControls.review_cycle_index
$State.review_transport = 'native'
$State.budget_policy = [string]$ReviewControls.budget_policy
$State.assignment_cap = [int]$ReviewControls.assignment_cap
$State.requested_domains = @($ReviewControls.requested_domains)
$State.effective_meta_internal_lanes = [int]$ReviewControls.meta_internal_lanes
$State.effective_skip_swarm_review = $true
$State.review_controls_source = [string]$ReviewControls.source
$State.contract_risk_paths = @($ReviewControls.contract_risk_paths)
$State.review_profile = [string]$ReviewControls.review_profile
$State.project_review_context = [string]$ReviewControls.project_review_context
$State.review_focus = [string]$ReviewControls.review_focus
$State.review_lanes = @($ReviewControls.review_lanes)
$State.lane_selection_reason = [string]$ReviewControls.lane_selection_reason
$State.review_registry_path = [string]$ReviewControls.review_registry_path
$State.review_registry_sha256 = [string]$ReviewControls.review_registry_sha256
$State.review_registry_version = [int]$ReviewControls.review_registry_version
$State.owner_approval_record = [string]$ReviewControls.owner_approval_record
$State.owner_approval_sha256 = [string]$ReviewControls.owner_approval_sha256
$State.owner_approval_version = [int]$ReviewControls.owner_approval_version
$State.owner_approval_identity = [string]$ReviewControls.owner_approval_identity
Save-ParallelStepRunState -RunDir $RunDir -State $State

$EffectiveSwarmReviewDepth = "none"
$State.effective_swarm_review_depth = "none"
$State.swarm_review_focus = ""
Save-ParallelStepRunState -RunDir $RunDir -State $State

Write-Host "Effective parallel review controls:" -ForegroundColor Cyan
Write-Host "- transport: native"
Write-Host "- budget policy: $([string]$ReviewControls.budget_policy)"
Write-Host "- assignment cap: $([int]$ReviewControls.assignment_cap)"
Write-Host "- legacy shape alias: $([string]$ReviewControls.review_profile)"
Write-Host "- project context: $([string]$ReviewControls.project_review_context)"
Write-Host "- requested domains: $(@($ReviewControls.requested_domains) -join ', ')"
Write-Host "- lane selection: $([string]$ReviewControls.lane_selection_reason)"
Write-Host "- source: $([string]$ReviewControls.source)"
if (@($ReviewControls.contract_risk_paths).Count -gt 0) {
  Write-Host "- contract risk paths:" -ForegroundColor Yellow
  foreach ($Path in @($ReviewControls.contract_risk_paths)) {
    Write-Host "  - $Path"
  }
}

$ReviewControlPrefix = New-OCRouterReviewControlArgumentPrefix `
  -SkipSwarmReview ([bool]$ReviewControls.skip_swarm_review) `
  -MetaInternalLanes ([int]$ReviewControls.meta_internal_lanes) `
  -ReviewProfile ([string]$ReviewControls.review_profile) `
  -ProjectReviewContext ([string]$ReviewControls.project_review_context) `
  -ModelProfile $ModelProfile `
  -ExpandedReviewApproved ([bool]$ExpandedReviewApproved) `
  -OwnerApprovalRecord $OwnerApprovalRecord `
  -ReviewRegistryPath $ReviewRegistryPath `
  -ReviewFocus ([string]$ReviewControls.review_focus) `
  -ReviewLanes @($ReviewControls.review_lanes)
$PacketEvidence = @($Lanes | ForEach-Object {
  $Path = (Resolve-Path -LiteralPath (Join-Path $RunDir ("01-{0}-implementation.md" -f $_.safe_name))).Path
  "{0}={1}#{2}" -f $_.track_key, $Path, (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}) -join ';'
$PacketScope = @($Lanes | ForEach-Object { "{0}={1}" -f $_.track_key, (Get-OCRouterTopLevelFieldValue -Text ([string]$LaneTexts[$_.track_key]) -Field 'Acceptance mapping') }) -join ';'
$PacketFocus = if ([string]::IsNullOrWhiteSpace([string]$ReviewControls.review_focus)) { 'NONE' } else { [string]$ReviewControls.review_focus }
$PacketInternalLanes = if (@($ReviewControls.review_lanes).Count -eq 0) { 'NONE' } else { @($ReviewControls.review_lanes) -join ',' }
$PacketCost = if ([string]::IsNullOrWhiteSpace([string]$ReviewControls.owner_approval_cost_envelope)) { 'bounded-default' } else { [string]$ReviewControls.owner_approval_cost_envelope }
$PacketApproval = if ([string]::IsNullOrWhiteSpace([string]$ReviewControls.owner_approval_record)) { 'NONE' } else { "{0}#{1}" -f [string]$ReviewControls.owner_approval_record, [string]$ReviewControls.owner_approval_sha256 }
$RequiredNativeBindings = @('REQUIRED NATIVE REVIEW BINDINGS', "Target: $ApprovalTarget", "Epic: $ApprovalEpic", "Candidate: $ApprovalCandidate", "Evidence pointers: $PacketEvidence", "Reviewed scope/acceptance: $PacketScope", "Review focus: $PacketFocus", 'Review transport: native', "Budget policy: $([string]$ReviewControls.budget_policy)", "Assignment cap: $([int]$ReviewControls.assignment_cap)", "Requested domains: $PacketInternalLanes", "Legacy shape alias: $([string]$ReviewControls.review_profile)", "Cost envelope: $PacketCost", "Expansion approval receipt: $PacketApproval") -join "`n"
$CombinedRequest = "$ReviewControlPrefix`n`n$RequiredNativeBindings`n`n$(New-OCRouterParallelStepReviewRequest -Lanes $Lanes -LaneTexts $LaneTexts)"
Save-ParallelStepRunText -RunDir $RunDir -Name "02-meta-combined-step-review-request.md" -Text $CombinedRequest | Out-Null

$MetaReadUri = "$Server/session/$($MetaEntry.sessionId)/message?limit=$Limit"

if (-not [bool]$State.sent_meta_step_review) {
  $MetaBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $State.meta_baseline_message_id_before_step_review = [string]$MetaBaseline.MessageId
  $State.meta_baseline_before_step_review = "id:$($MetaBaseline.MessageId)"
  Save-ParallelStepRunState -RunDir $RunDir -State $State

  Invoke-ParallelCommand -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Command "step-review" -Arguments $CombinedRequest -PreviewTitle "Combined Meta /step-review for $($Lanes.Count) lanes" -Model $MetaModel -RunDir $RunDir -Transition 'parallel-step-review-to-meta' -BaselineIdentity ([string]$State.meta_baseline_before_step_review) -CandidateIdentity $ApprovalCandidate -Stage 'parallel_step_review_dispatch' -AutoApprove:$AutoApprove | Out-Null
  $State.sent_meta_step_review = $true
  Save-ParallelStepRunState -RunDir $RunDir -State $State
}
else {
  Write-Host "Resume: skipping already-sent combined Meta /step-review." -ForegroundColor Cyan
}

$FinalSynthesis = ""
$ParallelFinalContext = [pscustomobject]@{
  lanes = $Lanes
  surfaced_finding_ids = @()
}
if ([bool]$ReviewControls.skip_swarm_review) {
  Write-Host "SkipSwarmReview active. Waiting directly for combined Meta final synthesis." -ForegroundColor Cyan

  if ([bool]$State.meta_final_received) {
    $FinalPath = Join-Path $RunDir "06-meta-final-synthesis.md"
    if (-not (Test-Path $FinalPath)) {
      throw "Missing saved final synthesis artifact: $FinalPath"
    }

    $FinalSynthesis = Get-Content $FinalPath -Raw
    if (-not (Test-OCRouterParallelTrackResponseEnvelope -Text $FinalSynthesis -Lanes $Lanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds @($ParallelFinalContext.surfaced_finding_ids))) { throw 'Saved combined final synthesis no longer validates against the exact lane envelope.' }
    Write-Host "Resume: using saved Meta final synthesis." -ForegroundColor Cyan
  }
  else {
    $MetaFinalCandidate = Wait-OCRouterNewOutput -Label "Meta combined FINAL STEP REVIEW SYNTHESIS" -Uri $MetaReadUri -Headers $Headers -BaselineIdentity ([string]$State.meta_baseline_before_step_review) -BaselineMessageId ([string]$State.meta_baseline_message_id_before_step_review) -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'parallel_meta_final_synthesis' -ExpectedOutputContext $ParallelFinalContext -AutoUseFirstStable:$AutoUseFirstStable
    $FinalSynthesis = $MetaFinalCandidate.Text
    $FinalPath = Save-ParallelStepRunText -RunDir $RunDir -Name "06-meta-final-synthesis.md" -Text $FinalSynthesis
    $State.meta_final_artifact_pin = New-OCRouterArtifactPin -Path $FinalPath -ProducerMessageId ([string]$MetaFinalCandidate.MessageId) -Stage 'parallel_meta_final_synthesis' -CandidateIdentity (Get-OCRouterCandidateIdentity -Candidate $MetaFinalCandidate)
    $State.meta_final_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
}
else {
  $MetaPhase1Text = ""
  if ([bool]$State.meta_phase1_received) {
    $MetaPhase1Path = Join-Path $RunDir "03-meta-phase1.md"
    if (-not (Test-Path $MetaPhase1Path)) {
      throw "Missing saved Meta phase 1 artifact: $MetaPhase1Path"
    }

    $MetaPhase1Text = Get-Content $MetaPhase1Path -Raw
    Write-Host "Resume: using saved Meta phase 1 output." -ForegroundColor Cyan
  }
  else {
    $MetaPhase1Candidate = Wait-OCRouterNewOutput -Label "Meta combined step-review phase 1 output" -Uri $MetaReadUri -Headers $Headers -BaselineIdentity ([string]$State.meta_baseline_before_step_review) -BaselineMessageId ([string]$State.meta_baseline_message_id_before_step_review) -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'meta_step_review_phase1' -ExpectedOutputContext $Phase1Context -AutoUseFirstStable:$AutoUseFirstStable
    $MetaPhase1Text = $MetaPhase1Candidate.Text
    Save-ParallelStepRunText -RunDir $RunDir -Name "03-meta-phase1.md" -Text $MetaPhase1Text | Out-Null
    $State.meta_phase1_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }

  if (-not (Test-OCRouterStrictStepReviewPhase1Output -Text $MetaPhase1Text -Context $Phase1Context)) { throw 'Saved parallel Phase-1 packet drifted from frozen aggregate bindings.' }

  $SwarmPrompt = Get-OCRouterSwarmReviewPacket -Text $MetaPhase1Text
  if ([string]::IsNullOrWhiteSpace($SwarmPrompt)) {
    throw "Failed to extract combined Swarm prompt from Meta phase 1 output."
  }
  if (-not (Test-OCRouterSwarmReviewPacketOutput -Text $SwarmPrompt -Context $Phase1Context)) { throw 'Extracted parallel Swarm packet binding drift.' }
  Save-ParallelStepRunText -RunDir $RunDir -Name "04-swarm-prompt.md" -Text $SwarmPrompt | Out-Null

  if (-not [bool]$State.sent_prompt_to_swarm_assistant) {
    Write-Host "Dispatching combined Swarm prompt and Meta GO back-to-back; not waiting for Swarm output before GO." -ForegroundColor Cyan
    $SwarmBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $SwarmReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $State.swarm_baseline_message_id_before_prompt = [string]$SwarmBaseline.MessageId
    $State.swarm_baseline_before_prompt = "id:$($SwarmBaseline.MessageId)"
    Save-ParallelStepRunState -RunDir $RunDir -State $State

    Invoke-ParallelCommand -LogicalName $SwarmAssistant -Entry $SwarmEntry -Server $Server -Headers $Headers -Command 'swarm-review' -Arguments $SwarmPrompt -PreviewTitle 'Combined Meta Swarm packet -> Swarm Assistant /swarm-review' -Model $SwarmMessageModel -RunDir $RunDir -Transition 'parallel-swarm-review-command' -BaselineIdentity ([string]$State.swarm_baseline_before_prompt) -CandidateIdentity $ApprovalCandidate -Stage 'parallel_swarm_review_dispatch' -AutoApprove:$AutoApprove | Out-Null
    $State.swarm_dispatch_intent_path = Join-Path (Join-Path $RunDir 'dispatch-intents') 'parallel-swarm-review-command.json'
    $State.sent_prompt_to_swarm_assistant = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  else {
    Write-Host "Resume: skipping already-sent Swarm prompt." -ForegroundColor Cyan
  }

  if ([string]::IsNullOrWhiteSpace([string]$State.swarm_dispatch_intent_path) -and [bool]$State.sent_prompt_to_swarm_assistant) {
    $State.swarm_dispatch_intent_path = Join-Path (Join-Path $RunDir 'dispatch-intents') 'parallel-swarm-review-command.json'
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  if (-not (Test-Path -LiteralPath ([string]$State.swarm_dispatch_intent_path) -PathType Leaf)) { throw 'Parallel GO is forbidden before proven Swarm dispatch.' }
  $SwarmIntent = Get-Content -LiteralPath ([string]$State.swarm_dispatch_intent_path) -Raw | ConvertFrom-Json
  if ([string]$SwarmIntent.status -cne 'dispatched' -or [string]$SwarmIntent.operation -cne 'swarm-review') { throw 'Parallel GO is forbidden because Swarm delivery is unproven.' }

  if (-not [bool]$State.sent_go_to_meta) {
    $MetaGoBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    Send-ParallelMessage -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Text "GO" -PreviewTitle "Send GO to Meta immediately after combined Swarm prompt dispatch" -Model $MetaModel -RunDir $RunDir -Transition 'parallel-go-to-meta' -BaselineIdentity ("id:{0}" -f $MetaGoBaseline.MessageId) -CandidateIdentity $ApprovalCandidate -Stage 'parallel_meta_go_control' -AutoApprove:$AutoApprove | Out-Null
    $State.sent_go_to_meta = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  else {
    Write-Host "Resume: skipping already-sent GO to Meta." -ForegroundColor Cyan
  }

  $SwarmReviewText = ""
  $SwarmOutputContext = [pscustomobject]@{ target = $ApprovalTarget; epic = $ApprovalEpic; candidate = $ApprovalCandidate; reviewed_scope = $PacketScope }
  if ([bool]$State.swarm_review_received) {
    $SwarmReviewPath = Join-Path $RunDir "05-swarm-review.md"
    if (-not (Test-Path $SwarmReviewPath)) {
      throw "Missing saved Swarm review artifact: $SwarmReviewPath"
    }

    $SwarmReviewText = Get-Content $SwarmReviewPath -Raw
    Write-Host "Resume: using saved Swarm review output." -ForegroundColor Cyan
  }
  else {
    $SwarmReviewCandidate = Wait-OCRouterNewOutput -Label "Swarm Assistant combined review output" -Uri $SwarmReadUri -Headers $Headers -BaselineIdentity ([string]$State.swarm_baseline_before_prompt) -BaselineMessageId ([string]$State.swarm_baseline_message_id_before_prompt) -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'swarm_review' -ExpectedOutputContext $SwarmOutputContext -AutoUseFirstStable:$AutoUseFirstStable
    $SwarmReviewText = $SwarmReviewCandidate.Text
    Save-ParallelStepRunText -RunDir $RunDir -Name "05-swarm-review.md" -Text $SwarmReviewText | Out-Null
    $State.swarm_review_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  if (-not (Test-OCRouterStrictSwarmReviewOutput -Text $SwarmReviewText -Context $SwarmOutputContext)) { throw 'Saved parallel Swarm result binding drift.' }
  $SurfacedIds = @(Get-OCRouterSwarmFindingIds -Text $SwarmReviewText)
  if (@($State.surfaced_finding_ids).Count -gt 0 -and ((@($State.surfaced_finding_ids | Sort-Object) -join "`n") -cne (@($SurfacedIds | Sort-Object) -join "`n"))) { throw 'Parallel surfaced Swarm finding IDs drifted.' }
  $State.surfaced_finding_ids = @($SurfacedIds)
  Save-ParallelStepRunState -RunDir $RunDir -State $State
  $ParallelFinalContext = [pscustomobject]@{
    lanes = $Lanes
    surfaced_finding_ids = @($State.surfaced_finding_ids)
  }

  if (-not [bool]$State.sent_swarm_review_to_meta) {
    $MetaBeforeSwarmReview = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $State.meta_baseline_message_id_before_swarm_review = [string]$MetaBeforeSwarmReview.MessageId
    $State.meta_baseline_before_swarm_review = "id:$($MetaBeforeSwarmReview.MessageId)"
    Save-ParallelStepRunState -RunDir $RunDir -State $State

    Send-ParallelMessage -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Text $SwarmReviewText -PreviewTitle "Combined Swarm review -> Meta plain evidence return" -Model $MetaModel -RunDir $RunDir -Transition 'parallel-swarm-evidence-to-meta' -BaselineIdentity ([string]$State.meta_baseline_before_swarm_review) -CandidateIdentity $ApprovalCandidate -Stage 'parallel_swarm_evidence_return' -AutoApprove:$AutoApprove | Out-Null
    $State.sent_swarm_review_to_meta = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  else {
    Write-Host "Resume: skipping already-sent combined Swarm review to Meta." -ForegroundColor Cyan
  }

  if ([bool]$State.meta_final_received) {
    $FinalPath = Join-Path $RunDir "06-meta-final-synthesis.md"
    if (-not (Test-Path $FinalPath)) {
      throw "Missing saved final synthesis artifact: $FinalPath"
    }

    $FinalSynthesis = Get-Content $FinalPath -Raw
    if (-not (Test-OCRouterParallelTrackResponseEnvelope -Text $FinalSynthesis -Lanes $Lanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds @($ParallelFinalContext.surfaced_finding_ids))) { throw 'Saved combined final synthesis no longer validates against the exact lane envelope.' }
    Write-Host "Resume: using saved Meta final synthesis." -ForegroundColor Cyan
  }
  else {
    $MetaFinalCandidate = Wait-OCRouterNewOutput -Label "Meta combined FINAL STEP REVIEW SYNTHESIS" -Uri $MetaReadUri -Headers $Headers -BaselineIdentity ([string]$State.meta_baseline_before_swarm_review) -BaselineMessageId ([string]$State.meta_baseline_message_id_before_swarm_review) -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'parallel_meta_final_synthesis' -ExpectedOutputContext $ParallelFinalContext -AutoUseFirstStable:$AutoUseFirstStable
    $FinalSynthesis = $MetaFinalCandidate.Text
    $FinalPath = Save-ParallelStepRunText -RunDir $RunDir -Name "06-meta-final-synthesis.md" -Text $FinalSynthesis
    $State.meta_final_artifact_pin = New-OCRouterArtifactPin -Path $FinalPath -ProducerMessageId ([string]$MetaFinalCandidate.MessageId) -Stage 'parallel_meta_final_synthesis' -CandidateIdentity (Get-OCRouterCandidateIdentity -Candidate $MetaFinalCandidate)
    $State.meta_final_received = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
}

if (-not (Test-OCRouterParallelTrackResponseEnvelope -Text $FinalSynthesis -Lanes $Lanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds @($ParallelFinalContext.surfaced_finding_ids))) {
  throw 'Combined final synthesis does not match the exact lane envelope; refusing fanout.'
}
$FinalArtifactPath = Join-Path $RunDir '06-meta-final-synthesis.md'
if ($null -eq $State.meta_final_artifact_pin) {
  throw 'Parallel final synthesis lacks its producer/candidate artifact pin; checkpoint and delivery fanout cannot be resumed safely.'
}
Assert-OCRouterArtifactPin -Pin $State.meta_final_artifact_pin | Out-Null
if ([string]$State.meta_final_artifact_pin.path -cne (Resolve-Path -LiteralPath $FinalArtifactPath -ErrorAction Stop).Path) {
  throw 'Parallel final synthesis artifact pin path drift.'
}
foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneItem.track_key
  $TrackBlock = Get-OCRouterTrackResponseBlock -Text $FinalSynthesis -Track $LaneItem.track_key -ExpectedTarget $LaneItem.target -ExpectedCommand "step-review-utan"
  $LaneState.closeout_disposition = Get-OCRouterFinalSynthesisDisposition -Text ([string]$TrackBlock.body)
  $LaneState.accepted_finding_ids = @(Get-OCRouterFinalOpenFixFindingIds -Text ([string]$TrackBlock.body))
  if (-not [bool]$LaneState.sent_step_review_utan) {
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.step_review_utan_baseline_message_id)) {
      $TrackBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $LaneReadUris[$LaneItem.track_key] -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
      $LaneState.step_review_utan_baseline_message_id = [string]$TrackBaseline.MessageId
      $LaneState.step_review_utan_baseline_identity = "id:$($TrackBaseline.MessageId)"
      Save-ParallelStepRunState -RunDir $RunDir -State $State
    }

    Save-ParallelStepRunText -RunDir $RunDir -Name ("07-{0}-step-review-utan.md" -f $LaneItem.safe_name) -Text $TrackBlock.body | Out-Null
    Invoke-ParallelCommand -LogicalName $LaneItem.track_key -Entry $LaneItem.session_entry -Server $Server -Headers $Headers -Command "step-review-utan" -Arguments $TrackBlock.body -PreviewTitle "Meta final synthesis -> $($LaneItem.role_label) /step-review-utan" -RunDir $RunDir -Transition ("step-review-utan-{0}" -f $LaneItem.safe_name) -BaselineIdentity ([string]$LaneState.step_review_utan_baseline_identity) -CandidateIdentity ([string]$LaneItem.candidate_identity) -Stage 'parallel_delivery_response_dispatch' -AutoApprove:$AutoApprove | Out-Null
    $LaneState.sent_step_review_utan = $true
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
  else {
    Write-Host "Resume: skipping already-sent /step-review-utan for $($LaneItem.role_label)." -ForegroundColor Cyan
  }
}

$TrackResults = @()
if ($WaitForTrackResponses) {
  $PendingTrackResponseWaits = New-Object System.Collections.Generic.List[object]
  foreach ($LaneItem in $Lanes) {
    $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneItem.track_key
    $DeliveryContext = [pscustomobject]@{ target = $LaneItem.target; epic = $LaneItem.epic_id; candidate = $LaneItem.candidate_identity; accountable_lane = $LaneItem.accountable_lane; lane_class = $LaneItem.lane_class; lane_profile = $LaneItem.lane_profile; closeout_disposition = [string]$LaneState.closeout_disposition; accepted_finding_ids = @($LaneState.accepted_finding_ids) }
    if ([bool]$LaneState.track_response_received) {
      Write-Host "Resume: using saved Track response for $($LaneItem.role_label)." -ForegroundColor Cyan
      continue
    }

    $PendingTrackResponseWaits.Add([pscustomobject]@{
      track_key = $LaneItem.track_key
      safe_name = $LaneItem.safe_name
      label = "$($LaneItem.role_label) /step-review-utan response"
      uri = $LaneReadUris[$LaneItem.track_key]
      baseline_identity = [string]$LaneState.step_review_utan_baseline_identity
      baseline_message_id = [string]$LaneState.step_review_utan_baseline_message_id
      expected_output_context = $DeliveryContext
    }) | Out-Null
  }

  if ($PendingTrackResponseWaits.Count -gt 0) {
    $OnTrackResponseCompleted = {
      param($LaneWait, $Candidate)

      $TrackResponseText = $Candidate.Text
      Save-ParallelStepRunText -RunDir $RunDir -Name ("08-{0}-track-response.md" -f $LaneWait.safe_name) -Text $TrackResponseText | Out-Null
      $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneWait.track_key
      $LaneState.track_response_mode = Get-OCRouterModeFromText -Text $TrackResponseText
      $LaneState.track_response_message_id = [string]$Candidate.MessageId
      $LaneState.track_response_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $RunDir ("08-{0}-track-response.md" -f $LaneWait.safe_name))).Hash
      $LaneState.track_response_received = $true
      Save-ParallelStepRunState -RunDir $RunDir -State $State
    }

    Wait-OCRouterParallelOutputs -LaneContexts @($PendingTrackResponseWaits.ToArray()) -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars 1 -ExpectedOutputKind 'delivery_step_response' -AutoUseFirstStable:$AutoUseFirstStable -OnLaneCompleted $OnTrackResponseCompleted | Out-Null
  }

  foreach ($LaneItem in $Lanes) {
    $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneItem.track_key
    $DeliveryContext = [pscustomobject]@{ target = $LaneItem.target; epic = $LaneItem.epic_id; candidate = $LaneItem.candidate_identity; accountable_lane = $LaneItem.accountable_lane; lane_class = $LaneItem.lane_class; lane_profile = $LaneItem.lane_profile; closeout_disposition = [string]$LaneState.closeout_disposition; accepted_finding_ids = @($LaneState.accepted_finding_ids) }
    $TrackResponsePath = Join-Path $RunDir ("08-{0}-track-response.md" -f $LaneItem.safe_name)
    $TrackResponseText = if (Test-Path $TrackResponsePath) { Get-Content $TrackResponsePath -Raw } else { "" }
    if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $TrackResponseText -Context $DeliveryContext)) { throw "Saved Delivery response for '$($LaneItem.track_key)' is malformed, ambiguous, or inconsistent with final disposition." }
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.track_response_message_id)) { throw "Delivery response for '$($LaneItem.track_key)' lacks its producer message-ID pin." }
    $ResponseHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $TrackResponsePath).Hash
    if ([string]$LaneState.track_response_sha256 -cne $ResponseHash) { throw "Delivery response hash drift for '$($LaneItem.track_key)'." }
    $TrackResults += [pscustomobject]@{
      track_key = $LaneItem.track_key
      target = $LaneItem.target
      mode = [string]$LaneState.track_response_mode
      artifact = $TrackResponsePath
      text = $TrackResponseText
    }
  }
}

if ($FalSyncCheckpoint) {
  $FalSyncStage = if ($ReviewCycleIndex -gt 0) { 'review_fix_delivery_response' } else { 'step_review_delivery_response' }
  foreach ($LaneItem in $Lanes) {
    $LaneState = Get-ParallelStepLaneState -State $State -TrackKey $LaneItem.track_key
    $ResponseArtifactPath = Join-Path $RunDir ("08-{0}-track-response.md" -f $LaneItem.safe_name)
    $DispatchIntentPath = Join-Path $RunDir ("dispatch-intents\step-review-utan-{0}.json" -f $LaneItem.safe_name)
    Publish-ParallelStepFalCheckpointProposal `
      -RunDir $RunDir `
      -LaneItem $LaneItem `
      -LaneState $LaneState `
      -FinalArtifactPath $FinalArtifactPath `
      -FinalArtifactPin $State.meta_final_artifact_pin `
      -ResponseArtifactPath $ResponseArtifactPath `
      -DispatchIntentPath $DispatchIntentPath `
      -Meta $Meta `
      -Wave $Wave `
      -Stage $FalSyncStage `
      -ProjectId $FalProjectId `
      -ProjectName $FalProjectName `
      -TargetRepoKind $ResolvedFalTargetRepoKind `
      -TargetRepoRoot $ResolvedFalTargetRepoPath `
      -TargetWorktree $ResolvedFalTargetWorktreePath `
      -TargetHead $FalTargetHead `
      -TargetRef $FalTargetRef `
      -TargetStatus $FalTargetStatus `
      -ControlRoot $ResolvedFalControlRoot | Out-Null
    Save-ParallelStepRunState -RunDir $RunDir -State $State
  }
}

$State.completed_at = (Get-Date).ToString("o")
Save-ParallelStepRunState -RunDir $RunDir -State $State
if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose(); $RunLockHandle = $null }

$FinalVerdict = Get-OCRouterNormalizedVerdict -Text $FinalSynthesis

Write-Host "Parallel step-review flow completed or resumed. Runtime artifacts: $RunDir" -ForegroundColor Green

[pscustomobject]@{
  run_id = $RunId
  run_dir = $RunDir
  lane_count = $Lanes.Count
  final_verdict = $FinalVerdict
  lanes = @($Lanes | ForEach-Object { "{0}|{1}|{2}" -f $_.track_key, $_.target, $_.epic_id })
  track_results = @($TrackResults)
}
