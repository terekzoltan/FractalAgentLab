param(
  [Parameter(Mandatory=$true)]
  [string]$PacketPath,

  [string]$RouterDir = ".opencode-router"
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: legacy packet stage-to-command resolution is non-operational.'

function Get-RouterRoleLabel {
  param([string]$Key)

  switch ($Key) {
    "track-a" { "Track A" }
    "track-b" { "Track B" }
    "track-c" { "Track C" }
    "track-d" { "Track D" }
    "track-e" { "Track E" }
    "track-metaops" { "Track MetaOps" }
    "meta" { "Meta Coordinator" }
    "swarm-assistant" { "Swarm Assistant" }
    "smr-analyst" { "SMR Analyst" }
    default { "" }
  }
}

function Get-RouterStageRoute {
  param([string]$Stage)

  switch ($Stage) {
    "plan_ready_for_meta_review" {
      [pscustomobject]@{ CommandName = "terv-review"; ArgumentMode = "target-origin-body" }
    }
    "implementation_done" {
      [pscustomobject]@{ CommandName = "step-review"; ArgumentMode = "target-origin-body" }
    }
    "meta_plan_review_done" {
      [pscustomobject]@{ CommandName = "terv-review-utan"; ArgumentMode = "body-only" }
    }
    "step_review_done" {
      [pscustomobject]@{ CommandName = "step-review-utan"; ArgumentMode = "body-only" }
    }
    "implementation_requested" {
      [pscustomobject]@{ CommandName = "implement"; ArgumentMode = "empty" }
    }
    default { $null }
  }
}

function Resolve-RouterBodyPath {
  param(
    [string]$BodyPath,
    [string]$RouterDir,
    [string]$RootDir
  )

  $Candidates = @()
  if ([System.IO.Path]::IsPathRooted($BodyPath)) {
    $Candidates += $BodyPath
  }
  else {
    $Candidates += (Join-Path $RootDir $BodyPath)
    $Candidates += (Join-Path (Join-Path $RootDir $RouterDir) $BodyPath)
  }

  foreach ($Candidate in $Candidates) {
    if (Test-Path $Candidate) {
      return (Resolve-Path $Candidate).Path
    }
  }

  return ""
}

function Test-VersionedExampleHasSessionIdField {
  param([string]$Raw)

  return (
    ($Raw -match '(?i)"[^"]*(session_id|sessionid|sessionID)[^"]*"\s*:') -or
    ($Raw -match '(?i)ses_[a-z0-9]{8,}')
  )
}

$RootDir = (Get-Location).Path
$Errors = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]

if (-not (Test-Path $PacketPath)) {
  throw "Packet not found: $PacketPath"
}

$ResolvedPacketPath = (Resolve-Path $PacketPath).Path
$Raw = Get-Content $ResolvedPacketPath -Raw

try {
  $Packet = $Raw | ConvertFrom-Json
}
catch {
  throw "Invalid JSON packet: $($_.Exception.Message)"
}

$Required = @("stage", "from", "to", "risk", "summary")
foreach ($Field in $Required) {
  if (($Packet.PSObject.Properties.Name -notcontains $Field) -or [string]::IsNullOrWhiteSpace([string]$Packet.$Field)) {
    $Errors.Add("Missing required field: $Field")
  }
}

$HasBody = ($Packet.PSObject.Properties.Name -contains "body") -and -not [string]::IsNullOrWhiteSpace([string]$Packet.body)
$HasBodyPath = ($Packet.PSObject.Properties.Name -contains "body_path") -and -not [string]::IsNullOrWhiteSpace([string]$Packet.body_path)

if (-not $HasBody -and -not $HasBodyPath) {
  $Errors.Add("Packet must contain either non-empty 'body' or 'body_path'.")
}

if ($HasBodyPath) {
  $ResolvedBodyPath = Resolve-RouterBodyPath -BodyPath ([string]$Packet.body_path) -RouterDir $RouterDir -RootDir $RootDir
  if ([string]::IsNullOrWhiteSpace($ResolvedBodyPath)) {
    $Errors.Add("body_path not found from current working directory or router root: $($Packet.body_path)")
  }
}

$Route = $null
if ($Packet.PSObject.Properties.Name -contains "stage") {
  $Route = Get-RouterStageRoute ([string]$Packet.stage)
  if ($null -eq $Route) {
    $Errors.Add("Unknown stage: $($Packet.stage)")
  }
}

if (($null -ne $Route) -and $Route.ArgumentMode -eq "target-origin-body") {
  if (($Packet.PSObject.Properties.Name -notcontains "target") -or [string]::IsNullOrWhiteSpace([string]$Packet.target)) {
    $Errors.Add("Stage '$($Packet.stage)' requires non-empty target.")
  }

  $OriginLabel = Get-RouterRoleLabel ([string]$Packet.from)
  if ([string]::IsNullOrWhiteSpace($OriginLabel)) {
    $Errors.Add("Stage '$($Packet.stage)' requires a known origin Track in field 'from'.")
  }
}

$SessionsPath = Join-Path $RouterDir "sessions.json"
if (Test-Path $SessionsPath) {
  try {
    $Config = Get-Content $SessionsPath -Raw | ConvertFrom-Json
    $Known = @($Config.sessions.PSObject.Properties.Name)

    foreach ($NameField in @("from", "to")) {
      if ($Packet.PSObject.Properties.Name -contains $NameField) {
        $LogicalName = [string]$Packet.$NameField
        if ($Known -notcontains $LogicalName) {
          $Errors.Add("Unknown logical $NameField '$LogicalName'. Known targets: $($Known -join ', ')")
        }
      }
    }
  }
  catch {
    $Errors.Add("Could not read sessions registry '$SessionsPath': $($_.Exception.Message)")
  }
}
else {
  $Warnings.Add("Sessions registry not found: $SessionsPath. Logical target existence was not checked.")
}

$ExampleRoot = [System.IO.Path]::GetFullPath((Join-Path $RootDir "tools/oc-session-router/examples"))
$PacketFull = [System.IO.Path]::GetFullPath($ResolvedPacketPath)
if ($PacketFull.StartsWith($ExampleRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  if (Test-VersionedExampleHasSessionIdField -Raw $Raw) {
    $Errors.Add("Versioned example appears to contain a hardcoded session ID field.")
  }
}

Write-Host "=== OC Session Router Packet Validation ===" -ForegroundColor Cyan
Write-Host "Packet: $ResolvedPacketPath"
if ($null -ne $Route) {
  Write-Host "Stage:  $($Packet.stage)"
  Write-Host "Command: /$($Route.CommandName)"
  Write-Host "Argument mode: $($Route.ArgumentMode)"
}

foreach ($Warning in $Warnings) {
  Write-Host "WARNING: $Warning" -ForegroundColor Yellow
}

if ($Errors.Count -gt 0) {
  foreach ($ValidationError in $Errors) {
    Write-Host "ERROR: $ValidationError" -ForegroundColor Red
  }
  exit 1
}

Write-Host "Validation passed." -ForegroundColor Green
