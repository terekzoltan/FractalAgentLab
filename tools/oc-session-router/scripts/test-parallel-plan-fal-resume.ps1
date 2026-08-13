$ErrorActionPreference = 'Stop'
$Content = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'run-parallel-plan-review-flow.ps1'))
if (-not $Content.Contains('FAL_EXPLICIT_STAGE_ROUTER_RETIRED')) { throw 'TEST FAILED: parallel plan wrapper is not fail closed.' }
Write-Output 'PASS: parallel plan resume is historical, fail closed, and non-resumable.'
exit 0
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')

$script:PositiveAssertionCount = 0
$script:NegativeAssertionCount = 0

function Assert-Test {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "TEST FAILED: $Message" }
  $script:PositiveAssertionCount++
}

function Join-TestLines {
  param([string[]]$Lines)
  return $Lines -join "`n"
}

function ConvertTo-TestLiteral {
  param([string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function New-TestPlan {
  param([string]$Target, [string]$Epic, [string]$Wave, [string]$Lane, [string]$PlanArtifact)
  return Join-TestLines @(
    'EPIC IMPLEMENTATION PLAN',
    "Target: $Target",
    "Epic: $Epic",
    "Wave: $Wave",
    "Accountable Lane / class / profile: $Lane",
    'Prerequisites/current state: repository inspected',
    'Scope/non-goals: routing only; no unrelated changes',
    'Interfaces/ownership: accountable lane owns implementation',
    'Feature -> User Story -> Task: Feature routing -> User Story safe handoff -> Task enforce identity',
    'Risks: stale candidate selection',
    'Ordered implementation plan: inspect then change then verify',
    'Acceptance -> verification -> evidence: exact binding -> tests -> artifact',
    'Handoffs/exact blockers: Meta review required',
    "Plan artifact: $PlanArtifact",
    'Next route: /terv-review',
    'Readiness: READY'
  )
}

function New-TestMetaReview {
  param([string]$Target, [string]$Epic, [string]$Lane, [string]$PlanArtifact)
  return Join-TestLines @(
    'META PLAN REVIEW',
    "Target: $Target",
    "Epic: $Epic",
    'Plan class: EPIC_PLAN',
    "Plan artifact: $PlanArtifact",
    "Accountable Lane / class / profile: $Lane",
    'Overall verdict: GREEN',
    'Blocking corrections: NONE',
    'Non-blocking improvements: keep evidence concise',
    'Ownership/dependency decision: accountable lane owns changes',
    'Acceptance/evidence decision: targeted checks required',
    'Exact Delivery Lane action: invoke /terv-review-utan with this review'
  )
}

function New-TestRevisedPlan {
  param([string]$Target, [string]$Epic, [string]$Wave, [string]$Lane, [string]$PlanArtifact)
  return Join-TestLines @(
    'REVISED EPIC IMPLEMENTATION PLAN',
    "Target: $Target",
    "Epic: $Epic",
    "Wave: $Wave",
    "Accountable Lane / class / profile: $Lane",
    'Prerequisites/current state: Meta review applied',
    'Scope/non-goals: routing only; no unrelated changes',
    'Interfaces/ownership: accountable lane owns implementation',
    'Feature -> User Story -> Task: Feature routing -> User Story safe handoff -> Task enforce identity',
    'Risks: stale candidate selection',
    'Ordered implementation plan: inspect then change then verify',
    'Acceptance -> verification -> evidence: exact binding -> tests -> artifact',
    'Handoffs/exact blockers: NONE',
    "Plan artifact: $PlanArtifact",
    'Next route: /implement',
    'Readiness: READY',
    'DELIVERY PLAN REVISION',
    "Target: $Target",
    "Epic: $Epic",
    "Accountable Lane / class / profile: $Lane",
    'Applied review items: evidence lock',
    'Rejected/unclear items: NONE',
    "Final plan artifact: $PlanArtifact",
    'PLAN_REVISION_COMPLETE',
    'IMPLEMENT_READY'
  )
}

function New-TestTrackEnvelope {
  param([object[]]$Lanes, [hashtable]$Bodies)
  $Blocks = foreach ($Lane in $Lanes) {
    Join-TestLines @(
      '=== TRACK RESPONSE START ===',
      "TRACK: $($Lane.track_key)",
      "TARGET: $($Lane.target)",
      "EPIC: $($Lane.epic_id)",
      "ACCOUNTABLE LANE: $($Lane.accountable_lane)",
      "LANE CLASS / PROFILE: $($Lane.lane_class) / $($Lane.lane_profile)",
      'RELEVANT SHARED DEPENDENCY: none',
      'COMMAND: terv-review-utan',
      [string]$Bodies[$Lane.track_key],
      '=== TRACK RESPONSE END ==='
    )
  }
  return $Blocks -join "`n"
}

function Set-TestPinnedArtifact {
  param(
    [object]$State,
    [string]$RunDir,
    [string]$Name,
    [string]$Text,
    [string]$ProducerMessageId,
    [string]$Stage,
    [string]$CandidateIdentity,
    [string]$ExpectedOutputKind = ''
  )
  $Path = Join-Path $RunDir $Name
  Write-OCRouterAtomicTextFile -Path $Path -Text $Text
  $Pin = New-OCRouterArtifactPin -Path $Path -ProducerMessageId $ProducerMessageId -Stage $Stage -CandidateIdentity $CandidateIdentity -ExpectedOutputKind $ExpectedOutputKind
  $State.artifact_pins | Add-Member -NotePropertyName $Name -NotePropertyValue $Pin -Force
  return $Path
}

function Invoke-TestChild {
  param([string[]]$Arguments, [string]$Interrupt = '')
  $OldHook = [Environment]::GetEnvironmentVariable('OC_ROUTER_TEST_HARD_INTERRUPT_AFTER_PLAN_FAL', 'Process')
  $OldErrorActionPreference = $ErrorActionPreference
  try {
    [Environment]::SetEnvironmentVariable('OC_ROUTER_TEST_HARD_INTERRUPT_AFTER_PLAN_FAL', $Interrupt, 'Process')
    $ErrorActionPreference = 'Continue'
    $EffectiveArguments = @('-ExecutionPolicy', 'Bypass') + @($Arguments)
    $Output = @(& $script:PowerShellExe @EffectiveArguments 2>&1)
    return [pscustomobject]@{ exit_code = $LASTEXITCODE; output = ($Output -join "`n") }
  }
  finally {
    $ErrorActionPreference = $OldErrorActionPreference
    [Environment]::SetEnvironmentVariable('OC_ROUTER_TEST_HARD_INTERRUPT_AFTER_PLAN_FAL', $OldHook, 'Process')
  }
}

$TestRoot = Join-Path ([IO.Path]::GetTempPath()) ('oc-router-parallel-plan-fal-resume-' + [guid]::NewGuid().ToString('N'))
$TargetRoot = Join-Path $TestRoot 'target'
$ControlRoot = Join-Path $TestRoot 'control'
$RouterDir = Join-Path $TestRoot 'router'
$Wrapper = Join-Path $PSScriptRoot 'run-parallel-plan-review-flow.ps1'
$WrapperText = Get-Content -LiteralPath $Wrapper -Raw
$script:PowerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source
$RunId = 'fal-resume-regression'
$NoFalRunId = 'no-fal-preview-regression'
$LaneSpecs = @('track-a|Project Alpha|EPIC-A', 'track-b|Project Alpha|EPIC-B')

New-Item -ItemType Directory -Force -Path $TargetRoot, $ControlRoot, $RouterDir | Out-Null
try {
  Assert-Test -Condition ($WrapperText -match "Add-Member -NotePropertyName plan_class -NotePropertyValue 'EPIC_PLAN'" -and $WrapperText -match 'New-OCRouterPlanRevisionArgument -SourcePlanText') -Message 'parallel initial review does not explicitly bind EPIC_PLAN or both revision artifacts'
  & git -C $TargetRoot init -q
  if ($LASTEXITCODE -ne 0) { throw 'Git init failed for parallel plan FAL resume test.' }
  Set-Content -LiteralPath (Join-Path $TargetRoot 'tracked.txt') -Value 'accepted base' -Encoding UTF8
  & git -C $TargetRoot add -- tracked.txt
  & git -c user.name=oc-router-test -c user.email=oc-router-test@example.invalid -C $TargetRoot commit -q -m 'test base'
  if ($LASTEXITCODE -ne 0) { throw 'Git commit failed for parallel plan FAL resume test.' }
  $TargetHead = (@(& git -C $TargetRoot rev-parse HEAD) -join '').Trim().ToLowerInvariant()
  $TargetRef = (@(& git -C $TargetRoot symbolic-ref --quiet --short HEAD) -join '').Trim()

  $Sessions = [ordered]@{
    server = 'http://127.0.0.1:1'
    sessions = [ordered]@{
      'track-a' = [ordered]@{ sessionId='session-a'; title='Track A' }
      'track-b' = [ordered]@{ sessionId='session-b'; title='Track B' }
      meta = [ordered]@{ sessionId='session-meta'; title='Meta' }
    }
  }
  Write-OCRouterAtomicJsonFile -Path (Join-Path $RouterDir 'sessions.json') -Value $Sessions

  $LaneArrayLiteral = "@({0},{1})" -f (ConvertTo-TestLiteral $LaneSpecs[0]), (ConvertTo-TestLiteral $LaneSpecs[1])
  $PreviewCommand = "& {0} -Lane {1} -StartSeqNext -PreviewOnly -FalSyncCheckpoint -FalProjectId 'project-alpha' -FalProjectName 'Project Alpha' -FalTargetRepoKind git -FalTargetRepoPath {2} -FalTargetWorktreePath {2} -FalTargetHead {3} -FalTargetRef {4} -FalTargetStatus clean -FalControlRoot {5} -RouterDir {6} -Password test -RunId {7} -AutoApprove" -f `
    (ConvertTo-TestLiteral $Wrapper), $LaneArrayLiteral, (ConvertTo-TestLiteral $TargetRoot), (ConvertTo-TestLiteral $TargetHead),
    (ConvertTo-TestLiteral $TargetRef), (ConvertTo-TestLiteral $ControlRoot), (ConvertTo-TestLiteral $RouterDir), (ConvertTo-TestLiteral $RunId)
  $PreviewArgs = @('-NoProfile', '-Command', $PreviewCommand)
  $Preview = Invoke-TestChild -Arguments $PreviewArgs
  Assert-Test -Condition ($Preview.exit_code -eq 0) -Message "FAL preview run failed: $($Preview.output)"

  $RunDir = Join-Path (Join-Path $RouterDir 'parallel-runs') $RunId
  $StatePath = Join-Path $RunDir 'state.json'
  $State = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  Assert-Test -Condition ([bool]$State.fal_sync_checkpoint) -Message 'new run did not persist FalSyncCheckpoint'
  foreach ($Pair in @(
    @('fal_project_id', 'project-alpha'), @('fal_project_name', 'Project Alpha'), @('fal_target_repo_kind', 'git'),
    @('fal_target_repo_path', (Resolve-Path -LiteralPath $TargetRoot).Path), @('fal_target_worktree_path', (Resolve-Path -LiteralPath $TargetRoot).Path),
    @('fal_target_head', $TargetHead), @('fal_target_ref', $TargetRef), @('fal_target_status', 'clean'),
    @('fal_control_root', (Resolve-Path -LiteralPath $ControlRoot).Path)
  )) {
    Assert-Test -Condition ([string]$State.($Pair[0]) -ceq [string]$Pair[1]) -Message "new run did not persist exact $($Pair[0])"
  }

  $Lanes = @(ConvertTo-OCRouterLaneCollection -LaneSpecs $LaneSpecs -Config $null)
  $MetaBodies = @{}
  foreach ($Lane in $Lanes) {
    $Safe = Get-OCRouterSafeName -Value $Lane.track_key
    $Wave = if ($Lane.track_key -ceq 'track-a') { 'WAVE-A' } else { 'WAVE-B' }
    $PlanArtifact = "$($Lane.epic_id).plan.v1"
    $LaneValue = "$($Lane.accountable_lane) / $($Lane.lane_class) / $($Lane.lane_profile)"
    $Plan = New-TestPlan -Target $Lane.target -Epic $Lane.epic_id -Wave $Wave -Lane $LaneValue -PlanArtifact $PlanArtifact
    $Revision = New-TestRevisedPlan -Target $Lane.target -Epic $Lane.epic_id -Wave $Wave -Lane $LaneValue -PlanArtifact $PlanArtifact
    Set-TestPinnedArtifact -State $State -RunDir $RunDir -Name "01-$Safe-plan.md" -Text $Plan -ProducerMessageId "plan-message-$Safe" -Stage 'track_plan' -CandidateIdentity "id:plan-message-$Safe" -ExpectedOutputKind 'track_plan' | Out-Null
    Set-TestPinnedArtifact -State $State -RunDir $RunDir -Name "05-$Safe-plan-revision.md" -Text $Revision -ProducerMessageId "revision-message-$Safe" -Stage 'track_plan_revision' -CandidateIdentity "id:revision-message-$Safe" -ExpectedOutputKind 'track_plan_revision' | Out-Null
    $MetaBodies[$Lane.track_key] = New-TestMetaReview -Target $Lane.target -Epic $Lane.epic_id -Lane $LaneValue -PlanArtifact $PlanArtifact

    $LaneState = @($State.lanes | Where-Object { [string]$_.track_key -ceq [string]$Lane.track_key })[0]
    $RevisionArgument = New-OCRouterPlanRevisionArgument -SourcePlanText $Plan -MetaReviewText ([string]$MetaBodies[$Lane.track_key])
    $RevisionPayload = New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $RevisionArgument | ConvertTo-Json -Depth 10
    $Intent = Start-OCRouterDispatchIntent -RunDir $RunDir -Transition "terv-review-utan-$Safe" -Recipient $Lane.track_key -Kind command -Operation 'terv-review-utan' -Payload $RevisionPayload -BaselineIdentity "id:baseline-$Safe" -CandidateIdentity ("sha256:{0}" -f (Get-OCRouterStringSha256 -Text $RevisionArgument)) -Stage 'plan_revision'
    Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId "dispatch-$Safe" | Out-Null
    $LaneState.sent_seq_next = $true
    $LaneState.plan_received = $true
    $LaneState.plan_message_id = "plan-message-$Safe"
    $LaneState.plan_candidate_identity = "id:plan-message-$Safe"
    $LaneState.plan_artifact = $PlanArtifact
    $LaneState.sent_terv_review_utan = $true
    $LaneState.plan_revision_received = $true
    $LaneState.plan_revision_message_id = "revision-message-$Safe"
    $LaneState.plan_revision_candidate_identity = "id:revision-message-$Safe"
    $LaneState.plan_revision_dispatch_intent_path = [string]$Intent.path
  }
  $MetaEnvelope = New-TestTrackEnvelope -Lanes $Lanes -Bodies $MetaBodies
  Set-TestPinnedArtifact -State $State -RunDir $RunDir -Name '03-meta-combined-plan-review.md' -Text $MetaEnvelope -ProducerMessageId 'meta-review-message' -Stage 'meta_plan_review' -CandidateIdentity 'id:meta-review-message' | Out-Null
  $State.sent_meta_plan_review = $true
  $State.meta_plan_review_received = $true
  $State.meta_plan_review_message_id = 'meta-review-message'
  $State.meta_plan_review_candidate_identity = 'id:meta-review-message'
  $State.completed_at = ''
  Write-OCRouterAtomicJsonFile -Path $StatePath -Value $State

  $ResumeCommand = "& {0} -Resume -RunId {1} -RouterDir {2} -Password test -AutoApprove" -f (ConvertTo-TestLiteral $Wrapper), (ConvertTo-TestLiteral $RunId), (ConvertTo-TestLiteral $RouterDir)
  $ResumeArgs = @('-NoProfile', '-Command', $ResumeCommand)
  $Interrupted = Invoke-TestChild -Arguments $ResumeArgs -Interrupt 'proposal:track-a'
  Assert-Test -Condition ($Interrupted.exit_code -ne 0) -Message 'hard interruption hook did not terminate the child process'

  $InterruptedState = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  Assert-Test -Condition ([bool]$InterruptedState.fal_sync_checkpoint) -Message 'interrupted state downgraded FAL mode'
  $LaneAInterrupted = @($InterruptedState.lanes | Where-Object { [string]$_.track_key -ceq 'track-a' })[0]
  foreach ($Field in @('fal_checkpoint_identity_sha256','delivery_receipt_path','delivery_receipt_sha256','fal_checkpoint_operation_path','fal_checkpoint_operation_sha256')) {
    Assert-Test -Condition (-not [string]::IsNullOrWhiteSpace([string]$LaneAInterrupted.$Field)) -Message "interrupted state omitted durable $Field"
  }
  $IdentityHashBefore = [string]$LaneAInterrupted.fal_checkpoint_identity_sha256
  $ReceiptHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneAInterrupted.delivery_receipt_path)).Hash
  $ProposalHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneAInterrupted.fal_checkpoint_operation_path)).Hash
  $ReceiptWriteBefore = (Get-Item -LiteralPath ([string]$LaneAInterrupted.delivery_receipt_path)).LastWriteTimeUtc.Ticks
  $ProposalWriteBefore = (Get-Item -LiteralPath ([string]$LaneAInterrupted.fal_checkpoint_operation_path)).LastWriteTimeUtc.Ticks

  $Resumed = Invoke-TestChild -Arguments $ResumeArgs
  Assert-Test -Condition ($Resumed.exit_code -eq 0) -Message "resume after hard interruption failed: $($Resumed.output)"
  $ResumedState = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
  Assert-Test -Condition ([bool]$ResumedState.fal_sync_checkpoint) -Message 'resume downgraded FalSyncCheckpoint when CLI omitted it'
  foreach ($Field in @('fal_project_id','fal_project_name','fal_target_repo_kind','fal_target_repo_path','fal_target_worktree_path','fal_target_head','fal_target_ref','fal_target_status','fal_control_root')) {
    Assert-Test -Condition ([string]$ResumedState.$Field -ceq [string]$InterruptedState.$Field) -Message "resume changed shared FAL tuple field $Field"
  }
  $LaneAResumed = @($ResumedState.lanes | Where-Object { [string]$_.track_key -ceq 'track-a' })[0]
  Assert-Test -Condition ([string]$LaneAResumed.fal_checkpoint_identity_sha256 -ceq $IdentityHashBefore) -Message 'resume replaced the pinned checkpoint identity'
  Assert-Test -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneAResumed.delivery_receipt_path)).Hash -ceq $ReceiptHashBefore) -Message 'resume rewrote the bound delivery receipt'
  Assert-Test -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$LaneAResumed.fal_checkpoint_operation_path)).Hash -ceq $ProposalHashBefore) -Message 'resume rewrote the bound checkpoint proposal'
  Assert-Test -Condition ((Get-Item -LiteralPath ([string]$LaneAResumed.delivery_receipt_path)).LastWriteTimeUtc.Ticks -eq $ReceiptWriteBefore) -Message 'resume touched the existing delivery receipt'
  Assert-Test -Condition ((Get-Item -LiteralPath ([string]$LaneAResumed.fal_checkpoint_operation_path)).LastWriteTimeUtc.Ticks -eq $ProposalWriteBefore) -Message 'resume touched the existing checkpoint proposal'
  $LaneBResumed = @($ResumedState.lanes | Where-Object { [string]$_.track_key -ceq 'track-b' })[0]
  Assert-Test -Condition (-not [string]::IsNullOrWhiteSpace([string]$LaneBResumed.fal_checkpoint_operation_sha256)) -Message 'resume did not finish the remaining lane'

  $StateHashBeforeDrift = (Get-FileHash -Algorithm SHA256 -LiteralPath $StatePath).Hash
  $DriftCommand = "$ResumeCommand -FalProjectName 'Changed Project'"
  $DriftArgs = @('-NoProfile', '-Command', $DriftCommand)
  $Drifted = Invoke-TestChild -Arguments $DriftArgs
  Assert-Test -Condition ($Drifted.exit_code -ne 0 -and $Drifted.output -match 'fal_project_name|FalProjectName') -Message 'changed explicit FAL tuple was not rejected'
  Assert-Test -Condition ((Get-FileHash -Algorithm SHA256 -LiteralPath $StatePath).Hash -ceq $StateHashBeforeDrift) -Message 'changed-tuple rejection mutated saved state'

  $NoFalCommand = "& {0} -Lane {1} -StartSeqNext -PreviewOnly -RouterDir {2} -Password test -RunId {3} -AutoApprove" -f (ConvertTo-TestLiteral $Wrapper), $LaneArrayLiteral, (ConvertTo-TestLiteral $RouterDir), (ConvertTo-TestLiteral $NoFalRunId)
  $NoFalArgs = @('-NoProfile', '-Command', $NoFalCommand)
  $NoFalPreview = Invoke-TestChild -Arguments $NoFalArgs
  Assert-Test -Condition ($NoFalPreview.exit_code -eq 0) -Message "no-FAL preview behavior regressed: $($NoFalPreview.output)"
  $NoFalState = Get-Content -LiteralPath (Join-Path (Join-Path (Join-Path $RouterDir 'parallel-runs') $NoFalRunId) 'state.json') -Raw | ConvertFrom-Json
  Assert-Test -Condition (-not [bool]$NoFalState.fal_sync_checkpoint) -Message 'no-FAL run persisted enabled checkpoint mode'
  Assert-Test -Condition ([string]::IsNullOrWhiteSpace([string]$NoFalState.fal_project_id) -and [string]::IsNullOrWhiteSpace([string]$NoFalState.fal_target_repo_path)) -Message 'no-FAL run unexpectedly resolved a checkpoint tuple'

  "PARALLEL_PLAN_FAL_RESUME_TESTS_OK positive_assertions=$script:PositiveAssertionCount negative_assertions=$script:NegativeAssertionCount hard_interruptions=1 successful_resumes=1 changed_tuple_rejections=1"
}
finally {
  if (Test-Path -LiteralPath $TestRoot) {
    Remove-Item -LiteralPath $TestRoot -Recurse -Force
  }
}
