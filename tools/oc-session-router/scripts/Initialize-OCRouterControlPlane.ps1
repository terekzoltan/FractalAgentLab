param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Bootstrap','Verify')]
  [string]$Action,

  [Parameter(DontShow=$true)]
  [string]$TestOnlyKnownFolderRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RouterProtocolIdentity = 'fal-explicit-stage-router/v1'
$RuntimeReleaseVersion = '0.2.0'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Get-Sha256Text {
  param([string]$Text)
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  return [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($Bytes)).Replace('-','').ToLowerInvariant()
}

function Get-FixedLayout {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'The protected router control plane is Windows-only.' }
  $KnownFolder = if ([string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot)) {
    [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  } else {
    if (-not [System.IO.Path]::IsPathRooted($TestOnlyKnownFolderRoot)) { throw 'Test-only KnownFolder root must be absolute.' }
    [System.IO.Path]::GetFullPath($TestOnlyKnownFolderRoot)
  }
  if ([string]::IsNullOrWhiteSpace($KnownFolder) -or -not (Test-Path -LiteralPath $KnownFolder -PathType Container)) { throw 'LocalApplicationData KnownFolder is unavailable.' }
  if ([string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot) -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    if (-not [System.IO.Path]::IsPathRooted($env:LOCALAPPDATA) -or -not ([System.IO.Path]::GetFullPath($env:LOCALAPPDATA)).Equals([System.IO.Path]::GetFullPath($KnownFolder), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Ambient LOCALAPPDATA differs from the OS KnownFolder authority.' }
  }
  $Root = Join-Path $KnownFolder 'FractalAgentLab\oc-router'
  return [ordered]@{
    known_folder = $KnownFolder
    root = $Root
    control = Join-Path $Root 'control'
    registry = Join-Path $Root 'control\control-registry.json'
    policy = Join-Path $Root 'control\retention-policy.json'
    capabilities = Join-Path $Root 'control\capability-receipts'
    runtime = Join-Path $Root 'runtime'
    p0b_isolation = Join-Path $Root 'runtime\p0b-isolation'
    compact_handoffs = Join-Path $Root 'runtime\compact-authority-handoffs'
    quarantine = Join-Path $Root 'runtime\quarantine'
    diagnostics = Join-Path $Root 'runtime\diagnostics'
    validated = Join-Path $Root 'runtime\validated-evidence'
    receipts = Join-Path $Root 'receipts'
  }
}

function Assert-KnownFolderSegments {
  param([System.Collections.IDictionary]$Layout)
  $Current = [System.IO.Path]::GetFullPath($Layout.known_folder)
  foreach ($Segment in @('', 'FractalAgentLab', 'oc-router')) {
    if (-not [string]::IsNullOrWhiteSpace($Segment)) { $Current = Join-Path $Current $Segment }
    if (-not (Test-Path -LiteralPath $Current -PathType Container)) { continue }
    $Item = Get-Item -LiteralPath $Current -Force
    if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'KnownFolder router authority traverses a reparse point.' }
  }
}

function Assert-OrdinaryItem {
  param([string]$Path, [bool]$Directory, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path)) { throw "$Label is missing." }
  $Item = Get-Item -LiteralPath $Path -Force
  if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label cannot be a reparse point." }
  if ($Directory -and -not $Item.PSIsContainer) { throw "$Label must be a directory." }
  if (-not $Directory -and $Item.PSIsContainer) { throw "$Label must be a file." }
  return $Item
}

function Assert-AbsoluteOrdinaryDirectorySegments {
  param([string]$Path, [string]$Label)
  if (-not [System.IO.Path]::IsPathRooted($Path)) { throw "$Label must be absolute." }
  $Full = [System.IO.Path]::GetFullPath($Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
  $Root = [System.IO.Path]::GetPathRoot($Full)
  if ($Root -notmatch '^[A-Za-z]:\\$') { throw "$Label must be on a local Windows volume." }
  $Current = $Root
  $Relative = $Full.Substring($Root.Length)
  foreach ($Segment in @('') + @($Relative -split '[\\/]' | Where-Object { $_ })) {
    if (-not [string]::IsNullOrWhiteSpace($Segment)) { $Current = Join-Path $Current $Segment }
    $Item = Assert-OrdinaryItem -Path $Current -Directory $true -Label $Label
  }
  return $Full
}

function Set-OwnerOnlyAcl {
  param([string]$Path, [bool]$Directory)
  $Owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $System = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
  if ($Directory) {
    $Acl = New-Object System.Security.AccessControl.DirectorySecurity
    $Inheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  }
  else {
    $Acl = New-Object System.Security.AccessControl.FileSecurity
    $Inheritance = [System.Security.AccessControl.InheritanceFlags]::None
  }
  $Acl.SetOwner($Owner)
  $Acl.SetAccessRuleProtection($true, $false)
  foreach ($Identity in @($Owner, $System)) {
    $Rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $Identity,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      $Inheritance,
      [System.Security.AccessControl.PropagationFlags]::None,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$Acl.AddAccessRule($Rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $Acl
}

function Assert-OwnerOnlyAcl {
  param([string]$Path, [string]$ProtectedRoot)
  $Owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $System = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
  $Acl = Get-Acl -LiteralPath $Path
  $ActualOwner = $Acl.GetOwner([System.Security.Principal.SecurityIdentifier])
  if ($ActualOwner.Value -ne $Owner.Value) { throw 'Protected router ACL owner is invalid.' }
  $Rules = @($Acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
  if ($Rules.Count -lt 2) { throw 'Protected router ACL lacks the required effective principals.' }
  $Expected = @($Owner.Value, $System.Value) | Sort-Object
  $Rights = @{}
  foreach ($Rule in $Rules) {
    if ($Rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) { throw 'Protected router ACL contains a deny rule.' }
    $Sid = $Rule.IdentityReference.Value
    if ($Sid -notin $Expected) { throw 'Protected router ACL has an unexpected effective principal.' }
    if (-not $Rights.ContainsKey($Sid)) { $Rights[$Sid] = [System.Security.AccessControl.FileSystemRights]0 }
    $Rights[$Sid] = $Rights[$Sid] -bor $Rule.FileSystemRights
  }
  $Actual = @($Rights.Keys | Sort-Object)
  if (($Actual -join "`n") -ne ($Expected -join "`n")) { throw 'Protected router ACL principal set is invalid.' }
  foreach ($Sid in $Expected) {
    if ((($Rights[$Sid] -band [System.Security.AccessControl.FileSystemRights]::FullControl) -ne [System.Security.AccessControl.FileSystemRights]::FullControl)) { throw 'Protected router ACL is not effective owner-only full control.' }
  }
  if (-not $Acl.AreAccessRulesProtected) {
    $Root = [System.IO.Path]::GetFullPath($ProtectedRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    $Parent = [System.IO.Directory]::GetParent([System.IO.Path]::GetFullPath($Path))
    if ($null -eq $Parent -or (-not $Parent.FullName.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase) -and -not $Parent.FullName.StartsWith($Root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))) { throw 'Inherited router ACL has no verified protected parent.' }
    Assert-OwnerOnlyAcl -Path $Parent.FullName -ProtectedRoot $Root
  }
}

function Write-PrivateUtf8 {
  param([string]$Path, [string]$Text)
  if (Test-Path -LiteralPath $Path) { throw 'Bootstrap will not overwrite existing protected control files.' }
  $Temp = "$Path.tmp.$([Guid]::NewGuid().ToString('N'))"
  try {
    [System.IO.File]::WriteAllText($Temp, $Text, $Utf8NoBom)
    Set-OwnerOnlyAcl -Path $Temp -Directory $false
    [System.IO.File]::Move($Temp, $Path)
  }
  finally {
    if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Force }
  }
}

function Assert-ClosedJsonShape {
  param([object]$Value, [string[]]$Fields, [string]$Label)
  $Actual = @($Value.PSObject.Properties.Name | Sort-Object)
  $Expected = @($Fields | Sort-Object)
  if (($Actual -join "`n") -ne ($Expected -join "`n")) { throw "$Label is not a closed schema." }
}

function Assert-ControlFiles {
  param([System.Collections.IDictionary]$Layout)
  $RegistryItem = Assert-OrdinaryItem -Path $Layout.registry -Directory $false -Label 'Control registry'
  $PolicyItem = Assert-OrdinaryItem -Path $Layout.policy -Directory $false -Label 'Retention policy'
  $Registry = Get-Content -LiteralPath $RegistryItem.FullName -Raw | ConvertFrom-Json
  Assert-ClosedJsonShape -Value $Registry -Fields @('schema_version','router_protocol_identity','mode','retention_policy_path','p0b_isolation_root','p0b_isolation_root_sha256','targets') -Label 'Control registry'
  if ($Registry.schema_version -ne 'router-control-registry.v2' -or $Registry.router_protocol_identity -ne $RouterProtocolIdentity -or $Registry.mode -notin @('DISABLED','P0B_ISOLATED','PRODUCTION_RESPONSE_FIRST') -or $Registry.retention_policy_path -ne 'retention-policy.json') { throw 'Control registry identity or mode is invalid.' }
  $IsolationRoot = Assert-AbsoluteOrdinaryDirectorySegments -Path ([string]$Registry.p0b_isolation_root) -Label 'P0B isolation root'
  $IsolationIdentityPath = $IsolationRoot.Replace('/','\').ToLowerInvariant()
  $IsolationIdentity = Get-Sha256Text -Text ("fal-router-p0b-isolation-root/v1`n$IsolationIdentityPath")
  if ([string]$Registry.p0b_isolation_root_sha256 -cne $IsolationIdentity) { throw 'P0B isolation-root identity mismatch.' }
  Assert-OwnerOnlyAcl -Path $IsolationRoot -ProtectedRoot $IsolationRoot
  $Policy = Get-Content -LiteralPath $PolicyItem.FullName -Raw | ConvertFrom-Json
  Assert-ClosedJsonShape -Value $Policy -Fields @('schema_version','compact_handoff_minutes','quarantine_days','diagnostic_days','validated_evidence_days','terminal_run_evidence_days','active_evidence_retention','authority_ledger_retention','raw_reasoning_retained','raw_event_payloads_retained','public_export','purge_receipts') -Label 'Retention policy'
  if ($Policy.schema_version -ne 'router-retention-policy.v2' -or $Policy.compact_handoff_minutes -ne 15 -or $Policy.quarantine_days -ne 7 -or $Policy.diagnostic_days -ne 30 -or $Policy.validated_evidence_days -ne 180 -or $Policy.terminal_run_evidence_days -ne 180 -or $Policy.active_evidence_retention -ne 'PRESERVE_UNTIL_TERMINAL' -or $Policy.authority_ledger_retention -ne 'NON_EXPIRING_DUPLICATE_SEND_AUTHORITY' -or $Policy.raw_reasoning_retained -ne $false -or $Policy.raw_event_payloads_retained -ne $false -or $Policy.public_export -ne 'DENY' -or $Policy.purge_receipts -ne 'SANITIZED_COUNTS_AND_HASHES_ONLY') { throw 'Retention policy does not match AC87.' }
}

$Layout = Get-FixedLayout
$Directories = @($Layout.root, $Layout.control, $Layout.capabilities, $Layout.runtime, $Layout.p0b_isolation, $Layout.compact_handoffs, $Layout.quarantine, $Layout.diagnostics, $Layout.validated, $Layout.receipts)

if ($Action -eq 'Bootstrap') {
  if ((Test-Path -LiteralPath $Layout.registry) -or (Test-Path -LiteralPath $Layout.policy)) { throw 'Bootstrap will not overwrite existing protected control files.' }
  Assert-KnownFolderSegments -Layout $Layout
  foreach ($Directory in $Directories) {
    if (-not (Test-Path -LiteralPath $Directory)) { [void](New-Item -ItemType Directory -Path $Directory) }
    [void](Assert-OrdinaryItem -Path $Directory -Directory $true -Label 'Protected router directory')
  }
  Assert-KnownFolderSegments -Layout $Layout
  foreach ($Directory in ($Directories | Sort-Object { $_.Length } -Descending)) { Set-OwnerOnlyAcl -Path $Directory -Directory $true }
  $P0BIdentityPath = ([System.IO.Path]::GetFullPath($Layout.p0b_isolation)).Replace('/','\').ToLowerInvariant()
  $RegistryJson = [ordered]@{
    schema_version = 'router-control-registry.v2'
    router_protocol_identity = $RouterProtocolIdentity
    mode = 'DISABLED'
    retention_policy_path = 'retention-policy.json'
    p0b_isolation_root = [System.IO.Path]::GetFullPath($Layout.p0b_isolation)
    p0b_isolation_root_sha256 = Get-Sha256Text -Text ("fal-router-p0b-isolation-root/v1`n$P0BIdentityPath")
    targets = [ordered]@{}
  } | ConvertTo-Json -Depth 20
  $PolicyJson = [ordered]@{
    schema_version = 'router-retention-policy.v2'
    compact_handoff_minutes = 15
    quarantine_days = 7
    diagnostic_days = 30
    validated_evidence_days = 180
    terminal_run_evidence_days = 180
    active_evidence_retention = 'PRESERVE_UNTIL_TERMINAL'
    authority_ledger_retention = 'NON_EXPIRING_DUPLICATE_SEND_AUTHORITY'
    raw_reasoning_retained = $false
    raw_event_payloads_retained = $false
    public_export = 'DENY'
    purge_receipts = 'SANITIZED_COUNTS_AND_HASHES_ONLY'
  } | ConvertTo-Json -Depth 20
  Write-PrivateUtf8 -Path $Layout.registry -Text ($RegistryJson + "`n")
  Write-PrivateUtf8 -Path $Layout.policy -Text ($PolicyJson + "`n")
}

Assert-KnownFolderSegments -Layout $Layout

foreach ($Directory in $Directories) {
  [void](Assert-OrdinaryItem -Path $Directory -Directory $true -Label 'Protected router directory')
  Assert-OwnerOnlyAcl -Path $Directory -ProtectedRoot $Layout.root
}
Assert-ControlFiles -Layout $Layout
Assert-OwnerOnlyAcl -Path $Layout.registry -ProtectedRoot $Layout.root
Assert-OwnerOnlyAcl -Path $Layout.policy -ProtectedRoot $Layout.root
if (-not [string]::IsNullOrWhiteSpace($TestOnlyKnownFolderRoot)) {
  $TestRegistry = Get-Content -LiteralPath $Layout.registry -Raw | ConvertFrom-Json
  if ($TestRegistry.mode -eq 'PRODUCTION_RESPONSE_FIRST') { throw 'Test-only KnownFolder authority cannot authorize production.' }
  if (-not ([System.IO.Path]::GetFullPath([string]$TestRegistry.p0b_isolation_root)).Equals([System.IO.Path]::GetFullPath($Layout.p0b_isolation), [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Test-only authority requires the dedicated fixed P0B fixture root.' }
}
foreach ($Item in @(Get-ChildItem -LiteralPath $Layout.root -Recurse -Force)) {
  if (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Protected router layout contains a reparse point.' }
  Assert-OwnerOnlyAcl -Path $Item.FullName -ProtectedRoot $Layout.root
}

$LayoutIdentity = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes('control/control-registry.json|control/retention-policy.json|control/capability-receipts|runtime/p0b-isolation|runtime/compact-authority-handoffs|runtime|receipts'))).Replace('-','').ToLowerInvariant()
[ordered]@{
  schema_version = 'router-control-plane-verification.v1'
  action = $Action.ToUpperInvariant()
  router_protocol_identity = $RouterProtocolIdentity
  runtime_release_version = $RuntimeReleaseVersion
  layout_identity_sha256 = $LayoutIdentity
  owner_only_acl = $true
  default_mode = 'DISABLED'
  paths_emitted = $false
} | ConvertTo-Json -Compress
