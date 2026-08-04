[CmdletBinding()]
param(
  [ValidateSet('Candidate','Live','Snapshot')][string]$Mode = 'Candidate',
  [string]$CandidateRoot = '',
  [string]$BaselineRoot = '',
  [string]$LiveRoot = '',
  [string]$SnapshotRoot = '',
  [string]$CanonRoot = ''
)

$ErrorActionPreference = 'Stop'
$Failures = New-Object System.Collections.Generic.List[string]
function Assert-True { param([bool]$Condition,[string]$Message) if(-not $Condition){$Failures.Add($Message)} }
function Assert-Contains { param([string]$Text,[string]$Needle,[string]$Message) if($Text.IndexOf($Needle,[StringComparison]::Ordinal)-lt 0){$Failures.Add($Message)} }

function Resolve-TestRoot {
  param([string]$Path,[string]$Label)
  if([string]::IsNullOrWhiteSpace($Path)-or-not[IO.Path]::IsPathRooted($Path)){throw "$Label must be an absolute path."}
  $Full=[IO.Path]::GetFullPath($Path).TrimEnd([char[]]@('\','/'))
  if(-not(Test-Path -LiteralPath $Full -PathType Container)){throw "$Label is missing."}
  if(((Get-Item -LiteralPath $Full -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)-ne 0){throw "$Label cannot be a reparse point."}
  return $Full
}

function Get-StrictJsonFile {
  param([string]$Path)
  if(-not(Test-Path -LiteralPath $Path -PathType Leaf)){throw "JSON file is missing: $Path"}
  $Text=[IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8)
  if($Text -match '(?m)"([^"\\]|\\.)+"\s*:.*\r?\n\s*"\1"\s*:'){throw "JSON file contains a duplicate-looking key: $Path"}
  return $Text|ConvertFrom-Json
}

function Get-RelativeHash {
  param([string]$Root,[string]$Relative)
  $Path=Join-Path $Root $Relative
  if(-not(Test-Path -LiteralPath $Path -PathType Leaf)){return 'MISSING'}
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-TextSha256 {
  param([string]$Text)
  $Sha=[Security.Cryptography.SHA256]::Create()
  try{return ([BitConverter]::ToString($Sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-','').ToLowerInvariant()}
  finally{$Sha.Dispose()}
}

function Get-InventoryNames {
  param([string]$Root,[string]$Kind)
  $Directory=Join-Path $Root $(if($Kind -ceq 'command'){'commands'}else{'skills'})
  if(-not(Test-Path -LiteralPath $Directory -PathType Container)){return @()}
  if($Kind -ceq 'command'){return @(Get-ChildItem -LiteralPath $Directory -Filter '*.md' -File|ForEach-Object{$_.BaseName}|Sort-Object -CaseSensitive)}
  return @(Get-ChildItem -LiteralPath $Directory -Filter 'SKILL.md' -File -Recurse|ForEach-Object{$_.Directory.Name}|Sort-Object -CaseSensitive)
}

function Get-MatrixSectionNames {
  param([string]$Text,[string]$Heading)
  $Start=$Text.IndexOf("## $Heading",[StringComparison]::Ordinal)
  if($Start -lt 0){return @()}
  $Next=$Text.IndexOf("`n## ",$Start+4,[StringComparison]::Ordinal)
  $Section=if($Next -lt 0){$Text.Substring($Start)}else{$Text.Substring($Start,$Next-$Start)}
  return @([regex]::Matches($Section,'(?m)^\| `([^`]+)` \| `(IMPACTED|NOT_AFFECTED)')|ForEach-Object{$_.Groups[1].Value}|Sort-Object -CaseSensitive)
}

$FalRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
if([string]::IsNullOrWhiteSpace($CandidateRoot)){$CandidateRoot=Join-Path $FalRoot 'data\migration-candidates\compact-v2-global-v1'}
if([string]::IsNullOrWhiteSpace($BaselineRoot)){$BaselineRoot=Join-Path $FalRoot 'data\migration-baselines\compact-v2-global-v1'}
if([string]::IsNullOrWhiteSpace($LiveRoot)){$LiveRoot=Join-Path ([Environment]::GetFolderPath('UserProfile')) '.config\opencode'}
if([string]::IsNullOrWhiteSpace($CanonRoot)){$CanonRoot=Join-Path (Split-Path -Parent $FalRoot) 'Agent-Workflow-Canon'}
if([string]::IsNullOrWhiteSpace($SnapshotRoot)){$SnapshotRoot=Join-Path $CanonRoot 'reference\tooling-snapshot'}

$CandidateRoot=Resolve-TestRoot $CandidateRoot 'Candidate root'
$BaselineRoot=Resolve-TestRoot $BaselineRoot 'Baseline root'
$LiveRoot=Resolve-TestRoot $LiveRoot 'Live root'
$CanonRoot=Resolve-TestRoot $CanonRoot 'Canon root'
if($Mode -ceq 'Snapshot'){$SnapshotRoot=Resolve-TestRoot $SnapshotRoot 'Snapshot root'}

$Payloads=@(
  'commands\after-compact.md','commands\wave-start.md','commands\fal-orchestrate-target.md',
  'skills\context-restore\SKILL.md','skills\context-onboarding\SKILL.md',
  'skills\fal-orchestrate-target\SKILL.md','skills\closeout-commit\SKILL.md'
)
$Pins=[ordered]@{
  'canon/CANONICAL-CONTRACT.json'='d445c4d589808ca36535a84ab20c6d32f5471d77c1658ae21cf2bca91cad78a5'
  'registry/COMPACT-BOUNDARY.schema.json'='3b1ddf0fe22a93e40a6799e601f5e202a7a34b7e010be10e4babd27d9d543703'
  'registry/COMPACT-POLICY.schema.json'='3237fb6d2212e33e9c5a7dd6d0cc02734502201435a9e2ae4ccc24f54fb59a97'
  'registry/HYDRATION-REGISTRY.schema.json'='9876d3ca0590465d7ac95bf2a4ff33649723e49fbe745f6209f98bb3bf591bf9'
  'registry/HYDRATION-REQUEST.schema.json'='023582092aa4ce71bfca78f917efbc87d233368571a8e0e4f1d3cb1fa896a885'
  'registry/HYDRATION-RESULT.schema.json'='9621db63b27b9a44295752259c8d45b2e5c5532bae32809b60995274c0727566'
  'scripts/resolve-hydration.ps1'='8a3bdc7d6201bc4504bd5ccba9662350f7c64ea780c692e0fc8cb7e6b590ef69'
  'scripts/invoke-hydration.ps1'='ee0b7c16dfb0522d38b403113ebf2902c646c4fa2501e77c98be00313baa904f'
}
$PackDigest='69080ed3e17343637254de77cd6662c25ce6c7db95896904fd2355967f2f720b'

function Assert-GenerationSemantics {
  param([string]$Root,[string]$Label,[bool]$RequireGlobalPolicy)
  $Restore=[IO.File]::ReadAllText((Join-Path $Root 'skills\context-restore\SKILL.md'))
  $Onboarding=[IO.File]::ReadAllText((Join-Path $Root 'skills\context-onboarding\SKILL.md'))
  foreach($Pair in $Pins.GetEnumerator()){
    Assert-Contains $Restore $Pair.Value "$Label context-restore lacks final pin $($Pair.Key)."
    Assert-Contains $Onboarding $Pair.Value "$Label context-onboarding lacks final pin $($Pair.Key)."
  }
  Assert-Contains $Restore $PackDigest "$Label context-restore lacks the five-schema digest."
  Assert-Contains $Onboarding $PackDigest "$Label context-onboarding lacks the five-schema digest."
  Assert-Contains $Restore 'V1 resolver status is `READY`' "$Label V1 status-gated law is missing."
  Assert-Contains $Restore 'V2 confidence is `VERIFIED` or' "$Label V2 guarded confidence is missing."
  Assert-Contains $Restore '`SUFFICIENT` with action `AUTO_RESUME` and route input `EXACT`' "$Label V2 guarded action/route conjunction is missing."
  Assert-Contains $Restore '-VerifiedSelectedCommandIdentity' "$Label V2 selected-command proof is missing."
  foreach($Line in @('Hydration confidence:','Hydration action:','Route input:')){Assert-Contains $Restore $Line "$Label context-restore lacks $Line"}

  $After=[IO.File]::ReadAllText((Join-Path $Root 'commands\after-compact.md'))
  Assert-Contains $After 'This read-only command never sends the resumed command.' "$Label after-compact must remain read-only."
  foreach($Line in @('Hydration confidence:','Hydration action:','Route input:')){Assert-Contains $After $Line "$Label after-compact lacks $Line"}
  $Orchestrator=[IO.File]::ReadAllText((Join-Path $Root 'skills\fal-orchestrate-target\SKILL.md'))
  foreach($Event in @('before_dispatch','after_stage_output','epic_closeout')){Assert-Contains $Orchestrator $Event "$Label orchestrator lacks $Event event coupling."}
  Assert-Contains $Orchestrator 'Never retry an' "$Label orchestrator lacks no-retry law."
  Assert-Contains $Orchestrator '`UNCERTAIN` event under a new event ID.' "$Label orchestrator lacks cross-event uncertainty stop."
  $Closeout=[IO.File]::ReadAllText((Join-Path $Root 'skills\closeout-commit\SKILL.md'))
  Assert-Contains $Closeout 'This skill never invokes compaction or the Compact V2 adapter.' "$Label closeout must not compact inline."
  Assert-Contains $Closeout '`routing_verdict: CLOSED`' "$Label closeout lacks the later event trigger."

  foreach($Relative in $Payloads){
    $Text=[IO.File]::ReadAllText((Join-Path $Root $Relative))
    Assert-True ($Text.StartsWith("---`n")-or$Text.StartsWith("---`r`n")) "$Label Markdown frontmatter is missing: $Relative"
    Assert-True ($Text -notmatch '(?i)C:\\Users\\|https?://(?:127\.0\.0\.1|localhost):\d+|password\s*[:=]\s*\S+') "$Label contains a machine or credential-shaped literal: $Relative"
    if($Relative -match '^skills\\([^\\]+)\\SKILL\.md$'){Assert-Contains $Text ("name: "+$Matches[1]) "$Label skill name/folder mismatch: $Relative"}
  }
  if($RequireGlobalPolicy){
    $Policy=Get-StrictJsonFile (Join-Path $Root 'workflow-compact-policy.json')
    Assert-True ([string]$Policy.contract -ceq 'opencode-compact-policy/v1' -and [string]$Policy.scope -ceq 'global' -and [string]$Policy.mode -ceq 'auto_safe') "$Label global compact policy identity/default is invalid."
    Assert-True (@($Policy.checks).Count -eq 3 -and @($Policy.checks)-contains 'before_dispatch' -and @($Policy.checks)-contains 'after_stage_output' -and @($Policy.checks)-contains 'epic_closeout') "$Label global policy checks are incomplete."
  }
}

foreach($Pair in $Pins.GetEnumerator()){Assert-True ((Get-RelativeHash $CanonRoot $Pair.Key)-ceq $Pair.Value) "Canon pin drift: $($Pair.Key)"}
foreach($Relative in $Payloads){
  Assert-True ((Get-RelativeHash $CandidateRoot $Relative)-cne 'MISSING') "Candidate payload missing: $Relative"
  Assert-True ((Get-RelativeHash $BaselineRoot $Relative)-cne 'MISSING') "Baseline payload missing: $Relative"
}

$GenerationRoot=if($Mode -ceq 'Candidate'){$CandidateRoot}elseif($Mode -ceq 'Live'){$LiveRoot}else{$SnapshotRoot}
Assert-GenerationSemantics -Root $GenerationRoot -Label $Mode -RequireGlobalPolicy ($Mode -cne 'Snapshot')

if($Mode -ceq 'Candidate'){
  foreach($Relative in $Payloads){Assert-True ((Get-RelativeHash $BaselineRoot $Relative)-ceq (Get-RelativeHash $LiveRoot $Relative)) "Live baseline drift: $Relative"}
  $ConfigCommands=@('after-compact','closeout-commit','connectMany','connectPair','fal-checkpoint-target','fal-orchestrate-target','implement','oc-toolsmith','seq-next','step-review','step-review-utan','swarm-review','swarm-review-setup','terv-review','terv-review-utan','wave-start','workflow-fix')|Sort-Object -CaseSensitive
  $ConfigSkills=@('closeout-commit','context-onboarding','context-restore','fal-orchestrate-target','fal-target-orchestration','fix-planning','grill-me','implementation-execution','improve-codebase-architecture','interface-first-delegation','module-prd','multi-sync','oc-toolsmith','pair-sync','plan-review','sequence-planning','step-review','swarm-review','tdd','ubiquitous-language','workflow-fix')|Sort-Object -CaseSensitive
  Assert-True ((Compare-Object $ConfigCommands (Get-InventoryNames $LiveRoot command)).Count -eq 0) 'Primary global command inventory drifted.'
  Assert-True ((Compare-Object $ConfigSkills (Get-InventoryNames $LiveRoot skill)).Count -eq 0) 'Primary global skill inventory drifted.'
  $MatrixText=[IO.File]::ReadAllText((Join-Path $FalRoot 'evidence\COMPACT-V2\global-consumer-matrix.md'))
  $LegacyRoot=Resolve-TestRoot (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.opencode') 'Additional discovered root'
  Assert-True ((Compare-Object (Get-InventoryNames $LiveRoot command) (Get-MatrixSectionNames $MatrixText 'Primary Commands')).Count -eq 0) 'Primary command matrix set differs from discovery.'
  Assert-True ((Compare-Object (Get-InventoryNames $LiveRoot skill) (Get-MatrixSectionNames $MatrixText 'Primary Skills')).Count -eq 0) 'Primary skill matrix set differs from discovery.'
  Assert-True ((Compare-Object (Get-InventoryNames $LegacyRoot command) (Get-MatrixSectionNames $MatrixText 'Additional Discovered Commands')).Count -eq 0) 'Additional command matrix set differs from discovery.'
  Assert-True ((Compare-Object (Get-InventoryNames $LegacyRoot skill) (Get-MatrixSectionNames $MatrixText 'Additional Discovered Skills')).Count -eq 0) 'Additional skill matrix set differs from discovery.'
  Assert-True ((Get-MatrixSectionNames $MatrixText 'Primary Commands').Count -eq 17 -and (Get-MatrixSectionNames $MatrixText 'Primary Skills').Count -eq 21 -and (Get-MatrixSectionNames $MatrixText 'Additional Discovered Commands').Count -eq 2 -and (Get-MatrixSectionNames $MatrixText 'Additional Discovered Skills').Count -eq 36) 'Consumer matrix contains an omitted or duplicate inventory row.'

  $Transaction=Get-StrictJsonFile (Join-Path $FalRoot 'evidence\COMPACT-V2\global-transaction-manifest.json')
  $CandidatePaths=@($Payloads+@('workflow-compact-policy.json')|Sort-Object -CaseSensitive)
  $CandidateRows=@($CandidatePaths|ForEach-Object{"$($_.Replace('\','/'))|$(Get-RelativeHash $CandidateRoot $_)"})
  $BaselinePaths=@($Payloads|Sort-Object -CaseSensitive)
  $BaselineRows=@($BaselinePaths|ForEach-Object{"$($_.Replace('\','/'))|$(Get-RelativeHash $BaselineRoot $_)"})
  Assert-True ((Get-TextSha256 ($CandidateRows-join "`n"))-ceq[string]$Transaction.candidate_manifest_sha256) 'Candidate manifest digest differs from the transaction receipt.'
  Assert-True ((Get-TextSha256 ($BaselineRows-join "`n"))-ceq[string]$Transaction.baseline_manifest_sha256) 'Baseline manifest digest differs from the transaction receipt.'
  Assert-True (@($Transaction.operations).Count -eq 8) 'Transaction manifest must contain exactly eight operations.'
  foreach($Operation in @($Transaction.operations)){
    Assert-True ((Get-RelativeHash $CandidateRoot ([string]$Operation.path))-ceq[string]$Operation.after_sha256) "Transaction after hash mismatch: $($Operation.path)"
    if([string]$Operation.operation -ceq 'REPLACE'){Assert-True ((Get-RelativeHash $BaselineRoot ([string]$Operation.path))-ceq[string]$Operation.before_sha256) "Transaction before hash mismatch: $($Operation.path)"}
    else{Assert-True ([string]$Operation.operation -ceq 'CREATE' -and [string]$Operation.before_sha256 -ceq 'ABSENT') "Transaction create semantics invalid: $($Operation.path)"}
  }

  $Rehearsal=Join-Path ([IO.Path]::GetTempPath()) ('compact-v2-global-rollback-'+[guid]::NewGuid().ToString('N'))
  [void](New-Item -ItemType Directory -Path $Rehearsal)
  try {
    foreach($Relative in $Payloads+@('workflow-compact-policy.json')){
      $Destination=Join-Path $Rehearsal $Relative;$Parent=Split-Path -Parent $Destination
      if(-not(Test-Path -LiteralPath $Parent)){[void](New-Item -ItemType Directory -Path $Parent -Force)}
      [IO.File]::WriteAllBytes($Destination,[IO.File]::ReadAllBytes((Join-Path $CandidateRoot $Relative)))
    }
    foreach($Relative in $Payloads){
      $Destination=Join-Path $Rehearsal $Relative
      Assert-True ((Get-RelativeHash $Rehearsal $Relative)-ceq(Get-RelativeHash $CandidateRoot $Relative)) "Rollback rehearsal candidate drift: $Relative"
      [IO.File]::WriteAllBytes($Destination,[IO.File]::ReadAllBytes((Join-Path $BaselineRoot $Relative)))
      Assert-True ((Get-RelativeHash $Rehearsal $Relative)-ceq(Get-RelativeHash $BaselineRoot $Relative)) "Rollback rehearsal failed to restore: $Relative"
    }
    $PolicyRehearsal=Join-Path $Rehearsal 'workflow-compact-policy.json'
    if((Get-RelativeHash $Rehearsal 'workflow-compact-policy.json')-ceq(Get-RelativeHash $CandidateRoot 'workflow-compact-policy.json')){Remove-Item -LiteralPath $PolicyRehearsal -Force}
    Assert-True (-not(Test-Path -LiteralPath $PolicyRehearsal)) 'Rollback rehearsal failed to remove the transaction-created policy.'
  } finally {if(Test-Path -LiteralPath $Rehearsal){Remove-Item -LiteralPath $Rehearsal -Recurse -Force}}
} elseif($Mode -ceq 'Live') {
  foreach($Relative in $Payloads+@('workflow-compact-policy.json')){Assert-True ((Get-RelativeHash $LiveRoot $Relative)-ceq (Get-RelativeHash $CandidateRoot $Relative)) "Live/candidate mismatch: $Relative"}
} else {
  foreach($Relative in $Payloads){Assert-True ((Get-RelativeHash $SnapshotRoot $Relative)-ceq (Get-RelativeHash $CandidateRoot $Relative)) "Snapshot/candidate mismatch: $Relative"}
  $Manifest=Get-StrictJsonFile (Join-Path $SnapshotRoot 'MANIFEST.json')
  Assert-True ([string]$Manifest.canon_version -ceq '2.1.0' -and [string]$Manifest.status -ceq 'LIVE_VERIFIED') 'Snapshot manifest is not fresh Canon 2.1.0 live-verified evidence.'
}

if($Failures.Count -gt 0){Write-Error("GLOBAL COMPACT CANDIDATE TEST FAILED`n- "+($Failures -join "`n- "));exit 1}
Write-Output "GLOBAL COMPACT CANDIDATE TEST PASSED ($Mode)"
