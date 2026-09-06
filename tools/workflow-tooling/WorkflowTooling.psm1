Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Adapted from Toolbox's path, durable-write and known-partial-state primitives.
# This module has no dependency on Toolbox or any deployed definition directory.
function Get-WTPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'PATH_REQUIRED: an explicit path is required.' }
    $full = [IO.Path]::GetFullPath($Path)
    $part = $full
    while ($part) {
        $item=$null
        if (Test-Path -LiteralPath $part) { $item=Get-Item -LiteralPath $part -Force }
        else {
            $parent=Split-Path -Parent $part
            if ($parent -and (Test-Path -LiteralPath $parent -PathType Container)) {
                $leaf=Split-Path -Leaf $part
                $item=Get-ChildItem -LiteralPath $parent -Force | Where-Object Name -eq $leaf | Select-Object -First 1
            }
        }
        if ($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'REPARSE_PATH: linked paths are not supported.' }
        $parent = Split-Path -Parent $part
        if ($parent -eq $part) { break }
        $part = $parent
    }
    if ($full -eq [IO.Path]::GetPathRoot($full)) { throw 'ROOT_VOLUME: use a dedicated directory.' }
    return $full.TrimEnd([IO.Path]::DirectorySeparatorChar)
}
function Get-WTHash([string]$Path) {
    $safe = Get-WTPath $Path
    if (-not (Test-Path -LiteralPath $safe)) { return 'ABSENT' }
    if (-not (Test-Path -LiteralPath $safe -PathType Leaf)) { throw 'NOT_FILE: managed path must be a regular file.' }
    return (Get-FileHash -LiteralPath $safe -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Get-WTTextHash([string]$Text) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function Resolve-WTRelative([string]$Root,[string]$Relative) {
    if (-not $Relative -or $Relative -match '[\\:*?"<>|]' -or $Relative.StartsWith('/') -or $Relative.EndsWith('/') -or $Relative.Contains('//')) { throw 'UNSAFE_PATH: use exact slash-separated relative paths.' }
    foreach ($segment in $Relative.Split('/')) {
        if ($segment -in @('.','..') -or $segment -match '[. ]$|[\x00-\x1f]' -or [IO.Path]::GetFileNameWithoutExtension($segment) -match '^(?i:con|prn|aux|nul|com[1-9]|lpt[1-9])$') { throw 'UNSAFE_PATH: invalid path segment.' }
    }
    $base = Get-WTPath $Root
    $path = Get-WTPath (Join-Path $base $Relative)
    if (-not $path.StartsWith($base + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'UNSAFE_PATH: path escaped root.' }
    return $path
}
function Assert-WTDefinition([string]$Relative,[string]$Kind) {
    if ($Kind -eq 'command' -and $Relative -cmatch '^commands/[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$') { return }
    if ($Kind -eq 'agent' -and $Relative -cmatch '^agents/review-[a-z0-9._-]+\.md$') { return }
    if ($Kind -eq 'skill' -and $Relative -cmatch '^(skills/)?[a-z0-9][a-z0-9._-]*/.+\.(md|py|ps1|json|yaml|yml|txt|sh)$' -and $Relative -notmatch '(?i)(^|/)(auth|credentials|secrets|opencode)(\.|/)') { return }
    throw 'UNMANAGED_PATH: only named workflow command, review-agent and skill source files are allowed.'
}
function Write-WTBytes([string]$Path,[byte[]]$Bytes,[string]$Expected = '') {
    $safe = Get-WTPath $Path
    $parent = Split-Path -Parent $safe
    [void][IO.Directory]::CreateDirectory($parent)
    [void](Get-WTPath $safe)
    $temporary = Join-Path $parent ('.wt-' + [Guid]::NewGuid().ToString('N'))
    $replaced = $temporary + '.replaced'
    $preserveReplaced=$false
    try {
        $stream = [IO.FileStream]::new($temporary,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
        try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
        if ($Expected -and (Get-WTHash $safe) -ne $Expected) { throw 'DRIFT: target changed immediately before replacement.' }
        if ($Expected) { Invoke-WTFailure "BeforeReplace:$safe" }
        if ([IO.File]::Exists($safe)) {
            # If an expected-absent destination appeared, never replace that edit.
            if ($Expected -eq 'ABSENT') { throw 'DRIFT: target appeared immediately before creation.' }
            [IO.File]::Replace($temporary,$safe,$replaced,$true)
            if ($Expected -and (Get-WTHash $replaced) -ne $Expected) {
                $preserveReplaced=$true
                $raceException=[InvalidOperationException]::new("CONCURRENT_EDIT: displaced bytes preserved at $replaced")
                $raceException.Data['WorkflowToolingRecoveryPath']=$replaced
                throw $raceException
            }
        }
        else { [IO.File]::Move($temporary,$safe) }
    } finally {
        if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
        if (-not $preserveReplaced -and [IO.File]::Exists($replaced)) { [IO.File]::Delete($replaced) }
    }
}
function Remove-WTExact([string]$Path,[string]$Expected) {
    $safe=Get-WTPath $Path
    if ((Get-WTHash $safe) -ne $Expected) { throw 'DRIFT: deletion precondition changed.' }
    $quarantine=Join-Path (Split-Path -Parent $safe) ('.wt-retired-' + [Guid]::NewGuid().ToString('N'))
    Invoke-WTFailure "BeforeRetire:$safe"
    # Move preserves actual displaced bytes across the hash/remove race window.
    [IO.File]::Move($safe,$quarantine)
    if ((Get-WTHash $quarantine) -ne $Expected) {
        $raceException=[InvalidOperationException]::new("CONCURRENT_EDIT: retired bytes preserved at $quarantine")
        $raceException.Data['WorkflowToolingRecoveryPath']=$quarantine
        throw $raceException
    }
    [IO.File]::Delete($quarantine)
}
function Write-WTJson([string]$Path,$Value) { Write-WTBytes $Path ([Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 40))) }
function Read-WTJson([string]$Path) { [void](Get-WTPath $Path); return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json) }
function Get-WTIdPath([string]$StateRoot,[string]$Family,[string]$Id) {
    if ($Id -cnotmatch '^[a-f0-9]{64}$') { throw 'INVALID_ID: use the returned content-bound plan or transaction id.' }
    return Resolve-WTRelative $StateRoot "$Family/$Id.json"
}
function Get-WTIndex([string]$StateRoot) {
    $path = Join-Path $StateRoot 'installed.json'
    if (Test-Path -LiteralPath $path) { return Read-WTJson $path }
    return [pscustomobject]@{schemaVersion=1;files=@()}
}
function Assert-WTDisjoint([string]$Left,[string]$Right) {
    $separator=[IO.Path]::DirectorySeparatorChar
    if ($Left.Equals($Right,[StringComparison]::OrdinalIgnoreCase) -or $Left.StartsWith($Right + $separator,[StringComparison]::OrdinalIgnoreCase) -or $Right.StartsWith($Left + $separator,[StringComparison]::OrdinalIgnoreCase)) { throw 'OVERLAPPING_ROOTS: source, state and install roots must be disjoint.' }
}
function Assert-WTMappingRoots([object[]]$Mapping,[string]$StateRoot) {
    if (-not $Mapping.Count) { throw 'MAPPING_REQUIRED: supply explicit manifest/install-root mappings.' }
    $roots=@()
    foreach ($map in $Mapping) {
        $sourceRoot=Split-Path -Parent (Get-WTPath ([string]$map.ManifestPath))
        $installRoot=Get-WTPath ([string]$map.InstallRoot)
        Assert-WTDisjoint $sourceRoot $StateRoot
        Assert-WTDisjoint $installRoot $StateRoot
        foreach ($other in $Mapping) { Assert-WTDisjoint $sourceRoot (Get-WTPath ([string]$other.InstallRoot)) }
        foreach ($root in $roots) {
            if ($root -eq $installRoot) { throw 'DUPLICATE_TARGET: use one manifest per installation root.' }
            Assert-WTDisjoint $root $installRoot
        }
        $roots += $installRoot
    }
}
function Get-WTInventory([object[]]$Mapping,[string]$StateRoot,[bool]$AdoptExisting) {
    Assert-WTMappingRoots $Mapping $StateRoot
    $rows = @(); $sources = @(); $seen = @{}; $index = Get-WTIndex $StateRoot
    foreach ($map in $Mapping) {
        $manifestPath = Get-WTPath ([string]$map.ManifestPath)
        $sourceRoot = Split-Path -Parent $manifestPath
        $installRoot = Get-WTPath ([string]$map.InstallRoot)
        $manifest = Read-WTJson $manifestPath
        if ($manifest.schemaVersion -ne 1) { throw 'MANIFEST_SCHEMA: expected schemaVersion 1.' }
        $entries = @($manifest.files)
        foreach ($entry in $entries) {
            if ($null -eq $entry -or $entry.PSObject.Properties.Name -notcontains 'source' -or -not $entry.source) { throw 'MANIFEST_SCHEMA: files entries require source; retirement must be explicit in retire.' }
        }
        if ($manifest.PSObject.Properties.Name -contains 'retire') {
            foreach ($entry in @($manifest.retire)) {
                if ($null -eq $entry -or $entry.PSObject.Properties.Name -contains 'source') { throw 'MANIFEST_SCHEMA: retire entries must not contain source.' }
            }
            $entries += @($manifest.retire)
        }
        if (-not $entries.Count) { throw 'MANIFEST_SCHEMA: select at least one exact managed path.' }
        foreach ($entry in $entries) {
            $target = [string]$entry.target; $kind = [string]$entry.kind
            Assert-WTDefinition $target $kind
            $destination = Resolve-WTRelative $installRoot $target
            if ($seen.ContainsKey($destination)) { throw 'DUPLICATE_TARGET: mapping targets overlap.' }; $seen[$destination]=$true
            $retired = $entry.PSObject.Properties.Name -notcontains 'source'
            $source = ''; $after = 'ABSENT'
            if (-not $retired) {
                Assert-WTDefinition ([string]$entry.source) $kind
                $source = Resolve-WTRelative $sourceRoot ([string]$entry.source)
                $after = Get-WTHash $source
                if ($after -eq 'ABSENT') { throw 'SOURCE_MISSING: managed source file does not exist.' }
            }
            $before = Get-WTHash $destination
            $known = @($index.files | Where-Object { $_.destination -eq $destination })
            $issue = ''
            if ($known.Count -and $known[0].hash -ne $before) { $issue='MANAGED_DRIFT' }
            elseif (-not $known.Count -and $before -ne 'ABSENT' -and $before -ne $after -and -not $AdoptExisting) { $issue='UNTRACKED_EXISTING' }
            $rows += [pscustomobject]@{destination=$destination;installRoot=$installRoot;target=$target;kind=$kind;source=$source;before=$before;after=$after;retired=$retired;issue=$issue}
        }
        $sources += [pscustomobject]@{manifestPath=$manifestPath;manifestHash=(Get-WTHash $manifestPath);installRoot=$installRoot}
    }
    $rows = @($rows | Sort-Object destination)
    $generation = Get-WTTextHash (($rows | ForEach-Object { "$($_.target)`t$($_.after)`t$($_.kind)" }) -join "`n")
    return [pscustomobject]@{sources=$sources;files=$rows;sourceGeneration=$generation;issues=@($rows | Where-Object issue)}
}
function Assert-WTPlanPaths($Plan,[string]$StateRoot) {
    $seen=@{}
    foreach ($source in $Plan.sources) {
        $root=Get-WTPath $source.installRoot
        $sourceRoot=Split-Path -Parent (Get-WTPath $source.manifestPath)
        Assert-WTDisjoint $root $StateRoot
        Assert-WTDisjoint $sourceRoot $StateRoot
        foreach ($other in $Plan.sources) { Assert-WTDisjoint $sourceRoot (Get-WTPath $other.installRoot) }
    }
    foreach ($file in $Plan.files) {
        Assert-WTDefinition $file.target $file.kind
        $destination=Resolve-WTRelative $file.installRoot $file.target
        if ($destination -cne $file.destination -or $seen.ContainsKey($destination)) { throw 'PLAN_PATH: stored destination is not the unique exact managed target.' }
        $seen[$destination]=$true
        $owners=@($Plan.sources | Where-Object installRoot -eq $file.installRoot)
        if ($owners.Count -ne 1) { throw 'PLAN_PATH: file needs one source/install mapping.' }
        if ($file.before -cnotmatch '^(ABSENT|[a-f0-9]{64})$' -or $file.after -cnotmatch '^(ABSENT|[a-f0-9]{64})$') { throw 'PLAN_HASH: invalid recorded file identity.' }
        if ($file.retired) {
            if ($file.after -ne 'ABSENT' -or $file.source) { throw 'PLAN_RETIRE: invalid retirement.' }
        } else {
            $sourceRoot=Split-Path -Parent $owners[0].manifestPath
            if (-not $file.source.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'PLAN_PATH: source escaped manifest directory.' }
            $relative=$file.source.Substring($sourceRoot.Length+1).Replace('\','/')
            Assert-WTDefinition $relative $file.kind
            [void](Resolve-WTRelative $sourceRoot $relative)
            if ($file.after -eq 'ABSENT') { throw 'PLAN_HASH: source must have a hash.' }
        }
    }
}
function Get-WTPlanIdentity($Plan) {
    # Fixed ordering and exclusion of id make the id a digest of the whole plan.
    # Editing a persisted plan cannot reuse its accepted identity, even before Apply.
    $material=[ordered]@{schemaVersion=$Plan.schemaVersion;createdAt=$Plan.createdAt;sourceGeneration=$Plan.sourceGeneration;sources=$Plan.sources;files=$Plan.files;blocked=$Plan.blocked;indexHash=$Plan.indexHash}
    return Get-WTTextHash ($material | ConvertTo-Json -Depth 40 -Compress)
}
function Assert-WTSource($Plan) {
    foreach ($source in $Plan.sources) { if ((Get-WTHash $source.manifestPath) -ne $source.manifestHash) { throw 'SOURCE_DRIFT: manifest changed after Plan.' } }
    foreach ($file in $Plan.files) { if (-not $file.retired -and (Get-WTHash $file.source) -ne $file.after) { throw 'SOURCE_DRIFT: source changed after Plan.' } }
}
function Get-WTLoaded([string]$ServerState,[string]$EvidencePath,[string]$Generation) {
    $result = [ordered]@{serverState=$ServerState;state='UNKNOWN';basis='No running registry was queried.';observedAt=$null;activationPending=($ServerState -eq 'Running')}
    if ($ServerState -eq 'Absent') { $result.state='NO_SERVER'; $result.basis='Caller reports no server; future startup loading remains unverified.'; return [pscustomobject]$result }
    if ($EvidencePath) {
        $evidence = Read-WTJson $EvidencePath
        $observed = [DateTimeOffset]::Parse([string]$evidence.observedAt)
        $result.observedAt=$observed.ToString('o'); $result.basis='Supplied registry observation only; no live query or process identity is retained.'
        if ($observed -gt [DateTimeOffset]::UtcNow -or $observed -lt [DateTimeOffset]::UtcNow.AddMinutes(-5)) { $result.state='STALE_EVIDENCE'; $result.activationPending=$true }
        elseif ([string]$evidence.sourceGeneration -ne $Generation) { $result.state='STALE_LOADED'; $result.activationPending=$true }
        else { $result.state='MATCH_AT_OBSERVATION'; $result.activationPending=$false }
    }
    return [pscustomobject]$result
}
function Set-WTIndex([string]$StateRoot,$Plan,[bool]$Restore) {
    $index = Get-WTIndex $StateRoot
    $destinations = @($Plan.files | ForEach-Object destination)
    $files = @($index.files | Where-Object { $_.destination -notin $destinations })
    foreach ($file in $Plan.files) { $files += [pscustomobject]@{destination=$file.destination;hash=$(if ($Restore) {$file.before} else {$file.after})} }
    Write-WTJson (Join-Path $StateRoot 'installed.json') ([ordered]@{schemaVersion=1;files=$files})
}
function Assert-WTNoPending([string]$StateRoot,[string]$Except = '') {
    foreach ($j in @(Get-WTPending $StateRoot)) {
        if ($j.id -ne $Except) { throw "PENDING_TRANSACTION: resume or restore $($j.id) first." }
    }
}
function Get-WTPending([string]$StateRoot) {
    $dir = Join-Path $StateRoot 'transactions'
    if (Test-Path -LiteralPath $dir) {
        foreach ($file in Get-ChildItem -LiteralPath $dir -Filter '*.json' -File) {
            $j = Read-WTJson $file.FullName
            if ($j.phase -notin @('COMPLETE','RESTORED')) { $j }
        }
    }
}
function Invoke-WTFailure([string]$Point) {
    # Tests set a module-private scriptblock; no production CLI fault switches.
    if (Test-Path variable:script:WTTestHook) { & $script:WTTestHook $Point }
}
function Continue-WTTransaction([string]$StateRoot,$Plan,$Journal,[bool]$Restore,[string]$ServerState,[string]$LoadedEvidencePath) {
    $journalPath = Get-WTIdPath $StateRoot 'transactions' $Journal.id
    $archive = Join-Path $StateRoot 'objects'
    if ($Journal.phase -eq 'DRIFT') { throw 'CONCURRENT_EDIT_RECOVERY_REQUIRED: compare the journal recovery file with source and installed bytes before deliberate maintenance recovery; no automatic overwrite is safe.' }
    if ($Restore) {
        if ($Journal.phase -eq 'RESTORED') { return $Journal }
        # First validate the complete known partial state before any rollback write.
        for ($i=0; $i -lt $Plan.files.Count; $i++) {
            $f=$Plan.files[$i]; $current=Get-WTHash $f.destination
            if ($current -notin @($f.before,$f.after)) { throw 'DRIFT: restore preserves unexpected managed edits.' }
            if ($Journal.operations[$i] -eq 'PENDING' -and $current -ne $f.before) { throw 'DRIFT: pending operation was edited externally.' }
            if ($current -ne $f.before -and $f.before -ne 'ABSENT') {
                if ((Get-WTHash (Join-Path $archive ($f.before + '.before'))) -ne $f.before) { throw 'BACKUP_CORRUPT: restore backup hash mismatch.' }
            }
        }
        $Journal.phase='RESTORING'; Write-WTJson $journalPath $Journal
        for ($i=$Plan.files.Count-1; $i -ge 0; $i--) {
            $f=$Plan.files[$i]; $current=Get-WTHash $f.destination
            if ($current -ne $f.before) {
                if ($f.before -eq 'ABSENT') {
                    if ((Get-WTHash $f.destination) -ne $f.after) { throw 'DRIFT: restore delete precondition changed.' }
                    Remove-WTExact $f.destination $f.after
                } else {
                    $backup=Join-Path $archive ($f.before + '.before')
                    if ((Get-WTHash $backup) -ne $f.before) { throw 'BACKUP_CORRUPT: restore backup hash mismatch.' }
                    Write-WTBytes $f.destination ([IO.File]::ReadAllBytes($backup)) $current
                }
            }
            $Journal.operations[$i]='RESTORED'; Write-WTJson $journalPath $Journal
        }
        Set-WTIndex $StateRoot $Plan $true
        $Journal.phase='RESTORED'; $Journal.loaded=Get-WTLoaded 'Unknown' '' ''; Write-WTJson $journalPath $Journal
        return $Journal
    }
    if ($Journal.phase -in @('RESTORING','RESTORED')) { throw 'RESTORE_IN_PROGRESS: use Restore to finish rollback.' }
    # A resumed COMPLETE receipt is reverified; it is never a cached current claim.
    for ($i=0; $i -lt $Plan.files.Count; $i++) {
        $f=$Plan.files[$i]; $current=Get-WTHash $f.destination; $step=$Journal.operations[$i]
        if ($step -eq 'APPLIED' -and $current -ne $f.after) { throw 'DRIFT: applied file changed; preserving local edit.' }
        if ($step -eq 'PENDING' -and $current -ne $f.before) { throw 'DRIFT: planned input changed.' }
        if ($step -eq 'PREPARED' -and $current -notin @($f.before,$f.after)) { throw 'DRIFT: interrupted write has unknown content.' }
    }
    if ($Journal.phase -eq 'INSTALLING') { Assert-WTSource $Plan }
    for ($i=0; $i -lt $Plan.files.Count; $i++) {
        $f=$Plan.files[$i]
        if ($Journal.operations[$i] -eq 'APPLIED') { continue }
        if ($Journal.operations[$i] -eq 'PENDING') {
            if ($f.before -ne $f.after -and $f.before -ne 'ABSENT') {
                $backup=Join-Path $archive ($f.before + '.before')
                if ((Get-WTHash $f.destination) -ne $f.before) { throw 'DRIFT: backup source changed.' }
                Write-WTBytes $backup ([IO.File]::ReadAllBytes($f.destination))
                if ((Get-WTHash $backup) -ne $f.before) { throw 'DRIFT: backup differs from planned input.' }
            }
            $Journal.operations[$i]='PREPARED'; Write-WTJson $journalPath $Journal
        }
        $current=Get-WTHash $f.destination
        if ($current -ne $f.after) {
            if ($current -ne $f.before) { throw 'DRIFT: mutation precondition changed.' }
            if ($f.retired) {
                if ((Get-WTHash $f.destination) -ne $f.before) { throw 'DRIFT: retirement precondition changed.' }
                Remove-WTExact $f.destination $f.before
            } else {
                $payload=Join-Path $archive ($f.after + '.source')
                if ((Get-WTHash $payload) -ne $f.after) { throw 'PAYLOAD_CORRUPT: frozen source differs.' }
                Write-WTBytes $f.destination ([IO.File]::ReadAllBytes($payload)) $f.before
            }
        }
        Invoke-WTFailure "AfterWrite:$i"
        if ((Get-WTHash $f.destination) -ne $f.after) { throw 'INSTALL_VERIFY: installed bytes differ.' }
        $Journal.operations[$i]='APPLIED'; Write-WTJson $journalPath $Journal
        Invoke-WTFailure "AfterOperation:$i"
    }
    foreach ($f in $Plan.files) { if ((Get-WTHash $f.destination) -ne $f.after) { throw 'DRIFT: installed generation changed during apply.' } }
    if ($Journal.phase -eq 'INSTALLING') { $Journal.phase='REFERENCE'; Write-WTJson $journalPath $Journal; Invoke-WTFailure 'AfterInstall' }
    if ($Journal.phase -eq 'REFERENCE') {
        $text = "# Source-derived workflow tooling reference`n`nGeneration: $($Plan.sourceGeneration)`n`nThis is frozen versioned source, not a running registry or loaded-state claim.`n"
        foreach ($f in $Plan.files) {
            $text += "`n## $($f.target)`n`n"
            if ($f.retired) { $text += "Explicitly retired.`n" }
            else {
                $payload=Join-Path $archive ($f.after + '.source')
                if ((Get-WTHash $payload) -ne $f.after) { throw 'PAYLOAD_CORRUPT: reference source differs.' }
                $text += [IO.File]::ReadAllText($payload) + "`n"
            }
        }
        $reference=Resolve-WTRelative $StateRoot ("references/$($Plan.id).md")
        Write-WTBytes $reference ([Text.UTF8Encoding]::new($false).GetBytes($text))
        $Journal.referencePath=$reference; $Journal.referenceHash=Get-WTHash $reference
        $Journal.phase='RECEIPT'; Write-WTJson $journalPath $Journal; Invoke-WTFailure 'AfterReference'
    }
    if ((Get-WTHash $Journal.referencePath) -ne $Journal.referenceHash) { throw 'REFERENCE_DRIFT: source reference changed.' }
    Set-WTIndex $StateRoot $Plan $false
    Invoke-WTFailure 'AfterIndex'
    $Journal.loaded=Get-WTLoaded $ServerState $LoadedEvidencePath $Plan.sourceGeneration
    $Journal.phase='COMPLETE'; Write-WTJson $journalPath $Journal
    return $Journal
}
function Invoke-WorkflowTooling {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('Plan','Apply','Status','Resume','Restore')][string]$Action,
        [object[]]$Mapping=@(),
        [string]$StateRoot=(Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'FractalAgentLab/workflow-tooling'),
        [string]$PlanId,[string]$TransactionId,[switch]$AdoptExisting,
        [ValidateSet('Unknown','Absent','Running')][string]$ServerState='Unknown',
        [string]$LoadedEvidencePath
    )
    $StateRoot=Get-WTPath $StateRoot
    if ($Action -eq 'Status') {
        $inventory=Get-WTInventory $Mapping $StateRoot $false
        return [pscustomobject]@{sourceGeneration=$inventory.sourceGeneration;installedMatches=(@($inventory.files | Where-Object {$_.before -ne $_.after}).Count -eq 0);files=$inventory.files;pendingTransactions=@(Get-WTPending $StateRoot);loaded=(Get-WTLoaded $ServerState $LoadedEvidencePath $inventory.sourceGeneration)}
    }
    # Reject unsafe topology or an invalid recovery identity before even creating
    # a state directory/lock; a mistaken StateRoot must not write into source.
    if ($Action -eq 'Plan') { Assert-WTMappingRoots $Mapping $StateRoot }
    else {
        $preflightId=$PlanId; if ($Action -ne 'Apply') { $preflightId=$TransactionId }
        $preflight=Read-WTJson (Get-WTIdPath $StateRoot 'plans' $preflightId)
        if ($preflight.id -cne $preflightId -or (Get-WTPlanIdentity $preflight) -cne $preflightId) { throw 'PLAN_DRIFT: stored plan no longer matches its content-bound identity.' }
        Assert-WTPlanPaths $preflight $StateRoot
    }
    [void][IO.Directory]::CreateDirectory($StateRoot)
    $lock=$null; $mutexes=@()
    try {
        $lock=[IO.File]::Open((Join-Path $StateRoot 'writer.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        if ($Action -eq 'Plan') {
            Assert-WTNoPending $StateRoot
            $inventory=Get-WTInventory $Mapping $StateRoot ([bool]$AdoptExisting)
            $roots=@($inventory.sources | ForEach-Object installRoot)
        } else {
            $id=$PlanId; if ($Action -ne 'Apply') { $id=$TransactionId }
            $planPath=Get-WTIdPath $StateRoot 'plans' $id
            $plan=Read-WTJson $planPath
            if ($plan.id -ne $id -or $plan.schemaVersion -ne 1) { throw 'PLAN_ID: invalid stored plan.' }
            if ((Get-WTPlanIdentity $plan) -cne $id) { throw 'PLAN_DRIFT: stored plan no longer matches its content-bound identity.' }
            Assert-WTPlanPaths $plan $StateRoot
            $roots=@($plan.sources | ForEach-Object installRoot)
        }
        # Coordinate different StateRoots targeting the same installation too.
        foreach ($root in @($roots | Sort-Object -Unique)) {
            $mutex=[Threading.Mutex]::new($false,('Local\WorkflowTooling-' + (Get-WTTextHash $root.ToLowerInvariant())))
            try { $acquired=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $acquired=$true }
            if (-not $acquired) { $mutex.Dispose(); throw 'INSTALL_LOCKED: another installer owns this root.' }
            $mutexes += $mutex
        }
        if ($Action -eq 'Plan') {
            # Re-read after acquiring installation locks.
            $inventory=Get-WTInventory $Mapping $StateRoot ([bool]$AdoptExisting)
            $plan=[pscustomobject]@{schemaVersion=1;id='';createdAt=[DateTimeOffset]::UtcNow.ToString('o');sourceGeneration=$inventory.sourceGeneration;sources=$inventory.sources;files=$inventory.files;blocked=($inventory.issues.Count -gt 0);indexHash=(Get-WTHash (Join-Path $StateRoot 'installed.json'))}
            $id=Get-WTPlanIdentity $plan; $plan.id=$id
            foreach ($f in $plan.files) { if (-not $f.retired) {
                $payload=Join-Path $StateRoot ("objects/$($f.after).source")
                Write-WTBytes $payload ([IO.File]::ReadAllBytes($f.source))
                if ((Get-WTHash $payload) -ne $f.after) { throw 'SOURCE_DRIFT: source changed during Plan.' }
            } }
            Write-WTJson (Get-WTIdPath $StateRoot 'plans' $id) $plan
            return $plan
        }
        Assert-WTNoPending $StateRoot $id
        $journalPath=Get-WTIdPath $StateRoot 'transactions' $id
        if ($Action -eq 'Apply') {
            if (Test-Path -LiteralPath $journalPath) { throw "TRANSACTION_EXISTS: use Resume -TransactionId $id." }
            if ($plan.blocked) { throw 'BLOCKED_PLAN: import/reconcile managed drift or explicitly review first-install adoption.' }
            if ((Get-WTHash (Join-Path $StateRoot 'installed.json')) -ne $plan.indexHash) { throw 'PLAN_STALE: installed baseline changed; create a new Plan.' }
            Assert-WTSource $plan
            $journal=[pscustomobject]@{schemaVersion=1;id=$id;planHash=(Get-WTHash $planPath);sourceGeneration=$plan.sourceGeneration;phase='INSTALLING';operations=@($plan.files | ForEach-Object {'PENDING'});referencePath='';referenceHash='';loaded=$null;recovery=$null}
            Write-WTJson $journalPath $journal
        } else {
            $journal=Read-WTJson $journalPath
            if ($journal.id -ne $id -or $journal.planHash -ne (Get-WTHash $planPath)) { throw 'PLAN_DRIFT: recorded plan changed.' }
        }
        try { return Continue-WTTransaction $StateRoot $plan $journal ($Action -eq 'Restore') $ServerState $LoadedEvidencePath }
        catch {
            if ($_.Exception.Data.Contains('WorkflowToolingRecoveryPath')) {
                $recoveryPath=[string]$_.Exception.Data['WorkflowToolingRecoveryPath']
                $journal.recovery=[pscustomobject]@{path=$recoveryPath;hash=(Get-WTHash $recoveryPath);reason='Concurrent edit displaced during atomic mutation; both source payload and raced bytes retained.'}
                $journal.phase='DRIFT'; Write-WTJson $journalPath $journal
            }
            throw
        }
    } finally {
        foreach ($mutex in $mutexes) { $mutex.ReleaseMutex(); $mutex.Dispose() }
        if ($null -ne $lock) { $lock.Dispose() }
    }
}
Export-ModuleMember -Function Invoke-WorkflowTooling
