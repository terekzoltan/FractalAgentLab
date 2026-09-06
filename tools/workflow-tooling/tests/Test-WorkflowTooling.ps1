[CmdletBinding()]
param([string[]]$CandidateManifestPath=@())
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$module=Import-Module (Join-Path $PSScriptRoot '../WorkflowTooling.psm1') -Force -PassThru -DisableNameChecking
$fixtureRoot=Join-Path ([IO.Path]::GetTempPath()) ('wt-tests-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($fixtureRoot)
$script:count=0
function Write-Fixture([string]$Path,[string]$Value) {
    $full=[IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($fixtureRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Test write escaped fixture.' }
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $full))
    [IO.File]::WriteAllText($full,$Value,[Text.UTF8Encoding]::new($false))
}
function Assert($Condition,[string]$Message) { if (-not $Condition) { throw "ASSERT: $Message" } }
function Expect-Error([scriptblock]$Code,[string]$Pattern) {
    $caught=$false
    try { & $Code | Out-Null } catch { $caught=$true; if ($_.Exception.Message -notlike "*$Pattern*") { throw } }
    Assert $caught "Expected error: $Pattern"
}
function New-Fixture([string]$Name) {
    $dir=Join-Path $fixtureRoot $Name
    $source=Join-Path $dir 'source'; $install=Join-Path $dir 'install'; $state=Join-Path $dir 'state'
    Write-Fixture (Join-Path $source 'commands/a.md') 'source-a'
    Write-Fixture (Join-Path $source 'skills/test/SKILL.md') 'source-skill'
    Write-Fixture (Join-Path $source 'managed-files.json') (@{schemaVersion=1;files=@(@{source='commands/a.md';target='commands/a.md';kind='command'},@{source='skills/test/SKILL.md';target='skills/test/SKILL.md';kind='skill'})} | ConvertTo-Json -Depth 8)
    return @{Mapping=@(@{ManifestPath=(Join-Path $source 'managed-files.json');InstallRoot=$install});StateRoot=$state;Source=$source;Install=$install}
}
function Run-Fixture($Fixture,[string]$Action,[hashtable]$Extra=@{}) {
    Invoke-WorkflowTooling -Action $Action -Mapping $Fixture.Mapping -StateRoot $Fixture.StateRoot @Extra
}
function Test-Case([string]$Name,[scriptblock]$Code) {
    & $module { Remove-Variable WTTestHook -Scope Script -ErrorAction SilentlyContinue }
    & $Code
    $script:count++
    Write-Host "PASS $Name"
}
try {
    Test-Case 'No-server command + skill install and readable source reference' {
        $f=New-Fixture 'basic'
        Write-Fixture (Join-Path $f.Install 'commands/custom.md') 'custom-preserved'
        $p=Run-Fixture $f Plan
        Assert (-not $p.blocked) 'Fresh installation plan should be ready.'
        $r=Run-Fixture $f Apply @{PlanId=$p.id;ServerState='Absent'}
        Assert ($r.phase -eq 'COMPLETE' -and $r.loaded.state -eq 'NO_SERVER') 'No-server closure should complete honestly.'
        Assert (([IO.File]::ReadAllText($r.referencePath)).Contains('source-skill')) 'Reference must include source text.'
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'commands/custom.md')) -eq 'custom-preserved') 'Unmanaged custom file changed.'
        $s=Run-Fixture $f Status
        Assert ($s.installedMatches -and $s.loaded.state -eq 'UNKNOWN') 'Status must not infer loaded from install.'
        $r=Run-Fixture $f Restore @{TransactionId=$p.id}
        Assert ($r.phase -eq 'RESTORED' -and -not (Test-Path (Join-Path $f.Install 'commands/a.md'))) 'Restore did not remove exact added file.'
        Assert (Test-Path (Join-Path $f.Install 'commands/custom.md')) 'Restore removed custom file.'
    }
    Test-Case 'First adoption requires explicit reviewed baseline and preserves original bytes' {
        $f=New-Fixture 'adopt'
        Write-Fixture (Join-Path $f.Install 'commands/a.md') 'old-local'
        $p=Run-Fixture $f Plan
        Assert $p.blocked 'Untracked existing files should block default adoption.'
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'BLOCKED_PLAN'
        $p=Run-Fixture $f Plan @{AdoptExisting=$true}
        $r=Run-Fixture $f Apply @{PlanId=$p.id}
        Run-Fixture $f Restore @{TransactionId=$p.id} | Out-Null
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'commands/a.md')) -eq 'old-local') 'Backup was not restored byte-for-byte.'
    }
    Test-Case 'Managed drift remains blocked even with AdoptExisting' {
        $f=New-Fixture 'drift'
        $p=Run-Fixture $f Plan; Run-Fixture $f Apply @{PlanId=$p.id} | Out-Null
        Write-Fixture (Join-Path $f.Install 'commands/a.md') 'user-edit'
        $next=Run-Fixture $f Plan @{AdoptExisting=$true}
        Assert $next.blocked 'Known installed drift must not be adopted by a broad flag.'
        Expect-Error { Run-Fixture $f Apply @{PlanId=$next.id} } 'BLOCKED_PLAN'
        Expect-Error { Run-Fixture $f Restore @{TransactionId=$p.id} } 'DRIFT'
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'commands/a.md')) -eq 'user-edit') 'Drifted file was overwritten.'
    }
    Test-Case 'Concurrent edit after Plan blocks Apply before mutation' {
        $f=New-Fixture 'late-drift'; $p=Run-Fixture $f Plan
        Write-Fixture (Join-Path $f.Install 'commands/a.md') 'late-local'
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'DRIFT'
        Assert (-not (Test-Path (Join-Path $f.Install 'skills/test/SKILL.md'))) 'Apply mutated another path before checking drift.'
    }
    Test-Case 'Changed source invalidates Plan' {
        $f=New-Fixture 'source-drift'; $p=Run-Fixture $f Plan
        Write-Fixture (Join-Path $f.Source 'commands/a.md') 'new-source'
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'SOURCE_DRIFT'
    }
    Test-Case 'Exact retirement and add preserve unrelated managed-looking files' {
        $f=New-Fixture 'retire'; $p=Run-Fixture $f Plan; Run-Fixture $f Apply @{PlanId=$p.id} | Out-Null
        Write-Fixture (Join-Path $f.Install 'skills/test/custom.md') 'preserved'
        Write-Fixture (Join-Path $f.Source 'commands/b.md') 'source-b'
        Write-Fixture $f.Mapping[0].ManifestPath (@{schemaVersion=1;files=@(@{source='commands/b.md';target='commands/b.md';kind='command'});retire=@(@{target='commands/a.md';kind='command'})} | ConvertTo-Json -Depth 8)
        $p=Run-Fixture $f Plan; Run-Fixture $f Apply @{PlanId=$p.id} | Out-Null
        Assert (-not (Test-Path (Join-Path $f.Install 'commands/a.md'))) 'Named retirement failed.'
        Assert (Test-Path (Join-Path $f.Install 'skills/test/SKILL.md')) 'Manifest omission must not mean deletion.'
        Run-Fixture $f Restore @{TransactionId=$p.id} | Out-Null
        Assert (Test-Path (Join-Path $f.Install 'commands/a.md')) 'Retired file not restored.'
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'skills/test/custom.md')) -eq 'preserved') 'Unlisted support file changed.'
    }
    foreach ($point in @('AfterWrite:0','AfterOperation:0','AfterInstall','AfterReference','AfterIndex')) {
        Test-Case "Resume interruption at $point" {
            $f=New-Fixture ('resume-' + $point.Replace(':','-')); $p=Run-Fixture $f Plan
            & $module { param($p) $script:WTTestHook={param($where) if ($where -eq $p) {throw 'INJECTED_INTERRUPTION'}}.GetNewClosure() } $point
            Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'INJECTED_INTERRUPTION'
            & $module { Remove-Variable WTTestHook -Scope Script }
            Expect-Error { Run-Fixture $f Plan } 'PENDING_TRANSACTION'
            $r=Run-Fixture $f Resume @{TransactionId=$p.id;ServerState='Absent'}
            Assert ($r.phase -eq 'COMPLETE' -and (Run-Fixture $f Status).installedMatches) 'Resume failed closure.'
        }
    }
    Test-Case 'Interrupted apply can restore known partial writes' {
        $f=New-Fixture 'partial-restore'; Write-Fixture (Join-Path $f.Install 'commands/a.md') 'old'
        $p=Run-Fixture $f Plan @{AdoptExisting=$true}
        & $module { $script:WTTestHook={param($where) if ($where -eq 'AfterWrite:0') {throw 'INJECTED_INTERRUPTION'}} }
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'INJECTED_INTERRUPTION'
        & $module { Remove-Variable WTTestHook -Scope Script }
        Run-Fixture $f Restore @{TransactionId=$p.id} | Out-Null
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'commands/a.md')) -eq 'old') 'Partial write backup not restored.'
        Assert (-not (Test-Path (Join-Path $f.Install 'skills/test/SKILL.md'))) 'Untouched file unexpectedly added.'
    }
    Test-Case 'Stale loaded generation and stale matching evidence remain pending' {
        $f=New-Fixture 'loaded'; $p=Run-Fixture $f Plan
        $e=Join-Path $fixtureRoot 'loaded-evidence.json'
        Write-Fixture $e (@{observedAt=[DateTimeOffset]::UtcNow.ToString('o');sourceGeneration='old'} | ConvertTo-Json)
        $r=Run-Fixture $f Apply @{PlanId=$p.id;ServerState='Running';LoadedEvidencePath=$e}
        Assert ($r.loaded.state -eq 'STALE_LOADED' -and $r.loaded.activationPending) 'Old running definition incorrectly marked current.'
        Write-Fixture $e (@{observedAt=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o');sourceGeneration=$p.sourceGeneration} | ConvertTo-Json)
        $r=Run-Fixture $f Resume @{TransactionId=$p.id;ServerState='Running';LoadedEvidencePath=$e}
        Assert ($r.loaded.state -eq 'STALE_EVIDENCE') 'Old observation incorrectly trusted.'
        Write-Fixture $e (@{observedAt=[DateTimeOffset]::UtcNow.ToString('o');sourceGeneration=$p.sourceGeneration} | ConvertTo-Json)
        $r=Run-Fixture $f Resume @{TransactionId=$p.id;ServerState='Running';LoadedEvidencePath=$e}
        Assert ($r.loaded.state -eq 'MATCH_AT_OBSERVATION') 'Fresh supplied matching evidence did not reconcile.'
    }
    Test-Case 'Separate manifests and single Codex-only update need no Canon release' {
        $a=New-Fixture 'multi-a'; $b=New-Fixture 'multi-b'
        $all=@($a.Mapping + $b.Mapping)
        $p=Invoke-WorkflowTooling -Action Plan -Mapping $all -StateRoot $a.StateRoot
        Invoke-WorkflowTooling -Action Apply -PlanId $p.id -StateRoot $a.StateRoot | Out-Null
        Write-Fixture (Join-Path $b.Source 'skills/test/SKILL.md') 'codex-new'
        $p=Invoke-WorkflowTooling -Action Plan -Mapping $b.Mapping -StateRoot $a.StateRoot
        Invoke-WorkflowTooling -Action Apply -PlanId $p.id -StateRoot $a.StateRoot | Out-Null
        Assert ([IO.File]::ReadAllText((Join-Path $a.Install 'skills/test/SKILL.md')) -eq 'source-skill') 'Unrelated root changed.'
        Assert ([IO.File]::ReadAllText((Join-Path $b.Install 'skills/test/SKILL.md')) -eq 'codex-new') 'Codex-only update failed.'
    }
    Test-Case 'Forbidden provider config, traversal and duplicate target rejected' {
        foreach ($entry in @(@{source='opencode.json';target='opencode.json';kind='command'},@{source='commands/a.md';target='commands/../a.md';kind='command'})) {
            $f=New-Fixture ('unsafe-' + [Guid]::NewGuid().ToString('N'))
            Write-Fixture $f.Mapping[0].ManifestPath (@{schemaVersion=1;files=@($entry)} | ConvertTo-Json -Depth 8)
            Expect-Error { Run-Fixture $f Plan } 'UNMANAGED_PATH'
        }
        $f=New-Fixture 'duplicate'
        Expect-Error { Invoke-WorkflowTooling -Action Plan -Mapping @($f.Mapping + $f.Mapping) -StateRoot $f.StateRoot } 'DUPLICATE_TARGET'
    }
    Test-Case 'Plan baseline cannot overwrite another completed installation' {
        $f=New-Fixture 'stale-plan'; $one=Run-Fixture $f Plan; $two=Run-Fixture $f Plan
        Run-Fixture $f Apply @{PlanId=$one.id} | Out-Null
        Expect-Error { Run-Fixture $f Apply @{PlanId=$two.id} } 'PLAN_STALE'
    }
    Test-Case 'Malformed files entry cannot silently become retirement' {
        $f=New-Fixture 'malformed'
        Write-Fixture $f.Mapping[0].ManifestPath (@{schemaVersion=1;files=@(@{target='commands/a.md';kind='command'})} | ConvertTo-Json -Depth 8)
        Expect-Error { Run-Fixture $f Plan } 'MANIFEST_SCHEMA'
    }
    Test-Case 'Corrupt backup blocks restore without deleting another file' {
        $f=New-Fixture 'corrupt-backup'; Write-Fixture (Join-Path $f.Install 'commands/a.md') 'old'
        $p=Run-Fixture $f Plan @{AdoptExisting=$true}; Run-Fixture $f Apply @{PlanId=$p.id} | Out-Null
        $backup=Get-ChildItem -LiteralPath (Join-Path $f.StateRoot 'objects') -Filter '*.before' -File | Select-Object -First 1
        Write-Fixture $backup.FullName 'corrupted'
        Expect-Error { Run-Fixture $f Restore @{TransactionId=$p.id} } 'BACKUP_CORRUPT'
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'commands/a.md')) -eq 'source-a') 'Corrupt backup was written to installation.'
        Assert (Test-Path (Join-Path $f.Install 'skills/test/SKILL.md')) 'Restore mutated before validating all required backups.'
    }
    Test-Case 'Post-install reference closure uses frozen source without redeployment' {
        $f=New-Fixture 'frozen-reference'; $p=Run-Fixture $f Plan
        & $module { $script:WTTestHook={param($where) if ($where -eq 'AfterInstall') {throw 'INJECTED_INTERRUPTION'}} }
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'INJECTED_INTERRUPTION'
        & $module { Remove-Variable WTTestHook -Scope Script }
        Write-Fixture (Join-Path $f.Source 'commands/a.md') 'next-generation'
        $r=Run-Fixture $f Resume @{TransactionId=$p.id}
        Assert (([IO.File]::ReadAllText($r.referencePath)).Contains('source-a')) 'Reference did not retain transaction source.'
        Assert (-not (Run-Fixture $f Status).installedMatches) 'Fresh Status missed newer source generation.'
    }
    Test-Case 'Source and state overlap cannot write operational data into Git source' {
        $f=New-Fixture 'overlap'
        Expect-Error { Invoke-WorkflowTooling -Action Plan -Mapping $f.Mapping -StateRoot $f.Source } 'OVERLAPPING_ROOTS'
        Assert (-not (Test-Path (Join-Path $f.Source 'writer.lock'))) 'Invalid state root wrote into source before validation.'
    }
    Test-Case 'Editing plan before first Apply invalidates accepted identity' {
        $f=New-Fixture 'tampered-plan'; $p=Run-Fixture $f Plan
        $path=Join-Path $f.StateRoot ('plans/' + $p.id + '.json')
        $changed=[IO.File]::ReadAllText($path) | ConvertFrom-Json
        $changed.files[0].before='a' * 64
        Write-Fixture $path ($changed | ConvertTo-Json -Depth 40)
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'PLAN_DRIFT'
        Assert (-not (Test-Path $f.Install)) 'Altered plan mutated installation.'
    }
    Test-Case 'Case-preserving command names and skill-root source paths' {
        $f=New-Fixture 'compatible-paths'
        Write-Fixture (Join-Path $f.Source 'commands/connectMany.md') 'connect-many'
        Write-Fixture (Join-Path $f.Source 'operator/SKILL.md') 'operator-skill'
        Write-Fixture $f.Mapping[0].ManifestPath (@{schemaVersion=1;files=@(@{source='commands/connectMany.md';target='commands/connectMany.md';kind='command'},@{source='operator/SKILL.md';target='operator/SKILL.md';kind='skill'})} | ConvertTo-Json -Depth 8)
        $p=Run-Fixture $f Plan; Run-Fixture $f Apply @{PlanId=$p.id} | Out-Null
        Assert ([IO.File]::ReadAllText((Join-Path $f.Install 'operator/SKILL.md')) -eq 'operator-skill') 'Skill-root manifest failed.'
        Assert (Test-Path (Join-Path $f.Install 'commands/connectMany.md')) 'Case-preserving alias was not installed.'
    }
    Test-Case 'Edit racing atomic replacement is preserved and blocks automatic resume' {
        $f=New-Fixture 'replace-race'; $target=Join-Path $f.Install 'commands/a.md'
        Write-Fixture $target 'old'; $p=Run-Fixture $f Plan @{AdoptExisting=$true}
        & $module {param($target) $script:WTTestHook={param($where) if ($where -eq "BeforeReplace:$target") {[IO.File]::WriteAllText($target,'raced-edit')}}.GetNewClosure()} $target
        Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'CONCURRENT_EDIT'
        & $module { Remove-Variable WTTestHook -Scope Script }
        $journal=[IO.File]::ReadAllText((Join-Path $f.StateRoot ('transactions/' + $p.id + '.json'))) | ConvertFrom-Json
        Assert ($journal.phase -eq 'DRIFT') 'Race was not durably recorded.'
        Assert ([IO.File]::ReadAllText($journal.recovery.path) -eq 'raced-edit') 'Concurrent edit lost during Replace.'
        Assert ([IO.File]::ReadAllText($target) -eq 'source-a') 'Installed source copy missing.'
        Assert ((Run-Fixture $f Status).pendingTransactions[0].phase -eq 'DRIFT') 'Status hid unresolved concurrent edit.'
        Expect-Error { Run-Fixture $f Resume @{TransactionId=$p.id} } 'CONCURRENT_EDIT_RECOVERY_REQUIRED'
    }
    foreach ($operation in @('retire','restore-delete')) {
        Test-Case "Edit racing $operation preserves removed bytes" {
            $f=New-Fixture $operation; $p=Run-Fixture $f Plan; Run-Fixture $f Apply @{PlanId=$p.id} | Out-Null
            $target=Join-Path $f.Install 'commands/a.md'
            if ($operation -eq 'retire') {
                Write-Fixture $f.Mapping[0].ManifestPath (@{schemaVersion=1;files=@();retire=@(@{target='commands/a.md';kind='command'})} | ConvertTo-Json -Depth 8)
                $p=Run-Fixture $f Plan
            }
            & $module {param($target) $script:WTTestHook={param($where) if ($where -eq "BeforeRetire:$target") {[IO.File]::WriteAllText($target,'raced-delete-edit')}}.GetNewClosure()} $target
            if ($operation -eq 'retire') { Expect-Error { Run-Fixture $f Apply @{PlanId=$p.id} } 'CONCURRENT_EDIT' }
            else { Expect-Error { Run-Fixture $f Restore @{TransactionId=$p.id} } 'CONCURRENT_EDIT' }
            & $module { Remove-Variable WTTestHook -Scope Script }
            $journal=[IO.File]::ReadAllText((Join-Path $f.StateRoot ('transactions/' + $p.id + '.json'))) | ConvertFrom-Json
            Assert ($journal.phase -eq 'DRIFT' -and [IO.File]::ReadAllText($journal.recovery.path) -eq 'raced-delete-edit') 'Concurrent deleted bytes were lost.'
        }
    }
    Test-Case 'Public entrypoint works in Windows PowerShell without external modules' {
        $f=New-Fixture 'cli'
        $p=& (Join-Path $PSScriptRoot '../Invoke-WorkflowTooling.ps1') -Action Plan -Mapping $f.Mapping -StateRoot $f.StateRoot
        Assert ($p.id.Length -eq 64) 'Public Plan result missing content-bound identity.'
    }
    foreach ($candidate in $CandidateManifestPath) {
        Test-Case "Read-only candidate manifest installs into isolated fixture: $candidate" {
            $dir=Join-Path $fixtureRoot ('candidate-' + [Guid]::NewGuid().ToString('N'))
            $mapping=@(@{ManifestPath=$candidate;InstallRoot=(Join-Path $dir 'install')})
            $state=Join-Path $dir 'state'
            $p=Invoke-WorkflowTooling -Action Plan -Mapping $mapping -StateRoot $state
            $r=Invoke-WorkflowTooling -Action Apply -PlanId $p.id -StateRoot $state -ServerState Absent
            $status=Invoke-WorkflowTooling -Action Status -Mapping $mapping -StateRoot $state -ServerState Absent
            Assert ($r.phase -eq 'COMPLETE' -and $status.installedMatches) 'Candidate manifest installation did not match source.'
            Write-Host "Candidate exact managed files: $($p.files.Count)"
        }
    }
    Write-Host "PASS $script:count isolated fixture tests"
} finally {
    # One native shell, fixed generated test root, resolved containment checked.
    $resolved=[IO.Path]::GetFullPath($fixtureRoot)
    $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ($resolved.StartsWith($temp + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -match '^wt-tests-[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    } else { throw 'Refusing unsafe fixture cleanup.' }
}
