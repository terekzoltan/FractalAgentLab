param(
  [string]$Track = "",
  [string]$Target = "",
  [string]$Epic = "",
  [string]$AccountableLaneId = "",
  [string]$AccountableLaneClass = "",
  [string]$AccountableLaneProfile = "",

  [string]$Meta = "meta",
  [string]$MetaModel = "openai/gpt-5.6-sol",

  [int]$PollSeconds = 15,
  [int]$TimeoutMinutes = 45,
  [int]$Limit = 5,
  [int]$CandidateCount = 3,
  [int]$StablePolls = 2,
  [int]$MinOutputChars = 150,
  [int]$PostTimeoutSeconds = 120,

  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,

  [switch]$AssumeOldestFirst,
  [switch]$IncludeReasoningParts,
  [switch]$AutoUseFirstStable,
  [switch]$AutoApprove,
  [string]$PinnedTrackOutputPath = "",
  [switch]$StartSeqNext,
  [switch]$PreviewOnly,
  [switch]$Resume,
  [string]$RunId = "",

  [switch]$FalSyncCheckpoint,
  [string]$FalProjectId = "",
  [string]$FalProjectName = "",
  [string]$FalTargetRepoKind = "",
  [string]$FalTargetRepoPath = "",
  [string]$FalTargetWorktreePath = "",
  [string]$FalControlRoot = ""
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: use Invoke-OCRouter.ps1 for one explicit stage.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

function Save-PlanFlowState {
  param(
    [string]$RunDir,
    [object]$State
  )

  Write-OCRouterAtomicJsonFile -Path (Join-Path $RunDir "state.json") -Value $State
}

function Load-PlanFlowState {
  param([string]$RunDir)

  $Path = Join-Path $RunDir "state.json"
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing serial plan-review state file: $Path"
  }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Ensure-PlanFlowStateField {
  param(
    [object]$State,
    [string]$Name,
    [object]$Value
  )

  if ($State -is [System.Collections.IDictionary]) {
    if (-not $State.Contains($Name)) { $State[$Name] = $Value }
  }
  elseif ($null -eq $State.PSObject.Properties[$Name]) {
    Add-Member -InputObject $State -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function Test-PlanFlowStepCompleted {
  param(
    [object]$State,
    [string]$Step
  )

  return (@($State.completed_steps) -contains $Step)
}

function Add-PlanFlowCompletedStep {
  param(
    [object]$State,
    [string]$Step
  )

  if (-not (Test-PlanFlowStepCompleted -State $State -Step $Step)) {
    $State.completed_steps = @(@($State.completed_steps) + $Step)
  }
}

function Save-PlanFlowArtifact {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$Text,
    [string]$ProducerMessageId,
    [string]$Stage,
    [string]$CandidateIdentity,
    [string]$ExpectedOutputKind
  )

  if ([string]::IsNullOrWhiteSpace($ProducerMessageId) -or
      [string]::IsNullOrWhiteSpace($Stage) -or
      [string]::IsNullOrWhiteSpace($CandidateIdentity)) {
    throw "Artifact '$Name' requires producer message ID, stage, and candidate identity."
  }
  $Path = Join-Path $RunDir $Name
  Write-OCRouterAtomicTextFile -Path $Path -Text $Text
  $Pin = New-OCRouterArtifactPin `
    -Path $Path `
    -ProducerMessageId $ProducerMessageId `
    -Stage $Stage `
    -CandidateIdentity $CandidateIdentity `
    -ExpectedOutputKind $ExpectedOutputKind
  if ($null -eq $script:PlanFlowState.artifact_pins) {
    $script:PlanFlowState.artifact_pins = [pscustomobject]@{}
  }
  $script:PlanFlowState.artifact_pins | Add-Member -NotePropertyName $Name -NotePropertyValue $Pin -Force
  return $Path
}

function Get-PlanFlowArtifactText {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$ExpectedOutputKind,
    [object]$ExpectedOutputContext
  )

  if ($null -eq $script:PlanFlowState.artifact_pins -or
      $script:PlanFlowState.artifact_pins.PSObject.Properties.Name -notcontains $Name) {
    throw "Saved serial plan-review artifact '$Name' has no durable state pin."
  }
  $Pin = $script:PlanFlowState.artifact_pins.$Name
  Assert-OCRouterArtifactPin -Pin $Pin | Out-Null
  $Text = Get-Content -LiteralPath ([string]$Pin.path) -Raw
  if (-not (Test-OCRouterExpectedOutputKind -Text $Text -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext)) {
    throw "Pinned serial plan-review artifact '$Name' drifted from its exact output/context contract."
  }
  return $Text
}

function Save-PlanFlowReconciliationRecord {
  param(
    [string]$RunDir,
    [string]$Label,
    [string]$BaselineMessageId,
    [object]$Candidate,
    [string]$ExpectedOutputKind,
    [object]$ExpectedOutputContext
  )

  if ($null -eq $Candidate) { return "" }
  $Diagnostic = Get-OCRouterOutputContractDiagnostic -Text ([string]$Candidate.Text) -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext
  $Record = [ordered]@{
    version = 1
    status = 'reconciliation_needed'
    label = $Label
    expected_output_kind = $ExpectedOutputKind
    baseline_message_id = $BaselineMessageId
    observed_message_id = [string]$Candidate.MessageId
    observed_identity = Get-OCRouterCandidateIdentity -Candidate $Candidate
    detected_kind = [string]$Diagnostic.detected_kind
    progress_like = [bool]$Diagnostic.progress_like
    text_length = [int]$Diagnostic.text_length
    mismatch_reasons = @($Diagnostic.reasons)
    observed_at = (Get-Date).ToString('o')
    authority = 'diagnostic_only_no_resend_no_route'
  }
  $RecordPath = Join-Path $RunDir ("reconciliation-{0}.json" -f (Get-OCRouterSafeName -Value $Label))
  Write-OCRouterAtomicJsonFile -Path $RecordPath -Value $Record
  Write-Host "Saved diagnostic-only reconciliation record: $RecordPath" -ForegroundColor Yellow
  Write-OCRouterOutputContractDiagnostic -Candidate $Candidate -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext -Prefix "[$Label]" | Out-Null
  return $RecordPath
}

function Resolve-PlanFlowOutput {
  param(
    [string]$Label,
    [string]$Uri,
    [hashtable]$Headers,
    [string]$BaselineIdentity,
    [string]$BaselineMessageId,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [int]$CandidateCount,
    [int]$PollSeconds,
    [int]$TimeoutMinutes,
    [int]$StablePolls,
    [int]$MinOutputChars,
    [string]$ExpectedOutputKind,
    [object]$ExpectedOutputContext,
    [string]$RunDir,
    [switch]$AutoUseFirstStable
  )

  if ([string]::IsNullOrWhiteSpace($BaselineMessageId)) {
    throw "Waiting for '$Label' requires the persisted raw assistant baseline message ID."
  }
  $Current = Get-OCRouterLatestCandidate `
    -Uri $Uri `
    -Headers $Headers `
    -CandidateCount $CandidateCount `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -ExpectedOutputKind $ExpectedOutputKind `
    -ExpectedOutputContext $ExpectedOutputContext `
    -AfterMessageId $BaselineMessageId `
    -RequestTimeoutSeconds ([Math]::Min(30, $TimeoutMinutes * 60))
  if ($null -ne $Current) {
    Write-Host "Resume/new-output candidate found for ${Label}:" -ForegroundColor Cyan
    Write-OCRouterSelectedCandidateSummary -Candidate $Current
    Write-OCRouterTextPreview -Text $Current.Text
    if ($AutoUseFirstStable) { return $Current }
    $Answer = Read-Host "Use this exact $Label candidate? [y/N]"
    if ($Answer -eq "y" -or $Answer -eq "Y") { return $Current }
    throw "Exact $Label candidate declined. No automatic resend is permitted."
  }

  $DiagnosticCandidate = Get-OCRouterLatestCandidate `
    -Uri $Uri `
    -Headers $Headers `
    -CandidateCount 1 `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -AfterMessageId $BaselineMessageId `
    -RequestTimeoutSeconds ([Math]::Min(30, $TimeoutMinutes * 60))
  if ($null -ne $DiagnosticCandidate) {
    Save-PlanFlowReconciliationRecord -RunDir $RunDir -Label $Label -BaselineMessageId $BaselineMessageId -Candidate $DiagnosticCandidate -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext | Out-Null
  }

  try {
    return Wait-OCRouterNewOutput `
      -Label $Label `
      -Uri $Uri `
      -Headers $Headers `
      -BaselineIdentity $BaselineIdentity `
      -BaselineMessageId $BaselineMessageId `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts:$IncludeReasoningParts `
      -CandidateCount $CandidateCount `
      -PollSeconds $PollSeconds `
      -TimeoutMinutes $TimeoutMinutes `
      -StablePolls $StablePolls `
      -MinOutputChars $MinOutputChars `
      -ExpectedOutputKind $ExpectedOutputKind `
      -ExpectedOutputContext $ExpectedOutputContext `
      -AutoUseFirstStable:$AutoUseFirstStable
  }
  catch {
    $LatestDiagnosticCandidate = Get-OCRouterLatestCandidate -Uri $Uri -Headers $Headers -CandidateCount 1 -AssumeNewestFirst $AssumeNewestFirst -IncludeReasoningParts:$IncludeReasoningParts -AfterMessageId $BaselineMessageId -RequestTimeoutSeconds ([Math]::Min(30, $TimeoutMinutes * 60))
    if ($null -ne $LatestDiagnosticCandidate) {
      Save-PlanFlowReconciliationRecord -RunDir $RunDir -Label $Label -BaselineMessageId $BaselineMessageId -Candidate $LatestDiagnosticCandidate -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext | Out-Null
    }
    throw
  }
}

function Invoke-PlanFlowCommand {
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
    Write-Host "PreviewOnly active. Command not sent and no dispatch intent created." -ForegroundColor Yellow
    return [pscustomobject]@{ sent = $false; path = ""; intent = $null }
  }

  Assert-OCRouterParentSessionCommandSafe -Server $Server -Headers $Headers -CommandName $CommandName
  if (-not $AutoApprove) {
    $Answer = Read-Host "Run /$CommandName on '$LogicalName'? [y/N]"
    if ($Answer -ne "y" -and $Answer -ne "Y") {
      throw "Command send declined: /$CommandName -> $LogicalName"
    }
  }

  $BodyObject = New-OCRouterCommandRequestBodyObject -Command $CommandName -Arguments $Arguments -Model $Model
  $Body = $BodyObject | ConvertTo-Json -Depth 10
  $Intent = Start-OCRouterDispatchIntent `
    -RunDir $RunDir `
    -Transition $Transition `
    -Recipient $LogicalName `
    -Kind command `
    -Operation $CommandName `
    -Payload $Body `
    -BaselineIdentity $BaselineIdentity `
    -CandidateIdentity $CandidateIdentity `
    -Stage $Stage
  if (-not [bool]$Intent.should_send) {
    Write-Host "Dispatch '$Transition' is already delivery-proven; not resending." -ForegroundColor Cyan
    return [pscustomobject]@{ sent = $true; path = [string]$Intent.path; intent = $Intent.intent }
  }

  $Uri = "$Server/session/$($Entry.sessionId)/command"
  try {
    $Response = Invoke-RestMethod `
      -Method Post `
      -Uri $Uri `
      -Headers $Headers `
      -ContentType "application/json" `
      -Body $Body `
      -TimeoutSec $script:PlanFlowPostTimeoutSeconds
  }
  catch {
    Set-OCRouterDispatchIntentUncertain -Path ([string]$Intent.path) -Reason $_.Exception.Message | Out-Null
    throw "Command POST outcome is delivery-uncertain for /$CommandName -> $LogicalName. Reconcile intent '$($Intent.path)' and the recipient transcript from baseline '$BaselineIdentity'; automatic resend is forbidden. $($_.Exception.Message)"
  }
  $Completed = Complete-OCRouterDispatchIntent `
    -Path ([string]$Intent.path) `
    -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) `
    -TransportStatus "accepted"
  Write-Host "Sent command /$CommandName to $LogicalName." -ForegroundColor Green
  return [pscustomobject]@{ sent = $true; path = [string]$Intent.path; intent = $Completed }
}

function Assert-PlanFlowScalar {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value) -or
      $Value -match '[\r\n]' -or
      $Value -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') {
    throw "$Name must be a concrete, single-line value."
  }
}

function Get-PlanFlowReadiness {
  param([string]$Text)

  $Lines = @(($Text -replace "`r`n", "`n" -replace "`r", "`n") -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($Lines.Count -eq 0) { return "" }
  $Last = ([string]$Lines[$Lines.Count - 1]).Trim()
  if ($Last -cmatch '^Readiness:\s*(READY|NOT_READY|BLOCKED)$') { return $Matches[1] }
  if ($Last -cmatch '^(IMPLEMENT_READY|IMPLEMENT_BLOCKED)$') { return $Matches[1] }
  return ""
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
  if ($MessageOrder -eq "oldest_first") { $AssumeOldestFirst = $true }
}

if ($PollSeconds -lt 2) { throw "PollSeconds must be at least 2." }
if ($TimeoutMinutes -lt 1) { throw "TimeoutMinutes must be at least 1." }
if ($Limit -lt 1) { throw "Limit must be at least 1." }
if ($CandidateCount -lt 1) { throw "CandidateCount must be at least 1." }
if ($StablePolls -lt 1) { throw "StablePolls must be at least 1." }
if ($MinOutputChars -lt 1) { throw "MinOutputChars must be at least 1." }
if ($PostTimeoutSeconds -lt 10) { throw "PostTimeoutSeconds must be at least 10." }
if ($Resume -and [string]::IsNullOrWhiteSpace($RunId)) { throw "RunId is required with -Resume." }
if (-not $Resume -and $StartSeqNext -and -not [string]::IsNullOrWhiteSpace($PinnedTrackOutputPath)) {
  throw "PinnedTrackOutputPath cannot be used with StartSeqNext."
}

$Config = Get-OCRouterConfig -RouterDir $RouterDir
$RunRoot = Join-Path $RouterDir "plan-review-runs"
New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null
$RunLockHandle = $null
$State = $null
trap {
  $Failure = $_
  if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose(); $RunLockHandle = $null }
  throw $Failure
}

if ($Resume) {
  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  $State = Load-PlanFlowState -RunDir $RunDir
  if ([int]$State.schema_version -ne 2 -or [string]$State.mode -cne "serial-plan-review") {
    throw "Saved run is not a resumable serial plan-review v2 state. Start a new run with explicit Target, Epic, and lane identity."
  }

  foreach ($Binding in @(
    @{ Parameter = "Track"; Field = "track" },
    @{ Parameter = "Target"; Field = "target" },
    @{ Parameter = "Epic"; Field = "epic" },
    @{ Parameter = "AccountableLaneId"; Field = "accountable_lane_id" },
    @{ Parameter = "AccountableLaneClass"; Field = "accountable_lane_class" },
    @{ Parameter = "AccountableLaneProfile"; Field = "accountable_lane_profile" },
    @{ Parameter = "Meta"; Field = "meta" },
    @{ Parameter = "MetaModel"; Field = "meta_model" }
  )) {
    $Saved = [string]$State.($Binding.Field)
    if (-not $PSBoundParameters.ContainsKey([string]$Binding.Parameter)) {
      Set-Variable -Name ([string]$Binding.Parameter) -Value $Saved
    }
    elseif (([string](Get-Variable -Name ([string]$Binding.Parameter) -ValueOnly)) -cne $Saved) {
      throw "Resume $($Binding.Parameter) does not match saved value '$Saved'."
    }
  }
  foreach ($SwitchBinding in @(
    @{ Parameter = "StartSeqNext"; Field = "start_seq_next" },
    @{ Parameter = "FalSyncCheckpoint"; Field = "fal_sync_checkpoint" }
  )) {
    $Saved = [bool]$State.($SwitchBinding.Field)
    if (-not $PSBoundParameters.ContainsKey([string]$SwitchBinding.Parameter)) {
      Set-Variable -Name ([string]$SwitchBinding.Parameter) -Value $Saved
    }
    elseif ([bool](Get-Variable -Name ([string]$SwitchBinding.Parameter) -ValueOnly) -ne $Saved) {
      throw "Resume $($SwitchBinding.Parameter) does not match saved value '$Saved'."
    }
  }
  foreach ($FalBinding in @(
    @{ Parameter = "FalProjectId"; Field = "fal_project_id" },
    @{ Parameter = "FalProjectName"; Field = "fal_project_name" },
    @{ Parameter = "FalTargetRepoKind"; Field = "fal_target_repo_kind" },
    @{ Parameter = "FalTargetRepoPath"; Field = "fal_target_repo_path" },
    @{ Parameter = "FalTargetWorktreePath"; Field = "fal_target_worktree_path" },
    @{ Parameter = "FalControlRoot"; Field = "fal_control_root" }
  )) {
    $Saved = [string]$State.($FalBinding.Field)
    if (-not $PSBoundParameters.ContainsKey([string]$FalBinding.Parameter)) {
      Set-Variable -Name ([string]$FalBinding.Parameter) -Value $Saved
    }
    elseif (([string](Get-Variable -Name ([string]$FalBinding.Parameter) -ValueOnly)) -cne $Saved) {
      throw "Resume $($FalBinding.Parameter) does not match saved resolved value '$Saved'."
    }
  }
}
else {
  foreach ($Required in @(
    @{ Name = "Track"; Value = $Track },
    @{ Name = "Target"; Value = $Target },
    @{ Name = "Epic"; Value = $Epic },
    @{ Name = "AccountableLaneId"; Value = $AccountableLaneId },
    @{ Name = "AccountableLaneClass"; Value = $AccountableLaneClass },
    @{ Name = "AccountableLaneProfile"; Value = $AccountableLaneProfile }
  )) {
    Assert-PlanFlowScalar -Name ([string]$Required.Name) -Value ([string]$Required.Value)
  }
  $AccountableLaneClass = $AccountableLaneClass.Trim().ToUpperInvariant()
  if ($AccountableLaneClass -notin @("TRACK", "SPECIALIST_DELIVERY", "GOVERNANCE")) {
    throw "AccountableLaneClass must be TRACK, SPECIALIST_DELIVERY, or GOVERNANCE."
  }

  if ($FalSyncCheckpoint) {
    foreach ($Required in @(
      @{ Name = "FalProjectId"; Value = $FalProjectId },
      @{ Name = "FalProjectName"; Value = $FalProjectName },
      @{ Name = "FalTargetRepoPath"; Value = $FalTargetRepoPath }
    )) {
      Assert-PlanFlowScalar -Name ([string]$Required.Name) -Value ([string]$Required.Value)
    }
    $FalTargetRepoPath = (Resolve-Path -LiteralPath $FalTargetRepoPath -ErrorAction Stop).Path
    if ([string]::IsNullOrWhiteSpace($FalTargetWorktreePath)) { $FalTargetWorktreePath = $FalTargetRepoPath }
    else { $FalTargetWorktreePath = (Resolve-Path -LiteralPath $FalTargetWorktreePath -ErrorAction Stop).Path }
    if ([string]::IsNullOrWhiteSpace($FalControlRoot)) {
      $FalControlRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    }
    else { $FalControlRoot = (Resolve-Path -LiteralPath $FalControlRoot -ErrorAction Stop).Path }
    if ([string]::IsNullOrWhiteSpace($FalTargetRepoKind)) {
      $GitProbe = @(& git -C $FalTargetRepoPath rev-parse --is-inside-work-tree 2>$null)
      $FalTargetRepoKind = if ($LASTEXITCODE -eq 0 -and (($GitProbe -join "").Trim() -ceq "true")) { "git" } else { "non_git" }
    }
    $FalTargetRepoKind = $FalTargetRepoKind.Trim().ToLowerInvariant()
    if ($FalTargetRepoKind -notin @("git", "non_git", "declared_equivalent")) {
      throw "FalTargetRepoKind must resolve to git, non_git, or declared_equivalent."
    }
  }

  if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = "plan-review-{0}-{1}-{2}" -f (Get-OCRouterSafeName -Value $Target), (Get-OCRouterSafeName -Value $Epic), (Get-OCRouterSafeTimestamp)
  }
  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  if (Test-Path -LiteralPath (Join-Path $RunDir "state.json") -PathType Leaf) {
    throw "Run directory already exists. Use -Resume -RunId $RunId to continue it."
  }

  $State = [ordered]@{
    schema_version = 2
    mode = "serial-plan-review"
    run_id = $RunId
    created_at = (Get-Date).ToString("o")
    completed_at = ""
    completed_steps = @()
    artifact_pins = [pscustomobject]@{}
    track = $Track
    target = $Target
    epic = $Epic
    accountable_lane_id = $AccountableLaneId
    accountable_lane_class = $AccountableLaneClass
    accountable_lane_profile = $AccountableLaneProfile
    meta = $Meta
    meta_model = $MetaModel
    start_seq_next = [bool]$StartSeqNext
    fal_sync_checkpoint = [bool]$FalSyncCheckpoint
    fal_project_id = $FalProjectId
    fal_project_name = $FalProjectName
    fal_target_repo_kind = $FalTargetRepoKind
    fal_target_repo_path = $FalTargetRepoPath
    fal_target_worktree_path = $FalTargetWorktreePath
    fal_control_root = $FalControlRoot
    track_baseline_message_id_before_seq_next = ""
    track_baseline_identity_before_seq_next = ""
    track_plan_message_id = ""
    track_plan_candidate_identity = ""
    plan_artifact_identity = ""
    meta_baseline_message_id_before_review = ""
    meta_baseline_identity_before_review = ""
    meta_review_message_id = ""
    meta_review_candidate_identity = ""
    track_baseline_message_id_before_revision = ""
    track_baseline_identity_before_revision = ""
    revision_message_id = ""
    revision_candidate_identity = ""
    revision_disposition = ""
    revision_dispatch_intent_path = ""
    delivery_receipt_path = ""
    fal_checkpoint_identity = $null
    fal_checkpoint_identity_sha256 = ""
    fal_checkpoint_operation_path = ""
    fal_checkpoint_operation_sha256 = ""
  }
  Save-PlanFlowState -RunDir $RunDir -State $State
}

foreach ($Field in @(
  @{ Name = "artifact_pins"; Value = [pscustomobject]@{} },
  @{ Name = "completed_steps"; Value = @() },
  @{ Name = "completed_at"; Value = "" },
  @{ Name = "revision_dispatch_intent_path"; Value = "" },
  @{ Name = "delivery_receipt_path"; Value = "" },
  @{ Name = "fal_checkpoint_identity"; Value = $null },
  @{ Name = "fal_checkpoint_identity_sha256"; Value = "" },
  @{ Name = "fal_checkpoint_operation_path"; Value = "" },
  @{ Name = "fal_checkpoint_operation_sha256"; Value = "" }
)) {
  Ensure-PlanFlowStateField -State $State -Name ([string]$Field.Name) -Value $Field.Value
}
$script:PlanFlowState = $State
$script:PlanFlowPostTimeoutSeconds = $PostTimeoutSeconds

foreach ($Required in @(
  @{ Name = "Track"; Value = $Track },
  @{ Name = "Target"; Value = $Target },
  @{ Name = "Epic"; Value = $Epic },
  @{ Name = "AccountableLaneId"; Value = $AccountableLaneId },
  @{ Name = "AccountableLaneClass"; Value = $AccountableLaneClass },
  @{ Name = "AccountableLaneProfile"; Value = $AccountableLaneProfile }
)) {
  Assert-PlanFlowScalar -Name ([string]$Required.Name) -Value ([string]$Required.Value)
}
if ($AccountableLaneClass -notin @("TRACK", "SPECIALIST_DELIVERY", "GOVERNANCE")) {
  throw "Saved AccountableLaneClass is unsupported: $AccountableLaneClass"
}
if ($Target.Trim() -ceq $Epic.Trim()) {
  throw "Target is the project/repository binding and Epic is its delivery identity; they must be supplied separately and cannot be identical."
}

if ([string]::IsNullOrWhiteSpace($Password)) { $Password = Read-Host "OpenCode server password" }
$AssumeNewestFirst = -not $AssumeOldestFirst
$TrackEntry = Get-OCRouterSessionEntry -Config $Config -Name $Track
$MetaEntry = Get-OCRouterSessionEntry -Config $Config -Name $Meta
$Server = $Config.server.TrimEnd("/")
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password
$TrackReadUri = "$Server/session/$($TrackEntry.sessionId)/message?limit=$Limit"
$MetaReadUri = "$Server/session/$($MetaEntry.sessionId)/message?limit=$Limit"
$LaneDisplay = "$AccountableLaneId / $AccountableLaneClass / $AccountableLaneProfile"
$LaneContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  accountable_lane = $AccountableLaneId
  lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile
}

Write-Host "=== OC Session Router Serial Plan Review ===" -ForegroundColor Cyan
Write-Host "Run ID:          $RunId"
Write-Host "Run dir:         $RunDir"
Write-Host "Delivery session:$Track -> $($TrackEntry.title)"
Write-Host "Meta:            $Meta -> $($MetaEntry.title)"
Write-Host "Target:          $Target"
Write-Host "Epic:            $Epic"
Write-Host "Lane/class/profile: $LaneDisplay"
Write-Host "StartSeqNext:    $StartSeqNext"
Write-Host "Resume:          $Resume"
Write-Host "PreviewOnly:     $PreviewOnly"
Write-Host ""

$PlanText = ""
if (Test-PlanFlowStepCompleted -State $State -Step "plan_received") {
  $PlanText = Get-PlanFlowArtifactText -RunDir $RunDir -Name "01-epic-implementation-plan.md" -ExpectedOutputKind "track_plan" -ExpectedOutputContext $LaneContext
}
elseif ($StartSeqNext) {
  if (-not (Test-PlanFlowStepCompleted -State $State -Step "seq_next_sent")) {
    $Baseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $TrackReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $State.track_baseline_message_id_before_seq_next = [string]$Baseline.MessageId
    $State.track_baseline_identity_before_seq_next = "id:$($Baseline.MessageId)"
    Save-PlanFlowState -RunDir $RunDir -State $State
    $SeqNextArguments = @(
      "Target: $Target",
      "Epic: $Epic",
      "Accountable Lane / class / profile: $LaneDisplay"
    ) -join "`n"
    $Dispatch = Invoke-PlanFlowCommand `
      -LogicalName $Track `
      -Entry $TrackEntry `
      -Server $Server `
      -Headers $Headers `
      -Command "seq-next" `
      -Arguments $SeqNextArguments `
      -PreviewTitle "Start exact Epic planning in accountable Delivery session" `
      -RunDir $RunDir `
      -Transition "dispatch-seq-next" `
      -BaselineIdentity ([string]$State.track_baseline_identity_before_seq_next) `
      -CandidateIdentity ("target:{0}|epic:{1}|lane:{2}" -f $Target, $Epic, $LaneDisplay) `
      -Stage "seq_next_plan" `
      -AutoApprove:$AutoApprove `
      -PreviewOnly:$PreviewOnly
    if (-not [bool]$Dispatch.sent) {
      Write-Host "Preview-only /seq-next completed; no output wait or downstream route was performed." -ForegroundColor Yellow
      if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose(); $RunLockHandle = $null }
      return
    }
    Add-PlanFlowCompletedStep -State $State -Step "seq_next_sent"
    Save-PlanFlowState -RunDir $RunDir -State $State
  }

  $PlanCandidate = Resolve-PlanFlowOutput `
    -Label "EPIC IMPLEMENTATION PLAN" `
    -Uri $TrackReadUri `
    -Headers $Headers `
    -BaselineIdentity ([string]$State.track_baseline_identity_before_seq_next) `
    -BaselineMessageId ([string]$State.track_baseline_message_id_before_seq_next) `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -CandidateCount $CandidateCount `
    -PollSeconds $PollSeconds `
    -TimeoutMinutes $TimeoutMinutes `
    -StablePolls $StablePolls `
    -MinOutputChars $MinOutputChars `
    -ExpectedOutputKind "track_plan" `
    -ExpectedOutputContext $LaneContext `
    -RunDir $RunDir `
    -AutoUseFirstStable:$AutoUseFirstStable
  $PlanText = [string]$PlanCandidate.Text
  $State.track_plan_message_id = [string]$PlanCandidate.MessageId
  $State.track_plan_candidate_identity = Get-OCRouterCandidateIdentity -Candidate $PlanCandidate
  Save-PlanFlowArtifact -RunDir $RunDir -Name "01-epic-implementation-plan.md" -Text $PlanText -ProducerMessageId ([string]$PlanCandidate.MessageId) -Stage "seq_next_plan" -CandidateIdentity ([string]$State.track_plan_candidate_identity) -ExpectedOutputKind "track_plan" | Out-Null
  Add-PlanFlowCompletedStep -State $State -Step "plan_received"
  Save-PlanFlowState -RunDir $RunDir -State $State
}
else {
  if (-not [string]::IsNullOrWhiteSpace($PinnedTrackOutputPath)) {
    $ResolvedPinnedPath = if ([IO.Path]::IsPathRooted($PinnedTrackOutputPath)) { $PinnedTrackOutputPath } else { Join-Path (Get-Location).Path $PinnedTrackOutputPath }
    if (-not (Test-Path -LiteralPath $ResolvedPinnedPath -PathType Leaf)) { throw "PinnedTrackOutputPath not found: $ResolvedPinnedPath" }
    $PinnedText = Get-Content -LiteralPath $ResolvedPinnedPath -Raw
    if (Test-OCRouterCompactionSummaryLikeOutput -Text $PinnedText) { throw "Pinned Track artifact looks like a compaction summary, not the exact plan artifact." }
    if (-not (Test-OCRouterExpectedOutputKind -Text $PinnedText -ExpectedOutputKind "track_plan" -ExpectedOutputContext $LaneContext)) {
      throw "Pinned Track output does not satisfy the exact 16-line plan and Target/Epic/lane binding."
    }
    $PlanText = $PinnedText.Trim()
    $PinnedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPinnedPath).Hash
    $State.track_plan_message_id = "artifact:$PinnedHash"
    $State.track_plan_candidate_identity = "sha256:$PinnedHash"
  }
  else {
    $PlanCandidate = Get-OCRouterLatestCandidate `
      -Uri $TrackReadUri `
      -Headers $Headers `
      -CandidateCount $CandidateCount `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts:$IncludeReasoningParts `
      -ExpectedOutputKind "track_plan" `
      -ExpectedOutputContext $LaneContext
    if ($null -eq $PlanCandidate) { throw "No exact current EPIC IMPLEMENTATION PLAN matched Target/Epic/lane in '$Track'." }
    Write-OCRouterSelectedCandidateSummary -Candidate $PlanCandidate
    Write-OCRouterTextPreview -Text $PlanCandidate.Text
    if (-not $AutoApprove) {
      $Answer = Read-Host "Use this exact plan for Meta /terv-review? [y/N]"
      if ($Answer -ne "y" -and $Answer -ne "Y") { throw "Track plan declined." }
    }
    $PlanText = [string]$PlanCandidate.Text
    $State.track_plan_message_id = [string]$PlanCandidate.MessageId
    $State.track_plan_candidate_identity = Get-OCRouterCandidateIdentity -Candidate $PlanCandidate
  }
  Save-PlanFlowArtifact -RunDir $RunDir -Name "01-epic-implementation-plan.md" -Text $PlanText -ProducerMessageId ([string]$State.track_plan_message_id) -Stage "seq_next_plan" -CandidateIdentity ([string]$State.track_plan_candidate_identity) -ExpectedOutputKind "track_plan" | Out-Null
  Add-PlanFlowCompletedStep -State $State -Step "plan_received"
  Save-PlanFlowState -RunDir $RunDir -State $State
}

if ((Get-PlanFlowReadiness -Text $PlanText) -cne "READY") {
  throw "The Delivery plan is structurally valid but not READY for /terv-review. Route its exact blocker upward instead of treating command completion as acceptance."
}
$PlanArtifactIdentity = Get-OCRouterTopLevelFieldValue -Text $PlanText -Field "Plan artifact"
Assert-PlanFlowScalar -Name "Plan artifact" -Value $PlanArtifactIdentity
if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $PlanArtifactIdentity)) {
  throw "Plan artifact must be an opaque identity matching ^[A-Za-z0-9][A-Za-z0-9._@:+~-]*$; keep human plan paths outside this field."
}
if ([string]::IsNullOrWhiteSpace([string]$State.plan_artifact_identity)) {
  $State.plan_artifact_identity = $PlanArtifactIdentity
  Save-PlanFlowState -RunDir $RunDir -State $State
}
elseif ([string]$State.plan_artifact_identity -cne $PlanArtifactIdentity) {
  throw "Plan artifact identity drifted from '$($State.plan_artifact_identity)' to '$PlanArtifactIdentity'."
}
$MetaContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  accountable_lane = $AccountableLaneId
  lane_class = $AccountableLaneClass
  lane_profile = $AccountableLaneProfile
  plan_class = "EPIC_PLAN"
  plan_artifact = $PlanArtifactIdentity
}

if (-not (Test-PlanFlowStepCompleted -State $State -Step "meta_review_sent")) {
  $MetaBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $State.meta_baseline_message_id_before_review = [string]$MetaBaseline.MessageId
  $State.meta_baseline_identity_before_review = "id:$($MetaBaseline.MessageId)"
  Save-PlanFlowState -RunDir $RunDir -State $State
  $Dispatch = Invoke-PlanFlowCommand `
    -LogicalName $Meta `
    -Entry $MetaEntry `
    -Server $Server `
    -Headers $Headers `
    -Command "terv-review" `
    -Arguments $PlanText `
    -PreviewTitle "Exact Delivery plan -> direct Meta plan review" `
    -Model $MetaModel `
    -RunDir $RunDir `
    -Transition "dispatch-terv-review" `
    -BaselineIdentity ([string]$State.meta_baseline_identity_before_review) `
    -CandidateIdentity ([string]$State.track_plan_candidate_identity) `
    -Stage "meta_plan_review" `
    -AutoApprove:$AutoApprove `
    -PreviewOnly:$PreviewOnly
  if (-not [bool]$Dispatch.sent) {
    Write-Host "Preview-only Meta /terv-review completed; no wait or Delivery revision route was performed." -ForegroundColor Yellow
    if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose(); $RunLockHandle = $null }
    return
  }
  Add-PlanFlowCompletedStep -State $State -Step "meta_review_sent"
  Save-PlanFlowState -RunDir $RunDir -State $State
}

$MetaReviewText = ""
if (Test-PlanFlowStepCompleted -State $State -Step "meta_review_received") {
  $MetaReviewText = Get-PlanFlowArtifactText -RunDir $RunDir -Name "02-meta-plan-review.md" -ExpectedOutputKind "meta_plan_review" -ExpectedOutputContext $MetaContext
}
else {
  $MetaCandidate = Resolve-PlanFlowOutput `
    -Label "12-line META PLAN REVIEW" `
    -Uri $MetaReadUri `
    -Headers $Headers `
    -BaselineIdentity ([string]$State.meta_baseline_identity_before_review) `
    -BaselineMessageId ([string]$State.meta_baseline_message_id_before_review) `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -CandidateCount $CandidateCount `
    -PollSeconds $PollSeconds `
    -TimeoutMinutes $TimeoutMinutes `
    -StablePolls $StablePolls `
    -MinOutputChars $MinOutputChars `
    -ExpectedOutputKind "meta_plan_review" `
    -ExpectedOutputContext $MetaContext `
    -RunDir $RunDir `
    -AutoUseFirstStable:$AutoUseFirstStable
  $MetaReviewText = [string]$MetaCandidate.Text
  $State.meta_review_message_id = [string]$MetaCandidate.MessageId
  $State.meta_review_candidate_identity = Get-OCRouterCandidateIdentity -Candidate $MetaCandidate
  Save-PlanFlowArtifact -RunDir $RunDir -Name "02-meta-plan-review.md" -Text $MetaReviewText -ProducerMessageId ([string]$MetaCandidate.MessageId) -Stage "meta_plan_review" -CandidateIdentity ([string]$State.meta_review_candidate_identity) -ExpectedOutputKind "meta_plan_review" | Out-Null
  Add-PlanFlowCompletedStep -State $State -Step "meta_review_received"
  Save-PlanFlowState -RunDir $RunDir -State $State
}

if (-not (Test-PlanFlowStepCompleted -State $State -Step "revision_sent")) {
  $TrackBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $TrackReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $State.track_baseline_message_id_before_revision = [string]$TrackBaseline.MessageId
  $State.track_baseline_identity_before_revision = "id:$($TrackBaseline.MessageId)"
  Save-PlanFlowState -RunDir $RunDir -State $State
  $RevisionArguments = New-OCRouterPlanRevisionArgument -SourcePlanText $PlanText -MetaReviewText $MetaReviewText
  $Dispatch = Invoke-PlanFlowCommand `
    -LogicalName $Track `
    -Entry $TrackEntry `
    -Server $Server `
    -Headers $Headers `
    -Command "terv-review-utan" `
    -Arguments $RevisionArguments `
    -PreviewTitle "Bound plan + Meta review -> Delivery plan revision" `
    -RunDir $RunDir `
    -Transition "dispatch-terv-review-utan" `
    -BaselineIdentity ([string]$State.track_baseline_identity_before_revision) `
    -CandidateIdentity ([string]$State.meta_review_candidate_identity) `
    -Stage "plan_revision" `
    -AutoApprove:$AutoApprove `
    -PreviewOnly:$PreviewOnly
  if (-not [bool]$Dispatch.sent) {
    Write-Host "Preview-only /terv-review-utan completed; no revision wait or intent-path persistence was performed." -ForegroundColor Yellow
    if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose(); $RunLockHandle = $null }
    return
  }
  $State.revision_dispatch_intent_path = (Resolve-Path -LiteralPath ([string]$Dispatch.path) -ErrorAction Stop).Path
  Add-PlanFlowCompletedStep -State $State -Step "revision_sent"
  Save-PlanFlowState -RunDir $RunDir -State $State
}

$RevisionText = ""
if (Test-PlanFlowStepCompleted -State $State -Step "revision_received") {
  $RevisionContext = [pscustomobject]@{
    target = $Target; epic = $Epic; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass
    lane_profile = $AccountableLaneProfile; plan_class = "EPIC_PLAN"
  }
  $RevisionText = Get-PlanFlowArtifactText -RunDir $RunDir -Name "03-revised-epic-implementation-plan.md" -ExpectedOutputKind "track_plan_revision" -ExpectedOutputContext $RevisionContext
}
else {
  $RevisionContext = [pscustomobject]@{
    target = $Target; epic = $Epic; accountable_lane = $AccountableLaneId; lane_class = $AccountableLaneClass
    lane_profile = $AccountableLaneProfile; plan_class = "EPIC_PLAN"
  }
  $RevisionCandidate = Resolve-PlanFlowOutput `
    -Label "16-line revised plan plus 9-line DELIVERY PLAN REVISION" `
    -Uri $TrackReadUri `
    -Headers $Headers `
    -BaselineIdentity ([string]$State.track_baseline_identity_before_revision) `
    -BaselineMessageId ([string]$State.track_baseline_message_id_before_revision) `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -CandidateCount $CandidateCount `
    -PollSeconds $PollSeconds `
    -TimeoutMinutes $TimeoutMinutes `
    -StablePolls $StablePolls `
    -MinOutputChars $MinOutputChars `
    -ExpectedOutputKind "track_plan_revision" `
    -ExpectedOutputContext $RevisionContext `
    -RunDir $RunDir `
    -AutoUseFirstStable:$AutoUseFirstStable
  $RevisionText = [string]$RevisionCandidate.Text
  $State.revision_message_id = [string]$RevisionCandidate.MessageId
  $State.revision_candidate_identity = Get-OCRouterCandidateIdentity -Candidate $RevisionCandidate
  $State.revision_disposition = Get-PlanFlowReadiness -Text $RevisionText
  Save-PlanFlowArtifact -RunDir $RunDir -Name "03-revised-epic-implementation-plan.md" -Text $RevisionText -ProducerMessageId ([string]$RevisionCandidate.MessageId) -Stage "track_plan_revision" -CandidateIdentity ([string]$State.revision_candidate_identity) -ExpectedOutputKind "track_plan_revision" | Out-Null
  Add-PlanFlowCompletedStep -State $State -Step "revision_received"
  Save-PlanFlowState -RunDir $RunDir -State $State
}

$RevisionDisposition = Get-PlanFlowReadiness -Text $RevisionText
if ($RevisionDisposition -cne "IMPLEMENT_READY") {
  $State.revision_disposition = $RevisionDisposition
  Save-PlanFlowState -RunDir $RunDir -State $State
  throw "The exact Delivery revision returned '$RevisionDisposition', not IMPLEMENT_READY. Preserve the artifact and route its exceptional blocker upward; transport success is not semantic acceptance."
}
$State.revision_disposition = "IMPLEMENT_READY"
$RevisionPath = Join-Path $RunDir "03-revised-epic-implementation-plan.md"
$RevisionPin = $State.artifact_pins."03-revised-epic-implementation-plan.md"
Assert-OCRouterArtifactPin -Pin $RevisionPin | Out-Null
$IntentPath = [string]$State.revision_dispatch_intent_path
if ([string]::IsNullOrWhiteSpace($IntentPath) -or -not (Test-Path -LiteralPath $IntentPath -PathType Leaf)) {
  throw "IMPLEMENT_READY cannot be accepted without the durable /terv-review-utan dispatch intent."
}
$IntentRecord = Get-Content -LiteralPath $IntentPath -Raw | ConvertFrom-Json
if ([string]$IntentRecord.status -cne "dispatched" -or [string]$IntentRecord.operation -cne "terv-review-utan") {
  throw "IMPLEMENT_READY is not bound to a completed /terv-review-utan dispatch intent."
}

$CheckpointIdentity = $null
if ($FalSyncCheckpoint) {
  foreach ($Required in @(
    @{ Name = "FalProjectId"; Value = $FalProjectId },
    @{ Name = "FalProjectName"; Value = $FalProjectName },
    @{ Name = "FalTargetRepoKind"; Value = $FalTargetRepoKind },
    @{ Name = "FalTargetRepoPath"; Value = $FalTargetRepoPath },
    @{ Name = "FalTargetWorktreePath"; Value = $FalTargetWorktreePath },
    @{ Name = "FalControlRoot"; Value = $FalControlRoot }
  )) {
    Assert-PlanFlowScalar -Name ([string]$Required.Name) -Value ([string]$Required.Value)
  }
  $Wave = Get-OCRouterTopLevelFieldValue -Text $RevisionText -Field "Wave"
  Assert-PlanFlowScalar -Name "Wave" -Value $Wave
  if ($null -eq $State.fal_checkpoint_identity) {
    $IdentityArgs = @{
      TargetProjectId = $FalProjectId
      TargetRepoKind = $FalTargetRepoKind
      TargetRepoRoot = $FalTargetRepoPath
      TargetWorktree = $FalTargetWorktreePath
      Wave = $Wave
      Epic = $Epic
      Stage = "plan_revision_delivery_response"
      Candidate = [string]$RevisionPin.candidate_identity
      AccountableLaneId = $AccountableLaneId
      AccountableLaneClass = $AccountableLaneClass
      AccountableLaneProfile = $AccountableLaneProfile
      LogicalSender = $Track
      LogicalRecipient = $Track
      SourceSession = $Track
      ArtifactIdentity = [string]$RevisionPin.candidate_identity
      ArtifactPath = $RevisionPath
      ArtifactHash = [string]$RevisionPin.sha256
      ArtifactProducer = [string]$RevisionPin.producer_message_id
      ControlRoot = $FalControlRoot
      SyncMode = "dry_run"
    }
    if ($FalTargetRepoKind -cne "git") {
      $IdentityArgs.TargetHead = "NOT_APPLICABLE"
      $IdentityArgs.TargetRef = "NOT_APPLICABLE"
      $IdentityArgs.TargetStatus = "unversioned"
    }
    $CheckpointIdentity = New-OCRouterFalCheckpointIdentity @IdentityArgs
    $State.fal_checkpoint_identity = $CheckpointIdentity
    $State.fal_checkpoint_identity_sha256 = Get-OCRouterFalCheckpointIdentityHash -Identity $CheckpointIdentity
    Save-PlanFlowState -RunDir $RunDir -State $State
  }
  else {
    $CheckpointIdentity = $State.fal_checkpoint_identity
    Assert-OCRouterFalCheckpointIdentity -Identity $CheckpointIdentity | Out-Null
    if ([string]$State.fal_checkpoint_identity_sha256 -cne (Get-OCRouterFalCheckpointIdentityHash -Identity $CheckpointIdentity)) {
      throw "Pinned full FAL checkpoint identity drifted; refusing receipt/proposal generation."
    }
  }
}

if ([string]::IsNullOrWhiteSpace([string]$State.delivery_receipt_path)) {
  $State.delivery_receipt_path = Write-OCRouterArtifactDeliveryReceipt `
    -RunDir $RunDir `
    -Name "serial-plan-revision-delivery" `
    -ArtifactPath $RevisionPath `
    -ProducerSession $Track `
    -Command "terv-review-utan" `
    -Target $Target `
    -Recipient $Track `
    -DeliveryProven $true `
    -ResponseClass "IMPLEMENT_READY" `
    -ResponseArtifactPath $RevisionPath `
    -ResponseMessageId ([string]$RevisionPin.producer_message_id) `
    -DispatchIntentPath $IntentPath `
    -FalCheckpointIdentity $CheckpointIdentity
  Save-PlanFlowState -RunDir $RunDir -State $State
}
else {
  Assert-OCRouterArtifactDeliveryReceipt `
    -ReceiptPath ([string]$State.delivery_receipt_path) `
    -ArtifactPath $RevisionPath `
    -ProducerSession $Track `
    -Command "terv-review-utan" `
    -Target $Target `
    -Recipient $Track `
    -ResponseClass "IMPLEMENT_READY" `
    -ResponseArtifactPath $RevisionPath `
    -ResponseMessageId ([string]$RevisionPin.producer_message_id) `
    -DispatchIntentPath $IntentPath `
    -FalCheckpointIdentity $CheckpointIdentity | Out-Null
}

if ($FalSyncCheckpoint) {
  if ([string]::IsNullOrWhiteSpace([string]$State.fal_checkpoint_operation_path)) {
    $Proposal = Write-OCRouterFalCheckpointTargetProposal `
      -RunDir $RunDir `
      -Name "serial-plan-revision" `
      -ProjectName $FalProjectName `
      -Target $Target `
      -CheckpointIdentity $CheckpointIdentity `
      -ReceiptPath ([string]$State.delivery_receipt_path) `
      -DeliveryResponseClass "IMPLEMENT_READY"
    $State.fal_checkpoint_operation_path = [string]$Proposal.path
    $State.fal_checkpoint_operation_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$Proposal.path)).Hash
  }
  else {
    Assert-OCRouterFalCheckpointTargetProposal `
      -ProposalPath ([string]$State.fal_checkpoint_operation_path) `
      -CheckpointIdentity $CheckpointIdentity `
      -ProjectName $FalProjectName `
      -Target $Target `
      -ReceiptPath ([string]$State.delivery_receipt_path) `
      -DeliveryResponseClass "IMPLEMENT_READY" | Out-Null
    if ([string]$State.fal_checkpoint_operation_sha256 -cne (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$State.fal_checkpoint_operation_path)).Hash) {
      throw "Pinned proposal-only /fal-checkpoint-target operation hash drifted."
    }
  }
}

$State.completed_at = (Get-Date).ToString("o")
Add-PlanFlowCompletedStep -State $State -Step "implement_ready_accepted"
Save-PlanFlowState -RunDir $RunDir -State $State

Write-Host "Serial plan-review flow completed or resumed with semantic IMPLEMENT_READY. Runtime artifacts: $RunDir" -ForegroundColor Green
$Result = [pscustomobject]@{
  run_id = $RunId
  run_dir = $RunDir
  target = $Target
  epic = $Epic
  accountable_lane = $LaneDisplay
  plan_artifact_identity = $PlanArtifactIdentity
  revision_path = $RevisionPath
  revision_disposition = "IMPLEMENT_READY"
  delivery_receipt_path = [string]$State.delivery_receipt_path
  fal_checkpoint_operation_path = [string]$State.fal_checkpoint_operation_path
}
if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose(); $RunLockHandle = $null }
$Result
