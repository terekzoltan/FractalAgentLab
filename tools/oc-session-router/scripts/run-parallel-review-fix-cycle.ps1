param(
  [Parameter(Mandatory=$true)]
  [string[]]$Lane,
  [Parameter(Mandatory=$true)]
  [string]$SourceManifestPath,
  [int]$CycleIndex = 1,
  [string]$RunId = '',
  [string]$StepReviewRunId = '',
  [switch]$Resume,
  [switch]$InspectOnly,

  [string]$Meta = 'meta',
  [string]$SwarmAssistant = 'swarm-assistant',
  [int]$PollSeconds = 15,
  [int]$TimeoutMinutes = 45,
  [int]$Limit = 5,
  [int]$CandidateCount = 3,
  [int]$StablePolls = 2,
  [int]$MinOutputChars = 150,
  [string]$RouterDir = '.opencode-router',
  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { 'opencode' }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,
  [switch]$AssumeOldestFirst,
  [switch]$IncludeReasoningParts,
  [switch]$AutoUseFirstStable,
  [switch]$AutoApprove,

  [int]$MetaInternalLanes = -1,
  [switch]$SkipSwarmReview,
  [switch]$UseSwarmReview,
  [switch]$ForceFullReview,
  [string]$ReviewProfile = 'auto',
  [string]$ProjectReviewContext = 'auto',
  [string]$ReviewFocus = '',
  [string[]]$ReviewLanes = @(),
  [switch]$ExpandedReviewApproved,
  [string]$OwnerApprovalRecord = '',
  [string]$OwnerApprovalCostEnvelope = '',
  [string]$ReviewRegistryPath = '',
  [string]$ModelProfile = 'economy',
  [string]$MetaModel = 'openai/gpt-5.6-sol',
  [string]$SwarmMessageModel = 'openai/gpt-5.6-sol',
  [string]$SwarmReviewDepth = 'auto',
  [string]$SwarmReviewFocus = '',

  [switch]$FalSyncCheckpoint,
  [string]$FalProjectId = '',
  [string]$FalProjectName = '',
  [string]$FalTargetRepoKind = '',
  [string]$FalTargetRepoPath = '',
  [string]$FalTargetWorktreePath = '',
  [string]$FalTargetHead = '',
  [string]$FalTargetRef = '',
  [string]$FalTargetStatus = '',
  [string]$FalControlRoot = ''
)

$ErrorActionPreference = 'Stop'
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: parallel review-fix dispatch is unavailable.'
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')

function Resolve-ParallelReviewFixFile {
  param([string]$Field, [string]$Path, [string]$BaseDirectory = '')
  if ([string]::IsNullOrWhiteSpace($Path)) { throw "$Field is required." }
  $CandidatePath = if ([IO.Path]::IsPathRooted($Path)) { $Path } elseif (-not [string]::IsNullOrWhiteSpace($BaseDirectory)) { Join-Path $BaseDirectory $Path } else { Join-Path (Get-Location).Path $Path }
  if (-not (Test-Path -LiteralPath $CandidatePath -PathType Leaf)) { throw "$Field was not found: $CandidatePath" }
  return (Resolve-Path -LiteralPath $CandidatePath -ErrorAction Stop).Path
}

function Save-ParallelReviewFixState {
  param([string]$RunDirectory, [object]$State)
  Write-OCRouterAtomicJsonFile -Path (Join-Path $RunDirectory 'state.json') -Value $State
}

function Load-ParallelReviewFixState {
  param([string]$RunDirectory)
  $Path = Join-Path $RunDirectory 'state.json'
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing parallel review-fix state: $Path" }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-ParallelReviewFixLaneState {
  param([object]$State, [string]$TrackKey)
  $Matches = @($State.lanes | Where-Object { [string]$_.track_key -ceq $TrackKey })
  if ($Matches.Count -ne 1) { throw "Parallel review-fix state does not contain exactly one lane '$TrackKey'." }
  return $Matches[0]
}

function Get-ParallelReviewFixManifestEntry {
  param([object]$Manifest, [string]$TrackKey)
  $Matches = @($Manifest.lanes | Where-Object { [string]$_.track_key -ceq $TrackKey })
  if ($Matches.Count -ne 1) { throw "Source manifest must contain exactly one entry for '$TrackKey'." }
  return $Matches[0]
}

function Assert-ParallelReviewFixManifestEntry {
  param([object]$Entry, [object]$LaneItem, [string]$ManifestDirectory)
  $ExpectedNames = @('track_key','wave','candidate','accountable_lane_id','accountable_lane_class','accountable_lane_profile','final_synthesis_path','delivery_response_path','delivery_receipt_path','fal_checkpoint_proposal_path')
  $ActualNames = @($Entry.PSObject.Properties.Name)
  $ActualSchema = (@($ActualNames | Sort-Object) -join "`n")
  $ExpectedSchema = (@($ExpectedNames | Sort-Object) -join "`n")
  if ($ActualSchema -cne $ExpectedSchema) { throw "Manifest entry '$($LaneItem.track_key)' has missing or extra fields." }
  foreach ($Name in @('track_key','wave','candidate','accountable_lane_id','accountable_lane_class','accountable_lane_profile','final_synthesis_path','delivery_response_path','delivery_receipt_path','fal_checkpoint_proposal_path')) {
    if ([string]::IsNullOrWhiteSpace([string]$Entry.$Name)) { throw "Manifest entry '$($LaneItem.track_key)' field '$Name' is missing." }
  }
  if ([string]$Entry.track_key -cne [string]$LaneItem.track_key -or [string]$Entry.accountable_lane_id -cne [string]$LaneItem.accountable_lane -or
      [string]$Entry.accountable_lane_class -cne [string]$LaneItem.lane_class -or [string]$Entry.accountable_lane_profile -cne [string]$LaneItem.lane_profile) {
    throw "Manifest lane identity does not match resolved lane '$($LaneItem.track_key)'."
  }
  $Entry.final_synthesis_path = Resolve-ParallelReviewFixFile -Field "$($LaneItem.track_key).final_synthesis_path" -Path ([string]$Entry.final_synthesis_path) -BaseDirectory $ManifestDirectory
  $Entry.delivery_response_path = Resolve-ParallelReviewFixFile -Field "$($LaneItem.track_key).delivery_response_path" -Path ([string]$Entry.delivery_response_path) -BaseDirectory $ManifestDirectory
  $Entry.delivery_receipt_path = Resolve-ParallelReviewFixFile -Field "$($LaneItem.track_key).delivery_receipt_path" -Path ([string]$Entry.delivery_receipt_path) -BaseDirectory $ManifestDirectory
  if ([string]$Entry.fal_checkpoint_proposal_path -ceq 'NONE') { $Entry.fal_checkpoint_proposal_path = '' }
  elseif (-not [string]::IsNullOrWhiteSpace([string]$Entry.fal_checkpoint_proposal_path)) {
    $Entry.fal_checkpoint_proposal_path = Resolve-ParallelReviewFixFile -Field "$($LaneItem.track_key).fal_checkpoint_proposal_path" -Path ([string]$Entry.fal_checkpoint_proposal_path) -BaseDirectory $ManifestDirectory
  }
}

function Test-ParallelReviewFixInputObject {
  param([object]$Left, [object]$Right)
  return ((Get-OCRouterStringSha256 -Text ($Left | ConvertTo-Json -Depth 20 -Compress)) -ceq (Get-OCRouterStringSha256 -Text ($Right | ConvertTo-Json -Depth 20 -Compress)))
}

function Write-ParallelReviewFixPinnedImplementationManifest {
  param(
    [string]$RunDirectory,
    [object[]]$Lanes,
    [object]$State
  )

  $Entries = @()
  foreach ($LaneItem in $Lanes) {
    $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey ([string]$LaneItem.track_key)
    Assert-OCRouterArtifactPin -Pin $LaneState.implementation.artifact_pin | Out-Null
    $ResolvedArtifactPath = (Resolve-Path -LiteralPath ([string]$LaneState.implementation.artifact_path) -ErrorAction Stop).Path
    $ObservedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedArtifactPath).Hash
    if ($ObservedHash -cne [string]$LaneState.implementation.artifact_sha256 -or
        $ObservedHash -cne [string]$LaneState.implementation.artifact_pin.sha256 -or
        [string]$LaneState.implementation.candidate -cne (Get-OCRouterTopLevelFieldValue -Text (Get-Content -LiteralPath $ResolvedArtifactPath -Raw) -Field 'Candidate identity/worktree limitations')) {
      throw "Cannot create pinned step-review handoff because implementation identity drifted for '$($LaneItem.track_key)'."
    }
    $Entries += [ordered]@{
      track_key = [string]$LaneItem.track_key
      target = [string]$LaneItem.target
      epic = [string]$LaneItem.epic_id
      candidate = [string]$LaneState.implementation.candidate
      accountable_lane_id = [string]$LaneItem.accountable_lane
      accountable_lane_class = [string]$LaneItem.lane_class
      accountable_lane_profile = [string]$LaneItem.lane_profile
      artifact_path = $ResolvedArtifactPath
      artifact_sha256 = $ObservedHash
      producer_message_id = [string]$LaneState.implementation.artifact_pin.producer_message_id
      candidate_identity = [string]$LaneState.implementation.artifact_pin.candidate_identity
    }
  }
  $ManifestPath = Join-Path $RunDirectory 'step-pinned-implementations.json'
  Write-OCRouterAtomicJsonFile -Path $ManifestPath -Value ([ordered]@{ version = 1; lanes = @($Entries) })
  return [pscustomobject]@{
    path = (Resolve-Path -LiteralPath $ManifestPath -ErrorAction Stop).Path
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ManifestPath).Hash
  }
}

function New-ParallelReviewFixFalIdentity {
  param(
    [object]$LaneItem,
    [object]$LaneState,
    [string]$Stage,
    [string]$ArtifactPath
  )
  $ArtifactHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ArtifactPath).Hash
  return New-OCRouterFalCheckpointIdentity `
    -TargetProjectId $FalProjectId -TargetRepoKind $FalTargetRepoKind -TargetRepoRoot $FalTargetRepoPath `
    -TargetWorktree $FalTargetWorktreePath -TargetHead $FalTargetHead -TargetRef $FalTargetRef -TargetStatus $FalTargetStatus `
    -Wave ([string]$LaneState.wave) -Epic ([string]$LaneItem.epic_id) -Stage $Stage -Candidate ([string]$LaneState.implementation.candidate) `
    -AccountableLaneId ([string]$LaneItem.accountable_lane) -AccountableLaneClass ([string]$LaneItem.lane_class) `
    -AccountableLaneProfile ([string]$LaneItem.lane_profile) -LogicalSender $Meta -LogicalRecipient ([string]$LaneItem.track_key) `
    -SourceSession $Meta -ArtifactIdentity ("sha256:$ArtifactHash") -ArtifactPath $ArtifactPath -ArtifactHash $ArtifactHash `
    -ArtifactProducer $Meta -ControlRoot $FalControlRoot -SyncMode dry_run
}

function Write-ParallelReviewFixTerminalEvidence {
  param(
    [object]$LaneItem,
    [object]$LaneState,
    [string]$FinalArtifactPath,
    [string]$FinalBody,
    [string]$ResponseArtifactPath,
    [string]$ResponseMessageId,
    [string]$DispatchIntentPath
  )
  $FinalContext = [pscustomobject]@{
    target = [string]$LaneItem.target; epic = [string]$LaneItem.epic_id; candidate = [string]$LaneState.implementation.candidate
    accountable_lane = [string]$LaneItem.accountable_lane; lane_class = [string]$LaneItem.lane_class; lane_profile = [string]$LaneItem.lane_profile
  }
  if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $FinalBody -Context $FinalContext) -or
      -not (Test-OCRouterLaneContextBinding -Text $FinalBody -Context $FinalContext)) { throw "Lane '$($LaneItem.track_key)' final synthesis is not exact/context-bound." }
  $Disposition = Get-OCRouterFinalSynthesisDisposition -Text $FinalBody
  $FindingIds = @(Get-OCRouterFinalOpenFixFindingIds -Text $FinalBody)
  $PinnedLaneSynthesisPath = Join-Path $RunDir ("terminal-$($LaneItem.safe_name)-final-synthesis.md")
  Write-OCRouterAtomicTextFile -Path $PinnedLaneSynthesisPath -Text $FinalBody
  $ResponseText = Get-Content -LiteralPath $ResponseArtifactPath -Raw
  $DeliveryContext = [pscustomobject]@{
    target = [string]$LaneItem.target; epic = [string]$LaneItem.epic_id; candidate = [string]$LaneState.implementation.candidate
    accountable_lane = [string]$LaneItem.accountable_lane; lane_class = [string]$LaneItem.lane_class; lane_profile = [string]$LaneItem.lane_profile
    closeout_disposition = $Disposition; accepted_finding_ids = @($FindingIds)
  }
  if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $ResponseText -Context $DeliveryContext)) { throw "Lane '$($LaneItem.track_key)' Delivery response is not exact/context-bound." }
  $ResponseClass = Get-OCRouterModeFromText -Text $ResponseText
  $Identity = if ($FalSyncCheckpoint) { New-ParallelReviewFixFalIdentity -LaneItem $LaneItem -LaneState $LaneState -Stage 'review_fix_delivery_response' -ArtifactPath $PinnedLaneSynthesisPath } else { $null }
  $ReceiptPath = Write-OCRouterArtifactDeliveryReceipt `
    -RunDir $RunDir -Name ("terminal-$($LaneItem.safe_name)") -ArtifactPath $PinnedLaneSynthesisPath -ProducerSession $Meta -Command 'step-review' `
    -Target ([string]$LaneItem.target) -Recipient ([string]$LaneItem.track_key) -DeliveryProven $true -ResponseClass $ResponseClass `
    -ResponseArtifactPath $ResponseArtifactPath -ResponseMessageId $ResponseMessageId -DispatchIntentPath $DispatchIntentPath -FalCheckpointIdentity $Identity
  $ProposalPath = ''
  if ($FalSyncCheckpoint) {
    $Proposal = Write-OCRouterFalCheckpointTargetProposal `
      -RunDir $RunDir -Name ("terminal-$($LaneItem.safe_name)") -ProjectName $FalProjectName -Target ([string]$LaneItem.target) `
      -CheckpointIdentity $Identity -ReceiptPath $ReceiptPath -DeliveryResponseClass $ResponseClass
    $ProposalPath = [string]$Proposal.path
    Assert-OCRouterFalCheckpointTargetProposal -ProposalPath $ProposalPath -CheckpointIdentity $Identity -ProjectName $FalProjectName -Target ([string]$LaneItem.target) -ReceiptPath $ReceiptPath -DeliveryResponseClass $ResponseClass | Out-Null
  }
  return [pscustomobject]@{
    disposition = $Disposition
    response_class = $ResponseClass
    final_synthesis_path = $PinnedLaneSynthesisPath
    delivery_response_path = $ResponseArtifactPath
    receipt_path = $ReceiptPath
    proposal_path = $ProposalPath
    finding_ids = @($FindingIds)
  }
}

if ($CycleIndex -lt 1) { throw 'CycleIndex must be at least 1.' }
if ($Lane.Count -lt 1) { throw "At least one -Lane '<session>|<target>|<epic>' value is required; non-Track lanes use the explicit six-field form." }
if ($UseSwarmReview -or $ForceFullReview) { throw 'Active Swarm review transport is retired. Run the fix cycle with native /step-review.' }
if ((Normalize-OCRouterSwarmReviewDepth -Depth $SwarmReviewDepth) -notin @('auto','none')) { throw 'SwarmReviewDepth is retired. Use the native review budget/cap envelope.' }
$SkipSwarmReview = $true
if ($FalSyncCheckpoint) {
  foreach ($Required in @($FalProjectId,$FalProjectName,$FalTargetRepoKind,$FalTargetRepoPath,$FalTargetWorktreePath,$FalControlRoot)) {
    if ([string]::IsNullOrWhiteSpace([string]$Required)) { throw 'FalSyncCheckpoint requires the complete shared target/control tuple.' }
  }
}

$ResolvedManifest = Resolve-ParallelReviewFixFile -Field 'SourceManifestPath' -Path $SourceManifestPath
$Manifest = Get-Content -LiteralPath $ResolvedManifest -Raw | ConvertFrom-Json
if ([int]$Manifest.version -ne 1 -or $null -eq $Manifest.PSObject.Properties['lanes']) { throw 'Source manifest must use version 1 and contain lanes.' }
$ManifestDirectory = Split-Path -Parent $ResolvedManifest
$Config = Get-OCRouterConfig -RouterDir $RouterDir
$Lanes = @(ConvertTo-OCRouterLaneCollection -LaneSpecs $Lane -Config $Config)
if (@($Manifest.lanes).Count -ne $Lanes.Count) { throw 'Source manifest lane count must exactly match -Lane.' }
$SerialWrapper = Join-Path $PSScriptRoot 'run-review-fix-cycle.ps1'
$Inspections = @()
foreach ($LaneItem in $Lanes) {
  $Entry = Get-ParallelReviewFixManifestEntry -Manifest $Manifest -TrackKey $LaneItem.track_key
  Assert-ParallelReviewFixManifestEntry -Entry $Entry -LaneItem $LaneItem -ManifestDirectory $ManifestDirectory
  $InspectArgs = @{
    Track = [string]$LaneItem.track_key; Target = [string]$LaneItem.target; Epic = [string]$LaneItem.epic_id; Wave = [string]$Entry.wave
    Candidate = [string]$Entry.candidate; AccountableLaneId = [string]$Entry.accountable_lane_id; AccountableLaneClass = [string]$Entry.accountable_lane_class
    AccountableLaneProfile = [string]$Entry.accountable_lane_profile; PinnedFinalSynthesisPath = [string]$Entry.final_synthesis_path
    PinnedDeliveryResponsePath = [string]$Entry.delivery_response_path; PinnedDeliveryReceiptPath = [string]$Entry.delivery_receipt_path
    PinnedFalCheckpointProposalPath = [string]$Entry.fal_checkpoint_proposal_path; CycleIndex = $CycleIndex; Meta = $Meta; SwarmAssistant = $SwarmAssistant
    RouterDir = $RouterDir; InspectOnly = $true; FalSyncCheckpoint = $FalSyncCheckpoint; FalProjectId = $FalProjectId; FalProjectName = $FalProjectName
    FalTargetRepoKind = $FalTargetRepoKind; FalTargetRepoPath = $FalTargetRepoPath; FalTargetWorktreePath = $FalTargetWorktreePath
    FalTargetHead = $FalTargetHead; FalTargetRef = $FalTargetRef; FalTargetStatus = $FalTargetStatus; FalControlRoot = $FalControlRoot
  }
  $Inspection = & $SerialWrapper @InspectArgs
  $Inspections += [pscustomobject]@{ track_key = [string]$LaneItem.track_key; inspection = $Inspection }
}
if ($InspectOnly) { return [pscustomobject]@{ lane_count = $Lanes.Count; lanes = @($Inspections) } }

if ($Resume -and [string]::IsNullOrWhiteSpace($RunId)) { throw '-RunId is required with -Resume.' }
if ([string]::IsNullOrWhiteSpace($RunId)) { $RunId = "parallel-review-fix-$CycleIndex-$((Get-OCRouterSafeTimestamp))" }
if ([string]::IsNullOrWhiteSpace($StepReviewRunId)) { $StepReviewRunId = "$RunId-step" }
$RunDir = Join-Path (Join-Path $RouterDir 'review-fix-runs') (Get-OCRouterSafeName -Value $RunId)
$RunLock = Enter-OCRouterRunLock -RunDir $RunDir
trap {
  $Failure = $_
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  throw $Failure.Exception
}

$InputBinding = [pscustomobject][ordered]@{
  lanes = @($Lane); cycle_index = $CycleIndex; source_manifest_path = $ResolvedManifest; source_manifest_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedManifest).Hash
  meta = $Meta; swarm_assistant = $SwarmAssistant; fal_sync_checkpoint = [bool]$FalSyncCheckpoint
  fal_project_id = $FalProjectId; fal_project_name = $FalProjectName; fal_target_repo_kind = $FalTargetRepoKind; fal_target_repo_path = $FalTargetRepoPath
  fal_target_worktree_path = $FalTargetWorktreePath; fal_target_head = $FalTargetHead; fal_target_ref = $FalTargetRef; fal_target_status = $FalTargetStatus; fal_control_root = $FalControlRoot
}
$State = $null
if ($Resume) {
  $State = Load-ParallelReviewFixState -RunDirectory $RunDir
  if ([int]$State.version -ne 3) { throw 'Saved parallel review-fix run predates mandatory per-lane plan review/revision state and cannot resume safely.' }
  if (-not (Test-ParallelReviewFixInputObject -Left $InputBinding -Right $State.input_binding)) { throw 'Parallel review-fix resume input or manifest drift.' }
}
else {
  if (Test-Path -LiteralPath (Join-Path $RunDir 'state.json')) { throw "Run already exists; use -Resume -RunId '$RunId'." }
  $State = [pscustomobject][ordered]@{
    version = 3; run_id = $RunId; created_at = (Get-Date).ToString('o'); input_binding = $InputBinding; step_review_run_id = $StepReviewRunId
    plan_review = [pscustomobject][ordered]@{ baseline_message_id='';baseline_identity='';dispatch_intent_path='';artifact_path='';artifact_sha256='';artifact_pin=$null }
    lanes = @($Lanes | ForEach-Object {
      $Entry = Get-ParallelReviewFixManifestEntry -Manifest $Manifest -TrackKey $_.track_key
      $InspectionRecord = @($Inspections | Where-Object { [string]$_.track_key -ceq [string]$Entry.track_key })[0]
      if ($null -eq $InspectionRecord) { throw "Missing validated source inspection for '$($Entry.track_key)'." }
      [pscustomobject][ordered]@{
        track_key = [string]$_.track_key; target = [string]$_.target; epic = [string]$_.epic_id; wave = [string]$Entry.wave; source_candidate = [string]$Entry.candidate
        source_disposition = [string]$InspectionRecord.inspection.closeout_disposition
        source_fix_plan_path = [string]$Entry.delivery_response_path
        source_fix_plan_artifact = Get-OCRouterTopLevelFieldValue -Text (Get-Content -LiteralPath ([string]$Entry.delivery_response_path) -Raw) -Field 'Fix-plan artifact'
        revised_fix_plan_path = ''
        plan_revision = [pscustomobject][ordered]@{ baseline_message_id='';baseline_identity='';dispatch_intent_path='';artifact_path='';artifact_sha256='';artifact_pin=$null;terminal='';final_artifact_identity='' }
        implementation = [pscustomobject][ordered]@{ baseline_message_id='';baseline_identity='';dispatch_intent_path='';artifact_path='';artifact_sha256='';artifact_pin=$null;receipt_path='';terminal='';candidate='' }
        outcome = ''; terminal_synthesis_path = ''; terminal_delivery_response_path = ''; terminal_receipt_path = ''; fal_proposal_path = ''
      }
    })
    child = [pscustomobject][ordered]@{ mode='';run_id=$StepReviewRunId;run_dir='';status='not_started';pinned_implementation_manifest_path='';pinned_implementation_manifest_sha256='' }
    completed_at = ''
  }
  Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
}
foreach ($Field in @('pinned_implementation_manifest_path','pinned_implementation_manifest_sha256')) {
  if ($null -eq $State.child.PSObject.Properties[$Field]) {
    Add-Member -InputObject $State.child -MemberType NoteProperty -Name $Field -Value ''
  }
}

$FixLanes = @($Lanes | Where-Object { [string](Get-ParallelReviewFixLaneState -State $State -TrackKey $_.track_key).source_disposition -ceq 'FIX_REQUIRED' })
foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $LaneItem.track_key
  if ([string]$LaneState.source_disposition -ceq 'ALLOWED') { $LaneState.outcome = 'ACKNOWLEDGED_FOR_CLOSEOUT' }
  elseif ([string]$LaneState.source_disposition -ceq 'BLOCKED') { $LaneState.outcome = 'BLOCKED_NEEDS_QUESTION' }
}
Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
if ($FixLanes.Count -eq 0) {
  $State.completed_at = (Get-Date).ToString('o'); Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  return [pscustomobject]@{ run_id=$RunId;outcome='NO_FIX_IMPLEMENTATION_REQUIRED';lanes=@($State.lanes) }
}

if ([string]::IsNullOrWhiteSpace($Password)) { $Password = Read-Host 'OpenCode server password' }
$Server = $Config.server.TrimEnd('/')
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password
$MetaEntry = Get-OCRouterSessionEntry -Config $Config -Name $Meta
$MetaReadUri = "$Server/session/$($MetaEntry.sessionId)/message?limit=$Limit"
$MetaCommandUri = "$Server/session/$($MetaEntry.sessionId)/command"
$FixPlanTexts = @{}
foreach ($LaneItem in $FixLanes) {
  $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $LaneItem.track_key
  $FixPlanText = Get-Content -LiteralPath ([string]$LaneState.source_fix_plan_path) -Raw
  $SourceContext = [pscustomobject]@{
    target=$LaneItem.target;epic=$LaneItem.epic_id;candidate=$LaneState.source_candidate;accountable_lane=$LaneItem.accountable_lane
    lane_class=$LaneItem.lane_class;lane_profile=$LaneItem.lane_profile;closeout_disposition='FIX_REQUIRED'
    accepted_finding_ids=@(Get-OCRouterFixPlanAcceptedFindingIds -Text $FixPlanText)
  }
  if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $FixPlanText -Context $SourceContext)) { throw "Lane '$($LaneItem.track_key)' source fix plan drifted before Meta review." }
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity ([string]$LaneState.source_fix_plan_artifact))) { throw "Lane '$($LaneItem.track_key)' source fix-plan artifact identity is invalid." }
  $LaneItem | Add-Member -NotePropertyName plan_artifact -NotePropertyValue ([string]$LaneState.source_fix_plan_artifact) -Force
  $LaneItem | Add-Member -NotePropertyName plan_class -NotePropertyValue 'REVIEW_FIX_PLAN' -Force
  $FixPlanTexts[$LaneItem.track_key] = $FixPlanText
}

$CombinedReviewRequest = New-OCRouterParallelPlanReviewRequest -Lanes $FixLanes -LaneTexts $FixPlanTexts
$MetaReviewText = ''
if (-not [string]::IsNullOrWhiteSpace([string]$State.plan_review.artifact_path)) {
  Assert-OCRouterArtifactPin -Pin $State.plan_review.artifact_pin | Out-Null
  $MetaReviewText = Get-Content -LiteralPath ([string]$State.plan_review.artifact_path) -Raw
  if (-not (Test-OCRouterParallelTrackResponseEnvelope -Text $MetaReviewText -Lanes $FixLanes -ExpectedCommand 'terv-review-utan' -ExpectedBodyKind 'meta_plan_review')) { throw 'Pinned parallel REVIEW_FIX_PLAN Meta review drift.' }
}
else {
  if ([string]::IsNullOrWhiteSpace([string]$State.plan_review.baseline_message_id)) {
    $MetaBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst)
    $State.plan_review.baseline_message_id = [string]$MetaBaseline.MessageId
    $State.plan_review.baseline_identity = 'id:' + [string]$MetaBaseline.MessageId
    Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  }
  $ReviewBody = New-OCRouterCommandRequestBodyObject -Command 'terv-review' -Arguments $CombinedReviewRequest -Model $MetaModel | ConvertTo-Json -Depth 10
  $ReviewIntent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition 'parallel-fix-plan-terv-review' -Recipient $Meta -Kind command -Operation 'terv-review' -Payload $ReviewBody -BaselineIdentity ([string]$State.plan_review.baseline_identity) -CandidateIdentity ('sha256:' + (Get-OCRouterStringSha256 -Text $CombinedReviewRequest)) -Stage 'parallel_review_fix_meta_plan_review'
  $State.plan_review.dispatch_intent_path = [string]$ReviewIntent.path
  Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  if ([bool]$ReviewIntent.should_send) {
    if (-not $AutoApprove) {
      Write-OCRouterTextPreview -Text $CombinedReviewRequest
      $Approval = Read-Host "Send $($FixLanes.Count) exact pinned fix plans to '$Meta' /terv-review? [y/N]"
      if ($Approval -ne 'y' -and $Approval -ne 'Y') { throw 'Parallel fix-plan Meta review dispatch declined.' }
    }
    $ReviewResponse = Invoke-RestMethod -Method Post -Uri $MetaCommandUri -Headers $Headers -ContentType 'application/json' -Body $ReviewBody
    Complete-OCRouterDispatchIntent -Path $ReviewIntent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $ReviewResponse) -TransportStatus 'accepted' | Out-Null
  }
  $MetaCandidate = Wait-OCRouterNewOutput -Label 'parallel REVIEW_FIX_PLAN Meta review envelope' -Uri $MetaReadUri -Headers $Headers -BaselineIdentity ([string]$State.plan_review.baseline_identity) -BaselineMessageId ([string]$State.plan_review.baseline_message_id) -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'parallel_meta_plan_review' -ExpectedOutputContext ([pscustomobject]@{lanes=$FixLanes}) -AutoUseFirstStable:($AutoUseFirstStable -or $AutoApprove)
  $MetaReviewText = [string]$MetaCandidate.Text
  $MetaReviewPath = Join-Path $RunDir '01-meta-review-fix-plans.md'
  Write-OCRouterAtomicTextFile -Path $MetaReviewPath -Text $MetaReviewText
  $MetaReviewPin = New-OCRouterArtifactPin -Path $MetaReviewPath -ProducerMessageId ([string]$MetaCandidate.MessageId) -Stage 'parallel_review_fix_meta_plan_review' -CandidateIdentity ('id:' + [string]$MetaCandidate.MessageId) -ExpectedOutputKind 'parallel_meta_plan_review'
  $State.plan_review.artifact_path=$MetaReviewPath;$State.plan_review.artifact_sha256=[string]$MetaReviewPin.sha256;$State.plan_review.artifact_pin=$MetaReviewPin
  Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
}
$MetaReviewIntentPath=[string]$State.plan_review.dispatch_intent_path
if([string]::IsNullOrWhiteSpace($MetaReviewIntentPath)-or-not(Test-Path -LiteralPath $MetaReviewIntentPath -PathType Leaf)){throw 'Parallel revised review-fix authority lacks the durable Meta /terv-review intent.'}
$MetaReviewIntentRecord=Get-Content -LiteralPath $MetaReviewIntentPath -Raw|ConvertFrom-Json
if([string]$MetaReviewIntentRecord.status-cne'dispatched'-or[string]$MetaReviewIntentRecord.operation-cne'terv-review'){throw 'Parallel Meta /terv-review intent is not delivery-proven.'}

$RevisionWaits = New-Object System.Collections.Generic.List[object]
foreach ($LaneItem in $FixLanes) {
  $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $LaneItem.track_key
  $RevisionContext = [pscustomobject]@{
    target=$LaneItem.target;epic=$LaneItem.epic_id;candidate=$LaneState.source_candidate;accountable_lane=$LaneItem.accountable_lane
    lane_class=$LaneItem.lane_class;lane_profile=$LaneItem.lane_profile;plan_class='REVIEW_FIX_PLAN'
    accepted_finding_ids=@(Get-OCRouterFixPlanAcceptedFindingIds -Text ([string]$FixPlanTexts[$LaneItem.track_key]))
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$LaneState.plan_revision.artifact_path)) {
    Assert-OCRouterArtifactPin -Pin $LaneState.plan_revision.artifact_pin | Out-Null
    $SavedRevision = Get-Content -LiteralPath ([string]$LaneState.plan_revision.artifact_path) -Raw
    if (-not (Test-OCRouterExpectedOutputKind -Text $SavedRevision -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisionContext)) { throw "Lane '$($LaneItem.track_key)' revised fix-plan pin drift." }
    continue
  }
  $ReadUri = "$Server/session/$($LaneItem.session_entry.sessionId)/message?limit=$Limit"
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.plan_revision.baseline_message_id)) {
    $Baseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $ReadUri -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst)
    $LaneState.plan_revision.baseline_message_id=[string]$Baseline.MessageId;$LaneState.plan_revision.baseline_identity='id:'+[string]$Baseline.MessageId
    Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  }
  $ReviewBlock = Get-OCRouterTrackResponseBlock -Text $MetaReviewText -Track $LaneItem.track_key -ExpectedTarget $LaneItem.target -ExpectedCommand 'terv-review-utan'
  $RevisionArguments = New-OCRouterPlanRevisionArgument -SourcePlanText ([string]$FixPlanTexts[$LaneItem.track_key]) -MetaReviewText ([string]$ReviewBlock.body)
  $RevisionBody = New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $RevisionArguments | ConvertTo-Json -Depth 10
  $RevisionIntent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition ("review-fix-terv-review-utan-$($LaneItem.safe_name)") -Recipient $LaneItem.track_key -Kind command -Operation 'terv-review-utan' -Payload $RevisionBody -BaselineIdentity ([string]$LaneState.plan_revision.baseline_identity) -CandidateIdentity ([string]$State.plan_review.artifact_pin.candidate_identity) -Stage 'review_fix_plan_revision'
  $LaneState.plan_revision.dispatch_intent_path=[string]$RevisionIntent.path
  Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  if ([bool]$RevisionIntent.should_send) {
    Assert-OCRouterParentSessionCommandSafe -Server $Server -Headers $Headers -CommandName 'terv-review-utan'
    if (-not $AutoApprove) {
      Write-OCRouterTextPreview -Text $RevisionArguments
      $Approval = Read-Host "Send exact pinned fix plan plus matching Meta review to '$($LaneItem.track_key)' /terv-review-utan? [y/N]"
      if ($Approval -ne 'y' -and $Approval -ne 'Y') { throw "Plan revision dispatch declined for '$($LaneItem.track_key)'." }
    }
    $RevisionResponse = Invoke-RestMethod -Method Post -Uri "$Server/session/$($LaneItem.session_entry.sessionId)/command" -Headers $Headers -ContentType 'application/json' -Body $RevisionBody
    Complete-OCRouterDispatchIntent -Path $RevisionIntent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $RevisionResponse) -TransportStatus 'accepted' | Out-Null
  }
  $RevisionWaits.Add([pscustomobject]@{track_key=$LaneItem.track_key;safe_name=$LaneItem.safe_name;label="$($LaneItem.track_key) revised review-fix plan";uri=$ReadUri;baseline_identity=$LaneState.plan_revision.baseline_identity;baseline_message_id=$LaneState.plan_revision.baseline_message_id;expected_output_context=$RevisionContext}) | Out-Null
}
if ($RevisionWaits.Count -gt 0) {
  $OnRevisionCompleted = {
    param($Wait, $Selected)
    $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $Wait.track_key
    $ArtifactPath = Join-Path $RunDir ("02-$($Wait.safe_name)-revised-review-fix-plan.md")
    Write-OCRouterAtomicTextFile -Path $ArtifactPath -Text ([string]$Selected.Text)
    $Pin = New-OCRouterArtifactPin -Path $ArtifactPath -ProducerMessageId ([string]$Selected.MessageId) -Stage 'review_fix_plan_revision' -CandidateIdentity ('id:'+[string]$Selected.MessageId) -ExpectedOutputKind 'track_plan_revision'
    $LaneState.plan_revision.artifact_path=$ArtifactPath;$LaneState.plan_revision.artifact_sha256=[string]$Pin.sha256;$LaneState.plan_revision.artifact_pin=$Pin;$LaneState.revised_fix_plan_path=$ArtifactPath
    Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  }
  Wait-OCRouterParallelOutputs -LaneContexts @($RevisionWaits.ToArray()) -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'track_plan_revision' -AutoUseFirstStable:($AutoUseFirstStable -or $AutoApprove) -OnLaneCompleted $OnRevisionCompleted | Out-Null
}

$ImplementableFixLanes = @()
foreach ($LaneItem in $FixLanes) {
  $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $LaneItem.track_key
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.revised_fix_plan_path)) { $LaneState.revised_fix_plan_path=[string]$LaneState.plan_revision.artifact_path }
  $RevisionText = Get-Content -LiteralPath ([string]$LaneState.revised_fix_plan_path) -Raw
  $RevisionLines = @(($RevisionText -replace "`r`n","`n" -replace "`r","`n") -split "`n" | Where-Object {-not[string]::IsNullOrWhiteSpace($_)})
  $LaneState.plan_revision.terminal = if($RevisionLines.Count-gt 0){[string]$RevisionLines[$RevisionLines.Count-1]}else{''}
  $LaneState.plan_revision.final_artifact_identity = Get-OCRouterTopLevelFieldValue -Text $RevisionText -Field 'Final plan artifact'
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity ([string]$LaneState.plan_revision.final_artifact_identity))) { throw "Lane '$($LaneItem.track_key)' revised fix plan has an invalid final opaque artifact identity." }
  $RevisionIntentPath=[string]$LaneState.plan_revision.dispatch_intent_path
  if([string]::IsNullOrWhiteSpace($RevisionIntentPath)-or-not(Test-Path -LiteralPath $RevisionIntentPath -PathType Leaf)){throw "Lane '$($LaneItem.track_key)' lacks its durable /terv-review-utan revision intent."}
  $RevisionIntentRecord=Get-Content -LiteralPath $RevisionIntentPath -Raw|ConvertFrom-Json
  if([string]$RevisionIntentRecord.status-cne'dispatched'-or[string]$RevisionIntentRecord.operation-cne'terv-review-utan'){throw "Lane '$($LaneItem.track_key)' revision intent is not delivery-proven."}
  if([string]$LaneState.plan_revision.terminal-ceq'IMPLEMENT_READY'){$ImplementableFixLanes+=$LaneItem}else{$LaneState.outcome='PLAN_REVISION_BLOCKED'}
}
Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
if($ImplementableFixLanes.Count-eq 0){$State.completed_at=(Get-Date).ToString('o');Save-ParallelReviewFixState -RunDirectory $RunDir -State $State;if($null-ne$RunLock){$RunLock.Dispose();$RunLock=$null};return[pscustomobject]@{run_id=$RunId;outcome='ALL_PLAN_REVISIONS_BLOCKED';lanes=@($State.lanes)}}

$Waits = New-Object System.Collections.Generic.List[object]
foreach ($LaneItem in $ImplementableFixLanes) {
  $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $LaneItem.track_key
  $ReadUri = "$Server/session/$($LaneItem.session_entry.sessionId)/message?limit=$Limit"
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.implementation.artifact_path)) {
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.implementation.baseline_message_id)) {
      $Baseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $ReadUri -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst)
      if ($null -eq $Baseline -or [string]::IsNullOrWhiteSpace([string]$Baseline.MessageId)) { throw "Lane '$($LaneItem.track_key)' lacks a raw assistant baseline." }
      $LaneState.implementation.baseline_message_id = [string]$Baseline.MessageId
      $LaneState.implementation.baseline_identity = 'id:' + [string]$Baseline.MessageId
      Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
    }
    $FixPlanText = Get-Content -LiteralPath ([string]$LaneState.revised_fix_plan_path) -Raw
    $BodyObject = New-OCRouterCommandRequestBodyObject -Command 'implement' -Arguments $FixPlanText
    $Body = $BodyObject | ConvertTo-Json -Depth 10
    $Intent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition ("implement-$($LaneItem.safe_name)") -Recipient ([string]$LaneItem.track_key) -Kind command -Operation 'implement' -Payload $Body -BaselineIdentity ([string]$LaneState.implementation.baseline_identity) -CandidateIdentity ([string]$LaneState.source_candidate) -Stage 'fix_implementation_dispatch'
    $LaneState.implementation.dispatch_intent_path = [string]$Intent.path
    Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
    if ([bool]$Intent.should_send) {
      Assert-OCRouterParentSessionCommandSafe -Server $Server -Headers $Headers -CommandName 'implement'
      if (-not $AutoApprove) {
        Write-OCRouterTextPreview -Text $FixPlanText
        $Approval = Read-Host "Send exact revised review-fix plan to '$($LaneItem.track_key)' /implement? [y/N]"
        if ($Approval -ne 'y' -and $Approval -ne 'Y') { throw "Implementation dispatch declined for '$($LaneItem.track_key)'." }
      }
      $Transport = Invoke-RestMethod -Method Post -Uri "$Server/session/$($LaneItem.session_entry.sessionId)/command" -Headers $Headers -ContentType 'application/json' -Body $Body
      Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Transport) -TransportStatus 'accepted' | Out-Null
    }
    $Waits.Add([pscustomobject]@{
      track_key=[string]$LaneItem.track_key;safe_name=[string]$LaneItem.safe_name;label="$($LaneItem.track_key) exact implementation";uri=$ReadUri
      baseline_identity=[string]$LaneState.implementation.baseline_identity;baseline_message_id=[string]$LaneState.implementation.baseline_message_id
      expected_output_context=[pscustomobject]@{target=$LaneItem.target;epic=$LaneItem.epic_id;accountable_lane=$LaneItem.accountable_lane;lane_class=$LaneItem.lane_class;lane_profile=$LaneItem.lane_profile;plan_artifact_identity=[string]$LaneState.plan_revision.final_artifact_identity}
    }) | Out-Null
  }
  else {
    Assert-OCRouterArtifactPin -Pin $LaneState.implementation.artifact_pin | Out-Null
  }
}

if ($Waits.Count -gt 0) {
  $OnCompleted = {
    param($Wait, $Selected)
    $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $Wait.track_key
    $ArtifactPath = Join-Path $RunDir ("01-$($Wait.safe_name)-implementation.md")
    Write-OCRouterAtomicTextFile -Path $ArtifactPath -Text ([string]$Selected.Text)
    $Pin = New-OCRouterArtifactPin -Path $ArtifactPath -ProducerMessageId ([string]$Selected.MessageId) -Stage 'fix_implementation' -CandidateIdentity ('id:' + [string]$Selected.MessageId) -ExpectedOutputKind 'track_implementation_report'
    $LaneState.implementation.artifact_path = $ArtifactPath; $LaneState.implementation.artifact_sha256 = [string]$Pin.sha256; $LaneState.implementation.artifact_pin = $Pin
    $LaneState.implementation.terminal = Get-OCRouterModeFromText -Text ([string]$Selected.Text)
    $LaneState.implementation.candidate = Get-OCRouterTopLevelFieldValue -Text ([string]$Selected.Text) -Field 'Candidate identity/worktree limitations'
    Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  }
  Wait-OCRouterParallelOutputs -LaneContexts @($Waits.ToArray()) -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'track_implementation_report' -AutoUseFirstStable:($AutoUseFirstStable -or $AutoApprove) -OnLaneCompleted $OnCompleted | Out-Null
}

$ReviewReadyLanes = @()
foreach ($LaneItem in $ImplementableFixLanes) {
  $LaneState = Get-ParallelReviewFixLaneState -State $State -TrackKey $LaneItem.track_key
  $ImplementationText = Get-Content -LiteralPath ([string]$LaneState.implementation.artifact_path) -Raw
  $ImplementationContext = [pscustomobject]@{target=$LaneItem.target;epic=$LaneItem.epic_id;accountable_lane=$LaneItem.accountable_lane;lane_class=$LaneItem.lane_class;lane_profile=$LaneItem.lane_profile;plan_artifact_identity=[string]$LaneState.plan_revision.final_artifact_identity}
  if (-not (Test-OCRouterExpectedOutputKind -Text $ImplementationText -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext)) { throw "Lane '$($LaneItem.track_key)' implementation binding drift." }
  $LaneState.implementation.terminal = Get-OCRouterModeFromText -Text $ImplementationText
  $LaneState.implementation.candidate = Get-OCRouterTopLevelFieldValue -Text $ImplementationText -Field 'Candidate identity/worktree limitations'
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.implementation.candidate) -or [string]$LaneState.implementation.terminal -notin @('REVIEW_READY','IMPLEMENT_BLOCKED')) { throw "Lane '$($LaneItem.track_key)' lacks exact implementation terminal evidence." }
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.implementation.receipt_path)) {
    $LaneState.implementation.receipt_path = Write-OCRouterArtifactDeliveryReceipt -RunDir $RunDir -Name ("implementation-$($LaneItem.safe_name)") -ArtifactPath ([string]$LaneState.revised_fix_plan_path) -ProducerSession ([string]$LaneItem.track_key) -Command 'implement' -Target ([string]$LaneItem.target) -Recipient ([string]$LaneItem.track_key) -DeliveryProven $true -ResponseClass ([string]$LaneState.implementation.terminal) -ResponseArtifactPath ([string]$LaneState.implementation.artifact_path) -ResponseMessageId ([string]$LaneState.implementation.artifact_pin.producer_message_id) -DispatchIntentPath ([string]$LaneState.implementation.dispatch_intent_path)
  }
  else {
    Assert-OCRouterArtifactDeliveryReceipt -ReceiptPath ([string]$LaneState.implementation.receipt_path) -ArtifactPath ([string]$LaneState.revised_fix_plan_path) -ProducerSession ([string]$LaneItem.track_key) -Command 'implement' -Target ([string]$LaneItem.target) -Recipient ([string]$LaneItem.track_key) -ResponseClass ([string]$LaneState.implementation.terminal) -ResponseArtifactPath ([string]$LaneState.implementation.artifact_path) -ResponseMessageId ([string]$LaneState.implementation.artifact_pin.producer_message_id) -DispatchIntentPath ([string]$LaneState.implementation.dispatch_intent_path) | Out-Null
  }
  if ([string]$LaneState.implementation.terminal -ceq 'REVIEW_READY') { $ReviewReadyLanes += $LaneItem } else { $LaneState.outcome = 'IMPLEMENTATION_BLOCKED' }
}
Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
if ($ReviewReadyLanes.Count -eq 0) {
  $State.completed_at=(Get-Date).ToString('o');Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  if($null-ne $RunLock){$RunLock.Dispose();$RunLock=$null};return [pscustomobject]@{run_id=$RunId;outcome='ALL_IMPLEMENTATIONS_BLOCKED';lanes=@($State.lanes)}
}

$CommonStepArgs = @{
  Meta=$Meta;SwarmAssistant=$SwarmAssistant;PollSeconds=$PollSeconds;TimeoutMinutes=$TimeoutMinutes;Limit=$Limit;CandidateCount=$CandidateCount;StablePolls=$StablePolls;MinOutputChars=$MinOutputChars
  RouterDir=$RouterDir;Username=$Username;Password=$Password;AssumeOldestFirst=$AssumeOldestFirst;IncludeReasoningParts=$IncludeReasoningParts;AutoUseFirstStable=$AutoUseFirstStable;AutoApprove=$AutoApprove
  ProjectReviewContext=$ProjectReviewContext;ReviewFocus=$ReviewFocus;ModelProfile=$ModelProfile;MetaModel=$MetaModel;SwarmMessageModel=$SwarmMessageModel;SwarmReviewDepth=$SwarmReviewDepth;SwarmReviewFocus=$SwarmReviewFocus
  ReviewCycleIndex=$CycleIndex;RunId=$StepReviewRunId
}
if($MetaInternalLanes-ge 0){$CommonStepArgs.MetaInternalLanes=$MetaInternalLanes};if($PSBoundParameters.ContainsKey('ReviewProfile')){$CommonStepArgs.ReviewProfile=$ReviewProfile};if($PSBoundParameters.ContainsKey('ReviewLanes')){$CommonStepArgs.ReviewLanes=$ReviewLanes}
if($ExpandedReviewApproved){$CommonStepArgs.ExpandedReviewApproved=$true};if($SkipSwarmReview){$CommonStepArgs.SkipSwarmReview=$true};if($UseSwarmReview){$CommonStepArgs.UseSwarmReview=$true};if($ForceFullReview){$CommonStepArgs.ForceFullReview=$true}
if(-not[string]::IsNullOrWhiteSpace($OwnerApprovalRecord)){$CommonStepArgs.OwnerApprovalRecord=$OwnerApprovalRecord};if(-not[string]::IsNullOrWhiteSpace($OwnerApprovalCostEnvelope)){$CommonStepArgs.OwnerApprovalCostEnvelope=$OwnerApprovalCostEnvelope};if(-not[string]::IsNullOrWhiteSpace($ReviewRegistryPath)){$CommonStepArgs.ReviewRegistryPath=$ReviewRegistryPath}

if($ReviewReadyLanes.Count-eq 1){
  $Only=$ReviewReadyLanes[0];$OnlyState=Get-ParallelReviewFixLaneState -State $State -TrackKey $Only.track_key
  $ChildScript=Join-Path $PSScriptRoot 'run-step-review-flow.ps1';$ChildDir=Join-Path (Join-Path $RouterDir 'step-review-runs') (Get-OCRouterSafeName -Value $StepReviewRunId)
  $Args=@{}+$CommonStepArgs;$Args.Track=$Only.track_key;$Args.Target=$Only.target;$Args.Epic=$Only.epic_id;$Args.Wave=$OnlyState.wave;$Args.AccountableLaneId=$Only.accountable_lane;$Args.AccountableLaneClass=$Only.lane_class;$Args.AccountableLaneProfile=$Only.lane_profile
  $Args.PinnedImplementationArtifactPath=[string]$OnlyState.implementation.artifact_path;$Args.PinnedImplementationArtifactSha256=[string]$OnlyState.implementation.artifact_sha256;$Args.PinnedImplementationProducerMessageId=[string]$OnlyState.implementation.artifact_pin.producer_message_id;$Args.PinnedImplementationCandidate=[string]$OnlyState.implementation.candidate
  if(Test-Path -LiteralPath (Join-Path $ChildDir 'state.json') -PathType Leaf){$Args.Resume=$true};$State.child.mode='serial';$State.child.run_dir=$ChildDir;$State.child.status='started';Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  @(& $ChildScript @Args)|Out-Null;$ChildState=Get-Content -LiteralPath (Join-Path $ChildDir 'state.json') -Raw|ConvertFrom-Json
  $ChildImpl=Join-Path $ChildDir '01-track-implementation.md';if((Get-FileHash -Algorithm SHA256 -LiteralPath $ChildImpl).Hash-cne[string]$OnlyState.implementation.artifact_sha256-or[string]$ChildState.reviewed_candidate-cne[string]$OnlyState.implementation.candidate){throw 'Serial child did not consume exact implementation candidate.'}
  $FinalPath=Join-Path $ChildDir '05-meta-final-synthesis.md';$ResponsePath=Join-Path $ChildDir '06-track-delivery-response.md';$FinalBody=Get-Content -LiteralPath $FinalPath -Raw
  $Evidence=Write-ParallelReviewFixTerminalEvidence -LaneItem $Only -LaneState $OnlyState -FinalArtifactPath $FinalPath -FinalBody $FinalBody -ResponseArtifactPath $ResponsePath -ResponseMessageId ([string](Get-Content -LiteralPath ([string]$ChildState.delivery_receipt_path)-Raw|ConvertFrom-Json).response_message_id) -DispatchIntentPath ([string](Get-Content -LiteralPath ([string]$ChildState.delivery_receipt_path)-Raw|ConvertFrom-Json).dispatch_intent)
  $OnlyState.outcome=switch($Evidence.disposition){'ALLOWED'{'ACKNOWLEDGED_FOR_CLOSEOUT'}'FIX_REQUIRED'{'NEXT_FIX_CYCLE_REQUIRED'}'BLOCKED'{'BLOCKED_NEEDS_QUESTION'}};$OnlyState.terminal_synthesis_path=$Evidence.final_synthesis_path;$OnlyState.terminal_delivery_response_path=$Evidence.delivery_response_path;$OnlyState.terminal_receipt_path=$Evidence.receipt_path;$OnlyState.fal_proposal_path=$Evidence.proposal_path
}
else{
  $ChildScript=Join-Path $PSScriptRoot 'run-parallel-step-review-flow.ps1';$ChildDir=Join-Path (Join-Path $RouterDir 'parallel-runs') (Get-OCRouterSafeName -Value $StepReviewRunId)
  $PinnedManifest=Write-ParallelReviewFixPinnedImplementationManifest -RunDirectory $RunDir -Lanes $ReviewReadyLanes -State $State
  if([string]::IsNullOrWhiteSpace([string]$State.child.pinned_implementation_manifest_path)){
    if([string]$State.child.status-cne'not_started'){throw 'Existing child run lacks a pre-dispatch pinned implementation manifest; unsafe late-only validation is rejected.'}
    $State.child.pinned_implementation_manifest_path=[string]$PinnedManifest.path;$State.child.pinned_implementation_manifest_sha256=[string]$PinnedManifest.sha256;Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  }
  elseif([string]$State.child.pinned_implementation_manifest_path-cne[string]$PinnedManifest.path-or[string]$State.child.pinned_implementation_manifest_sha256-cne[string]$PinnedManifest.sha256){throw 'Pinned implementation child manifest drift on resume.'}
  $Args=@{}+$CommonStepArgs;$Args.Lane=@($ReviewReadyLanes|ForEach-Object{if($_.lane_class-ceq'TRACK'-and$_.accountable_lane-ceq$_.role_label-and$_.lane_profile-ceq$_.track_key){"$($_.track_key)|$($_.target)|$($_.epic_id)"}else{"$($_.track_key)|$($_.target)|$($_.epic_id)|$($_.accountable_lane)|$($_.lane_class)|$($_.lane_profile)"}});$Args.SkipImplement=$true;$Args.WaitForTrackResponses=$true;$Args.FalSyncCheckpoint=$false
  $Args.PinnedImplementationManifestPath=[string]$PinnedManifest.path;$Args.PinnedImplementationManifestSha256=[string]$PinnedManifest.sha256
  if(Test-Path -LiteralPath (Join-Path $ChildDir 'state.json') -PathType Leaf){$Args.Remove('Lane')|Out-Null;$Args.Resume=$true};$State.child.mode='parallel';$State.child.run_dir=$ChildDir;$State.child.status='started';Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
  @(& $ChildScript @Args)|Out-Null;$ChildState=Get-Content -LiteralPath (Join-Path $ChildDir 'state.json') -Raw|ConvertFrom-Json;$FinalPath=Join-Path $ChildDir '06-meta-final-synthesis.md';$FinalEnvelope=Get-Content -LiteralPath $FinalPath -Raw
  foreach($Ready in $ReviewReadyLanes){$ReadyState=Get-ParallelReviewFixLaneState -State $State -TrackKey $Ready.track_key;$Ready|Add-Member -NotePropertyName candidate_identity -NotePropertyValue ([string]$ReadyState.implementation.candidate)-Force;$ChildLane=@($ChildState.lanes|Where-Object{[string]$_.track_key-ceq[string]$Ready.track_key})[0];$ChildImpl=Join-Path $ChildDir ("01-$($Ready.safe_name)-implementation.md");if([string]$ChildLane.implementation_message_id-cne[string]$ReadyState.implementation.artifact_pin.producer_message_id-or(Get-FileHash -Algorithm SHA256 -LiteralPath $ChildImpl).Hash-cne[string]$ReadyState.implementation.artifact_sha256){throw "Parallel child did not consume exact candidate for '$($Ready.track_key)'."}}
  if(-not(Test-OCRouterParallelTrackResponseEnvelope -Text $FinalEnvelope -Lanes $ReviewReadyLanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds @($ChildState.surfaced_finding_ids))){throw 'Parallel child lacks exact final envelope; exit is not acceptance.'}
  foreach($Ready in $ReviewReadyLanes){$ReadyState=Get-ParallelReviewFixLaneState -State $State -TrackKey $Ready.track_key;$ChildLane=@($ChildState.lanes|Where-Object{[string]$_.track_key-ceq[string]$Ready.track_key})[0];$Block=Get-OCRouterTrackResponseBlock -Text $FinalEnvelope -Track $Ready.track_key -ExpectedTarget $Ready.target -ExpectedCommand 'step-review-utan';$ResponsePath=Join-Path $ChildDir ("08-$($Ready.safe_name)-track-response.md");$IntentPath=Join-Path $ChildDir ("dispatch-intents\step-review-utan-$($Ready.safe_name).json");$Evidence=Write-ParallelReviewFixTerminalEvidence -LaneItem $Ready -LaneState $ReadyState -FinalArtifactPath $FinalPath -FinalBody ([string]$Block.body) -ResponseArtifactPath $ResponsePath -ResponseMessageId ([string]$ChildLane.track_response_message_id) -DispatchIntentPath $IntentPath;$ReadyState.outcome=switch($Evidence.disposition){'ALLOWED'{'ACKNOWLEDGED_FOR_CLOSEOUT'}'FIX_REQUIRED'{'NEXT_FIX_CYCLE_REQUIRED'}'BLOCKED'{'BLOCKED_NEEDS_QUESTION'}};$ReadyState.terminal_synthesis_path=$Evidence.final_synthesis_path;$ReadyState.terminal_delivery_response_path=$Evidence.delivery_response_path;$ReadyState.terminal_receipt_path=$Evidence.receipt_path;$ReadyState.fal_proposal_path=$Evidence.proposal_path}
}
$State.child.status='validated';$State.completed_at=(Get-Date).ToString('o');Save-ParallelReviewFixState -RunDirectory $RunDir -State $State
if($null-ne $RunLock){$RunLock.Dispose();$RunLock=$null}
[pscustomobject]@{run_id=$RunId;step_review_run_id=$StepReviewRunId;outcome='VALIDATED_PER_LANE';lanes=@($State.lanes)}
