param(
  [Parameter(Mandatory=$true)]
  [string]$From,

  [Parameter(Mandatory=$true)]
  [string]$To,

  [Parameter(Mandatory=$true)]
  [string]$Stage,

  [string]$Target = "",
  [string]$Risk = "medium",
  [string]$Summary = "",

  [int]$Limit = 5,
  [int]$CandidateCount = 3,

  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,

  [switch]$PreviewOnly,
  [switch]$DryRun,
  [switch]$AutoSelectLatest,
  [switch]$InteractiveSelect,
  [switch]$AssumeOldestFirst,
  [switch]$IncludeReasoningParts
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: latest-output selection cannot route or send.'
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

if ($Stage -eq "fix_plan_ready_for_meta_review") {
  throw "Stage 'fix_plan_ready_for_meta_review' is retired. After /step-review-utan, a completed Track fix plan proceeds directly to /implement."
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

$RootDir = (Get-Location).Path
$NoSend = $PreviewOnly -or $DryRun
$Config = Get-OCRouterConfig -RouterDir $RouterDir
$FromEntry = Get-OCRouterSessionEntry -Config $Config -Name $From
$ToEntry = Get-OCRouterSessionEntry -Config $Config -Name $To
$Server = $Config.server.TrimEnd("/")
$FromSessionId = $FromEntry.sessionId
$ReadUri = "$Server/session/$FromSessionId/message?limit=$Limit"
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password

Write-Host "=== OC Session Router Route Latest Output ===" -ForegroundColor Cyan
Write-Host "From:     $From -> $($FromEntry.title)"
Write-Host "To:       $To -> $($ToEntry.title)"
Write-Host "Stage:    $Stage"
Write-Host "Target:   $(if ([string]::IsNullOrWhiteSpace($Target)) { '<none>' } else { $Target })"
Write-Host "Read:     GET /session/{sessionID}/message?limit=$Limit"
Write-Host "Mode:     $(if ($NoSend) { 'PreviewOnly/DryRun' } else { 'live after approval' })"
Write-Host ""

$ExpectedOutputKind = Get-OCRouterExpectedOutputKindForRouteStage -Stage $Stage
if (-not [string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
  Write-Host "Expected source output kind: $ExpectedOutputKind"
  Write-Host ""
}

$Response = Invoke-RestMethod `
  -Method Get `
  -Uri $ReadUri `
  -Headers $Headers `
  -ContentType "application/json"

$Messages = @(Get-OCRouterMessageCollection -Response $Response)
Write-Host "Messages returned from ${From}: $($Messages.Count)"

$Candidates = @(Get-OCRouterLatestOutputCandidates -Messages $Messages -CandidateCount $CandidateCount -AssumeNewestFirst:(-not $AssumeOldestFirst) -IncludeReasoningParts:$IncludeReasoningParts -ExpectedOutputKind $ExpectedOutputKind)
if ($Candidates.Count -eq 0) {
  if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
    Write-Host "No assistant-like text output candidate found." -ForegroundColor Yellow
  }
  else {
    Write-Host "No candidate matched expected output kind '$ExpectedOutputKind' for stage '$Stage'." -ForegroundColor Yellow
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
  Write-Host "No candidate selected. Nothing routed." -ForegroundColor Yellow
  exit 0
}

$LooksLikeCompactionSummary = Test-OCRouterCompactionSummaryLikeOutput -Text $Selected.Text
if ($LooksLikeCompactionSummary) {
  Write-Host "Warning: selected candidate looks like a compaction summary." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Latest output preview before packet routing:" -ForegroundColor Yellow
Write-OCRouterTextPreview -Text $Selected.Text

if ([string]::IsNullOrWhiteSpace($Summary)) {
  $Summary = "Latest output from $From for $Stage"
}

$Packet = [ordered]@{
  stage = $Stage
  from = $From
  to = $To
  risk = $Risk
  summary = $Summary
}

if (-not [string]::IsNullOrWhiteSpace($Target)) {
  $Packet["target"] = $Target
}

$SafeFrom = Get-OCRouterSafeName -Value $From
$SafeStage = Get-OCRouterSafeName -Value $Stage
$Timestamp = Get-OCRouterSafeTimestamp
$TempPacketPath = ""

try {
  if ($NoSend) {
    $Packet["body"] = $Selected.Text
    $TempFile = New-TemporaryFile
    $TempPacketPath = $TempFile.FullName
    $Packet | ConvertTo-Json -Depth 10 | Set-Content -Path $TempPacketPath -Encoding UTF8

    & (Join-Path $PSScriptRoot "route-packet.ps1") `
      -RouterDir $RouterDir `
      -PacketPath $TempPacketPath `
      -Username $Username `
      -Password $Password `
      -PreviewOnly
  }
  else {
    $ArtifactDir = Join-Path $RouterDir "artifacts"
    $OutboxDir = Join-Path $RouterDir "outbox"
    New-Item -ItemType Directory -Force $ArtifactDir | Out-Null
    New-Item -ItemType Directory -Force $OutboxDir | Out-Null

    $ArtifactRelativePath = Join-Path $ArtifactDir ("latest-{0}-{1}.md" -f $SafeFrom, $Timestamp)
    $ArtifactPath = Join-Path $RootDir $ArtifactRelativePath
    Set-Content -Path $ArtifactPath -Value $Selected.Text -Encoding UTF8

    $Packet["body_path"] = $ArtifactRelativePath
    $PacketFileName = "latest-{0}-{1}-{2}.json" -f $SafeFrom, $SafeStage, $Timestamp
    $PacketPath = Join-Path $OutboxDir $PacketFileName
    $Packet | ConvertTo-Json -Depth 10 | Set-Content -Path $PacketPath -Encoding UTF8

    Write-Host "Created runtime artifact: $ArtifactRelativePath" -ForegroundColor Cyan
    Write-Host "Created runtime packet:   $PacketPath" -ForegroundColor Cyan
    Write-Host ""

    & (Join-Path $PSScriptRoot "route-packet.ps1") `
      -RouterDir $RouterDir `
      -PacketPath $PacketPath `
      -Username $Username `
      -Password $Password
  }
}
finally {
  if (-not [string]::IsNullOrWhiteSpace($TempPacketPath) -and (Test-Path $TempPacketPath)) {
    Remove-Item $TempPacketPath -Force
  }
}
