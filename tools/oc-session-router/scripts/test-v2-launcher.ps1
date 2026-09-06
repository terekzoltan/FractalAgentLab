[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RouterRoot = Split-Path -Parent $PSScriptRoot
$Launcher = Join-Path $PSScriptRoot 'Invoke-OCRouter.ps1'
$ContextLauncher = Join-Path $PSScriptRoot 'session-context-status.ps1'
$FixtureRoot = Join-Path $RouterRoot ('.v2-launcher-fixture-' + [Guid]::NewGuid().ToString('N'))
$FixtureLocalAppData = Join-Path $FixtureRoot 'local application data'
$PowerShellExecutable = (Get-Command powershell.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Passed = 0

function Assert-Launcher {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}
function ConvertTo-TestNativeArgument {
  param([AllowEmptyString()][string]$Value)
  $Escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
  $Escaped = [regex]::Replace($Escaped, '(\\+)$', '$1$1')
  return '"' + $Escaped + '"'
}
function Invoke-TestFacade {
  param([string]$ScriptPath, [string[]]$TestArguments, [hashtable]$ChildEnvironment = @{})
  $TestStartInfo = New-Object System.Diagnostics.ProcessStartInfo
  $TestStartInfo.FileName = $PowerShellExecutable
  $TestStartInfo.UseShellExecute = $false
  $TestStartInfo.CreateNoWindow = $true
  $TestStartInfo.RedirectStandardOutput = $true
  $TestStartInfo.RedirectStandardError = $true
  $TestStartInfo.StandardOutputEncoding = $Utf8
  $TestStartInfo.StandardErrorEncoding = $Utf8
  $TestStartInfo.WorkingDirectory = $FixtureRoot
  $TestStartInfo.Arguments = (@(@('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',$ScriptPath) + $TestArguments | ForEach-Object { ConvertTo-TestNativeArgument $_ }) -join ' ')
  # Environment changes apply only to this fixture child, never the calling process.
  $TestStartInfo.EnvironmentVariables['LOCALAPPDATA'] = $FixtureLocalAppData
  $TestStartInfo.EnvironmentVariables.Remove('OPENCODE_SERVER_PASSWORD')
  foreach ($Name in $ChildEnvironment.Keys) { $TestStartInfo.EnvironmentVariables[$Name] = $ChildEnvironment[$Name] }
  $TestProcess = New-Object System.Diagnostics.Process
  $TestProcess.StartInfo = $TestStartInfo
  try {
    [void]$TestProcess.Start()
    $TestOutput = $TestProcess.StandardOutput.ReadToEndAsync()
    $TestError = $TestProcess.StandardError.ReadToEndAsync()
    $TestProcess.WaitForExit()
    return [pscustomobject]@{ code = $TestProcess.ExitCode; output = $TestOutput.GetAwaiter().GetResult(); error = $TestError.GetAwaiter().GetResult() }
  } finally { $TestProcess.Dispose() }
}
function Read-TestJson {
  param($Result, [string]$Label, [switch]$ArgumentEcho)
  Assert-Launcher ($Result.code -eq 0) ($Label + ': ' + $Result.error)
  Assert-Launcher (-not [string]::IsNullOrWhiteSpace($Result.output)) ($Label + ': zero-exit fixture child produced no JSON output.')
  $Parsed = $Result.output | ConvertFrom-Json
  Assert-Launcher ($null -ne $Parsed) ($Label + ': fixture child returned null JSON.')
  if ($ArgumentEcho) {
    Assert-Launcher ($null -ne $Parsed.args -and $Parsed.args -is [Array]) ($Label + ': fixture CLI returned no argv echo array.')
  }
  return $Parsed
}
function Read-ArgumentValue {
  param([object[]]$Values, [string]$Name)
  $Index = [Array]::IndexOf($Values, $Name)
  if ($Index -lt 0) { return $null }
  return [string]$Values[$Index + 1]
}

try {
  [void](New-Item -ItemType Directory -Path $FixtureRoot)
  $FakeScripts = Join-Path $FixtureRoot 'fake tree\scripts'
  $FakeDist = Join-Path $FixtureRoot 'fake tree\runtime\dist\src\v2'
  [void](New-Item -ItemType Directory -Path $FakeScripts -Force)
  [void](New-Item -ItemType Directory -Path $FakeDist -Force)
  Copy-Item -LiteralPath $Launcher -Destination (Join-Path $FakeScripts 'Invoke-OCRouter.ps1')
  Copy-Item -LiteralPath $ContextLauncher -Destination (Join-Path $FakeScripts 'session-context-status.ps1')
  $FakeLauncher = Join-Path $FakeScripts 'Invoke-OCRouter.ps1'
  $FakeContext = Join-Path $FakeScripts 'session-context-status.ps1'
  # This fake CLI cannot send HTTP, spawn an executor or write a database.
  $FakeCli = @'
process.stdout.write(JSON.stringify({args:process.argv.slice(2),credentialsInherited:process.env.OPENCODE_SERVER_PASSWORD==='fixture-credential'&&process.env.OPENCODE_SERVER_USERNAME==='fixture-user'})+'\n');
process.exitCode=Number(process.env.FAL_FIXTURE_EXIT_CODE||0);
'@
  [IO.File]::WriteAllText((Join-Path $FakeDist 'cli.js'), $FakeCli, $Utf8)

  $WorkId = 'work "quoted"; $(never-evaluate) & ' + [char]0x00c1 + ' unicode'
  $Role = 'role C:\quoted\" name\'
  $StateRoot = (Join-Path $FixtureRoot 'explicit state') + '\'
  $ConfigPath = Join-Path $FixtureRoot "config with spaces and 'apostrophe'.json"
  $RequestPath = Join-Path $FixtureRoot 'request with spaces.json'
  $Echo = Read-TestJson (Invoke-TestFacade -ScriptPath $FakeLauncher -TestArguments @('-Action','inspect','-WorkId',$WorkId) -ChildEnvironment @{ OPENCODE_SERVER_USERNAME='fixture-user'; OPENCODE_SERVER_PASSWORD='fixture-credential' }) 'default state and argv' -ArgumentEcho
  Assert-Launcher ($Echo.args[0] -ceq 'inspect') 'Facade must call the requested V2 action.'
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--work-id') -ceq $WorkId) 'Work ID quotes, shell metacharacters and Unicode must survive argv forwarding.'
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--state-root') -ceq (Join-Path $FixtureLocalAppData 'FractalAgentLab\oc-router\v2')) 'Default state root must use the isolated child LOCALAPPDATA.'
  Assert-Launcher $Echo.credentialsInherited 'Credentials must be inherited through process environment only.'
  $Passed++

  $Echo = Read-TestJson (Invoke-TestFacade -ScriptPath $FakeLauncher -TestArguments @('-Action','submit','-StateRoot',$StateRoot,'-ConfigPath',$ConfigPath,'-RequestPath',$RequestPath)) 'request path forwarding' -ArgumentEcho
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--state-root') -ceq $StateRoot) 'Trailing backslash must survive native argv quoting.'
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--config') -ceq $ConfigPath) 'Config path must remain one argument.'
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--request') -ceq $RequestPath) 'Request path must remain one argument.'
  $Passed++

  $Imported = Read-TestJson (Invoke-TestFacade -ScriptPath $FakeLauncher -TestArguments @('-Action','import-legacy','-StateRoot',$StateRoot,'-RequestPath',$RequestPath)) 'read-only legacy import forwarding' -ArgumentEcho
  Assert-Launcher ($Imported.args[0] -ceq 'import-legacy' -and (Read-ArgumentValue $Imported.args '--request') -ceq $RequestPath) 'Legacy import must use the one V2 no-send action and request flag.'
  $Passed++

  $Echo = Read-TestJson (Invoke-TestFacade -ScriptPath $FakeContext -TestArguments @('-WorkId',$WorkId,'-Role',$Role,'-StateRoot',$StateRoot,'-ConfigPath',$ConfigPath)) 'context facade' -ArgumentEcho
  Assert-Launcher ($Echo.args[0] -ceq 'observe-session') 'Context status must use the same V2 observe-session action.'
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--work-id') -ceq $WorkId) 'Context work ID must survive both facades.'
  Assert-Launcher ((Read-ArgumentValue $Echo.args '--role') -ceq $Role) 'Role quotes and trailing backslash must survive both facades.'
  $Passed++

  $Wait = Invoke-TestFacade -ScriptPath $FakeLauncher -TestArguments @('-Action','wait','-OperationId','op-fixture','-WaitMilliseconds','0') -ChildEnvironment @{ FAL_FIXTURE_EXIT_CODE='7' }
  Assert-Launcher ($Wait.code -eq 7) 'Facade must preserve the CLI exit status.'
  $WaitJson = $Wait.output | ConvertFrom-Json
  Assert-Launcher ((Read-ArgumentValue $WaitJson.args '--operation-id') -ceq 'op-fixture') 'Operation ID must map to the exact CLI flag.'
  Assert-Launcher ((Read-ArgumentValue $WaitJson.args '--wait-ms') -ceq '0') 'Explicit zero observation timeout must not be omitted.'
  $Passed++

  foreach ($InvalidArguments in @(@('-Action','invoke-stage'), @('-Operation','invoke-stage','-RequestPath',$RequestPath), @('-Action','execute-operation','-OperationId','op-fixture'), @('-Action','help','-Password','fixture-forbidden'))) {
    $Rejected = Invoke-TestFacade -ScriptPath $FakeLauncher -TestArguments $InvalidArguments
    Assert-Launcher ($Rejected.code -ne 0) 'Legacy operations, internal execution and credential parameters must not enter the facade.'
    Assert-Launcher (-not $Rejected.output.Contains('credentialsInherited')) 'Rejected arguments must not reach the fake CLI.'
  }
  $Passed++

  $MissingScripts = Join-Path $FixtureRoot 'missing build\scripts'
  [void](New-Item -ItemType Directory -Path $MissingScripts -Force)
  Copy-Item -LiteralPath $Launcher -Destination (Join-Path $MissingScripts 'Invoke-OCRouter.ps1')
  $Missing = Invoke-TestFacade -ScriptPath (Join-Path $MissingScripts 'Invoke-OCRouter.ps1') -TestArguments @('-Action','help')
  Assert-Launcher ($Missing.code -ne 0 -and $Missing.error.Contains('ROUTER_V2_BUILD_MISSING')) 'Missing build must fail clearly without building or finding a legacy runtime.'
  Assert-Launcher (-not (Test-Path -LiteralPath (Join-Path $FixtureRoot 'missing build\runtime'))) 'Facade must not create or build runtime output.'
  $Passed++

  # The real CLI exercises only local SQLite work registration/inspection. No server
  # or credentials exist for these actions; the configured fixture origin is unused.
  $TargetRoot = Join-Path $FixtureRoot 'target project'
  [void](New-Item -ItemType Directory -Path $TargetRoot)
  $Configuration = @{ schemaVersion=2; targets=@{ fixture=@{ namespace='fixture'; project='fixture'; directory=$TargetRoot; origin='http://127.0.0.1:9'; roles=@{ review=@{ session='ses_fixture'; profile='fixture'; capability='META' } } } } }
  $Work = @{ workId=$WorkId; target='fixture'; directory=$TargetRoot; instructionReference='fixture/owner'; scope='Offline launcher test'; allowedEffects=@('READ_ONLY'); stoppingPoint='Return local fixture evidence' }
  [IO.File]::WriteAllText($ConfigPath, ($Configuration | ConvertTo-Json -Depth 10), $Utf8)
  [IO.File]::WriteAllText($RequestPath, ($Work | ConvertTo-Json -Depth 10), $Utf8)
  $Opened = Read-TestJson (Invoke-TestFacade -ScriptPath $Launcher -TestArguments @('-Action','open-work','-StateRoot',$StateRoot,'-ConfigPath',$ConfigPath,'-RequestPath',$RequestPath)) 'real local open-work'
  Assert-Launcher ($Opened.workId -ceq $WorkId -and $Opened.operationCount -eq 0) 'Real V2 work registration must remain offline and preserve work identity.'
  $Inspected = Read-TestJson (Invoke-TestFacade -ScriptPath $Launcher -TestArguments @('-Action','inspect','-StateRoot',$StateRoot,'-WorkId',$WorkId)) 'real local inspect'
  Assert-Launcher ($Inspected.workId -ceq $WorkId -and @($Inspected.operations).Count -eq 0) 'Real V2 inspection must reopen the same local database without credentials.'
  $Passed++

  $InvalidActionFlag = Invoke-TestFacade -ScriptPath $Launcher -TestArguments @('-Action','inspect','-StateRoot',$StateRoot,'-WorkId',$WorkId,'-Role','review')
  Assert-Launcher ($InvalidActionFlag.code -eq 1) 'V2 CLI must retain authority over action-specific flag validation.'
  Assert-Launcher (($InvalidActionFlag.output | ConvertFrom-Json).error_code -ceq 'INVALID_ARGUMENTS') 'CLI diagnostic JSON must pass through unchanged.'
  $Passed++

  $Help = Read-TestJson (Invoke-TestFacade -ScriptPath $Launcher -TestArguments @('-Action','help')) 'real help'
  Assert-Launcher ($Help.interface -ceq 'fal-router/v2') 'Facade must execute the V2 interface.'
  Assert-Launcher (-not (Test-Path -LiteralPath (Join-Path $FixtureLocalAppData 'FractalAgentLab\oc-router\v2\router.sqlite'))) 'Help and fake actions must not touch the default real store.'
  $Passed++

  [pscustomobject]@{ result='PASS'; assertions=$Passed; real_server_calls=0; global_changes=0 } | ConvertTo-Json -Compress
} finally {
  if (Test-Path -LiteralPath $FixtureRoot) {
    $ResolvedFixture = [IO.Path]::GetFullPath($FixtureRoot)
    $ResolvedRouter = [IO.Path]::GetFullPath($RouterRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $ResolvedFixture.StartsWith($ResolvedRouter, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName($ResolvedFixture)).StartsWith('.v2-launcher-fixture-')) { throw 'Fixture cleanup escaped its exact workspace test directory.' }
    Remove-Item -LiteralPath $ResolvedFixture -Recurse -Force
  }
}
