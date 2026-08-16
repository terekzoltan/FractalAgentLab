$ErrorActionPreference = "Stop"
$WriterScriptPath = Join-Path $PSScriptRoot "write-active-route-manifest.ps1"
. $WriterScriptPath

$Failures = New-Object System.Collections.Generic.List[string]
function Assert-True { param([bool]$Condition, [string]$Message) if (-not $Condition) { $Failures.Add($Message) } }
function Assert-Equal { param($Actual, $Expected, [string]$Message) if ([string]$Actual -cne [string]$Expected) { $Failures.Add("$Message`: expected '$Expected', got '$Actual'") } }
function Assert-Throws { param([scriptblock]$Action, [string]$Message) $Threw=$false; try { & $Action } catch { $Threw=$true }; if (-not $Threw) { $Failures.Add($Message) } }
function Assert-WriterFailureCode {
  param([scriptblock]$Action, [int]$ExpectedCode, [string]$Message)
  try { $null = & $Action; $Failures.Add("$Message`: operation did not fail") }
  catch {
    $ActualCode = if ($_.Exception.Data.Contains('active_route_exit_code')) { [int]$_.Exception.Data['active_route_exit_code'] } else { 0 }
    if ($ActualCode -ne $ExpectedCode) { $Failures.Add("$Message`: expected exit code '$ExpectedCode', got '$ActualCode'") }
  }
}

function Write-Utf8Fixture {
  param([string]$Path, [string]$Text)
  $Parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $Parent -PathType Container)) { [void](New-Item -ItemType Directory -Path $Parent -Force) }
  [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function New-WriterFixture {
  param([string]$Root)
  $TargetRoot = Join-Path $Root 'target'
  $RegistryRoot = Join-Path $Root 'canon\registry'
  [void](New-Item -ItemType Directory -Path (Join-Path $RegistryRoot 'projects') -Force)
  [void](New-Item -ItemType Directory -Path (Join-Path $Root 'canon\canon') -Force)
  [void](New-Item -ItemType Directory -Path (Join-Path $TargetRoot 'ops') -Force)
  [void](New-Item -ItemType Directory -Path (Join-Path $TargetRoot 'plans') -Force)
  [void](New-Item -ItemType Directory -Path (Join-Path $TargetRoot '.fal') -Force)
  Write-Utf8Fixture -Path (Join-Path $TargetRoot 'AGENTS.md') -Text '# Fixture Project'
  $SchemaFixture = [pscustomobject]@{properties=[pscustomobject]@{schema_version=[pscustomobject]@{const='1'};contract=[pscustomobject]@{const='agent-workflow-active-route/v1'}};additionalProperties=$false}
  Write-Utf8Fixture -Path (Join-Path $RegistryRoot 'ACTIVE-ROUTE.schema.json') -Text ($SchemaFixture | ConvertTo-Json -Depth 8)
  $ContractFixture = [pscustomobject]@{hydration_contract=[pscustomobject]@{seamless_compaction_contract=[pscustomobject]@{empty_route_input_commands=@()}}}
  Write-Utf8Fixture -Path (Join-Path $Root 'canon\canon\CANONICAL-CONTRACT.json') -Text ($ContractFixture | ConvertTo-Json -Depth 8)
  Write-Utf8Fixture -Path (Join-Path $TargetRoot 'ops\Combined.md') -Text @'
# Combined

## Wave W1

| Position | Epic | Status |
|---|---|---|
| 10 | `E1` | READY |

## Wave W2

| Position | Epic | Status |
|---|---|---|
| 20 | `E2` | WAITING |
'@
  Write-Utf8Fixture -Path (Join-Path $TargetRoot 'plans\stage.md') -Text "# Stage`n`nPlan/fix-plan identity: ``route-v1```n"
  $StageSha256 = (Get-FileHash -LiteralPath (Join-Path $TargetRoot 'plans\stage.md') -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Utf8Fixture -Path (Join-Path $TargetRoot 'ops\PROJECT_STATE.md') -Text @"
# State

State revision: ``state-v1``
Wave: ``W1``
Epic: ``E1``
Workflow phase: ``IMPLEMENT``
Candidate identity: ``candidate-v1``
Configuration identity: ``config-v1``
Combined selector: ``HEADING:Wave W1``
Pinned artifact: ``plans/stage.md``
Pinned artifact SHA-256: ``$StageSha256``
Pinned artifact logical identity: ``route-v1``
Next actor: ``Delivery``
Next command: ``/implement``
"@
  $Profile = [pscustomobject][ordered]@{
    schema_version='2'; project_id='fixture'; aliases=@('fixture'); profile_revision='1'; profile_owner='Fixture'; synchronization_identity='fixture-v1'; failure_owner='Fixture'
    enrollment_status='ACTIVE'; enrollment_reason='Fixture'; governance_store='PRIVATE_MAIN_REPO'
    canon_compatibility=[pscustomobject]@{schema_version='2.0.0';minimum_version='2.2.0';maximum_major_version=2}
    root_locator=[pscustomobject]@{environment_key='FIXTURE_ROOT';markers=@([pscustomobject]@{path='AGENTS.md';contains='Fixture Project'})}
    compact_boundary_locator=[pscustomobject]@{directory='.fal/compact-boundaries';filename_pattern='^[a-z0-9][a-z0-9.-]*\.json$';selection='UNIQUE_NONEXPIRED_ROLE_AND_AUTHORITY_MATCH';contract='opencode-seamless-compact-boundary/v2';authority_class='COMPACT_BOUNDARY_CAPSULE';sensitivity='PRIVATE_GOVERNANCE'}
    authority_locators=[pscustomobject]@{state=[pscustomobject]@{path='ops/PROJECT_STATE.md'};combined=[pscustomobject]@{path='ops/Combined.md'}}
    active_route_locator=[pscustomobject]@{path='.fal/ACTIVE_ROUTE.json';contract='agent-workflow-active-route/v1';authority_class='ACTIVE_ROUTE_PROJECTION';sensitivity='PRIVATE_GOVERNANCE'}
    worktree_identity_mode='UNDECLARED';fal_control_plane_mode='UNUSED';default_budget=[pscustomobject]@{maximum_files=10;maximum_bytes=100000;maximum_approx_tokens=25000}
    expected_disposition=[pscustomobject]@{resolver_status='READY';reason='Fixture'};universal_reads=@();phase_reads=[pscustomobject]@{}
    profiles=@([pscustomobject]@{profile_id='fixture.delivery';base_capability='DELIVERY';accountable_lane='DELIVERY';allowed_phases=@('IMPLEMENT');reads=@();next_actor='Delivery';next_command='/implement'})
    cold_references=@();security=[pscustomobject]@{redaction_required=$true;public_output_allowed=$false;forbidden_content_classes=@('CREDENTIAL','SESSION_ID','PORT','PRIVATE_ENDPOINT','RAW_TRANSCRIPT','RAW_PRIVATE_EVIDENCE')}
  }
  Write-Utf8Fixture -Path (Join-Path $RegistryRoot 'projects\fixture.json') -Text ($Profile | ConvertTo-Json -Depth 20)
  return [pscustomobject]@{ target=$TargetRoot; registry=$RegistryRoot; profile_path=(Join-Path $RegistryRoot 'projects\fixture.json') }
}

function Set-WriterFixtureStage {
  param($Fixture, [string]$Revision, [string]$RouteIdentity)
  Write-Utf8Fixture -Path (Join-Path $Fixture.target 'plans\stage.md') -Text "# Stage`n`nPlan/fix-plan identity: ``$RouteIdentity```n"
  $StageSha256 = (Get-FileHash -LiteralPath (Join-Path $Fixture.target 'plans\stage.md') -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Utf8Fixture -Path (Join-Path $Fixture.target 'ops\PROJECT_STATE.md') -Text @"
# State

State revision: ``$Revision``
Wave: ``W1``
Epic: ``E1``
Workflow phase: ``IMPLEMENT``
Candidate identity: ``candidate-v1``
Configuration identity: ``config-v1``
Combined selector: ``HEADING:Wave W1``
Pinned artifact: ``plans/stage.md``
Pinned artifact SHA-256: ``$StageSha256``
Pinned artifact logical identity: ``$RouteIdentity``
Next actor: ``Delivery``
Next command: ``/implement``
"@
}

$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ('active-route-writer-test-' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $TempRoot)
try {
  $CliFixture = New-WriterFixture -Root (Join-Path $TempRoot 'cli-entrypoint')
  $CliArguments = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $WriterScriptPath,
    '-Operation', 'WRITE', '-TargetRoot', $CliFixture.target, '-RegistryRoot', $CliFixture.registry,
    '-ProjectId', 'fixture', '-ProfileId', 'fixture.delivery', '-ExpectedPriorGenerationId', 'ABSENT'
  )
  $CliOutput = @(& powershell.exe @CliArguments 2>&1)
  $CliExitCode = $LASTEXITCODE
  Assert-Equal $CliExitCode 0 'CLI entrypoint must return success for a valid WRITE'
  $CliReceipt = $null
  try { $CliReceipt = (($CliOutput | ForEach-Object { [string]$_ }) -join "`n") | ConvertFrom-Json }
  catch { $Failures.Add("CLI entrypoint must emit one JSON receipt: $($_.Exception.Message)") }
  if ($null -ne $CliReceipt) { Assert-Equal $CliReceipt.outcome WRITTEN 'CLI entrypoint must execute the writer core' }
  Assert-True (Test-Path -LiteralPath (Join-Path $CliFixture.target '.fal\ACTIVE_ROUTE.json') -PathType Leaf) 'CLI entrypoint must publish the manifest'

  $Fixture = New-WriterFixture -Root $TempRoot
  $Created = Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation ABSENT
  Assert-Equal $Created.outcome WRITTEN 'Writer must create a new manifest'
  Assert-True ([string]$Created.generation_id -match '^[a-f0-9]{64}$') 'Created manifest must expose a generation identity'
  Assert-Equal $Created.manifest_path '.fal/ACTIVE_ROUTE.json' 'Receipt path must remain target-relative'
  $ManifestPath = Join-Path $Fixture.target '.fal\ACTIVE_ROUTE.json'
  $CreatedBytesSha256 = (Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()

  $Verified = Invoke-ActiveRouteManifestWriterCore -OperationName VERIFY -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Created.generation_id
  Assert-Equal $Verified.outcome VERIFIED 'VERIFY must accept the current valid manifest'
  Assert-Equal $Verified.generation_id $Created.generation_id 'VERIFY must preserve generation identity'
  Assert-WriterFailureCode -ExpectedCode 14 -Message 'Caller workflow expectations must never override target truth' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName VERIFY -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Created.generation_id -CallerExpectations @{ workflow_phase='STEP_REVIEW' }
  }

  $Idempotent = Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Created.generation_id
  Assert-Equal $Idempotent.outcome IDEMPOTENT 'Unchanged authority must not rewrite the manifest'
  Assert-Equal ((Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()) $CreatedBytesSha256 'Idempotent write must preserve exact manifest bytes'

  Set-WriterFixtureStage -Fixture $Fixture -Revision 'state-v2' -RouteIdentity 'route-v2'
  $Updated = Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Created.generation_id
  Assert-Equal $Updated.outcome WRITTEN 'Changed target authority must publish one updated generation'
  Assert-True ($Updated.generation_id -cne $Created.generation_id) 'Updated target authority must change generation identity'
  $StableUpdatedManifestSha256 = (Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()

  Assert-WriterFailureCode -ExpectedCode 14 -Message 'Optimistic prior-generation mismatch must block' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Created.generation_id
  }

  Set-WriterFixtureStage -Fixture $Fixture -Revision 'state-v3' -RouteIdentity 'route-v3'
  $DriftHook = {
    param($Context)
    $CombinedSnapshot = @($Context.snapshots | Where-Object { [string]$_.label -ceq 'target Combined' })[0]
    $CombinedSnapshot.stream.Dispose()
    [IO.File]::AppendAllText((Join-Path $Fixture.target 'ops\Combined.md'), "`n<!-- drift -->`n", (New-Object Text.UTF8Encoding($false)))
  }.GetNewClosure()
  Assert-WriterFailureCode -ExpectedCode 14 -Message 'Source drift before publication must block' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Updated.generation_id -BeforePublish $DriftHook
  }
  Assert-Equal ((Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()) $StableUpdatedManifestSha256 'Source drift failure must preserve the prior valid manifest'

  Set-WriterFixtureStage -Fixture $Fixture -Revision 'state-v4' -RouteIdentity 'route-v4'
  $PostPublishFailure = { param($Context) throw 'injected post-publish validation failure' }
  Assert-WriterFailureCode -ExpectedCode 15 -Message 'Post-publish validation failure must fail closed' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $Fixture.target -RegistryRootPath $Fixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $Updated.generation_id -AfterPublish $PostPublishFailure
  }
  Assert-Equal ((Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()) $StableUpdatedManifestSha256 'Post-publish validation failure must restore the prior manifest bytes'

  $PathFixture = New-WriterFixture -Root (Join-Path $TempRoot 'path-failure')
  $PathProfile = Get-Content -Raw -LiteralPath $PathFixture.profile_path | ConvertFrom-Json
  $PathProfile.active_route_locator.path = '../ACTIVE_ROUTE.json'
  Write-Utf8Fixture -Path $PathFixture.profile_path -Text ($PathProfile | ConvertTo-Json -Depth 20)
  Assert-WriterFailureCode -ExpectedCode 11 -Message 'Manifest path escape must fail closed' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $PathFixture.target -RegistryRootPath $PathFixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation ABSENT
  }

  $PrivacyFixture = New-WriterFixture -Root (Join-Path $TempRoot 'privacy-failure')
  $PrivacyProfile = Get-Content -Raw -LiteralPath $PrivacyFixture.profile_path | ConvertFrom-Json
  $PrivacyProfile.security.redaction_required = $false
  Write-Utf8Fixture -Path $PrivacyFixture.profile_path -Text ($PrivacyProfile | ConvertTo-Json -Depth 20)
  Assert-WriterFailureCode -ExpectedCode 16 -Message 'Missing private redaction policy must fail closed' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $PrivacyFixture.target -RegistryRootPath $PrivacyFixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation ABSENT
  }

  $PublicOutputFixture = New-WriterFixture -Root (Join-Path $TempRoot 'public-output-allowed')
  $PublicOutputProfile = Get-Content -Raw -LiteralPath $PublicOutputFixture.profile_path | ConvertFrom-Json
  $PublicOutputProfile.security.public_output_allowed = $true
  Write-Utf8Fixture -Path $PublicOutputFixture.profile_path -Text ($PublicOutputProfile | ConvertTo-Json -Depth 20)
  $PublicOutputWrite = Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $PublicOutputFixture.target -RegistryRootPath $PublicOutputFixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation ABSENT
  Assert-Equal $PublicOutputWrite.outcome WRITTEN 'Project public-output policy must not weaken or block the private route projection'

  $NumericSchemaManifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  $NumericSchemaManifest.schema_version = 1
  Assert-Throws { Assert-ActiveRouteManifest -Manifest $NumericSchemaManifest } 'Numeric schema_version must not pass the string contract.'

  $DirectoryRaceFixture = New-WriterFixture -Root (Join-Path $TempRoot 'directory-race')
  $DirectoryRaceInitial = Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $DirectoryRaceFixture.target -RegistryRootPath $DirectoryRaceFixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation ABSENT
  Set-WriterFixtureStage -Fixture $DirectoryRaceFixture -Revision 'state-race-v2' -RouteIdentity 'route-race-v2'
  $DirectoryRaceProbe = @{ blocked = $false }
  $DirectoryRaceHook = {
    param($Context)
    $FalDirectory = Join-Path $DirectoryRaceFixture.target '.fal'
    $MovedDirectory = Join-Path $DirectoryRaceFixture.target '.fal-moved'
    try {
      [IO.Directory]::Move($FalDirectory, $MovedDirectory)
      [IO.Directory]::Move($MovedDirectory, $FalDirectory)
    }
    catch { $DirectoryRaceProbe.blocked = $true }
  }.GetNewClosure()
  $DirectoryRaceUpdated = Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $DirectoryRaceFixture.target -RegistryRootPath $DirectoryRaceFixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery -PriorGenerationExpectation $DirectoryRaceInitial.generation_id -BeforePublish $DirectoryRaceHook
  Assert-True $DirectoryRaceProbe.blocked 'Held output-directory handle must block rename/junction-swap races.'
  Assert-Equal $DirectoryRaceUpdated.outcome WRITTEN 'Directory race guard must preserve the authorized write.'

  $MalformedFixture = New-WriterFixture -Root (Join-Path $TempRoot 'malformed-manifest')
  Write-Utf8Fixture -Path (Join-Path $MalformedFixture.target '.fal\ACTIVE_ROUTE.json') -Text '{"schema_version":"1","schema_version":"1"}'
  Assert-WriterFailureCode -ExpectedCode 15 -Message 'Malformed existing manifest must be preserved and block replacement' -Action {
    Invoke-ActiveRouteManifestWriterCore -OperationName WRITE -TargetRootPath $MalformedFixture.target -RegistryRootPath $MalformedFixture.registry -ExpectedProjectId fixture -ExpectedProfileId fixture.delivery
  }
  Assert-Equal ([IO.File]::ReadAllText((Join-Path $MalformedFixture.target '.fal\ACTIVE_ROUTE.json'))) '{"schema_version":"1","schema_version":"1"}' 'Malformed prior manifest bytes must remain unchanged on failure'

  $ReceiptJson = $Updated | ConvertTo-Json -Depth 10
  Assert-True (-not $ReceiptJson.Contains($Fixture.target)) 'Writer receipt must not expose the absolute target root'
  Assert-True (-not $ReceiptJson.Contains('session')) 'Writer receipt must not expose session data'
  Assert-True (-not $ReceiptJson.Contains('127.0.0.1')) 'Writer receipt must not expose endpoints or ports'
}
finally {
  if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}

if ($Failures.Count -gt 0) { Write-Error ("ACTIVE ROUTE WRITER TEST FAILED`n- " + ($Failures -join "`n- ")); exit 1 }
Write-Output 'ACTIVE ROUTE WRITER TEST PASSED'
