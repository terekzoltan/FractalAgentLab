param(
  [string]$RouterDir = ".opencode-router",
  [string]$Server = "http://127.0.0.1:4096",
  [switch]$IncludeSmrAnalyst,
  [switch]$IncludeDocsMetaOps,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: arbitrary server/session registry initialization is blocked.'

$SessionsPath = Join-Path $RouterDir "sessions.json"
$SettingsPath = Join-Path $RouterDir "router-settings.json"

New-Item -ItemType Directory -Force $RouterDir | Out-Null
foreach ($Child in @("outbox", "processed", "rejected", "artifacts")) {
  New-Item -ItemType Directory -Force (Join-Path $RouterDir $Child) | Out-Null
}

if ((Test-Path $SessionsPath) -and -not $Force) {
  Write-Host "Runtime router directories exist." -ForegroundColor Green
  Write-Host "Sessions registry already exists: $SessionsPath"
  if (-not (Test-Path $SettingsPath)) {
    $Settings = [ordered]@{
      message_order = "oldest_first"
      poll_seconds = 15
      timeout_minutes = 45
      stable_polls = 2
      limit = 5
      candidate_count = 3
      min_output_chars = 150
      swarm_review_depth = "auto"
    }
    $Settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8
    Write-Host "Created default router settings: $SettingsPath" -ForegroundColor Green
  }
  else {
    Write-Host "Router settings already exist: $SettingsPath"
  }
  Write-Host "Not overwriting sessions registry. Use -Force only if you want a fresh placeholder template." -ForegroundColor Yellow
  exit 0
}

$Sessions = [ordered]@{
  meta = [ordered]@{
    title = "Meta Coordinator"
    sessionId = "TODO_META_SESSION_ID"
  }
  "track-a" = [ordered]@{
    title = "Track A"
    sessionId = "TODO_TRACK_A_SESSION_ID"
  }
  "track-b" = [ordered]@{
    title = "Track B"
    sessionId = "TODO_TRACK_B_SESSION_ID"
  }
  "track-c" = [ordered]@{
    title = "Track C"
    sessionId = "TODO_TRACK_C_SESSION_ID"
  }
  "track-d" = [ordered]@{
    title = "Track D"
    sessionId = "TODO_TRACK_D_SESSION_ID"
  }
  "track-e" = [ordered]@{
    title = "Track E"
    sessionId = "TODO_TRACK_E_SESSION_ID"
  }
  "swarm-assistant" = [ordered]@{
    title = "Swarm Assistant"
    sessionId = "TODO_SWARM_ASSISTANT_SESSION_ID"
  }
}

if ($IncludeDocsMetaOps) {
  $Sessions["track-metaops"] = [ordered]@{
    title = "Track MetaOps"
    sessionId = "TODO_TRACK_METAOPS_SESSION_ID"
  }
}

if ($IncludeSmrAnalyst) {
  $Sessions["smr-analyst"] = [ordered]@{
    title = "SMR Analyst"
    sessionId = "TODO_SMR_ANALYST_SESSION_ID"
  }
}

$Config = [ordered]@{
  server = $Server
  sessions = $Sessions
}

$Settings = [ordered]@{
  message_order = "oldest_first"
  poll_seconds = 15
  timeout_minutes = 45
  stable_polls = 2
  limit = 5
  candidate_count = 3
  min_output_chars = 150
  swarm_review_depth = "auto"
}

$Config | ConvertTo-Json -Depth 10 | Set-Content -Path $SessionsPath -Encoding UTF8
$Settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding UTF8

Write-Host "Created router runtime directories under: $RouterDir" -ForegroundColor Green
Write-Host "Created placeholder sessions registry: $SessionsPath" -ForegroundColor Green
Write-Host "Created default router settings: $SettingsPath" -ForegroundColor Green
Write-Host "Replace TODO_* sessionId values with the OpenCode session IDs for this project." -ForegroundColor Yellow
