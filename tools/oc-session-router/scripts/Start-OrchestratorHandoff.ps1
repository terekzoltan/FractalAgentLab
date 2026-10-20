[CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(Mandatory = $true)][string]$StateRoot,
  [Parameter(Mandatory = $true)][string]$ConfigurationPath,
  [Parameter(Mandatory = $true)][string]$CredentialPath
)

# This launcher only starts the versioned sibling MCP entry. It never installs,
# builds, changes router configuration, or enables handoff sends.
$ErrorActionPreference = 'Stop'
$FailureCode = 'HANDOFF_LAUNCH_FAILED'
$ExitCode = 1
$Credential = $null
$Process = $null
$StartInfo = $null

function Test-HandoffAbsolutePath {
  param([string]$Value)
  return -not [string]::IsNullOrWhiteSpace($Value) -and
    [IO.Path]::IsPathRooted($Value) -and
    ($Value -match '^[A-Za-z]:[\\/]' -or $Value -match '^\\\\[^\\/?]+\\[^\\/:?]+(?:\\|$)')
}

function ConvertTo-HandoffNativeArgument {
  param([AllowEmptyString()][string]$Value)
  $Escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $Escaped = [regex]::Replace($Escaped, '(\\+)$', '$1$1')
  return '"' + $Escaped + '"'
}

try {
  $FailureCode = 'HANDOFF_LAUNCH_ARGUMENTS_INVALID'
  # MCP hosts filter inherited variables; OS may be absent or misleading.
  # Determine the platform from .NET, independent of host environment policy.
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
      -not (Test-HandoffAbsolutePath $StateRoot) -or
      -not (Test-HandoffAbsolutePath $ConfigurationPath) -or
      -not (Test-HandoffAbsolutePath $CredentialPath)) { throw 'Invalid arguments' }

  $FailureCode = 'HANDOFF_RUNTIME_UNAVAILABLE'
  $RuntimeRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'runtime'
  $EntryPoint = Join-Path $RuntimeRoot 'dist\src\v2\handoff-mcp.js'
  if (-not (Test-Path -LiteralPath $EntryPoint -PathType Leaf)) { throw 'Missing runtime' }

  # Verify the executable before reading the credential. No secret is accepted
  # as an argument, and no command string is evaluated by a shell.
  $FailureCode = 'HANDOFF_NODE_UNAVAILABLE'
  $NodeCommand = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
  $VersionOutput = & $NodeCommand.Source --version 2>$null
  $FailureCode = 'HANDOFF_NODE_VERSION_UNSUPPORTED'
  if ($LASTEXITCODE -ne 0 -or @($VersionOutput).Count -ne 1 -or
      ([string]$VersionOutput) -notmatch '^v22\.(\d+)\.\d+$' -or
      [int]$Matches[1] -lt 11) { throw 'Unsupported Node version' }

  $FailureCode = 'HANDOFF_CONFIGURATION_UNAVAILABLE'
  if (-not (Test-Path -LiteralPath $ConfigurationPath -PathType Leaf)) { throw 'Missing configuration' }

  $FailureCode = 'HANDOFF_CREDENTIAL_UNAVAILABLE'
  if (-not (Test-Path -LiteralPath $CredentialPath -PathType Leaf)) { throw 'Missing credential' }
  $Credential = Import-Clixml -LiteralPath $CredentialPath
  if ($Credential -isnot [System.Management.Automation.PSCredential] -or
      [string]::IsNullOrWhiteSpace($Credential.UserName) -or
      $Credential.Password.Length -eq 0) { throw 'Invalid credential' }

  $FailureCode = 'HANDOFF_LAUNCH_FAILED'
  $StartInfo = New-Object System.Diagnostics.ProcessStartInfo
  $StartInfo.FileName = $NodeCommand.Source
  $StartInfo.UseShellExecute = $false
  $StartInfo.CreateNoWindow = $true
  $StartInfo.WorkingDirectory = $RuntimeRoot
  # Windows PowerShell does not reliably pass its redirected stdin handle to
  # ProcessStartInfo children. Relay native streams as bytes, never through the
  # PowerShell text pipeline. Flush each input chunk so the client need not
  # close stdin (or fill a buffer) before receiving the initialization response.
  $StartInfo.RedirectStandardInput = $true
  $StartInfo.RedirectStandardOutput = $true
  $StartInfo.RedirectStandardError = $true
  $NativeArguments = @('--experimental-sqlite', $EntryPoint, '--state-root', $StateRoot, '--config', $ConfigurationPath)
  if ($null -ne $StartInfo.PSObject.Properties['ArgumentList']) {
    foreach ($Argument in $NativeArguments) { $StartInfo.ArgumentList.Add($Argument) }
  } else {
    $StartInfo.Arguments = (@($NativeArguments | ForEach-Object { ConvertTo-HandoffNativeArgument $_ }) -join ' ')
  }
  # DPAPI decryption is limited to this Windows account. Only the new Node child
  # receives the password; the parent environment and host configuration do not.
  $StartInfo.EnvironmentVariables['OPENCODE_SERVER_USERNAME'] = $Credential.UserName
  $StartInfo.EnvironmentVariables['OPENCODE_SERVER_PASSWORD'] = $Credential.GetNetworkCredential().Password
  $Process = New-Object System.Diagnostics.Process
  $Process.StartInfo = $StartInfo
  # .NET Framework initializes its redirected stdin StreamWriter using the
  # console encoding, even when all our writes use BaseStream. A BOM-bearing
  # UTF-8 default would inject EF BB BF before the first JSON-RPC request.
  # Select a BOM-free writer before Start; never strip bytes supplied by the host.
  $PreviousConsoleInputEncoding = [Console]::InputEncoding
  try {
    $PipeEncoding = New-Object System.Text.UTF8Encoding($false)
    [Console]::InputEncoding = $PipeEncoding
    if ($null -ne $StartInfo.PSObject.Properties['StandardInputEncoding']) {
      $StartInfo.StandardInputEncoding = $PipeEncoding
    }
    if (-not $Process.Start()) { throw 'Could not start runtime' }
  } finally { [Console]::InputEncoding = $PreviousConsoleInputEncoding }
  # Erase the managed launch copy after Windows has inherited the environment.
  $StartInfo.EnvironmentVariables.Remove('OPENCODE_SERVER_PASSWORD')
  $Credential = $null
  $InputStream = [Console]::OpenStandardInput()
  $InputBuffer = New-Object byte[] 8192
  $InputRead = $InputStream.ReadAsync($InputBuffer, 0, $InputBuffer.Length)
  $OutputCopy = $Process.StandardOutput.BaseStream.CopyToAsync([Console]::OpenStandardOutput())
  $ErrorCopy = $Process.StandardError.BaseStream.CopyToAsync([Console]::OpenStandardError())
  $InputClosed = $false
  while (-not $Process.WaitForExit(50)) {
    if (-not $InputClosed -and $InputRead.IsCompleted) {
      $ReadCount = $InputRead.GetAwaiter().GetResult()
      if ($ReadCount -eq 0) {
        # EOF must reach Node or a finite caller would leave the launcher open.
        $Process.StandardInput.Close()
        $InputClosed = $true
      } else {
        $Process.StandardInput.BaseStream.Write($InputBuffer, 0, $ReadCount)
        $Process.StandardInput.BaseStream.Flush()
        $InputRead = $InputStream.ReadAsync($InputBuffer, 0, $InputBuffer.Length)
      }
    }
  }
  if (-not $InputClosed) { $Process.StandardInput.Close() }
  [void]$OutputCopy.GetAwaiter().GetResult()
  [void]$ErrorCopy.GetAwaiter().GetResult()
  $ExitCode = $Process.ExitCode
} catch {
  # Never surface PowerShell exception details, paths, XML or decrypted content.
  [Console]::Error.WriteLine($FailureCode)
} finally {
  if ($null -ne $StartInfo) { $StartInfo.EnvironmentVariables.Remove('OPENCODE_SERVER_PASSWORD') }
  $Credential = $null
  if ($null -ne $Process) { $Process.Dispose() }
}
exit $ExitCode
