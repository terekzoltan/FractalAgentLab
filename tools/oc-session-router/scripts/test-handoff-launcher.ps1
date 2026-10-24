[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RouterRoot = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $PSScriptRoot 'Start-OrchestratorHandoff.ps1'
$FixtureRoot = Join-Path $RouterRoot ('.handoff-launcher-fixture-' + [Guid]::NewGuid().ToString('N'))
$PowerShellExecutable = (Get-Command powershell.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Passed = 0
$ParentUsername = $env:OPENCODE_SERVER_USERNAME
$ParentPassword = $env:OPENCODE_SERVER_PASSWORD

function Assert-HandoffLauncher {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}
function Test-InitializeEnvelope {
  param($Envelope)
  return $Envelope -is [System.Collections.IDictionary] -and
    $Envelope.jsonrpc -is [string] -and [string]::Equals($Envelope.jsonrpc, '2.0', [StringComparison]::Ordinal) -and
    $Envelope.id -is [int] -and $Envelope.id -eq 1 -and
    -not $Envelope.ContainsKey('error') -and
    $Envelope.result -is [System.Collections.IDictionary] -and
    $Envelope.result.protocolVersion -is [string] -and
    [string]::Equals($Envelope.result.protocolVersion, '2025-03-26', [StringComparison]::Ordinal)
}
function ConvertTo-TestNativeArgument {
  param([AllowEmptyString()][string]$Value)
  $Escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $Escaped = [regex]::Replace($Escaped, '(\\+)$', '$1$1')
  return '"' + $Escaped + '"'
}
function Invoke-TestLauncher {
  param([string]$ScriptPath, [string[]]$TestArguments, [string]$InputText = '', [hashtable]$ChildEnvironment = @{}, [switch]$VerifyBeforeEof, [switch]$BomfulLauncherInput)
  $Start = New-Object System.Diagnostics.ProcessStartInfo
  $Start.FileName = $PowerShellExecutable
  $Start.UseShellExecute = $false
  $Start.CreateNoWindow = $true
  $Start.RedirectStandardInput = $true
  $Start.RedirectStandardOutput = $true
  $Start.RedirectStandardError = $true
  $Start.StandardOutputEncoding = $Utf8
  $Start.StandardErrorEncoding = $Utf8
  $Start.WorkingDirectory = $FixtureRoot
  $EntryScript = $ScriptPath
  if ($BomfulLauncherInput) {
    $EntryScript = $BomfulEntry
    $Start.EnvironmentVariables['FAL_FIXTURE_LAUNCHER'] = $ScriptPath
  }
  $Start.Arguments = (@(@('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',$EntryScript) + $TestArguments |
    ForEach-Object { ConvertTo-TestNativeArgument $_ }) -join ' ')
  $Start.EnvironmentVariables.Remove('OPENCODE_SERVER_PASSWORD')
  $Start.EnvironmentVariables.Remove('OPENCODE_SERVER_USERNAME')
  foreach ($Name in $ChildEnvironment.Keys) {
    if ($null -eq $ChildEnvironment[$Name]) { $Start.EnvironmentVariables.Remove($Name) }
    else { $Start.EnvironmentVariables[$Name] = $ChildEnvironment[$Name] }
  }
  $TestProcess = New-Object System.Diagnostics.Process
  $TestProcess.StartInfo = $Start
  $Started = $false
  try {
    # .NET Framework takes child stdin encoding from Console.InputEncoding and
    # may emit a preamble even when the test writes only StandardInput.BaseStream.
    # Keep the fixture producer byte-exact, independently of the launcher setting.
    $PreviousEncoding = [Console]::InputEncoding
    try {
      [Console]::InputEncoding = $Utf8
      [void]$TestProcess.Start()
    } finally { [Console]::InputEncoding = $PreviousEncoding }
    $Started = $true
    # Do not let StreamReader silently consume a protocol BOM. Strict UTF-8 with
    # BOM detection disabled makes an injected prefix visible to the assertions.
    $StrictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $OutputReader = New-Object IO.StreamReader($TestProcess.StandardOutput.BaseStream, $StrictUtf8, $false)
    $PrefixOutput = ''
    if ($VerifyBeforeEof) { $FirstLine = $OutputReader.ReadLineAsync() }
    else { $Output = $OutputReader.ReadToEndAsync() }
    $ErrorOutput = $TestProcess.StandardError.ReadToEndAsync()
    $Bytes = $Utf8.GetBytes($InputText)
    $TestProcess.StandardInput.BaseStream.Write($Bytes, 0, $Bytes.Length)
    $TestProcess.StandardInput.BaseStream.Flush()
    if ($VerifyBeforeEof) {
      Assert-HandoffLauncher ($FirstLine.Wait(10000)) 'MCP must answer while host input remains open.'
      $PrefixOutput = $FirstLine.GetAwaiter().GetResult() + "`n"
      $Output = $OutputReader.ReadToEndAsync()
    }
    $TestProcess.StandardInput.Close()
    if (-not $TestProcess.WaitForExit(30000)) {
      # Only the exact offline fixture process we just started is owned here.
      # Closing it closes its redirected child pipes; never search/kill Node.
      $TestProcess.Kill()
      $TestProcess.WaitForExit()
      throw 'Isolated launcher fixture timed out.'
    }
    return [pscustomobject]@{ code=$TestProcess.ExitCode; output=($PrefixOutput + $Output.GetAwaiter().GetResult()); error=$ErrorOutput.GetAwaiter().GetResult() }
  } finally {
    if ($Started -and -not $TestProcess.HasExited) {
      $TestProcess.StandardInput.Close()
      if (-not $TestProcess.WaitForExit(1000)) { $TestProcess.Kill(); $TestProcess.WaitForExit() }
    }
    $TestProcess.Dispose()
  }
}

try {
  # This Windows PowerShell 5.1 fixture tests JSON wire literals, not host-specific
  # ConvertFrom-Json date conversion. Framework JavaScriptSerializer preserves an
  # ISO-looking protocolVersion as its actual JSON string without coercing dates.
  Add-Type -AssemblyName System.Web.Extensions
  $WireJson = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $ValidInitialize = '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26"}}'
  Assert-HandoffLauncher (Test-InitializeEnvelope ($WireJson.DeserializeObject($ValidInitialize))) 'Initialize validator must accept the exact string version.'
  foreach ($WrongInitialize in @(
      '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-27"}}',
      '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"\ufeff2025-03-26"}}',
      '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26T00:00:00Z"}}',
      '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":20250326}}',
      '{"jsonrpc":"2.0","id":"1","result":{"protocolVersion":"2025-03-26"}}',
      '{"jsonrpc":"2.0","id":2,"result":{"protocolVersion":"2025-03-26"}}',
      '{"jsonrpc":"2.0","id":1,"error":{},"result":{"protocolVersion":"2025-03-26"}}')) {
    Assert-HandoffLauncher (-not (Test-InitializeEnvelope ($WireJson.DeserializeObject($WrongInitialize)))) 'Initialize validator must reject wrong versions, non-strings, wrong ids and errors.'
  }
  $Passed++
  [void](New-Item -ItemType Directory -Path $FixtureRoot)
  $BomfulEntry = Join-Path $FixtureRoot 'bomful-console-entry.ps1'
  [IO.File]::WriteAllText($BomfulEntry, @'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($true)
& $env:FAL_FIXTURE_LAUNCHER @args
exit $LASTEXITCODE
'@, $Utf8)
  $StateRoot = (Join-Path $FixtureRoot 'explicit state') + '\'
  $ConfigurationPath = Join-Path $FixtureRoot "config 'quoted' with spaces.json"
  $CredentialPath = Join-Path $FixtureRoot 'fixture-only.credential.xml'
  [IO.File]::WriteAllText($ConfigurationPath, '{"schemaVersion":2,"targets":{},"orchestratorBridge":{"enabled":false,"projects":{}}}', $Utf8)
  # Fake local fixture only. Never read the operator's real credential store.
  $FixtureCredential = New-Object System.Management.Automation.PSCredential(
    'fixture-user', (ConvertTo-SecureString -String 'fixture-password-never-emit' -AsPlainText -Force))
  $FixtureCredential | Export-Clixml -LiteralPath $CredentialPath
  $FixtureCredential = $null
  $Arguments = @('-StateRoot',$StateRoot,'-ConfigurationPath',$ConfigurationPath,'-CredentialPath',$CredentialPath)

  $FakeScripts = Join-Path $FixtureRoot 'fake tree\scripts'
  $FakeDist = Join-Path $FixtureRoot 'fake tree\runtime\dist\src\v2'
  [void](New-Item -ItemType Directory -Path $FakeScripts -Force)
  [void](New-Item -ItemType Directory -Path $FakeDist -Force)
  $FakeLauncher = Join-Path $FakeScripts 'Start-OrchestratorHandoff.ps1'
  Copy-Item -LiteralPath $Launcher -Destination $FakeLauncher
  $FakeEntry = Join-Path $FakeDist 'handoff-mcp.js'
  $FakeCode = @'
const chunks=[];
process.stdin.on("data",chunk=>chunks.push(chunk));
process.stdin.on("end",()=>{
  const bytes=Buffer.concat(chunks);
  process.stdout.write(JSON.stringify({
    args:process.argv.slice(2),
    credentialMatches:process.env.OPENCODE_SERVER_USERNAME==="fixture-user"&&process.env.OPENCODE_SERVER_PASSWORD==="fixture-password-never-emit",
    raw:bytes.toString("utf8"), rawBase64:bytes.toString("base64")
  })+"\n");
  process.exitCode=Number(process.env.FAL_FIXTURE_EXIT_CODE||0);
});
'@
  [IO.File]::WriteAllText($FakeEntry, $FakeCode, $Utf8)
  $Unicode = 'UTF8 ' + [char]0x00e1 + [char]0x0171 + [char]0x00f6 + [char]0x4e16 + [char]0x754c
  $InputText = '{"jsonrpc":"2.0","id":"' + $Unicode + '","method":"ping"}' + "`n"
  foreach ($Bomful in @($false,$true)) {
  $Fake = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments $Arguments -InputText $InputText -BomfulLauncherInput:$Bomful
  Assert-HandoffLauncher ($Fake.code -eq 0) ('Fixture launcher failed: ' + $Fake.error)
  Assert-HandoffLauncher ($Fake.output.Length -gt 0 -and $Fake.output[0] -ne [char]0xfeff) 'Launcher stdout must not inject a UTF-8 BOM.'
  $Echo = $Fake.output | ConvertFrom-Json
  Assert-HandoffLauncher $Echo.credentialMatches 'Child must receive only the fixture credential.'
  $ExpectedBytes = [Convert]::ToBase64String($Utf8.GetBytes($InputText))
  Assert-HandoffLauncher ([string]::Equals($Echo.rawBase64, $ExpectedBytes, [StringComparison]::Ordinal)) ('MCP stdin must preserve exact bytes without injected BOM; bomful launcher console: ' + $Bomful)
  Assert-HandoffLauncher ([string]::Equals($Echo.raw, $InputText, [StringComparison]::Ordinal)) 'MCP input must preserve Unicode with ordinal equality.'
  Assert-HandoffLauncher ($Echo.args[0] -ceq '--state-root' -and $Echo.args[1] -ceq $StateRoot -and
    $Echo.args[2] -ceq '--config' -and $Echo.args[3] -ceq $ConfigurationPath -and $Echo.args.Count -eq 4) 'Paths must survive exact native argv quoting.'
  Assert-HandoffLauncher ($Fake.output -notmatch 'fixture-password-never-emit' -and $Fake.error -notmatch 'fixture-password-never-emit') 'No credential may reach protocol/error output.'
  $Passed++
  }

  # Deliberately supplied bytes are forwarded, not stripped to hide transport
  # defects. The MCP parser, not this launcher, decides whether they are valid.
  $WithBom = [char]0xfeff + $InputText
  $Forwarded = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments $Arguments -InputText $WithBom -BomfulLauncherInput
  $ForwardedEcho = $Forwarded.output | ConvertFrom-Json
  Assert-HandoffLauncher ($Forwarded.code -eq 0 -and [string]::Equals($ForwardedEcho.rawBase64, [Convert]::ToBase64String($Utf8.GetBytes($WithBom)), [StringComparison]::Ordinal)) 'Launcher must not remove or duplicate an explicitly supplied input BOM.'
  $Passed++

  $Exit = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments $Arguments -ChildEnvironment @{ FAL_FIXTURE_EXIT_CODE='7' }
  Assert-HandoffLauncher ($Exit.code -eq 7) 'Launcher must preserve child exit code.'
  $Passed++

  # MCP hosts may omit OS from the inherited environment. Platform detection
  # must use the runtime, not an optional (and caller-controlled) string.
  foreach ($OsValue in @($null, 'not-a-platform')) {
    $WithoutOs = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments $Arguments -InputText $InputText -ChildEnvironment @{ OS=$OsValue }
    Assert-HandoffLauncher ($WithoutOs.code -eq 0) ('Actual Windows must work without a trustworthy OS environment variable: ' + $WithoutOs.error)
    $WithoutOsEcho = $WithoutOs.output | ConvertFrom-Json
    Assert-HandoffLauncher $WithoutOsEcho.credentialMatches 'Filtered environment must preserve scoped credential injection.'
    Assert-HandoffLauncher ([string]::Equals($WithoutOsEcho.rawBase64, [Convert]::ToBase64String($Utf8.GetBytes($InputText)), [StringComparison]::Ordinal)) 'Filtered environment must preserve wire bytes.'
    $Passed++
  }

  $MissingArguments = @('-StateRoot',$StateRoot,'-ConfigurationPath',$ConfigurationPath,'-CredentialPath',(Join-Path $FixtureRoot 'PRIVATE-PATH-MUST-NOT-LEAK.xml'))
  $Missing = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments $MissingArguments
  Assert-HandoffLauncher ($Missing.code -eq 1 -and $Missing.output.Length -eq 0 -and $Missing.error.Trim() -ceq 'HANDOFF_CREDENTIAL_UNAVAILABLE') 'Missing credential must fail with one generic code.'
  Assert-HandoffLauncher ($Missing.error -notmatch 'PRIVATE-PATH-MUST-NOT-LEAK') 'Missing-credential path must not escape.'
  $Passed++

  $InvalidCredential = Join-Path $FixtureRoot 'invalid-fixture.xml'
  [IO.File]::WriteAllText($InvalidCredential, 'SECRET-CONTENT-MUST-NOT-LEAK', $Utf8)
  $Invalid = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments @('-StateRoot',$StateRoot,'-ConfigurationPath',$ConfigurationPath,'-CredentialPath',$InvalidCredential)
  Assert-HandoffLauncher ($Invalid.code -eq 1 -and $Invalid.output.Length -eq 0 -and $Invalid.error.Trim() -ceq 'HANDOFF_CREDENTIAL_UNAVAILABLE') 'Invalid credential must not emit XML, exception details or source paths.'
  $Passed++

  $Relative = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments @('-StateRoot','relative-state','-ConfigurationPath',$ConfigurationPath,'-CredentialPath',$CredentialPath)
  Assert-HandoffLauncher ($Relative.code -eq 1 -and $Relative.output.Length -eq 0 -and $Relative.error.Trim() -ceq 'HANDOFF_LAUNCH_ARGUMENTS_INVALID') 'Relative state root must be rejected.'
  $Passed++

  $NoNode = Invoke-TestLauncher -ScriptPath $FakeLauncher -TestArguments $Arguments -ChildEnvironment @{ PATH=(Join-Path $FixtureRoot 'no executables') }
  Assert-HandoffLauncher ($NoNode.code -eq 1 -and $NoNode.output.Length -eq 0 -and $NoNode.error.Trim() -ceq 'HANDOFF_NODE_UNAVAILABLE') 'Missing Node must fail before credentials are read.'
  $Passed++

  $MissingScripts = Join-Path $FixtureRoot 'missing build\scripts'
  [void](New-Item -ItemType Directory -Path $MissingScripts -Force)
  $MissingLauncher = Join-Path $MissingScripts 'Start-OrchestratorHandoff.ps1'
  Copy-Item -LiteralPath $Launcher -Destination $MissingLauncher
  $NoBuild = Invoke-TestLauncher -ScriptPath $MissingLauncher -TestArguments $Arguments
  Assert-HandoffLauncher ($NoBuild.code -eq 1 -and $NoBuild.error.Trim() -ceq 'HANDOFF_RUNTIME_UNAVAILABLE') 'Launcher must not build or find another runtime.'
  Assert-HandoffLauncher (-not (Test-Path -LiteralPath (Join-Path $FixtureRoot 'missing build\runtime'))) 'Missing runtime must remain missing.'
  $Passed++

  # Real built MCP entry; initialize/list/ping never load config/DB or call HTTP.
  # A Unicode JSON-RPC id proves the real stdio path is not re-encoded by PS.
  $Wire = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"offline-wrapper-fixture","version":"1"}}}' + "`n" +
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' + "`n" +
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' + "`n" +
    '{"jsonrpc":"2.0","id":"' + $Unicode + '","method":"ping"}' + "`n" +
    '{"jsonrpc":"2.0","id":99,"method":"tools/list"}'
  foreach ($Bomful in @($false,$true)) {
  $Actual = Invoke-TestLauncher -ScriptPath $Launcher -TestArguments $Arguments -InputText $Wire -VerifyBeforeEof -BomfulLauncherInput:$Bomful
  Assert-HandoffLauncher ($Actual.code -eq 0) ('Real MCP startup failed: ' + $Actual.error)
  Assert-HandoffLauncher ($Actual.output.Length -gt 0 -and $Actual.output[0] -ne [char]0xfeff) 'Real MCP stdout must not contain a UTF-8 BOM.'
  $RawLines = @($Actual.output -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $Lines = @($RawLines | ForEach-Object { $WireJson.DeserializeObject($_) })
  Assert-HandoffLauncher ($Lines.Count -eq 3) 'Only newline-complete requests may execute; EOF fragment must be ignored.'
  # This is a non-sensitive fixture-only initialize envelope, not a tool result.
  # Preserve it on failure to distinguish a wire regression from parsing errors.
  Assert-HandoffLauncher (Test-InitializeEnvelope $Lines[0]) ('Real MCP must negotiate exact string version for id 1. First response: ' + $RawLines[0])
  Assert-HandoffLauncher ($Lines[1].jsonrpc -ceq '2.0' -and $Lines[1].id -is [int] -and $Lines[1].id -eq 2) 'Tools response must correlate to numeric id 2.'
  $Tools = @($Lines[1].result.tools | ForEach-Object { $_.name })
  $ExpectedTools = @('read_session_context','inspect_orchestrator','prepare_handoff','send_handoff','inspect_handoff','reconcile_handoff')
  Assert-HandoffLauncher ($Tools.Count -eq $ExpectedTools.Count -and @(Compare-Object $ExpectedTools $Tools).Count -eq 0) 'Real MCP must list exactly the six documented tools, including read-only context.'
  $ContextTool = @($Lines[1].result.tools | Where-Object { $_.name -ceq 'read_session_context' })
  Assert-HandoffLauncher ($ContextTool.Count -eq 1 -and $ContextTool[0].annotations.readOnlyHint -eq $true) 'Context observation must remain read-only in the actual launcher catalog.'
  Assert-HandoffLauncher ([string]::Equals($Lines[2].id, $Unicode, [StringComparison]::Ordinal)) 'Real MCP response must preserve the Unicode request id.'
  Assert-HandoffLauncher (-not (Test-Path -LiteralPath $StateRoot)) 'Handshake must not create a state root, DB, operation or preview.'
  Assert-HandoffLauncher (($Actual.output + $Actual.error) -notmatch 'fixture-password-never-emit') 'Real MCP must not log credential.'
  $Passed++
  }

  Assert-HandoffLauncher ($env:OPENCODE_SERVER_USERNAME -ceq $ParentUsername -and
    $env:OPENCODE_SERVER_PASSWORD -ceq $ParentPassword) 'Launcher tests must not alter parent credential environment.'
  $Passed++
  [pscustomobject]@{ result='PASS'; assertions=$Passed; live_server_calls=0; live_store_changes=0; global_changes=0 } | ConvertTo-Json -Compress
} finally {
  if (Test-Path -LiteralPath $FixtureRoot) {
    $ResolvedFixture = [IO.Path]::GetFullPath($FixtureRoot)
    $ResolvedRouter = [IO.Path]::GetFullPath($RouterRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $ResolvedFixture.StartsWith($ResolvedRouter, [StringComparison]::OrdinalIgnoreCase) -or
        -not ([IO.Path]::GetFileName($ResolvedFixture)).StartsWith('.handoff-launcher-fixture-')) {
      throw 'Fixture cleanup escaped its exact workspace directory.'
    }
    Remove-Item -LiteralPath $ResolvedFixture -Recurse -Force
  }
}
