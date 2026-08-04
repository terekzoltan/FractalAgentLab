[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$GlobalPolicyPath,
  [string]$ProjectPolicyPath = "",
  [switch]$AsJson
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "session-compact-flow-core.ps1")

function Assert-CompactPolicyLocalFile {
  param([string]$Path, [string]$Label)
  if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path)) { throw "$Label must be an absolute local path." }
  $Full = [IO.Path]::GetFullPath($Path)
  $Root = [IO.Path]::GetPathRoot($Full)
  if ([string]::IsNullOrWhiteSpace($Root) -or $Root.StartsWith('\\')) { throw "$Label must be on a local fixed drive." }
  $Drive = New-Object IO.DriveInfo($Root)
  if ($Drive.DriveType -ne [IO.DriveType]::Fixed) { throw "$Label must be on a local fixed drive." }
  if ($Full.Substring($Root.Length).Contains(':')) { throw "$Label cannot use an alternate data stream." }
  if (-not (Test-Path -LiteralPath $Full -PathType Leaf)) { throw "$Label is missing." }
  $Current = [IO.Path]::GetPathRoot($Full)
  $Relative = $Full.Substring($Current.Length)
  foreach ($Component in $Relative.Split([char[]]@('\','/'), [StringSplitOptions]::RemoveEmptyEntries)) {
    $Current = Join-Path $Current $Component
    $CurrentItem = Get-Item -LiteralPath $Current -Force
    if (($CurrentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label path cannot contain a reparse point." }
  }
  $Item = Get-Item -LiteralPath $Full -Force
  if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "$Label cannot be a reparse point." }
  return $Item.FullName
}

$Resolution = $null
try {
  $GlobalPath = Assert-CompactPolicyLocalFile -Path $GlobalPolicyPath -Label 'Global compact policy'
  $Global = Read-CompactFlowStrictJsonFile -Path $GlobalPath -Label 'Global compact policy'
  if ([string]::IsNullOrWhiteSpace($ProjectPolicyPath)) {
    $Resolution = Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global.Value -GlobalSha256 $Global.Sha256
  } else {
    try {
      $ProjectPath = Assert-CompactPolicyLocalFile -Path $ProjectPolicyPath -Label 'Project compact policy'
      if ([IO.Path]::GetFileName($ProjectPath) -cne 'compact-policy.json' -or [IO.Path]::GetFileName((Split-Path -Parent $ProjectPath)) -cne '.fal') { throw 'Project compact policy must be the explicit .fal/compact-policy.json file.' }
      $Project = Read-CompactFlowStrictJsonFile -Path $ProjectPath -Label 'Project compact policy'
      $Resolution = Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global.Value -ProjectOverride $Project.Value -GlobalSha256 $Global.Sha256 -OverrideSha256 $Project.Sha256
    } catch {
      $Base = Resolve-CompactFlowPolicyObjects -GlobalPolicy $Global.Value -GlobalSha256 $Global.Sha256
      $Resolution = [pscustomobject][ordered]@{
        schema_version = [string]$Base.schema_version
        valid = $true
        automatic_action_allowed = $false
        global_sha256 = [string]$Base.global_sha256
        override_sha256 = 'UNDECLARED'
        effective_policy_sha256 = [string]$Base.effective_policy_sha256
        effective_policy = $Base.effective_policy
        diagnostics = @('PROJECT_OVERRIDE_REJECTED: ' + $_.Exception.Message)
      }
    }
  }
} catch {
  $Resolution = [pscustomobject][ordered]@{
    schema_version = 'compact-policy-resolution/v1'
    valid = $false
    automatic_action_allowed = $false
    global_sha256 = 'UNDECLARED'
    override_sha256 = 'UNDECLARED'
    effective_policy_sha256 = 'UNDECLARED'
    effective_policy = $null
    diagnostics = @('GLOBAL_POLICY_REJECTED')
  }
}

if ($AsJson) { $Resolution | ConvertTo-Json -Depth 20 -Compress } else { $Resolution }
