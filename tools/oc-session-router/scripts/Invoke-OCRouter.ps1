param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('new-run','invoke-stage','resolve-stage','get-run')]
  [string]$Operation,

  [string]$RequestPath,
  [string]$RunId,
  [string]$OperationId
)

function Invoke-WithRouterEnvironment {
  param([scriptblock]$Action)
  $AllowedEnvironment = @('SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','HOME','LOCALAPPDATA','APPDATA','OC_ROUTER_RUNTIME_ROOT','OC_ROUTER_CONTROL_REGISTRY','OPENCODE_SERVER_USERNAME','OPENCODE_SERVER_PASSWORD')
  $SavedEnvironment = @{}
  foreach ($EntryName in @([Environment]::GetEnvironmentVariables('Process').Keys)) {
    $Name = [string]$EntryName
    $SavedEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($AllowedEnvironment -notcontains $Name) { [Environment]::SetEnvironmentVariable($Name, $null, 'Process') }
  }
  try {
    & $Action
  }
  finally {
    foreach ($EntryName in @([Environment]::GetEnvironmentVariables('Process').Keys)) {
      if (-not $SavedEnvironment.ContainsKey([string]$EntryName)) { [Environment]::SetEnvironmentVariable([string]$EntryName, $null, 'Process') }
    }
    foreach ($EntryName in $SavedEnvironment.Keys) { [Environment]::SetEnvironmentVariable([string]$EntryName, [string]$SavedEnvironment[$EntryName], 'Process') }
  }
}

$ErrorActionPreference = 'Stop'
$RuntimeRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'runtime'
$AttestationPath = Join-Path $RuntimeRoot 'executable-attestation.json'
$ExpectedAttestationSha256 = 'a17163ee06820342590c6400824e489b6ceef161b81d16961292d262bebd1bff'

function Assert-OrdinaryContainedFile {
  param([string]$Path, [string]$ContainmentRoot, [string]$Label)
  if (-not [System.IO.Path]::IsPathRooted($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing or not absolute." }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label cannot be a reparse point." }
  if (-not [string]::IsNullOrWhiteSpace($ContainmentRoot)) {
    $root = [System.IO.Path]::GetFullPath($ContainmentRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $candidate = [System.IO.Path]::GetFullPath($item.FullName)
    if (-not $candidate.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { throw "$Label escapes the runtime root." }
  }
  return $item.FullName
}

$AttestationPath = Assert-OrdinaryContainedFile -Path $AttestationPath -ContainmentRoot $RuntimeRoot -Label 'Executable attestation'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $AttestationPath).Hash.ToLowerInvariant() -ne $ExpectedAttestationSha256) { throw 'Executable attestation hash mismatch.' }
$Attestation = Get-Content -LiteralPath $AttestationPath -Raw | ConvertFrom-Json
$ExpectedFields = @('compiled_entry_path','compiled_entry_sha256','compiled_manifest_sha256','git_executable_path','git_executable_sha256','node_executable_path','node_executable_sha256','schema_version','source_manifest_identity','source_manifest_sha256')
$ActualFields = @($Attestation.PSObject.Properties.Name | Sort-Object)
if (($ActualFields -join "`n") -ne ($ExpectedFields -join "`n") -or $Attestation.schema_version -ne 'router-executable-attestation.v2') { throw 'Executable attestation schema mismatch.' }
if ($Attestation.compiled_entry_path -match '(^[\\/]|^[A-Za-z]:|(^|[\\/])\.\.([\\/]|$)|:)' -or [string]::IsNullOrWhiteSpace($Attestation.compiled_entry_path)) { throw 'Compiled entry path is unsafe.' }
foreach ($Digest in @($Attestation.node_executable_sha256, $Attestation.git_executable_sha256, $Attestation.compiled_entry_sha256, $Attestation.compiled_manifest_sha256, $Attestation.source_manifest_sha256)) {
  if ($Digest -notmatch '^[a-f0-9]{64}$') { throw 'Executable attestation digest is malformed.' }
}
$Node = Assert-OrdinaryContainedFile -Path $Attestation.node_executable_path -ContainmentRoot '' -Label 'Node executable'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Node).Hash.ToLowerInvariant() -ne $Attestation.node_executable_sha256) { throw 'Node executable hash mismatch.' }
$Git = Assert-OrdinaryContainedFile -Path $Attestation.git_executable_path -ContainmentRoot '' -Label 'Git executable'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Git).Hash.ToLowerInvariant() -ne $Attestation.git_executable_sha256) { throw 'Git executable hash mismatch.' }
$Entry = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot $Attestation.compiled_entry_path) -ContainmentRoot $RuntimeRoot -Label 'Compiled router entry'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Entry).Hash.ToLowerInvariant() -ne $Attestation.compiled_entry_sha256) { throw 'Compiled router entry hash mismatch.' }
$CompiledRows = @('cli.js','contracts.js','stage-engine.js','state-store.js','transport.js','worktree-reader.js') | ForEach-Object {
  $Compiled = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot (Join-Path 'dist/src' $_)) -ContainmentRoot $RuntimeRoot -Label 'Compiled router module'
  "$_|$((Get-FileHash -Algorithm SHA256 -LiteralPath $Compiled).Hash.ToLowerInvariant())"
}
$CompiledManifestBytes = [System.Text.Encoding]::UTF8.GetBytes(($CompiledRows -join "`n") + "`n")
$CompiledManifestSha256 = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($CompiledManifestBytes)).Replace('-','').ToLowerInvariant()
if ($CompiledManifestSha256 -ne $Attestation.compiled_manifest_sha256) { throw 'Compiled router manifest hash mismatch.' }
$SourceRows = @('cli.ts','contracts.ts','stage-engine.ts','state-store.ts','transport.ts','worktree-reader.ts') | ForEach-Object {
  $Source = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot (Join-Path 'src' $_)) -ContainmentRoot $RuntimeRoot -Label 'Reviewed router source'
  "$_|$((Get-FileHash -Algorithm SHA256 -LiteralPath $Source).Hash.ToLowerInvariant())"
}
$SourceManifestBytes = [System.Text.Encoding]::UTF8.GetBytes(($SourceRows -join "`n") + "`n")
$SourceManifestSha256 = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($SourceManifestBytes)).Replace('-','').ToLowerInvariant()
if ($SourceManifestSha256 -ne $Attestation.source_manifest_sha256) { throw 'Reviewed source manifest hash mismatch.' }
if ([string]::IsNullOrWhiteSpace($env:OC_ROUTER_RUNTIME_ROOT)) {
  throw 'OC_ROUTER_RUNTIME_ROOT must be process-scoped.'
}
if ($Operation -in @('new-run','invoke-stage') -and [string]::IsNullOrWhiteSpace($env:OC_ROUTER_CONTROL_REGISTRY)) {
  throw 'OC_ROUTER_CONTROL_REGISTRY must be process-scoped for dispatch operations.'
}

$Arguments = @($Entry, $Operation)
switch ($Operation) {
  'new-run' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'new-run requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'invoke-stage' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'invoke-stage requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'resolve-stage' {
    if ([string]::IsNullOrWhiteSpace($RunId) -or [string]::IsNullOrWhiteSpace($OperationId)) { throw 'resolve-stage requires -RunId and -OperationId.' }
    $Arguments += @('--run-id', $RunId, '--operation-id', $OperationId)
  }
  'get-run' {
    if ([string]::IsNullOrWhiteSpace($RunId)) { throw 'get-run requires -RunId.' }
    $Arguments += @('--run-id', $RunId)
  }
}

$NodeExitCode = $null
Invoke-WithRouterEnvironment {
  & $Node @Arguments
  $script:NodeExitCode = $LASTEXITCODE
}
if ($NodeExitCode -ne 0) { exit $NodeExitCode }
