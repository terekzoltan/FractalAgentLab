param(
  [string]$RouterDir = ".opencode-router",
  [string]$PacketPath = "",
  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD,
  [string]$Agent = "",
  [string]$Model = "",
  [int]$PostTimeoutSeconds = 120,
  [int]$PostReconcileTimeoutMinutes = 45,
  [switch]$PreviewOnly,
  [switch]$DryRun,
  [switch]$AutoApprove
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: packet routing cannot send lifecycle commands.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

if ($PostTimeoutSeconds -lt 10) {
  throw "PostTimeoutSeconds must be at least 10."
}
if ($PostReconcileTimeoutMinutes -lt 1) {
  throw "PostReconcileTimeoutMinutes must be at least 1."
}

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

function Get-RouterBytesSha256 {
  param([byte[]]$Bytes)

  $Sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-', '') }
  finally { $Sha.Dispose() }
}

function Get-RouterStageRoute {
  param([string]$Stage)

  switch ($Stage) {
    "plan_ready_for_meta_review" {
      [pscustomobject]@{ CommandName = "terv-review"; ArgumentMode = "target-origin-body"; Endpoint = "command"; Purpose = "initial Track plan to Meta review" }
    }
    "implementation_done" {
      [pscustomobject]@{ CommandName = "step-review"; ArgumentMode = "target-origin-body"; Endpoint = "command"; Purpose = "Track implementation brief to Meta step-review" }
    }
    "meta_plan_review_done" {
      [pscustomobject]@{ CommandName = "terv-review-utan"; ArgumentMode = "body-only"; Endpoint = "command"; Purpose = "Meta plan review back to Track" }
    }
    "step_review_done" {
      [pscustomobject]@{ CommandName = "step-review-utan"; ArgumentMode = "body-only"; Endpoint = "command"; Purpose = "Meta step-review back to Track" }
    }
    "review_fix_done" {
      [pscustomobject]@{ CommandName = "step-review-utan"; ArgumentMode = "body-only"; Endpoint = "command"; Purpose = "Meta review-fix acceptance back to Track" }
    }
    "implementation_requested" {
      [pscustomobject]@{ CommandName = "implement"; ArgumentMode = "body-only"; Endpoint = "command"; Purpose = "exact reviewed IMPLEMENT_READY plan to implementation" }
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
    if (Test-Path -LiteralPath $Candidate -PathType Leaf) {
      $Resolved = (Resolve-Path -LiteralPath $Candidate -ErrorAction Stop).Path
      $Item = Get-Item -LiteralPath $Resolved -Force -ErrorAction Stop
      if ((Test-UnderPath -Path $Resolved -Parent $RootDir) -and
          -not ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -and
          -not (Test-RouterPathHasReparsePoint -Path $Resolved -Root $RootDir)) {
        return $Resolved
      }
    }
  }

  return ""
}

function Test-RouterPathHasReparsePoint {
  param(
    [string]$Path,
    [string]$Root
  )

  $Current = [IO.Path]::GetFullPath($Path)
  $RootFull = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  while (Test-UnderPath -Path $Current -Parent $RootFull) {
    $Item = Get-Item -LiteralPath $Current -Force -ErrorAction Stop
    if ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) { return $true }
    if ($Current.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar).Equals($RootFull, [StringComparison]::OrdinalIgnoreCase)) { break }
    $Parent = Split-Path -Parent $Current
    if ([string]::IsNullOrWhiteSpace($Parent) -or $Parent -ceq $Current) { break }
    $Current = $Parent
  }
  return $false
}

function Build-RouterCommandArguments {
  param(
    [string]$ArgumentMode,
    [string]$Target,
    [string]$OriginRole,
    [string]$Body
  )

  switch ($ArgumentMode) {
    "target-origin-body" {
      return "$Target $OriginRole`n`n$Body"
    }
    "body-only" {
      return $Body
    }
    "empty" {
      return ""
    }
    default {
      throw "Unknown command argument mode: $ArgumentMode"
    }
  }
}

function Test-UnderPath {
  param(
    [string]$Path,
    [string]$Parent
  )

  $FullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $FullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if ($FullPath.Equals($FullParent, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
  $ParentPrefix = $FullParent + [IO.Path]::DirectorySeparatorChar
  return $FullPath.StartsWith($ParentPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Move-ToRejectedIfRuntimePacket {
  param(
    [string]$PacketPath,
    [string]$OutboxDir,
    [string]$RejectedDir,
    [bool]$NoSend
  )

  if ($NoSend) {
    return
  }

  if (Test-UnderPath -Path $PacketPath -Parent $OutboxDir) {
    $Dest = Join-Path $RejectedDir (Split-Path $PacketPath -Leaf)
    Move-Item $PacketPath $Dest -Force
  }
}

$NoSend = $PreviewOnly -or $DryRun
$RouterRoot = (Resolve-Path -LiteralPath $RouterDir -ErrorAction Stop).Path
$RootDir = Split-Path -Parent $RouterRoot
$OutboxDir = Join-Path $RouterDir "outbox"
$InflightDir = Join-Path $RouterDir "inflight"
$ProcessedDir = Join-Path $RouterDir "processed"
$RejectedDir = Join-Path $RouterDir "rejected"
$SessionsPath = Join-Path $RouterDir "sessions.json"

New-Item -ItemType Directory -Force $OutboxDir | Out-Null
New-Item -ItemType Directory -Force $InflightDir | Out-Null
New-Item -ItemType Directory -Force $ProcessedDir | Out-Null
New-Item -ItemType Directory -Force $RejectedDir | Out-Null

if (-not (Test-Path $SessionsPath)) {
  throw "Missing sessions registry: $SessionsPath"
}

$Config = Get-OCRouterConfig -RouterDir $RouterDir

if ([string]::IsNullOrWhiteSpace($PacketPath)) {
  $Packet = Get-ChildItem $OutboxDir -Filter "*.json" |
    Sort-Object LastWriteTime |
    Select-Object -First 1

  if ($null -eq $Packet) {
    Write-Host "No packet found in $OutboxDir"
    exit 0
  }

  $PacketPath = $Packet.FullName
}

if (-not (Test-Path $PacketPath)) {
  throw "Packet not found: $PacketPath"
}

$ResolvedPacketPath = (Resolve-Path $PacketPath).Path
$PacketBytes = [IO.File]::ReadAllBytes($ResolvedPacketPath)
$Raw = (New-Object Text.UTF8Encoding($false, $true)).GetString($PacketBytes)
if ($Raw.Length -gt 0 -and [int]$Raw[0] -eq 0xFEFF) { $Raw = $Raw.Substring(1) }
$ParsedPacketHash = Get-RouterBytesSha256 -Bytes $PacketBytes

try {
  $P = $Raw | ConvertFrom-Json
}
catch {
  Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
  throw "Invalid JSON packet: $($_.Exception.Message)"
}

$Required = @("stage", "from", "to", "risk", "summary")
foreach ($Field in $Required) {
  if (($P.PSObject.Properties.Name -notcontains $Field) -or [string]::IsNullOrWhiteSpace([string]$P.$Field)) {
    Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
    throw "Invalid packet: missing required field '$Field'."
  }
}

$Route = Get-RouterStageRoute ([string]$P.stage)
if ($null -eq $Route) {
  Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
  throw "Invalid packet: unknown stage '$($P.stage)'."
}

$Body = ""
$BodySource = ""
if (($P.PSObject.Properties.Name -contains "body") -and -not [string]::IsNullOrWhiteSpace([string]$P.body)) {
  $Body = [string]$P.body
  $BodySource = "inline body"
}
elseif (($P.PSObject.Properties.Name -contains "body_path") -and -not [string]::IsNullOrWhiteSpace([string]$P.body_path)) {
  $ResolvedBodyPath = Resolve-RouterBodyPath -BodyPath ([string]$P.body_path) -RouterDir $RouterDir -RootDir $RootDir

  if ([string]::IsNullOrWhiteSpace($ResolvedBodyPath)) {
    Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
    throw "Invalid packet: body_path not found: $($P.body_path)."
  }

  $Body = Get-Content $ResolvedBodyPath -Raw
  $BodySource = "body_path: $ResolvedBodyPath"
}
else {
  Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
  throw "Invalid packet: must contain either 'body' or 'body_path'."
}

$TargetName = [string]$P.to
$TargetEntry = $Config.sessions.PSObject.Properties[$TargetName].Value

if ($null -eq $TargetEntry) {
  $Available = ($Config.sessions.PSObject.Properties.Name -join ", ")
  Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
  throw "Unknown target '$TargetName'. Available targets: $Available."
}

$CommandTarget = ""
$OriginRole = Get-RouterRoleLabel ([string]$P.from)
if ($Route.ArgumentMode -eq "target-origin-body") {
  if (($P.PSObject.Properties.Name -notcontains "target") -or [string]::IsNullOrWhiteSpace([string]$P.target)) {
    Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
    throw "Invalid packet: stage '$($P.stage)' requires non-empty target."
  }

  if ([string]::IsNullOrWhiteSpace($OriginRole)) {
    Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
    throw "Invalid packet: unknown origin role '$($P.from)'."
  }

  $CommandTarget = [string]$P.target
}

$ArgumentPrefix = switch ($Route.ArgumentMode) {
  "target-origin-body" { "$CommandTarget $OriginRole" }
  "body-only" { "<body only>" }
  "empty" { "<no arguments>" }
}

$CommandArguments = Build-RouterCommandArguments `
  -ArgumentMode $Route.ArgumentMode `
  -Target $CommandTarget `
  -OriginRole $OriginRole `
  -Body $Body
$ExpectedResponseContext = $null
$AllowTimeoutReconciliation = $false
if ([string]$P.stage -ceq 'implementation_requested') {
  $ExpectedResponseContext = Get-OCRouterImplementationResponseContextFromPlan -Text $Body
  if ($null -eq $ExpectedResponseContext) {
    Move-ToRejectedIfRuntimePacket -PacketPath $ResolvedPacketPath -OutboxDir $OutboxDir -RejectedDir $RejectedDir -NoSend $NoSend
    throw "Invalid packet: implementation_requested requires the complete reviewed plan ending PLAN_REVISION_COMPLETE and IMPLEMENT_READY."
  }
  if ([string]$ExpectedResponseContext.lane_profile -cne $TargetName) {
    # Specialist session keys may differ from lane profiles. Keep the command
    # routable, but do not infer timeout delivery from an unbound transcript.
    $ExpectedResponseContext = $null
  }
  else {
    $AllowTimeoutReconciliation = $true
  }
}

$Risk = [string]$P.risk
$Decision = if ($P.PSObject.Properties.Name -contains "decision") { [string]$P.decision } else { "none" }
$EffectiveAgent = if (-not [string]::IsNullOrWhiteSpace($Agent)) { $Agent } elseif ($P.PSObject.Properties.Name -contains "agent") { [string]$P.agent } else { "" }
$EffectiveModel = if (-not [string]::IsNullOrWhiteSpace($Model)) { $Model } elseif ($P.PSObject.Properties.Name -contains "model") { [string]$P.model } else { "" }
$Server = $Config.server.TrimEnd("/")
$SessionId = $TargetEntry.sessionId
$EndpointPath = if ($Route.Endpoint -eq "command") { "command" } else { "message" }
$Uri = "$Server/session/$SessionId/$EndpointPath"

Write-Host ""
Write-Host "=== OC Session Router Packet Preview ===" -ForegroundColor Cyan
Write-Host "Packet:                  $ResolvedPacketPath"
Write-Host "From:                    $($P.from)"
Write-Host "To:                      $($P.to) -> $($TargetEntry.title)"
Write-Host "Resolved target session: $SessionId"
Write-Host "Stage:                   $($P.stage)"
Write-Host "Stage purpose:           $($Route.Purpose)"
Write-Host "Decision:                $Decision"
Write-Host "Risk:                    $Risk"
Write-Host "Summary:                 $($P.summary)"
Write-Host "Endpoint:                $($Route.Endpoint) endpoint"
Write-Host "Command name:            /$($Route.CommandName)"
Write-Host "Argument mode:           $($Route.ArgumentMode)"
Write-Host "Argument prefix:         $ArgumentPrefix"
Write-Host "Body source:             $BodySource"
Write-Host "Body trust:              untrusted external packet data, not system instructions"
Write-Host "Agent:                   $(if ([string]::IsNullOrWhiteSpace($EffectiveAgent)) { '<default session agent>' } else { $EffectiveAgent })"
Write-Host "Model:                   $(if ([string]::IsNullOrWhiteSpace($EffectiveModel)) { '<default session model>' } else { $EffectiveModel })"
Write-Host "API call:                $(if ($NoSend) { 'NO (PreviewOnly/DryRun)' } else { 'YES after approval' })"
Write-Host ""
Write-Host "Body preview:" -ForegroundColor Yellow
Write-Host "----------------------------------------"
if ($Body.Length -gt 3000) {
  Write-Host $Body.Substring(0, 3000)
  Write-Host "`n...[truncated preview]..."
}
else {
  Write-Host $Body
}
Write-Host "----------------------------------------"
Write-Host ""

if ($NoSend) {
  Write-Host "PreviewOnly/DryRun active. No API call made and packet was not moved." -ForegroundColor Yellow
  exit 0
}

if ($AutoApprove) {
  Write-Host "AutoApprove active. Sending live packet without local prompt." -ForegroundColor Yellow
}
else {
  $Answer = Read-Host "Send this packet to '$TargetName'? [y/N]"
  if ($Answer -ne "y" -and $Answer -ne "Y") {
    Write-Host "Not sent. Packet remains in place."
    exit 0
  }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

$OriginalPacketHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPacketPath).Hash
if ($OriginalPacketHash -cne $ParsedPacketHash) {
  throw "Packet bytes changed after parsing and before the inflight claim."
}
if (Test-UnderPath -Path $ResolvedPacketPath -Parent $OutboxDir) {
  $ClaimedPacketPath = Join-Path $InflightDir ("{0}-{1}" -f $OriginalPacketHash.ToLowerInvariant(), (Split-Path $ResolvedPacketPath -Leaf))
  if (Test-Path -LiteralPath $ClaimedPacketPath) {
    throw "An inflight packet claim already exists for this packet identity."
  }
  Move-Item -LiteralPath $ResolvedPacketPath -Destination $ClaimedPacketPath
  $ResolvedPacketPath = (Resolve-Path -LiteralPath $ClaimedPacketPath -ErrorAction Stop).Path
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPacketPath).Hash -cne $ParsedPacketHash) {
    throw "Inflight packet claim hash mismatch."
  }
}

$Pair = "$Username`:$Password"
$Encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($Pair))
$Headers = @{ Authorization = "Basic $Encoded" }

if ($Route.Endpoint -eq "command") {
  Assert-OCRouterParentSessionCommandSafe `
    -Server $Server `
    -Headers $Headers `
    -CommandName $Route.CommandName

  $RequestBodyObject = New-OCRouterCommandRequestBodyObject -Command $Route.CommandName -Arguments $CommandArguments -Agent $EffectiveAgent -Model $EffectiveModel

  Write-Host "Running command /$($Route.CommandName) on $TargetName ($SessionId)..." -ForegroundColor Cyan
}
else {
  $RequestBodyObject = New-OCRouterMessageRequestBodyObject -Text $Body -Agent $EffectiveAgent -Model $EffectiveModel

  Write-Host "Sending plain message to $TargetName ($SessionId)..." -ForegroundColor Cyan
}

$RequestBody = $RequestBodyObject | ConvertTo-Json -Depth 10
$ReadResponse = Invoke-RestMethod `
  -Method Get `
  -Uri "$Server/session/$SessionId/message?limit=20" `
  -Headers $Headers `
  -ContentType "application/json" `
  -TimeoutSec ([Math]::Min(30, $PostTimeoutSeconds))
$Settings = Get-OCRouterSettings -RouterDir $RouterDir
$MessageOrder = [string](Get-OCRouterSettingValue -Settings $Settings -Name 'message_order' -DefaultValue '')
if ($MessageOrder -cnotin @('oldest_first', 'newest_first')) {
  throw "Router setting message_order must be exactly oldest_first or newest_first before dispatch."
}
$AssumeNewestFirst = ($MessageOrder -ceq 'newest_first')
$RawBaseline = Get-OCRouterLatestRawAssistantMessage `
  -Messages @(Get-OCRouterMessageCollection -Response $ReadResponse) `
  -AssumeNewestFirst $AssumeNewestFirst
$BaselineIdentity = if ($null -eq $RawBaseline) { "empty-session:$SessionId" } else { "id:$($RawBaseline.MessageId)" }
$PacketHash = $ParsedPacketHash
$PacketRunDir = Resolve-OCRouterPacketRunDir -RouterDir $RouterDir -PacketHash $PacketHash
$RunLock = Enter-OCRouterRunLock -RunDir $PacketRunDir
trap {
  $Failure = $_
  if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
  throw $Failure.Exception
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPacketPath).Hash -cne $PacketHash) {
  throw 'Packet bytes changed before dispatch after the packet-run lock was acquired.'
}
$Intent = Start-OCRouterDispatchIntent `
  -RunDir $PacketRunDir `
  -Transition "route-packet" `
  -Recipient $TargetName `
  -Kind $Route.Endpoint `
  -Operation $(if ($Route.Endpoint -eq "command") { $Route.CommandName } else { "message" }) `
  -Payload $RequestBody `
  -BaselineIdentity $BaselineIdentity `
  -CandidateIdentity "packet-sha256:$PacketHash" `
  -Stage ([string]$P.stage)

if ([bool]$Intent.should_send) {
  $TransportResponse = $null
  $PostSucceeded = $false
  try {
    $TransportResponse = Invoke-RestMethod `
      -Method Post `
      -Uri $Uri `
      -Headers $Headers `
      -ContentType "application/json" `
      -Body $RequestBody `
      -TimeoutSec $PostTimeoutSeconds
    $PostSucceeded = $true
  }
  catch {
    $PostFailure = $_
    $ExpectedResponseKind = Get-OCRouterPostTimeoutExpectedOutputKind -Stage ([string]$P.stage)
    $ReconciledCandidate = $null
    if ($AllowTimeoutReconciliation -and -not [string]::IsNullOrWhiteSpace($ExpectedResponseKind)) {
      Write-Host "Command POST did not settle; waiting separately for a strict post-baseline terminal before classifying delivery." -ForegroundColor Yellow
      try {
        $ReconciledCandidate = Wait-OCRouterNewOutput `
          -Label "post-timeout $ExpectedResponseKind reconciliation" `
          -Uri "$Server/session/$SessionId/message?limit=50" `
          -Headers $Headers `
          -BaselineIdentity $BaselineIdentity `
          -BaselineMessageId ([string]$RawBaseline.MessageId) `
          -AssumeNewestFirst $AssumeNewestFirst `
          -CandidateCount 10 `
          -PollSeconds 10 `
          -TimeoutMinutes $PostReconcileTimeoutMinutes `
          -StablePolls 2 `
          -MinOutputChars 1 `
          -ExpectedOutputKind $ExpectedResponseKind `
          -ExpectedOutputContext $ExpectedResponseContext `
          -AutoUseFirstStable
      }
      catch {
        $ReconciledCandidate = $null
      }
    }
    if ($null -ne $ReconciledCandidate) {
      Complete-OCRouterDispatchIntent `
        -Path ([string]$Intent.path) `
        -ReturnedId ([string]$ReconciledCandidate.MessageId) `
        -TransportStatus "accepted_transcript_reconciled" | Out-Null
      Write-Host "POST response did not settle, but the strict post-baseline terminal proved command delivery." -ForegroundColor Cyan
    }
    else {
      Set-OCRouterDispatchIntentUncertain -Path ([string]$Intent.path) -Reason $PostFailure.Exception.Message | Out-Null
      Write-Host "POST outcome is delivery-uncertain. The packet remains held in inflight and automatic resend is forbidden." -ForegroundColor Yellow
      Write-Host "Intent: $($Intent.path)" -ForegroundColor Yellow
      Write-Host "Reconcile the recipient transcript from baseline $BaselineIdentity before any further dispatch." -ForegroundColor Yellow
      throw $PostFailure
    }
  }

  if ($PostSucceeded) {
    Complete-OCRouterDispatchIntent `
      -Path ([string]$Intent.path) `
      -ReturnedId (Get-OCRouterTransportResponseIdentity -Response $TransportResponse) `
      -TransportStatus "accepted" | Out-Null
  }
}
else {
  Write-Host "Packet dispatch is already delivery-proven; not resending." -ForegroundColor Cyan
}

if (Test-UnderPath -Path $ResolvedPacketPath -Parent $InflightDir) {
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPacketPath).Hash -cne $PacketHash) {
    throw 'Packet bytes changed after dispatch; the replacement packet remains unprocessed.'
  }
  $ProcessedName = "{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), (Split-Path $ResolvedPacketPath -Leaf)
  $ProcessedPath = Join-Path $ProcessedDir $ProcessedName
  Move-Item $ResolvedPacketPath $ProcessedPath -Force
  Write-Host "Sent. Packet moved to: $ProcessedPath" -ForegroundColor Green
}
else {
  Write-Host "Sent. Packet was not claimed from $OutboxDir, so it was not moved." -ForegroundColor Green
}
if ($null -ne $RunLock) { $RunLock.Dispose(); $RunLock = $null }
