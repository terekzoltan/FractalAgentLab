[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$WorkId,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Role,
  [ValidateNotNullOrEmpty()][string]$StateRoot,
  [ValidateNotNullOrEmpty()][string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$Launcher = Join-Path $PSScriptRoot 'Invoke-OCRouter.ps1'
if (-not (Test-Path -LiteralPath $Launcher -PathType Leaf)) { throw 'ROUTER_V2_LAUNCHER_MISSING' }
$Parameters = @{ Action = 'observe-session'; WorkId = $WorkId; Role = $Role }
foreach ($Name in @('StateRoot', 'ConfigPath')) {
  if ($PSBoundParameters.ContainsKey($Name)) { $Parameters[$Name] = $PSBoundParameters[$Name] }
}
# Same V2 addressing, observation and private store; no independent session lookup.
& $Launcher @Parameters
exit $LASTEXITCODE
