[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ProjectId,
  [Parameter(Mandatory)][string]$ProfileId,
  [Parameter(Mandatory)][string]$AttemptId,
  [string]$TargetRoot='',
  [Parameter(Mandatory)][string]$CanonRoot,
  [Parameter(Mandatory)][string]$CanonContractSha256,
  [Parameter(Mandatory)][string]$ProjectProfileSha256,
  [Parameter(Mandatory)][string]$Target,
  [Parameter(Mandatory)][string]$RoleHint,
  [Parameter(Mandatory)][ValidateSet('before_dispatch','after_stage_output','epic_closeout')][string]$EventType,
  [string]$CloseoutReceiptPath='',
  [string]$CloseoutReceiptSha256='',
  [string]$CloseoutCandidateId='',
  [string]$Server='',
  [Parameter(Mandatory)][string]$GlobalPolicyPath,
  [Parameter(Mandatory)][string]$GlobalPolicySha256,
  [string]$ProjectPolicyPath='',
  [string]$ProjectPolicySha256='',
  [ValidateRange(1,300)][int]$RestoreTimeoutSeconds=300,
  [string]$RouterDir='.opencode-router',
  [switch]$DryRun,
  [Parameter(DontShow=$true)][string]$TestOnlyKnownFolderRoot='',
  [Parameter(DontShow=$true)][switch]$TestOnlyLegacyAuthority
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')
. (Join-Path $PSScriptRoot 'session-compact-flow-core.ps1')
. (Join-Path $PSScriptRoot 'session-compact-lite-core.ps1')

function Resolve-CompactLiteLocalRoot([string]$Path,[string]$Label){
  if([string]::IsNullOrWhiteSpace($Path)-or-not[IO.Path]::IsPathRooted($Path)){throw "$Label must be an absolute local path."}
  $full=[IO.Path]::GetFullPath($Path).TrimEnd([char[]]@('\','/'));$root=[IO.Path]::GetPathRoot($full)
  if([string]::IsNullOrWhiteSpace($root)-or$root.StartsWith('\')-or(New-Object IO.DriveInfo($root)).DriveType-ne[IO.DriveType]::Fixed){throw "$Label must be on a local fixed drive."}
  if(-not(Test-Path -LiteralPath $full -PathType Container)){throw "$Label is missing or unsafe."}
  $current=$root.TrimEnd([char[]]@('\','/'))
  foreach($component in @($full.Substring($root.Length).Split([char[]]@('\','/'),[StringSplitOptions]::RemoveEmptyEntries))){$current=Join-Path $current $component;if(((Get-Item -LiteralPath $current -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw "$Label is missing or unsafe."}}
  return $full
}
function Read-CompactLitePinnedLocalJsonFile([string]$Path,[string]$ExpectedSha256,[string]$Label){
  if([string]::IsNullOrWhiteSpace($Path)-or-not[IO.Path]::IsPathRooted($Path)){throw "$Label must be an absolute local path."}
  if($ExpectedSha256-cnotmatch'^[a-f0-9]{64}$'){throw "$Label expected SHA-256 is invalid."}
  $full=[IO.Path]::GetFullPath($Path);$root=[IO.Path]::GetPathRoot($full)
  if([string]::IsNullOrWhiteSpace($root)-or$root.StartsWith('\')-or(New-Object IO.DriveInfo($root)).DriveType-ne[IO.DriveType]::Fixed-or$full.Substring($root.Length).Contains(':')){throw "$Label must be a local fixed-drive file."}
  $current=$root
  foreach($component in @($full.Substring($root.Length).Split([char[]]@('\','/'),[StringSplitOptions]::RemoveEmptyEntries))){$current=Join-Path $current $component;if(-not(Test-Path -LiteralPath $current)){throw "$Label is missing."};if(((Get-Item -LiteralPath $current -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw "$Label path cannot contain a reparse point."}}
  $record=Read-CompactFlowStrictJsonFile -Path $full -Label $Label
  if([string]$record.Sha256-cne$ExpectedSha256){throw "$Label identity drifted."}
  return $record
}
function Resolve-CompactLitePolicy([string]$GlobalPath,[string]$GlobalSha,[string]$ProjectPath,[string]$ProjectSha){
  $global=Read-CompactLitePinnedLocalJsonFile $GlobalPath $GlobalSha 'Global compact policy'
  if([string]::IsNullOrWhiteSpace($ProjectPath)){return Resolve-CompactFlowPolicyObjects -GlobalPolicy $global.Value -GlobalSha256 $global.Sha256}
  try{
    $project=Read-CompactLitePinnedLocalJsonFile $ProjectPath $ProjectSha 'Project compact policy'
    if([IO.Path]::GetFileName($project.Path)-cne'compact-policy.json'-or[IO.Path]::GetFileName((Split-Path -Parent $project.Path))-cne'.fal'){throw 'Project compact policy must be the explicit .fal/compact-policy.json file.'}
    return Resolve-CompactFlowPolicyObjects -GlobalPolicy $global.Value -ProjectOverride $project.Value -GlobalSha256 $global.Sha256 -OverrideSha256 $project.Sha256
  }catch{
    $base=Resolve-CompactFlowPolicyObjects -GlobalPolicy $global.Value -GlobalSha256 $global.Sha256
    return [pscustomobject][ordered]@{schema_version=[string]$base.schema_version;valid=$true;automatic_action_allowed=$false;global_sha256=[string]$base.global_sha256;override_sha256='UNDECLARED';effective_policy_sha256=[string]$base.effective_policy_sha256;effective_policy=$base.effective_policy;diagnostics=@('PROJECT_OVERRIDE_REJECTED: '+$_.Exception.Message)}
  }
}
function Assert-CompactLiteCloseoutProof([string]$Root,[string]$Project,[string]$Type,[string]$ReceiptPath,[string]$ReceiptSha,[string]$CandidateId){
  if($Type-cne'epic_closeout'){
    if(-not[string]::IsNullOrWhiteSpace($ReceiptPath)-or-not[string]::IsNullOrWhiteSpace($ReceiptSha)-or-not[string]::IsNullOrWhiteSpace($CandidateId)){throw 'Closeout proof is valid only for epic_closeout.'}
    return $null
  }
  if([string]::IsNullOrWhiteSpace($ReceiptPath)-or$ReceiptSha-cnotmatch'^[a-f0-9]{64}$'-or$CandidateId-cnotmatch'^[A-Za-z0-9][A-Za-z0-9._:@+~-]{0,255}$'){throw 'epic_closeout requires a pinned candidate-bound CLOSED receipt.'}
  $snapshot=Open-CompactFlowRouteSnapshot -Root $Root -RelativePath $ReceiptPath -ExpectedSha256 $ReceiptSha -MaximumBytes 1048576
  try{
    $offset=if($snapshot.bytes.Length-ge3-and$snapshot.bytes[0]-eq0xEF-and$snapshot.bytes[1]-eq0xBB-and$snapshot.bytes[2]-eq0xBF){3}else{0}
    $text=(New-Object Text.UTF8Encoding($false,$true)).GetString($snapshot.bytes,$offset,$snapshot.bytes.Length-$offset)
    if(-not(Test-OCRouterCloseoutResultOutput -Text $text -Context ([pscustomobject]@{candidate=$CandidateId}))){throw 'Closeout receipt does not satisfy the canonical closeout output contract.'}
    $lines=@($text.Replace("`r`n","`n").Replace("`r","`n")-split"`n"|Where-Object{-not[string]::IsNullOrWhiteSpace($_)})
    if([string]$lines[1]-cne"Target: $Project"-or[string]$lines[6]-cne'routing_verdict: CLOSED'){throw 'Closeout receipt does not bind the admitted project and CLOSED route.'}
    return $snapshot
  }catch{$snapshot.stream.Dispose();throw}
}
function Get-CompactLiteSessionId($Entry) {
  $value = if ($Entry -is [string]) {
    [string]$Entry
  }
  else {
    [string](Get-CompactFlowProperty $Entry sessionId (Get-CompactFlowProperty $Entry id ''))
  }
  if ($value -cnotmatch '^[A-Za-z0-9_-]{1,160}$') { throw 'Mapped session identity has an invalid shape.' }
  return $value
}
function Test-CompactLiteParticipantReference($Value, [string]$LogicalRef) {
  if ($null -eq $Value) { return $false }
  if ($Value -is [string]) { return [string]$Value -ceq $LogicalRef }
  if ($Value -is [Collections.IEnumerable] -and $Value -isnot [pscustomobject] -and $Value -isnot [Collections.IDictionary]) {
    foreach ($item in $Value) {
      if (Test-CompactLiteParticipantReference $item $LogicalRef) { return $true }
    }
    return $false
  }
  foreach ($name in @(Get-CompactFlowPropertyNames $Value)) {
    $child = Get-CompactFlowProperty $Value $name
    if ($name -in @('recipient','target','to','logical_session_ref','session','producer_session') -and [string]$child -ieq $LogicalRef) { return $true }
    if ($child -isnot [string] -and (Test-CompactLiteParticipantReference $child $LogicalRef)) { return $true }
  }
  return $false
}
function Get-CompactLiteLifecycleIntentState([string]$RouterRoot,[string]$LogicalRef){
  $files=New-Object Collections.Generic.List[IO.FileInfo]
  $entryCount=0;$totalBytes=[int64]0
  foreach ($relative in @('runs','packet-runs','inflight','outbox','plan-review-runs','review-fix-runs','step-review-runs','parallel-runs')) {
    $root = Join-Path $RouterRoot $relative
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    if (((Get-Item -LiteralPath $root -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return 'UNCERTAIN' }
    $stack=New-Object Collections.Generic.Stack[object];$stack.Push([pscustomobject]@{path=$root;depth=0})
    while($stack.Count){$node=$stack.Pop();foreach($item in Get-ChildItem -LiteralPath $node.path -Force){$entryCount++;if($entryCount-gt1000){return 'UNCERTAIN'};if(($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){return 'UNCERTAIN'};if($item.PSIsContainer){if([int]$node.depth-ge8){return 'UNCERTAIN'};$stack.Push([pscustomobject]@{path=$item.FullName;depth=([int]$node.depth+1)})}elseif($item.Extension-ceq'.json'){if($item.Length-gt1048576){return 'UNCERTAIN'};$totalBytes+=$item.Length;if($totalBytes-gt8388608){return 'UNCERTAIN'};$files.Add($item);if($files.Count-gt500){return 'UNCERTAIN'}}}}
    }
  foreach ($file in $files) {
    try { $record = (Read-CompactFlowStrictJsonFile $file.FullName 'Router intent evidence').Value }
    catch { return 'UNCERTAIN' }
    if (-not (Test-CompactLiteParticipantReference $record $LogicalRef)) { continue }
    $status = ([string](Get-CompactFlowProperty $record status '')).ToLowerInvariant()
    $transport = ([string](Get-CompactFlowProperty $record transport_status '')).ToLowerInvariant()
    if ($status -in @('transport_uncertain','delivery_uncertain','uncertain','reconciliation_needed') -or $transport -in @('transport_uncertain','delivery_uncertain','uncertain')) { return 'UNCERTAIN' }
    if ($status -in @('pending','claimed','inflight','started','running')) { return 'PENDING' }
    if ($status -notin @('dispatched','accepted','delivered','sent','success','succeeded','complete','completed','validated','settled','closed','cancelled','failed')) { return 'UNCERTAIN' }
  }
  $v2Root=Join-Path $RouterRoot 'compact-runs'
  if(Test-Path -LiteralPath $v2Root -PathType Container){
    $v2Item=Get-Item -LiteralPath $v2Root -Force;if(($v2Item.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){return 'UNCERTAIN'}
    $v2Files=@(Get-ChildItem -LiteralPath $v2Root -Force -File -Filter '*.json');if($v2Files.Count-gt100){return 'UNCERTAIN'}
    $v2TotalBytes=[int64]0
    foreach($file in $v2Files){if(($file.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0-or$file.Length-gt1048576){return 'UNCERTAIN'};$v2TotalBytes+=$file.Length;if($v2TotalBytes-gt8388608){return 'UNCERTAIN'};try{$ledger=(Read-CompactFlowStrictJsonFile $file.FullName 'Retained Compact V2 ledger').Value}catch{return 'UNCERTAIN'};if([string]$ledger.schema_version-cne'compact-run-ledger/v1'-or$null-eq$ledger.runs){return 'UNCERTAIN'};foreach($run in @($ledger.runs|Where-Object{[string]$_.logical_session_ref-ceq$LogicalRef})){$state=[string]$run.state;if(-not[bool]$run.terminal-or$state-in@('PLANNED','INTENT_PERSISTED','MARKER_VERIFIED','HYDRATION_PENDING')){return 'PENDING'};if($state-ceq'UNCERTAIN'){return 'UNCERTAIN'};if($state-cnotin@('COMPLETE','ROUTE_READY','MANUAL_COMPACT','PROOF_REQUIRED','CONFIRM','BLOCKED')){return 'UNCERTAIN'}}}
  }
  return 'SETTLED'
}
function Get-CompactLiteParticipantCompactState([string]$ParticipantDir) {
  if (-not (Test-Path -LiteralPath $ParticipantDir -PathType Container)) { return 'SETTLED' }
  if (((Get-Item -LiteralPath $ParticipantDir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return 'UNCERTAIN' }
  $files = @(Get-ChildItem -LiteralPath $ParticipantDir -Force -File -Filter '*.json')
  if ($files.Count -gt 100) { return 'UNCERTAIN' }
  $totalBytes=[int64]0
  foreach ($file in $files) {
    if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $file.Length-gt1048576) { return 'UNCERTAIN' }
    $totalBytes+=$file.Length;if($totalBytes-gt8388608){return 'UNCERTAIN'}
    try { $ledger = (Read-CompactFlowStrictJsonFile $file.FullName 'Compact Lite participant ledger').Value }
    catch { return 'UNCERTAIN' }
    if (-not(Test-CompactLiteLedgerShape -Ledger $ledger -ExpectedAttemptId $file.BaseName)) { return 'UNCERTAIN' }
    $state = [string]$ledger.state
    $result = Get-CompactFlowProperty $ledger result
    if (-not [bool]$ledger.terminal -or $state -in @('INTENT_PERSISTED','MARKER_VERIFIED','RESTORE_PENDING')) { return 'PENDING' }
    if ($state -in @('COMPACT_UNCERTAIN','RESTORE_UNCERTAIN') -or ($null -ne $result -and [string]$result.disposition -ceq 'COMPACT_UNCERTAIN')) { return 'UNCERTAIN' }
  }
  return 'SETTLED'
}
function Get-CompactLiteResponseIdentity($Response) {
  foreach ($name in @('markerID','markerId','compactionID','compactionId')) {
    $value = [string](Get-CompactFlowProperty $Response $name '')
    if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
  }
  return ''
}
function Assert-CompactLiteAdmission([string]$Canon,[string]$TargetRoot,[string]$Project,[string]$Profile,[string]$Target,[string]$Role,[string]$ExpectedContractSha256,[string]$ExpectedProfileSha256) {
  if (-not (Test-CompactFlowStableId $Project) -or -not (Test-CompactFlowStableId $Profile)) { throw 'Project/profile identity has an unsafe shape.' }
  foreach($identity in @($ExpectedContractSha256,$ExpectedProfileSha256)){if($identity-cnotmatch'^[a-f0-9]{64}$'){throw 'Compact Lite admission SHA-256 is invalid.'}}
  $contractPath=Resolve-CompactFlowContainedFile -Root $Canon -RelativePath 'canon/CANONICAL-CONTRACT.json'
  $contractRecord=Read-CompactFlowStrictJsonFile $contractPath 'Compact Lite Canon contract';if([string]$contractRecord.Sha256-cne$ExpectedContractSha256){throw 'Canon contract identity drifted.'}
  $contract=$contractRecord.Value
  if([string]$contract.canon_version-cnotmatch'^4\.'-or[string]$contract.compact_lite_contract.contract-cne'opencode-compact-lite/v1'-or[string]$contract.compact_lite_contract.active_path_after_apply-cne'COMPACT_LITE_ONLY'){throw 'Canon contract does not activate Compact Lite.'}
  $path = Resolve-CompactFlowContainedFile -Root $Canon -RelativePath ("registry/projects/$Project.json")
  $profileRecord=Read-CompactFlowStrictJsonFile $path 'Compact Lite project profile';if([string]$profileRecord.Sha256-cne$ExpectedProfileSha256){throw 'Project profile identity drifted.'}
  $record = $profileRecord.Value
  if ([string]$record.schema_version -cne '2' -or [string]$record.project_id -cne $Project -or [string]$record.synchronization_identity -cnotmatch 'compact-lite' -or [string]$record.enrollment_status -cnotin @('LEGACY_VALIDATED','ACTIVE')) { throw 'Project is not admitted to Compact Lite.' }
  $compat = Get-CompactFlowProperty $record canon_compatibility
  if ([int](Get-CompactFlowProperty $compat maximum_major_version 0) -lt 4) { throw 'Project Canon compatibility does not admit Compact Lite.' }
  $markers = @((Get-CompactFlowProperty (Get-CompactFlowProperty $record root_locator) markers @()))
  if ($markers.Count -eq 0) { throw 'Project root markers are missing.' }
  foreach ($marker in $markers) {
    $markerPath = Resolve-CompactFlowContainedFile -Root $TargetRoot -RelativePath ([string]$marker.path)
    $markerText = [IO.File]::ReadAllText($markerPath, [Text.Encoding]::UTF8)
    if (-not $markerText.Contains([string]$marker.contains)) { throw 'Target root does not match the admitted project.' }
  }
  $matches=@($record.profiles|Where-Object{[string]$_.profile_id-ceq$Profile});if($matches.Count-ne1){throw 'Compact Lite profile is missing or ambiguous.'}
  $selected=$matches[0];$capability=[string]$selected.base_capability;$accountable=[string]$selected.accountable_lane
  $profileSeparator=$Profile.IndexOf('.');if($profileSeparator-lt1-or$profileSeparator-eq($Profile.Length-1)-or$Target-cne$Profile.Substring($profileSeparator+1)){throw 'Logical participant does not match the exact admitted profile.'}
  $roleOk=switch($capability){
    'META'{$Role-in@('Meta','Meta Coordinator')}
    'DELIVERY'{if($Profile-cmatch'\.track-(?<lane>[a-z])$'){$Role-ceq('Track '+$Matches['lane'].ToUpperInvariant())}else{-not[string]::IsNullOrWhiteSpace($accountable)-and$Role-ceq$accountable}}
    'EVIDENCE'{$Role-in@('SMR','SMR Analyst')}
    'ORCHESTRATOR'{$Role-ceq'Orchestrator'}
    'MAINTENANCE'{$Role-ceq'Workflow Maintainer'-or(-not[string]::IsNullOrWhiteSpace($accountable)-and$Role-ceq$accountable)}
    'REVIEW_GATE_OPERATOR'{$Role-ceq'Reviewer'}
    'CLOSEOUT'{$Role-ceq'Closeout'}
    default{$false}
  }
  if(-not$roleOk){throw 'Role hint does not match the exact admitted profile.'}
}
function Get-CompactLiteCommandResponseIdentity($Response){foreach($name in @('messageID','messageId','message_id','requestID','requestId','request_id','id')){$value=[string](Get-CompactFlowProperty $Response $name '');if(-not[string]::IsNullOrWhiteSpace($value)){return $value}};return ''}

function Assert-CompactLiteLegacyFixtureAuthority([string]$ScriptRoot,[string]$Root) {
  $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([char[]]@('\','/'))+[IO.Path]::DirectorySeparatorChar
  $scriptFull=[IO.Path]::GetFullPath($ScriptRoot).TrimEnd([char[]]@('\','/'))+[IO.Path]::DirectorySeparatorChar
  $rootFull=[IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\','/'))+[IO.Path]::DirectorySeparatorChar
  if(-not$scriptFull.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-or-not$rootFull.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)){throw 'Test-only legacy Compact authority is restricted to temporary copied fixtures.'}
}
function Invoke-CompactLiteProtectedAuthority([string]$Project,[string]$LogicalRef,[string]$Attempt,[string]$KnownFolderRoot,[switch]$Consume) {
  $launcher=Join-Path $PSScriptRoot 'Invoke-OCRouter.ps1'
  if(-not(Test-Path -LiteralPath $launcher -PathType Leaf)){throw 'Attested protected router launcher is unavailable.'}
  $arguments=@{Operation=$(if($Consume){'consume-compact-authority'}else{'resolve-compact-authority'});TargetId=$Project;RecipientRole=$LogicalRef;InternalCompactHandoff=$true}
  if($Consume){$arguments.CompactAttemptId=$Attempt}
  if(-not[string]::IsNullOrWhiteSpace($KnownFolderRoot)){$arguments.TestOnlyKnownFolderRoot=$KnownFolderRoot}
  $output=@(& $launcher @arguments)
  if($LASTEXITCODE-ne0-or$output.Count-ne1){throw 'Protected Compact authority resolution failed.'}
  $statusJson=[string]$output[0]
  Assert-CompactFlowStrictJson $statusJson 'Protected Compact authority status'
  $status=$statusJson|ConvertFrom-Json
  $expectedStatus=@('authorization_state','authorization_use_sha256','capability_receipt_sha256','command_timeout_ms','handoff_token','logical_session_ref','mode','schema_version','server_binary_sha256','server_instance_identity_sha256','session_sha256','target_directory_sha256','target_id')
  if((@($status.PSObject.Properties.Name|Sort-Object)-join"`n")-ne($expectedStatus-join"`n")-or[string]$status.schema_version-cne'compact-protected-authority-status.v1'-or[string]$status.handoff_token-cnotmatch'^[a-f0-9]{32}$'){throw 'Protected Compact authority status is invalid.'}
  $knownFolder=if(-not[string]::IsNullOrWhiteSpace($KnownFolderRoot)){[IO.Path]::GetFullPath($KnownFolderRoot)}else{[Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)}
  $handoffRoot=Resolve-CompactLiteLocalRoot (Join-Path $knownFolder 'FractalAgentLab\oc-router\runtime\compact-authority-handoffs') 'Protected Compact authority handoff root'
  $handoffPath=[IO.Path]::GetFullPath((Join-Path $handoffRoot (([string]$status.handoff_token)+'.json')))
  if(-not$handoffPath.StartsWith($handoffRoot.TrimEnd([char[]]@('\','/'))+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)-or-not(Test-Path -LiteralPath $handoffPath -PathType Leaf)){throw 'Protected Compact authority handoff is unavailable.'}
  $handoffItem=Get-Item -LiteralPath $handoffPath -Force
  if(($handoffItem.Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'Protected Compact authority handoff cannot be a reparse point.'}
  try{$json=Get-Content -Raw -LiteralPath $handoffPath}finally{Remove-Item -LiteralPath $handoffPath -Force}
  Assert-CompactFlowStrictJson $json 'Protected Compact authority packet'
  $packet=$json|ConvertFrom-Json
  $expected=@('authorization_state','authorization_use_sha256','capability_receipt_sha256','command_timeout_ms','logical_session_ref','mode','origin','router_protocol_identity','schema_version','server_binary_sha256','server_instance_identity_sha256','session_id','session_sha256','target_directory_sha256','target_id','target_root')
  if((@($packet.PSObject.Properties.Name|Sort-Object)-join"`n")-ne($expected-join"`n")-or[string]$packet.schema_version-cne'compact-protected-authority.v1'-or[string]$packet.router_protocol_identity-cne'fal-explicit-stage-router/v1'-or[string]$packet.target_id-cne$Project-or[string]$packet.logical_session_ref-cnotmatch'^[A-Za-z0-9._@:+~-]{1,200}$'-or[string]$packet.session_id-cnotmatch'^[A-Za-z0-9_-]{1,160}$'){throw 'Protected Compact authority packet shape or binding is invalid.'}
  foreach($name in @('authorization_use_sha256','capability_receipt_sha256','server_binary_sha256','server_instance_identity_sha256','session_sha256','target_directory_sha256')){if([string]$packet.$name-cnotmatch'^[a-f0-9]{64}$'){throw 'Protected Compact authority packet digest is invalid.'}}
  if([string]$packet.mode-cnotin@('P0B_ISOLATED','PRODUCTION_RESPONSE_FIRST')-or[long]$packet.command_timeout_ms-lt120000-or[long]$packet.command_timeout_ms-gt900000){throw 'Protected Compact authority packet mode or timeout is invalid.'}
  foreach($name in @('authorization_state','authorization_use_sha256','capability_receipt_sha256','command_timeout_ms','logical_session_ref','mode','server_binary_sha256','server_instance_identity_sha256','session_sha256','target_directory_sha256','target_id')){if([string]$status.$name-cne[string]$packet.$name){throw 'Protected Compact authority status and handoff differ.'}}
  if($Consume-and[string]$packet.authorization_state-cnotin@('CONSUMED','NOT_APPLICABLE')){throw 'Protected Compact authorization was not consumed before transport.'}
  if(-not$Consume-and[string]$packet.authorization_state-cne'RESOLVED'){throw 'Protected Compact authority did not resolve cleanly.'}
  return $packet
}
function Assert-CompactLiteProtectedAuthorityStable($Expected,$Actual) {
  foreach($name in @('mode','target_id','logical_session_ref','target_root','origin','session_id','session_sha256','target_directory_sha256','server_binary_sha256','server_instance_identity_sha256','capability_receipt_sha256','authorization_use_sha256','command_timeout_ms')){
    if([string]$Expected.$name-cne[string]$Actual.$name){throw 'Protected Compact authority drifted before transport.'}
  }
}

$legacyAuthority=[bool]$DryRun-or[bool]$TestOnlyLegacyAuthority
if($TestOnlyLegacyAuthority-and[string]::IsNullOrWhiteSpace($TargetRoot)){throw 'Test-only legacy Compact authority requires an explicit fixture root.'}
if($TestOnlyLegacyAuthority){Assert-CompactLiteLegacyFixtureAuthority $PSScriptRoot $TargetRoot}
$protectedAuthority=$null
if($legacyAuthority){
  $targetRootFull=Resolve-CompactLiteLocalRoot $TargetRoot 'Target root'
}else{
  $protectedAuthority=Invoke-CompactLiteProtectedAuthority $ProjectId $Target $AttemptId $TestOnlyKnownFolderRoot
  $targetRootFull=Resolve-CompactLiteLocalRoot ([string]$protectedAuthority.target_root) 'Protected target root'
  if(-not[string]::IsNullOrWhiteSpace($TargetRoot)-and-not([IO.Path]::GetFullPath($TargetRoot).TrimEnd([char[]]@('\','/')).Equals($targetRootFull,[StringComparison]::OrdinalIgnoreCase))){throw 'Caller target-root expectation differs from protected authority.'}
}
$canonRootFull=Resolve-CompactLiteLocalRoot $CanonRoot 'Canon root'
Assert-CompactLiteAdmission $canonRootFull $targetRootFull $ProjectId $ProfileId $Target $RoleHint $CanonContractSha256 $ProjectProfileSha256
if(-not(Test-CompactFlowLogicalSessionRef $Target)-or-not(Test-CompactFlowStableId $AttemptId)){throw 'Logical participant or attempt identity is unsafe.'}
if($RoleHint-cnotmatch'^[A-Za-z0-9 .-]{1,80}$'){throw 'Role hint has an invalid shape.'}
$routerRoot=if([IO.Path]::IsPathRooted($RouterDir)){[IO.Path]::GetFullPath($RouterDir)}else{[IO.Path]::GetFullPath((Join-Path $targetRootFull $RouterDir))};$expectedRouter=[IO.Path]::GetFullPath((Join-Path $targetRootFull '.opencode-router'))
if(-not$routerRoot.Equals($expectedRouter,[StringComparison]::OrdinalIgnoreCase)){throw 'RouterDir must be target-local .opencode-router.'}
$sessionsPath='';$sessionsRecord=$null
if($legacyAuthority){$sessionsPath=Resolve-CompactFlowContainedFile -Root $targetRootFull -RelativePath '.opencode-router/sessions.json';$sessionsRecord=Read-CompactFlowStrictJsonFile $sessionsPath 'Router sessions registry';$config=$sessionsRecord.Value;$entry=Get-OCRouterSessionEntry $config $Target;$sessionId=Get-CompactLiteSessionId $entry;$aliases=@($config.sessions.PSObject.Properties|Where-Object{(Get-CompactLiteSessionId $_.Value)-ceq$sessionId});if($aliases.Count-ne1){throw 'Multiple logical participants map to the same runtime session.'}}else{$sessionId=[string]$protectedAuthority.session_id}
$effectiveServer=if($legacyAuthority){$Server}else{[string]$protectedAuthority.origin}
if(-not$legacyAuthority-and-not[string]::IsNullOrWhiteSpace($Server)-and$Server.TrimEnd('/')-cne$effectiveServer.TrimEnd('/')){throw 'Caller server expectation differs from protected authority.'}
$serverUri = $null
if (-not [Uri]::TryCreate($effectiveServer, [UriKind]::Absolute, [ref]$serverUri) -or
    $serverUri.Scheme -notin @('http','https') -or
    $serverUri.Host -cne '127.0.0.1' -or
    $serverUri.Port -lt 1 -or $serverUri.Port -gt 65535 -or
    $serverUri.AbsolutePath -cne '/' -or
    -not [string]::IsNullOrEmpty($serverUri.Query) -or
    -not [string]::IsNullOrEmpty($serverUri.Fragment) -or
    -not [string]::IsNullOrEmpty($serverUri.UserInfo)) {
  throw 'Server must be an explicit independently supplied loopback endpoint.'
}
$effectiveServer=$effectiveServer.TrimEnd('/')
$headers=if([string]::IsNullOrWhiteSpace($env:OPENCODE_SERVER_PASSWORD)){@{}}else{New-OCRouterBasicAuthHeader -Username $(if($env:OPENCODE_SERVER_USERNAME){$env:OPENCODE_SERVER_USERNAME}else{'opencode'}) -Password $env:OPENCODE_SERVER_PASSWORD}
$policy=Resolve-CompactLitePolicy $GlobalPolicyPath $GlobalPolicySha256 $ProjectPolicyPath $ProjectPolicySha256
$telemetryArgs=@{SessionId=$sessionId;Server=$effectiveServer;WarnRatio=[double]$policy.effective_policy.warn_ratio;CriticalRatio=[double]$policy.effective_policy.critical_ratio;PolicyIdentity=[string]$policy.effective_policy_sha256}
$getMessageCollection=${function:Get-OCRouterMessageCollection}
$getLatestRawAssistant=${function:Get-OCRouterLatestRawAssistantMessage}
$newCommandRequest=${function:New-OCRouterCommandRequestBodyObject}
$getLatestCandidates=${function:Get-OCRouterLatestOutputCandidates}
$getCommandResponseIdentity=${function:Get-CompactLiteCommandResponseIdentity}
$getMessageParentId=${function:Get-OCRouterMessageParentId}
$getRestoreReport=${function:Get-CompactLiteRestoreReport}

$runDir=Join-Path $routerRoot 'compact-lite-runs';$participantDir=Join-Path $runDir $Target;$runPath=Join-Path $participantDir ($AttemptId+'.json')
if($DryRun){$closeoutSnapshot=$null;try{$closeoutSnapshot=Assert-CompactLiteCloseoutProof $targetRootFull $ProjectId $EventType $CloseoutReceiptPath $CloseoutReceiptSha256 $CloseoutCandidateId;$telemetryJson=[string](& (Join-Path $PSScriptRoot 'session-context-status.ps1') @telemetryArgs);Assert-CompactFlowStrictJson $telemetryJson 'Session context telemetry';$telemetry=$telemetryJson|ConvertFrom-Json;$lifecycle=Get-CompactLiteLifecycleIntentState $routerRoot $Target;$prior=if(Test-Path -LiteralPath $runPath -PathType Leaf){(Read-CompactFlowStrictJsonFile $runPath 'Compact Lite ledger').Value}else{$null};$priorDisposition=Get-CompactLitePriorDisposition $prior;$compactState=Get-CompactLiteParticipantCompactState $participantDir;$decision=Get-CompactLiteDecision $EventType $policy $telemetry $ProfileId $lifecycle $compactState;$dryDisposition=if([string]$decision.disposition-ceq'AUTO_COMPACT'){'WAIT_SAFE_BOUNDARY'}else{[string]$decision.disposition};$dryReason=if([string]$decision.disposition-ceq'AUTO_COMPACT'){'DRY_RUN_WOULD_AUTO_COMPACT'}else{[string]$decision.reason};$result=New-CompactLiteResult $Target $RoleHint $EventType $policy $telemetry $dryDisposition $dryReason $false NOT_EVALUATED NOT_ATTEMPTED;$result|ConvertTo-Json -Depth 10 -Compress;return}finally{if($null-ne$closeoutSnapshot){$closeoutSnapshot.stream.Dispose()}}}

$lock=$null;$transportLock=$null;$routerGuard=$null;$runGuard=$null;$participantGuard=$null;$closeoutSnapshot=$null
try{
  $closeoutSnapshot=Assert-CompactLiteCloseoutProof $targetRootFull $ProjectId $EventType $CloseoutReceiptPath $CloseoutReceiptSha256 $CloseoutCandidateId
  $routerGuard=Open-CompactFlowDirectoryGuard -Path $routerRoot
  $transportLock=Enter-OCRouterParticipantTransportLock -RunDir $routerRoot -PrivateSessionId $sessionId
  if(-not(Test-Path -LiteralPath $runDir -PathType Container)){[void](New-Item -ItemType Directory -Path $runDir)}
  $runGuard=Open-CompactFlowDirectoryGuard -Path $runDir
  try{$lock=[IO.File]::Open((Join-Path $runDir ($Target+'.lock')),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{$r=New-CompactLiteResult $Target $RoleHint $EventType $policy $telemetry WAIT_SAFE_BOUNDARY PARTICIPANT_COMPACT_LOCKED $false NOT_EVALUATED NOT_ATTEMPTED;$r|ConvertTo-Json -Depth 10 -Compress;return}
  Assert-CompactLiteAdmission $canonRootFull $targetRootFull $ProjectId $ProfileId $Target $RoleHint $CanonContractSha256 $ProjectProfileSha256
  if($legacyAuthority){$currentSessions=Read-CompactFlowStrictJsonFile $sessionsPath 'Router sessions registry';if([string]$currentSessions.Sha256-cne[string]$sessionsRecord.Sha256-or(Get-CompactLiteSessionId (Get-OCRouterSessionEntry $currentSessions.Value $Target))-cne$sessionId){throw 'Router sessions registry drifted before compact.'}}
  $policy=Resolve-CompactLitePolicy $GlobalPolicyPath $GlobalPolicySha256 $ProjectPolicyPath $ProjectPolicySha256
  $telemetryArgs.WarnRatio=[double]$policy.effective_policy.warn_ratio;$telemetryArgs.CriticalRatio=[double]$policy.effective_policy.critical_ratio;$telemetryArgs.PolicyIdentity=[string]$policy.effective_policy_sha256
  $telemetryJson=[string](& (Join-Path $PSScriptRoot 'session-context-status.ps1') @telemetryArgs);Assert-CompactFlowStrictJson $telemetryJson 'Session context telemetry';$telemetry=$telemetryJson|ConvertFrom-Json
  if(-not(Test-Path -LiteralPath $participantDir -PathType Container)){[void](New-Item -ItemType Directory -Path $participantDir)}
  $participantGuard=Open-CompactFlowDirectoryGuard -Path $participantDir
  $lifecycle=Get-CompactLiteLifecycleIntentState $routerRoot $Target;$prior=if(Test-Path -LiteralPath $runPath -PathType Leaf){(Read-CompactFlowStrictJsonFile $runPath 'Compact Lite ledger').Value}else{$null};$priorDisposition=Get-CompactLitePriorDisposition $prior;$compactState=Get-CompactLiteParticipantCompactState $participantDir
  if([string]$priorDisposition.disposition-cne'READY'){$compactPerformed=$null-ne$prior-and$null-ne$prior.result-and[bool]$prior.result.compact_performed;$r=New-CompactLiteResult $Target $RoleHint $EventType $policy $telemetry ([string]$priorDisposition.disposition) ([string]$priorDisposition.reason) $compactPerformed ALREADY_SETTLED NOT_ATTEMPTED;$r|ConvertTo-Json -Depth 10 -Compress;return}
  $persist={
    param($value)
    $priorLedger = if (Test-Path -LiteralPath $runPath -PathType Leaf) {
      (Read-CompactFlowStrictJsonFile $runPath 'Compact Lite ledger').Value
    }
    else { $null }
    Write-CompactFlowAtomicJson -Path $runPath -Value (Merge-CompactLiteLedgerTransition $priorLedger $value)
  }.GetNewClosure()
  $transportTimeoutSeconds=if($legacyAuthority){60}else{[int][Math]::Ceiling(([double]$protectedAuthority.command_timeout_ms)/1000)}
  $getMarkers={$context=Invoke-RestMethod -Method Get -Uri "$effectiveServer/api/session/$([Uri]::EscapeDataString($sessionId))/context" -Headers $headers -TimeoutSec 30 -MaximumRedirection 0;Get-CompactFlowMarkerSet -ActiveContext @(&$getMessageCollection -Response $context)}.GetNewClosure()
  $sendSummarize={
    $body=@{providerID=[string]$telemetry.model.provider_id;modelID=[string]$telemetry.model.model_id}|ConvertTo-Json -Compress
    if(-not$legacyAuthority){$fresh=Invoke-CompactLiteProtectedAuthority $ProjectId $Target $AttemptId $TestOnlyKnownFolderRoot -Consume;Assert-CompactLiteProtectedAuthorityStable $protectedAuthority $fresh}
    try{$response=Invoke-RestMethod -Method Post -Uri "$effectiveServer/session/$([Uri]::EscapeDataString($sessionId))/summarize" -Headers $headers -ContentType application/json -Body $body -TimeoutSec $transportTimeoutSeconds -MaximumRedirection 0;[pscustomobject]@{status='success';marker_identity=(Get-CompactLiteResponseIdentity $response)}}catch{$status=if($_.Exception-is[Net.WebException]-and$_.Exception.Status-eq[Net.WebExceptionStatus]::Timeout){'timeout'}else{'exception'};[pscustomobject]@{status=$status;marker_identity=''}}
  }.GetNewClosure()
  $restore={
    $directory=[Uri]::EscapeDataString($targetRootFull)
    $commands=Invoke-RestMethod -Method Get -Uri "$effectiveServer/command?directory=$directory" -Headers $headers -TimeoutSec 30 -MaximumRedirection 0
    $entries=if($commands-is[array]){@($commands)}else{@(Get-CompactFlowProperty $commands commands @($commands))};if(@($entries|Where-Object{[string]$_.name-ceq'after-compact'}).Count-ne1){throw 'Live after-compact command is missing or ambiguous.'}
    $readUri="$effectiveServer/session/$([Uri]::EscapeDataString($sessionId))/message?limit=40";$messages=Invoke-RestMethod -Method Get -Uri $readUri -Headers $headers -TimeoutSec 30 -MaximumRedirection 0;$baseline=&$getLatestRawAssistant -Messages @(&$getMessageCollection -Response $messages) -AssumeNewestFirst $true;if($null-eq$baseline){throw 'Cannot establish after-compact assistant baseline.'}
    if(-not$legacyAuthority){$fresh=Invoke-CompactLiteProtectedAuthority $ProjectId $Target $AttemptId $TestOnlyKnownFolderRoot;Assert-CompactLiteProtectedAuthorityStable $protectedAuthority $fresh}
    $body=&$newCommandRequest -Command after-compact -Arguments ($ProjectId+' '+$RoleHint);$commandResponse=Invoke-RestMethod -Method Post -Uri "$effectiveServer/session/$([Uri]::EscapeDataString($sessionId))/command" -Headers $headers -ContentType application/json -Body ($body|ConvertTo-Json -Depth 10) -TimeoutSec $transportTimeoutSeconds -MaximumRedirection 0;$commandIdentity=&$getCommandResponseIdentity $commandResponse;if([string]::IsNullOrWhiteSpace($commandIdentity)){throw 'After-compact command response lacks a correlation identity.'};$deadline=[datetime]::UtcNow.AddSeconds($RestoreTimeoutSeconds);$candidate=$null;while([datetime]::UtcNow-lt$deadline-and$null-eq$candidate){Start-Sleep -Milliseconds 200;$latest=Invoke-RestMethod -Method Get -Uri $readUri -Headers $headers -TimeoutSec 30 -MaximumRedirection 0;$rows=@(&$getLatestCandidates -Messages @(&$getMessageCollection -Response $latest) -CandidateCount 5 -AssumeNewestFirst $true -AfterMessageId ([string]$baseline.MessageId)|Where-Object{[string](&$getMessageParentId -Message $_.Message)-ceq$commandIdentity});if($rows.Count-eq1){$candidate=$rows[0]}elseif($rows.Count-gt1){throw 'After-compact restore output is ambiguous for the command correlation identity.'}};if($null-eq$candidate){throw 'After-compact restore output timed out.'};&$getRestoreReport -Text ([string]$candidate.Text) -ExpectedProject $ProjectId -ExpectedRole $RoleHint
  }.GetNewClosure()
  $result=Invoke-CompactLiteMachine -AttemptId $AttemptId -LogicalSessionRef $Target -RoleHint $RoleHint -EventType $EventType -PolicyResolution $policy -Telemetry $telemetry -ProfileId $ProfileId -GetMarkers $getMarkers -SendSummarize $sendSummarize -Restore $restore -Persist $persist -LifecycleIntentState $lifecycle -CompactIntentState $compactState
  $result|ConvertTo-Json -Depth 10 -Compress
}finally{if($null-ne$lock){$lock.Dispose()};if($null-ne$participantGuard){$participantGuard.Dispose()};if($null-ne$runGuard){$runGuard.Dispose()};if($null-ne$transportLock){$transportLock.Dispose()};if($null-ne$routerGuard){$routerGuard.Dispose()};if($null-ne$closeoutSnapshot){$closeoutSnapshot.stream.Dispose()}}
