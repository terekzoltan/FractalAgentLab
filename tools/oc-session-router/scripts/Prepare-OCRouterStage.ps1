param(
  [Parameter(Mandatory=$true)][string]$TargetRoot,
  [Parameter(Mandatory=$true)][string]$SpecificationPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')
. (Join-Path $PSScriptRoot 'session-compact-flow-core.ps1')

function Assert-OrdinaryAbsolute {
  param([string]$Path, [bool]$Directory, [string]$Label)
  if (-not [System.IO.Path]::IsPathRooted($Path) -or -not (Test-Path -LiteralPath $Path)) { throw "$Label must be a pre-created absolute path." }
  $Item = Get-Item -LiteralPath $Path -Force
  if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label cannot be a reparse point." }
  if ($Directory -ne $Item.PSIsContainer) { throw "$Label has the wrong item type." }
  return $Item.FullName
}

function Assert-ClosedShape {
  param([object]$Value, [string[]]$Fields, [string]$Label)
  if ($null -eq $Value -or $Value -isnot [psobject]) { throw "$Label must be an object." }
  $Actual = @($Value.PSObject.Properties.Name | Sort-Object)
  $Expected = @($Fields | Sort-Object)
  if (($Actual -join "`n") -ne ($Expected -join "`n")) { throw "$Label has missing or unknown fields." }
}

function Assert-OpaqueId {
  param([string]$Value, [string]$Label)
  if ($Value -notmatch '^[A-Za-z0-9][A-Za-z0-9._@:+~-]{0,199}$') { throw "$Label is invalid." }
}

function Assert-SafeRelativePath {
  param([string]$Value, [string]$Label)
  if ([string]::IsNullOrWhiteSpace($Value) -or [System.IO.Path]::IsPathRooted($Value) -or $Value -match '(^|[\\/])\.\.([\\/]|$)' -or $Value.Contains(':')) { throw "$Label must be a safe relative path." }
}

function Resolve-ContainedOrdinaryFile {
  param([string]$Root, [string]$Relative, [string]$Label)
  Assert-SafeRelativePath -Value $Relative -Label $Label
  $RootPrefix = [System.IO.Path]::GetFullPath($Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  $Candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $Relative))
  if (-not $Candidate.StartsWith($RootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "$Label escapes the target root." }
  $Current = $Root
  foreach ($Segment in ($Relative -split '[\\/]' | Where-Object { $_ })) {
    $Current = Join-Path $Current $Segment
    if (-not (Test-Path -LiteralPath $Current)) { throw "$Label is missing." }
    $Item = Get-Item -LiteralPath $Current -Force
    if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label traverses a reparse point." }
  }
  if ((Get-Item -LiteralPath $Candidate -Force).PSIsContainer) { throw "$Label must be a file." }
  return $Candidate
}

function Get-Sha256Text {
  param([string]$Text)
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  return [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()
}

function Write-NewUtf8Pair {
  param([string]$FirstPath, [string]$FirstText, [string]$SecondPath, [string]$SecondText)
  if ((Test-Path -LiteralPath $FirstPath) -or (Test-Path -LiteralPath $SecondPath)) { throw 'Prepare will not overwrite either candidate in the output pair.' }
  $FirstTemp = "$FirstPath.tmp.$([Guid]::NewGuid().ToString('N'))"
  $SecondTemp = "$SecondPath.tmp.$([Guid]::NewGuid().ToString('N'))"
  $FirstPublished = $false
  try {
    [System.IO.File]::WriteAllText($FirstTemp, $FirstText, $Utf8NoBom)
    [System.IO.File]::WriteAllText($SecondTemp, $SecondText, $Utf8NoBom)
    [System.IO.File]::Move($FirstTemp, $FirstPath)
    $FirstPublished = $true
    [System.IO.File]::Move($SecondTemp, $SecondPath)
  }
  catch {
    if ($FirstPublished -and (Test-Path -LiteralPath $FirstPath)) { Remove-Item -LiteralPath $FirstPath -Force }
    throw
  }
  finally {
    if (Test-Path -LiteralPath $FirstTemp) { Remove-Item -LiteralPath $FirstTemp -Force }
    if (Test-Path -LiteralPath $SecondTemp) { Remove-Item -LiteralPath $SecondTemp -Force }
  }
}

$TargetRoot = Assert-OrdinaryAbsolute -Path $TargetRoot -Directory $true -Label 'Target root'
$SpecificationPath = Assert-OrdinaryAbsolute -Path $SpecificationPath -Directory $false -Label 'Preparation specification'
$OutputDirectory = Assert-OrdinaryAbsolute -Path $OutputDirectory -Directory $true -Label 'Output directory'

$SpecText = Get-Content -LiteralPath $SpecificationPath -Raw
Assert-CompactFlowStrictJson -Text $SpecText -Label 'Preparation specification'
$Spec = $SpecText | ConvertFrom-Json
Assert-ClosedShape -Value $Spec -Fields @('schema_version','target_id','epic','candidate_identity','target_state_path','expected_target_state_sha256','manifest_target_path','entries') -Label 'Preparation specification'
if ($Spec.schema_version -ne 'router-stage-prepare-spec.v1') { throw 'Preparation specification schema mismatch.' }
foreach ($Identity in @(@($Spec.target_id,'target_id'), @($Spec.epic,'epic'), @($Spec.candidate_identity,'candidate_identity'))) { Assert-OpaqueId -Value ([string]$Identity[0]) -Label ([string]$Identity[1]) }
Assert-SafeRelativePath -Value ([string]$Spec.target_state_path) -Label 'target_state_path'
Assert-SafeRelativePath -Value ([string]$Spec.manifest_target_path) -Label 'manifest_target_path'
if ([string]$Spec.expected_target_state_sha256 -notmatch '^[a-f0-9]{64}$') { throw 'expected_target_state_sha256 is invalid.' }
$StateFile = Resolve-ContainedOrdinaryFile -Root $TargetRoot -Relative ([string]$Spec.target_state_path) -Label 'Target state'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $StateFile).Hash.ToLowerInvariant() -ne [string]$Spec.expected_target_state_sha256) { throw 'SOURCE_IDENTITY_CHANGED: target state hash differs from the explicit specification.' }
if ($Spec.entries -isnot [array] -or $Spec.entries.Count -eq 0) { throw 'Preparation entries must be a nonempty array.' }

$Stages = @('SEQ_NEXT','PLAN_REVIEW','PLAN_REVISION','IMPLEMENT','STEP_REVIEW','DELIVERY_RESPONSE','CLOSEOUT')
$PlanClasses = @('EPIC_PLAN','REVIEW_FIX_PLAN')
$SourceClasses = @('PLANNING_CONTEXT','PLAN','META_PLAN_REVIEW','REVISED_PLAN','IMPLEMENTATION_RESULT','ACCEPTANCE_EVIDENCE','FINAL_SYNTHESIS','DELIVERY_RESPONSE','PROPOSED_DELTA','CLOSEOUT_AUTHORITY')
$ManifestEntries = @()
$EntryKeys = @{}
foreach ($Entry in @($Spec.entries)) {
  Assert-ClosedShape -Value $Entry -Fields @('stage','plan_class','sources') -Label 'Preparation entry'
  if ([string]$Entry.stage -notin $Stages -or [string]$Entry.plan_class -notin $PlanClasses) { throw 'Preparation stage or plan class is invalid.' }
  $EntryKey = "$($Entry.stage)|$($Entry.plan_class)"
  if ($EntryKeys.ContainsKey($EntryKey)) { throw 'Preparation contains a duplicate stage and plan class.' }
  $EntryKeys[$EntryKey] = $true
  if ($Entry.sources -isnot [array]) { throw 'Preparation sources must be an array.' }
  $Sources = @()
  $Index = 0
  $SourceKeys = @{}
  foreach ($Source in @($Entry.sources)) {
    Assert-ClosedShape -Value $Source -Fields @('path','source_class','logical_identity','producer','order') -Label 'Preparation source'
    Assert-SafeRelativePath -Value ([string]$Source.path) -Label 'Source path'
    if ([string]$Source.source_class -notin $SourceClasses -or [int]$Source.order -ne $Index) { throw 'Preparation source class or order is invalid.' }
    Assert-OpaqueId -Value ([string]$Source.logical_identity) -Label 'Source logical identity'
    Assert-OpaqueId -Value ([string]$Source.producer) -Label 'Source producer'
    $SourceKey = "$($Source.source_class)|$($Source.path)|$($Source.logical_identity)"
    if ($SourceKeys.ContainsKey($SourceKey)) { throw 'Preparation contains a duplicate source binding.' }
    $SourceKeys[$SourceKey] = $true
    $SourceFile = Resolve-ContainedOrdinaryFile -Root $TargetRoot -Relative ([string]$Source.path) -Label 'Explicit source'
    $Sources += [ordered]@{
      path = [string]$Source.path
      source_class = [string]$Source.source_class
      logical_identity = [string]$Source.logical_identity
      producer = [string]$Source.producer
      sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $SourceFile).Hash.ToLowerInvariant()
      order = $Index
    }
    $Index++
  }
  $ManifestEntries += [ordered]@{ stage = [string]$Entry.stage; plan_class = [string]$Entry.plan_class; sources = $Sources }
}

$Manifest = [ordered]@{
  schema_version = 'stage-source-manifest.v1'
  target_id = [string]$Spec.target_id
  epic = [string]$Spec.epic
  candidate_identity = [string]$Spec.candidate_identity
  entries = $ManifestEntries
}
$ManifestText = ($Manifest | ConvertTo-Json -Depth 30 -Compress) + "`n"
$ManifestSha256 = Get-Sha256Text -Text $ManifestText
$ManifestCandidate = Join-Path $OutputDirectory 'stage-sources.candidate.json'

$StatePacket = [ordered]@{
  schema_version = 'router-stage-state-packet.v1'
  target_id = [string]$Spec.target_id
  epic = [string]$Spec.epic
  candidate_identity = [string]$Spec.candidate_identity
  target_state_path = [string]$Spec.target_state_path
  expected_target_state_sha256 = [string]$Spec.expected_target_state_sha256
  manifest_target_path = [string]$Spec.manifest_target_path
  stage_source_manifest_sha256 = $ManifestSha256
  source_set_sha256 = Get-Sha256Text -Text (($ManifestEntries | ConvertTo-Json -Depth 30 -Compress) + "`n")
  prepared_at = [DateTime]::UtcNow.ToString('o')
  authority_source_selection = 'OPERATOR_EXPLICIT'
  network_send = $false
}
$StatePacketText = ($StatePacket | ConvertTo-Json -Depth 20 -Compress) + "`n"
$StatePacketCandidate = Join-Path $OutputDirectory 'stage-state-packet.candidate.json'
Write-NewUtf8Pair -FirstPath $ManifestCandidate -FirstText $ManifestText -SecondPath $StatePacketCandidate -SecondText $StatePacketText

[ordered]@{
  schema_version = 'router-stage-prepare-receipt.v1'
  manifest_candidate = 'stage-sources.candidate.json'
  state_packet_candidate = 'stage-state-packet.candidate.json'
  stage_source_manifest_sha256 = $ManifestSha256
  state_packet_sha256 = Get-Sha256Text -Text $StatePacketText
  source_count = @($ManifestEntries | ForEach-Object { @($_.sources).Count } | Measure-Object -Sum).Sum
  authority_source_selection = 'OPERATOR_EXPLICIT'
  network_send = $false
  paths_emitted = $false
} | ConvertTo-Json -Compress
