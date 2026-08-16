[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$EventPath,
  [Parameter(Mandatory)][string]$TargetRoot,
  [Parameter(Mandatory)][string]$CanonRoot,
  [string]$RouterDir = ".opencode-router",
  [string]$Server = "",
  [Parameter(Mandatory)][string]$GlobalPolicyPath,
  [string]$ProjectPolicyPath = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "oc-router-common.ps1")
. (Join-Path $PSScriptRoot "session-compact-flow-core.ps1")

if (-not $DryRun) {
  throw 'Retained Compact V2 is reference-only; non-dry execution is retired. Use Compact Lite.'
}

function Resolve-CompactFlowLocalRoot {
  param([string]$Path, [string]$Label)
  if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path)) { throw "$Label must be an absolute local path." }
  $Full = [IO.Path]::GetFullPath($Path).TrimEnd([char[]]@('\','/'))
  $Root = [IO.Path]::GetPathRoot($Full)
  if ([string]::IsNullOrWhiteSpace($Root) -or $Root.StartsWith('\\')) { throw "$Label must be on a local fixed drive." }
  $Drive = New-Object IO.DriveInfo($Root)
  if ($Drive.DriveType -ne [IO.DriveType]::Fixed) { throw "$Label must be on a local fixed drive." }
  if (-not (Test-Path -LiteralPath $Full -PathType Container)) { throw "$Label is missing." }
  $Item = Get-Item -LiteralPath $Full -Force
  if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label cannot be a reparse point." }
  return $Full
}

function Resolve-CompactFlowContainedPath {
  param([string]$Root, [string]$Path, [string]$ExpectedRelativePrefix)
  $Full = if ([IO.Path]::IsPathRooted($Path)) { [IO.Path]::GetFullPath($Path) } else { [IO.Path]::GetFullPath((Join-Path $Root $Path)) }
  $ExpectedRoot = [IO.Path]::GetFullPath((Join-Path $Root $ExpectedRelativePrefix)).TrimEnd([char[]]@('\','/'))
  $Prefix = $ExpectedRoot + [IO.Path]::DirectorySeparatorChar
  if (-not $Full.StartsWith($Prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path must remain inside $ExpectedRelativePrefix." }
  $Relative = $Full.Substring(([IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\','/')) + [IO.Path]::DirectorySeparatorChar).Length)
  $null = Resolve-CompactFlowContainedFile -Root $Root -RelativePath $Relative
  return $Full
}

function Get-CompactFlowSessionId {
  param($Entry)
  if ($Entry -is [string]) { $Value = [string]$Entry }
  else {
    $Value = ''
    foreach ($Name in @('sessionId','sessionID','id')) {
      $Candidate = [string](Get-CompactFlowProperty -Value $Entry -Name $Name -DefaultValue '')
      if (-not [string]::IsNullOrWhiteSpace($Candidate)) { $Value = $Candidate; break }
    }
  }
  if ($Value -cnotmatch '^[A-Za-z0-9_-]{1,160}$') { throw 'Mapped session identity has an invalid shape.' }
  return $Value
}

function Get-CompactFlowResponseIdentity {
  param($Response)
  foreach ($Name in @('markerID','markerId','requestID','requestId','messageID','messageId','id')) {
    $Value = [string](Get-CompactFlowProperty -Value $Response -Name $Name -DefaultValue '')
    if (-not [string]::IsNullOrWhiteSpace($Value)) { return $Value }
  }
  return ''
}

function Get-CompactFlowCommandEntries {
  param([string]$BaseServer, [hashtable]$Headers)
  $Response = Invoke-RestMethod -Method Get -Uri "$($BaseServer.TrimEnd('/'))/command" -Headers $Headers -ContentType 'application/json' -TimeoutSec 30
  if ($Response -is [System.Array]) { return @($Response) }
  foreach ($Name in @('commands','data','items','results')) {
    if ($null -ne $Response.PSObject.Properties[$Name]) { return @($Response.$Name) }
  }
  return @($Response)
}

function Get-CompactFlowLiveCommandIdentity {
  param([object[]]$Entries, [string]$CommandName)
  $Normalized = $CommandName.Trim().TrimStart('/')
  $Matches = @($Entries | Where-Object { [string]$_.name -ceq $Normalized })
  if ($Matches.Count -ne 1) { throw "Live command '$Normalized' is missing or ambiguous." }
  $Entry = $Matches[0]
  foreach ($IdentityName in @('sha256','identity','commandIdentity','command_identity')) {
    $Identity = [string](Get-CompactFlowProperty -Value $Entry -Name $IdentityName -DefaultValue '')
    if ($Identity -match '^[a-f0-9]{64}$') { return $Identity }
  }
  $Projection = [ordered]@{}
  foreach ($Name in @(Get-CompactFlowPropertyNames -Value $Entry)) {
    if ($Name -cnotin @('name','source','path')) { $Projection[$Name] = Get-CompactFlowProperty -Value $Entry -Name $Name }
  }
  return Get-CompactFlowCommandEntryIdentity -Value ([pscustomobject]$Projection)
}

function Get-CompactFlowLiveCommandRegistryIdentity {
  param([object[]]$Entries)
  $Rows = New-Object System.Collections.Generic.List[string]
  foreach ($Entry in $Entries) {
    $Name = [string](Get-CompactFlowProperty -Value $Entry -Name 'name' -DefaultValue '')
    if ($Name -cnotmatch '^[a-z0-9][a-z0-9-]*$') { throw 'Live command registry contains an invalid command name.' }
    $Rows.Add("$Name|$(Get-CompactFlowLiveCommandIdentity -Entries $Entries -CommandName $Name)")
  }
  $Rows.Sort([StringComparer]::Ordinal)
  return Get-CompactFlowSha256Text -Text (@($Rows.ToArray()) -join "`n")
}

function Get-CompactFlowHydrationReport {
  param([string]$Text)
  $Confidence = [regex]::Matches($Text, '(?m)^Hydration confidence:\s*(VERIFIED|SUFFICIENT|PARTIAL|FAILED)\s*$')
  $Action = [regex]::Matches($Text, '(?m)^Hydration action:\s*(ROUTE_READY|AUTO_RESUME|PROOF_REQUIRED|CONFIRM|BLOCKED)\s*$')
  $Route = [regex]::Matches($Text, '(?m)^Route input:\s*(EXACT|MISSING|MISMATCH|NOT_REQUIRED)\s*$')
  if ($Confidence.Count -ne 1 -or $Action.Count -ne 1 -or $Route.Count -ne 1) { throw 'After-compact output lacks one strict V2 hydration classification.' }
  return [pscustomobject]@{ confidence=$Confidence[0].Groups[1].Value; action=$Action[0].Groups[1].Value; route_input=$Route[0].Groups[1].Value }
}

$TargetRootFull = Resolve-CompactFlowLocalRoot -Path $TargetRoot -Label 'Target root'
$EventFull = Resolve-CompactFlowContainedPath -Root $TargetRootFull -Path $EventPath -ExpectedRelativePrefix '.opencode-router\compact-events'
$EventRecord = Read-CompactFlowStrictJsonFile -Path $EventFull -Label 'Compact flow event'
$Event = $EventRecord.Value
[void](Assert-CompactFlowEvent -Event $Event)
if ([IO.Path]::GetFileName($EventFull) -cne ([string]$Event.event_id + '.json')) { throw 'Compact event filename must equal event_id.json.' }

$PolicyArguments = @{ GlobalPolicyPath=$GlobalPolicyPath; AsJson=$true }
if (-not [string]::IsNullOrWhiteSpace($ProjectPolicyPath)) { $PolicyArguments.ProjectPolicyPath = $ProjectPolicyPath }
$PolicyJson = [string](& (Join-Path $PSScriptRoot 'resolve-compact-policy.ps1') @PolicyArguments)
Assert-CompactFlowStrictJson -Text $PolicyJson -Label 'Compact policy resolution'
$PolicyResolution = $PolicyJson | ConvertFrom-Json
if (-not [bool]$PolicyResolution.valid) {
  [pscustomobject][ordered]@{
    schema_version='compact-flow-result/v1'
    event_id=[string]$Event.event_id
    boundary_id=[string]$Event.boundary_id
    policy_identity='UNDECLARED'
    boundary_path='UNDECLARED'
    boundary_sha256='UNDECLARED'
    dry_run=[bool]$DryRun
    results=@($Event.participants | ForEach-Object { [pscustomobject][ordered]@{ logical_session_ref=[string]$_.logical_session_ref; disposition='CONTINUE'; reason='GLOBAL_POLICY_INVALID_NO_COMPACT' } })
    privacy=[pscustomobject]@{ raw_session_ids_emitted=$false; endpoints_emitted=$false; transcripts_emitted=$false }
    diagnostics=@($PolicyResolution.diagnostics)
  } | ConvertTo-Json -Depth 20 -Compress
  return
}

$CanonRootFull = Resolve-CompactFlowLocalRoot -Path $CanonRoot -Label 'Canon root'
$ActiveRouteReceipt = $null
if (-not $DryRun) {
  if ($null -eq $Event.PSObject.Properties['active_route']) {
    [pscustomobject][ordered]@{
      schema_version='compact-flow-result/v1'; event_id=[string]$Event.event_id; boundary_id=[string]$Event.boundary_id
      policy_identity=[string]$PolicyResolution.effective_policy_sha256; boundary_path='UNDECLARED'; boundary_sha256='UNDECLARED'; dry_run=$false
      results=@($Event.participants | ForEach-Object { [pscustomobject][ordered]@{ logical_session_ref=[string]$_.logical_session_ref; disposition='BLOCKED'; reason='ACTIVE_ROUTE_VERIFICATION_REQUIRED' } })
      privacy=[pscustomobject]@{ raw_session_ids_emitted=$false; endpoints_emitted=$false; transcripts_emitted=$false }
    } | ConvertTo-Json -Depth 20 -Compress
    return
  }
  $ActiveRouteParticipants = @($Event.participants | Where-Object { [string]$_.profile_id -ceq [string]$Event.active_route.profile_id })
  if ($ActiveRouteParticipants.Count -ne 1) {
    [pscustomobject][ordered]@{
      schema_version='compact-flow-result/v1'; event_id=[string]$Event.event_id; boundary_id=[string]$Event.boundary_id
      policy_identity=[string]$PolicyResolution.effective_policy_sha256; boundary_path='UNDECLARED'; boundary_sha256='UNDECLARED'; dry_run=$false
      results=@($Event.participants | ForEach-Object { [pscustomobject][ordered]@{ logical_session_ref=[string]$_.logical_session_ref; disposition='BLOCKED'; reason='ACTIVE_ROUTE_PROFILE_AMBIGUOUS' } })
      privacy=[pscustomobject]@{ raw_session_ids_emitted=$false; endpoints_emitted=$false; transcripts_emitted=$false }
    } | ConvertTo-Json -Depth 20 -Compress
    return
  }
  $ActiveRouteParticipant = $ActiveRouteParticipants[0]
  $ActiveRouteWriterArguments = @{
    Operation='VERIFY'; TargetRoot=$TargetRootFull; RegistryRoot=(Join-Path $CanonRootFull 'registry')
    ProjectId=[string]$Event.project_id; ProfileId=[string]$Event.active_route.profile_id; ExpectedPriorGenerationId=[string]$Event.active_route.generation_id
    ExpectedStateRevision=[string]$Event.state_revision; ExpectedWaveId=[string]$Event.wave_id; ExpectedEpicId=[string]$Event.epic_id
    ExpectedWorkflowPhase=[string]$Event.workflow_phase; ExpectedCandidateIdentity=[string]$Event.candidate_identity; ExpectedConfigurationIdentity=[string]$Event.configuration_identity
    ExpectedNextActor=[string]$ActiveRouteParticipant.expected_next_actor; ExpectedNextCommand=[string]$ActiveRouteParticipant.expected_next_command
    ExpectedRouteInputMode=[string]$ActiveRouteParticipant.route_input.mode
  }
  foreach ($RouteExpectationName in @('path','sha256','logical_identity')) {
    if ($null -ne $ActiveRouteParticipant.route_input.PSObject.Properties[$RouteExpectationName]) {
      $WriterParameterName = switch ($RouteExpectationName) { 'path' {'ExpectedRouteInputPath'} 'sha256' {'ExpectedRouteInputSha256'} default {'ExpectedRouteInputLogicalIdentity'} }
      $ActiveRouteWriterArguments[$WriterParameterName] = [string]$ActiveRouteParticipant.route_input.$RouteExpectationName
    }
  }
  $ActiveRouteJson = [string](& (Join-Path $PSScriptRoot 'write-active-route-manifest.ps1') @ActiveRouteWriterArguments)
  $ActiveRouteExitCode = $LASTEXITCODE
  try {
    Assert-CompactFlowStrictJson -Text $ActiveRouteJson -Label 'Active-route verification receipt'
    $ActiveRouteReceipt = $ActiveRouteJson | ConvertFrom-Json
  }
  catch { $ActiveRouteExitCode = 17 }
  $ActiveRouteMatches = $ActiveRouteExitCode -eq 0 -and
    [string]$ActiveRouteReceipt.outcome -ceq 'VERIFIED' -and
    [string]$ActiveRouteReceipt.generation_id -ceq [string]$Event.active_route.generation_id -and
    [string]$ActiveRouteReceipt.source_identities.state_sha256 -ceq [string]$Event.active_route.state_sha256 -and
    [string]$ActiveRouteReceipt.source_identities.combined_sha256 -ceq [string]$Event.active_route.combined_sha256 -and
    [string]$ActiveRouteReceipt.source_identities.stage_sha256 -ceq [string]$Event.active_route.stage_sha256
  if (-not $ActiveRouteMatches) {
    [pscustomobject][ordered]@{
      schema_version='compact-flow-result/v1'; event_id=[string]$Event.event_id; boundary_id=[string]$Event.boundary_id
      policy_identity=[string]$PolicyResolution.effective_policy_sha256; boundary_path='UNDECLARED'; boundary_sha256='UNDECLARED'; dry_run=$false
      results=@($Event.participants | ForEach-Object { [pscustomobject][ordered]@{ logical_session_ref=[string]$_.logical_session_ref; disposition='BLOCKED'; reason='ACTIVE_ROUTE_VERIFICATION_FAILED' } })
      privacy=[pscustomobject]@{ raw_session_ids_emitted=$false; endpoints_emitted=$false; transcripts_emitted=$false }
    } | ConvertTo-Json -Depth 20 -Compress
    return
  }
}
$RouterDirFull = if ([IO.Path]::IsPathRooted($RouterDir)) { [IO.Path]::GetFullPath($RouterDir) } else { [IO.Path]::GetFullPath((Join-Path $TargetRootFull $RouterDir)) }
$ExpectedRouter = [IO.Path]::GetFullPath((Join-Path $TargetRootFull '.opencode-router'))
if (-not $RouterDirFull.Equals($ExpectedRouter, [StringComparison]::OrdinalIgnoreCase)) { throw 'RouterDir must be the target-local .opencode-router directory.' }
$RouterConfigRecord = Read-CompactFlowStrictJsonFile -Path (Resolve-CompactFlowContainedFile -Root $TargetRootFull -RelativePath '.opencode-router/sessions.json') -Label 'Router sessions registry'
$RouterConfig = $RouterConfigRecord.Value
if ([string]::IsNullOrWhiteSpace($Server)) { $Server = [string](Get-CompactFlowProperty -Value $RouterConfig -Name 'server' -DefaultValue '') }
if ($Server -cnotmatch '^https?://(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$') { throw 'Server must be an explicit loopback HTTP(S) endpoint.' }
$Headers = if ([string]::IsNullOrWhiteSpace($env:OPENCODE_SERVER_PASSWORD)) { @{} } else { New-OCRouterBasicAuthHeader -Username $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { 'opencode' }) -Password $env:OPENCODE_SERVER_PASSWORD }

$RunPath = Join-Path $RouterDirFull ("compact-runs\$($Event.boundary_id).json")
$BoundaryLockPath = $RunPath + '.lock'
$BoundaryLock = $null
if (-not $DryRun) {
  $BoundaryLockParent = Split-Path -Parent $BoundaryLockPath
  if (-not (Test-Path -LiteralPath $BoundaryLockParent -PathType Container)) { [void](New-Item -ItemType Directory -Path $BoundaryLockParent -Force) }
  $BoundaryLock = [IO.File]::Open($BoundaryLockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
}

try {
  $ParticipantLedgerPath = Join-Path $RouterDirFull ("compact-participants\$($Event.project_id)\$($Event.epic_id).json")
  $ParticipantLock = $null
  if (-not $DryRun) {
    $ParticipantLockPath = $ParticipantLedgerPath + '.lock'
    $ParticipantLockParent = Split-Path -Parent $ParticipantLockPath
    if (-not (Test-Path -LiteralPath $ParticipantLockParent -PathType Container)) { [void](New-Item -ItemType Directory -Path $ParticipantLockParent -Force) }
    $ParticipantLock = [IO.File]::Open($ParticipantLockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  }
  try {
    $ExistingParticipants = @()
    if (Test-Path -LiteralPath $ParticipantLedgerPath -PathType Leaf) {
      $ParticipantLedger = Read-CompactFlowStrictJsonFile -Path $ParticipantLedgerPath -Label 'Compact participant ledger'
      if ([string]$ParticipantLedger.Value.project_id -cne [string]$Event.project_id -or [string]$ParticipantLedger.Value.epic_id -cne [string]$Event.epic_id) { throw 'Participant ledger project or Epic identity mismatch.' }
      $ExistingParticipants = @($ParticipantLedger.Value.participants)
    }
    $Participants = Merge-CompactFlowParticipants -Existing $ExistingParticipants -Incoming @($Event.participants)
    $ParticipantLedgerOutput = [pscustomobject][ordered]@{
      schema_version='compact-participant-ledger/v1'; project_id=[string]$Event.project_id; epic_id=[string]$Event.epic_id
      participants=@($Participants); updated_utc=[datetime]::UtcNow.ToString('o')
    }
    $Boundary = New-CompactFlowBoundary -Event $Event -Participants $Participants
    $BoundaryRelative = ".fal/compact-boundaries/$($Event.boundary_id).json"
    $BoundaryPath = Join-Path $TargetRootFull $BoundaryRelative.Replace('/', [IO.Path]::DirectorySeparatorChar)
    $BoundaryHash = Get-CompactFlowObjectIdentity -Value $Boundary

    if (-not $DryRun) {
      if ($null -ne $Event.PSObject.Properties['stage_artifact']) {
        $StageSnapshot = Open-CompactFlowRouteSnapshot -Root $TargetRootFull -RelativePath ([string]$Event.stage_artifact.path) -ExpectedSha256 ([string]$Event.stage_artifact.sha256)
        $StageSnapshot.stream.Dispose()
      }
      if ($null -ne $Event.PSObject.Properties['closeout']) {
        $ReceiptSnapshot = Open-CompactFlowRouteSnapshot -Root $TargetRootFull -RelativePath ([string]$Event.closeout.receipt_path) -ExpectedSha256 ([string]$Event.closeout.receipt_identity)
        $ReceiptSnapshot.stream.Dispose()
      }
      foreach ($RouteParticipant in $Participants) {
        if ([string]$RouteParticipant.route_input.mode -ceq 'PINNED_ARTIFACT') {
          $RouteProofSnapshot = Open-CompactFlowRouteSnapshot -Root $TargetRootFull -RelativePath ([string]$RouteParticipant.route_input.path) -ExpectedSha256 ([string]$RouteParticipant.route_input.sha256)
          $RouteProofSnapshot.stream.Dispose()
        }
      }
      Write-CompactFlowAtomicJson -Path $ParticipantLedgerPath -Value $ParticipantLedgerOutput
      Write-CompactFlowAtomicJson -Path $BoundaryPath -Value $Boundary
      $BoundaryHash = Get-CompactFlowFileSha256 -Path $BoundaryPath
    }
  } finally {
    if ($null -ne $ParticipantLock) { $ParticipantLock.Dispose() }
  }

$SelectedParticipants = if ([string]$Event.event_type -ceq 'epic_closeout') { @($Participants) } else { @($Event.participants) }
$Results = New-Object System.Collections.Generic.List[object]

foreach ($Participant in $SelectedParticipants) {
  $LogicalRef = [string]$Participant.logical_session_ref
  $Entry = Get-OCRouterSessionEntry -Config $RouterConfig -Name $LogicalRef
  $SessionId = Get-CompactFlowSessionId -Entry $Entry
  $TelemetryArgs = @{
    Target=$LogicalRef
    Server=$Server
    RouterDir=$RouterDirFull
    WarnRatio=[double]$PolicyResolution.effective_policy.warn_ratio
    CriticalRatio=[double]$PolicyResolution.effective_policy.critical_ratio
    PolicyIdentity=[string]$PolicyResolution.effective_policy_sha256
  }
  $TelemetryJson = [string](& (Join-Path $PSScriptRoot 'session-context-status.ps1') @TelemetryArgs)
  Assert-CompactFlowStrictJson -Text $TelemetryJson -Label 'Session context telemetry'
  $Telemetry = $TelemetryJson | ConvertFrom-Json
  $Decision = Get-CompactFlowPressureDecision -Event $Event -PolicyResolution $PolicyResolution -Telemetry $Telemetry -ProfileId ([string]$Participant.profile_id)

  if ($DryRun) {
    $Results.Add([pscustomobject][ordered]@{ logical_session_ref=$LogicalRef; disposition=[string]$Decision.disposition; reason=[string]$Decision.reason })
    continue
  }

  $Manual = @($Event.manual_compact_participants) -ccontains $LogicalRef
  $PreflightDisposition = 'PASS'
  if ([string]$Decision.disposition -ceq 'AUTO_COMPACT' -and -not $Manual) {
    try {
      $PreflightCommandIdentity = ''
      $PreflightEntries = $null
      if ([string]$Participant.resume_mode -in @('ROUTE_READY','AUTO_RESUME')) {
        $PreflightEntries = Get-CompactFlowCommandEntries -BaseServer $Server -Headers $Headers
        if ($null -ne $Event.PSObject.Properties['host_attestation']) {
          $LiveRegistryIdentity = Get-CompactFlowLiveCommandRegistryIdentity -Entries $PreflightEntries
          if ($LiveRegistryIdentity -cne [string]$Event.host_attestation.command_registry_identity) { throw 'Live command registry identity differs from the boundary host attestation.' }
        }
        $PreflightCommandIdentity = Get-CompactFlowLiveCommandIdentity -Entries $PreflightEntries -CommandName ([string]$Participant.expected_next_command)
        if ($PreflightCommandIdentity -cne [string]$Participant.selected_command_identity) { throw 'Live selected-command identity differs from the boundary expectation.' }
      }
      if ($null -eq $PreflightEntries) { $PreflightEntries = Get-CompactFlowCommandEntries -BaseServer $Server -Headers $Headers }
      $LiveRegistryIdentity = Get-CompactFlowLiveCommandRegistryIdentity -Entries $PreflightEntries
      if ($LiveRegistryIdentity -cne [string]$Event.host_attestation.command_registry_identity) { throw 'Live command registry identity differs from the boundary host attestation.' }
      $AfterCompactIdentity = Get-CompactFlowLiveCommandIdentity -Entries $PreflightEntries -CommandName 'after-compact'
      if ($AfterCompactIdentity -cne [string]$Event.host_attestation.after_compact_command_identity) { throw 'Live after-compact command identity differs from the boundary expectation.' }
      $PreflightArgs = @{ CompactBoundaryPath=$BoundaryPath; TargetRoot=$TargetRootFull; RoleHint=[string]$Participant.role_hint; RegistryRoot=(Join-Path $CanonRootFull 'registry'); PrivateRuntimeMappingPresent=$true; AsJson=$true }
      if (-not [string]::IsNullOrWhiteSpace($PreflightCommandIdentity)) { $PreflightArgs.VerifiedSelectedCommandIdentity = $PreflightCommandIdentity }
      $PreflightJson = [string](& (Join-Path $CanonRootFull 'scripts\resolve-hydration.ps1') @PreflightArgs)
      Assert-CompactFlowStrictJson -Text $PreflightJson -Label 'Canon compact preflight'
      $Preflight = $PreflightJson | ConvertFrom-Json
      if ([string]$Preflight.confidence -ceq 'FAILED' -or [string]$Preflight.action -ceq 'BLOCKED') { $PreflightDisposition = 'BLOCKED' }
      elseif ([string]$Participant.resume_mode -in @('ROUTE_READY','AUTO_RESUME') -and ([string]$Preflight.action -cnotin @('ROUTE_READY','AUTO_RESUME') -or [string]$Preflight.route_input.status -cne 'EXACT')) { $PreflightDisposition = 'PROOF_REQUIRED' }
    } catch { $PreflightDisposition = 'BLOCKED' }
  }

    $RunDocument = if (Test-Path -LiteralPath $RunPath -PathType Leaf) {
      (Read-CompactFlowStrictJsonFile -Path $RunPath -Label 'Compact run ledger').Value
    } else {
      [pscustomobject][ordered]@{ schema_version='compact-run-ledger/v1'; boundary_id=[string]$Event.boundary_id; project_id=[string]$Event.project_id; epic_id=[string]$Event.epic_id; runs=@(); updated_utc=[datetime]::UtcNow.ToString('o') }
    }
    if ([string]$RunDocument.boundary_id -cne [string]$Event.boundary_id -or [string]$RunDocument.project_id -cne [string]$Event.project_id -or [string]$RunDocument.epic_id -cne [string]$Event.epic_id) { throw 'Compact run ledger identity mismatch.' }
    $PriorRun = Get-CompactFlowPriorRunDisposition -RunDocument $RunDocument -EventId ([string]$Event.event_id) -LogicalSessionRef $LogicalRef
    if ([string]$PriorRun.disposition -cne 'READY') {
      $Results.Add([pscustomobject]@{ logical_session_ref=$LogicalRef; disposition=[string]$PriorRun.disposition; reason=[string]$PriorRun.reason })
      continue
    }
    $Persist = {
      param($State)
      $Others = @($RunDocument.runs | Where-Object { -not ([string]$_.event_id -ceq [string]$State.event_id -and [string]$_.logical_session_ref -ceq [string]$State.logical_session_ref) })
      $RunDocument.runs = @($Others) + @($State)
      $RunDocument.updated_utc = [datetime]::UtcNow.ToString('o')
      Write-CompactFlowAtomicJson -Path $RunPath -Value $RunDocument
    }.GetNewClosure()
    $GetMarkers = {
      $Encoded = [Uri]::EscapeDataString($SessionId)
      $Context = Invoke-RestMethod -Method Get -Uri "$($Server.TrimEnd('/'))/api/session/$Encoded/context" -Headers $Headers -TimeoutSec 30
      return Get-CompactFlowMarkerSet -ActiveContext @(Get-OCRouterMessageCollection -Response $Context)
    }.GetNewClosure()
    $SendSummarize = {
      $Provider = [string]$Telemetry.model.provider_id; $Model = [string]$Telemetry.model.model_id
      $Body = @{ providerID=$Provider; modelID=$Model } | ConvertTo-Json -Compress
      try {
        $Encoded = [Uri]::EscapeDataString($SessionId)
        $Response = Invoke-RestMethod -Method Post -Uri "$($Server.TrimEnd('/'))/session/$Encoded/summarize" -Headers $Headers -ContentType 'application/json' -Body $Body -TimeoutSec 60
        return [pscustomobject]@{ status='success'; marker_identity=(Get-CompactFlowResponseIdentity -Response $Response); outstanding_intent_count=1; competing_manual_signal=$false }
      } catch {
        $StatusCode = 0
        if ($null -ne $_.Exception.Response) { try { $StatusCode = [int]$_.Exception.Response.StatusCode } catch {} }
        $Status = if ($StatusCode -ge 400 -and $StatusCode -lt 500) { 'rejected_before_acceptance' } elseif ($_.Exception -is [System.Net.WebException] -and $_.Exception.Status -eq [System.Net.WebExceptionStatus]::Timeout) { 'timeout' } else { 'exception' }
        return [pscustomobject]@{ status=$Status; marker_identity=''; outstanding_intent_count=1; competing_manual_signal=$false }
      }
    }.GetNewClosure()
    $Hydrate = {
      $CommandEntries = Get-CompactFlowCommandEntries -BaseServer $Server -Headers $Headers
      $CurrentRegistryIdentity = Get-CompactFlowLiveCommandRegistryIdentity -Entries $CommandEntries
      $CurrentAfterCompactIdentity = Get-CompactFlowLiveCommandIdentity -Entries $CommandEntries -CommandName 'after-compact'
      if ($CurrentRegistryIdentity -cne [string]$Event.host_attestation.command_registry_identity -or $CurrentAfterCompactIdentity -cne [string]$Event.host_attestation.after_compact_command_identity) { return [pscustomobject]@{ verification='BLOCKED'; confidence='FAILED'; action='BLOCKED'; route_input=[pscustomobject]@{ status='MISMATCH' } } }
      $VerifiedIdentity = ''
      if ([string]$Participant.resume_mode -in @('ROUTE_READY','AUTO_RESUME')) {
        $VerifiedIdentity = Get-CompactFlowLiveCommandIdentity -Entries $CommandEntries -CommandName ([string]$Participant.expected_next_command)
        if ($VerifiedIdentity -cne [string]$Participant.selected_command_identity) { return [pscustomobject]@{ verification='BLOCKED'; confidence='FAILED'; action='BLOCKED'; route_input=[pscustomobject]@{ status='MISMATCH' } } }
      }
      $InvokerArgs = @{ CompactBoundaryPath=$BoundaryPath; TargetRoot=$TargetRootFull; RoleHint=[string]$Participant.role_hint; RegistryRoot=(Join-Path $CanonRootFull 'registry'); PrivateRuntimeMappingPresent=$true; AsJson=$true }
      if (-not [string]::IsNullOrWhiteSpace($VerifiedIdentity)) { $InvokerArgs.VerifiedSelectedCommandIdentity = $VerifiedIdentity }
      $HydrationJson = [string](& (Join-Path $CanonRootFull 'scripts\invoke-hydration.ps1') @InvokerArgs)
      Assert-CompactFlowStrictJson -Text $HydrationJson -Label 'Canon hydration result'
      $HydrationResult = $HydrationJson | ConvertFrom-Json
      if ([string]$HydrationResult.verification -cne 'PASS') { return $HydrationResult }

      $ReadUri = "$($Server.TrimEnd('/'))/session/$([Uri]::EscapeDataString($SessionId))/message?limit=40"
      $MessageResponse = Invoke-RestMethod -Method Get -Uri $ReadUri -Headers $Headers -TimeoutSec 30
      $Baseline = Get-OCRouterLatestRawAssistantMessage -Messages @(Get-OCRouterMessageCollection -Response $MessageResponse) -AssumeNewestFirst $true
      if ($null -eq $Baseline) { throw 'Cannot establish after-compact assistant baseline.' }
      $AfterBody = New-OCRouterCommandRequestBodyObject -Command 'after-compact' -Arguments (([string]$Event.project_id) + ' ' + ([string]$Participant.role_hint))
      $null = Invoke-RestMethod -Method Post -Uri "$($Server.TrimEnd('/'))/session/$([Uri]::EscapeDataString($SessionId))/command" -Headers $Headers -ContentType 'application/json' -Body ($AfterBody | ConvertTo-Json -Depth 10) -TimeoutSec 60
      $Deadline = [datetime]::UtcNow.AddMinutes(5); $Candidate = $null
      while ([datetime]::UtcNow -lt $Deadline -and $null -eq $Candidate) {
        Start-Sleep -Seconds 2
        $Messages = Invoke-RestMethod -Method Get -Uri $ReadUri -Headers $Headers -TimeoutSec 30
        $Candidates = @(Get-OCRouterLatestOutputCandidates -Messages @(Get-OCRouterMessageCollection -Response $Messages) -CandidateCount 1 -AssumeNewestFirst $true -AfterMessageId ([string]$Baseline.MessageId))
        if ($Candidates.Count -eq 1) { $Candidate = $Candidates[0] }
      }
      if ($null -eq $Candidate) { throw 'After-compact hydration output timed out.' }
      $Report = Get-CompactFlowHydrationReport -Text ([string]$Candidate.Text)
      if ([string]$Report.confidence -cne [string]$HydrationResult.confidence -or [string]$Report.action -cne [string]$HydrationResult.action -or [string]$Report.route_input -cne [string]$HydrationResult.route_input.status) { throw 'After-compact report disagrees with direct Canon verification.' }
       return $HydrationResult
     }.GetNewClosure()

    $Result = Invoke-CompactFlowParticipantMachine -Event $Event -PolicyResolution $PolicyResolution -Participant $Participant -Telemetry $Telemetry -GetMarkers $GetMarkers -SendSummarize $SendSummarize -Hydrate $Hydrate -Persist $Persist -ManualCompact $Manual -PreflightDisposition $PreflightDisposition -ActiveRouteReceipt $ActiveRouteReceipt
    $Results.Add([pscustomobject][ordered]@{ logical_session_ref=$LogicalRef; disposition=[string]$Result.disposition; reason=[string]$Result.reason; final_state=[string]$Result.run_state.state; generation_sha256=[string]$Result.run_state.generation_sha256 })
}

  $FlowResult = [pscustomobject][ordered]@{
    schema_version='compact-flow-result/v1'
    event_id=[string]$Event.event_id
    boundary_id=[string]$Event.boundary_id
    policy_identity=[string]$PolicyResolution.effective_policy_sha256
    boundary_path=$BoundaryRelative
    boundary_sha256=$BoundaryHash
    dry_run=[bool]$DryRun
    results=@($Results.ToArray())
    privacy=[pscustomobject]@{ raw_session_ids_emitted=$false; endpoints_emitted=$false; transcripts_emitted=$false }
  }
} finally {
  if ($null -ne $BoundaryLock) { $BoundaryLock.Dispose() }
}

$FlowResult | ConvertTo-Json -Depth 20 -Compress
