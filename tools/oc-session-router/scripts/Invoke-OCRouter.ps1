param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('new-run','new-follow-on-run','invoke-stage','install-closeout-authority','resolve-stage','get-run','purge-retention','write-p0b-proof','resolve-compact-authority','consume-compact-authority')]
  [string]$Operation,

  [string]$RequestPath,
  [string]$RunId,
  [string]$OperationId,
  [string]$TargetId,
  [string]$RecipientRole,
  [string]$CompactAttemptId,

  [ValidateRange(0,3600)]
  [int]$ResolveWaitSeconds = 3600,

  [Parameter(DontShow=$true)]
  [switch]$InternalCompactHandoff,

  [Parameter(DontShow=$true)]
  [string]$TestOnlyKnownFolderRoot = ''
)

function Invoke-WithRouterEnvironment {
  param([scriptblock]$Action)
  $AllowedEnvironment = @('SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','HOME','LOCALAPPDATA','APPDATA','OPENCODE_SERVER_USERNAME','OPENCODE_SERVER_PASSWORD')
  $SavedEnvironment = @{}
  foreach ($EntryName in @([Environment]::GetEnvironmentVariables('Process').Keys)) {
    $Name = [string]$EntryName
    $SavedEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($AllowedEnvironment -notcontains $Name) { [Environment]::SetEnvironmentVariable($Name, $null, 'Process') }
  }
  try {
    [Environment]::SetEnvironmentVariable('OPENCODE_AUTO_SHARE', 'false', 'Process')
    [Environment]::SetEnvironmentVariable('LOCALAPPDATA', $script:KnownFolderRoot, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_RUNTIME_ROOT', $script:ExpectedRuntime, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_CONTROL_REGISTRY', $script:ExpectedRegistry, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_KNOWN_FOLDER_ROOT', $script:KnownFolderRoot, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_ROOT_AUTHORITY_CLASS', $script:RootAuthorityClass, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_ROOT_AUTHORITY_SHA256', $script:RootAuthoritySha256, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_EXECUTABLE_ATTESTATION_SHA256', $script:ExpectedAttestationSha256, 'Process')
    [Environment]::SetEnvironmentVariable('OC_ROUTER_COMPACT_HANDOFF_TOKEN', $script:CompactHandoffToken, 'Process')
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
$ExpectedAttestationSha256 = 'f66913b3979473a791af7a66df69967305db538aef3ea01748030628e5ad1017'

function Get-Sha256Text {
  param([string]$Text)
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  return [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()
}

function Assert-OrdinaryDirectorySegments {
  param([string]$ContainmentRoot, [string]$Path, [string]$Label)
  $Root = [System.IO.Path]::GetFullPath($ContainmentRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $Full = [System.IO.Path]::GetFullPath($Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  if (-not $Full.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase) -and -not $Full.StartsWith($Root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw "$Label escapes KnownFolder authority." }
  $Current = $Root
  $Relative = $Full.Substring($Root.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar)
  foreach ($Segment in @('') + @($Relative -split '[\\/]' | Where-Object { $_ })) {
    if (-not [string]::IsNullOrWhiteSpace($Segment)) { $Current = Join-Path $Current $Segment }
    if (-not (Test-Path -LiteralPath $Current -PathType Container)) { throw "$Label is missing." }
    $Item = Get-Item -LiteralPath $Current -Force
    if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label traverses a reparse point." }
  }
  return $Full
}

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
$ExpectedFields = @('authority_schema_manifest_identity','authority_schema_manifest_sha256','compact_flow_core_script_path','compact_flow_core_script_sha256','compact_lite_core_script_path','compact_lite_core_script_sha256','compact_lite_script_path','compact_lite_script_sha256','compiled_entry_path','compiled_entry_sha256','compiled_manifest_sha256','control_plane_verifier_path','control_plane_verifier_sha256','fence_broker_executable_path','fence_broker_executable_sha256','git_executable_path','git_executable_sha256','node_executable_path','node_executable_sha256','prepare_stage_script_path','prepare_stage_script_sha256','router_common_script_path','router_common_script_sha256','router_protocol_identity','runtime_lock_sha256','runtime_package_sha256','runtime_release_version','schema_version','session_context_core_script_path','session_context_core_script_sha256','session_context_script_path','session_context_script_sha256','source_manifest_identity','source_manifest_sha256')
$ActualFields = @($Attestation.PSObject.Properties.Name | Sort-Object)
if (($ActualFields -join "`n") -ne ($ExpectedFields -join "`n") -or $Attestation.schema_version -ne 'router-executable-attestation.v4' -or $Attestation.runtime_release_version -ne '0.2.0' -or $Attestation.router_protocol_identity -ne 'fal-explicit-stage-router/v1' -or $Attestation.authority_schema_manifest_identity -ne 'fal-router-authority-schemas-v1') { throw 'Executable attestation schema or release mismatch.' }
if ($Attestation.compiled_entry_path -match '(^[\\/]|^[A-Za-z]:|(^|[\\/])\.\.([\\/]|$)|:)' -or [string]::IsNullOrWhiteSpace($Attestation.compiled_entry_path)) { throw 'Compiled entry path is unsafe.' }
foreach ($Digest in @($Attestation.node_executable_sha256, $Attestation.git_executable_sha256, $Attestation.fence_broker_executable_sha256, $Attestation.control_plane_verifier_sha256, $Attestation.compact_lite_script_sha256, $Attestation.compact_lite_core_script_sha256, $Attestation.compact_flow_core_script_sha256, $Attestation.session_context_script_sha256, $Attestation.session_context_core_script_sha256, $Attestation.router_common_script_sha256, $Attestation.prepare_stage_script_sha256, $Attestation.authority_schema_manifest_sha256, $Attestation.compiled_entry_sha256, $Attestation.compiled_manifest_sha256, $Attestation.source_manifest_sha256, $Attestation.runtime_package_sha256, $Attestation.runtime_lock_sha256)) {
  if ($Digest -notmatch '^[a-f0-9]{64}$') { throw 'Executable attestation digest is malformed.' }
}
$Node = Assert-OrdinaryContainedFile -Path $Attestation.node_executable_path -ContainmentRoot '' -Label 'Node executable'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Node).Hash.ToLowerInvariant() -ne $Attestation.node_executable_sha256) { throw 'Node executable hash mismatch.' }
$Git = Assert-OrdinaryContainedFile -Path $Attestation.git_executable_path -ContainmentRoot '' -Label 'Git executable'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Git).Hash.ToLowerInvariant() -ne $Attestation.git_executable_sha256) { throw 'Git executable hash mismatch.' }
$FenceBroker = Assert-OrdinaryContainedFile -Path $Attestation.fence_broker_executable_path -ContainmentRoot '' -Label 'Fence broker executable'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $FenceBroker).Hash.ToLowerInvariant() -ne $Attestation.fence_broker_executable_sha256) { throw 'Fence broker executable hash mismatch.' }
$Entry = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot $Attestation.compiled_entry_path) -ContainmentRoot $RuntimeRoot -Label 'Compiled router entry'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Entry).Hash.ToLowerInvariant() -ne $Attestation.compiled_entry_sha256) { throw 'Compiled router entry hash mismatch.' }
$CompiledRows = @('cli.js','contracts.js','control-plane.js','p0b-proof.js','policy-validator.js','snapshot-reader.js','stage-engine.js','state-store.js','transport.js','worktree-reader.js') | ForEach-Object {
  $Compiled = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot (Join-Path 'dist/src' $_)) -ContainmentRoot $RuntimeRoot -Label 'Compiled router module'
  "$_|$((Get-FileHash -Algorithm SHA256 -LiteralPath $Compiled).Hash.ToLowerInvariant())"
}
$CompiledManifestBytes = [System.Text.Encoding]::UTF8.GetBytes(($CompiledRows -join "`n") + "`n")
$CompiledManifestSha256 = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($CompiledManifestBytes)).Replace('-','').ToLowerInvariant()
if ($CompiledManifestSha256 -ne $Attestation.compiled_manifest_sha256) { throw 'Compiled router manifest hash mismatch.' }
$SourceRows = @('cli.ts','contracts.ts','control-plane.ts','p0b-proof.ts','policy-validator.ts','snapshot-reader.ts','stage-engine.ts','state-store.ts','transport.ts','worktree-reader.ts') | ForEach-Object {
  $Source = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot (Join-Path 'src' $_)) -ContainmentRoot $RuntimeRoot -Label 'Reviewed router source'
  "$_|$((Get-FileHash -Algorithm SHA256 -LiteralPath $Source).Hash.ToLowerInvariant())"
}
$SourceManifestBytes = [System.Text.Encoding]::UTF8.GetBytes(($SourceRows -join "`n") + "`n")
$SourceManifestSha256 = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($SourceManifestBytes)).Replace('-','').ToLowerInvariant()
if ($SourceManifestSha256 -ne $Attestation.source_manifest_sha256) { throw 'Reviewed source manifest hash mismatch.' }
$Verifier = Assert-OrdinaryContainedFile -Path (Join-Path (Split-Path -Parent $RuntimeRoot) $Attestation.control_plane_verifier_path) -ContainmentRoot (Split-Path -Parent $RuntimeRoot) -Label 'Control-plane verifier'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Verifier).Hash.ToLowerInvariant() -ne $Attestation.control_plane_verifier_sha256) { throw 'Control-plane verifier hash mismatch.' }
$RouterRoot = Split-Path -Parent $RuntimeRoot
foreach ($ScriptBinding in @(
  @('compact_lite_script_path','compact_lite_script_sha256','Compact Lite'),
  @('compact_lite_core_script_path','compact_lite_core_script_sha256','Compact Lite core'),
  @('compact_flow_core_script_path','compact_flow_core_script_sha256','Compact flow core'),
  @('session_context_script_path','session_context_script_sha256','Session context'),
  @('session_context_core_script_path','session_context_core_script_sha256','Session context core'),
  @('router_common_script_path','router_common_script_sha256','Router common'),
  @('prepare_stage_script_path','prepare_stage_script_sha256','Prepare stage')
)) {
  $ScriptFile = Assert-OrdinaryContainedFile -Path (Join-Path $RouterRoot $Attestation.($ScriptBinding[0])) -ContainmentRoot $RouterRoot -Label ([string]$ScriptBinding[2])
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $ScriptFile).Hash.ToLowerInvariant() -ne $Attestation.($ScriptBinding[1])) { throw "$($ScriptBinding[2]) script hash mismatch." }
}
$SchemaRows = @('router-capability-receipt.schema.json','router-control-registry.schema.json','router-p0b-proof-receipt.schema.json','router-retention-policy.schema.json','router-snapshot-diagnostic.schema.json') | ForEach-Object {
  $SchemaFile = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot (Join-Path 'schemas' $_)) -ContainmentRoot $RuntimeRoot -Label 'Router authority schema'
  "$_|$((Get-FileHash -Algorithm SHA256 -LiteralPath $SchemaFile).Hash.ToLowerInvariant())"
}
$SchemaManifestBytes = [System.Text.Encoding]::UTF8.GetBytes(($SchemaRows -join "`n") + "`n")
$SchemaManifestSha256 = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($SchemaManifestBytes)).Replace('-','').ToLowerInvariant()
if ($SchemaManifestSha256 -ne $Attestation.authority_schema_manifest_sha256) { throw 'Router authority schema manifest hash mismatch.' }
$RuntimePackage = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot 'package.json') -ContainmentRoot $RuntimeRoot -Label 'Runtime package manifest'
$RuntimeLock = Assert-OrdinaryContainedFile -Path (Join-Path $RuntimeRoot 'package-lock.json') -ContainmentRoot $RuntimeRoot -Label 'Runtime lock manifest'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $RuntimePackage).Hash.ToLowerInvariant() -ne $Attestation.runtime_package_sha256 -or (Get-FileHash -Algorithm SHA256 -LiteralPath $RuntimeLock).Hash.ToLowerInvariant() -ne $Attestation.runtime_lock_sha256) { throw 'Runtime release manifest hash mismatch.' }
$RuntimePackageJson = Get-Content -LiteralPath $RuntimePackage -Raw | ConvertFrom-Json
if ($RuntimePackageJson.version -ne $Attestation.runtime_release_version) { throw 'Runtime package release version mismatch.' }
$KnownFolderRoot = if ([string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot)) {
  [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
} else {
  if (-not [System.IO.Path]::IsPathRooted($TestOnlyKnownFolderRoot)) { throw 'Test-only KnownFolder root must be absolute.' }
  [System.IO.Path]::GetFullPath($TestOnlyKnownFolderRoot)
}
if ([string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot) -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
  if (-not [System.IO.Path]::IsPathRooted($env:LOCALAPPDATA) -or -not ([System.IO.Path]::GetFullPath($env:LOCALAPPDATA)).Equals([System.IO.Path]::GetFullPath($KnownFolderRoot), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Ambient LOCALAPPDATA differs from the OS KnownFolder authority.' }
}
$KnownFolderRoot = Assert-OrdinaryDirectorySegments -ContainmentRoot $KnownFolderRoot -Path $KnownFolderRoot -Label 'LocalApplicationData KnownFolder'
$FixedRoot = Assert-OrdinaryDirectorySegments -ContainmentRoot $KnownFolderRoot -Path (Join-Path $KnownFolderRoot 'FractalAgentLab\oc-router') -Label 'Fixed router root'
$ControlRoot = Assert-OrdinaryDirectorySegments -ContainmentRoot $KnownFolderRoot -Path (Join-Path $FixedRoot 'control') -Label 'Fixed control root'
$ExpectedRuntime = Assert-OrdinaryDirectorySegments -ContainmentRoot $KnownFolderRoot -Path (Join-Path $FixedRoot 'runtime') -Label 'Fixed runtime root'
$ExpectedRegistry = [System.IO.Path]::GetFullPath((Join-Path $ControlRoot 'control-registry.json'))
$RegistryPath = Assert-OrdinaryContainedFile -Path $ExpectedRegistry -ContainmentRoot $ControlRoot -Label 'Control registry'
$Registry = Get-Content -LiteralPath $RegistryPath -Raw | ConvertFrom-Json
if ($Registry.schema_version -ne 'router-control-registry.v2') { throw 'Production launcher requires the fixed protected v2 registry.' }
$RootAuthorityClass = if ([string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot)) { 'OS_KNOWN_FOLDER' } else { 'P0B_TEST_ONLY' }
if ($RootAuthorityClass -eq 'P0B_TEST_ONLY' -and $Registry.mode -eq 'PRODUCTION_RESPONSE_FIRST') { throw 'Test-only KnownFolder authority cannot authorize production.' }
$RootAuthoritySha256 = Get-Sha256Text -Text ("fal-router-known-folder-authority/v1`n$RootAuthorityClass`n$KnownFolderRoot")
$VerifierArguments = @{ Action='Verify' }
if (-not [string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot)) { $VerifierArguments.TestOnlyKnownFolderRoot = $KnownFolderRoot }
$Verification = & $Verifier @VerifierArguments | ConvertFrom-Json
if ($Verification.schema_version -ne 'router-control-plane-verification.v1' -or $Verification.owner_only_acl -ne $true -or $Verification.paths_emitted -ne $false) { throw 'Protected control-plane verification failed.' }

$CompactHandoffToken = ''
$CompactHandoffPath = ''
if ($Operation -in @('resolve-compact-authority','consume-compact-authority')) {
  $CompactHandoffRoot = Assert-OrdinaryDirectorySegments -ContainmentRoot $ExpectedRuntime -Path (Join-Path $ExpectedRuntime 'compact-authority-handoffs') -Label 'Compact authority handoff root'
  foreach ($Stale in @(Get-ChildItem -LiteralPath $CompactHandoffRoot -File -Filter '*.json' -Force | Where-Object { $_.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddMinutes(-15) })) {
    if (($Stale.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Compact authority handoff cleanup encountered a reparse point.' }
    Remove-Item -LiteralPath $Stale.FullName -Force
  }
  $CompactHandoffToken = [Guid]::NewGuid().ToString('N')
  $CompactHandoffPath = Join-Path $CompactHandoffRoot ($CompactHandoffToken + '.json')
}

$Arguments = @($Entry, $Operation)
switch ($Operation) {
  'new-run' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'new-run requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'new-follow-on-run' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'new-follow-on-run requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'invoke-stage' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'invoke-stage requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'install-closeout-authority' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'install-closeout-authority requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'resolve-stage' {
    if ([string]::IsNullOrWhiteSpace($RunId) -or [string]::IsNullOrWhiteSpace($OperationId)) { throw 'resolve-stage requires -RunId and -OperationId.' }
    $EffectiveResolveWaitSeconds = if ([string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot)) { $ResolveWaitSeconds } else { 0 }
    $Arguments += @('--run-id', $RunId, '--operation-id', $OperationId, '--wait-ms', ([string]($EffectiveResolveWaitSeconds * 1000)))
  }
  'get-run' {
    if ([string]::IsNullOrWhiteSpace($RunId)) { throw 'get-run requires -RunId.' }
    $Arguments += @('--run-id', $RunId)
  }
  'write-p0b-proof' {
    if ([string]::IsNullOrWhiteSpace($RequestPath)) { throw 'write-p0b-proof requires -RequestPath.' }
    $Arguments += @('--request', (Resolve-Path -LiteralPath $RequestPath).Path)
  }
  'resolve-compact-authority' {
    if ([string]::IsNullOrWhiteSpace($TargetId) -or [string]::IsNullOrWhiteSpace($RecipientRole)) { throw 'resolve-compact-authority requires -TargetId and -RecipientRole.' }
    $Arguments += @('--target-id', $TargetId, '--recipient-role', $RecipientRole)
  }
  'consume-compact-authority' {
    if ([string]::IsNullOrWhiteSpace($TargetId) -or [string]::IsNullOrWhiteSpace($RecipientRole) -or [string]::IsNullOrWhiteSpace($CompactAttemptId)) { throw 'consume-compact-authority requires -TargetId, -RecipientRole, and -CompactAttemptId.' }
    $Arguments += @('--target-id', $TargetId, '--recipient-role', $RecipientRole, '--attempt-id', $CompactAttemptId)
  }
}

$NodeExitCode = $null
try {
  Invoke-WithRouterEnvironment {
    & $Node @Arguments
    $script:NodeExitCode = $LASTEXITCODE
  }
}
finally {
  if (-not [string]::IsNullOrWhiteSpace($CompactHandoffPath) -and (($NodeExitCode -ne 0) -or -not $InternalCompactHandoff) -and (Test-Path -LiteralPath $CompactHandoffPath -PathType Leaf)) {
    $HandoffItem = Get-Item -LiteralPath $CompactHandoffPath -Force
    if (($HandoffItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Compact authority handoff cannot be a reparse point.' }
    Remove-Item -LiteralPath $CompactHandoffPath -Force
  }
}
if ($NodeExitCode -ne 0) { exit $NodeExitCode }
