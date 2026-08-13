param(
  [string[]]$Lane = @(),

  [string]$Meta = "meta",
  [string]$MetaModel = "openai/gpt-5.6-sol",

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
  [switch]$StartSeqNext,
  [switch]$PreviewOnly,
  [switch]$FalSyncCheckpoint,
  [switch]$FalSyncApply,
  [ValidateSet('auto', 'git', 'non_git', 'declared_equivalent')]
  [string]$FalTargetRepoKind = 'auto',
  [string]$FalTargetRepoPath = "",
  [string]$FalTargetWorktreePath = "",
  [string]$FalTargetHead = "",
  [string]$FalTargetRef = "",
  [string]$FalTargetStatus = "",
  [string]$FalControlRoot = "",
  [string]$FalProjectId = "",
  [string]$FalProjectName = "",
  [switch]$Resume,
  [string]$RunId = ""
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: parallel lifecycle dispatch is unavailable.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

function Save-ParallelRunText {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$Text,
    [string]$ProducerMessageId,
    [string]$Stage,
    [string]$CandidateIdentity,
    [string]$ExpectedOutputKind = ''
  )

  if ([string]::IsNullOrWhiteSpace($ProducerMessageId) -or [string]::IsNullOrWhiteSpace($Stage) -or [string]::IsNullOrWhiteSpace($CandidateIdentity)) {
    throw "Parallel artifact '$Name' requires producer message ID, stage, and candidate identity."
  }
  $Path = Join-Path $RunDir $Name
  Write-OCRouterAtomicTextFile -Path $Path -Text $Text
  $Pin = New-OCRouterArtifactPin -Path $Path -ProducerMessageId $ProducerMessageId -Stage $Stage -CandidateIdentity $CandidateIdentity -ExpectedOutputKind $ExpectedOutputKind
  if ($null -eq $script:State.artifact_pins) { $script:State.artifact_pins = [pscustomobject]@{} }
  $script:State.artifact_pins | Add-Member -NotePropertyName $Name -NotePropertyValue $Pin -Force
  return $Path
}

function Get-ParallelRunText {
  param(
    [string]$RunDir,
    [string]$Name
  )

  $Path = Join-Path $RunDir $Name
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing saved parallel artifact: $Path" }
  if ($null -eq $script:State.artifact_pins -or $script:State.artifact_pins.PSObject.Properties.Name -notcontains $Name) {
    throw "Saved parallel artifact '$Name' has no durable state pin."
  }
  Assert-OCRouterArtifactPin -Pin $script:State.artifact_pins.$Name | Out-Null
  return Get-Content -LiteralPath $Path -Raw
}

function Save-ParallelRunState {
  param(
    [string]$RunDir,
    [object]$State
  )

  $Path = Join-Path $RunDir "state.json"
  Write-OCRouterAtomicJsonFile -Path $Path -Value $State
}

function Load-ParallelRunState {
  param([string]$RunDir)

  $Path = Join-Path $RunDir "state.json"
  if (-not (Test-Path $Path)) {
    throw "Missing parallel run state file: $Path"
  }

  return Get-Content $Path -Raw | ConvertFrom-Json
}

function Ensure-ParallelStateField {
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

function Get-ParallelLaneState {
  param(
    [object]$State,
    [string]$TrackKey
  )

  foreach ($LaneState in @($State.lanes)) {
    if ([string]$LaneState.track_key -eq $TrackKey) {
      return $LaneState
    }
  }

  throw "Missing lane state for track '$TrackKey'."
}

function Ensure-ParallelLaneStateDefaults {
  param([object]$LaneState)

  Ensure-ParallelStateField -Object $LaneState -Name "accountable_lane" -Value ([string]$LaneState.role_label)
  Ensure-ParallelStateField -Object $LaneState -Name "lane_class" -Value 'TRACK'
  Ensure-ParallelStateField -Object $LaneState -Name "lane_profile" -Value ([string]$LaneState.track_key)
  Ensure-ParallelStateField -Object $LaneState -Name "seq_next_baseline_identity" -Value ([string]$LaneState.seq_next_baseline_identity)
  Ensure-ParallelStateField -Object $LaneState -Name "seq_next_baseline_message_id" -Value ([string]$LaneState.seq_next_baseline_message_id)
  Ensure-ParallelStateField -Object $LaneState -Name "sent_seq_next" -Value ([bool]$LaneState.sent_seq_next)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_received" -Value ([bool]$LaneState.plan_received)
  Ensure-ParallelStateField -Object $LaneState -Name "sent_terv_review_utan" -Value ([bool]$LaneState.sent_terv_review_utan)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_revision_baseline_identity" -Value ([string]$LaneState.plan_revision_baseline_identity)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_revision_baseline_message_id" -Value ([string]$LaneState.plan_revision_baseline_message_id)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_revision_received" -Value ([bool]$LaneState.plan_revision_received)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_message_id" -Value ([string]$LaneState.plan_message_id)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_candidate_identity" -Value ([string]$LaneState.plan_candidate_identity)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_artifact" -Value ([string]$LaneState.plan_artifact)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_revision_message_id" -Value ([string]$LaneState.plan_revision_message_id)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_revision_candidate_identity" -Value ([string]$LaneState.plan_revision_candidate_identity)
  Ensure-ParallelStateField -Object $LaneState -Name "plan_revision_dispatch_intent_path" -Value ([string]$LaneState.plan_revision_dispatch_intent_path)
  Ensure-ParallelStateField -Object $LaneState -Name "delivery_receipt_path" -Value ([string]$LaneState.delivery_receipt_path)
  Ensure-ParallelStateField -Object $LaneState -Name "delivery_receipt_sha256" -Value ([string]$LaneState.delivery_receipt_sha256)
  Ensure-ParallelStateField -Object $LaneState -Name "fal_checkpoint_operation_path" -Value ([string]$LaneState.fal_checkpoint_operation_path)
  Ensure-ParallelStateField -Object $LaneState -Name "fal_checkpoint_operation_sha256" -Value ([string]$LaneState.fal_checkpoint_operation_sha256)
  Ensure-ParallelStateField -Object $LaneState -Name "fal_checkpoint_identity" -Value $LaneState.fal_checkpoint_identity
  Ensure-ParallelStateField -Object $LaneState -Name "fal_checkpoint_identity_sha256" -Value ([string]$LaneState.fal_checkpoint_identity_sha256)
}

function Invoke-ParallelPlanFalDurabilityTestHook {
  param(
    [string]$Stage,
    [string]$LaneKey
  )

  $Requested = [string]$env:OC_ROUTER_TEST_HARD_INTERRUPT_AFTER_PLAN_FAL
  if (-not [string]::IsNullOrWhiteSpace($Requested) -and $Requested -ceq ("{0}:{1}" -f $Stage, $LaneKey)) {
    Stop-Process -Id $PID -Force
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
    [switch]$AutoApprove,
    [switch]$PreviewOnly
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

  if ($PreviewOnly) {
    Write-Host "PreviewOnly active. Command not sent." -ForegroundColor Yellow
    return $false
  }

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
  $Body = New-OCRouterCommandRequestBodyObject -Command $CommandName -Arguments $Arguments -Model $Model | ConvertTo-Json -Depth 10
  $Intent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition $Transition -Recipient $LogicalName -Kind command -Operation $CommandName -Payload $Body -BaselineIdentity $BaselineIdentity -CandidateIdentity $CandidateIdentity -Stage $Stage
  if (-not [bool]$Intent.should_send) { return [pscustomobject]@{ path = [string]$Intent.path; intent = $Intent.intent } }
  $Response = Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType "application/json" -Body $Body
  $Completed = Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) -TransportStatus 'accepted'
  Write-Host "Sent command /$CommandName to $LogicalName." -ForegroundColor Green
  return [pscustomobject]@{ path = [string]$Intent.path; intent = $Completed }
}

$Settings = Get-OCRouterSettings -RouterDir $RouterDir
$PollSeconds = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "PollSeconds" -CurrentValue $PollSeconds -SettingName "poll_seconds")
$TimeoutMinutes = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "TimeoutMinutes" -CurrentValue $TimeoutMinutes -SettingName "timeout_minutes")
$Limit = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "Limit" -CurrentValue $Limit -SettingName "limit")
$CandidateCount = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "CandidateCount" -CurrentValue $CandidateCount -SettingName "candidate_count")
$StablePolls = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "StablePolls" -CurrentValue $StablePolls -SettingName "stable_polls")
$MinOutputChars = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "MinOutputChars" -CurrentValue $MinOutputChars -SettingName "min_output_chars")
if (-not $PSBoundParameters.ContainsKey("AssumeOldestFirst")) {
  $MessageOrder = [string](Get-OCRouterSettingValue -Settings $Settings -Name "message_order" -DefaultValue "")
  if ($MessageOrder -eq "oldest_first") {
    $AssumeOldestFirst = $true
  }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

$Config = Get-OCRouterConfig -RouterDir $RouterDir
$AssumeNewestFirst = -not $AssumeOldestFirst
$PlanStage = "plan_ready_for_meta_review"
if ($FalSyncApply) { throw 'FalSyncApply is retired. Parallel plan review emits proposal-only /fal-checkpoint-target operations after final Delivery revisions.' }
$ResolvedFalTargetRepoPath = ""
$ResolvedFalTargetWorktreePath = ""
$ResolvedFalTargetRepoKind = ""
$ResolvedFalControlRoot = ""

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
  trap { $Failure = $_; if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }; throw $Failure.Exception }
  $State = Load-ParallelRunState -RunDir $RunDir
  $HadFalSyncCheckpointField = $null -ne $State.PSObject.Properties['fal_sync_checkpoint']
  $HasLaneFalEvidence = @($State.lanes | Where-Object {
    $null -ne $_.fal_checkpoint_identity -or
    -not [string]::IsNullOrWhiteSpace([string]$_.fal_checkpoint_operation_path)
  }).Count -gt 0
  if (-not $HadFalSyncCheckpointField -and $HasLaneFalEvidence) {
    throw "Saved parallel plan run has checkpoint evidence but no durable FalSyncCheckpoint mode; refusing a downgrade resume."
  }
  Ensure-ParallelStateField -Object $State -Name "plan_stage" -Value ([string]$State.plan_stage)
  Ensure-ParallelStateField -Object $State -Name "start_seq_next" -Value ([bool]$State.start_seq_next)
  Ensure-ParallelStateField -Object $State -Name "sent_meta_plan_review" -Value ([bool]$State.sent_meta_plan_review)
  Ensure-ParallelStateField -Object $State -Name "meta_baseline_identity_before_review" -Value ([string]$State.meta_baseline_identity_before_review)
  Ensure-ParallelStateField -Object $State -Name "meta_baseline_message_id_before_review" -Value ([string]$State.meta_baseline_message_id_before_review)
  Ensure-ParallelStateField -Object $State -Name "meta_plan_review_received" -Value ([bool]$State.meta_plan_review_received)
  Ensure-ParallelStateField -Object $State -Name "meta_plan_review_message_id" -Value ([string]$State.meta_plan_review_message_id)
  Ensure-ParallelStateField -Object $State -Name "meta_plan_review_candidate_identity" -Value ([string]$State.meta_plan_review_candidate_identity)
  Ensure-ParallelStateField -Object $State -Name "artifact_pins" -Value ([pscustomobject]@{})
  Ensure-ParallelStateField -Object $State -Name "completed_at" -Value ([string]$State.completed_at)
  Ensure-ParallelStateField -Object $State -Name "meta" -Value $Meta
  Ensure-ParallelStateField -Object $State -Name "meta_model" -Value $MetaModel
  Ensure-ParallelStateField -Object $State -Name "fal_sync_checkpoint" -Value $false
  Ensure-ParallelStateField -Object $State -Name "fal_project_id" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_project_name" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_target_repo_kind" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_target_repo_path" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_target_worktree_path" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_target_head" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_target_ref" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_target_status" -Value ""
  Ensure-ParallelStateField -Object $State -Name "fal_control_root" -Value ""
  if ([bool]$State.fal_sync_checkpoint) {
    foreach ($RequiredField in @(
      "fal_project_id", "fal_project_name", "fal_target_repo_kind", "fal_target_repo_path",
      "fal_target_worktree_path", "fal_target_head", "fal_target_ref", "fal_target_status", "fal_control_root"
    )) {
      if ([string]::IsNullOrWhiteSpace([string]$State.$RequiredField)) {
        throw "Saved FAL-enabled parallel plan run lacks durable '$RequiredField' and cannot be resumed safely."
      }
    }
  }
  foreach ($LaneState in @($State.lanes)) {
    Ensure-ParallelLaneStateDefaults -LaneState $LaneState
    if ($null -eq $LaneState.PSObject.Properties['epic_id'] -or [string]::IsNullOrWhiteSpace([string]$LaneState.epic_id)) {
      throw "Saved run uses the legacy ambiguous track|target lane ABI and cannot be resumed. Start a new run with track|project-target|epic."
    }
    if ([string]$LaneState.lane_class -ceq 'TRACK' -and [string]$LaneState.accountable_lane -ceq [string]$LaneState.role_label -and [string]$LaneState.lane_profile -ceq [string]$LaneState.track_key) {
      $LaneSpecs += "{0}|{1}|{2}" -f $LaneState.track_key, $LaneState.target, $LaneState.epic_id
    } else {
      $LaneSpecs += "{0}|{1}|{2}|{3}|{4}|{5}" -f $LaneState.track_key, $LaneState.target, $LaneState.epic_id, $LaneState.accountable_lane, $LaneState.lane_class, $LaneState.lane_profile
    }
  }

  if ($Lane.Count -gt 0) {
    $Requested = @($Lane | Sort-Object)
    $Saved = @($LaneSpecs | Sort-Object)
    if (($Requested -join "`n") -ne ($Saved -join "`n")) {
      throw "Provided -Lane values do not match the saved run state."
    }
  }

  if (-not $PSBoundParameters.ContainsKey("StartSeqNext")) {
    $StartSeqNext = [bool]$State.start_seq_next
  }
  elseif ($StartSeqNext -ne [bool]$State.start_seq_next) {
    throw "Resume StartSeqNext '$StartSeqNext' does not match saved run StartSeqNext '$($State.start_seq_next)'."
  }

  if ([string]$State.plan_stage -ne "plan_ready_for_meta_review") {
    throw "Saved parallel run uses retired plan stage '$($State.plan_stage)'. This wrapper supports only the initial EPIC_PLAN review; fix plans use the review-fix wrapper for Meta /terv-review, Delivery /terv-review-utan, then /implement from the ready revision."
  }
  if (-not $PSBoundParameters.ContainsKey("Meta")) {
    $Meta = [string]$State.meta
  }
  elseif ($Meta -ne [string]$State.meta) {
    throw "Resume Meta '$Meta' does not match saved run Meta '$($State.meta)'."
  }
  if (-not $PSBoundParameters.ContainsKey("MetaModel")) {
    $MetaModel = [string]$State.meta_model
  }
  elseif ($MetaModel -ne [string]$State.meta_model) {
    throw "Resume MetaModel '$MetaModel' does not match saved run MetaModel '$($State.meta_model)'."
  }

  if (-not $PSBoundParameters.ContainsKey("FalSyncCheckpoint")) {
    $FalSyncCheckpoint = [bool]$State.fal_sync_checkpoint
  }
  elseif ([bool]$FalSyncCheckpoint -ne [bool]$State.fal_sync_checkpoint) {
    throw "Resume FalSyncCheckpoint does not match the saved run value '$($State.fal_sync_checkpoint)'."
  }
  foreach ($Binding in @(
    @{ Parameter = "FalProjectId"; Field = "fal_project_id" },
    @{ Parameter = "FalProjectName"; Field = "fal_project_name" },
    @{ Parameter = "FalTargetRepoKind"; Field = "fal_target_repo_kind" },
    @{ Parameter = "FalTargetRepoPath"; Field = "fal_target_repo_path" },
    @{ Parameter = "FalTargetWorktreePath"; Field = "fal_target_worktree_path" },
    @{ Parameter = "FalTargetHead"; Field = "fal_target_head" },
    @{ Parameter = "FalTargetRef"; Field = "fal_target_ref" },
    @{ Parameter = "FalTargetStatus"; Field = "fal_target_status" },
    @{ Parameter = "FalControlRoot"; Field = "fal_control_root" }
  )) {
    if (-not $PSBoundParameters.ContainsKey([string]$Binding.Parameter)) {
      Set-Variable -Name ([string]$Binding.Parameter) -Value ([string]$State.([string]$Binding.Field))
    }
  }
}
else {
  if ($Lane.Count -lt 2) {
    throw "Parallel plan review needs at least two -Lane '<track-key>|<project-or-repo-target>|<epic>' values."
  }

  $LaneSpecs = @($Lane)
  if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = "parallel-plan-review-{0}" -f (Get-OCRouterSafeTimestamp)
  }

  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  trap { $Failure = $_; if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }; throw $Failure.Exception }
  if (Test-Path (Join-Path $RunDir "state.json")) {
    throw "Parallel run directory already exists. Use a different -RunId: $RunDir"
  }

  New-Item -ItemType Directory -Force $RunDir | Out-Null
}

if ($FalSyncCheckpoint) {
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
  if ($ResolvedFalTargetRepoKind -notin @('git', 'non_git', 'declared_equivalent')) {
    throw "FalTargetRepoKind must resolve to git, non_git, or declared_equivalent."
  }

  if ($ResolvedFalTargetRepoKind -ceq 'git') {
    $ActualHead = (Invoke-OCRouterFalCheckpointGitText -WorkingDirectory $ResolvedFalTargetWorktreePath -GitArguments @('rev-parse', 'HEAD') -Description 'HEAD').ToLowerInvariant()
    $RefOutput = @(& git -C $ResolvedFalTargetWorktreePath symbolic-ref --quiet --short HEAD 2>$null)
    $RefExit = $LASTEXITCODE
    $ActualRef = if ($RefExit -eq 0) { (($RefOutput | ForEach-Object { [string]$_ }) -join "`n").Trim() } elseif ($RefExit -eq 1) { 'DETACHED' } else { throw "Cannot resolve FAL checkpoint Git ref for '$ResolvedFalTargetWorktreePath' (exit $RefExit)." }
    $StatusOutput = @(& git -C $ResolvedFalTargetWorktreePath status --porcelain=v1 --untracked-files=normal 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Cannot resolve FAL checkpoint Git worktree status for '$ResolvedFalTargetWorktreePath'." }
    $ActualStatus = if ($StatusOutput.Count -eq 0) { 'clean' } else { 'dirty' }
    if (-not [string]::IsNullOrWhiteSpace($FalTargetHead) -and $FalTargetHead.ToLowerInvariant() -cne $ActualHead) { throw "Resume FAL checkpoint binding 'fal_target_head' does not match the current target worktree." }
    if (-not [string]::IsNullOrWhiteSpace($FalTargetRef) -and $FalTargetRef -cne $ActualRef) { throw "Resume FAL checkpoint binding 'fal_target_ref' does not match the current target worktree." }
    if (-not [string]::IsNullOrWhiteSpace($FalTargetStatus) -and $FalTargetStatus.ToLowerInvariant() -cne $ActualStatus) { throw "Resume FAL checkpoint binding 'fal_target_status' does not match the current target worktree." }
    $FalTargetHead = $ActualHead
    $FalTargetRef = $ActualRef
    $FalTargetStatus = $ActualStatus
  }
  else {
    if ([string]::IsNullOrWhiteSpace($FalTargetHead)) { $FalTargetHead = 'NOT_APPLICABLE' }
    if ([string]::IsNullOrWhiteSpace($FalTargetRef)) { $FalTargetRef = 'NOT_APPLICABLE' }
    if ([string]::IsNullOrWhiteSpace($FalTargetStatus)) { $FalTargetStatus = if ($ResolvedFalTargetRepoKind -ceq 'declared_equivalent') { 'declared' } else { 'unversioned' } }
  }
  if ([string]::IsNullOrWhiteSpace($FalProjectId)) { $FalProjectId = (Split-Path $ResolvedFalTargetRepoPath -Leaf).ToLowerInvariant() }
  if ([string]::IsNullOrWhiteSpace($FalProjectName)) { $FalProjectName = Split-Path $ResolvedFalTargetRepoPath -Leaf }

  if ($Resume) {
    foreach ($Pair in @(
      @('fal_project_id', $FalProjectId), @('fal_project_name', $FalProjectName),
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
elseif ($Resume) {
  foreach ($Binding in @(
    @{ Parameter = "FalProjectId"; Field = "fal_project_id" }, @{ Parameter = "FalProjectName"; Field = "fal_project_name" },
    @{ Parameter = "FalTargetRepoKind"; Field = "fal_target_repo_kind" }, @{ Parameter = "FalTargetRepoPath"; Field = "fal_target_repo_path" },
    @{ Parameter = "FalTargetWorktreePath"; Field = "fal_target_worktree_path" }, @{ Parameter = "FalTargetHead"; Field = "fal_target_head" },
    @{ Parameter = "FalTargetRef"; Field = "fal_target_ref" }, @{ Parameter = "FalTargetStatus"; Field = "fal_target_status" },
    @{ Parameter = "FalControlRoot"; Field = "fal_control_root" }
  )) {
    if ($PSBoundParameters.ContainsKey([string]$Binding.Parameter) -and [string](Get-Variable -Name ([string]$Binding.Parameter) -ValueOnly) -cne [string]$State.([string]$Binding.Field)) {
      throw "Resume FAL checkpoint binding '$([string]$Binding.Field)' does not match the saved run value."
    }
  }
}

$Lanes = @(ConvertTo-OCRouterLaneCollection -LaneSpecs $LaneSpecs -Config $Config)
if ($Lanes.Count -lt 2) {
  throw "Parallel plan review needs at least two lanes."
}

if (-not $Resume) {
  $State = [ordered]@{
    run_id = $RunId
    created_at = (Get-Date).ToString("o")
    mode = "parallel-plan-review"
    meta = $Meta
    plan_stage = $PlanStage
    start_seq_next = [bool]$StartSeqNext
    meta_model = $MetaModel
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
    sent_meta_plan_review = $false
    meta_baseline_identity_before_review = ""
    meta_baseline_message_id_before_review = ""
    meta_plan_review_received = $false
    meta_plan_review_message_id = ""
    meta_plan_review_candidate_identity = ""
    artifact_pins = [pscustomobject]@{}
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
        seq_next_baseline_identity = ""
        seq_next_baseline_message_id = ""
        sent_seq_next = $false
        plan_received = $false
        plan_message_id = ""
        plan_candidate_identity = ""
        plan_artifact = ""
        sent_terv_review_utan = $false
        plan_revision_baseline_identity = ""
        plan_revision_baseline_message_id = ""
        plan_revision_received = $false
        plan_revision_message_id = ""
        plan_revision_candidate_identity = ""
        plan_revision_dispatch_intent_path = ""
        delivery_receipt_path = ""
        delivery_receipt_sha256 = ""
        fal_checkpoint_operation_path = ""
        fal_checkpoint_operation_sha256 = ""
        fal_checkpoint_identity = $null
        fal_checkpoint_identity_sha256 = ""
      }
    })
  }
  Save-ParallelRunState -RunDir $RunDir -State $State
}
$script:State = $State
foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneItem.track_key
  $LaneItem | Add-Member -NotePropertyName plan_artifact -NotePropertyValue ([string]$LaneState.plan_artifact) -Force
  $LaneItem | Add-Member -NotePropertyName plan_class -NotePropertyValue 'EPIC_PLAN' -Force
}

$MetaEntry = Get-OCRouterSessionEntry -Config $Config -Name $Meta
$Server = $Config.server.TrimEnd("/")
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password

Write-Host "=== OC Session Router Parallel Plan Review Flow ===" -ForegroundColor Cyan
Write-Host "Run ID:        $RunId"
Write-Host "Run dir:       $RunDir"
Write-Host "Mode:          $(if ($Resume) { 'resume' } else { 'new' })"
Write-Host "Meta:          $Meta -> $($MetaEntry.title)"
Write-Host "Meta model:    $MetaModel"
Write-Host "Plan stage:    $PlanStage"
Write-Host "StartSeqNext:  $StartSeqNext"
Write-Host "AutoApprove:   $AutoApprove"
Write-Host "PreviewOnly:   $PreviewOnly"
Write-Host "Lane count:    $($Lanes.Count)"
foreach ($LaneItem in $Lanes) {
  Write-Host "- $($LaneItem.track_key) -> target=$($LaneItem.target); epic=$($LaneItem.epic_id)"
}
Write-Host ""

$LaneTexts = @{}
$LaneReadUris = @{}
$ExpectedLanePlanOutputKind = "track_plan"
foreach ($LaneItem in $Lanes) {
  $LaneReadUris[$LaneItem.track_key] = "$Server/session/$($LaneItem.session_entry.sessionId)/message?limit=$Limit"
}

$PendingPlanWaits = New-Object System.Collections.Generic.List[object]
$PreviewOnlySeqNext = $false

foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneItem.track_key

  if ([bool]$LaneState.plan_received) {
    $ArtifactName = "01-{0}-plan.md" -f $LaneItem.safe_name
    $LaneTexts[$LaneItem.track_key] = Get-ParallelRunText -RunDir $RunDir -Name $ArtifactName
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.plan_artifact)) { throw "Saved plan lane '$($LaneItem.track_key)' lacks its Plan artifact binding." }
    $LaneItem.plan_artifact = [string]$LaneState.plan_artifact
    Write-Host "Resume: using saved plan output for $($LaneItem.role_label)." -ForegroundColor Cyan
    continue
  }

  if (-not $StartSeqNext) {
    $Candidate = Get-OCRouterLatestCandidate -Uri $LaneReadUris[$LaneItem.track_key] -Headers $Headers -CandidateCount $CandidateCount -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts $IncludeReasoningParts -ExpectedOutputKind $ExpectedLanePlanOutputKind -ExpectedOutputContext ([pscustomobject]@{ target = $LaneItem.target; epic = $LaneItem.epic_id; accountable_lane = $LaneItem.accountable_lane; lane_class = $LaneItem.lane_class; lane_profile = $LaneItem.lane_profile })
    if ($null -eq $Candidate) {
      throw "No latest output of expected kind '$ExpectedLanePlanOutputKind' found for lane '$($LaneItem.track_key)'."
    }

    Write-Host ""
    Write-OCRouterSelectedCandidateSummary -Candidate $Candidate
    Write-Host "$($LaneItem.role_label) latest plan output preview:" -ForegroundColor Yellow
    Write-OCRouterTextPreview -Text $Candidate.Text

    $LaneTexts[$LaneItem.track_key] = $Candidate.Text
    $PlanIdentity = Get-OCRouterCandidateIdentity -Candidate $Candidate
    $PlanArtifact = Get-OCRouterTopLevelFieldValue -Text $Candidate.Text -Field 'Plan artifact'
    Save-ParallelRunText -RunDir $RunDir -Name ("01-{0}-plan.md" -f $LaneItem.safe_name) -Text $Candidate.Text -ProducerMessageId ([string]$Candidate.MessageId) -Stage 'track_plan' -CandidateIdentity $PlanIdentity -ExpectedOutputKind 'track_plan' | Out-Null
    $LaneState.plan_message_id = [string]$Candidate.MessageId
    $LaneState.plan_candidate_identity = $PlanIdentity
    $LaneState.plan_artifact = $PlanArtifact
    $LaneItem.plan_artifact = $PlanArtifact
    $LaneState.plan_received = $true
    Save-ParallelRunState -RunDir $RunDir -State $State
  }
}

if ($StartSeqNext) {
  foreach ($LaneItem in $Lanes) {
    $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneItem.track_key
    if ([bool]$LaneState.plan_received) {
      continue
    }

    if (-not [bool]$LaneState.sent_seq_next) {
      if ($PreviewOnly) {
        $LaneState.seq_next_baseline_identity = "<preview-only>"
      }
      else {
        $Baseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $LaneReadUris[$LaneItem.track_key] -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
        $LaneState.seq_next_baseline_message_id = [string]$Baseline.MessageId
        $LaneState.seq_next_baseline_identity = "id:$($Baseline.MessageId)"
      }
      Save-ParallelRunState -RunDir $RunDir -State $State

      $SeqNextArguments = "Target: $($LaneItem.target)`nEpic: $($LaneItem.epic_id)`nAccountable Lane / class / profile: $($LaneItem.accountable_lane) / $($LaneItem.lane_class) / $($LaneItem.lane_profile)"
      $Sent = Invoke-ParallelCommand -LogicalName $LaneItem.track_key -Entry $LaneItem.session_entry -Server $Server -Headers $Headers -Command "seq-next" -Arguments $SeqNextArguments -PreviewTitle "Start /seq-next in $($LaneItem.role_label)" -RunDir $RunDir -Transition ("seq-next-{0}" -f $LaneItem.safe_name) -BaselineIdentity ([string]$LaneState.seq_next_baseline_identity) -CandidateIdentity ("target:{0}|epic:{1}" -f $LaneItem.target, $LaneItem.epic_id) -Stage 'seq_next_plan' -AutoApprove:$AutoApprove -PreviewOnly:$PreviewOnly
      if (-not $Sent) {
        $PreviewOnlySeqNext = $true
      }

      $LaneState.sent_seq_next = $true
      Save-ParallelRunState -RunDir $RunDir -State $State
    }
    else {
      Write-Host "Resume: skipping already-sent /seq-next for $($LaneItem.role_label)." -ForegroundColor Cyan
    }

    $PendingPlanWaits.Add([pscustomobject]@{
      track_key = $LaneItem.track_key
      role_label = $LaneItem.role_label
      safe_name = $LaneItem.safe_name
      label = "$($LaneItem.role_label) seq-next output"
      uri = $LaneReadUris[$LaneItem.track_key]
      baseline_identity = [string]$LaneState.seq_next_baseline_identity
      baseline_message_id = [string]$LaneState.seq_next_baseline_message_id
      expected_output_context = [pscustomobject]@{ target = $LaneItem.target; epic = $LaneItem.epic_id; accountable_lane = $LaneItem.accountable_lane; lane_class = $LaneItem.lane_class; lane_profile = $LaneItem.lane_profile }
    }) | Out-Null
  }

  if ($PreviewOnlySeqNext) {
    Write-Host "Preview-only seq-next lane send completed. No API wait or Meta review performed." -ForegroundColor Yellow
    exit 0
  }

  if ($PendingPlanWaits.Count -gt 0) {
    $OnPlanCompleted = {
      param($LaneWait, $Candidate)

      $LaneTexts[$LaneWait.track_key] = $Candidate.Text
      $PlanIdentity = Get-OCRouterCandidateIdentity -Candidate $Candidate
      $PlanArtifact = Get-OCRouterTopLevelFieldValue -Text $Candidate.Text -Field 'Plan artifact'
      Save-ParallelRunText -RunDir $RunDir -Name ("01-{0}-plan.md" -f $LaneWait.safe_name) -Text $Candidate.Text -ProducerMessageId ([string]$Candidate.MessageId) -Stage 'track_plan' -CandidateIdentity $PlanIdentity -ExpectedOutputKind 'track_plan' | Out-Null
      $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneWait.track_key
      $LaneState.plan_message_id = [string]$Candidate.MessageId
      $LaneState.plan_candidate_identity = $PlanIdentity
      $LaneState.plan_artifact = $PlanArtifact
      $LaneRuntime = @($Lanes | Where-Object { [string]$_.track_key -ceq [string]$LaneWait.track_key })[0]
      $LaneRuntime.plan_artifact = $PlanArtifact
      $LaneState.plan_received = $true
      Save-ParallelRunState -RunDir $RunDir -State $State
    }

    Wait-OCRouterParallelOutputs -LaneContexts @($PendingPlanWaits.ToArray()) -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind $ExpectedLanePlanOutputKind -AutoUseFirstStable:$AutoUseFirstStable -OnLaneCompleted $OnPlanCompleted | Out-Null
  }
}

$CombinedRequest = New-OCRouterParallelPlanReviewRequest -Lanes $Lanes -LaneTexts $LaneTexts
$CombinedIdentity = "sha256:{0}" -f (Get-OCRouterStringSha256 -Text $CombinedRequest)
Save-ParallelRunText -RunDir $RunDir -Name "02-meta-combined-plan-review-request.md" -Text $CombinedRequest -ProducerMessageId ("router:{0}" -f $RunId) -Stage 'meta_plan_review_request' -CandidateIdentity $CombinedIdentity | Out-Null

$MetaReadUri = "$Server/session/$($MetaEntry.sessionId)/message?limit=$Limit"
if (-not [bool]$State.sent_meta_plan_review) {
  $MetaBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $State.meta_baseline_message_id_before_review = [string]$MetaBaseline.MessageId
  $State.meta_baseline_identity_before_review = "id:$($MetaBaseline.MessageId)"
  Save-ParallelRunState -RunDir $RunDir -State $State

  $Sent = Invoke-ParallelCommand -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Command "terv-review" -Arguments $CombinedRequest -PreviewTitle "Combined Meta /terv-review for $($Lanes.Count) lanes" -Model $MetaModel -RunDir $RunDir -Transition 'meta-terv-review' -BaselineIdentity ([string]$State.meta_baseline_identity_before_review) -CandidateIdentity ("sha256:{0}" -f (Get-OCRouterStringSha256 -Text $CombinedRequest)) -Stage 'meta_plan_review' -AutoApprove:$AutoApprove -PreviewOnly:$PreviewOnly
  if (-not $Sent) {
    Write-Host "Preview-only combined Meta /terv-review completed. No wait or Track fanout performed." -ForegroundColor Yellow
    exit 0
  }

  $State.sent_meta_plan_review = $true
  Save-ParallelRunState -RunDir $RunDir -State $State
}
else {
  Write-Host "Resume: skipping already-sent combined Meta /terv-review." -ForegroundColor Cyan
}

$MetaReviewText = ""
if ([bool]$State.meta_plan_review_received) {
  $MetaReviewText = Get-ParallelRunText -RunDir $RunDir -Name "03-meta-combined-plan-review.md"
  if (-not (Test-OCRouterParallelTrackResponseEnvelope -Text $MetaReviewText -Lanes $Lanes -ExpectedCommand 'terv-review-utan' -ExpectedBodyKind 'meta_plan_review')) {
    throw "Saved combined Meta plan review no longer matches the exact lane envelope contract."
  }
  Write-Host "Resume: using saved combined Meta plan review output." -ForegroundColor Cyan
}
else {
  $MetaCandidate = Wait-OCRouterNewOutput -Label "Meta combined plan review output" -Uri $MetaReadUri -Headers $Headers -BaselineIdentity ([string]$State.meta_baseline_identity_before_review) -BaselineMessageId ([string]$State.meta_baseline_message_id_before_review) -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'parallel_meta_plan_review' -ExpectedOutputContext ([pscustomobject]@{ lanes = $Lanes }) -AutoUseFirstStable:$AutoUseFirstStable
  $MetaReviewText = $MetaCandidate.Text
  $MetaIdentity = Get-OCRouterCandidateIdentity -Candidate $MetaCandidate
  Save-ParallelRunText -RunDir $RunDir -Name "03-meta-combined-plan-review.md" -Text $MetaReviewText -ProducerMessageId ([string]$MetaCandidate.MessageId) -Stage 'meta_plan_review' -CandidateIdentity $MetaIdentity | Out-Null
  $State.meta_plan_review_message_id = [string]$MetaCandidate.MessageId
  $State.meta_plan_review_candidate_identity = $MetaIdentity
  $State.meta_plan_review_received = $true
  Save-ParallelRunState -RunDir $RunDir -State $State
}

foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneItem.track_key
  if ([bool]$LaneState.sent_terv_review_utan) {
    Write-Host "Resume: skipping already-sent /terv-review-utan for $($LaneItem.role_label)." -ForegroundColor Cyan
    continue
  }

  $TrackBlock = Get-OCRouterTrackResponseBlock -Text $MetaReviewText -Track $LaneItem.track_key -ExpectedTarget $LaneItem.target -ExpectedCommand "terv-review-utan"
  Save-ParallelRunText -RunDir $RunDir -Name ("04-{0}-terv-review-utan.md" -f $LaneItem.safe_name) -Text $TrackBlock.body -ProducerMessageId ([string]$State.meta_plan_review_message_id) -Stage 'meta_plan_review_lane' -CandidateIdentity ([string]$State.meta_plan_review_candidate_identity) -ExpectedOutputKind 'meta_plan_review' | Out-Null
  $RevisionArguments = New-OCRouterPlanRevisionArgument -SourcePlanText ([string]$LaneTexts[$LaneItem.track_key]) -MetaReviewText ([string]$TrackBlock.body)
  $RevisionBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $LaneReadUris[$LaneItem.track_key] -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $LaneState.plan_revision_baseline_message_id = [string]$RevisionBaseline.MessageId
  $LaneState.plan_revision_baseline_identity = "id:$($RevisionBaseline.MessageId)"
  Save-ParallelRunState -RunDir $RunDir -State $State
  $RevisionDispatch = Invoke-ParallelCommand -LogicalName $LaneItem.track_key -Entry $LaneItem.session_entry -Server $Server -Headers $Headers -Command "terv-review-utan" -Arguments $RevisionArguments -PreviewTitle "Pinned plan + Meta review -> $($LaneItem.role_label) /terv-review-utan" -RunDir $RunDir -Transition ("terv-review-utan-{0}" -f $LaneItem.safe_name) -BaselineIdentity ([string]$LaneState.plan_revision_baseline_identity) -CandidateIdentity ("sha256:{0}" -f (Get-OCRouterStringSha256 -Text $RevisionArguments)) -Stage 'plan_revision' -AutoApprove:$AutoApprove
  $LaneState.plan_revision_dispatch_intent_path = [string]$RevisionDispatch.path
  $LaneState.sent_terv_review_utan = $true
  Save-ParallelRunState -RunDir $RunDir -State $State
}

$PendingRevisionWaits = New-Object System.Collections.Generic.List[object]
foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneItem.track_key
  if ([bool]$LaneState.plan_revision_received) {
    Get-ParallelRunText -RunDir $RunDir -Name ("05-{0}-plan-revision.md" -f $LaneItem.safe_name) | Out-Null
    continue
  }

  $PendingRevisionWaits.Add([pscustomobject]@{
    track_key = $LaneItem.track_key
    role_label = $LaneItem.role_label
    safe_name = $LaneItem.safe_name
    label = "$($LaneItem.role_label) revised plan after /terv-review-utan"
    uri = $LaneReadUris[$LaneItem.track_key]
    baseline_identity = [string]$LaneState.plan_revision_baseline_identity
    baseline_message_id = [string]$LaneState.plan_revision_baseline_message_id
    expected_output_context = [pscustomobject]@{ target = $LaneItem.target; epic = $LaneItem.epic_id; accountable_lane = $LaneItem.accountable_lane; lane_class = $LaneItem.lane_class; lane_profile = $LaneItem.lane_profile; plan_class = 'EPIC_PLAN' }
  }) | Out-Null
}

if ($PendingRevisionWaits.Count -gt 0) {
  $OnRevisionCompleted = {
    param($LaneWait, $Candidate)

    $RevisionIdentity = Get-OCRouterCandidateIdentity -Candidate $Candidate
    Save-ParallelRunText -RunDir $RunDir -Name ("05-{0}-plan-revision.md" -f $LaneWait.safe_name) -Text $Candidate.Text -ProducerMessageId ([string]$Candidate.MessageId) -Stage 'track_plan_revision' -CandidateIdentity $RevisionIdentity -ExpectedOutputKind 'track_plan_revision' | Out-Null
    $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneWait.track_key
    $LaneState.plan_revision_message_id = [string]$Candidate.MessageId
    $LaneState.plan_revision_candidate_identity = $RevisionIdentity
    $LaneState.plan_revision_received = $true
    Save-ParallelRunState -RunDir $RunDir -State $State
  }

  Wait-OCRouterParallelOutputs -LaneContexts @($PendingRevisionWaits.ToArray()) -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -CandidateCount $CandidateCount -PollSeconds $PollSeconds -TimeoutMinutes $TimeoutMinutes -StablePolls $StablePolls -MinOutputChars $MinOutputChars -ExpectedOutputKind 'track_plan_revision' -AutoUseFirstStable:$AutoUseFirstStable -OnLaneCompleted $OnRevisionCompleted | Out-Null
}

foreach ($LaneItem in $Lanes) {
  $RevisionPath = Join-Path $RunDir ("05-{0}-plan-revision.md" -f $LaneItem.safe_name)
  $RevisionText = Get-ParallelRunText -RunDir $RunDir -Name ("05-{0}-plan-revision.md" -f $LaneItem.safe_name)
  if ($RevisionText -match '(?im)^\s*IMPLEMENT_BLOCKED\s*$') {
    throw "Lane '$($LaneItem.track_key)' reported IMPLEMENT_BLOCKED after /terv-review-utan. Do not run /implement for the parallel set."
  }
}

foreach ($LaneItem in $Lanes) {
  $LaneState = Get-ParallelLaneState -State $State -TrackKey $LaneItem.track_key
  $RevisionPath = Join-Path $RunDir ("05-{0}-plan-revision.md" -f $LaneItem.safe_name)
  $RevisionPin = $State.artifact_pins.("05-{0}-plan-revision.md" -f $LaneItem.safe_name)
  Assert-OCRouterArtifactPin -Pin $RevisionPin | Out-Null
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.plan_revision_dispatch_intent_path)) {
    throw "Lane '$($LaneItem.track_key)' lacks the durable /terv-review-utan dispatch-intent binding."
  }
  $CheckpointIdentity = $null
  if ($FalSyncCheckpoint) {
    $RevisionText = Get-ParallelRunText -RunDir $RunDir -Name ("05-{0}-plan-revision.md" -f $LaneItem.safe_name)
    $Wave = Get-OCRouterTopLevelFieldValue -Text $RevisionText -Field 'Wave'
    if ([string]::IsNullOrWhiteSpace($Wave)) { throw "Final plan revision for '$($LaneItem.track_key)' lacks the Wave binding required by FAL checkpoint identity." }
    if ($null -eq $LaneState.fal_checkpoint_identity) {
      $IdentityArgs = @{
        TargetProjectId = $FalProjectId
        TargetRepoKind = $ResolvedFalTargetRepoKind
        TargetRepoRoot = $ResolvedFalTargetRepoPath
        TargetWorktree = $ResolvedFalTargetWorktreePath
        TargetHead = $FalTargetHead
        TargetRef = $FalTargetRef
        TargetStatus = $FalTargetStatus
        Wave = $Wave
        Epic = $LaneItem.epic_id
        Stage = 'plan_revision_delivery_response'
        Candidate = [string]$RevisionPin.candidate_identity
        AccountableLaneId = $LaneItem.accountable_lane
        AccountableLaneClass = $LaneItem.lane_class
        AccountableLaneProfile = $LaneItem.lane_profile
        LogicalSender = $LaneItem.track_key
        LogicalRecipient = $LaneItem.track_key
        SourceSession = $LaneItem.track_key
        ArtifactIdentity = [string]$RevisionPin.candidate_identity
        ArtifactPath = $RevisionPath
        ArtifactHash = [string]$RevisionPin.sha256
        ArtifactProducer = [string]$RevisionPin.producer_message_id
        ControlRoot = $ResolvedFalControlRoot
        SyncMode = 'dry_run'
      }
      $CheckpointIdentity = New-OCRouterFalCheckpointIdentity @IdentityArgs
      $LaneState.fal_checkpoint_identity = $CheckpointIdentity
      $LaneState.fal_checkpoint_identity_sha256 = Get-OCRouterFalCheckpointIdentityHash -Identity $CheckpointIdentity
      Save-ParallelRunState -RunDir $RunDir -State $State
    }
    else {
      $CheckpointIdentity = $LaneState.fal_checkpoint_identity
      Assert-OCRouterFalCheckpointIdentity -Identity $CheckpointIdentity | Out-Null
      $ObservedIdentityHash = Get-OCRouterFalCheckpointIdentityHash -Identity $CheckpointIdentity
      if ([string]$LaneState.fal_checkpoint_identity_sha256 -cne $ObservedIdentityHash) {
        throw "Pinned FAL checkpoint identity drift for lane '$($LaneItem.track_key)'."
      }
    }
  }
  if ([string]::IsNullOrWhiteSpace([string]$LaneState.delivery_receipt_path)) {
    $LaneState.delivery_receipt_path = Write-OCRouterArtifactDeliveryReceipt `
      -RunDir $RunDir `
      -Name ("plan-revision-{0}" -f $LaneItem.safe_name) `
      -ArtifactPath $RevisionPath `
      -ProducerSession $LaneItem.track_key `
      -Command 'terv-review-utan' `
      -Target $LaneItem.target `
      -Recipient $LaneItem.track_key `
      -DeliveryProven $true `
      -ResponseClass 'IMPLEMENT_READY' `
      -ResponseArtifactPath $RevisionPath `
      -ResponseMessageId ([string]$RevisionPin.producer_message_id) `
      -DispatchIntentPath ([string]$LaneState.plan_revision_dispatch_intent_path) `
      -FalCheckpointIdentity $CheckpointIdentity
    $LaneState.delivery_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneState.delivery_receipt_path)).Hash
    Save-ParallelRunState -RunDir $RunDir -State $State
    Invoke-ParallelPlanFalDurabilityTestHook -Stage 'receipt' -LaneKey ([string]$LaneItem.track_key)
  }
  else {
    Assert-OCRouterArtifactDeliveryReceipt -ReceiptPath ([string]$LaneState.delivery_receipt_path) -ArtifactPath $RevisionPath -ProducerSession $LaneItem.track_key -Command 'terv-review-utan' -Target $LaneItem.target -Recipient $LaneItem.track_key -ResponseClass 'IMPLEMENT_READY' -ResponseArtifactPath $RevisionPath -ResponseMessageId ([string]$RevisionPin.producer_message_id) -DispatchIntentPath ([string]$LaneState.plan_revision_dispatch_intent_path) -FalCheckpointIdentity $CheckpointIdentity | Out-Null
    $ObservedReceiptHash = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneState.delivery_receipt_path)).Hash
    if ([string]::IsNullOrWhiteSpace([string]$LaneState.delivery_receipt_sha256)) {
      if ($FalSyncCheckpoint) { throw "Lane '$($LaneItem.track_key)' has a FAL-bound receipt without a durable receipt hash." }
      $LaneState.delivery_receipt_sha256 = $ObservedReceiptHash
      Save-ParallelRunState -RunDir $RunDir -State $State
    }
    elseif ([string]$LaneState.delivery_receipt_sha256 -cne $ObservedReceiptHash) {
      throw "Pinned delivery receipt hash drift for lane '$($LaneItem.track_key)'."
    }
  }

  if ($FalSyncCheckpoint -and [string]::IsNullOrWhiteSpace([string]$LaneState.fal_checkpoint_operation_path)) {
    $Proposal = Write-OCRouterFalCheckpointTargetProposal -RunDir $RunDir -Name ("parallel-plan-revision-{0}" -f $LaneItem.safe_name) -ProjectName $FalProjectName -Target $LaneItem.target -CheckpointIdentity $CheckpointIdentity -ReceiptPath ([string]$LaneState.delivery_receipt_path) -DeliveryResponseClass 'IMPLEMENT_READY'
    $LaneState.fal_checkpoint_operation_path = [string]$Proposal.path
    $LaneState.fal_checkpoint_operation_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$Proposal.path)).Hash
    Save-ParallelRunState -RunDir $RunDir -State $State
    Invoke-ParallelPlanFalDurabilityTestHook -Stage 'proposal' -LaneKey ([string]$LaneItem.track_key)
  }
  elseif ($FalSyncCheckpoint) {
    Assert-OCRouterFalCheckpointTargetProposal -ProposalPath ([string]$LaneState.fal_checkpoint_operation_path) -CheckpointIdentity $CheckpointIdentity -ProjectName $FalProjectName -Target $LaneItem.target -ReceiptPath ([string]$LaneState.delivery_receipt_path) -DeliveryResponseClass 'IMPLEMENT_READY' | Out-Null
    if ([string]$LaneState.fal_checkpoint_operation_sha256 -cne (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneState.fal_checkpoint_operation_path)).Hash) {
      throw "Pinned FAL checkpoint proposal hash drift for lane '$($LaneItem.track_key)'."
    }
  }
}

$State.completed_at = (Get-Date).ToString("o")
Save-ParallelRunState -RunDir $RunDir -State $State

Write-Host "Parallel plan review flow completed or resumed. Runtime artifacts: $RunDir" -ForegroundColor Green
$RunLockHandle.Dispose()
$RunLockHandle = $null

[pscustomobject]@{
  run_id = $RunId
  run_dir = $RunDir
  lane_count = $Lanes.Count
  meta = $Meta
  plan_stage = $PlanStage
  lanes = @($Lanes | ForEach-Object {
    if ($_.lane_class -ceq 'TRACK' -and $_.accountable_lane -ceq $_.role_label -and $_.lane_profile -ceq $_.track_key) {
      "{0}|{1}|{2}" -f $_.track_key, $_.target, $_.epic_id
    } else {
      "{0}|{1}|{2}|{3}|{4}|{5}" -f $_.track_key, $_.target, $_.epic_id, $_.accountable_lane, $_.lane_class, $_.lane_profile
    }
  })
}
