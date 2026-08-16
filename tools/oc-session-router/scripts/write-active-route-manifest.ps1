[CmdletBinding()]
param(
  [string]$Operation = "",
  [string]$TargetRoot = "",
  [string]$RegistryRoot = "",
  [string]$ProjectId = "",
  [string]$ProfileId = "",
  [string]$ExpectedPriorGenerationId = "",
  [string]$ExpectedStateRevision = "",
  [string]$ExpectedWaveId = "",
  [string]$ExpectedEpicId = "",
  [string]$ExpectedWorkflowPhase = "",
  [string]$ExpectedCandidateIdentity = "",
  [string]$ExpectedConfigurationIdentity = "",
  [string]$ExpectedNextActor = "",
  [string]$ExpectedNextCommand = "",
  [string]$ExpectedRouteInputMode = "",
  [string]$ExpectedRouteInputPath = "",
  [string]$ExpectedRouteInputSha256 = "",
  [string]$ExpectedRouteInputLogicalIdentity = ""
)

$ErrorActionPreference = "Stop"
$ActiveRouteWriterWasDotSourced = $MyInvocation.InvocationName -eq '.'
. (Join-Path $PSScriptRoot "session-compact-flow-core.ps1")

function Throw-ActiveRouteWriterError {
  param(
    [ValidateRange(10, 17)][int]$ExitCode,
    [string]$FailureCode,
    [string]$Message
  )

  $WriterException = New-Object InvalidOperationException($Message)
  $WriterException.Data["active_route_exit_code"] = $ExitCode
  $WriterException.Data["active_route_failure_code"] = $FailureCode
  throw $WriterException
}

function Resolve-ActiveRouteLocalRoot {
  param([string]$Path, [string]$Label)

  if ([string]::IsNullOrWhiteSpace($Path) -or -not [IO.Path]::IsPathRooted($Path)) {
    Throw-ActiveRouteWriterError -ExitCode 10 -FailureCode "INPUT_INVALID" -Message "$Label is invalid."
  }
  $FullPath = [IO.Path]::GetFullPath($Path).TrimEnd([char[]]@('\', '/'))
  $VolumeRoot = [IO.Path]::GetPathRoot($FullPath)
  if ([string]::IsNullOrWhiteSpace($VolumeRoot) -or $VolumeRoot.StartsWith('\\')) {
    Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "$Label is not local."
  }
  try { $Drive = New-Object IO.DriveInfo($VolumeRoot) }
  catch { Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "$Label is not on a readable local volume." }
  if ($Drive.DriveType -ne [IO.DriveType]::Fixed -or -not (Test-Path -LiteralPath $FullPath -PathType Container)) {
    Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "$Label is not an ordinary local directory."
  }
  $CurrentPath = $VolumeRoot
  foreach ($Component in $FullPath.Substring($VolumeRoot.Length).Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)) {
    $CurrentPath = Join-Path $CurrentPath $Component
    $CurrentItem = Get-Item -LiteralPath $CurrentPath -Force
    if (($CurrentItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "$Label contains a reparse point."
    }
  }
  return $FullPath
}

function Open-ActiveRouteSnapshot {
  param([string]$Root, [string]$RelativePath, [string]$Label)

  try {
    $ResolvedPath = Resolve-CompactFlowContainedFile -Root $Root -RelativePath $RelativePath
    $InitialSha256 = Get-CompactFlowFileSha256 -Path $ResolvedPath
    $Snapshot = Open-CompactFlowRouteSnapshot -Root $Root -RelativePath $RelativePath -ExpectedSha256 $InitialSha256
    $Snapshot | Add-Member -NotePropertyName label -NotePropertyValue $Label -Force
    $Snapshot | Add-Member -NotePropertyName relative_path -NotePropertyValue $RelativePath.Replace('\', '/') -Force
    return $Snapshot
  }
  catch {
    Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "$Label cannot be held as one safe ordinary file."
  }
}

function ConvertFrom-ActiveRouteSnapshotJson {
  param($Snapshot, [string]$Label)

  try {
    $StrictUtf8 = New-Object Text.UTF8Encoding($false, $true)
    $JsonText = $StrictUtf8.GetString([byte[]]$Snapshot.bytes)
    Assert-CompactFlowStrictJson -Text $JsonText -Label $Label
    return $JsonText | ConvertFrom-Json
  }
  catch {
    Throw-ActiveRouteWriterError -ExitCode 10 -FailureCode "STRICT_JSON_INVALID" -Message "$Label is not strict JSON."
  }
}

function Get-ActiveRouteDeclaredMetadata {
  param([string]$Text, [string]$Label, [string]$ValueName)

  $LinePattern = '(?im)^[ \t]*(?:[-*][ \t]+)?' + [regex]::Escape($Label) + '[ \t]*:[ \t]*(?:`([^`\r\n]+)`|([^\r\n]+))[ \t]*$'
  $TablePattern = '(?im)^[ \t]*\|[ \t]*' + [regex]::Escape($Label) + '[ \t]*\|[ \t]*(?:`([^`\r\n|]+)`|([^|\r\n]+))[ \t]*\|'
  $Matches = @([regex]::Matches($Text, $LinePattern)) + @([regex]::Matches($Text, $TablePattern))
  if ($Matches.Count -ne 1) {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "TARGET_AUTHORITY_INVALID" -Message "Target authority does not declare exactly one $ValueName."
  }
  $CapturedValue = if ($Matches[0].Groups[1].Success) { $Matches[0].Groups[1].Value } else { $Matches[0].Groups[2].Value }
  $CapturedValue = $CapturedValue.Trim().Trim('`').Trim()
  if ([string]::IsNullOrWhiteSpace($CapturedValue) -or $CapturedValue.Contains('{{') -or $CapturedValue.Contains('}}') -or $CapturedValue -match '^<[^>]+>$' -or $CapturedValue -match '\s/\s') {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "TARGET_AUTHORITY_INVALID" -Message "Target authority has an unusable $ValueName."
  }
  return $CapturedValue
}

function Get-ActiveRouteSelectedSpan {
  param([byte[]]$Bytes, [string]$Selector)

  if ($Selector -cnotmatch '^HEADING:.+$') {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "COMBINED_SELECTOR_INVALID" -Message "Combined selector is invalid."
  }
  $StrictUtf8 = New-Object Text.UTF8Encoding($false, $true)
  try { $Text = $StrictUtf8.GetString($Bytes) }
  catch { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "COMBINED_INVALID" -Message "Combined is not strict UTF-8." }
  $ByteBase = 0
  if ($Text.Length -gt 0 -and [int]$Text[0] -eq 0xFEFF) { $Text = $Text.Substring(1); $ByteBase = 3 }
  $HeadingText = $Selector.Substring('HEADING:'.Length)
  $HeadingMatches = [regex]::Matches($Text, '(?m)^(#{1,6})[ \t]+' + [regex]::Escape($HeadingText) + '[ \t]*\r?$')
  if ($HeadingMatches.Count -ne 1) {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "COMBINED_SELECTOR_INVALID" -Message "Combined selector does not resolve exactly once."
  }
  $SelectedHeading = $HeadingMatches[0]
  $SelectedLevel = $SelectedHeading.Groups[1].Value.Length
  $EndCharacter = $Text.Length
  foreach ($CandidateHeading in [regex]::Matches($Text, '(?m)^(#{1,6})[ \t]+.*\r?$')) {
    if ($CandidateHeading.Index -gt $SelectedHeading.Index -and $CandidateHeading.Groups[1].Value.Length -le $SelectedLevel) {
      $EndCharacter = $CandidateHeading.Index
      break
    }
  }
  $Encoding = New-Object Text.UTF8Encoding($false)
  $StartByte = $ByteBase + $Encoding.GetByteCount($Text.Substring(0, $SelectedHeading.Index))
  $EndByte = $ByteBase + $Encoding.GetByteCount($Text.Substring(0, $EndCharacter))
  $SpanBytes = New-Object byte[] ($EndByte - $StartByte)
  if ($SpanBytes.Length -gt 0) { [Array]::Copy($Bytes, $StartByte, $SpanBytes, 0, $SpanBytes.Length) }
  return [pscustomobject]@{ bytes = $SpanBytes; text = $StrictUtf8.GetString($SpanBytes); sha256 = Get-CompactFlowSha256Bytes -Bytes $SpanBytes }
}

function Assert-ActiveRouteCombinedIdentity {
  param([string]$SpanText, [string]$WaveId, [string]$EpicId)

  $WavePattern = '(?<![A-Za-z0-9._:@+~-])' + [regex]::Escape($WaveId) + '(?![A-Za-z0-9._:@+~-])'
  $MatchingWaveHeadings = @([regex]::Matches($SpanText, '(?m)^#{1,6}[ \t]+.*\r?$') | Where-Object { $_.Value -match $WavePattern })
  if ($MatchingWaveHeadings.Count -ne 1) {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "COMBINED_IDENTITY_MISMATCH" -Message "Selected Combined span does not contain exactly one matching Wave heading."
  }
  $MatchingEpicRows = 0
  foreach ($Line in ($SpanText -split "`r?`n")) {
    if ($Line -notmatch '^\s*\|') { continue }
    $Cells = @($Line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim().Trim('`').Trim() })
    if (@($Cells | Where-Object { $_ -ceq $EpicId }).Count -gt 0) { $MatchingEpicRows++ }
  }
  if ($MatchingEpicRows -ne 1) {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "COMBINED_IDENTITY_MISMATCH" -Message "Selected Combined span does not contain exactly one matching Epic row."
  }
}

function Get-ActiveRouteTerminalIdentity {
  param([string]$StageText, [string]$WorkflowPhase)

  $AcceptedLabels = switch ($WorkflowPhase) {
    "SEQ_NEXT" { @("Plan artifact", "Plan/fix-plan identity") }
    "PLAN_REVIEW" { @("Plan artifact") }
    "PLAN_REVISION" { @("Final plan artifact", "Plan artifact", "Fix-plan artifact") }
    "IMPLEMENT" { @("Plan/fix-plan identity") }
    "FIX_IMPLEMENT" { @("Plan/fix-plan identity") }
    "STEP_REVIEW" { @("Candidate") }
    "REVIEW_RESPONSE" { @("Candidate") }
    "FIX_PLAN_REVIEW" { @("Fix-plan artifact") }
    "FIX_PLAN_REVISION" { @("Fix-plan artifact") }
    default { @("Candidate identity", "Candidate") }
  }
  $TerminalValues = New-Object System.Collections.Generic.List[string]
  foreach ($AcceptedLabel in $AcceptedLabels) {
    $LinePattern = '(?im)^[ \t]*(?:[-*][ \t]+)?' + [regex]::Escape($AcceptedLabel) + '[ \t]*:[ \t]*(?:`([^`\r\n]+)`|([^\r\n]+))[ \t]*$'
    $TablePattern = '(?im)^[ \t]*\|[ \t]*' + [regex]::Escape($AcceptedLabel) + '[ \t]*\|[ \t]*(?:`([^`\r\n|]+)`|([^|\r\n]+))[ \t]*\|'
    foreach ($IdentityMatch in @([regex]::Matches($StageText, $LinePattern)) + @([regex]::Matches($StageText, $TablePattern))) {
      $TerminalValue = if ($IdentityMatch.Groups[1].Success) { $IdentityMatch.Groups[1].Value } else { $IdentityMatch.Groups[2].Value }
      $TerminalValues.Add($TerminalValue.Trim().Trim('`').Trim())
    }
  }
  if ($TerminalValues.Count -ne 1 -or [string]$TerminalValues[0] -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$') {
    Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "STAGE_IDENTITY_INVALID" -Message "Stage does not declare one valid phase-terminal logical identity."
  }
  return [string]$TerminalValues[0]
}

function Get-ActiveRouteGenerationIdentity {
  param($Manifest)

  $Rows = @(
    "contract=$([string]$Manifest.contract)",
    "project_id=$([string]$Manifest.project_id)",
    "profile_id=$([string]$Manifest.profile_id)",
    "workflow_phase=$([string]$Manifest.workflow_phase)",
    "state.path=$(([string]$Manifest.state.path).Replace('\', '/'))",
    "state.sha256=$([string]$Manifest.state.sha256)",
    "state.state_revision=$([string]$Manifest.state.state_revision)",
    "combined.path=$(([string]$Manifest.combined.path).Replace('\', '/'))",
    "combined.selector=$([string]$Manifest.combined.selector)",
    "combined.sha256=$([string]$Manifest.combined.sha256)",
    "combined.wave_id=$([string]$Manifest.combined.wave_id)",
    "combined.epic_id=$([string]$Manifest.combined.epic_id)",
    "stage.path=$(([string]$Manifest.stage.path).Replace('\', '/'))",
    "stage.sha256=$([string]$Manifest.stage.sha256)",
    "stage.logical_identity=$([string]$Manifest.stage.logical_identity)",
    "candidate_identity=$([string]$Manifest.candidate_identity)",
    "configuration_identity=$([string]$Manifest.configuration_identity)",
    "worktree_identity=$(if ($null -ne $Manifest.PSObject.Properties['worktree_identity']) { [string]$Manifest.worktree_identity } else { 'ABSENT' })",
    "next_actor=$([string]$Manifest.next_actor)",
    "next_command=$([string]$Manifest.next_command)",
    "route_input.mode=$([string]$Manifest.route_input.mode)",
    "route_input.path=$(if ($null -ne $Manifest.route_input.PSObject.Properties['path']) { ([string]$Manifest.route_input.path).Replace('\', '/') } else { 'ABSENT' })",
    "route_input.sha256=$(if ($null -ne $Manifest.route_input.PSObject.Properties['sha256']) { [string]$Manifest.route_input.sha256 } else { 'ABSENT' })",
    "route_input.logical_identity=$(if ($null -ne $Manifest.route_input.PSObject.Properties['logical_identity']) { [string]$Manifest.route_input.logical_identity } else { 'ABSENT' })"
  )
  return Get-CompactFlowSha256Text -Text ($Rows -join "`n")
}

function Assert-ActiveRouteManifest {
  param($Manifest)

  Assert-CompactFlowExactProperties -Value $Manifest -Allowed @('schema_version','contract','generation_id','created_utc','project_id','profile_id','workflow_phase','state','combined','stage','candidate_identity','configuration_identity','worktree_identity','next_actor','next_command','route_input') -Required @('schema_version','contract','generation_id','created_utc','project_id','profile_id','workflow_phase','state','combined','stage','candidate_identity','configuration_identity','next_actor','next_command','route_input') -Label 'active route manifest'
  if ($Manifest.schema_version -isnot [string] -or [string]$Manifest.schema_version -cne '1' -or $Manifest.contract -isnot [string] -or [string]$Manifest.contract -cne 'agent-workflow-active-route/v1') { throw 'Manifest contract is invalid.' }
  if ([string]$Manifest.generation_id -cnotmatch '^[a-f0-9]{64}$' -or [string]$Manifest.project_id -cnotmatch '^[a-z0-9][a-z0-9.-]*$' -or [string]$Manifest.profile_id -cnotmatch '^[a-z0-9][a-z0-9.-]*$') { throw 'Manifest identity is invalid.' }
  if ([string]$Manifest.workflow_phase -cnotin @('NOT_STARTED','SEQ_NEXT','PLAN_REVIEW','PLAN_REVISION','IMPLEMENT','STEP_REVIEW','REVIEW_RESPONSE','FIX_PLAN_REVIEW','FIX_PLAN_REVISION','FIX_IMPLEMENT','CLOSEOUT','COMPLETE')) { throw 'Manifest phase is invalid.' }
  if ([string]$Manifest.created_utc -cnotmatch '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,7})?Z$') { throw 'Manifest timestamp is invalid.' }
  Assert-CompactFlowExactProperties -Value $Manifest.state -Allowed @('path','sha256','state_revision') -Required @('path','sha256','state_revision') -Label 'active route state'
  Assert-CompactFlowExactProperties -Value $Manifest.combined -Allowed @('path','selector','sha256','wave_id','epic_id') -Required @('path','selector','sha256','wave_id','epic_id') -Label 'active route combined'
  Assert-CompactFlowExactProperties -Value $Manifest.stage -Allowed @('path','sha256','logical_identity') -Required @('path','sha256','logical_identity') -Label 'active route stage'
  foreach ($PathValue in @($Manifest.state.path, $Manifest.combined.path, $Manifest.stage.path)) {
    if ([string]::IsNullOrWhiteSpace([string]$PathValue) -or [IO.Path]::IsPathRooted([string]$PathValue) -or [string]$PathValue -match '(^|[\/])\.\.([\/]|$)|:') { throw 'Manifest path is invalid.' }
  }
  foreach ($HashValue in @($Manifest.state.sha256, $Manifest.combined.sha256, $Manifest.stage.sha256)) { if ([string]$HashValue -cnotmatch '^[a-f0-9]{64}$') { throw 'Manifest hash is invalid.' } }
  foreach ($IdentityValue in @($Manifest.state.state_revision,$Manifest.combined.wave_id,$Manifest.combined.epic_id,$Manifest.stage.logical_identity,$Manifest.candidate_identity,$Manifest.configuration_identity)) { if ([string]$IdentityValue -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$') { throw 'Manifest logical identity is invalid.' } }
  if ($null -ne $Manifest.PSObject.Properties['worktree_identity'] -and [string]$Manifest.worktree_identity -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$') { throw 'Manifest worktree identity is invalid.' }
  if ([string]$Manifest.combined.selector -cnotmatch '^HEADING:.+$' -or [string]$Manifest.next_actor -cnotmatch '^[A-Za-z0-9][A-Za-z0-9 ._:/@+-]{0,255}$' -or ([string]$Manifest.next_command -cne 'NONE' -and [string]$Manifest.next_command -cnotmatch '^/[a-z0-9][a-z0-9-]{0,126}$')) { throw 'Manifest route identity is invalid.' }
  $RouteAllowed = if ([string]$Manifest.route_input.mode -ceq 'PINNED_ARTIFACT') { @('mode','path','sha256','logical_identity') } else { @('mode') }
  Assert-CompactFlowExactProperties -Value $Manifest.route_input -Allowed $RouteAllowed -Required $RouteAllowed -Label 'active route route_input'
  if ([string]$Manifest.route_input.mode -cnotin @('PINNED_ARTIFACT','EXACT_EMPTY','NOT_APPLICABLE')) { throw 'Manifest route mode is invalid.' }
  if ([string]$Manifest.next_command -ceq 'NONE' -and [string]$Manifest.route_input.mode -cne 'NOT_APPLICABLE') { throw 'NONE requires NOT_APPLICABLE.' }
  if ([string]$Manifest.next_command -cne 'NONE' -and [string]$Manifest.route_input.mode -ceq 'NOT_APPLICABLE') { throw 'Workflow command lacks route input.' }
  foreach ($PersistedIdentity in @($Manifest.state.state_revision,$Manifest.combined.wave_id,$Manifest.combined.epic_id,$Manifest.stage.logical_identity,$Manifest.candidate_identity,$Manifest.configuration_identity,$Manifest.next_actor,$Manifest.route_input.logical_identity)) {
    if ([string]$PersistedIdentity -match '(?i)(?:^|[^A-Za-z0-9])ses_[A-Za-z0-9_-]+' -or [string]$PersistedIdentity -match '(?i)(?:^|[^A-Za-z0-9])(?:[A-Za-z]:[\\/]|[\\/]{2}|\\\\[.?]\\)') { throw 'Manifest identity contains private runtime or machine-root content.' }
  }
  foreach ($PersistedIdentity in @($Manifest.state.state_revision,$Manifest.combined.wave_id,$Manifest.combined.epic_id,$Manifest.stage.logical_identity,$Manifest.candidate_identity,$Manifest.configuration_identity,$Manifest.next_actor,$Manifest.route_input.logical_identity)) {
    if ([string]$PersistedIdentity -match '(?i)(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})') { throw 'Manifest identity contains credential-shaped content.' }
  }
  $ManifestJson = $Manifest | ConvertTo-Json -Depth 15 -Compress
  if ($ManifestJson -match '(?i)(?:https?|wss?)://' -or $ManifestJson -match '(?i)(?:session[_ -]?id|session[_ -]?token|private[_ -]?endpoint|raw[_ -]?transcript|raw[_ -]?private[_ -]?evidence|api[_ -]?key|password|passwd|bearer|access[_ -]?token|runtime[_ -]?port)' -or $ManifestJson -match '(?i)(?:localhost|127(?:\.[0-9]{1,3}){3}|10(?:\.[0-9]{1,3}){3}|192\.168(?:\.[0-9]{1,3}){2}|172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2})') { throw 'Manifest privacy content is invalid.' }
  if ([string]$Manifest.generation_id -cne (Get-ActiveRouteGenerationIdentity -Manifest $Manifest)) { throw 'Manifest generation is invalid.' }
}

function Get-ActiveRouteRootIdentity {
  param([string]$TargetRoot, $Project, [System.Collections.Generic.List[object]]$Snapshots)

  $Rows = New-Object System.Collections.Generic.List[string]
  foreach ($Marker in @($Project.root_locator.markers)) {
    $MarkerSnapshot = Open-ActiveRouteSnapshot -Root $TargetRoot -RelativePath ([string]$Marker.path) -Label 'root marker'
    $Snapshots.Add($MarkerSnapshot)
    $MarkerText = (New-Object Text.UTF8Encoding($false, $true)).GetString([byte[]]$MarkerSnapshot.bytes)
    if (-not $MarkerText.Contains([string]$Marker.contains)) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "ROOT_MISMATCH" -Message "Target root marker does not match the profile." }
    $Rows.Add("$(([string]$Marker.path).Replace('\','/'))|$([string]$MarkerSnapshot.sha256)")
  }
  if ($Rows.Count -eq 0) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "ROOT_MISMATCH" -Message "Profile has no root marker." }
  $PathIdentity = Get-CompactFlowSha256Text -Text ([IO.Path]::GetFullPath($TargetRoot).ToLowerInvariant())
  return Get-CompactFlowSha256Text -Text ("path=$PathIdentity`n" + ($Rows.ToArray() -join "`n"))
}

function Get-ActiveRouteGitIdentity {
  param([string]$TargetRoot, [System.Collections.Generic.List[object]]$Snapshots)

  if (-not (Test-Path -LiteralPath (Join-Path $TargetRoot '.git') -PathType Container)) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "WORKTREE_IDENTITY_UNAVAILABLE" -Message "Git worktree identity is unavailable." }
  $HeadSnapshot = Open-ActiveRouteSnapshot -Root $TargetRoot -RelativePath '.git/HEAD' -Label 'Git HEAD'
  $Snapshots.Add($HeadSnapshot)
  $HeadValue = (New-Object Text.UTF8Encoding($false, $true)).GetString([byte[]]$HeadSnapshot.bytes).Trim()
  if ($HeadValue -match '^ref:\s*(.+)$') {
    $ReferencePath = $Matches[1].Trim()
    try {
      $ReferenceSnapshot = Open-ActiveRouteSnapshot -Root $TargetRoot -RelativePath ('.git/' + $ReferencePath.Replace('\','/')) -Label 'Git reference'
      $Snapshots.Add($ReferenceSnapshot)
      $HeadValue = (New-Object Text.UTF8Encoding($false, $true)).GetString([byte[]]$ReferenceSnapshot.bytes).Trim()
    }
    catch {
      $PackedSnapshot = Open-ActiveRouteSnapshot -Root $TargetRoot -RelativePath '.git/packed-refs' -Label 'Git packed references'
      $Snapshots.Add($PackedSnapshot)
      $PackedText = (New-Object Text.UTF8Encoding($false, $true)).GetString([byte[]]$PackedSnapshot.bytes)
      $ReferenceMatch = [regex]::Match($PackedText, '(?m)^([a-fA-F0-9]{40,64})\s+' + [regex]::Escape($ReferencePath) + '$')
      if ($ReferenceMatch.Success) { $HeadValue = $ReferenceMatch.Groups[1].Value }
    }
  }
  if ($HeadValue -notmatch '^[a-fA-F0-9]{40,64}$') { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "WORKTREE_IDENTITY_UNAVAILABLE" -Message "Git worktree identity is invalid." }
  return 'git:' + $HeadValue.ToLowerInvariant()
}

function Assert-ActiveRouteSnapshotsStable {
  param([System.Collections.Generic.List[object]]$Snapshots)

  foreach ($Snapshot in $Snapshots) {
    try {
      $Snapshot.stream.Position = 0
      $CurrentBytes = New-Object byte[] $Snapshot.stream.Length
      $Offset = 0
      while ($Offset -lt $CurrentBytes.Length) {
        $ReadCount = $Snapshot.stream.Read($CurrentBytes, $Offset, $CurrentBytes.Length - $Offset)
        if ($ReadCount -le 0) { throw 'Held source ended unexpectedly.' }
        $Offset += $ReadCount
      }
      if ((Get-CompactFlowSha256Bytes -Bytes $CurrentBytes) -cne [string]$Snapshot.sha256) { throw 'Held source changed.' }
    }
    catch { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "SOURCE_IDENTITY_CHANGED" -Message "A held target source changed before publication." }
  }
}

function New-ActiveRouteReceipt {
  param([string]$OperationName, [string]$Outcome, $Manifest, [string]$ManifestPath)

  return [pscustomobject][ordered]@{
    contract = 'agent-workflow-active-route-writer/v1'
    operation = $OperationName
    outcome = $Outcome
    generation_id = [string]$Manifest.generation_id
    manifest_path = $ManifestPath.Replace('\', '/')
    source_identities = [pscustomobject][ordered]@{
      state_sha256 = [string]$Manifest.state.sha256
      combined_sha256 = [string]$Manifest.combined.sha256
      stage_sha256 = [string]$Manifest.stage.sha256
      state_revision = [string]$Manifest.state.state_revision
      wave_id = [string]$Manifest.combined.wave_id
      epic_id = [string]$Manifest.combined.epic_id
      stage_logical_identity = [string]$Manifest.stage.logical_identity
    }
    failure_code = $null
    message = 'Active-route operation completed.'
  }
}

function Invoke-ActiveRouteManifestWriterCore {
  param(
    [ValidateSet("VERIFY", "WRITE")][string]$OperationName,
    [string]$TargetRootPath,
    [string]$RegistryRootPath,
    [string]$ExpectedProjectId,
    [string]$ExpectedProfileId,
    [string]$PriorGenerationExpectation = "",
    [hashtable]$CallerExpectations = @{},
    [scriptblock]$BeforePublish = $null,
    [scriptblock]$AfterPublish = $null
  )

  if ($ExpectedProjectId -cnotmatch '^[a-z0-9][a-z0-9.-]*$' -or $ExpectedProfileId -cnotmatch '^[a-z0-9][a-z0-9.-]*$' -or
      (-not [string]::IsNullOrWhiteSpace($PriorGenerationExpectation) -and $PriorGenerationExpectation -cne 'ABSENT' -and $PriorGenerationExpectation -cnotmatch '^[a-f0-9]{64}$')) {
    Throw-ActiveRouteWriterError -ExitCode 10 -FailureCode "INPUT_INVALID" -Message "Writer input identity is invalid."
  }
  $ResolvedTargetRoot = Resolve-ActiveRouteLocalRoot -Path $TargetRootPath -Label 'Target root'
  $ResolvedRegistryRoot = Resolve-ActiveRouteLocalRoot -Path $RegistryRootPath -Label 'Registry root'
  if ([IO.Path]::GetFileName($ResolvedRegistryRoot) -cne 'registry') { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Registry root must be the Canon registry directory." }
  $ResolvedCanonRoot = Resolve-ActiveRouteLocalRoot -Path (Split-Path -Parent $ResolvedRegistryRoot) -Label 'Canon root'
  $Snapshots = New-Object 'System.Collections.Generic.List[object]'
  $WriterLock = $null
  $WriterLockPath = ''
  $ManifestParentGuard = $null
  try {
    $ActiveRouteSchemaSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedRegistryRoot -RelativePath 'ACTIVE-ROUTE.schema.json' -Label 'active-route schema'
    $Snapshots.Add($ActiveRouteSchemaSnapshot)
    $ActiveRouteSchema = ConvertFrom-ActiveRouteSnapshotJson -Snapshot $ActiveRouteSchemaSnapshot -Label 'active-route schema'
    if ([string]$ActiveRouteSchema.properties.schema_version.const -cne '1' -or [string]$ActiveRouteSchema.properties.contract.const -cne 'agent-workflow-active-route/v1' -or [bool]$ActiveRouteSchema.additionalProperties) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Active-route schema contract is invalid." }
    $CanonContractSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedCanonRoot -RelativePath 'canon/CANONICAL-CONTRACT.json' -Label 'Canon lifecycle contract'
    $Snapshots.Add($CanonContractSnapshot)
    $CanonContract = ConvertFrom-ActiveRouteSnapshotJson -Snapshot $CanonContractSnapshot -Label 'Canon lifecycle contract'
    $EmptyRouteCommands = @($CanonContract.hydration_contract.seamless_compaction_contract.empty_route_input_commands | ForEach-Object { [string]$_ })
    if (@($EmptyRouteCommands | Where-Object { $_ -cnotmatch '^/[a-z0-9][a-z0-9-]{0,126}$' }).Count -gt 0 -or @($EmptyRouteCommands | Select-Object -Unique).Count -ne $EmptyRouteCommands.Count) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Canon empty-route command mapping is invalid." }
    $ProjectsDirectory = Join-Path $ResolvedRegistryRoot 'projects'
    if (-not (Test-Path -LiteralPath $ProjectsDirectory -PathType Container) -or ((Get-Item -LiteralPath $ProjectsDirectory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Registry projects directory is invalid."
    }
    $ProjectMatches = New-Object System.Collections.Generic.List[object]
    foreach ($ProfileFile in @(Get-ChildItem -LiteralPath $ProjectsDirectory -Filter '*.json' -File -Force)) {
      if (($ProfileFile.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "Registry profile is unsafe." }
      $ProfileRelativePath = 'projects/' + $ProfileFile.Name
      $CandidateSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedRegistryRoot -RelativePath $ProfileRelativePath -Label 'project profile'
      $CandidateProject = ConvertFrom-ActiveRouteSnapshotJson -Snapshot $CandidateSnapshot -Label 'project profile'
      if ([string]$CandidateProject.project_id -ceq $ExpectedProjectId) {
        $Snapshots.Add($CandidateSnapshot)
        $ProjectMatches.Add([pscustomobject]@{ project = $CandidateProject; snapshot = $CandidateSnapshot })
      }
      else { $CandidateSnapshot.stream.Dispose() }
    }
    if ($ProjectMatches.Count -ne 1) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Project profile is missing or ambiguous." }
    $Project = $ProjectMatches[0].project
    if ([string]$Project.schema_version -cne '2' -or $null -eq $Project.PSObject.Properties['authority_locators'] -or $null -eq $Project.PSObject.Properties['active_route_locator']) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "STATIC_LOCATOR_INVALID" -Message "Project profile lacks active-route static locators." }
    Assert-CompactFlowExactProperties -Value $Project.authority_locators -Allowed @('state','combined') -Required @('state','combined') -Label 'authority_locators'
    Assert-CompactFlowExactProperties -Value $Project.authority_locators.state -Allowed @('path') -Required @('path') -Label 'state locator'
    Assert-CompactFlowExactProperties -Value $Project.authority_locators.combined -Allowed @('path') -Required @('path') -Label 'Combined locator'
    Assert-CompactFlowExactProperties -Value $Project.active_route_locator -Allowed @('path','contract','authority_class','sensitivity') -Required @('path','contract','authority_class','sensitivity') -Label 'active-route locator'
    if ([string]$Project.active_route_locator.contract -cne 'agent-workflow-active-route/v1' -or [string]$Project.active_route_locator.authority_class -cne 'ACTIVE_ROUTE_PROJECTION' -or [string]$Project.active_route_locator.sensitivity -cne 'PRIVATE_GOVERNANCE') { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "STATIC_LOCATOR_INVALID" -Message "Active-route locator contract or privacy is invalid." }
    if (@($Project.phase_reads.PSObject.Properties).Count -ne 0 -or -not [bool]$Project.security.redaction_required) { Throw-ActiveRouteWriterError -ExitCode 16 -FailureCode "PRIVACY_POLICY_INVALID" -Message "Project profile does not enforce redacted active-route operation." }
    foreach ($RequiredPrivacyClass in @('CREDENTIAL','SESSION_ID','PORT','PRIVATE_ENDPOINT','RAW_TRANSCRIPT','RAW_PRIVATE_EVIDENCE')) { if (@($Project.security.forbidden_content_classes) -cnotcontains $RequiredPrivacyClass) { Throw-ActiveRouteWriterError -ExitCode 16 -FailureCode "PRIVACY_POLICY_INVALID" -Message "Project profile privacy classes are incomplete." } }
    foreach ($ReadEntry in @($Project.universal_reads) + @($Project.profiles | ForEach-Object { @($_.reads) })) { if ([string]$ReadEntry.authority_class -in @('PROJECT_STATE','COMBINED','EPIC_PLAN','PINNED_ARTIFACT','STAGE_ARTIFACT','ACTIVE_ROUTE_PROJECTION')) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "STATIC_LOCATOR_INVALID" -Message "Active-route authority is duplicated outside static locators." } }

    $SelectedProfiles = @($Project.profiles | Where-Object { [string]$_.profile_id -ceq $ExpectedProfileId })
    if ($SelectedProfiles.Count -ne 1) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Selected role profile is missing or ambiguous." }
    $SelectedProfile = $SelectedProfiles[0]
    $RootIdentity = Get-ActiveRouteRootIdentity -TargetRoot $ResolvedTargetRoot -Project $Project -Snapshots $Snapshots

    $StatePath = ([string]$Project.authority_locators.state.path).Replace('\','/')
    $CombinedPath = ([string]$Project.authority_locators.combined.path).Replace('\','/')
    $ManifestPath = ([string]$Project.active_route_locator.path).Replace('\','/')
    foreach ($StaticPath in @($StatePath, $CombinedPath, $ManifestPath)) {
      if ([string]::IsNullOrWhiteSpace($StaticPath) -or [IO.Path]::IsPathRooted($StaticPath) -or $StaticPath.Contains(':') -or $StaticPath -match '(^|/)\.\.(/|$)') { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "STATIC_LOCATOR_INVALID" -Message "Static authority locator path is invalid." }
    }
    if ($StatePath -ceq $CombinedPath -or $StatePath -ceq $ManifestPath -or $CombinedPath -ceq $ManifestPath -or -not $ManifestPath.StartsWith('.fal/', [StringComparison]::Ordinal)) { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "STATIC_LOCATOR_INVALID" -Message "Static authority paths are not distinct private paths." }

    $StateSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedTargetRoot -RelativePath $StatePath -Label 'target state'
    $CombinedSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedTargetRoot -RelativePath $CombinedPath -Label 'target Combined'
    $Snapshots.Add($StateSnapshot); $Snapshots.Add($CombinedSnapshot)
    $StrictUtf8 = New-Object Text.UTF8Encoding($false, $true)
    try { $StateText = $StrictUtf8.GetString([byte[]]$StateSnapshot.bytes) }
    catch { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "TARGET_AUTHORITY_INVALID" -Message "Target state is not strict UTF-8." }
    $StateRevision = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'State revision' -ValueName 'state revision'
    $WaveId = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Wave' -ValueName 'Wave'
    $EpicId = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Epic' -ValueName 'Epic'
    $WorkflowPhase = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Workflow phase' -ValueName 'workflow phase'
    $CandidateIdentity = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Candidate identity' -ValueName 'candidate identity'
    $ConfigurationIdentity = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Configuration identity' -ValueName 'configuration identity'
    $CombinedSelector = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Combined selector' -ValueName 'Combined selector'
    $StagePath = (Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Pinned artifact' -ValueName 'pinned artifact').Replace('\','/')
    $DeclaredStageSha256 = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Pinned artifact SHA-256' -ValueName 'pinned artifact SHA-256'
    $DeclaredStageLogicalIdentity = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Pinned artifact logical identity' -ValueName 'pinned artifact logical identity'
    $NextActor = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Next actor' -ValueName 'next actor'
    $NextCommand = Get-ActiveRouteDeclaredMetadata -Text $StateText -Label 'Next command' -ValueName 'next command'
    if ($WorkflowPhase -cnotin @('NOT_STARTED','SEQ_NEXT','PLAN_REVIEW','PLAN_REVISION','IMPLEMENT','STEP_REVIEW','REVIEW_RESPONSE','FIX_PLAN_REVIEW','FIX_PLAN_REVISION','FIX_IMPLEMENT','CLOSEOUT','COMPLETE') -or @($SelectedProfile.allowed_phases) -cnotcontains $WorkflowPhase) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "PHASE_PROFILE_MISMATCH" -Message "Target workflow phase is invalid for the selected profile." }
    foreach ($IdentityValue in @($StateRevision,$WaveId,$EpicId,$CandidateIdentity,$ConfigurationIdentity,$DeclaredStageLogicalIdentity)) { if ($IdentityValue -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$') { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "TARGET_AUTHORITY_INVALID" -Message "Target state identity is invalid." } }
    if ($DeclaredStageSha256 -cnotmatch '^[a-f0-9]{64}$' -or ($NextCommand -cne 'NONE' -and $NextCommand -cnotmatch '^/[a-z0-9][a-z0-9-]{0,126}$')) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "TARGET_AUTHORITY_INVALID" -Message "Target route declaration is invalid." }
    if ([string]$SelectedProfile.next_actor -notmatch '^Resolve from ' -and [string]$SelectedProfile.next_actor -cne $NextActor) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "ROUTE_MISMATCH" -Message "Profile and target next actor disagree." }
    if ([string]$SelectedProfile.next_command -notmatch '^Resolve from ' -and [string]$SelectedProfile.next_command -cne $NextCommand) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "ROUTE_MISMATCH" -Message "Profile and target next command disagree." }

    $CombinedSpan = Get-ActiveRouteSelectedSpan -Bytes ([byte[]]$CombinedSnapshot.bytes) -Selector $CombinedSelector
    Assert-ActiveRouteCombinedIdentity -SpanText ([string]$CombinedSpan.text) -WaveId $WaveId -EpicId $EpicId
    $StageSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedTargetRoot -RelativePath $StagePath -Label 'pinned stage artifact'
    $Snapshots.Add($StageSnapshot)
    if ([string]$StageSnapshot.sha256 -cne $DeclaredStageSha256) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "STAGE_HASH_MISMATCH" -Message "Pinned stage artifact hash differs from target state." }
    try { $StageText = $StrictUtf8.GetString([byte[]]$StageSnapshot.bytes) }
    catch { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "STAGE_IDENTITY_INVALID" -Message "Pinned stage artifact is not strict UTF-8." }
    if ((Get-ActiveRouteTerminalIdentity -StageText $StageText -WorkflowPhase $WorkflowPhase) -cne $DeclaredStageLogicalIdentity) { Throw-ActiveRouteWriterError -ExitCode 12 -FailureCode "STAGE_IDENTITY_MISMATCH" -Message "Pinned stage logical identity differs from the stage terminal identity." }

    $WorktreeIdentity = switch ([string]$Project.worktree_identity_mode) {
      'FILESYSTEM' { $RootIdentity }
      'GIT' { Get-ActiveRouteGitIdentity -TargetRoot $ResolvedTargetRoot -Snapshots $Snapshots }
      'UNDECLARED' { $null }
      default { Throw-ActiveRouteWriterError -ExitCode 11 -FailureCode "PROFILE_INVALID" -Message "Profile worktree mode is invalid." }
    }
    $RouteInput = if ($NextCommand -ceq 'NONE') {
      [pscustomobject][ordered]@{ mode='NOT_APPLICABLE' }
    }
    elseif ($EmptyRouteCommands -ccontains $NextCommand) {
      [pscustomobject][ordered]@{ mode='EXACT_EMPTY' }
    }
    else {
      [pscustomobject][ordered]@{ mode='PINNED_ARTIFACT'; path=$StagePath; sha256=$DeclaredStageSha256; logical_identity=$DeclaredStageLogicalIdentity }
    }
    $ManifestFields = [ordered]@{
      schema_version='1'; contract='agent-workflow-active-route/v1'; generation_id=('0'*64); created_utc=[datetime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')
      project_id=$ExpectedProjectId; profile_id=$ExpectedProfileId; workflow_phase=$WorkflowPhase
      state=[pscustomobject][ordered]@{ path=$StatePath; sha256=[string]$StateSnapshot.sha256; state_revision=$StateRevision }
      combined=[pscustomobject][ordered]@{ path=$CombinedPath; selector=$CombinedSelector; sha256=[string]$CombinedSpan.sha256; wave_id=$WaveId; epic_id=$EpicId }
      stage=[pscustomobject][ordered]@{ path=$StagePath; sha256=$DeclaredStageSha256; logical_identity=$DeclaredStageLogicalIdentity }
      candidate_identity=$CandidateIdentity; configuration_identity=$ConfigurationIdentity
      next_actor=$NextActor; next_command=$NextCommand; route_input=$RouteInput
    }
    if ($null -ne $WorktreeIdentity) { $ManifestFields.worktree_identity = $WorktreeIdentity }
    $Manifest = [pscustomobject]$ManifestFields
    $Manifest.generation_id = Get-ActiveRouteGenerationIdentity -Manifest $Manifest
    Assert-ActiveRouteManifest -Manifest $Manifest
    $ExpectationProjection = [ordered]@{
      state_revision = [string]$Manifest.state.state_revision
      wave_id = [string]$Manifest.combined.wave_id
      epic_id = [string]$Manifest.combined.epic_id
      workflow_phase = [string]$Manifest.workflow_phase
      candidate_identity = [string]$Manifest.candidate_identity
      configuration_identity = [string]$Manifest.configuration_identity
      next_actor = [string]$Manifest.next_actor
      next_command = [string]$Manifest.next_command
      route_input_mode = [string]$Manifest.route_input.mode
      route_input_path = if ($null -ne $Manifest.route_input.PSObject.Properties['path']) { [string]$Manifest.route_input.path } else { 'ABSENT' }
      route_input_sha256 = if ($null -ne $Manifest.route_input.PSObject.Properties['sha256']) { [string]$Manifest.route_input.sha256 } else { 'ABSENT' }
      route_input_logical_identity = if ($null -ne $Manifest.route_input.PSObject.Properties['logical_identity']) { [string]$Manifest.route_input.logical_identity } else { 'ABSENT' }
    }
    foreach ($ExpectationName in $CallerExpectations.Keys) {
      $ExpectedValue = [string]$CallerExpectations[$ExpectationName]
      if (-not [string]::IsNullOrWhiteSpace($ExpectedValue) -and (-not $ExpectationProjection.Contains($ExpectationName) -or [string]$ExpectationProjection[$ExpectationName] -cne $ExpectedValue)) { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "CALLER_EXPECTATION_MISMATCH" -Message "Caller expectation '$ExpectationName' differs from verified target authority." }
    }

    $ManifestFullPath = [IO.Path]::GetFullPath((Join-Path $ResolvedTargetRoot $ManifestPath.Replace('/', [IO.Path]::DirectorySeparatorChar)))
    $ManifestParent = Split-Path -Parent $ManifestFullPath
    if (-not (Test-Path -LiteralPath $ManifestParent -PathType Container) -or ((Get-Item -LiteralPath $ManifestParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "Manifest parent directory is invalid." }
    try { $ManifestParentGuard = Open-CompactFlowDirectoryGuard -Path $ManifestParent }
    catch { Throw-ActiveRouteWriterError -ExitCode 13 -FailureCode "PATH_UNSAFE" -Message "Manifest parent directory cannot be locked against replacement." }
    $WriterLockPath = Join-Path $ManifestParent ('.' + [IO.Path]::GetFileName($ManifestFullPath) + '.writer.lock')
    try { $WriterLock = [IO.File]::Open($WriterLockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "CONCURRENT_WRITER" -Message "Another active-route writer owns this manifest." }

    $ExistingManifest = $null; $ExistingManifestSha256 = ''; $ExistingGeneration = 'ABSENT'
    if (Test-Path -LiteralPath $ManifestFullPath -PathType Leaf) {
      $ExistingSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedTargetRoot -RelativePath $ManifestPath -Label 'existing active route manifest'
      try {
        $ExistingManifestSha256 = [string]$ExistingSnapshot.sha256
        $ExistingManifest = ConvertFrom-ActiveRouteSnapshotJson -Snapshot $ExistingSnapshot -Label 'existing active route manifest'
        Assert-ActiveRouteManifest -Manifest $ExistingManifest
        $ExistingGeneration = [string]$ExistingManifest.generation_id
      }
      catch { Throw-ActiveRouteWriterError -ExitCode 15 -FailureCode "EXISTING_MANIFEST_INVALID" -Message "Existing active-route manifest is invalid and was preserved." }
      finally { $ExistingSnapshot.stream.Dispose() }
    }
    if (-not [string]::IsNullOrWhiteSpace($PriorGenerationExpectation) -and $PriorGenerationExpectation -cne $ExistingGeneration) { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "PRIOR_GENERATION_MISMATCH" -Message "Prior active-route generation does not match the optimistic expectation." }
    if ($OperationName -ceq 'VERIFY') {
      if ($null -eq $ExistingManifest -or $ExistingGeneration -cne [string]$Manifest.generation_id) { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "SOURCE_IDENTITY_CHANGED" -Message "Existing active-route manifest differs from current target authority." }
      Assert-ActiveRouteSnapshotsStable -Snapshots $Snapshots
      return New-ActiveRouteReceipt -OperationName $OperationName -Outcome 'VERIFIED' -Manifest $ExistingManifest -ManifestPath $ManifestPath
    }
    if ($ExistingGeneration -ceq [string]$Manifest.generation_id) {
      Assert-ActiveRouteSnapshotsStable -Snapshots $Snapshots
      return New-ActiveRouteReceipt -OperationName $OperationName -Outcome 'IDEMPOTENT' -Manifest $ExistingManifest -ManifestPath $ManifestPath
    }

    $TempPath = Join-Path $ManifestParent ('.' + [IO.Path]::GetFileName($ManifestFullPath) + '.' + [guid]::NewGuid().ToString('N') + '.tmp')
    $BackupPath = Join-Path $ManifestParent ('.' + [IO.Path]::GetFileName($ManifestFullPath) + '.' + [guid]::NewGuid().ToString('N') + '.bak')
    $RetainBackup = $false
    $PublishedManifestSha256 = ''
    try {
      $ManifestJson = $Manifest | ConvertTo-Json -Depth 20
      $ManifestBytes = (New-Object Text.UTF8Encoding($false)).GetBytes($ManifestJson)
      $PublishedManifestSha256 = Get-CompactFlowSha256Bytes -Bytes $ManifestBytes
      $TempStream = New-Object IO.FileStream($TempPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None, 4096, [IO.FileOptions]::WriteThrough)
      try { $TempStream.Write($ManifestBytes, 0, $ManifestBytes.Length); $TempStream.Flush($true) }
      finally { $TempStream.Dispose() }
      $TempText = [IO.File]::ReadAllText($TempPath, (New-Object Text.UTF8Encoding($false, $true)))
      Assert-CompactFlowStrictJson -Text $TempText -Label 'temporary active route manifest'
      $TempManifest = $TempText | ConvertFrom-Json
      Assert-ActiveRouteManifest -Manifest $TempManifest
      if ([string]$TempManifest.generation_id -cne [string]$Manifest.generation_id) { throw 'Temporary manifest identity changed.' }
      if ($null -ne $BeforePublish) { & $BeforePublish ([pscustomobject]@{ snapshots=$Snapshots; manifest_path=$ManifestFullPath; temporary_path=$TempPath }) }
      Assert-ActiveRouteSnapshotsStable -Snapshots $Snapshots
      if ($ExistingGeneration -ceq 'ABSENT') {
        if (Test-Path -LiteralPath $ManifestFullPath) { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "PRIOR_GENERATION_MISMATCH" -Message "Manifest appeared during publication." }
        [IO.File]::Move($TempPath, $ManifestFullPath)
      }
      else {
        if (-not (Test-Path -LiteralPath $ManifestFullPath -PathType Leaf) -or (Get-CompactFlowFileSha256 -Path $ManifestFullPath) -cne $ExistingManifestSha256) { Throw-ActiveRouteWriterError -ExitCode 14 -FailureCode "PRIOR_GENERATION_MISMATCH" -Message "Manifest changed during publication." }
        [IO.File]::Replace($TempPath, $ManifestFullPath, $BackupPath, $true)
      }
      if ($null -ne $AfterPublish) { & $AfterPublish ([pscustomobject]@{ manifest_path=$ManifestFullPath; backup_path=$BackupPath; published_sha256=$PublishedManifestSha256 }) }
      $PublishedSnapshot = Open-ActiveRouteSnapshot -Root $ResolvedTargetRoot -RelativePath $ManifestPath -Label 'published active route manifest'
      try {
        $PublishedManifest = ConvertFrom-ActiveRouteSnapshotJson -Snapshot $PublishedSnapshot -Label 'published active route manifest'
        Assert-ActiveRouteManifest -Manifest $PublishedManifest
        if ([string]$PublishedManifest.generation_id -cne [string]$Manifest.generation_id) { throw 'Published manifest differs from the verified temporary file.' }
      }
      finally { $PublishedSnapshot.stream.Dispose() }
    }
    catch {
      if ($_.Exception.Data.Contains('active_route_exit_code')) { throw }
      if (Test-Path -LiteralPath $BackupPath -PathType Leaf) {
        if ((Test-Path -LiteralPath $ManifestFullPath -PathType Leaf) -and (Get-CompactFlowFileSha256 -Path $ManifestFullPath) -ceq $PublishedManifestSha256) {
          Remove-Item -LiteralPath $ManifestFullPath -Force
          [IO.File]::Move($BackupPath, $ManifestFullPath)
        }
        elseif (-not (Test-Path -LiteralPath $ManifestFullPath)) { [IO.File]::Move($BackupPath, $ManifestFullPath) }
        else { $RetainBackup = $true }
      }
      elseif ($ExistingGeneration -ceq 'ABSENT' -and (Test-Path -LiteralPath $ManifestFullPath -PathType Leaf) -and (Get-CompactFlowFileSha256 -Path $ManifestFullPath) -ceq $PublishedManifestSha256) {
        Remove-Item -LiteralPath $ManifestFullPath -Force
      }
      Throw-ActiveRouteWriterError -ExitCode 15 -FailureCode "ATOMIC_REPLACE_FAILED" -Message "Active-route publication failed; the prior manifest was preserved when present."
    }
    finally {
      if (Test-Path -LiteralPath $TempPath) { Remove-Item -LiteralPath $TempPath -Force }
      if (-not $RetainBackup -and (Test-Path -LiteralPath $BackupPath)) { Remove-Item -LiteralPath $BackupPath -Force }
    }
    return New-ActiveRouteReceipt -OperationName $OperationName -Outcome 'WRITTEN' -Manifest $Manifest -ManifestPath $ManifestPath
  }
  finally {
    if ($null -ne $WriterLock) { $WriterLock.Dispose() }
    if ($null -ne $ManifestParentGuard) { $ManifestParentGuard.Dispose() }
    if (-not [string]::IsNullOrWhiteSpace($WriterLockPath) -and (Test-Path -LiteralPath $WriterLockPath -PathType Leaf)) { try { Remove-Item -LiteralPath $WriterLockPath -Force } catch { $null = $_ } }
    foreach ($Snapshot in $Snapshots) { if ($null -ne $Snapshot.stream) { try { $Snapshot.stream.Dispose() } catch { $null = $_ } } }
  }
}

function Invoke-ActiveRouteManifestWriterCli {
  param(
    [string]$CliOperation,
    [string]$CliTargetRoot,
    [string]$CliRegistryRoot,
    [string]$CliProjectId,
    [string]$CliProfileId,
    [string]$CliExpectedPriorGenerationId,
    [hashtable]$CliCallerExpectations
  )

  try {
    if ($CliOperation -cnotin @('VERIFY','WRITE')) { Throw-ActiveRouteWriterError -ExitCode 10 -FailureCode 'INPUT_INVALID' -Message 'Operation must be VERIFY or WRITE.' }
    $Receipt = Invoke-ActiveRouteManifestWriterCore -OperationName $CliOperation -TargetRootPath $CliTargetRoot -RegistryRootPath $CliRegistryRoot -ExpectedProjectId $CliProjectId -ExpectedProfileId $CliProfileId -PriorGenerationExpectation $CliExpectedPriorGenerationId -CallerExpectations $CliCallerExpectations
    return [pscustomobject]@{ exit_code=0; receipt_json=($Receipt | ConvertTo-Json -Depth 12 -Compress) }
  }
  catch {
    $ExitCode = if ($_.Exception.Data.Contains('active_route_exit_code')) { [int]$_.Exception.Data['active_route_exit_code'] } else { 17 }
    $FailureCode = if ($_.Exception.Data.Contains('active_route_failure_code')) { [string]$_.Exception.Data['active_route_failure_code'] } else { 'INTERNAL_WRITER_FAILURE' }
    $BlockedReceipt = [pscustomobject][ordered]@{
      contract='agent-workflow-active-route-writer/v1'; operation=$(if ($CliOperation -in @('VERIFY','WRITE')) { $CliOperation } else { 'UNKNOWN' }); outcome='BLOCKED'
      generation_id=$null; manifest_path=$null; source_identities=$null; failure_code=$FailureCode; message='Active-route operation blocked.'
    }
    return [pscustomobject]@{ exit_code=$ExitCode; receipt_json=($BlockedReceipt | ConvertTo-Json -Depth 8 -Compress) }
  }
}

if (-not $ActiveRouteWriterWasDotSourced) {
  $CliExpectations = @{
    state_revision=$ExpectedStateRevision; wave_id=$ExpectedWaveId; epic_id=$ExpectedEpicId; workflow_phase=$ExpectedWorkflowPhase
    candidate_identity=$ExpectedCandidateIdentity; configuration_identity=$ExpectedConfigurationIdentity; next_actor=$ExpectedNextActor; next_command=$ExpectedNextCommand
    route_input_mode=$ExpectedRouteInputMode; route_input_path=$ExpectedRouteInputPath; route_input_sha256=$ExpectedRouteInputSha256; route_input_logical_identity=$ExpectedRouteInputLogicalIdentity
  }
  $WriterResult = Invoke-ActiveRouteManifestWriterCli -CliOperation $Operation -CliTargetRoot $TargetRoot -CliRegistryRoot $RegistryRoot -CliProjectId $ProjectId -CliProfileId $ProfileId -CliExpectedPriorGenerationId $ExpectedPriorGenerationId -CliCallerExpectations $CliExpectations
  Write-Output ([string]$WriterResult.receipt_json)
  exit ([int]$WriterResult.exit_code)
}
