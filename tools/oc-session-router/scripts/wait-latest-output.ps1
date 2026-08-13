param(
  [Parameter(Mandatory=$true)]
  [string]$Session,

  [int]$PollSeconds = 15,
  [int]$TimeoutMinutes = 45,
  [int]$Limit = 5,
  [int]$CandidateCount = 3,
  [int]$StablePolls = 2,
  [int]$MinOutputChars = 150,

  [string]$BaselineIdentity = "",
  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,

  [switch]$AssumeOldestFirst,
  [switch]$IncludeReasoningParts,
  [ValidateSet("track_plan", "track_fix_plan", "track_plan_revision", "meta_plan_review", "track_implementation_report", "meta_step_review_phase1", "swarm_review", "meta_final_synthesis", "closeout_result", "track_ack")]
  [string]$ExpectedOutputKind = "",
  [switch]$AcceptCurrentLatestAsNew,
  [switch]$AutoUseFirstStable,
  [switch]$SaveArtifact,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: wrapper-specific polling cannot establish stage completion.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

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

function Get-CandidateIdentity {
  param([object]$Candidate)

  if ($null -eq $Candidate) {
    return ""
  }

  if (-not [string]::IsNullOrWhiteSpace($Candidate.MessageId)) {
    return "id:$($Candidate.MessageId)"
  }

  return "text:$($Candidate.Text)"
}

function Get-CandidateStableSignature {
  param([object]$Candidate)

  if ($null -eq $Candidate) {
    return ""
  }

  $Tail = $Candidate.Text
  if ($Tail.Length -gt 240) {
    $Tail = $Tail.Substring($Tail.Length - 240)
  }
  return "$(Get-CandidateIdentity -Candidate $Candidate)|len:$($Candidate.TextLength)|tail:$Tail"
}

function Get-LatestAssistantCandidate {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [int]$CandidateCount,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [string]$ExpectedOutputKind,
    [string]$AfterMessageId = "",
    [int]$RequestTimeoutSeconds = 0
  )

  $Request = @{
    Method = 'Get'
    Uri = $Uri
    Headers = $Headers
    ContentType = 'application/json'
  }
  if ($RequestTimeoutSeconds -gt 0) { $Request.TimeoutSec = $RequestTimeoutSeconds }
  $Response = Invoke-RestMethod @Request

  $Messages = @(Get-OCRouterMessageCollection -Response $Response)
  $Candidates = @(Get-OCRouterLatestOutputCandidates `
    -Messages $Messages `
    -CandidateCount $CandidateCount `
    -AssumeNewestFirst:$AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -ExpectedOutputKind $ExpectedOutputKind `
    -AfterMessageId $AfterMessageId)

  if ($Candidates.Count -eq 0) {
    return $null
  }

  return $Candidates[0]
}

function Save-SelectedOutputArtifact {
  param(
    [string]$Text,
    [string]$Session,
    [string]$RouterDir,
    [string]$OutputPath
  )

  $RootDir = (Get-Location).Path
  if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $ArtifactDir = Join-Path $RouterDir "artifacts"
    New-Item -ItemType Directory -Force $ArtifactDir | Out-Null
    $SafeSession = Get-OCRouterSafeName -Value $Session
    $OutputPath = Join-Path $ArtifactDir ("latest-{0}-{1}.md" -f $SafeSession, (Get-OCRouterSafeTimestamp))
  }

  if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $RootDir $OutputPath
  }

  $Parent = Split-Path $OutputPath -Parent
  if (-not [string]::IsNullOrWhiteSpace($Parent)) {
    New-Item -ItemType Directory -Force $Parent | Out-Null
  }

  Set-Content -Path $OutputPath -Value $Text -Encoding UTF8
  return $OutputPath
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

$AssumeNewestFirst = -not $AssumeOldestFirst
$BaselineMessageId = ""
if ($BaselineIdentity -match '^id:(.+)$') {
  $BaselineMessageId = $Matches[1]
  # Keep the raw baseline visible while a long-lived review emits progress-only messages.
  $Limit = [Math]::Max($Limit, 200)
}
elseif (-not [string]::IsNullOrWhiteSpace($BaselineIdentity)) {
  throw "BaselineIdentity must use the raw message-ID form 'id:<message-id>'. Text baselines cannot prove recency."
}
$Config = Get-OCRouterConfig -RouterDir $RouterDir
$SessionEntry = Get-OCRouterSessionEntry -Config $Config -Name $Session
$Server = $Config.server.TrimEnd("/")
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password
$ReadUri = "$Server/session/$($SessionEntry.sessionId)/message?limit=$Limit"

Write-Host "=== OC Session Router Wait Latest Output ===" -ForegroundColor Cyan
Write-Host "Session:       $Session -> $($SessionEntry.title)"
Write-Host "Session ID:    $($SessionEntry.sessionId)"
Write-Host "Poll seconds:  $PollSeconds"
Write-Host "Timeout:       $TimeoutMinutes minutes"
Write-Host "Stable polls:  $StablePolls"
Write-Host "Min chars:     $MinOutputChars"
if (-not [string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
  Write-Host "Expected:      $ExpectedOutputKind"
  Write-Host "Length gate:   strict contract replaces MinOutputChars"
}
Write-Host ""

if ([string]::IsNullOrWhiteSpace($BaselineIdentity)) {
  if ($AcceptCurrentLatestAsNew) {
    $BaselineCandidate = Get-LatestAssistantCandidate `
      -Uri $ReadUri `
      -Headers $Headers `
      -CandidateCount $CandidateCount `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts:$IncludeReasoningParts `
      -ExpectedOutputKind $ExpectedOutputKind
    $BaselineIdentity = Get-CandidateIdentity -Candidate $BaselineCandidate
    if ($null -ne $BaselineCandidate -and -not [string]::IsNullOrWhiteSpace([string]$BaselineCandidate.MessageId)) {
      $BaselineMessageId = [string]$BaselineCandidate.MessageId
    }
  }
  else {
    $RawBaseline = Get-OCRouterLatestRawAssistantMessageFromUri -Uri $ReadUri -Headers $Headers -AssumeNewestFirst $AssumeNewestFirst
    $BaselineMessageId = [string]$RawBaseline.MessageId
    $BaselineIdentity = "id:$BaselineMessageId"
  }
}

if ([string]::IsNullOrWhiteSpace($BaselineIdentity)) {
  Write-Host "Baseline latest output: <none>"
}
else {
  Write-Host "Baseline latest output: $BaselineIdentity"
}

$Deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$IgnoredIdentities = @{}
$LastSignature = ""
$StableCount = 0
$Selected = $null
$AcceptedInitialIdentity = ""
$AcceptedInitialCandidate = $null
$LastDiagnosticIdentity = ""
$LastDiagnostic = $null

Write-Host "Waiting for a new assistant output. Press Ctrl+C to stop." -ForegroundColor Cyan
while ((Get-Date) -lt $Deadline) {
  $RemainingSeconds = [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds)
  if ($RemainingSeconds -le 0) { break }
  Start-Sleep -Seconds ([Math]::Min($PollSeconds, $RemainingSeconds))
  if ((Get-Date) -ge $Deadline) { break }
  $RequestTimeoutSeconds = [Math]::Max(1, [Math]::Min(30, [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds)))

  $Candidate = Get-LatestAssistantCandidate `
    -Uri $ReadUri `
    -Headers $Headers `
    -CandidateCount $CandidateCount `
    -AssumeNewestFirst $AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -ExpectedOutputKind $ExpectedOutputKind `
    -AfterMessageId $(if ($AcceptCurrentLatestAsNew) { "" } else { $BaselineMessageId }) `
    -RequestTimeoutSeconds $RequestTimeoutSeconds

  if ($null -eq $Candidate) {
    if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
      Write-Host "No assistant candidate yet."
    }
    else {
      Write-Host "No assistant candidate of expected kind '$ExpectedOutputKind' yet."
      if ((Get-Date) -ge $Deadline) { break }
      $DiagnosticCandidate = Get-LatestAssistantCandidate `
        -Uri $ReadUri `
        -Headers $Headers `
        -CandidateCount 1 `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -AfterMessageId $(if ($AcceptCurrentLatestAsNew) { "" } else { $BaselineMessageId }) `
        -RequestTimeoutSeconds ([Math]::Max(1, [Math]::Min(30, [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds))))
      if ($null -ne $DiagnosticCandidate) {
        $DiagnosticIdentity = Get-CandidateIdentity -Candidate $DiagnosticCandidate
        $LastDiagnostic = Get-OCRouterOutputContractDiagnostic -Text $DiagnosticCandidate.Text -ExpectedOutputKind $ExpectedOutputKind
        if ($DiagnosticIdentity -cne $LastDiagnosticIdentity) {
          Write-OCRouterOutputContractDiagnostic -Candidate $DiagnosticCandidate -ExpectedOutputKind $ExpectedOutputKind -Prefix "[$Session]" | Out-Null
          $LastDiagnosticIdentity = $DiagnosticIdentity
        }
      }
    }
    continue
  }

  $Identity = Get-CandidateIdentity -Candidate $Candidate
  $IsBaselineCandidate = $Identity -eq $BaselineIdentity
  if ($IgnoredIdentities.ContainsKey($Identity)) {
    Write-Host "No new final-output candidate yet. latest=$Identity chars=$($Candidate.TextLength)"
    continue
  }

  if ($IsBaselineCandidate -and -not $AcceptCurrentLatestAsNew) {
    Write-Host "No new final-output candidate yet. latest=$Identity chars=$($Candidate.TextLength)"
    continue
  }

  if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind) -and $Candidate.TextLength -lt $MinOutputChars) {
    Write-Host "New candidate is too short for handoff yet. latest=$Identity chars=$($Candidate.TextLength) min=$MinOutputChars"
    continue
  }

  if ($IsBaselineCandidate -and [string]::IsNullOrWhiteSpace($AcceptedInitialIdentity)) {
    $AcceptedInitialIdentity = $Identity
    $AcceptedInitialCandidate = $Candidate
    Write-Host "Current latest output matches the baseline, but AcceptCurrentLatestAsNew is enabled. Treating it as a candidate if it stays stable." -ForegroundColor Yellow
  }

  $Signature = Get-CandidateStableSignature -Candidate $Candidate
  if ($Signature -eq $LastSignature) {
    $StableCount += 1
  }
  else {
    $LastSignature = $Signature
    $StableCount = 1
  }

  Write-Host "New candidate observed. latest=$Identity chars=$($Candidate.TextLength) stable=$StableCount/$StablePolls"

  if ($StableCount -lt $StablePolls) {
    continue
  }

  Write-Host ""
  Write-OCRouterSelectedCandidateSummary -Candidate $Candidate
  Write-Host "Candidate output preview:" -ForegroundColor Yellow
  Write-OCRouterTextPreview -Text $Candidate.Text

  if ($AutoUseFirstStable) {
    $Selected = $Candidate
    break
  }

  $UseAnswer = Read-Host "Use this output? [u]se/[w]ait/[n]abort"
  if ($UseAnswer -eq "u" -or $UseAnswer -eq "U" -or $UseAnswer -eq "y" -or $UseAnswer -eq "Y") {
    $Selected = $Candidate
    break
  }
  elseif ($UseAnswer -eq "w" -or $UseAnswer -eq "W") {
    $IgnoredIdentities[$Identity] = $true
    $LastSignature = ""
    $StableCount = 0
    Write-Host "Continuing to wait for a newer output." -ForegroundColor Yellow
    continue
  }
  else {
    throw "Aborted while waiting for a new assistant output."
  }
}

if ($null -eq $Selected) {
  if (-not [string]::IsNullOrWhiteSpace($LastDiagnosticIdentity)) {
    throw "Timed out after $TimeoutMinutes minutes. A newer assistant output exists but failed the strict '$ExpectedOutputKind' contract: identity=$LastDiagnosticIdentity mismatches=$(@($LastDiagnostic.reasons) -join ','). Reconcile the transcript read-only; do not resend."
  }
  throw "Timed out after $TimeoutMinutes minutes waiting for a selected assistant output."
}

if ($SaveArtifact -or -not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $SavedPath = Save-SelectedOutputArtifact -Text $Selected.Text -Session $Session -RouterDir $RouterDir -OutputPath $OutputPath
  Write-Host "Saved selected output to: $SavedPath" -ForegroundColor Green
}
