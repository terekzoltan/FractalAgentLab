$ErrorActionPreference = 'Stop'
$RetiredWrappers = @('run-review-fix-cycle.ps1','run-parallel-review-fix-cycle.ps1')
foreach ($Name in $RetiredWrappers) {
  $Content = [IO.File]::ReadAllText((Join-Path $PSScriptRoot $Name))
  if (-not $Content.Contains('FAL_EXPLICIT_STAGE_ROUTER_RETIRED')) { throw "TEST FAILED: $Name is not fail closed." }
}
Write-Output 'PASS: review-fix wrappers are historical and fail closed; explicit stages use Invoke-OCRouter.ps1.'
exit 0
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')

$script:PositiveAssertionCount = 0
$script:NegativeAssertionCount = 0

function Assert-Test {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw "TEST FAILED: $Message" }
  $script:PositiveAssertionCount++
}

function Assert-Throws {
  param([scriptblock]$Action, [string]$Pattern, [string]$Message)
  try { & $Action }
  catch {
    if ([string]$_.Exception.Message -notmatch $Pattern) { throw "TEST FAILED: $Message (unexpected: $($_.Exception.Message))" }
    $script:NegativeAssertionCount++
    return
  }
  throw "TEST FAILED: $Message (no error)"
}

function New-TestSynthesis {
  param([string]$Target, [string]$Epic, [string]$Candidate, [string]$Lane, [string]$Disposition, [string]$FindingId = '')
  $Verdict = switch ($Disposition) { 'ALLOWED' { 'GREEN' } 'FIX_REQUIRED' { 'YELLOW' } 'BLOCKED' { 'RED' } }
  $Accepted = switch ($Disposition) {
    'ALLOWED' { 'NONE' }
    'FIX_REQUIRED' { '[{"id":"' + $FindingId + '","severity":"Major","resolution_state":"OPEN_FIX_REQUIRED","evidence":"failing acceptance check","owner":"' + $Lane + '","route":"/implement","enforcing_gate":"step-review","acceptance_authority":"NONE","reason":"repair required"}]' }
    'BLOCKED' { '[{"id":"' + $FindingId + '","severity":"Major","resolution_state":"OPEN_BLOCKED","evidence":"owner decision missing","owner":"Owner","route":"Meta/Orchestrator","enforcing_gate":"owner-decision","acceptance_authority":"NONE","reason":"authority unresolved"}]' }
  }
  $Verification = if ($Disposition -eq 'BLOCKED') { 'BLOCKED by owner authority gate' } elseif ($Disposition -eq 'FIX_REQUIRED') { 'FIX_REQUIRED by acceptance check' } else { 'PASS exact acceptance evidence' }
  return @(
    'FINAL STEP REVIEW SYNTHESIS',
    "Target: $Target", "Epic: $Epic", "Candidate: $Candidate", "Accountable Lane / class / profile: $Lane / TRACK / $($Lane.ToLowerInvariant().Replace(' ','-'))",
    'Reviewed scope: exact candidate delta and acceptance evidence', "Overall verdict: $Verdict",
    'Review profile/topology: profile=standard; depth_rationale=normal semantic risk; confidence=HIGH; resolved_lanes=correctness,tests; omitted_lanes=none; limitations=none',
    'Acceptance/evidence matrix: acceptance mapped to exact checks', "Accepted findings: $Accepted", 'Rejected/downgraded findings: NONE',
    "Verification result: $Verification", 'Proposed closeout delta: NONE', "Closeout disposition: $Disposition",
    'Commit status: DEFERRED_TO_CLOSEOUT', 'Exact Delivery Lane action: invoke /step-review-utan with this exact synthesis'
  ) -join "`n"
}

function New-TestDelivery {
  param([string]$Target, [string]$Epic, [string]$Candidate, [string]$Lane, [string]$Disposition, [string]$FindingId = '')
  switch ($Disposition) {
    'ALLOWED' { return 'ACK_ONLY' }
    'BLOCKED' { return "UNCLEAR`nOwner gate and acceptance authority remain unresolved." }
    'FIX_REQUIRED' {
      return @(
        'FIX_PLAN_REQUIRED', "Target: $Target", "Epic: $Epic", "Candidate: $Candidate",
        "Accountable Lane / class / profile: $Lane / TRACK / $($Lane.ToLowerInvariant().Replace(' ','-'))",
        "Accepted finding IDs: [`"$FindingId`"]", 'Allowed surfaces: src/', 'Forbidden surfaces: .git/',
        "Finding -> change -> acceptance/check: $FindingId -> repair behavior -> rerun acceptance check",
        'Dependencies: none', "Fix-plan artifact: $FindingId.fix.v1", 'FIX_PLAN_READY_FOR_IMPLEMENT'
      ) -join "`n"
    }
  }
}

function New-TestImplementation {
  param([string]$Target, [string]$Epic, [string]$Candidate, [string]$Lane, [string]$Profile, [string]$PlanArtifactIdentity = 'review-fix.v2')
  return @(
    'IMPLEMENTATION RESULT', "Target: $Target", "Epic: $Epic",
    "Accountable Lane / class / profile: $Lane / TRACK / $Profile",
    "Plan/fix-plan identity: $PlanArtifactIdentity", 'Changed artifacts: src/pinned-change.ps1',
    'Explicit non-changes: no unrelated files', 'Acceptance mapping: finding -> targeted check',
    'Checks/results: targeted checks PASS', "Candidate identity/worktree limitations: $Candidate",
    'Diff self-review: PASS', 'Unresolved risks/findings: NONE', 'Exact route: Meta /step-review', 'REVIEW_READY'
  ) -join "`n"
}

function New-TestMetaReviewFix {
  param([string]$Target, [string]$Epic, [string]$Lane, [string]$Profile, [string]$Artifact)
  return @(
    'META PLAN REVIEW', "Target: $Target", "Epic: $Epic", 'Plan class: REVIEW_FIX_PLAN', "Plan artifact: $Artifact",
    "Accountable Lane / class / profile: $Lane / TRACK / $Profile", 'Overall verdict: YELLOW',
    'Blocking corrections: preserve exact finding scope', 'Non-blocking improvements: NONE',
    "Ownership/dependency decision: $Lane owns bounded correction", 'Acceptance/evidence decision: rerun exact finding checks',
    'Exact Delivery Lane action: invoke /terv-review-utan with this review'
  ) -join "`n"
}

function New-TestRevisedFixPlan {
  param([string]$Target, [string]$Epic, [string]$Candidate, [string]$Lane, [string]$Profile, [string]$FindingId, [string]$Artifact)
  return @(
    'REVISED REVIEW-FIX PLAN', "Target: $Target", "Epic: $Epic", "Candidate: $Candidate",
    "Accountable Lane / class / profile: $Lane / TRACK / $Profile", "Accepted finding IDs: [`"$FindingId`"]",
    'Allowed surfaces: src/', 'Forbidden surfaces: .git/',
    "Finding -> change -> acceptance/check: $FindingId -> repair behavior -> rerun acceptance check",
    'Dependencies: none', "Fix-plan artifact: $Artifact", 'Next route: /implement', 'Readiness: READY',
    'FIX_PLAN_READY_FOR_IMPLEMENT', 'DELIVERY PLAN REVISION', "Target: $Target", "Epic: $Epic",
    "Accountable Lane / class / profile: $Lane / TRACK / $Profile", "Applied review items: $FindingId",
    'Rejected/unclear items: NONE', "Final plan artifact: $Artifact", 'PLAN_REVISION_COMPLETE', 'IMPLEMENT_READY'
  ) -join "`n"
}

function New-TestSourceArtifacts {
  param([string]$Root, [string]$Track, [string]$Target, [string]$Epic, [string]$Candidate, [string]$Lane, [string]$Disposition, [string]$FindingId = '')
  $Safe = Get-OCRouterSafeName -Value $Track
  $SynthesisPath = Join-Path $Root "$Safe-synthesis.md"
  $DeliveryPath = Join-Path $Root "$Safe-delivery.md"
  Write-OCRouterAtomicTextFile -Path $SynthesisPath -Text (New-TestSynthesis -Target $Target -Epic $Epic -Candidate $Candidate -Lane $Lane -Disposition $Disposition -FindingId $FindingId)
  Write-OCRouterAtomicTextFile -Path $DeliveryPath -Text (New-TestDelivery -Target $Target -Epic $Epic -Candidate $Candidate -Lane $Lane -Disposition $Disposition -FindingId $FindingId)
  $Intent = Start-OCRouterDispatchIntent -RunDir $Root -Transition "source-$Safe" -Recipient $Track -Kind command -Operation 'step-review-utan' -Payload "source-$Safe" -BaselineIdentity "id:baseline-$Safe" -CandidateIdentity $Candidate -Stage 'delivery_response_dispatch'
  Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId "dispatch-$Safe" | Out-Null
  $Class = Get-OCRouterModeFromText -Text (Get-Content -LiteralPath $DeliveryPath -Raw)
  $ReceiptPath = Write-OCRouterArtifactDeliveryReceipt -RunDir $Root -Name "source-$Safe" -ArtifactPath $SynthesisPath -ProducerSession 'meta' -Command 'step-review' -Target $Target -Recipient $Track -DeliveryProven $true -ResponseClass $Class -ResponseArtifactPath $DeliveryPath -ResponseMessageId "message-$Safe" -DispatchIntentPath $Intent.path
  return [pscustomobject]@{ synthesis=$SynthesisPath;delivery=$DeliveryPath;receipt=$ReceiptPath }
}

$TestRoot = Join-Path ([IO.Path]::GetTempPath()) ('oc-router-review-fix-' + [guid]::NewGuid().ToString('N'))
$RouterDir = Join-Path $TestRoot 'router'
New-Item -ItemType Directory -Force -Path $RouterDir | Out-Null
try {
  $FixtureContext = [pscustomobject]@{target='Project B';epic='EPIC-B';candidate='candidate-b';accountable_lane='Track B';lane_class='TRACK';lane_profile='track-b';plan_class='REVIEW_FIX_PLAN';accepted_finding_ids=@('F-B-1')}
  $ReviewContext = [pscustomobject]@{target='Project B';epic='EPIC-B';accountable_lane='Track B';lane_class='TRACK';lane_profile='track-b';plan_class='REVIEW_FIX_PLAN';plan_artifact='F-B-1.fix.v1'}
  $ReviewFixture = New-TestMetaReviewFix -Target 'Project B' -Epic 'EPIC-B' -Lane 'Track B' -Profile 'track-b' -Artifact 'F-B-1.fix.v1'
  $RevisionFixture = New-TestRevisedFixPlan -Target 'Project B' -Epic 'EPIC-B' -Candidate 'candidate-b' -Lane 'Track B' -Profile 'track-b' -FindingId 'F-B-1' -Artifact 'F-B-1.fix.v2'
  $DeliveryFixture = New-TestDelivery -Target 'Project B' -Epic 'EPIC-B' -Candidate 'candidate-b' -Lane 'Track B' -Disposition 'FIX_REQUIRED' -FindingId 'F-B-1'
  Assert-Test -Condition (Test-OCRouterExpectedOutputKind -Text $ReviewFixture -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $ReviewContext) -Message 'REVIEW_FIX_PLAN Meta fixture failed'
  Assert-Test -Condition (Test-OCRouterExpectedOutputKind -Text $RevisionFixture -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $FixtureContext) -Message 'revised review-fix fixture failed'
  Assert-Test -Condition (Test-OCRouterDeliveryStepResponseOutput -Text $DeliveryFixture -Context ([pscustomobject]@{target='Project B';epic='EPIC-B';candidate='candidate-b';accountable_lane='Track B';lane_class='TRACK';lane_profile='track-b';closeout_disposition='FIX_REQUIRED';accepted_finding_ids=@('F-B-1')})) -Message 'FIX_REQUIRED response did not preserve scalar finding IDs on Windows PowerShell'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text $DeliveryFixture -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $FixtureContext)) -Message 'unreviewed fix plan bypassed revision classification'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text ($RevisionFixture -replace 'F-B-1.fix.v2','plans/F-B-1.md') -ExpectedOutputKind 'track_plan_revision')) -Message 'path-like revised fix identity passed'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text ($RevisionFixture -replace 'F-B-1.fix.v2','F-B-1.fix.v2;path') -ExpectedOutputKind 'track_plan_revision')) -Message 'semicolon revised fix identity passed'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text ($RevisionFixture -replace 'Fix-plan artifact: F-B-1.fix.v2','Fix-plan artifact: F-B-1.fix.v2 ') -ExpectedOutputKind 'track_plan_revision')) -Message 'trailing-whitespace revised fix identity passed'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text ($RevisionFixture -replace 'Candidate: candidate-b','Candidate: candidate-other') -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $FixtureContext)) -Message 'candidate drift passed revised fix context'
  $ImplementationFixture = New-TestImplementation -Target 'Project B' -Epic 'EPIC-B' -Candidate 'candidate-b' -Lane 'Track B' -Profile 'track-b' -PlanArtifactIdentity 'F-B-1.fix.v2'
  $ImplementationContext = [pscustomobject]@{target='Project B';epic='EPIC-B';accountable_lane='Track B';lane_class='TRACK';lane_profile='track-b';plan_artifact_identity='F-B-1.fix.v2'}
  Assert-Test -Condition (Test-OCRouterExpectedOutputKind -Text $ImplementationFixture -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext) -Message 'implementation fixture did not bind the revised fix-plan identity'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text $ImplementationFixture -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext ([pscustomobject]@{target='Project B';epic='EPIC-B';accountable_lane='Track B';lane_class='TRACK';lane_profile='track-b';plan_artifact_identity='F-B-1.fix.v3'}))) -Message 'implementation fixture passed a mismatched revised fix-plan identity'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text ($ImplementationFixture -replace 'F-B-1.fix.v2','plans/F-B-1.md') -ExpectedOutputKind 'track_implementation_report')) -Message 'implementation fixture passed a path-like plan identity'
  Assert-Test -Condition (-not (Test-OCRouterExpectedOutputKind -Text ($ImplementationFixture -replace 'Plan/fix-plan identity: F-B-1.fix.v2','Plan/fix-plan identity: F-B-1.fix.v2 ') -ExpectedOutputKind 'track_implementation_report')) -Message 'implementation fixture passed trailing identity whitespace'

  $Sessions = [ordered]@{
    server = 'http://127.0.0.1:1'
    sessions = [ordered]@{
      'track-a' = [ordered]@{ sessionId='session-a';title='Track A' }
      'track-b' = [ordered]@{ sessionId='session-b';title='Track B' }
      'track-c' = [ordered]@{ sessionId='session-c';title='Track C' }
      meta = [ordered]@{ sessionId='session-meta';title='Meta' }
      'swarm-assistant' = [ordered]@{ sessionId='session-swarm';title='Swarm' }
    }
  }
  Write-OCRouterAtomicJsonFile -Path (Join-Path $RouterDir 'sessions.json') -Value $Sessions

  # Validate the parallel child handoff manifest before any session-latest or review dispatch path is available.
  $ParallelStepScript = Join-Path $PSScriptRoot 'run-parallel-step-review-flow.ps1'
  $ParallelStepTokens = $null
  $ParallelStepErrors = $null
  $ParallelStepAst = [Management.Automation.Language.Parser]::ParseFile($ParallelStepScript, [ref]$ParallelStepTokens, [ref]$ParallelStepErrors)
  foreach ($FunctionName in @('Get-ParallelStepPinnedImplementationEntry','Resolve-ParallelStepPinnedImplementationManifest')) {
    $FunctionAst = $ParallelStepAst.Find({ param($Node) $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -ceq $FunctionName }, $true)
    Assert-Test -Condition ($null -ne $FunctionAst -and @($ParallelStepErrors).Count -eq 0) -Message "parallel pinned handoff function '$FunctionName' is missing or unparsable"
    . ([scriptblock]::Create($FunctionAst.Extent.Text))
  }
  $PinnedLanes = @(ConvertTo-OCRouterLaneCollection -LaneSpecs @('track-a|Project A|EPIC-A','track-b|Project B|EPIC-B') -Config (Get-Content -LiteralPath (Join-Path $RouterDir 'sessions.json') -Raw | ConvertFrom-Json))
  $PinnedAPath = Join-Path $TestRoot 'implementation-a.md'
  $PinnedBPath = Join-Path $TestRoot 'implementation-b.md'
  Write-OCRouterAtomicTextFile -Path $PinnedAPath -Text (New-TestImplementation -Target 'Project A' -Epic 'EPIC-A' -Candidate 'candidate-a-fixed' -Lane 'Track A' -Profile 'track-a')
  Write-OCRouterAtomicTextFile -Path $PinnedBPath -Text (New-TestImplementation -Target 'Project B' -Epic 'EPIC-B' -Candidate 'candidate-b-fixed' -Lane 'Track B' -Profile 'track-b')
  $PinnedManifestPath = Join-Path $TestRoot 'pinned-implementation-manifest.json'
  $PinnedManifest = [ordered]@{ version=1;lanes=@(
    [ordered]@{track_key='track-a';target='Project A';epic='EPIC-A';candidate='candidate-a-fixed';accountable_lane_id='Track A';accountable_lane_class='TRACK';accountable_lane_profile='track-a';artifact_path=$PinnedAPath;artifact_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $PinnedAPath).Hash;producer_message_id='implementation-a-message';candidate_identity='id:implementation-a-message'},
    [ordered]@{track_key='track-b';target='Project B';epic='EPIC-B';candidate='candidate-b-fixed';accountable_lane_id='Track B';accountable_lane_class='TRACK';accountable_lane_profile='track-b';artifact_path=$PinnedBPath;artifact_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $PinnedBPath).Hash;producer_message_id='implementation-b-message';candidate_identity='id:implementation-b-message'}
  )}
  Write-OCRouterAtomicJsonFile -Path $PinnedManifestPath -Value $PinnedManifest
  $ResolvedPinnedManifest = Resolve-ParallelStepPinnedImplementationManifest -ManifestPath $PinnedManifestPath -ManifestSha256 (Get-FileHash -Algorithm SHA256 -LiteralPath $PinnedManifestPath).Hash -Lanes $PinnedLanes
  Assert-Test -Condition (@($ResolvedPinnedManifest.entries).Count -eq 2 -and [string]$ResolvedPinnedManifest.entries[1].candidate -ceq 'candidate-b-fixed') -Message 'parallel pinned handoff did not preserve exact Candidates'
  $PinnedManifest.lanes[1].candidate = 'candidate-b-newer'
  Write-OCRouterAtomicJsonFile -Path $PinnedManifestPath -Value $PinnedManifest
  Assert-Throws -Action { Resolve-ParallelStepPinnedImplementationManifest -ManifestPath $PinnedManifestPath -ManifestSha256 (Get-FileHash -Algorithm SHA256 -LiteralPath $PinnedManifestPath).Hash -Lanes $PinnedLanes | Out-Null } -Pattern 'Candidate drift' -Message 'parallel pinned handoff accepted a newer different Candidate'

  $A = New-TestSourceArtifacts -Root $TestRoot -Track 'track-a' -Target 'Project A' -Epic 'EPIC-A' -Candidate 'candidate-a' -Lane 'Track A' -Disposition 'ALLOWED'
  $B = New-TestSourceArtifacts -Root $TestRoot -Track 'track-b' -Target 'Project B' -Epic 'EPIC-B' -Candidate 'candidate-b' -Lane 'Track B' -Disposition 'FIX_REQUIRED' -FindingId 'F-B-1'
  $C = New-TestSourceArtifacts -Root $TestRoot -Track 'track-c' -Target 'Project C' -Epic 'EPIC-C' -Candidate 'candidate-c' -Lane 'Track C' -Disposition 'BLOCKED' -FindingId 'F-C-1'

  $Serial = Join-Path $PSScriptRoot 'run-review-fix-cycle.ps1'
  $Allowed = & $Serial -Track track-a -Target 'Project A' -Epic EPIC-A -Wave WAVE-A -Candidate candidate-a -AccountableLaneId 'Track A' -AccountableLaneClass TRACK -AccountableLaneProfile track-a -PinnedFinalSynthesisPath $A.synthesis -PinnedDeliveryResponsePath $A.delivery -PinnedDeliveryReceiptPath $A.receipt -CycleIndex 1 -RouterDir $RouterDir -InspectOnly
  $Fix = & $Serial -Track track-b -Target 'Project B' -Epic EPIC-B -Wave WAVE-B -Candidate candidate-b -AccountableLaneId 'Track B' -AccountableLaneClass TRACK -AccountableLaneProfile track-b -PinnedFinalSynthesisPath $B.synthesis -PinnedDeliveryResponsePath $B.delivery -PinnedDeliveryReceiptPath $B.receipt -CycleIndex 1 -RouterDir $RouterDir -InspectOnly
  $Blocked = & $Serial -Track track-c -Target 'Project C' -Epic EPIC-C -Wave WAVE-C -Candidate candidate-c -AccountableLaneId 'Track C' -AccountableLaneClass TRACK -AccountableLaneProfile track-c -PinnedFinalSynthesisPath $C.synthesis -PinnedDeliveryResponsePath $C.delivery -PinnedDeliveryReceiptPath $C.receipt -CycleIndex 1 -RouterDir $RouterDir -InspectOnly
  Assert-Test -Condition ($Allowed.closeout_disposition -ceq 'ALLOWED' -and $Allowed.delivery_response_class -ceq 'ACK_ONLY') -Message 'ALLOWED did not require ACK_ONLY'
  Assert-Test -Condition ($Fix.closeout_disposition -ceq 'FIX_REQUIRED' -and $Fix.delivery_response_class -ceq 'FIX_PLAN_REQUIRED' -and @($Fix.open_fix_finding_ids).Count -eq 1) -Message 'FIX_REQUIRED did not bind exact fix IDs'
  Assert-Test -Condition ($Blocked.closeout_disposition -ceq 'BLOCKED' -and $Blocked.delivery_response_class -ceq 'UNCLEAR') -Message 'BLOCKED did not require UNCLEAR'

  $ManifestPath = Join-Path $TestRoot 'source-manifest.json'
  $Manifest = [ordered]@{ version=1;lanes=@(
    [ordered]@{track_key='track-a';wave='WAVE-A';candidate='candidate-a';accountable_lane_id='Track A';accountable_lane_class='TRACK';accountable_lane_profile='track-a';final_synthesis_path=$A.synthesis;delivery_response_path=$A.delivery;delivery_receipt_path=$A.receipt;fal_checkpoint_proposal_path='NONE'},
    [ordered]@{track_key='track-b';wave='WAVE-B';candidate='candidate-b';accountable_lane_id='Track B';accountable_lane_class='TRACK';accountable_lane_profile='track-b';final_synthesis_path=$B.synthesis;delivery_response_path=$B.delivery;delivery_receipt_path=$B.receipt;fal_checkpoint_proposal_path='NONE'},
    [ordered]@{track_key='track-c';wave='WAVE-C';candidate='candidate-c';accountable_lane_id='Track C';accountable_lane_class='TRACK';accountable_lane_profile='track-c';final_synthesis_path=$C.synthesis;delivery_response_path=$C.delivery;delivery_receipt_path=$C.receipt;fal_checkpoint_proposal_path='NONE'}
  )}
  Write-OCRouterAtomicJsonFile -Path $ManifestPath -Value $Manifest
  $Parallel = Join-Path $PSScriptRoot 'run-parallel-review-fix-cycle.ps1'
  $ParallelResult = & $Parallel -Lane @('track-a|Project A|EPIC-A','track-b|Project B|EPIC-B','track-c|Project C|EPIC-C') -SourceManifestPath $ManifestPath -CycleIndex 1 -RouterDir $RouterDir -InspectOnly
  Assert-Test -Condition ($ParallelResult.lane_count -eq 3) -Message 'parallel manifest inspection lost lanes'

  Assert-Throws -Action { & $Serial -Track track-a -Target 'Project A' -Epic WRONG -Wave WAVE-A -Candidate candidate-a -AccountableLaneId 'Track A' -AccountableLaneClass TRACK -AccountableLaneProfile track-a -PinnedFinalSynthesisPath $A.synthesis -PinnedDeliveryResponsePath $A.delivery -PinnedDeliveryReceiptPath $A.receipt -RouterDir $RouterDir -InspectOnly | Out-Null } -Pattern '16-line|Target/Epic' -Message 'serial accepted wrong Epic'
  Assert-Throws -Action { & $Parallel -Lane @('track-a|Project A') -SourceManifestPath $ManifestPath -RouterDir $RouterDir -InspectOnly | Out-Null } -Pattern 'Legacy ambiguous|track.*target.*epic' -Message 'parallel accepted legacy two-part lane'

  $SerialText = Get-Content -LiteralPath $Serial -Raw
  $ParallelText = Get-Content -LiteralPath $Parallel -Raw
  Assert-Test -Condition ($SerialText -notmatch 'FalSyncApply|invoke-command-and-wait|latest Track output') -Message 'serial retains retired/unsafe legacy path'
  Assert-Test -Condition ($ParallelText -notmatch 'FalSyncApply|single_lane_serial|latest Track output') -Message 'parallel retains retired/unsafe legacy path'
  Assert-Test -Condition ($SerialText -match 'Start-OCRouterDispatchIntent' -and $SerialText -match 'Get-OCRouterLatestRawAssistantMessageFromUri' -and $SerialText -match 'Write-OCRouterArtifactDeliveryReceipt') -Message 'serial durability primitives missing'
  Assert-Test -Condition ($ParallelText -match 'Start-OCRouterDispatchIntent' -and $ParallelText -match 'Wait-OCRouterParallelOutputs' -and $ParallelText -match 'Write-OCRouterFalCheckpointTargetProposal') -Message 'parallel durability/FAL primitives missing'
  Assert-Test -Condition ($SerialText -match "Command 'terv-review'" -and $SerialText -match "Command 'terv-review-utan'" -and $SerialText -match "plan_class = 'REVIEW_FIX_PLAN'" -and $SerialText -match '-Arguments \$RevisionText') -Message 'serial review-fix lacks exact Meta review, Delivery revision, or revised-artifact implementation prerequisites'
  Assert-Test -Condition ($SerialText -match 'New-OCRouterPlanRevisionArgument -SourcePlanText \$DeliveryText -MetaReviewText \$MetaReviewText' -and $SerialText -match 'plan_artifact_identity = \$FinalPlanArtifactIdentity') -Message 'serial review-fix does not bind both revision inputs or the final revised identity'
  Assert-Test -Condition ($SerialText.IndexOf("-Command 'terv-review'") -lt $SerialText.IndexOf("-Command 'terv-review-utan'") -and $SerialText.IndexOf("-Command 'terv-review-utan'") -lt $SerialText.IndexOf("-Command 'implement'")) -Message 'serial review-fix lifecycle order drifted'
  Assert-Test -Condition ($SerialText -notmatch '-Command ''implement'' -Arguments \$DeliveryText') -Message 'serial still permits direct original fix-plan implementation'
  Assert-Test -Condition ($ParallelText -match 'New-OCRouterParallelPlanReviewRequest' -and $ParallelText -match 'parallel_meta_plan_review' -and $ParallelText -match 'review-fix-terv-review-utan-' -and $ParallelText -match 'revised_fix_plan_path') -Message 'parallel review-fix lacks batched Meta review, parallel Delivery revision, or revised pins'
  Assert-Test -Condition ($ParallelText -match 'New-OCRouterPlanRevisionArgument -SourcePlanText \(\[string\]\$FixPlanTexts\[' -and $ParallelText -match 'plan_artifact_identity=\[string\]\$LaneState\.plan_revision\.final_artifact_identity') -Message 'parallel review-fix does not bind both revision inputs or each final revised identity'
  Assert-Test -Condition ($ParallelText.IndexOf('parallel-fix-plan-terv-review') -lt $ParallelText.IndexOf('review-fix-terv-review-utan-') -and $ParallelText.IndexOf('review-fix-terv-review-utan-') -lt $ParallelText.IndexOf('implement-')) -Message 'parallel review-fix lifecycle order drifted'
  Assert-Test -Condition ($ParallelText -notmatch 'source_fix_plan_path\) -Raw[\s\S]{0,300}Command ''implement''') -Message 'parallel still permits direct original fix-plan implementation'
  Assert-Test -Condition ($SerialText -match 'PinnedImplementationArtifactPath = \$ImplementationPath' -and $SerialText -match 'PinnedImplementationCandidate = \$ImplementedCandidate') -Message 'standalone review-fix keeps only a late child Candidate check'
  Assert-Test -Condition ($ParallelText -match 'Write-ParallelReviewFixPinnedImplementationManifest' -and $ParallelText -match 'PinnedImplementationManifestPath') -Message 'parallel review-fix keeps only late per-lane Candidate checks'

  "REVIEW_FIX_WRAPPER_TESTS_OK positive_assertions=$script:PositiveAssertionCount negative_assertions=$script:NegativeAssertionCount successful_wrapper_invocations=4"
}
finally {
  if (Test-Path -LiteralPath $TestRoot) { Remove-Item -LiteralPath $TestRoot -Recurse -Force }
}
