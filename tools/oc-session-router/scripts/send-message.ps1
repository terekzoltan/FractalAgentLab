param(
  [Parameter(Mandatory=$true)]
  [string]$Target,

  [Parameter(Mandatory=$true)]
  [string]$Text,

  [string]$Agent = "",

  [string]$Model = "",

  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),

  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,

  [switch]$PreviewOnly,
  [switch]$DryRun,
  [switch]$AutoApprove
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: unrestricted message sending is blocked.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")
$NoSend = $PreviewOnly -or $DryRun
$SessionsPath = Join-Path $RouterDir "sessions.json"

if (-not (Test-Path $SessionsPath)) {
  throw "Missing sessions registry: $SessionsPath"
}

$Config = Get-Content $SessionsPath -Raw | ConvertFrom-Json
$TargetProperties = @($Config.sessions.PSObject.Properties | Where-Object { [string]$_.Name -ceq $Target })
$TargetEntry = if ($TargetProperties.Count -eq 1) { $TargetProperties[0].Value } else { $null }

if ($null -eq $TargetEntry) {
  $Available = ($Config.sessions.PSObject.Properties.Name -join ", ")
  throw "Unknown target '$Target'. Available targets: $Available"
}
$Target = [string]$TargetProperties[0].Name

$Server = Resolve-OCRouterLiteralLoopbackServer ([string]$Config.server)
$SessionId = $TargetEntry.sessionId
$Uri = "$Server/session/$SessionId/message"

Write-Host "=== OpenCode Message Preview ===" -ForegroundColor Cyan
Write-Host "Target:   $Target -> $($TargetEntry.title)"
Write-Host "Session:  $SessionId"
Write-Host "Endpoint: message endpoint"
Write-Host "Agent:    $(if ([string]::IsNullOrWhiteSpace($Agent)) { '<default session agent>' } else { $Agent })"
Write-Host "Model:    $(if ([string]::IsNullOrWhiteSpace($Model)) { '<default session model>' } else { $Model })"
Write-Host "API call: $(if ($NoSend) { 'NO (PreviewOnly/DryRun)' } else { 'YES after approval' })"
Write-Host ""
Write-Host "Text preview:" -ForegroundColor Yellow
Write-Host "----------------------------------------"
if ($Text.Length -gt 3000) {
  Write-Host $Text.Substring(0, 3000)
  Write-Host "`n...[truncated preview]..."
}
else {
  Write-Host $Text
}
Write-Host "----------------------------------------"

if ($NoSend) {
  Write-Host "PreviewOnly/DryRun active. Not sent." -ForegroundColor Yellow
  exit 0
}

if ($AutoApprove) {
  Write-Host "AutoApprove active. Sending live message without local prompt." -ForegroundColor Yellow
}
else {
  $Answer = Read-Host "Send this message to '$Target'? [y/N]"
  if ($Answer -ne "y" -and $Answer -ne "Y") {
    Write-Host "Not sent."
    exit 0
  }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

$Pair = "$Username`:$Password"
$Encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($Pair))

$BodyObject = New-OCRouterMessageRequestBodyObject -Text $Text -Agent $Agent -Model $Model

$Body = $BodyObject | ConvertTo-Json -Depth 10

Write-Host "Sending message to target='$Target' session='$SessionId'..." -ForegroundColor Cyan
$TransportLock = Enter-OCRouterParticipantTransportLock -RunDir $RouterDir -Participant $Target
try {
  $MessageRunDir = Join-Path (Join-Path $RouterDir 'packet-runs') ('manual-message-' + [guid]::NewGuid().ToString('N'))
  $SessionsIdentity = 'sha256:' + (Get-FileHash -LiteralPath $SessionsPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $Intent = Start-OCRouterDispatchIntentCore `
    -RunDir $MessageRunDir `
    -Transition 'send-message' `
    -Recipient $Target `
    -Kind message `
    -Operation 'send-message' `
    -Payload $Body `
    -BaselineIdentity $SessionsIdentity `
    -CandidateIdentity ('sha256:' + (Get-OCRouterStringSha256 -Text $Body).ToLowerInvariant()) `
    -Stage 'manual_message'
  Invoke-RestMethod `
    -Method Post `
    -Uri $Uri `
    -Headers @{ Authorization = "Basic $Encoded" } `
    -ContentType "application/json" `
    -Body $Body `
    -MaximumRedirection 0 | Out-Null
  Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId 'response-not-retained' | Out-Null
}
finally {
  if ($null -ne $TransportLock) { $TransportLock.Dispose() }
}

Write-Host "Sent." -ForegroundColor Green
