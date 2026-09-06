[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('help','open-work','submit','compact','restore','inspect','read-result','wait','reconcile','interpret','observe-session','record-pause','import-legacy')]
  [string]$Action,
  [ValidateNotNullOrEmpty()][string]$StateRoot,
  [ValidateNotNullOrEmpty()][string]$ConfigPath,
  [ValidateNotNullOrEmpty()][string]$RequestPath,
  [ValidateNotNullOrEmpty()][string]$WorkId,
  [ValidateNotNullOrEmpty()][string]$OperationId,
  [ValidateNotNullOrEmpty()][string]$Role,
  [ValidateRange(0,3600000)][int]$WaitMilliseconds
)

$ErrorActionPreference = 'Stop'

# One V2 core. Change this one path when the source layout is flattened at cutover.
$RuntimeRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'runtime'
$EntryPoint = Join-Path $RuntimeRoot 'dist\src\v2\cli.js'
if (-not (Test-Path -LiteralPath $EntryPoint -PathType Leaf)) {
  throw 'ROUTER_V2_BUILD_MISSING: build tools/oc-session-router/runtime before running the router.'
}
$NodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $NodeCommand) { throw 'ROUTER_NODE_UNAVAILABLE: Node 22.11 is required.' }

$NativeArguments = New-Object 'System.Collections.Generic.List[string]'
$NativeArguments.Add('--experimental-sqlite')
$NativeArguments.Add($EntryPoint)
$NativeArguments.Add($Action)
if ($Action -ne 'help' -and -not $PSBoundParameters.ContainsKey('StateRoot')) {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA_UNAVAILABLE: provide -StateRoot.' }
  $StateRoot = Join-Path $env:LOCALAPPDATA 'FractalAgentLab\oc-router\v2'
}
if (-not [string]::IsNullOrWhiteSpace($StateRoot)) {
  $NativeArguments.Add('--state-root')
  $NativeArguments.Add($StateRoot)
}
$OptionNames = [ordered]@{
  ConfigPath = '--config'; RequestPath = '--request'; WorkId = '--work-id'
  OperationId = '--operation-id'; Role = '--role'; WaitMilliseconds = '--wait-ms'
}
foreach ($Name in $OptionNames.Keys) {
  if ($PSBoundParameters.ContainsKey($Name)) {
    $NativeArguments.Add($OptionNames[$Name])
    $NativeArguments.Add([string]$PSBoundParameters[$Name])
  }
}

# Windows PowerShell 5.1 lacks ProcessStartInfo.ArgumentList. Quote each argv item
# with the Windows native escaping rule; do not evaluate a shell command string.
function ConvertTo-RouterNativeArgument {
  param([AllowEmptyString()][string]$Value)
  $Escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $Escaped = [regex]::Replace($Escaped, '(\\+)$', '$1$1')
  return '"' + $Escaped + '"'
}
$StartInfo = New-Object System.Diagnostics.ProcessStartInfo
$StartInfo.FileName = $NodeCommand.Source
$StartInfo.UseShellExecute = $false
$StartInfo.CreateNoWindow = $true
$StartInfo.RedirectStandardOutput = $true
$StartInfo.RedirectStandardError = $true
$StartInfo.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
$StartInfo.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
$StartInfo.WorkingDirectory = (Get-Location).ProviderPath
if ($null -ne $StartInfo.PSObject.Properties['ArgumentList']) {
  foreach ($Argument in $NativeArguments) { $StartInfo.ArgumentList.Add($Argument) }
} else {
  $StartInfo.Arguments = (@($NativeArguments | ForEach-Object { ConvertTo-RouterNativeArgument $_ }) -join ' ')
}
# Credentials are inherited from this process. This facade never accepts, prints,
# rewrites or persists them, and never builds, installs or contacts a server itself.
$Process = New-Object System.Diagnostics.Process
$Process.StartInfo = $StartInfo
try {
  if (-not $Process.Start()) { throw 'ROUTER_PROCESS_START_FAILED' }
  $OutputTask = $Process.StandardOutput.ReadToEndAsync()
  $ErrorTask = $Process.StandardError.ReadToEndAsync()
  $Process.WaitForExit()
  $OutputText = $OutputTask.GetAwaiter().GetResult()
  $ErrorText = $ErrorTask.GetAwaiter().GetResult()
  if ($OutputText.Length -gt 0) {
    # CLI stdout is JSON. Unicode escapes preserve its values through Windows
    # PowerShell's legacy output code pages without changing console globals.
    $PortableJson = [regex]::Replace($OutputText, '[^\u0000-\u007f]', { param($Match) '\u' + ([int][char]$Match.Value).ToString('x4') })
    Write-Output $PortableJson.TrimEnd([char[]]@(13,10))
  }
  if ($ErrorText.Length -gt 0) { [Console]::Error.Write($ErrorText) }
  $ExitCode = $Process.ExitCode
} finally {
  $Process.Dispose()
}
exit $ExitCode
