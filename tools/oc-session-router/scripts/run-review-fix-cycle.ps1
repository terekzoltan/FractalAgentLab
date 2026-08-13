param(
  [Parameter(Mandatory=$true)]
  [string]$Track,
  [Parameter(Mandatory=$true)]
  [string]$Target,
  [Parameter(Mandatory=$true)]
  [string]$Epic,
  [Parameter(Mandatory=$true)]
  [string]$Wave,
  [Parameter(Mandatory=$true)]
  [string]$Candidate,
  [Parameter(Mandatory=$true)]
  [string]$AccountableLaneId,
  [Parameter(Mandatory=$true)]
  [ValidateSet('TRACK', 'SPECIALIST_DELIVERY', 'GOVERNANCE')]
  [string]$AccountableLaneClass,
  [Parameter(Mandatory=$true)]
  [string]$AccountableLaneProfile,

  [Parameter(Mandatory=$true)]
  [string]$PinnedFinalSynthesisPath,
  [Parameter(Mandatory=$true)]
  [string]$PinnedDeliveryResponsePath,
  [Parameter(Mandatory=$true)]
  [string]$PinnedDeliveryReceiptPath,
  [string]$PinnedFalCheckpointProposalPath = '',

  [int]$CycleIndex = 1,
  [string]$StepReviewRunId = '',
  [string]$RunId = '',
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
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: review-fix stages must be invoked explicitly.'
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')

function Resolve-ReviewFixFile {
  param([string]$Field, [string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { throw "$Field is required." }
  $CandidatePath = if ([IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-Location).Path $Path }
  if (-not (Test-Path -LiteralPath $CandidatePath -PathType Leaf)) { throw "$Field was not found: $CandidatePath" }
  return (Resolve-Path -LiteralPath $CandidatePath -ErrorAction Stop).Path
}

function Get-ReviewFixCandidateIdentity {
  param([object]$CandidateRecord)
  if ($null -eq $CandidateRecord -or [string]::IsNullOrWhiteSpace([string]$CandidateRecord.MessageId)) { return '' }
  return 'id:' + [string]$CandidateRecord.MessageId
}

function Save-ReviewFixState {
  param([string]$RunDirectory, [object]$State)
  Write-OCRouterAtomicJsonFile -Path (Join-Path $RunDirectory 'state.json') -Value $State
}

function Load-ReviewFixState {
  param([string]$RunDirectory)
  $Path = Join-Path $RunDirectory 'state.json'
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing review-fix state: $Path" }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Wait-ReviewFixImplementation {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [string]$BaselineMessageId,
    [object]$ExpectedContext
  )
  if ([string]::IsNullOrWhiteSpace($BaselineMessageId)) { throw 'Implementation wait requires a raw assistant baseline message ID.' }
  $Deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $LastSignature = ''
  $StableCount = 0
  while ((Get-Date) -lt $Deadline) {
    $Response = Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers -ContentType 'application/json'
    $Candidates = @(Get-OCRouterLatestOutputCandidates `
      -Messages @(Get-OCRouterMessageCollection -Response $Response) `
      -CandidateCount $CandidateCount `
      -AssumeNewestFirst:(-not $AssumeOldestFirst) `
      -IncludeReasoningParts:$IncludeReasoningParts `
      -ExpectedOutputKind 'track_implementation_report' `
      -ExpectedOutputContext $ExpectedContext `
      -AfterMessageId $BaselineMessageId)
    if ($Candidates.Count -gt 0) {
      $Current = $Candidates[0]
      $Tail = [string]$Current.Text
      if ($Tail.Length -gt 240) { $Tail = $Tail.Substring($Tail.Length - 240) }
      $Signature = "$(Get-ReviewFixCandidateIdentity -CandidateRecord $Current)|$($Current.TextLength)|$Tail"
      if ($Current.TextLength -ge $MinOutputChars) {
        if ($Signature -ceq $LastSignature) { $StableCount += 1 } else { $LastSignature = $Signature; $StableCount = 1 }
        if ($StableCount -ge $StablePolls) {
          Write-OCRouterSelectedCandidateSummary -Candidate $Current
          Write-OCRouterTextPreview -Text $Current.Text
          if ($AutoUseFirstStable -or $AutoApprove) { return $Current }
          $Answer = Read-Host 'Use this exact implementation result? [y/N]'
          if ($Answer -eq 'y' -or $Answer -eq 'Y') { return $Current }
          throw 'Implementation result was declined; no review was started.'
        }
      }
    }
    Start-Sleep -Seconds $PollSeconds
  }
  throw "Timed out after $TimeoutMinutes minutes waiting for the exact implementation result."
}

function Assert-ReviewFixSourceFalBinding {
  param(
    [object]$Identity,
    [string]$ExpectedArtifactPath,
    [string]$ExpectedArtifactHash,
    [string]$ExpectedStage,
    [string]$ExpectedCandidate
  )
  Assert-OCRouterFalCheckpointIdentity -Identity $Identity | Out-Null
  $ExpectedRepoKind = switch ($FalTargetRepoKind.ToLowerInvariant().Replace('-', '_').Replace(' ', '_')) {
    'git_repository' { 'git' }
    'non_git_project' { 'non_git' }
    'equivalent' { 'declared_equivalent' }
    default { $FalTargetRepoKind.ToLowerInvariant().Replace('-', '_').Replace(' ', '_') }
  }
  $Checks = [ordered]@{
    target_project_id = $FalProjectId
    target_repo_kind = $ExpectedRepoKind
    target_repo_root = (Resolve-Path -LiteralPath $FalTargetRepoPath -ErrorAction Stop).Path
    target_worktree = (Resolve-Path -LiteralPath $FalTargetWorktreePath -ErrorAction Stop).Path
    wave = $Wave
    epic = $Epic
    stage = $ExpectedStage
    candidate = $ExpectedCandidate
    logical_sender = $Meta
    logical_recipient = $Track
    source_session = $Meta
    control_root = (Resolve-Path -LiteralPath $FalControlRoot -ErrorAction Stop).Path
    sync_mode = 'dry_run'
  }
  foreach ($Entry in $Checks.GetEnumerator()) {
    if ([string]$Identity.($Entry.Key) -cne [string]$Entry.Value) { throw "Pinned FAL identity mismatch for '$($Entry.Key)'." }
  }
  foreach ($Entry in @(
    @('id', $AccountableLaneId), @('class', $AccountableLaneClass), @('profile', $AccountableLaneProfile)
  )) {
    if ([string]$Identity.accountable_lane.($Entry[0]) -cne [string]$Entry[1]) { throw "Pinned FAL accountable-lane mismatch for '$($Entry[0])'." }
  }
  if ([string]$Identity.artifact.path -cne $ExpectedArtifactPath -or [string]$Identity.artifact.sha256 -cne $ExpectedArtifactHash) {
    throw 'Pinned FAL identity does not bind the exact final-synthesis artifact.'
  }
  foreach ($Optional in @(@('target_head', $FalTargetHead), @('target_ref', $FalTargetRef), @('target_status', $FalTargetStatus))) {
    if (-not [string]::IsNullOrWhiteSpace([string]$Optional[1]) -and [string]$Identity.($Optional[0]) -cne [string]$Optional[1]) {
      throw "Pinned FAL identity mismatch for '$($Optional[0])'."
    }
  }
}

function Test-ReviewFixInputObject {
  param([object]$Left, [object]$Right)
  return ((Get-OCRouterStringSha256 -Text ($Left | ConvertTo-Json -Depth 12 -Compress)) -ceq (Get-OCRouterStringSha256 -Text ($Right | ConvertTo-Json -Depth 12 -Compress)))
}

if ($CycleIndex -lt 1) { throw 'CycleIndex must be at least 1.' }
if ($PollSeconds -lt 1 -or $TimeoutMinutes -lt 1 -or $Limit -lt 1 -or $CandidateCount -lt 1 -or $StablePolls -lt 1 -or $MinOutputChars -lt 1) {
  throw 'Polling, timeout, candidate, stability, and output-size values must be positive.'
}
if ($UseSwarmReview -or $ForceFullReview) { throw 'Active Swarm review transport is retired. Run the fix cycle with native /step-review.' }
if ((Normalize-OCRouterSwarmReviewDepth -Depth $SwarmReviewDepth) -notin @('auto','none')) { throw 'SwarmReviewDepth is retired. Use the native review budget/cap envelope.' }
$SkipSwarmReview = $true

$ResolvedSynthesis = Resolve-ReviewFixFile -Field 'PinnedFinalSynthesisPath' -Path $PinnedFinalSynthesisPath
$ResolvedDelivery = Resolve-ReviewFixFile -Field 'PinnedDeliveryResponsePath' -Path $PinnedDeliveryResponsePath
$ResolvedReceipt = Resolve-ReviewFixFile -Field 'PinnedDeliveryReceiptPath' -Path $PinnedDeliveryReceiptPath
$ResolvedFalProposal = if ([string]::IsNullOrWhiteSpace($PinnedFalCheckpointProposalPath)) { '' } else { Resolve-ReviewFixFile -Field 'PinnedFalCheckpointProposalPath' -Path $PinnedFalCheckpointProposalPath }
$SynthesisText = Get-Content -LiteralPath $ResolvedSynthesis -Raw
$DeliveryText = Get-Content -LiteralPath $ResolvedDelivery -Raw
$LaneContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  candidate = $Candidate
  accountable_lane = $AccountableLaneId
  lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile
}
if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $SynthesisText -Context $LaneContext)) {
  throw 'Pinned final synthesis is not the exact 16-line artifact for this Target/Epic/Candidate/Accountable Lane.'
}
if (-not (Test-OCRouterLaneContextBinding -Text $SynthesisText -Context $LaneContext)) {
  throw 'Pinned final synthesis Target/Epic/Candidate/Accountable Lane binding mismatch.'
}
$Disposition = Get-OCRouterFinalSynthesisDisposition -Text $SynthesisText
$OpenFixIds = @(Get-OCRouterFinalOpenFixFindingIds -Text $SynthesisText)
$DeliveryContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  candidate = $Candidate
  accountable_lane = $AccountableLaneId
  lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile
  closeout_disposition = $Disposition
  accepted_finding_ids = @($OpenFixIds)
}
if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $DeliveryText -Context $DeliveryContext)) {
  throw "Pinned Delivery response violates disposition '$Disposition' or exact finding/lane/candidate binding."
}
$DeliveryClass = Get-OCRouterModeFromText -Text $DeliveryText
$ReceiptRecord = Get-Content -LiteralPath $ResolvedReceipt -Raw | ConvertFrom-Json
$ReceiptFalIdentity = if ($null -eq $ReceiptRecord.PSObject.Properties['fal_checkpoint_identity']) { $null } else { $ReceiptRecord.fal_checkpoint_identity }
Assert-OCRouterArtifactDeliveryReceipt `
  -ReceiptPath $ResolvedReceipt `
  -ArtifactPath $ResolvedSynthesis `
  -ProducerSession $Meta `
  -Command 'step-review' `
  -Target $Target `
  -Recipient $Track `
  -ResponseClass $DeliveryClass `
  -ResponseArtifactPath $ResolvedDelivery `
  -ResponseMessageId ([string]$ReceiptRecord.response_message_id) `
  -DispatchIntentPath ([string]$ReceiptRecord.dispatch_intent) `
  -FalCheckpointIdentity $ReceiptFalIdentity | Out-Null

$ExpectedSourceStage = if ($CycleIndex -gt 1) { 'review_fix_delivery_response' } else { 'step_review_delivery_response' }
if ($FalSyncCheckpoint) {
  foreach ($Required in @($FalProjectId, $FalProjectName, $FalTargetRepoKind, $FalTargetRepoPath, $FalTargetWorktreePath, $FalControlRoot, $ResolvedFalProposal)) {
    if ([string]::IsNullOrWhiteSpace([string]$Required)) { throw 'FalSyncCheckpoint requires the complete FAL tuple and pinned proposal.' }
  }
  Assert-ReviewFixSourceFalBinding -Identity $ReceiptFalIdentity -ExpectedArtifactPath $ResolvedSynthesis -ExpectedArtifactHash (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedSynthesis).Hash -ExpectedStage $ExpectedSourceStage -ExpectedCandidate $Candidate
  Assert-OCRouterFalCheckpointTargetProposal `
    -ProposalPath $ResolvedFalProposal `
    -CheckpointIdentity $ReceiptFalIdentity `
    -ProjectName $FalProjectName `
    -Target $Target `
    -ReceiptPath $ResolvedReceipt `
    -DeliveryResponseClass $DeliveryClass | Out-Null
}
elseif ($null -ne $ReceiptFalIdentity -or -not [string]::IsNullOrWhiteSpace($ResolvedFalProposal)) {
  throw 'Source artifacts contain a FAL checkpoint binding but FalSyncCheckpoint was not selected.'
}

$Inspection = [pscustomobject]@{
  target = $Target
  epic = $Epic
  wave = $Wave
  candidate = $Candidate
  accountable_lane = $AccountableLaneId
  closeout_disposition = $Disposition
  delivery_response_class = $DeliveryClass
  open_fix_finding_ids = @($OpenFixIds)
  next_action = switch ($Disposition) {
    'ALLOWED' { '/closeout-commit' }
    'FIX_REQUIRED' { 'Meta /terv-review' }
    'BLOCKED' { 'Meta/Orchestrator question or named gate' }
  }
}
if ($InspectOnly) { return $Inspection }

if ($Resume -and [string]::IsNullOrWhiteSpace($RunId)) { throw '-RunId is required with -Resume.' }
if ([string]::IsNullOrWhiteSpace($RunId)) { $RunId = "review-fix-$((Get-OCRouterSafeName -Value $Track))-$CycleIndex-$((Get-OCRouterSafeTimestamp))" }
if ([string]::IsNullOrWhiteSpace($StepReviewRunId)) { $StepReviewRunId = "$RunId-step" }
$RunDir = Join-Path (Join-Path $RouterDir 'review-fix-runs') (Get-OCRouterSafeName -Value $RunId)
$RunLock = Enter-OCRouterRunLock -RunDir $RunDir
trap {
  $Failure = $_
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  throw $Failure.Exception
}

$InputBinding = [pscustomobject][ordered]@{
  track = $Track; target = $Target; epic = $Epic; wave = $Wave; candidate = $Candidate
  accountable_lane_id = $AccountableLaneId; accountable_lane_class = $AccountableLaneClass; accountable_lane_profile = $AccountableLaneProfile
  cycle_index = $CycleIndex; meta = $Meta; swarm_assistant = $SwarmAssistant
  synthesis_path = $ResolvedSynthesis; synthesis_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedSynthesis).Hash
  delivery_path = $ResolvedDelivery; delivery_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedDelivery).Hash
  receipt_path = $ResolvedReceipt; receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedReceipt).Hash
  fal_sync_checkpoint = [bool]$FalSyncCheckpoint; fal_proposal_path = $ResolvedFalProposal
  fal_project_id = $FalProjectId; fal_project_name = $FalProjectName; fal_target_repo_kind = $FalTargetRepoKind
  fal_target_repo_path = $FalTargetRepoPath; fal_target_worktree_path = $FalTargetWorktreePath
  fal_target_head = $FalTargetHead; fal_target_ref = $FalTargetRef; fal_target_status = $FalTargetStatus; fal_control_root = $FalControlRoot
}
$State = $null
if ($Resume) {
  $State = Load-ReviewFixState -RunDirectory $RunDir
  if ([int]$State.version -ne 3) { throw 'Saved review-fix run predates the mandatory plan-review/revision lifecycle and cannot resume safely.' }
  if (-not (Test-ReviewFixInputObject -Left $InputBinding -Right $State.input_binding)) { throw 'Review-fix resume input or pinned artifact drift.' }
}
else {
  if (Test-Path -LiteralPath (Join-Path $RunDir 'state.json')) { throw "Run already exists; use -Resume -RunId '$RunId'." }
  $State = [pscustomobject][ordered]@{
    version = 3
    run_id = $RunId
    created_at = (Get-Date).ToString('o')
    input_binding = $InputBinding
    source_disposition = $Disposition
    source_delivery_class = $DeliveryClass
    plan_review = [pscustomobject][ordered]@{
      baseline_message_id = ''; baseline_identity = ''; dispatch_intent_path = ''; artifact_path = ''; artifact_sha256 = ''; artifact_pin = $null
    }
    plan_revision = [pscustomobject][ordered]@{
      baseline_message_id = ''; baseline_identity = ''; dispatch_intent_path = ''; artifact_path = ''; artifact_sha256 = ''; artifact_pin = $null
      terminal = ''; final_artifact_identity = ''
    }
    implementation = [pscustomobject][ordered]@{
      baseline_message_id = ''; baseline_identity = ''; dispatch_intent_path = ''; dispatch_returned_id = ''
      artifact_path = ''; artifact_sha256 = ''; artifact_pin = $null; receipt_path = ''; terminal = ''; candidate = ''
    }
    step_review = [pscustomobject][ordered]@{ run_id = $StepReviewRunId; status = 'not_started'; run_dir = ''; final_synthesis = ''; delivery_response = ''; delivery_receipt = ''; fal_proposal = '' }
    outcome = ''; next_action = ''; completed_at = ''
  }
  Save-ReviewFixState -RunDirectory $RunDir -State $State
}

if ($Disposition -eq 'ALLOWED') {
  if ($DeliveryClass -cne 'ACK_ONLY') { throw 'ALLOWED may continue only from exact ACK_ONLY.' }
  $State.outcome = 'ACKNOWLEDGED_FOR_CLOSEOUT'; $State.next_action = '/closeout-commit'; $State.completed_at = (Get-Date).ToString('o')
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  return [pscustomobject]@{ run_id = $RunId; outcome = $State.outcome; next_action = $State.next_action; source = $Inspection }
}
if ($Disposition -eq 'BLOCKED') {
  if ($DeliveryClass -cne 'UNCLEAR') { throw 'BLOCKED may stop only from exact UNCLEAR.' }
  $State.outcome = 'BLOCKED_NEEDS_QUESTION'; $State.next_action = 'Meta/Orchestrator question or named gate'; $State.completed_at = (Get-Date).ToString('o')
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  return [pscustomobject]@{ run_id = $RunId; outcome = $State.outcome; next_action = $State.next_action; source = $Inspection }
}
if ($Disposition -cne 'FIX_REQUIRED' -or $DeliveryClass -cne 'FIX_PLAN_REQUIRED' -or $OpenFixIds.Count -eq 0) {
  throw 'Only a FIX_REQUIRED synthesis plus exact 12-line FIX_PLAN_REQUIRED response may enter implementation.'
}

if ([string]::IsNullOrWhiteSpace($Password)) { $Password = Read-Host 'OpenCode server password' }
$Config = Get-OCRouterConfig -RouterDir $RouterDir
$TrackEntry = Get-OCRouterSessionEntry -Config $Config -Name $Track
$MetaEntry = Get-OCRouterSessionEntry -Config $Config -Name $Meta
$Server = $Config.server.TrimEnd('/')
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password
$ReadUri = "$Server/session/$($TrackEntry.sessionId)/message?limit=$Limit"
$CommandUri = "$Server/session/$($TrackEntry.sessionId)/command"
$MetaReadUri = "$Server/session/$($MetaEntry.sessionId)/message?limit=$Limit"
$MetaCommandUri = "$Server/session/$($MetaEntry.sessionId)/command"
$FixPlanArtifactIdentity = Get-OCRouterTopLevelFieldValue -Text $DeliveryText -Field 'Fix-plan artifact'
if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $FixPlanArtifactIdentity)) { throw 'The pinned FIX_PLAN_REQUIRED artifact has an invalid opaque Fix-plan artifact identity.' }
$PlanReviewContext = [pscustomobject]@{
  target = $Target; epic = $Epic; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile; plan_class = 'REVIEW_FIX_PLAN'; plan_artifact = $FixPlanArtifactIdentity
}
$PlanRevisionContext = [pscustomobject]@{
  target = $Target; epic = $Epic; candidate = $Candidate; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile; plan_class = 'REVIEW_FIX_PLAN'; accepted_finding_ids = @($OpenFixIds)
}

$MetaReviewText = ''
if (-not [string]::IsNullOrWhiteSpace([string]$State.plan_review.artifact_path)) {
  Assert-OCRouterArtifactPin -Pin $State.plan_review.artifact_pin | Out-Null
  $MetaReviewText = Get-Content -LiteralPath ([string]$State.plan_review.artifact_path) -Raw
  if (-not (Test-OCRouterExpectedOutputKind -Text $MetaReviewText -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $PlanReviewContext)) { throw 'Pinned REVIEW_FIX_PLAN Meta review drift.' }
}
else {
  if ([string]::IsNullOrWhiteSpace([string]$State.plan_review.baseline_message_id)) {
    $MetaBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst)
    $State.plan_review.baseline_message_id = [string]$MetaBaseline.MessageId
    $State.plan_review.baseline_identity = 'id:' + [string]$MetaBaseline.MessageId
    Save-ReviewFixState -RunDirectory $RunDir -State $State
  }
  $ReviewBody = New-OCRouterCommandRequestBodyObject -Command 'terv-review' -Arguments $DeliveryText -Model $MetaModel | ConvertTo-Json -Depth 10
  $ReviewIntent = Start-OCRouterDispatchIntent `
    -RunDir $RunDir -Transition 'dispatch-fix-plan-terv-review' -Recipient $Meta -Kind command -Operation 'terv-review' `
    -Payload $ReviewBody -BaselineIdentity ([string]$State.plan_review.baseline_identity) `
    -CandidateIdentity $FixPlanArtifactIdentity -Stage 'review_fix_meta_plan_review'
  $State.plan_review.dispatch_intent_path = [string]$ReviewIntent.path
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ([bool]$ReviewIntent.should_send) {
    if (-not $AutoApprove) {
      Write-OCRouterTextPreview -Text $DeliveryText
      $Approval = Read-Host "Send exact pinned FIX_PLAN_REQUIRED artifact to '$Meta' /terv-review? [y/N]"
      if ($Approval -ne 'y' -and $Approval -ne 'Y') { throw 'Meta fix-plan review dispatch declined.' }
    }
    $ReviewResponse = Invoke-RestMethod -Method Post -Uri $MetaCommandUri -Headers $Headers -ContentType 'application/json' -Body $ReviewBody
    Complete-OCRouterDispatchIntent -Path $ReviewIntent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $ReviewResponse) -TransportStatus 'accepted' | Out-Null
  }
  $MetaCandidate = Wait-OCRouterNewOutput `
    -Label '12-line REVIEW_FIX_PLAN Meta review' -Uri $MetaReadUri -Headers $Headers `
    -BaselineIdentity ([string]$State.plan_review.baseline_identity) -BaselineMessageId ([string]$State.plan_review.baseline_message_id) `
    -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount `
    -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars `
    -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $PlanReviewContext -AutoUseFirstStable:($AutoUseFirstStable -or $AutoApprove)
  $MetaReviewText = [string]$MetaCandidate.Text
  $MetaReviewPath = Join-Path $RunDir '01-meta-review-fix-plan.md'
  Write-OCRouterAtomicTextFile -Path $MetaReviewPath -Text $MetaReviewText
  $MetaReviewPin = New-OCRouterArtifactPin -Path $MetaReviewPath -ProducerMessageId ([string]$MetaCandidate.MessageId) -Stage 'review_fix_meta_plan_review' -CandidateIdentity ('id:' + [string]$MetaCandidate.MessageId) -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $PlanReviewContext
  $State.plan_review.artifact_path = $MetaReviewPath; $State.plan_review.artifact_sha256 = [string]$MetaReviewPin.sha256; $State.plan_review.artifact_pin = $MetaReviewPin
  Save-ReviewFixState -RunDirectory $RunDir -State $State
}

$RevisionText = ''
if (-not [string]::IsNullOrWhiteSpace([string]$State.plan_revision.artifact_path)) {
  Assert-OCRouterArtifactPin -Pin $State.plan_revision.artifact_pin | Out-Null
  $RevisionText = Get-Content -LiteralPath ([string]$State.plan_revision.artifact_path) -Raw
  if (-not (Test-OCRouterExpectedOutputKind -Text $RevisionText -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $PlanRevisionContext)) { throw 'Pinned revised review-fix plan drift.' }
}
else {
  if ([string]::IsNullOrWhiteSpace([string]$State.plan_revision.baseline_message_id)) {
    $RevisionBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $ReadUri -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst)
    $State.plan_revision.baseline_message_id = [string]$RevisionBaseline.MessageId
    $State.plan_revision.baseline_identity = 'id:' + [string]$RevisionBaseline.MessageId
    Save-ReviewFixState -RunDirectory $RunDir -State $State
  }
  $RevisionArguments = New-OCRouterPlanRevisionArgument -SourcePlanText $DeliveryText -MetaReviewText $MetaReviewText
  $RevisionBody = New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $RevisionArguments | ConvertTo-Json -Depth 10
  $RevisionIntent = Start-OCRouterDispatchIntent `
    -RunDir $RunDir -Transition 'dispatch-fix-plan-terv-review-utan' -Recipient $Track -Kind command -Operation 'terv-review-utan' `
    -Payload $RevisionBody -BaselineIdentity ([string]$State.plan_revision.baseline_identity) `
    -CandidateIdentity ([string]$State.plan_review.artifact_pin.candidate_identity) -Stage 'review_fix_plan_revision'
  $State.plan_revision.dispatch_intent_path = [string]$RevisionIntent.path
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ([bool]$RevisionIntent.should_send) {
    Assert-OCRouterParentSessionCommandSafe -Server $Server -Headers $Headers -CommandName 'terv-review-utan'
    if (-not $AutoApprove) {
      Write-OCRouterTextPreview -Text $RevisionArguments
      $Approval = Read-Host "Send exact pinned fix plan plus matching REVIEW_FIX_PLAN Meta review to '$Track' /terv-review-utan? [y/N]"
      if ($Approval -ne 'y' -and $Approval -ne 'Y') { throw 'Fix-plan revision dispatch declined.' }
    }
    $RevisionResponse = Invoke-RestMethod -Method Post -Uri $CommandUri -Headers $Headers -ContentType 'application/json' -Body $RevisionBody
    Complete-OCRouterDispatchIntent -Path $RevisionIntent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $RevisionResponse) -TransportStatus 'accepted' | Out-Null
  }
  $RevisionCandidate = Wait-OCRouterNewOutput `
    -Label '14-line revised review-fix plan plus 9-line DELIVERY PLAN REVISION' -Uri $ReadUri -Headers $Headers `
    -BaselineIdentity ([string]$State.plan_revision.baseline_identity) -BaselineMessageId ([string]$State.plan_revision.baseline_message_id) `
    -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount `
    -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars `
    -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $PlanRevisionContext -AutoUseFirstStable:($AutoUseFirstStable -or $AutoApprove)
  $RevisionText = [string]$RevisionCandidate.Text
  $RevisionPath = Join-Path $RunDir '02-revised-review-fix-plan.md'
  Write-OCRouterAtomicTextFile -Path $RevisionPath -Text $RevisionText
  $RevisionPin = New-OCRouterArtifactPin -Path $RevisionPath -ProducerMessageId ([string]$RevisionCandidate.MessageId) -Stage 'review_fix_plan_revision' -CandidateIdentity ('id:' + [string]$RevisionCandidate.MessageId) -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $PlanRevisionContext
  $State.plan_revision.artifact_path = $RevisionPath; $State.plan_revision.artifact_sha256 = [string]$RevisionPin.sha256; $State.plan_revision.artifact_pin = $RevisionPin
  Save-ReviewFixState -RunDirectory $RunDir -State $State
}
$RevisionLines = @(($RevisionText -replace "`r`n", "`n" -replace "`r", "`n") -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$RevisionTerminal = if ($RevisionLines.Count -gt 0) { [string]$RevisionLines[$RevisionLines.Count - 1] } else { '' }
$State.plan_revision.terminal = $RevisionTerminal
$State.plan_revision.final_artifact_identity = Get-OCRouterTopLevelFieldValue -Text $RevisionText -Field 'Final plan artifact'
$FinalPlanArtifactIdentity = [string]$State.plan_revision.final_artifact_identity
if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $FinalPlanArtifactIdentity)) { throw 'The revised review-fix plan has an invalid final opaque artifact identity.' }
$ImplementationContext = [pscustomobject]@{
  target = $Target; epic = $Epic; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile; plan_artifact_identity = $FinalPlanArtifactIdentity
}
Save-ReviewFixState -RunDirectory $RunDir -State $State
if ($RevisionTerminal -cne 'IMPLEMENT_READY') {
  $State.outcome = 'PLAN_REVISION_BLOCKED'; $State.next_action = 'Meta/Orchestrator'; $State.completed_at = (Get-Date).ToString('o')
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  return [pscustomobject]@{ run_id = $RunId; outcome = $State.outcome; next_action = $State.next_action; reviewed_fix_plan = $FixPlanArtifactIdentity }
}
$RevisionPath = [string]$State.plan_revision.artifact_path
$ReviewIntentPath = [string]$State.plan_review.dispatch_intent_path
$RevisionIntentPath = [string]$State.plan_revision.dispatch_intent_path
foreach ($IntentCheck in @(@($ReviewIntentPath, 'terv-review'), @($RevisionIntentPath, 'terv-review-utan'))) {
  if ([string]::IsNullOrWhiteSpace([string]$IntentCheck[0]) -or -not (Test-Path -LiteralPath ([string]$IntentCheck[0]) -PathType Leaf)) {
    throw "Revised review-fix implementation authority lacks the durable $($IntentCheck[1]) dispatch intent."
  }
  $IntentRecord = Get-Content -LiteralPath ([string]$IntentCheck[0]) -Raw | ConvertFrom-Json
  if ([string]$IntentRecord.status -cne 'dispatched' -or [string]$IntentRecord.operation -cne [string]$IntentCheck[1]) {
    throw "Revised review-fix implementation authority is not bound to a completed $($IntentCheck[1]) dispatch."
  }
}

if ([string]::IsNullOrWhiteSpace([string]$State.implementation.baseline_message_id)) {
  $Baseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $ReadUri -Headers $Headers -AssumeNewestFirst:(-not $AssumeOldestFirst)
  if ($null -eq $Baseline -or [string]::IsNullOrWhiteSpace([string]$Baseline.MessageId)) { throw 'Cannot dispatch /implement without a raw assistant baseline message ID.' }
  $State.implementation.baseline_message_id = [string]$Baseline.MessageId
  $State.implementation.baseline_identity = 'id:' + [string]$Baseline.MessageId
  Save-ReviewFixState -RunDirectory $RunDir -State $State
}

$RequestObject = New-OCRouterCommandRequestBodyObject -Command 'implement' -Arguments $RevisionText
$RequestBody = $RequestObject | ConvertTo-Json -Depth 10
if ([string]::IsNullOrWhiteSpace([string]$State.implementation.artifact_path)) {
  $Intent = Start-OCRouterDispatchIntent `
    -RunDir $RunDir -Transition 'dispatch-implement' -Recipient $Track -Kind command -Operation 'implement' `
    -Payload $RequestBody -BaselineIdentity ([string]$State.implementation.baseline_identity) `
    -CandidateIdentity $Candidate -Stage 'fix_implementation_dispatch'
  $State.implementation.dispatch_intent_path = [string]$Intent.path
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ([bool]$Intent.should_send) {
    Assert-OCRouterParentSessionCommandSafe -Server $Server -Headers $Headers -CommandName 'implement'
    if (-not $AutoApprove) {
      Write-OCRouterTextPreview -Text $RevisionText
      $Approval = Read-Host "Send exact pinned revised review-fix plan to '$Track' /implement? [y/N]"
      if ($Approval -ne 'y' -and $Approval -ne 'Y') { throw 'Implementation dispatch declined.' }
    }
    $Response = Invoke-RestMethod -Method Post -Uri $CommandUri -Headers $Headers -ContentType 'application/json' -Body $RequestBody
    $CompletedIntent = Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) -TransportStatus 'accepted'
    $State.implementation.dispatch_returned_id = [string]$CompletedIntent.returned_id
    Save-ReviewFixState -RunDirectory $RunDir -State $State
  }
}

$ImplementationPath = Join-Path $RunDir '01-track-implementation.md'
$ImplementationText = ''
if (-not [string]::IsNullOrWhiteSpace([string]$State.implementation.artifact_path)) {
  $ImplementationPath = [string]$State.implementation.artifact_path
  Assert-OCRouterArtifactPin -Pin $State.implementation.artifact_pin | Out-Null
  $ImplementationText = Get-Content -LiteralPath $ImplementationPath -Raw
  if (-not (Test-OCRouterExpectedOutputKind -Text $ImplementationText -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext)) { throw 'Saved implementation result binding drift.' }
}
else {
  $Selected = Wait-ReviewFixImplementation -Uri $ReadUri -Headers $Headers -BaselineMessageId ([string]$State.implementation.baseline_message_id) -ExpectedContext $ImplementationContext
  $ImplementationText = [string]$Selected.Text
  Write-OCRouterAtomicTextFile -Path $ImplementationPath -Text $ImplementationText
  $Pin = New-OCRouterArtifactPin -Path $ImplementationPath -ProducerMessageId ([string]$Selected.MessageId) -Stage 'fix_implementation' -CandidateIdentity (Get-ReviewFixCandidateIdentity -CandidateRecord $Selected) -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext
  $State.implementation.artifact_path = $ImplementationPath
  $State.implementation.artifact_sha256 = [string]$Pin.sha256
  $State.implementation.artifact_pin = $Pin
  Save-ReviewFixState -RunDirectory $RunDir -State $State
}

$ImplementationTerminal = Get-OCRouterModeFromText -Text $ImplementationText
$ImplementedCandidate = Get-OCRouterTopLevelFieldValue -Text $ImplementationText -Field 'Candidate identity/worktree limitations'
if ([string]::IsNullOrWhiteSpace($ImplementedCandidate) -or $ImplementationTerminal -notin @('REVIEW_READY', 'IMPLEMENT_BLOCKED')) { throw 'Implementation child output is not an exact terminal implementation result.' }
Assert-OCRouterArtifactPin -Pin $State.implementation.artifact_pin | Out-Null
if ([string]$State.implementation.artifact_sha256 -cne (Get-FileHash -Algorithm SHA256 -LiteralPath $ImplementationPath).Hash -or
    [string]$State.implementation.artifact_sha256 -cne [string]$State.implementation.artifact_pin.sha256) {
  throw 'Implementation artifact/state pin drift before step-review child handoff.'
}
$State.implementation.terminal = $ImplementationTerminal
$State.implementation.candidate = $ImplementedCandidate
$ImplementationReceipt = [string]$State.implementation.receipt_path
if ([string]::IsNullOrWhiteSpace($ImplementationReceipt)) {
  $ImplementationReceipt = Write-OCRouterArtifactDeliveryReceipt `
    -RunDir $RunDir -Name 'fix-implementation' -ArtifactPath $RevisionPath -ProducerSession $Track -Command 'implement' `
    -Target $Target -Recipient $Track -DeliveryProven $true -ResponseClass $ImplementationTerminal `
    -ResponseArtifactPath $ImplementationPath -ResponseMessageId ([string]$State.implementation.artifact_pin.producer_message_id) `
    -DispatchIntentPath ([string]$State.implementation.dispatch_intent_path)
  $State.implementation.receipt_path = $ImplementationReceipt
  Save-ReviewFixState -RunDirectory $RunDir -State $State
}
else {
  Assert-OCRouterArtifactDeliveryReceipt `
    -ReceiptPath $ImplementationReceipt -ArtifactPath $RevisionPath -ProducerSession $Track -Command 'implement' `
    -Target $Target -Recipient $Track -ResponseClass $ImplementationTerminal -ResponseArtifactPath $ImplementationPath `
    -ResponseMessageId ([string]$State.implementation.artifact_pin.producer_message_id) -DispatchIntentPath ([string]$State.implementation.dispatch_intent_path) | Out-Null
}
if ($ImplementationTerminal -eq 'IMPLEMENT_BLOCKED') {
  $State.outcome = 'IMPLEMENTATION_BLOCKED'; $State.next_action = 'Meta/Orchestrator'; $State.completed_at = (Get-Date).ToString('o')
  Save-ReviewFixState -RunDirectory $RunDir -State $State
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  return [pscustomobject]@{ run_id = $RunId; outcome = $State.outcome; next_action = $State.next_action; implementation_candidate = $ImplementedCandidate }
}

$StepReviewScript = Join-Path $PSScriptRoot 'run-step-review-flow.ps1'
if (-not (Test-Path -LiteralPath $StepReviewScript -PathType Leaf)) { throw "Missing step-review wrapper: $StepReviewScript" }
$ChildRunDir = Join-Path (Join-Path $RouterDir 'step-review-runs') (Get-OCRouterSafeName -Value $StepReviewRunId)
$ChildStatePath = Join-Path $ChildRunDir 'state.json'
$StepArguments = @{
  Track = $Track; Target = $Target; Epic = $Epic; Wave = $Wave
  AccountableLaneId = $AccountableLaneId; AccountableLaneClass = $AccountableLaneClass; AccountableLaneProfile = $AccountableLaneProfile
  PinnedImplementationArtifactPath = $ImplementationPath; PinnedImplementationArtifactSha256 = [string]$State.implementation.artifact_pin.sha256
  PinnedImplementationProducerMessageId = [string]$State.implementation.artifact_pin.producer_message_id; PinnedImplementationCandidate = $ImplementedCandidate
  Meta = $Meta; SwarmAssistant = $SwarmAssistant; PollSeconds = $PollSeconds; TimeoutMinutes = $TimeoutMinutes
  Limit = $Limit; CandidateCount = $CandidateCount; StablePolls = $StablePolls; MinOutputChars = $MinOutputChars
  RouterDir = $RouterDir; Username = $Username; Password = $Password; AssumeOldestFirst = $AssumeOldestFirst
  IncludeReasoningParts = $IncludeReasoningParts; AutoUseFirstStable = $AutoUseFirstStable; AutoApprove = $AutoApprove
  ProjectReviewContext = $ProjectReviewContext; ReviewFocus = $ReviewFocus
  ModelProfile = $ModelProfile; MetaModel = $MetaModel; SwarmMessageModel = $SwarmMessageModel
  SwarmReviewDepth = $SwarmReviewDepth; SwarmReviewFocus = $SwarmReviewFocus; ReviewCycleIndex = $CycleIndex; RunId = $StepReviewRunId
}
if ($FalSyncCheckpoint) {
  $StepArguments.FalSyncCheckpoint = $true
  $StepArguments.FalProjectId = $FalProjectId; $StepArguments.FalProjectName = $FalProjectName
  $StepArguments.FalTargetRepoKind = $FalTargetRepoKind; $StepArguments.FalTargetRepoPath = $FalTargetRepoPath
  $StepArguments.FalTargetWorktreePath = $FalTargetWorktreePath; $StepArguments.FalTargetHead = $FalTargetHead
  $StepArguments.FalTargetRef = $FalTargetRef; $StepArguments.FalTargetStatus = $FalTargetStatus
  $StepArguments.FalControlRoot = $FalControlRoot
}
if ($MetaInternalLanes -ge 0) { $StepArguments.MetaInternalLanes = $MetaInternalLanes }
if ($PSBoundParameters.ContainsKey('ReviewProfile')) { $StepArguments.ReviewProfile = $ReviewProfile }
if ($PSBoundParameters.ContainsKey('ReviewLanes')) { $StepArguments.ReviewLanes = $ReviewLanes }
if ($ExpandedReviewApproved) { $StepArguments.ExpandedReviewApproved = $true }
if (-not [string]::IsNullOrWhiteSpace($OwnerApprovalRecord)) { $StepArguments.OwnerApprovalRecord = $OwnerApprovalRecord }
if (-not [string]::IsNullOrWhiteSpace($OwnerApprovalCostEnvelope)) { $StepArguments.OwnerApprovalCostEnvelope = $OwnerApprovalCostEnvelope }
if (-not [string]::IsNullOrWhiteSpace($ReviewRegistryPath)) { $StepArguments.ReviewRegistryPath = $ReviewRegistryPath }
if ($SkipSwarmReview) { $StepArguments.SkipSwarmReview = $true }
if ($UseSwarmReview) { $StepArguments.UseSwarmReview = $true }
if ($ForceFullReview) { $StepArguments.ForceFullReview = $true }
if (Test-Path -LiteralPath $ChildStatePath -PathType Leaf) { $StepArguments.Resume = $true }
$State.step_review.status = 'started'; $State.step_review.run_dir = $ChildRunDir
Save-ReviewFixState -RunDirectory $RunDir -State $State
$ChildOutput = @(& $StepReviewScript @StepArguments)

if (-not (Test-Path -LiteralPath $ChildStatePath -PathType Leaf)) { throw 'Step-review child returned without durable state; exit is not acceptance.' }
$ChildState = Get-Content -LiteralPath $ChildStatePath -Raw | ConvertFrom-Json
$ChildImplementation = Join-Path $ChildRunDir '01-track-implementation.md'
if (-not (Test-Path -LiteralPath $ChildImplementation -PathType Leaf) -or
    (Get-FileHash -Algorithm SHA256 -LiteralPath $ChildImplementation).Hash -cne (Get-FileHash -Algorithm SHA256 -LiteralPath $ImplementationPath).Hash -or
    [string]$ChildState.reviewed_candidate -cne $ImplementedCandidate) {
  throw 'Step-review child did not consume the exact pinned implementation candidate.'
}
$ChildSynthesis = Join-Path $ChildRunDir '05-meta-final-synthesis.md'
$ChildDelivery = Join-Path $ChildRunDir '06-track-delivery-response.md'
if (-not (Test-Path -LiteralPath $ChildSynthesis -PathType Leaf) -or -not (Test-Path -LiteralPath $ChildDelivery -PathType Leaf)) { throw 'Step-review child lacks terminal artifacts; exit is not acceptance.' }
$ChildSynthesisText = Get-Content -LiteralPath $ChildSynthesis -Raw
$ChildDeliveryText = Get-Content -LiteralPath $ChildDelivery -Raw
$ChildContext = [pscustomobject]@{ target = $Target; epic = $Epic; candidate = $ImplementedCandidate; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass; lane_profile = $AccountableLaneProfile }
if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $ChildSynthesisText -Context $ChildContext) -or
    -not (Test-OCRouterLaneContextBinding -Text $ChildSynthesisText -Context $ChildContext)) { throw 'Step-review child final synthesis is not exact/context-bound.' }
$ChildDisposition = Get-OCRouterFinalSynthesisDisposition -Text $ChildSynthesisText
$ChildFixIds = @(Get-OCRouterFinalOpenFixFindingIds -Text $ChildSynthesisText)
$ChildDeliveryContext = [pscustomobject]@{ target = $Target; epic = $Epic; candidate = $ImplementedCandidate; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass; lane_profile = $AccountableLaneProfile; closeout_disposition = $ChildDisposition; accepted_finding_ids = @($ChildFixIds) }
if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $ChildDeliveryText -Context $ChildDeliveryContext)) { throw 'Step-review child Delivery response is not exact/context-bound.' }
$ChildDeliveryClass = Get-OCRouterModeFromText -Text $ChildDeliveryText
$ChildReceiptPath = [string]$ChildState.delivery_receipt_path
if ([string]::IsNullOrWhiteSpace($ChildReceiptPath) -or -not (Test-Path -LiteralPath $ChildReceiptPath -PathType Leaf)) { throw 'Step-review child lacks delivery receipt.' }
$ChildReceipt = Get-Content -LiteralPath $ChildReceiptPath -Raw | ConvertFrom-Json
$ChildFalIdentity = if ($null -eq $ChildReceipt.PSObject.Properties['fal_checkpoint_identity']) { $null } else { $ChildReceipt.fal_checkpoint_identity }
Assert-OCRouterArtifactDeliveryReceipt -ReceiptPath $ChildReceiptPath -ArtifactPath $ChildSynthesis -ProducerSession $Meta -Command 'step-review' -Target $Target -Recipient $Track -ResponseClass $ChildDeliveryClass -ResponseArtifactPath $ChildDelivery -ResponseMessageId ([string]$ChildReceipt.response_message_id) -DispatchIntentPath ([string]$ChildReceipt.dispatch_intent) -FalCheckpointIdentity $ChildFalIdentity | Out-Null
if ($FalSyncCheckpoint) {
  Assert-ReviewFixSourceFalBinding -Identity $ChildFalIdentity -ExpectedArtifactPath (Resolve-Path -LiteralPath $ChildSynthesis).Path -ExpectedArtifactHash (Get-FileHash -Algorithm SHA256 -LiteralPath $ChildSynthesis).Hash -ExpectedStage 'review_fix_delivery_response' -ExpectedCandidate $ImplementedCandidate
  $ChildProposal = [string]$ChildState.fal_checkpoint_operation_path
  if ([string]::IsNullOrWhiteSpace($ChildProposal)) { throw 'FalSyncCheckpoint child lacks proposal.' }
  Assert-OCRouterFalCheckpointTargetProposal -ProposalPath $ChildProposal -CheckpointIdentity $ChildFalIdentity -ProjectName $FalProjectName -Target $Target -ReceiptPath $ChildReceiptPath -DeliveryResponseClass $ChildDeliveryClass | Out-Null
  $State.step_review.fal_proposal = $ChildProposal
}
elseif ($null -ne $ChildFalIdentity) { throw 'Step-review child unexpectedly emitted a FAL identity.' }

$State.step_review.status = 'validated'; $State.step_review.final_synthesis = $ChildSynthesis; $State.step_review.delivery_response = $ChildDelivery; $State.step_review.delivery_receipt = $ChildReceiptPath
$State.outcome = switch ($ChildDisposition) { 'ALLOWED' { 'ACKNOWLEDGED_FOR_CLOSEOUT' } 'FIX_REQUIRED' { 'NEXT_FIX_CYCLE_REQUIRED' } 'BLOCKED' { 'BLOCKED_NEEDS_QUESTION' } }
$State.next_action = switch ($ChildDisposition) { 'ALLOWED' { '/closeout-commit' } 'FIX_REQUIRED' { 'Meta /terv-review after exact next fix plan' } 'BLOCKED' { 'Meta/Orchestrator question or named gate' } }
$State.completed_at = (Get-Date).ToString('o')
Save-ReviewFixState -RunDirectory $RunDir -State $State
if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
[pscustomobject]@{
  run_id = $RunId; step_review_run_id = $StepReviewRunId; outcome = $State.outcome; next_action = $State.next_action
  implementation_candidate = $ImplementedCandidate; closeout_disposition = $ChildDisposition; delivery_response_class = $ChildDeliveryClass
  final_synthesis_path = $ChildSynthesis; delivery_response_path = $ChildDelivery; delivery_receipt_path = $ChildReceiptPath
  fal_checkpoint_operation_path = [string]$State.step_review.fal_proposal
}
