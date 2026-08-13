param(
  [Parameter(Mandatory=$true)]
  [string]$From,

  [int]$Limit = 5,
  [int]$CandidateCount = 3,

  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,

  [switch]$AutoSelectLatest,
  [switch]$InteractiveSelect,
  [switch]$AssumeOldestFirst,
  [switch]$IncludeReasoningParts,
  [ValidateSet("track_plan", "track_fix_plan", "track_plan_revision", "meta_plan_review", "track_implementation_report", "meta_step_review_phase1", "swarm_review", "meta_final_synthesis", "closeout_result", "track_ack")]
  [string]$ExpectedOutputKind = "",
  [switch]$SaveArtifact,
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
if ($SaveArtifact -or -not [string]::IsNullOrWhiteSpace($OutputPath)) {
  throw 'FAL_EXPLICIT_STAGE_ROUTER_BLOCKED_WRITE: legacy diagnostics cannot write artifacts.'
}
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

$Settings = Get-OCRouterSettings -RouterDir $RouterDir
$Limit = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "Limit" -CurrentValue $Limit -SettingName "limit")
$CandidateCount = [int](Initialize-OCRouterDefaultFromSettings -BoundParameters $PSBoundParameters -Settings $Settings -ParameterName "CandidateCount" -CurrentValue $CandidateCount -SettingName "candidate_count")
if (-not $PSBoundParameters.ContainsKey("AssumeOldestFirst")) {
  $MessageOrder = [string](Get-OCRouterSettingValue -Settings $Settings -Name "message_order" -DefaultValue "")
  if ($MessageOrder -eq "oldest_first") {
    $AssumeOldestFirst = $true
  }
}

if ($Limit -lt 1) {
  throw "Limit must be at least 1."
}

if ($CandidateCount -lt 1) {
  throw "CandidateCount must be at least 1."
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

$RootDir = (Get-Location).Path
$Config = Get-OCRouterConfig -RouterDir $RouterDir
$FromEntry = Get-OCRouterSessionEntry -Config $Config -Name $From
$Server = $Config.server.TrimEnd("/")
$SessionId = $FromEntry.sessionId
$Uri = "$Server/session/$SessionId/message?limit=$Limit"
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password

Write-Host "=== OC Session Router Latest Output Read ===" -ForegroundColor Cyan
Write-Host "From:     $From -> $($FromEntry.title)"
Write-Host "Session:  $SessionId"
Write-Host "Endpoint: GET /session/{sessionID}/message?limit=$Limit"
Write-Host "Mode:     read-only"
if (-not [string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
  Write-Host "Expected: $ExpectedOutputKind"
}
Write-Host ""

$Response = Invoke-RestMethod `
  -Method Get `
  -Uri $Uri `
  -Headers $Headers `
  -ContentType "application/json"

$Messages = @(Get-OCRouterMessageCollection -Response $Response)
Write-Host "Messages returned: $($Messages.Count)"

$Candidates = @(Get-OCRouterLatestOutputCandidates -Messages $Messages -CandidateCount $CandidateCount -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -ExpectedOutputKind $ExpectedOutputKind)
if ($Candidates.Count -eq 0) {
  if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
    Write-Host "No assistant-like text output candidate found." -ForegroundColor Yellow
  }
  else {
    Write-Host "No candidate matched expected output kind '$ExpectedOutputKind'." -ForegroundColor Yellow
    $DiagnosticCandidates = @(Get-OCRouterLatestOutputCandidates -Messages $Messages -CandidateCount 1 -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts)
    if ($DiagnosticCandidates.Count -gt 0) {
      Write-OCRouterOutputContractDiagnostic -Candidate $DiagnosticCandidates[0] -ExpectedOutputKind $ExpectedOutputKind -Prefix "[$From]" | Out-Null
      Write-Host "The diagnostic candidate was not selected or saved. Reconcile the transcript/read contract before any resend." -ForegroundColor Yellow
    }
  }
  exit 1
}

$Selected = $null
if ($InteractiveSelect) {
  $Selected = Select-OCRouterOutputCandidate -Candidates $Candidates -AutoSelectLatest:$AutoSelectLatest
}
else {
  $Selected = $Candidates[0]
  Write-OCRouterSelectedCandidateSummary -Candidate $Selected
}

if ($null -eq $Selected) {
  Write-Host "No candidate selected. Nothing saved." -ForegroundColor Yellow
  exit 0
}

if (Test-OCRouterCompactionSummaryLikeOutput -Text $Selected.Text) {
  Write-Host "Warning: selected candidate looks like a compaction summary. Do not use it as fix-plan authority unless you intentionally captured a pinned artifact before compact." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Selected output preview:" -ForegroundColor Yellow
Write-OCRouterTextPreview -Text $Selected.Text

$ShouldSave = $SaveArtifact -or -not [string]::IsNullOrWhiteSpace($OutputPath)
if ($ShouldSave) {
  if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $ArtifactDir = Join-Path $RouterDir "artifacts"
    New-Item -ItemType Directory -Force $ArtifactDir | Out-Null
    $SafeFrom = Get-OCRouterSafeName -Value $From
    $OutputPath = Join-Path $ArtifactDir ("latest-{0}-{1}.md" -f $SafeFrom, (Get-OCRouterSafeTimestamp))
  }

  if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $RootDir $OutputPath
  }

  $Parent = Split-Path $OutputPath -Parent
  if (-not [string]::IsNullOrWhiteSpace($Parent)) {
    New-Item -ItemType Directory -Force $Parent | Out-Null
  }

  Set-Content -Path $OutputPath -Value $Selected.Text -Encoding UTF8
  Write-Host "Saved selected output to: $OutputPath" -ForegroundColor Green
}
