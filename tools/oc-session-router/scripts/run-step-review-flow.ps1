param(
  [string]$Track = "",

  [string]$Target = "",

  [string]$Epic = "",

  [string]$Wave = "",
  [string]$AccountableLaneId = "",
  [ValidateSet('TRACK', 'SPECIALIST_DELIVERY', 'GOVERNANCE')]
  [string]$AccountableLaneClass = 'TRACK',
  [string]$AccountableLaneProfile = "",

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

  [string]$PinnedImplementationArtifactPath = "",
  [string]$PinnedImplementationArtifactSha256 = "",
  [string]$PinnedImplementationProducerMessageId = "",
  [string]$PinnedImplementationCandidate = "",

  [switch]$Resume,
  [string]$RunId = "",
  [switch]$FalSyncCheckpoint,
  [string]$FalProjectId = "",
  [string]$FalProjectName = "",
  [ValidateSet('auto', 'git', 'non_git', 'declared_equivalent')]
  [string]$FalTargetRepoKind = 'auto',
  [string]$FalTargetRepoPath = "",
  [string]$FalTargetWorktreePath = "",
  [string]$FalTargetHead = "",
  [string]$FalTargetRef = "",
  [string]$FalTargetStatus = "",
  [string]$FalControlRoot = ""
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: use Invoke-OCRouter.ps1 for one explicit stage.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

$Settings = Get-OCRouterSettings -RouterDir $RouterDir
$PollSeconds = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "PollSeconds" -CurrentValue $PollSeconds -SettingName "poll_seconds")
$TimeoutMinutes = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "TimeoutMinutes" -CurrentValue $TimeoutMinutes -SettingName "timeout_minutes")
$Limit = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "Limit" -CurrentValue $Limit -SettingName "limit")
$CandidateCount = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "CandidateCount" -CurrentValue $CandidateCount -SettingName "candidate_count")
$StablePolls = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "StablePolls" -CurrentValue $StablePolls -SettingName "stable_polls")
$MinOutputChars = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "MinOutputChars" -CurrentValue $MinOutputChars -SettingName "min_output_chars")
$SwarmReviewDepth = [string](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "SwarmReviewDepth" -CurrentValue $SwarmReviewDepth -SettingName "swarm_review_depth")
if (-not $PSBoundParameters.ContainsKey("ReviewRegistryPath")) {
  $ReviewRegistryPath = [string](Get-OCRouterSettingValue -Settings $Settings -Name "review_registry_path" -DefaultValue "")
}
if (-not $PSBoundParameters.ContainsKey("AssumeOldestFirst")) {
  $MessageOrder = [string](Get-OCRouterSettingValue -Settings $Settings -Name "message_order" -DefaultValue "")
  if ($MessageOrder -eq "oldest_first") {
    $AssumeOldestFirst = $true
  }
}

function Get-FlowCandidateIdentity {
  param([object]$Candidate)

  if ($null -eq $Candidate) {
    return ""
  }
  if (-not [string]::IsNullOrWhiteSpace($Candidate.MessageId)) {
    return "id:$($Candidate.MessageId)"
  }
  return "text:$($Candidate.Text)"
}

function Get-FlowCandidateStableSignature {
  param([object]$Candidate)

  if ($null -eq $Candidate) {
    return ""
  }
  $Tail = $Candidate.Text
  if ($Tail.Length -gt 240) {
    $Tail = $Tail.Substring($Tail.Length - 240)
  }
  return "$(Get-FlowCandidateIdentity -Candidate $Candidate)|len:$($Candidate.TextLength)|tail:$Tail"
}

function Resolve-FlowPinnedImplementationHandoff {
  param(
    [string]$ArtifactPath,
    [string]$ArtifactSha256,
    [string]$ProducerMessageId,
    [string]$Candidate,
    [object]$ExpectedContext
  )

  foreach ($Pair in @(
    @('ArtifactPath', $ArtifactPath),
    @('ArtifactSha256', $ArtifactSha256),
    @('ProducerMessageId', $ProducerMessageId),
    @('Candidate', $Candidate)
  )) {
    if ([string]::IsNullOrWhiteSpace([string]$Pair[1])) {
      throw "Pinned implementation handoff requires '$($Pair[0])'."
    }
  }
  if ($ArtifactSha256 -notmatch '^[0-9A-Fa-f]{64}$') {
    throw 'Pinned implementation handoff SHA256 must be exactly 64 hexadecimal characters.'
  }
  if (-not (Test-Path -LiteralPath $ArtifactPath -PathType Leaf)) {
    throw "Pinned implementation artifact is missing: $ArtifactPath"
  }
  $ResolvedPath = (Resolve-Path -LiteralPath $ArtifactPath -ErrorAction Stop).Path
  $ObservedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPath).Hash
  if ($ObservedHash -cne $ArtifactSha256.ToUpperInvariant()) {
    throw 'Pinned implementation artifact hash drift.'
  }
  $Text = Get-Content -LiteralPath $ResolvedPath -Raw
  if (-not (Test-OCRouterExpectedOutputKind -Text $Text -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ExpectedContext)) {
    throw 'Pinned implementation handoff does not match the exact Target/Epic/accountable-lane context.'
  }
  $ObservedCandidate = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Candidate identity/worktree limitations'
  if ([string]$ObservedCandidate -cne $Candidate) {
    throw "Pinned implementation Candidate drift: expected '$Candidate', observed '$ObservedCandidate'."
  }

  return [pscustomobject]@{
    enabled = $true
    path = $ResolvedPath
    sha256 = $ObservedHash
    producer_message_id = $ProducerMessageId.Trim()
    candidate = $Candidate.Trim()
    candidate_identity = "id:$($ProducerMessageId.Trim())"
    text = $Text
  }
}

function Select-FlowImplementationSource {
  param(
    [object]$PinnedHandoff,
    [scriptblock]$LatestCandidateResolver
  )

  if ($null -ne $PinnedHandoff -and [bool]$PinnedHandoff.enabled) {
    return [pscustomobject]@{
      source = 'pinned_handoff'
      text = [string]$PinnedHandoff.text
      message_id = [string]$PinnedHandoff.producer_message_id
      candidate_identity = [string]$PinnedHandoff.candidate_identity
      candidate = $null
    }
  }
  if ($null -eq $LatestCandidateResolver) {
    throw 'Normal implementation selection requires a latest-candidate resolver.'
  }
  $Latest = & $LatestCandidateResolver
  return [pscustomobject]@{
    source = 'session_latest'
    text = if ($null -eq $Latest) { '' } else { [string]$Latest.Text }
    message_id = if ($null -eq $Latest) { '' } else { [string]$Latest.MessageId }
    candidate_identity = if ($null -eq $Latest) { '' } else { Get-FlowCandidateIdentity -Candidate $Latest }
    candidate = $Latest
  }
}

function Get-FlowTargetCorrelationPattern {
  param([string]$Target)

  $Identifiers = [regex]::Matches($Target, '(?i)\b[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)+\b')
  if ($Identifiers.Count -gt 0) {
    return [regex]::Escape($Identifiers[$Identifiers.Count - 1].Value)
  }

  return [regex]::Escape($Target.Trim())
}

function Get-FlowLatestCandidate {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [int]$CandidateCount,
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [string]$ExpectedTextPattern = "",
    [string]$AfterMessageId = ""
  )

  $Response = Invoke-RestMethod `
    -Method Get `
    -Uri $Uri `
    -Headers $Headers `
    -ContentType "application/json"

  $Messages = @(Get-OCRouterMessageCollection -Response $Response)
  $Candidates = @(Get-OCRouterLatestOutputCandidates `
    -Messages $Messages `
    -CandidateCount $CandidateCount `
    -AssumeNewestFirst:$AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -ExpectedOutputKind $ExpectedOutputKind `
    -ExpectedOutputContext $ExpectedOutputContext `
    -AfterMessageId $AfterMessageId)

  if (-not [string]::IsNullOrWhiteSpace($ExpectedTextPattern)) {
    $Candidates = @($Candidates | Where-Object { $_.Text -match $ExpectedTextPattern })
  }

  if ($Candidates.Count -eq 0) {
    return $null
  }
  return $Candidates[0]
}

function Wait-FlowNewOutput {
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
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [string]$ExpectedTextPattern = "",
    [switch]$AutoUseFirstStable
  )

  if ([string]::IsNullOrWhiteSpace($BaselineMessageId)) {
    throw "Waiting for '$Label' requires a persisted raw assistant baseline message ID."
  }
  $Deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  $Ignored = @{}
  $LastSignature = ""
  $StableCount = 0

  Write-Host "Waiting for $Label. Press Ctrl+C to stop." -ForegroundColor Cyan
  while ((Get-Date) -lt $Deadline) {
    Start-Sleep -Seconds $PollSeconds
    $Candidate = Get-FlowLatestCandidate `
      -Uri $Uri `
      -Headers $Headers `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts $IncludeReasoningParts `
      -CandidateCount $CandidateCount `
      -ExpectedOutputKind $ExpectedOutputKind `
      -ExpectedOutputContext $ExpectedOutputContext `
      -ExpectedTextPattern $ExpectedTextPattern `
      -AfterMessageId $BaselineMessageId

    if ($null -eq $Candidate) {
      if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
        Write-Host "No assistant candidate yet."
      }
      else {
        $CorrelationNote = if ([string]::IsNullOrWhiteSpace($ExpectedTextPattern)) { "" } else { " matching target correlation '$ExpectedTextPattern'" }
        Write-Host "No assistant candidate of expected kind '$ExpectedOutputKind'$CorrelationNote yet."
      }
      continue
    }

    $Identity = Get-FlowCandidateIdentity -Candidate $Candidate
    if ($Identity -eq $BaselineIdentity -or $Ignored.ContainsKey($Identity)) {
      Write-Host "No new $Label candidate yet. latest=$Identity chars=$($Candidate.TextLength)"
      continue
    }

    if ($Candidate.TextLength -lt $MinOutputChars) {
      Write-Host "New $Label candidate is too short. latest=$Identity chars=$($Candidate.TextLength) min=$MinOutputChars"
      continue
    }

    $Signature = Get-FlowCandidateStableSignature -Candidate $Candidate
    if ($Signature -eq $LastSignature) {
      $StableCount += 1
    }
    else {
      $LastSignature = $Signature
      $StableCount = 1
    }

    Write-Host "New $Label candidate observed. latest=$Identity chars=$($Candidate.TextLength) stable=$StableCount/$StablePolls"
    if ($StableCount -lt $StablePolls) {
      continue
    }

    Write-Host ""
    Write-OCRouterSelectedCandidateSummary -Candidate $Candidate
    Write-Host "$Label preview:" -ForegroundColor Yellow
    Write-OCRouterTextPreview -Text $Candidate.Text

    if ($AutoUseFirstStable) {
      return $Candidate
    }

    $Answer = Read-Host "Use this $Label? [u]se/[w]ait/[n]abort"
    if ($Answer -eq "u" -or $Answer -eq "U" -or $Answer -eq "y" -or $Answer -eq "Y") {
      return $Candidate
    }
    elseif ($Answer -eq "w" -or $Answer -eq "W") {
      $Ignored[$Identity] = $true
      $LastSignature = ""
      $StableCount = 0
      Write-Host "Continuing to wait for newer $Label." -ForegroundColor Yellow
      continue
    }
    else {
      throw "Aborted while waiting for $Label."
    }
  }

  throw "Timed out after $TimeoutMinutes minutes waiting for $Label."
}

function Invoke-FlowCommand {
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
  $Uri = "$Server/session/$($Entry.sessionId)/command"

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

  $BodyObject = New-OCRouterCommandRequestBodyObject -Command $CommandName -Arguments $Arguments -Model $Model
  $Body = $BodyObject | ConvertTo-Json -Depth 10
  $Intent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition $Transition -Recipient $LogicalName -Kind command -Operation $CommandName -Payload $Body -BaselineIdentity $BaselineIdentity -CandidateIdentity $CandidateIdentity -Stage $Stage
  if (-not [bool]$Intent.should_send) {
    Write-Host "Dispatch intent already records /$CommandName as sent; not resending." -ForegroundColor Cyan
    return $Intent.intent
  }

  $Response = Invoke-RestMethod `
    -Method Post `
    -Uri $Uri `
    -Headers $Headers `
    -ContentType "application/json" `
    -Body $Body
  $CompletedIntent = Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) -TransportStatus 'accepted'

  Write-Host "Sent command /$CommandName to $LogicalName." -ForegroundColor Green
  return $CompletedIntent
}

function Send-FlowMessage {
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
  if (-not [bool]$Intent.should_send) {
    Write-Host "Dispatch intent already records the plain message as sent; not resending." -ForegroundColor Cyan
    return $Intent.intent
  }
  $Response = Invoke-RestMethod `
    -Method Post `
    -Uri $Uri `
    -Headers $Headers `
    -ContentType "application/json" `
    -Body $Body
  $CompletedIntent = Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $Response) -TransportStatus 'accepted'

  Write-Host "Sent message to $LogicalName." -ForegroundColor Green
  return $CompletedIntent
}

function Save-FlowArtifact {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$Text,
    [string]$ProducerMessageId,
    [string]$Stage,
    [string]$CandidateIdentity,
    [string]$ExpectedOutputKind = ""
  )

  if ([string]::IsNullOrWhiteSpace($ProducerMessageId) -or [string]::IsNullOrWhiteSpace($Stage) -or [string]::IsNullOrWhiteSpace($CandidateIdentity)) {
    throw "Artifact '$Name' requires producer message ID, stage, and candidate identity."
  }
  $Path = Join-Path $RunDir $Name
  Write-OCRouterAtomicTextFile -Path $Path -Text $Text
  $Pin = New-OCRouterArtifactPin -Path $Path -ProducerMessageId $ProducerMessageId -Stage $Stage -CandidateIdentity $CandidateIdentity -ExpectedOutputKind $ExpectedOutputKind
  if ($null -eq $script:State.artifact_pins) { $script:State.artifact_pins = [pscustomobject]@{} }
  $script:State.artifact_pins | Add-Member -NotePropertyName $Name -NotePropertyValue $Pin -Force
  return $Path
}

function Save-FlowState {
  param(
    [string]$RunDir,
    [object]$State
  )

  $Path = Join-Path $RunDir "state.json"
  Write-OCRouterAtomicJsonFile -Path $Path -Value $State
}

function Ensure-FlowStateField {
  param(
    [object]$State,
    [string]$Name,
    [object]$Value
  )

  if ($State -is [System.Collections.IDictionary]) {
    if (-not $State.Contains($Name)) {
      $State[$Name] = $Value
    }
  }
  elseif ($null -eq $State.PSObject.Properties[$Name]) {
    Add-Member -InputObject $State -MemberType NoteProperty -Name $Name -Value $Value
  }
}

function Load-FlowState {
  param([string]$RunDir)

  $Path = Join-Path $RunDir "state.json"
  if (-not (Test-Path $Path)) {
    throw "Missing flow state file: $Path"
  }
  return Get-Content $Path -Raw | ConvertFrom-Json
}

function Test-FlowStepCompleted {
  param(
    [object]$State,
    [string]$StepName
  )

  return (@($State.completed_steps) -contains $StepName)
}

function Add-FlowCompletedStep {
  param(
    [object]$State,
    [string]$StepName
  )

  if (-not (Test-FlowStepCompleted -State $State -StepName $StepName)) {
    $State.completed_steps = @(@($State.completed_steps) + $StepName)
  }
}

function Get-FlowArtifactText {
  param(
    [string]$RunDir,
    [string]$Name,
    [switch]$Required
  )

  $Path = Join-Path $RunDir $Name
  if (-not (Test-Path $Path)) {
    if ($Required) {
      throw "Missing required flow artifact: $Path"
    }
    return ""
  }

  if ($null -eq $script:State.artifact_pins -or $script:State.artifact_pins.PSObject.Properties.Name -notcontains $Name) {
    throw "Saved artifact '$Name' has no durable state pin; refusing resume."
  }
  Assert-OCRouterArtifactPin -Pin $script:State.artifact_pins.$Name | Out-Null

  return Get-Content $Path -Raw
}

function Resolve-FlowOutputOnResume {
  param(
    [string]$Label,
    [string]$Uri,
    [hashtable]$Headers,
    [string]$BaselineIdentity,
    [string]$BaselineMessageId,
    [string]$BaselineStateField,
    [object]$State,
    [string]$RunDir,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [int]$CandidateCount,
    [int]$PollSeconds,
    [int]$TimeoutMinutes,
    [int]$StablePolls,
    [int]$MinOutputChars,
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [string]$ExpectedTextPattern = "",
    [switch]$AutoUseFirstStable
  )

  if ([string]::IsNullOrWhiteSpace($BaselineMessageId)) {
    throw "Resume for '$Label' has no persisted raw assistant baseline message ID."
  }
  $Current = Get-FlowLatestCandidate `
    -Uri $Uri `
    -Headers $Headers `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts $IncludeReasoningParts `
    -CandidateCount $CandidateCount `
    -ExpectedOutputKind $ExpectedOutputKind `
    -ExpectedOutputContext $ExpectedOutputContext `
    -ExpectedTextPattern $ExpectedTextPattern `
    -AfterMessageId $BaselineMessageId

  if ($null -ne $Current) {
    $CurrentIdentity = Get-FlowCandidateIdentity -Candidate $Current
    Write-Host ""
    Write-Host "Resume candidate check for ${Label}:" -ForegroundColor Cyan
    Write-OCRouterSelectedCandidateSummary -Candidate $Current
    Write-Host "$Label current latest preview:" -ForegroundColor Yellow
    Write-OCRouterTextPreview -Text $Current.Text

    if ($AutoUseFirstStable) {
      return $Current
    }

    $Answer = Read-Host "Resume $Label with current latest? [u]se/[w]ait/[n]abort"
    if ($Answer -eq "u" -or $Answer -eq "U" -or $Answer -eq "y" -or $Answer -eq "Y") {
      return $Current
    }
    elseif ($Answer -eq "n" -or $Answer -eq "N") {
      throw "Aborted while resuming $Label."
    }
  }

  return (Wait-FlowNewOutput `
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
    -ExpectedTextPattern $ExpectedTextPattern `
    -AutoUseFirstStable:$AutoUseFirstStable)
}

if ($PollSeconds -lt 2) { throw "PollSeconds must be at least 2." }
if ($TimeoutMinutes -lt 1) { throw "TimeoutMinutes must be at least 1." }
if ($Limit -lt 1) { throw "Limit must be at least 1." }
if ($CandidateCount -lt 1) { throw "CandidateCount must be at least 1." }
if ($StablePolls -lt 1) { throw "StablePolls must be at least 1." }
if ($MinOutputChars -lt 1) { throw "MinOutputChars must be at least 1." }

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

$PinnedImplementationParameterNames = @(
  'PinnedImplementationArtifactPath',
  'PinnedImplementationArtifactSha256',
  'PinnedImplementationProducerMessageId',
  'PinnedImplementationCandidate'
)
$PinnedImplementationExplicitCount = @($PinnedImplementationParameterNames | Where-Object { $PSBoundParameters.ContainsKey($_) }).Count
if ($PinnedImplementationExplicitCount -notin @(0, $PinnedImplementationParameterNames.Count)) {
  throw 'Pinned implementation handoff parameters are atomic: provide path, SHA256, producer message ID, and Candidate together.'
}
if ($PinnedImplementationExplicitCount -eq $PinnedImplementationParameterNames.Count) {
  foreach ($Name in $PinnedImplementationParameterNames) {
    if ([string]::IsNullOrWhiteSpace([string](Get-Variable -Name $Name -ValueOnly))) {
      throw "Pinned implementation handoff parameter '$Name' cannot be blank."
    }
  }
  $PinnedImplementationArtifactPath = (Resolve-Path -LiteralPath $PinnedImplementationArtifactPath -ErrorAction Stop).Path
  $PinnedImplementationArtifactSha256 = $PinnedImplementationArtifactSha256.Trim().ToUpperInvariant()
  $PinnedImplementationProducerMessageId = $PinnedImplementationProducerMessageId.Trim()
  $PinnedImplementationCandidate = $PinnedImplementationCandidate.Trim()
}

if ($Resume) {
  if ([string]::IsNullOrWhiteSpace($RunId)) {
    throw "RunId is required with -Resume."
  }
}
else {
  if ([string]::IsNullOrWhiteSpace($Track)) {
    throw "Track is required for a new step-review flow."
  }
  if ([string]::IsNullOrWhiteSpace($Target)) {
    throw "Target is required for a new step-review flow."
  }
  if ([string]::IsNullOrWhiteSpace($Epic)) {
    throw "Epic is required and must be distinct from the project/repository Target binding."
  }
}

$AssumeNewestFirst = -not $AssumeOldestFirst
$Config = Get-OCRouterConfig -RouterDir $RouterDir
$RunRoot = Join-Path $RouterDir "step-review-runs"
New-Item -ItemType Directory -Force $RunRoot | Out-Null

if ($Resume) {
  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  trap { if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }; throw }
  $State = Load-FlowState -RunDir $RunDir

  if ([string]::IsNullOrWhiteSpace($Track)) {
    $Track = [string]$State.track
  }
  elseif ($Track -ne [string]$State.track) {
    throw "Resume Track '$Track' does not match saved run Track '$($State.track)'."
  }

  if ([string]::IsNullOrWhiteSpace($Target)) {
    $Target = [string]$State.target
  }
  elseif ($Target -ne [string]$State.target) {
    throw "Resume Target '$Target' does not match saved run Target '$($State.target)'."
  }
  if ($null -eq $State.PSObject.Properties['epic'] -or [string]::IsNullOrWhiteSpace([string]$State.epic)) {
    throw "Saved run uses the legacy ambiguous Target-as-Epic ABI and cannot be resumed. Start a new run with explicit -Target and -Epic."
  }
  if ([string]::IsNullOrWhiteSpace($Epic)) {
    $Epic = [string]$State.epic
  }
  elseif ($Epic -cne [string]$State.epic) {
    throw "Resume Epic '$Epic' does not match saved run Epic '$($State.epic)'."
  }

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

  Ensure-FlowStateField -State $State -Name "review_cycle_index" -Value ([int]$State.review_cycle_index)
  Ensure-FlowStateField -State $State -Name "effective_meta_internal_lanes" -Value ([int]$State.effective_meta_internal_lanes)
  Ensure-FlowStateField -State $State -Name "effective_skip_swarm_review" -Value ([bool]$State.effective_skip_swarm_review)
  Ensure-FlowStateField -State $State -Name "review_controls_source" -Value ([string]$State.review_controls_source)
  Ensure-FlowStateField -State $State -Name "effective_swarm_review_depth" -Value ([string]$State.effective_swarm_review_depth)
  Ensure-FlowStateField -State $State -Name "swarm_review_focus" -Value ([string]$State.swarm_review_focus)
  Ensure-FlowStateField -State $State -Name "contract_risk_paths" -Value @(@($State.contract_risk_paths))
  Ensure-FlowStateField -State $State -Name "review_profile" -Value $ReviewProfile
  Ensure-FlowStateField -State $State -Name "project_review_context" -Value $ProjectReviewContext
  Ensure-FlowStateField -State $State -Name "review_focus" -Value $ReviewFocus
  Ensure-FlowStateField -State $State -Name "review_lanes" -Value @($ReviewLanes)
  Ensure-FlowStateField -State $State -Name "lane_selection_reason" -Value ""
  Ensure-FlowStateField -State $State -Name "model_profile" -Value $ModelProfile
  Ensure-FlowStateField -State $State -Name "expanded_review_approved" -Value ([bool]$ExpandedReviewApproved)
  Ensure-FlowStateField -State $State -Name "owner_approval_record" -Value $OwnerApprovalRecord
  Ensure-FlowStateField -State $State -Name "owner_approval_cost_envelope" -Value $OwnerApprovalCostEnvelope
  Ensure-FlowStateField -State $State -Name "review_registry_path" -Value $ReviewRegistryPath
  Ensure-FlowStateField -State $State -Name "review_registry_sha256" -Value ""
  Ensure-FlowStateField -State $State -Name "review_registry_version" -Value 0
  Ensure-FlowStateField -State $State -Name "owner_approval_sha256" -Value ""
  Ensure-FlowStateField -State $State -Name "owner_approval_version" -Value 0
  Ensure-FlowStateField -State $State -Name "owner_approval_identity" -Value ""
  Ensure-FlowStateField -State $State -Name "requested_swarm_review_depth" -Value $SwarmReviewDepth
  Ensure-FlowStateField -State $State -Name "model_routing_policy_version" -Value 3
  Ensure-FlowStateField -State $State -Name "luna_retry_limit" -Value 1
  Ensure-FlowStateField -State $State -Name "meta_model" -Value $MetaModel
  Ensure-FlowStateField -State $State -Name "swarm_message_model" -Value $SwarmMessageModel
  Ensure-FlowStateField -State $State -Name "wave" -Value $Wave
  Ensure-FlowStateField -State $State -Name "accountable_lane_id" -Value $AccountableLaneId
  Ensure-FlowStateField -State $State -Name "accountable_lane_class" -Value $AccountableLaneClass
  Ensure-FlowStateField -State $State -Name "accountable_lane_profile" -Value $AccountableLaneProfile
  Ensure-FlowStateField -State $State -Name "fal_sync_checkpoint" -Value ([bool]$FalSyncCheckpoint)
  Ensure-FlowStateField -State $State -Name "fal_project_id" -Value $FalProjectId
  Ensure-FlowStateField -State $State -Name "fal_project_name" -Value $FalProjectName
  Ensure-FlowStateField -State $State -Name "fal_target_repo_kind" -Value $FalTargetRepoKind
  Ensure-FlowStateField -State $State -Name "fal_target_repo_path" -Value $FalTargetRepoPath
  Ensure-FlowStateField -State $State -Name "fal_target_worktree_path" -Value $FalTargetWorktreePath
  Ensure-FlowStateField -State $State -Name "fal_target_head" -Value $FalTargetHead
  Ensure-FlowStateField -State $State -Name "fal_target_ref" -Value $FalTargetRef
  Ensure-FlowStateField -State $State -Name "fal_target_status" -Value $FalTargetStatus
  Ensure-FlowStateField -State $State -Name "fal_control_root" -Value $FalControlRoot
  Ensure-FlowStateField -State $State -Name "fal_checkpoint_identity" -Value $null
  Ensure-FlowStateField -State $State -Name "fal_checkpoint_identity_sha256" -Value ""
  Ensure-FlowStateField -State $State -Name "pinned_implementation_artifact_path" -Value ""
  Ensure-FlowStateField -State $State -Name "pinned_implementation_artifact_sha256" -Value ""
  Ensure-FlowStateField -State $State -Name "pinned_implementation_producer_message_id" -Value ""
  Ensure-FlowStateField -State $State -Name "pinned_implementation_candidate" -Value ""

  if ($PinnedImplementationExplicitCount -eq 0) {
    $PinnedImplementationArtifactPath = [string]$State.pinned_implementation_artifact_path
    $PinnedImplementationArtifactSha256 = [string]$State.pinned_implementation_artifact_sha256
    $PinnedImplementationProducerMessageId = [string]$State.pinned_implementation_producer_message_id
    $PinnedImplementationCandidate = [string]$State.pinned_implementation_candidate
  }
  else {
    foreach ($Pair in @(
      @('PinnedImplementationArtifactPath', 'pinned_implementation_artifact_path'),
      @('PinnedImplementationArtifactSha256', 'pinned_implementation_artifact_sha256'),
      @('PinnedImplementationProducerMessageId', 'pinned_implementation_producer_message_id'),
      @('PinnedImplementationCandidate', 'pinned_implementation_candidate')
    )) {
      if ([string](Get-Variable -Name $Pair[0] -ValueOnly) -cne [string]$State.($Pair[1])) {
        throw "Resume pinned implementation handoff '$($Pair[0])' does not match saved state."
      }
    }
  }

  if (-not $PSBoundParameters.ContainsKey("ExpandedReviewApproved")) {
    $ExpandedReviewApproved = [bool]$State.expanded_review_approved
  }

  if (-not $PSBoundParameters.ContainsKey("ReviewCycleIndex")) {
    $ReviewCycleIndex = [int]$State.review_cycle_index
  }
  if (-not $PSBoundParameters.ContainsKey("FalSyncCheckpoint")) {
    $FalSyncCheckpoint = [bool]$State.fal_sync_checkpoint
  }
  elseif ([bool]$FalSyncCheckpoint -ne [bool]$State.fal_sync_checkpoint) {
    throw "Resume FalSyncCheckpoint does not match the saved run value '$($State.fal_sync_checkpoint)'."
  }
  foreach ($Binding in @(
    @{ Parameter = "ReviewProfile"; Field = "review_profile" },
    @{ Parameter = "ProjectReviewContext"; Field = "project_review_context" },
    @{ Parameter = "ReviewFocus"; Field = "review_focus" },
    @{ Parameter = "OwnerApprovalRecord"; Field = "owner_approval_record" },
    @{ Parameter = "OwnerApprovalCostEnvelope"; Field = "owner_approval_cost_envelope" },
    @{ Parameter = "ReviewRegistryPath"; Field = "review_registry_path" },
    @{ Parameter = "SwarmReviewDepth"; Field = "requested_swarm_review_depth" },
    @{ Parameter = "ModelProfile"; Field = "model_profile" },
    @{ Parameter = "MetaModel"; Field = "meta_model" },
    @{ Parameter = "SwarmMessageModel"; Field = "swarm_message_model" },
    @{ Parameter = "Wave"; Field = "wave" },
    @{ Parameter = "AccountableLaneId"; Field = "accountable_lane_id" },
    @{ Parameter = "AccountableLaneClass"; Field = "accountable_lane_class" },
    @{ Parameter = "AccountableLaneProfile"; Field = "accountable_lane_profile" },
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
}
else {
  if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = "step-review-{0}-{1}-{2}" -f (Get-OCRouterSafeName -Value $Target), (Get-OCRouterSafeName -Value $Epic), (Get-OCRouterSafeTimestamp)
  }

  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $RunLockHandle = Enter-OCRouterRunLock -RunDir $RunDir
  trap { if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }; throw }
  if (Test-Path (Join-Path $RunDir "state.json")) {
    throw "Run directory already exists. Use -Resume -RunId $RunId if you want to continue it."
  }

  New-Item -ItemType Directory -Force $RunDir | Out-Null
  $State = [ordered]@{
    run_id = $RunId
    target = $Target
    epic = $Epic
    wave = $Wave
    track = $Track
    accountable_lane_id = $AccountableLaneId
    accountable_lane_class = $AccountableLaneClass
    accountable_lane_profile = $AccountableLaneProfile
    meta = $Meta
    swarm_assistant = $SwarmAssistant
    created_at = (Get-Date).ToString("o")
    completed_at = ""
    completed_steps = @()
    artifact_pins = [pscustomobject]@{}
    meta_baseline_identity_before_step_review = ""
    meta_baseline_message_id_before_step_review = ""
    swarm_baseline_identity_before_prompt = ""
    swarm_baseline_message_id_before_prompt = ""
    swarm_dispatch_intent_path = ""
    meta_baseline_identity_before_swarm_review = ""
    meta_baseline_message_id_before_swarm_review = ""
    track_selected_output_identity = ""
    reviewed_candidate = ""
    surfaced_finding_ids = @()
    track_baseline_identity_before_step_review_utan = ""
    track_baseline_message_id_before_step_review_utan = ""
    delivery_response_class = ""
    delivery_response_sha256 = ""
    delivery_dispatch_binding = ""
    delivery_dispatch_intent_path = ""
    delivery_dispatch_returned_id = ""
    delivery_receipt_path = ""
    fal_checkpoint_operation_path = ""
    fal_checkpoint_operation_sha256 = ""
    fal_sync_checkpoint = [bool]$FalSyncCheckpoint
    fal_project_id = $FalProjectId
    fal_project_name = $FalProjectName
    fal_target_repo_kind = $FalTargetRepoKind
    fal_target_repo_path = $FalTargetRepoPath
    fal_target_worktree_path = $FalTargetWorktreePath
    fal_target_head = $FalTargetHead
    fal_target_ref = $FalTargetRef
    fal_target_status = $FalTargetStatus
    fal_control_root = $FalControlRoot
    fal_checkpoint_identity = $null
    fal_checkpoint_identity_sha256 = ""
    pinned_implementation_artifact_path = $PinnedImplementationArtifactPath
    pinned_implementation_artifact_sha256 = $PinnedImplementationArtifactSha256
    pinned_implementation_producer_message_id = $PinnedImplementationProducerMessageId
    pinned_implementation_candidate = $PinnedImplementationCandidate
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
    requested_swarm_review_depth = $SwarmReviewDepth
    model_routing_policy_version = 3
    luna_retry_limit = 1
    meta_model = $MetaModel
    swarm_message_model = $SwarmMessageModel
  }
  Save-FlowState -RunDir $RunDir -State $State
}

Ensure-FlowStateField -State $State -Name "completed_at" -Value ([string]$State.completed_at)
Ensure-FlowStateField -State $State -Name "review_cycle_index" -Value ([int]$State.review_cycle_index)
Ensure-FlowStateField -State $State -Name "effective_meta_internal_lanes" -Value ([int]$State.effective_meta_internal_lanes)
Ensure-FlowStateField -State $State -Name "effective_skip_swarm_review" -Value ([bool]$State.effective_skip_swarm_review)
Ensure-FlowStateField -State $State -Name "effective_swarm_review_depth" -Value ([string]$State.effective_swarm_review_depth)
Ensure-FlowStateField -State $State -Name "swarm_review_focus" -Value ([string]$State.swarm_review_focus)
Ensure-FlowStateField -State $State -Name "review_controls_source" -Value ([string]$State.review_controls_source)
Ensure-FlowStateField -State $State -Name "contract_risk_paths" -Value @(@($State.contract_risk_paths))
Ensure-FlowStateField -State $State -Name "review_profile" -Value $ReviewProfile
Ensure-FlowStateField -State $State -Name "project_review_context" -Value $ProjectReviewContext
Ensure-FlowStateField -State $State -Name "review_focus" -Value $ReviewFocus
Ensure-FlowStateField -State $State -Name "review_lanes" -Value @($ReviewLanes)
Ensure-FlowStateField -State $State -Name "lane_selection_reason" -Value ""
Ensure-FlowStateField -State $State -Name "model_profile" -Value $ModelProfile
Ensure-FlowStateField -State $State -Name "expanded_review_approved" -Value ([bool]$ExpandedReviewApproved)
Ensure-FlowStateField -State $State -Name "owner_approval_record" -Value $OwnerApprovalRecord
Ensure-FlowStateField -State $State -Name "owner_approval_cost_envelope" -Value $OwnerApprovalCostEnvelope
Ensure-FlowStateField -State $State -Name "review_registry_path" -Value $ReviewRegistryPath
Ensure-FlowStateField -State $State -Name "review_registry_sha256" -Value ""
Ensure-FlowStateField -State $State -Name "review_registry_version" -Value 0
Ensure-FlowStateField -State $State -Name "owner_approval_sha256" -Value ""
Ensure-FlowStateField -State $State -Name "owner_approval_version" -Value 0
Ensure-FlowStateField -State $State -Name "owner_approval_identity" -Value ""
Ensure-FlowStateField -State $State -Name "requested_swarm_review_depth" -Value $SwarmReviewDepth
Ensure-FlowStateField -State $State -Name "model_routing_policy_version" -Value 3
Ensure-FlowStateField -State $State -Name "luna_retry_limit" -Value 1
Ensure-FlowStateField -State $State -Name "meta_model" -Value $MetaModel
Ensure-FlowStateField -State $State -Name "swarm_message_model" -Value $SwarmMessageModel
Ensure-FlowStateField -State $State -Name "track_baseline_identity_before_step_review_utan" -Value ""
Ensure-FlowStateField -State $State -Name "meta_baseline_message_id_before_step_review" -Value ""
Ensure-FlowStateField -State $State -Name "swarm_baseline_message_id_before_prompt" -Value ""
Ensure-FlowStateField -State $State -Name "swarm_dispatch_intent_path" -Value ""
Ensure-FlowStateField -State $State -Name "meta_baseline_message_id_before_swarm_review" -Value ""
Ensure-FlowStateField -State $State -Name "track_baseline_message_id_before_step_review_utan" -Value ""
Ensure-FlowStateField -State $State -Name "delivery_response_class" -Value ""
Ensure-FlowStateField -State $State -Name "delivery_response_sha256" -Value ""
Ensure-FlowStateField -State $State -Name "delivery_dispatch_binding" -Value ""
Ensure-FlowStateField -State $State -Name "delivery_dispatch_intent_path" -Value ""
Ensure-FlowStateField -State $State -Name "delivery_dispatch_returned_id" -Value ""
Ensure-FlowStateField -State $State -Name "delivery_receipt_path" -Value ""
Ensure-FlowStateField -State $State -Name "fal_checkpoint_operation_path" -Value ""
Ensure-FlowStateField -State $State -Name "fal_checkpoint_operation_sha256" -Value ""
Ensure-FlowStateField -State $State -Name "fal_checkpoint_identity" -Value $null
Ensure-FlowStateField -State $State -Name "fal_checkpoint_identity_sha256" -Value ""
Ensure-FlowStateField -State $State -Name "artifact_pins" -Value ([pscustomobject]@{})
Ensure-FlowStateField -State $State -Name "reviewed_candidate" -Value ""
Ensure-FlowStateField -State $State -Name "surfaced_finding_ids" -Value @()
Ensure-FlowStateField -State $State -Name "pinned_implementation_artifact_path" -Value ""
Ensure-FlowStateField -State $State -Name "pinned_implementation_artifact_sha256" -Value ""
Ensure-FlowStateField -State $State -Name "pinned_implementation_producer_message_id" -Value ""
Ensure-FlowStateField -State $State -Name "pinned_implementation_candidate" -Value ""
$script:State = $State

$TrackRole = Get-OCRouterRoleLabel $Track
if ([string]::IsNullOrWhiteSpace($TrackRole)) {
  throw "Unknown Track role label for '$Track'."
}
$EffectiveAccountableLaneId = if ([string]::IsNullOrWhiteSpace($AccountableLaneId)) { $TrackRole } else { $AccountableLaneId.Trim() }
$EffectiveAccountableLaneProfile = if ([string]::IsNullOrWhiteSpace($AccountableLaneProfile)) { $Track } else { $AccountableLaneProfile.Trim() }
$EffectiveAccountableLaneClass = $AccountableLaneClass.Trim().ToUpperInvariant()

$ResolvedFalTargetRepoPath = ''
$ResolvedFalTargetWorktreePath = ''
$ResolvedFalControlRoot = ''
$ResolvedFalTargetRepoKind = ''
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
}
$LaneContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  accountable_lane = $EffectiveAccountableLaneId
  lane_class = $EffectiveAccountableLaneClass
  lane_profile = $EffectiveAccountableLaneProfile
}
$PinnedImplementationHandoff = $null
if (-not [string]::IsNullOrWhiteSpace($PinnedImplementationArtifactPath) -or
    -not [string]::IsNullOrWhiteSpace($PinnedImplementationArtifactSha256) -or
    -not [string]::IsNullOrWhiteSpace($PinnedImplementationProducerMessageId) -or
    -not [string]::IsNullOrWhiteSpace($PinnedImplementationCandidate)) {
  $PinnedImplementationHandoff = Resolve-FlowPinnedImplementationHandoff `
    -ArtifactPath $PinnedImplementationArtifactPath `
    -ArtifactSha256 $PinnedImplementationArtifactSha256 `
    -ProducerMessageId $PinnedImplementationProducerMessageId `
    -Candidate $PinnedImplementationCandidate `
    -ExpectedContext $LaneContext
}
$TrackEntry = Get-OCRouterSessionEntry -Config $Config -Name $Track
$MetaEntry = Get-OCRouterSessionEntry -Config $Config -Name $Meta
$Server = $Config.server.TrimEnd("/")
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password

$TrackReadUri = "$Server/session/$($TrackEntry.sessionId)/message?limit=$Limit"
$MetaReadUri = "$Server/session/$($MetaEntry.sessionId)/message?limit=$Limit"

Write-Host "=== OC Session Router Full Step Review Flow ===" -ForegroundColor Cyan
Write-Host "Run ID:          $RunId"
Write-Host "Run dir:         $RunDir"
Write-Host "Mode:            $(if ($Resume) { 'resume' } else { 'new' })"
Write-Host "Track:           $Track -> $($TrackEntry.title)"
Write-Host "Meta:            $Meta -> $($MetaEntry.title)"
Write-Host "Review transport: native Meta Task fan-out (no Swarm session)"
Write-Host "Target:          $Target"
Write-Host "Epic:            $Epic"
Write-Host "AutoApprove:     $AutoApprove"
Write-Host "Review cycle:    $ReviewCycleIndex"
Write-Host "Model profile:   $ModelProfile"
Write-Host "Meta model:      $MetaModel"
Write-Host "Poll seconds:    $PollSeconds"
Write-Host "Timeout:         $TimeoutMinutes minutes"
Write-Host ""

$TrackImplementationText = ""
if (Test-FlowStepCompleted -State $State -StepName "track_output_selected") {
  $TrackImplementationText = Get-FlowArtifactText -RunDir $RunDir -Name "01-track-implementation.md" -Required
  Write-Host "Resume: using saved Track implementation output." -ForegroundColor Cyan
}
else {
  $ImplementationSource = Select-FlowImplementationSource `
    -PinnedHandoff $PinnedImplementationHandoff `
    -LatestCandidateResolver {
      Get-FlowLatestCandidate `
        -Uri $TrackReadUri `
        -Headers $Headers `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -ExpectedOutputKind 'track_implementation_report' `
        -ExpectedOutputContext $LaneContext
    }
  if ([string]$ImplementationSource.source -ceq 'pinned_handoff') {
    $State.track_selected_output_identity = [string]$ImplementationSource.candidate_identity
    $TrackImplementationText = [string]$ImplementationSource.text
    $PinnedChildPath = Join-Path $RunDir '01-track-implementation.md'
    Copy-Item -LiteralPath ([string]$PinnedImplementationHandoff.path) -Destination $PinnedChildPath -Force
    $PinnedChildPin = New-OCRouterArtifactPin -Path $PinnedChildPath -ProducerMessageId ([string]$ImplementationSource.message_id) -Stage 'pinned_fix_implementation' -CandidateIdentity ([string]$ImplementationSource.candidate_identity) -ExpectedOutputKind 'track_implementation_report'
    $State.artifact_pins | Add-Member -NotePropertyName '01-track-implementation.md' -NotePropertyValue $PinnedChildPin -Force
    Write-Host "Using exact pinned implementation handoff; session-latest selection is disabled for this run." -ForegroundColor Cyan
  }
  else {
    $TrackCandidate = $ImplementationSource.candidate
    if ($null -eq $TrackCandidate) {
      throw "No implementation output candidate matching expected output kind 'track_implementation_report' found in '$Track'."
    }

    Write-OCRouterSelectedCandidateSummary -Candidate $TrackCandidate
    Write-Host "Track implementation output preview:" -ForegroundColor Yellow
    Write-OCRouterTextPreview -Text $TrackCandidate.Text
    if ($AutoApprove) {
      Write-Host "AutoApprove active. Using current Track implementation output without local prompt." -ForegroundColor Yellow
    }
    else {
      $Answer = Read-Host "Use this Track implementation output for /step-review? [y/N]"
      if ($Answer -ne "y" -and $Answer -ne "Y") {
        throw "Track implementation output declined."
      }
    }

    $State.track_selected_output_identity = [string]$ImplementationSource.candidate_identity
    $TrackImplementationText = [string]$ImplementationSource.text
    Save-FlowArtifact `
      -RunDir $RunDir `
      -Name "01-track-implementation.md" `
      -Text $TrackImplementationText `
      -ProducerMessageId ([string]$ImplementationSource.message_id) `
      -Stage 'track_implementation' `
      -CandidateIdentity ([string]$State.track_selected_output_identity) `
      -ExpectedOutputKind 'track_implementation_report' | Out-Null
  }
  Add-FlowCompletedStep -State $State -StepName "track_output_selected"
  Save-FlowState -RunDir $RunDir -State $State
}

if ($null -ne $PinnedImplementationHandoff) {
  $PinnedChildArtifact = $State.artifact_pins.'01-track-implementation.md'
  Assert-OCRouterArtifactPin -Pin $PinnedChildArtifact | Out-Null
  if ([string]$PinnedChildArtifact.sha256 -cne [string]$PinnedImplementationHandoff.sha256 -or
      [string]$PinnedChildArtifact.producer_message_id -cne [string]$PinnedImplementationHandoff.producer_message_id -or
      [string]$PinnedChildArtifact.candidate_identity -cne [string]$PinnedImplementationHandoff.candidate_identity) {
    throw 'Saved child implementation artifact no longer matches the exact pinned parent handoff.'
  }
}

if (-not (Test-OCRouterExpectedOutputKind -Text $TrackImplementationText -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $LaneContext)) {
  throw 'Pinned implementation artifact no longer matches Target/Epic/Accountable Lane bindings.'
}
$ReviewedCandidate = Get-OCRouterTopLevelFieldValue -Text $TrackImplementationText -Field 'Candidate identity/worktree limitations'
if ([string]::IsNullOrWhiteSpace($ReviewedCandidate)) { throw 'Pinned implementation artifact lacks Candidate identity/worktree limitations.' }
if (-not [string]::IsNullOrWhiteSpace([string]$State.reviewed_candidate) -and [string]$State.reviewed_candidate -cne $ReviewedCandidate) {
  throw 'Reviewed candidate binding drift on resume.'
}
$State.reviewed_candidate = $ReviewedCandidate
$LaneContext | Add-Member -NotePropertyName candidate -NotePropertyValue $ReviewedCandidate -Force
Save-FlowState -RunDir $RunDir -State $State

$ReviewControls = $null
$HadResolvedReviewControls = Test-FlowStepCompleted -State $State -StepName "review_controls_resolved"
$ApprovalCandidateIdentity = Get-OCRouterTopLevelFieldValue -Text $TrackImplementationText -Field 'Candidate identity/worktree limitations'
$ApprovalEpic = Get-OCRouterTopLevelFieldValue -Text $TrackImplementationText -Field 'Epic'
if ($ApprovalEpic -cne $Epic -or $ApprovalCandidateIdentity -cne $ReviewedCandidate) { throw 'Implementation approval Target/Epic/candidate bindings drifted.' }
$ReviewControls = Resolve-OCRouterReviewControls `
  -ReviewCycleIndex $ReviewCycleIndex `
  -RequestedMetaInternalLanes $(if ($HadResolvedReviewControls) { [int]$State.effective_meta_internal_lanes } else { $MetaInternalLanes }) `
  -ExplicitMetaInternalLanes ($HadResolvedReviewControls -or $PSBoundParameters.ContainsKey("MetaInternalLanes")) `
  -ExplicitSkipSwarmReview $(if ($HadResolvedReviewControls) { [bool]$State.effective_skip_swarm_review } else { $PSBoundParameters.ContainsKey("SkipSwarmReview") }) `
  -ExplicitUseSwarmReview $(if ($HadResolvedReviewControls) { -not [bool]$State.effective_skip_swarm_review } else { $PSBoundParameters.ContainsKey("UseSwarmReview") }) `
  -ForceFullReview:$ForceFullReview `
  -ReviewProfile $(if ($HadResolvedReviewControls) { [string]$State.review_profile } else { $ReviewProfile }) `
  -ExplicitReviewProfile ($HadResolvedReviewControls -or $PSBoundParameters.ContainsKey("ReviewProfile")) `
  -ProjectReviewContext $(if ($HadResolvedReviewControls) { [string]$State.project_review_context } else { $ProjectReviewContext }) `
  -ReviewFocus $ReviewFocus `
  -RequestedReviewLanes $(if ($HadResolvedReviewControls) { @($State.review_lanes) } else { $ReviewLanes }) `
  -ExplicitReviewLanes ($HadResolvedReviewControls -or $PSBoundParameters.ContainsKey("ReviewLanes")) `
  -ExpandedReviewApproved ([bool]$ExpandedReviewApproved) `
  -OwnerApprovalRecord $OwnerApprovalRecord `
  -ReviewRegistryPath $ReviewRegistryPath `
  -RequestedSwarmReviewDepth $SwarmReviewDepth `
  -ApprovalTarget $Target `
  -ApprovalEpic $ApprovalEpic `
  -ApprovalCandidate $ApprovalCandidateIdentity `
  -ApprovalCostEnvelope $OwnerApprovalCostEnvelope `
  -ImplementationTexts @($TrackImplementationText)

if ($HadResolvedReviewControls) {
  foreach ($Pin in @(
    @{ Name = 'review registry path'; Saved = [string]$State.review_registry_path; Current = [string]$ReviewControls.review_registry_path },
    @{ Name = 'review registry hash'; Saved = [string]$State.review_registry_sha256; Current = [string]$ReviewControls.review_registry_sha256 },
    @{ Name = 'review registry version'; Saved = [string]$State.review_registry_version; Current = [string]$ReviewControls.review_registry_version },
    @{ Name = 'owner approval path'; Saved = [string]$State.owner_approval_record; Current = [string]$ReviewControls.owner_approval_record },
    @{ Name = 'owner approval hash'; Saved = [string]$State.owner_approval_sha256; Current = [string]$ReviewControls.owner_approval_sha256 },
    @{ Name = 'owner approval identity'; Saved = [string]$State.owner_approval_identity; Current = [string]$ReviewControls.owner_approval_identity },
    @{ Name = 'review profile'; Saved = [string]$State.review_profile; Current = [string]$ReviewControls.review_profile },
    @{ Name = 'review lanes'; Saved = (@($State.review_lanes) -join ','); Current = (@($ReviewControls.review_lanes) -join ',') }
  )) {
    if ($Pin.Saved -cne $Pin.Current) { throw "Resume review-control drift for $($Pin.Name): saved '$($Pin.Saved)', current '$($Pin.Current)'." }
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
if (-not $HadResolvedReviewControls) { Add-FlowCompletedStep -State $State -StepName "review_controls_resolved" }
Save-FlowState -RunDir $RunDir -State $State

$EffectiveSwarmReviewDepth = "none"
$State.effective_swarm_review_depth = "none"
$State.swarm_review_focus = ""
Save-FlowState -RunDir $RunDir -State $State

Write-Host "Effective review controls:" -ForegroundColor Cyan
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

$TargetCorrelationPattern = Get-FlowTargetCorrelationPattern -Target $Target
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
$ImplementationPin = $State.artifact_pins.'01-track-implementation.md'
Assert-OCRouterArtifactPin -Pin $ImplementationPin | Out-Null
$EvidencePointers = "{0}#{1}" -f [string]$ImplementationPin.path, [string]$ImplementationPin.sha256
$ReviewedScopeAcceptance = Get-OCRouterTopLevelFieldValue -Text $TrackImplementationText -Field 'Acceptance mapping'
$PacketReviewFocus = if ([string]::IsNullOrWhiteSpace([string]$ReviewControls.review_focus)) { 'NONE' } else { [string]$ReviewControls.review_focus }
$PacketInternalLanes = if (@($ReviewControls.requested_domains).Count -eq 0) { 'NONE' } else { @($ReviewControls.requested_domains) -join ',' }
$PacketCostEnvelope = if ([string]::IsNullOrWhiteSpace([string]$ReviewControls.owner_approval_cost_envelope)) { 'bounded-default' } else { [string]$ReviewControls.owner_approval_cost_envelope }
$PacketApprovalReceipt = if ([string]::IsNullOrWhiteSpace([string]$ReviewControls.owner_approval_record)) { 'NONE' } else { "{0}#{1}" -f [string]$ReviewControls.owner_approval_record, [string]$ReviewControls.owner_approval_sha256 }
$Phase1Context = [pscustomobject]@{
  target = $Target
  epic = $Epic
  candidate = $ReviewedCandidate
  evidence_pointers = $EvidencePointers
  reviewed_scope_acceptance = $ReviewedScopeAcceptance
  review_focus = $PacketReviewFocus
  review_profile = [string]$ReviewControls.review_profile
  requested_domains = $PacketInternalLanes
  budget_policy = [string]$ReviewControls.budget_policy
  assignment_cap = [int]$ReviewControls.assignment_cap
  cost_envelope = $PacketCostEnvelope
  expansion_approval_path = [string]$ReviewControls.owner_approval_record
  expansion_approval_sha256 = [string]$ReviewControls.owner_approval_sha256
}
$FinalContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  candidate = $ReviewedCandidate
  accountable_lane = $EffectiveAccountableLaneId
  lane_class = $EffectiveAccountableLaneClass
  lane_profile = $EffectiveAccountableLaneProfile
}
$RequiredPhase1Bindings = @(
  'REQUIRED NATIVE REVIEW BINDINGS',
  "Target: $Target", "Epic: $Epic", "Candidate: $ReviewedCandidate", "Evidence pointers: $EvidencePointers",
  "Reviewed scope/acceptance: $ReviewedScopeAcceptance", "Review focus: $PacketReviewFocus",
  "Review transport: native", "Budget policy: $([string]$ReviewControls.budget_policy)",
  "Assignment cap: $([int]$ReviewControls.assignment_cap)", "Requested domains: $PacketInternalLanes",
  "Legacy shape alias: $([string]$ReviewControls.review_profile)",
  "Cost envelope: $PacketCostEnvelope", "Expansion approval receipt: $PacketApprovalReceipt"
) -join "`n"
$StepReviewArguments = "$ReviewControlPrefix`n`n$RequiredPhase1Bindings`n`n$TrackImplementationText"
$ExpectedInitialMetaOutputKind = 'meta_final_synthesis'

if (Test-FlowStepCompleted -State $State -StepName "sent_step_review_to_meta") {
  Write-Host "Resume: skipping already-sent Meta /step-review." -ForegroundColor Cyan
}
else {
  $MetaBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $State.meta_baseline_message_id_before_step_review = [string]$MetaBaseline.MessageId
  $State.meta_baseline_identity_before_step_review = "id:$($MetaBaseline.MessageId)"
  Save-FlowState -RunDir $RunDir -State $State
  Invoke-FlowCommand -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Command "step-review" -Arguments $StepReviewArguments -PreviewTitle "Track implementation -> Meta /step-review" -Model $MetaModel -RunDir $RunDir -Transition 'dispatch-step-review' -BaselineIdentity ([string]$State.meta_baseline_identity_before_step_review) -CandidateIdentity ([string]$State.track_selected_output_identity) -Stage 'step_review_dispatch' -AutoApprove:$AutoApprove
  Add-FlowCompletedStep -State $State -StepName "sent_step_review_to_meta"
  Save-FlowState -RunDir $RunDir -State $State
}

$FinalSynthesis = ""
if ([bool]$ReviewControls.skip_swarm_review) {
  Write-Host "Waiting for the Meta-owned native FINAL STEP REVIEW SYNTHESIS." -ForegroundColor Cyan

  if (Test-FlowStepCompleted -State $State -StepName "meta_final_received") {
    $FinalSynthesis = Get-FlowArtifactText -RunDir $RunDir -Name "05-meta-final-synthesis.md" -Required
    Write-Host "Resume: using saved Meta final synthesis." -ForegroundColor Cyan
  }
  else {
    if ($Resume -and (Test-FlowStepCompleted -State $State -StepName "sent_step_review_to_meta")) {
      $MetaFinalCandidate = Resolve-FlowOutputOnResume `
        -Label "Meta FINAL STEP REVIEW SYNTHESIS" `
        -Uri $MetaReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.meta_baseline_identity_before_step_review) `
        -BaselineMessageId ([string]$State.meta_baseline_message_id_before_step_review) `
        -BaselineStateField "meta_baseline_identity_before_step_review" `
        -State $State `
        -RunDir $RunDir `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts $IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'meta_final_synthesis' `
        -ExpectedOutputContext $FinalContext `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }
    else {
      $MetaFinalCandidate = Wait-FlowNewOutput `
        -Label "Meta FINAL STEP REVIEW SYNTHESIS" `
        -Uri $MetaReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.meta_baseline_identity_before_step_review) `
        -BaselineMessageId ([string]$State.meta_baseline_message_id_before_step_review) `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'meta_final_synthesis' `
        -ExpectedOutputContext $FinalContext `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }

    $FinalSynthesis = Get-OCRouterFinalStepReviewSynthesis -Text $MetaFinalCandidate.Text
    $MetaFinalIdentity = Get-FlowCandidateIdentity -Candidate $MetaFinalCandidate
    Save-FlowArtifact `
      -RunDir $RunDir `
      -Name "05-meta-final-synthesis.md" `
      -Text $FinalSynthesis `
      -ProducerMessageId ([string]$MetaFinalCandidate.MessageId) `
      -Stage 'meta_final_synthesis' `
      -CandidateIdentity $MetaFinalIdentity `
      -ExpectedOutputKind 'meta_final_synthesis' | Out-Null
    Add-FlowCompletedStep -State $State -StepName "meta_final_received"
    Save-FlowState -RunDir $RunDir -State $State
  }
}
else {
  $MetaPhase1Text = ""
  if (Test-FlowStepCompleted -State $State -StepName "meta_phase1_received") {
    $MetaPhase1Text = Get-FlowArtifactText -RunDir $RunDir -Name "02-meta-phase1.md" -Required
    Write-Host "Resume: using saved Meta phase 1 output." -ForegroundColor Cyan
  }
  else {
    if ($Resume -and (Test-FlowStepCompleted -State $State -StepName "sent_step_review_to_meta")) {
      $MetaPhase1Candidate = Resolve-FlowOutputOnResume `
        -Label "Meta step-review phase 1 output" `
        -Uri $MetaReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.meta_baseline_identity_before_step_review) `
        -BaselineMessageId ([string]$State.meta_baseline_message_id_before_step_review) `
        -BaselineStateField "meta_baseline_identity_before_step_review" `
        -State $State `
        -RunDir $RunDir `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts $IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'meta_step_review_phase1' `
        -ExpectedOutputContext $Phase1Context `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }
    else {
      $MetaPhase1Candidate = Wait-FlowNewOutput `
        -Label "Meta step-review phase 1 output" `
        -Uri $MetaReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.meta_baseline_identity_before_step_review) `
        -BaselineMessageId ([string]$State.meta_baseline_message_id_before_step_review) `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'meta_step_review_phase1' `
        -ExpectedOutputContext $Phase1Context `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }

    $MetaPhase1Text = $MetaPhase1Candidate.Text
    $MetaPhase1Identity = Get-FlowCandidateIdentity -Candidate $MetaPhase1Candidate
    Save-FlowArtifact `
      -RunDir $RunDir `
      -Name "02-meta-phase1.md" `
      -Text $MetaPhase1Text `
      -ProducerMessageId ([string]$MetaPhase1Candidate.MessageId) `
      -Stage 'meta_step_review_phase1' `
      -CandidateIdentity $MetaPhase1Identity `
      -ExpectedOutputKind 'meta_step_review_phase1' | Out-Null
    Add-FlowCompletedStep -State $State -StepName "meta_phase1_received"
    Save-FlowState -RunDir $RunDir -State $State
  }

  if (-not (Test-OCRouterStrictStepReviewPhase1Output -Text $MetaPhase1Text -Context $Phase1Context)) {
    throw "Meta phase 1 output is not the canonical SWARM ASSISTANT PROMPT ... WAITING FOR GO artifact. Refusing to persist or dispatch it."
  }

  $SwarmPrompt = Get-FlowArtifactText -RunDir $RunDir -Name "03-swarm-prompt.md"
  if ([string]::IsNullOrWhiteSpace($SwarmPrompt)) {
    $SwarmPrompt = Get-OCRouterSwarmReviewPacket -Text $MetaPhase1Text
    if ([string]::IsNullOrWhiteSpace($SwarmPrompt)) {
      throw "Could not extract the canonical nonempty /swarm-review packet from Meta phase 1 output."
    }
    if (-not (Test-OCRouterSwarmReviewPacketOutput -Text $SwarmPrompt -Context $Phase1Context)) {
      throw 'Extracted Swarm packet drifted from the pinned Target/Epic/candidate/review-control bindings.'
    }
    $MetaPhase1Pin = $State.artifact_pins.'02-meta-phase1.md'
    Assert-OCRouterArtifactPin -Pin $MetaPhase1Pin | Out-Null
    Save-FlowArtifact `
      -RunDir $RunDir `
      -Name "03-swarm-prompt.md" `
      -Text $SwarmPrompt `
      -ProducerMessageId ([string]$MetaPhase1Pin.producer_message_id) `
      -Stage 'swarm_review_packet' `
      -CandidateIdentity ([string]$MetaPhase1Pin.candidate_identity) `
      -ExpectedOutputKind 'swarm_review_packet' | Out-Null
  }
  if (-not (Test-OCRouterSwarmReviewPacketOutput -Text $SwarmPrompt -Context $Phase1Context)) {
    throw 'Pinned Swarm packet no longer matches the frozen Phase-1 bindings.'
  }
  Write-Host "Extracted Swarm Assistant prompt:" -ForegroundColor Yellow
  Write-OCRouterTextPreview -Text $SwarmPrompt

  if (Test-FlowStepCompleted -State $State -StepName "sent_prompt_to_swarm_assistant") {
    Write-Host "Resume: skipping already-sent Swarm Assistant prompt." -ForegroundColor Cyan
  }
  else {
    Write-Host "Dispatching Swarm prompt and Meta GO back-to-back; not waiting for Swarm output before GO." -ForegroundColor Cyan
    $SwarmBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $SwarmReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $State.swarm_baseline_message_id_before_prompt = [string]$SwarmBaseline.MessageId
    $State.swarm_baseline_identity_before_prompt = "id:$($SwarmBaseline.MessageId)"
    Save-FlowState -RunDir $RunDir -State $State
    Invoke-FlowCommand `
      -LogicalName $SwarmAssistant `
      -Entry $SwarmEntry `
      -Server $Server `
      -Headers $Headers `
      -Command "swarm-review" `
      -Arguments $SwarmPrompt `
      -PreviewTitle "Meta SWARM ASSISTANT PROMPT -> Swarm Assistant /swarm-review" `
      -Model $SwarmMessageModel `
      -RunDir $RunDir `
      -Transition 'dispatch-swarm-review' `
      -BaselineIdentity ([string]$State.swarm_baseline_identity_before_prompt) `
      -CandidateIdentity ([string]$State.track_selected_output_identity) `
      -Stage 'swarm_review_dispatch' `
      -AutoApprove:$AutoApprove
    $State.swarm_dispatch_intent_path = Join-Path (Join-Path $RunDir 'dispatch-intents') 'dispatch-swarm-review.json'
    Add-FlowCompletedStep -State $State -StepName "sent_prompt_to_swarm_assistant"
    Save-FlowState -RunDir $RunDir -State $State
  }

  if ([string]::IsNullOrWhiteSpace([string]$State.swarm_dispatch_intent_path) -and (Test-FlowStepCompleted -State $State -StepName 'sent_prompt_to_swarm_assistant')) {
    $State.swarm_dispatch_intent_path = Join-Path (Join-Path $RunDir 'dispatch-intents') 'dispatch-swarm-review.json'
    Save-FlowState -RunDir $RunDir -State $State
  }
  if ([string]::IsNullOrWhiteSpace([string]$State.swarm_dispatch_intent_path) -or -not (Test-Path -LiteralPath ([string]$State.swarm_dispatch_intent_path) -PathType Leaf)) {
    throw 'GO is forbidden until the exact Swarm packet has a durable dispatch intent.'
  }
  $SwarmDispatchIntent = Get-Content -LiteralPath ([string]$State.swarm_dispatch_intent_path) -Raw | ConvertFrom-Json
  if ([string]$SwarmDispatchIntent.status -cne 'dispatched' -or [string]$SwarmDispatchIntent.operation -cne 'swarm-review') {
    throw 'GO is forbidden because Swarm packet delivery is not proven dispatched.'
  }

  if (Test-FlowStepCompleted -State $State -StepName "sent_go_to_meta") {
    Write-Host "Resume: skipping already-sent GO to Meta." -ForegroundColor Cyan
  }
  else {
    $MetaGoBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $MetaGoBaselineIdentity = "id:$($MetaGoBaseline.MessageId)"
    Send-FlowMessage -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Text "GO" -PreviewTitle "Send GO to Meta immediately after Swarm prompt dispatch" -Model $MetaModel -RunDir $RunDir -Transition 'send-go-to-meta' -BaselineIdentity $MetaGoBaselineIdentity -CandidateIdentity ([string]$State.track_selected_output_identity) -Stage 'meta_go_control' -AutoApprove:$AutoApprove
    Add-FlowCompletedStep -State $State -StepName "sent_go_to_meta"
    Save-FlowState -RunDir $RunDir -State $State
  }

  $SwarmReviewText = ""
  $SwarmOutputContext = [pscustomobject]@{
    target = $Target
    epic = $Epic
    candidate = $ReviewedCandidate
    reviewed_scope = $ReviewedScopeAcceptance
  }
  if (Test-FlowStepCompleted -State $State -StepName "swarm_review_received") {
    $SwarmReviewText = Get-FlowArtifactText -RunDir $RunDir -Name "04-swarm-review.md" -Required
    Write-Host "Resume: using saved Swarm review output." -ForegroundColor Cyan
  }
  else {
    if ($Resume -and (Test-FlowStepCompleted -State $State -StepName "sent_prompt_to_swarm_assistant")) {
      $SwarmReviewCandidate = Resolve-FlowOutputOnResume `
        -Label "Swarm Assistant review output" `
        -Uri $SwarmReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.swarm_baseline_identity_before_prompt) `
        -BaselineMessageId ([string]$State.swarm_baseline_message_id_before_prompt) `
        -BaselineStateField "swarm_baseline_identity_before_prompt" `
        -State $State `
        -RunDir $RunDir `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts $IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'swarm_review' `
        -ExpectedOutputContext $SwarmOutputContext `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }
    else {
      $SwarmReviewCandidate = Wait-FlowNewOutput `
        -Label "Swarm Assistant review output" `
        -Uri $SwarmReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.swarm_baseline_identity_before_prompt) `
        -BaselineMessageId ([string]$State.swarm_baseline_message_id_before_prompt) `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'swarm_review' `
        -ExpectedOutputContext $SwarmOutputContext `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }

    $SwarmReviewText = $SwarmReviewCandidate.Text
    $SwarmReviewIdentity = Get-FlowCandidateIdentity -Candidate $SwarmReviewCandidate
    Save-FlowArtifact `
      -RunDir $RunDir `
      -Name "04-swarm-review.md" `
      -Text $SwarmReviewText `
      -ProducerMessageId ([string]$SwarmReviewCandidate.MessageId) `
      -Stage 'swarm_review_result' `
      -CandidateIdentity $SwarmReviewIdentity `
      -ExpectedOutputKind 'swarm_review' | Out-Null
    Add-FlowCompletedStep -State $State -StepName "swarm_review_received"
    Save-FlowState -RunDir $RunDir -State $State
  }

  if (-not (Test-OCRouterStrictSwarmReviewOutput -Text $SwarmReviewText -Context $SwarmOutputContext)) {
    throw 'Pinned Swarm result no longer matches the dispatched Target/Epic/candidate/scope packet.'
  }
  $SurfacedIds = @(Get-OCRouterSwarmFindingIds -Text $SwarmReviewText)
  if (@($State.surfaced_finding_ids).Count -gt 0 -and ((@($State.surfaced_finding_ids | Sort-Object) -join "`n") -cne (@($SurfacedIds | Sort-Object) -join "`n"))) {
    throw 'Surfaced Swarm finding IDs drifted on resume.'
  }
  $State.surfaced_finding_ids = @($SurfacedIds)
  $FinalContext | Add-Member -NotePropertyName surfaced_finding_ids -NotePropertyValue @($SurfacedIds) -Force
  Save-FlowState -RunDir $RunDir -State $State

  if (Test-FlowStepCompleted -State $State -StepName "sent_swarm_review_to_meta") {
    Write-Host "Resume: skipping already-sent Swarm review to Meta." -ForegroundColor Cyan
  }
  else {
    $MetaBeforeSwarmOutput = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $MetaReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $State.meta_baseline_message_id_before_swarm_review = [string]$MetaBeforeSwarmOutput.MessageId
    $State.meta_baseline_identity_before_swarm_review = "id:$($MetaBeforeSwarmOutput.MessageId)"
    Save-FlowState -RunDir $RunDir -State $State
    Send-FlowMessage -LogicalName $Meta -Entry $MetaEntry -Server $Server -Headers $Headers -Text $SwarmReviewText -PreviewTitle "Swarm Assistant review -> Meta plain evidence return" -Model $MetaModel -RunDir $RunDir -Transition 'return-swarm-evidence-to-meta' -BaselineIdentity ([string]$State.meta_baseline_identity_before_swarm_review) -CandidateIdentity ([string]$State.track_selected_output_identity) -Stage 'swarm_evidence_return' -AutoApprove:$AutoApprove
    Add-FlowCompletedStep -State $State -StepName "sent_swarm_review_to_meta"
    Save-FlowState -RunDir $RunDir -State $State
  }

  if (Test-FlowStepCompleted -State $State -StepName "meta_final_received") {
    $FinalSynthesis = Get-FlowArtifactText -RunDir $RunDir -Name "05-meta-final-synthesis.md" -Required
    Write-Host "Resume: using saved Meta final synthesis." -ForegroundColor Cyan
  }
  else {
    if ($Resume -and (Test-FlowStepCompleted -State $State -StepName "sent_swarm_review_to_meta")) {
      $MetaFinalCandidate = Resolve-FlowOutputOnResume `
        -Label "Meta FINAL STEP REVIEW SYNTHESIS" `
        -Uri $MetaReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.meta_baseline_identity_before_swarm_review) `
        -BaselineMessageId ([string]$State.meta_baseline_message_id_before_swarm_review) `
        -BaselineStateField "meta_baseline_identity_before_swarm_review" `
        -State $State `
        -RunDir $RunDir `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts $IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'meta_final_synthesis' `
        -ExpectedOutputContext $FinalContext `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }
    else {
      $MetaFinalCandidate = Wait-FlowNewOutput `
        -Label "Meta FINAL STEP REVIEW SYNTHESIS" `
        -Uri $MetaReadUri `
        -Headers $Headers `
        -BaselineIdentity ([string]$State.meta_baseline_identity_before_swarm_review) `
        -BaselineMessageId ([string]$State.meta_baseline_message_id_before_swarm_review) `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -CandidateCount $CandidateCount `
        -PollSeconds $PollSeconds `
        -TimeoutMinutes $TimeoutMinutes `
        -StablePolls $StablePolls `
        -MinOutputChars $MinOutputChars `
        -ExpectedOutputKind 'meta_final_synthesis' `
        -ExpectedOutputContext $FinalContext `
        -ExpectedTextPattern $TargetCorrelationPattern `
        -AutoUseFirstStable:$AutoUseFirstStable
    }

    $FinalSynthesis = Get-OCRouterFinalStepReviewSynthesis -Text $MetaFinalCandidate.Text
    $MetaFinalIdentity = Get-FlowCandidateIdentity -Candidate $MetaFinalCandidate
    Save-FlowArtifact `
      -RunDir $RunDir `
      -Name "05-meta-final-synthesis.md" `
      -Text $FinalSynthesis `
      -ProducerMessageId ([string]$MetaFinalCandidate.MessageId) `
      -Stage 'meta_final_synthesis' `
      -CandidateIdentity $MetaFinalIdentity `
      -ExpectedOutputKind 'meta_final_synthesis' | Out-Null
    Add-FlowCompletedStep -State $State -StepName "meta_final_received"
    Save-FlowState -RunDir $RunDir -State $State
  }
}

if (-not (Test-OCRouterExpectedOutputKind -Text $FinalSynthesis -ExpectedOutputKind 'meta_final_synthesis' -ExpectedOutputContext $FinalContext)) {
  throw 'Pinned final synthesis does not match frozen Target/Epic/candidate/lane/finding bindings.'
}
$CloseoutDisposition = Get-OCRouterFinalSynthesisDisposition -Text $FinalSynthesis
$DeliveryContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  candidate = $ReviewedCandidate
  accountable_lane = $EffectiveAccountableLaneId
  lane_class = $EffectiveAccountableLaneClass
  lane_profile = $EffectiveAccountableLaneProfile
  closeout_disposition = $CloseoutDisposition
  accepted_finding_ids = @(Get-OCRouterFinalOpenFixFindingIds -Text $FinalSynthesis)
}

if (Test-FlowStepCompleted -State $State -StepName "sent_step_review_utan_to_track") {
  Write-Host "Resume: final synthesis already sent to Track." -ForegroundColor Green
}
else {
  $TrackResponseBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $TrackReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
  $State.track_baseline_message_id_before_step_review_utan = [string]$TrackResponseBaseline.MessageId
  $State.track_baseline_identity_before_step_review_utan = "id:$($TrackResponseBaseline.MessageId)"
  Save-FlowState -RunDir $RunDir -State $State
  $DeliveryDispatch = Invoke-FlowCommand -LogicalName $Track -Entry $TrackEntry -Server $Server -Headers $Headers -Command "step-review-utan" -Arguments $FinalSynthesis -PreviewTitle "Meta final synthesis -> Track /step-review-utan" -RunDir $RunDir -Transition 'dispatch-step-review-utan' -BaselineIdentity ([string]$State.track_baseline_identity_before_step_review_utan) -CandidateIdentity ([string]$State.track_selected_output_identity) -Stage 'delivery_response_dispatch' -AutoApprove:$AutoApprove
  $State.delivery_dispatch_intent_path = (Resolve-Path -LiteralPath (Join-Path $RunDir 'dispatch-intents\dispatch-step-review-utan.json')).Path
  $State.delivery_dispatch_returned_id = [string]$DeliveryDispatch.returned_id
  Add-FlowCompletedStep -State $State -StepName "sent_step_review_utan_to_track"
  Save-FlowState -RunDir $RunDir -State $State
}

$ExpectedDeliveryIntentPath = Join-Path $RunDir 'dispatch-intents\dispatch-step-review-utan.json'
if (-not (Test-Path -LiteralPath $ExpectedDeliveryIntentPath -PathType Leaf)) {
  throw "Delivery dispatch is marked sent but its durable intent is missing: $ExpectedDeliveryIntentPath"
}
$DeliveryIntentRecord = Get-Content -LiteralPath $ExpectedDeliveryIntentPath -Raw | ConvertFrom-Json
if ([string]$DeliveryIntentRecord.status -cne 'dispatched') {
  throw "Delivery dispatch intent is not completed; automatic resend/recovery is forbidden."
}
$State.delivery_dispatch_intent_path = (Resolve-Path -LiteralPath $ExpectedDeliveryIntentPath).Path
$State.delivery_dispatch_returned_id = [string]$DeliveryIntentRecord.returned_id
Save-FlowState -RunDir $RunDir -State $State

$DeliveryResponseText = ""
if (Test-FlowStepCompleted -State $State -StepName "delivery_response_received") {
  $DeliveryResponseText = Get-FlowArtifactText -RunDir $RunDir -Name "06-track-delivery-response.md" -Required
  if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $DeliveryResponseText -Context $DeliveryContext)) {
    throw "Saved Delivery response is malformed or ambiguous; refusing resume."
  }
  $SavedResponsePath = Join-Path $RunDir "06-track-delivery-response.md"
  $CurrentResponseHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $SavedResponsePath).Hash
  if ([string]$State.delivery_response_sha256 -cne $CurrentResponseHash) {
    throw "Saved Delivery response hash drift; refusing resume."
  }
}
else {
  $DeliveryResponseCandidate = if ($Resume) {
    Resolve-FlowOutputOnResume `
      -Label "Delivery /step-review-utan response" `
      -Uri $TrackReadUri `
      -Headers $Headers `
      -BaselineIdentity ([string]$State.track_baseline_identity_before_step_review_utan) `
      -BaselineMessageId ([string]$State.track_baseline_message_id_before_step_review_utan) `
      -BaselineStateField "track_baseline_identity_before_step_review_utan" `
      -State $State `
      -RunDir $RunDir `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts $IncludeReasoningParts `
      -CandidateCount $CandidateCount `
      -PollSeconds $PollSeconds `
      -TimeoutMinutes $TimeoutMinutes `
      -StablePolls $StablePolls `
      -MinOutputChars 1 `
      -ExpectedOutputKind 'delivery_step_response' `
      -ExpectedOutputContext $DeliveryContext `
      -ExpectedTextPattern "" `
      -AutoUseFirstStable:$AutoUseFirstStable
  }
  else {
    Wait-FlowNewOutput `
      -Label "Delivery /step-review-utan response" `
      -Uri $TrackReadUri `
      -Headers $Headers `
      -BaselineIdentity ([string]$State.track_baseline_identity_before_step_review_utan) `
      -BaselineMessageId ([string]$State.track_baseline_message_id_before_step_review_utan) `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts:$IncludeReasoningParts `
      -CandidateCount $CandidateCount `
      -PollSeconds $PollSeconds `
      -TimeoutMinutes $TimeoutMinutes `
      -StablePolls $StablePolls `
      -MinOutputChars 1 `
      -ExpectedOutputKind 'delivery_step_response' `
      -ExpectedOutputContext $DeliveryContext `
      -ExpectedTextPattern "" `
      -AutoUseFirstStable:$AutoUseFirstStable
  }
  $DeliveryResponseText = [string]$DeliveryResponseCandidate.Text
  if (-not (Test-OCRouterDeliveryStepResponseOutput -Text $DeliveryResponseText -Context $DeliveryContext)) {
    throw "Delivery response did not match exactly one Canon /step-review-utan response class."
  }
  $DeliveryResponseIdentity = Get-FlowCandidateIdentity -Candidate $DeliveryResponseCandidate
  Save-FlowArtifact `
    -RunDir $RunDir `
    -Name "06-track-delivery-response.md" `
    -Text $DeliveryResponseText `
    -ProducerMessageId ([string]$DeliveryResponseCandidate.MessageId) `
    -Stage 'delivery_step_response' `
    -CandidateIdentity $DeliveryResponseIdentity `
    -ExpectedOutputKind 'delivery_step_response' | Out-Null
  $State.delivery_response_class = Get-OCRouterModeFromText -Text $DeliveryResponseText
  $State.delivery_response_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $RunDir "06-track-delivery-response.md")).Hash
  $State.delivery_dispatch_binding = "$Track|$($State.track_baseline_identity_before_step_review_utan)|$((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $RunDir '05-meta-final-synthesis.md')).Hash)"
  Add-FlowCompletedStep -State $State -StepName "delivery_response_received"
  Save-FlowState -RunDir $RunDir -State $State
}

$DeliveryResponseClass = Get-OCRouterModeFromText -Text $DeliveryResponseText
if ($DeliveryResponseClass -notin @('ACK_ONLY', 'FIX_PLAN_REQUIRED', 'UNCLEAR')) {
  throw "Delivery response class is missing or ambiguous; no checkpoint or next route may be claimed."
}
$ExpectedDispatchBinding = "$Track|$($State.track_baseline_identity_before_step_review_utan)|$((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $RunDir '05-meta-final-synthesis.md')).Hash)"
if ([string]$State.delivery_dispatch_binding -cne $ExpectedDispatchBinding) {
  throw "Delivery dispatch/candidate binding drift; refusing checkpoint or next-route claim."
}
$FinalArtifactPath = Join-Path $RunDir "05-meta-final-synthesis.md"
$DeliveryResponseArtifactPath = Join-Path $RunDir "06-track-delivery-response.md"
$FinalArtifactPin = $State.artifact_pins.'05-meta-final-synthesis.md'
$DeliveryResponsePin = $State.artifact_pins.'06-track-delivery-response.md'
Assert-OCRouterArtifactPin -Pin $FinalArtifactPin | Out-Null
Assert-OCRouterArtifactPin -Pin $DeliveryResponsePin | Out-Null
$CheckpointIdentity = $null
$CheckpointStage = if ($ReviewCycleIndex -gt 0) { 'review_fix_delivery_response' } else { 'step_review_delivery_response' }
if ($FalSyncCheckpoint) {
  $IdentityArgs = @{
    TargetProjectId = $FalProjectId
    TargetRepoKind = $ResolvedFalTargetRepoKind
    TargetRepoRoot = $ResolvedFalTargetRepoPath
    TargetWorktree = $ResolvedFalTargetWorktreePath
    TargetHead = $FalTargetHead
    TargetRef = $FalTargetRef
    TargetStatus = $FalTargetStatus
    Wave = $Wave
    Epic = $Epic
    Stage = $CheckpointStage
    Candidate = [string]$State.reviewed_candidate
    AccountableLaneId = $EffectiveAccountableLaneId
    AccountableLaneClass = $EffectiveAccountableLaneClass
    AccountableLaneProfile = $EffectiveAccountableLaneProfile
    LogicalSender = $Meta
    LogicalRecipient = $Track
    SourceSession = $Meta
    ArtifactIdentity = [string]$FinalArtifactPin.candidate_identity
    ArtifactPath = $FinalArtifactPath
    ArtifactHash = [string]$FinalArtifactPin.sha256
    ArtifactProducer = [string]$FinalArtifactPin.producer_message_id
    ControlRoot = $ResolvedFalControlRoot
    SyncMode = 'dry_run'
  }
  $ExpectedCheckpointIdentity = New-OCRouterFalCheckpointIdentity @IdentityArgs
  $ExpectedCheckpointHash = Get-OCRouterFalCheckpointIdentityHash -Identity $ExpectedCheckpointIdentity
  if ($null -eq $State.fal_checkpoint_identity) {
    $State.fal_checkpoint_identity = $ExpectedCheckpointIdentity
    $State.fal_checkpoint_identity_sha256 = $ExpectedCheckpointHash
    Save-FlowState -RunDir $RunDir -State $State
  }
  else {
    Assert-OCRouterFalCheckpointIdentity -Identity $State.fal_checkpoint_identity | Out-Null
    $SavedCheckpointHash = Get-OCRouterFalCheckpointIdentityHash -Identity $State.fal_checkpoint_identity
    if ([string]$State.fal_checkpoint_identity_sha256 -cne $SavedCheckpointHash -or $SavedCheckpointHash -cne $ExpectedCheckpointHash) {
      throw 'Saved FAL checkpoint identity drifted from the current full target/repo/worktree/wave/epic/candidate/lane/artifact tuple.'
    }
  }
  $CheckpointIdentity = $State.fal_checkpoint_identity
}
if ([string]::IsNullOrWhiteSpace([string]$State.delivery_receipt_path)) {
  $State.delivery_receipt_path = Write-OCRouterArtifactDeliveryReceipt `
    -RunDir $RunDir `
    -Name "step-review-delivery" `
    -ArtifactPath $FinalArtifactPath `
    -ProducerSession $Meta `
    -Command "step-review" `
    -Target $Target `
    -Recipient $Track `
    -DeliveryProven $true `
    -ResponseClass $DeliveryResponseClass `
    -ResponseArtifactPath $DeliveryResponseArtifactPath `
    -ResponseMessageId ([string]$DeliveryResponsePin.producer_message_id) `
    -DispatchIntentPath ([string]$State.delivery_dispatch_intent_path) `
    -FalCheckpointIdentity $CheckpointIdentity
  Save-FlowState -RunDir $RunDir -State $State
}
else {
  Assert-OCRouterArtifactDeliveryReceipt `
    -ReceiptPath ([string]$State.delivery_receipt_path) `
    -ArtifactPath $FinalArtifactPath `
    -ProducerSession $Meta `
    -Command "step-review" `
    -Target $Target `
    -Recipient $Track `
    -ResponseClass $DeliveryResponseClass `
    -ResponseArtifactPath $DeliveryResponseArtifactPath `
    -ResponseMessageId ([string]$DeliveryResponsePin.producer_message_id) `
    -DispatchIntentPath ([string]$State.delivery_dispatch_intent_path) `
    -FalCheckpointIdentity $CheckpointIdentity | Out-Null
}

if ($FalSyncCheckpoint -and [string]::IsNullOrWhiteSpace([string]$State.fal_checkpoint_operation_path)) {
  $CheckpointProposal = Write-OCRouterFalCheckpointTargetProposal `
    -RunDir $RunDir `
    -Name "step-review-$Target" `
    -ProjectName $FalProjectName `
    -Target $Target `
    -CheckpointIdentity $CheckpointIdentity `
    -ReceiptPath ([string]$State.delivery_receipt_path) `
    -DeliveryResponseClass $DeliveryResponseClass
  $State.fal_checkpoint_operation_path = [string]$CheckpointProposal.path
  $State.fal_checkpoint_operation_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$CheckpointProposal.path)).Hash
}
elseif ($FalSyncCheckpoint) {
  Assert-OCRouterFalCheckpointTargetProposal `
    -ProposalPath ([string]$State.fal_checkpoint_operation_path) `
    -CheckpointIdentity $CheckpointIdentity `
    -ProjectName $FalProjectName `
    -Target $Target `
    -ReceiptPath ([string]$State.delivery_receipt_path) `
    -DeliveryResponseClass $DeliveryResponseClass | Out-Null
  $CurrentOperationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$State.fal_checkpoint_operation_path)).Hash
  if ([string]$State.fal_checkpoint_operation_sha256 -cne $CurrentOperationHash) {
    throw "Pinned /fal-checkpoint-target operation hash drift; refusing resume."
  }
}
$State.completed_at = (Get-Date).ToString("o")
Save-FlowState -RunDir $RunDir -State $State

Write-Host "Full step-review flow completed or resumed successfully. Runtime artifacts: $RunDir" -ForegroundColor Green

$Result = [pscustomobject]@{
  run_id = $RunId
  run_dir = $RunDir
  final_synthesis_path = $FinalArtifactPath
  delivery_response_path = (Join-Path $RunDir "06-track-delivery-response.md")
  delivery_response_class = $DeliveryResponseClass
  delivery_receipt_path = [string]$State.delivery_receipt_path
  fal_checkpoint_operation_path = [string]$State.fal_checkpoint_operation_path
}
if ($null -ne $RunLockHandle) { $RunLockHandle.Dispose() }
$Result
