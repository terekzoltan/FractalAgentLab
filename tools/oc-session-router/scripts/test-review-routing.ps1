$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'oc-router-common.ps1')

$script:Assertions = 0
function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
  $script:Assertions += 1
}

function Assert-False {
  param([bool]$Condition, [string]$Message)
  Assert-True -Condition (-not $Condition) -Message $Message
}

function Assert-Throws {
  param([scriptblock]$Action, [string]$Message)
  $Thrown = $false
  try { & $Action }
  catch { $Thrown = $true }
  Assert-True -Condition $Thrown -Message $Message
}

function Join-ContractLines {
  param([string[]]$Lines)
  return $Lines -join "`n"
}

function New-FinalSynthesis {
  param(
    [string]$Target = 'WorldSim',
    [string]$Epic = 'W1-E1',
    [string]$Candidate = 'candidate-1',
    [string]$Lane = 'Track A / TRACK / track-a',
    [string]$Verdict = 'GREEN',
    [string]$Accepted = 'NONE',
    [string]$Rejected = 'NONE',
    [string]$Verification = 'PASS targeted checks',
    [string]$Delta = 'NONE',
    [string]$Disposition = 'ALLOWED'
  )
  return Join-ContractLines @(
    'FINAL STEP REVIEW SYNTHESIS',
    "Target: $Target",
    "Epic: $Epic",
    "Candidate: $Candidate",
    "Accountable Lane / class / profile: $Lane",
    'Reviewed scope: implementation and acceptance evidence',
    "Overall verdict: $Verdict",
    'Review routing: budget_policy=balanced; shape=STANDARD; assignments=A1/review-terra-high,A2/review-luna-high; omitted_domains=security-safety:not-triggered; escalation=NONE; limitations=bounded review',
    'Acceptance/evidence matrix: acceptance mapped to targeted checks',
    "Accepted findings: $Accepted",
    "Rejected/downgraded findings: $Rejected",
    "Verification result: $Verification",
    "Proposed closeout delta: $Delta",
    "Closeout disposition: $Disposition",
    'Commit status: DEFERRED_TO_CLOSEOUT',
    'Exact Delivery Lane action: invoke /step-review-utan with this exact synthesis'
  )
}

function New-TrackResponseEnvelope {
  param(
    [object[]]$Lanes,
    [hashtable]$Bodies,
    [string]$Command
  )
  $Blocks = foreach ($Lane in $Lanes) {
    Join-ContractLines @(
      '=== TRACK RESPONSE START ===',
      "TRACK: $($Lane.track_key)",
      "TARGET: $($Lane.target)",
      "EPIC: $($Lane.epic_id)",
      "ACCOUNTABLE LANE: $($Lane.accountable_lane)",
      "LANE CLASS / PROFILE: $($Lane.lane_class) / $($Lane.lane_profile)",
      'RELEVANT SHARED DEPENDENCY: none',
      "COMMAND: $Command",
      [string]$Bodies[$Lane.track_key],
      '=== TRACK RESPONSE END ==='
    )
  }
  return $Blocks -join "`n"
}

function New-TestMessage {
  param([string]$Id, [long]$Created, [string]$Text, [switch]$Textless)
  $Parts = if ($Textless) { @([pscustomobject]@{ type = 'tool'; tool = 'read' }) } else { @([pscustomobject]@{ type = 'text'; text = $Text }) }
  return [pscustomobject]@{
    info = [pscustomobject]@{ role = 'assistant'; id = $Id; time = [pscustomobject]@{ created = $Created } }
    parts = $Parts
  }
}

$Target = 'WorldSim'
$Epic = 'W1-E1'
$LaneValue = 'Track A / TRACK / track-a'
$LaneContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  accountable_lane = 'Track A'
  lane_class = 'TRACK'
  lane_profile = 'track-a'
}

# Transport bodies and parent-session safety.
$Model = ConvertTo-OCRouterModelObject -Model 'openai/gpt-5.6-sol'
Assert-True ($Model.providerID -ceq 'openai' -and $Model.modelID -ceq 'gpt-5.6-sol') 'Model parsing changed.'
$MessageBody = New-OCRouterMessageRequestBodyObject -Text 'GO' -Agent 'architect' -Model 'openai/gpt-5.6-sol'
Assert-True ($MessageBody.parts[0].type -ceq 'text' -and $MessageBody.agent -ceq 'architect') 'Message request body is wrong.'
$CommandBody = New-OCRouterCommandRequestBodyObject -Command '/step-review' -Arguments 'Target: WorldSim' -Model 'openai/gpt-5.6-sol'
Assert-True ($CommandBody.command -ceq 'step-review' -and $CommandBody.model -ceq 'openai/gpt-5.6-sol') 'Command request body is wrong.'
Assert-Throws { Assert-OCRouterParentSessionCommandSafe -Server 'http://unused' -Headers @{} -CommandName 'step-review-utan' -CommandEntries @([pscustomobject]@{ name = 'step-review-utan'; subtask = $true }) } 'subtask=true must block a continuity handoff.'
Assert-OCRouterParentSessionCommandSafe -Server 'http://unused' -Headers @{} -CommandName 'step-review-utan' -CommandEntries @([pscustomobject]@{ name = 'step-review-utan'; subtask = $false })
$script:Assertions += 1

# Canonical deep step-review receipts accept the one-character schema version.
$ApprovalPath = Join-Path ([IO.Path]::GetTempPath()) ('oc-router-owner-approval-' + [guid]::NewGuid().ToString('N') + '.md')
try {
  $ApprovalText = Join-ContractLines @(
    'OWNER REVIEW EXPANSION APPROVAL',
    'Approval version: 1',
    'Target: RingFall',
    'Epic: A4-A',
    'Candidate: candidate-1',
    'Review profile: deep',
    'Swarm depth: none',
    'Lanes: 5',
    'Cost envelope: meta_lanes=5;swarm_depth=none;swarm_passes=0',
    'Owner approval: APPROVED'
  )
  Set-Content -LiteralPath $ApprovalPath -Value $ApprovalText -Encoding UTF8
  Assert-True ((Get-OCRouterTopLevelFieldValue -Text $ApprovalText -Field 'Approval version') -ceq '1') 'One-character approval version was not parsed.'
  $Approval = Resolve-OCRouterOwnerApprovalRecord -Record $ApprovalPath -Target 'RingFall' -Epic 'A4-A' -Candidate 'candidate-1' -ReviewProfile 'deep' -SwarmDepth 'none' -LaneCount 5 -CostEnvelope 'meta_lanes=5;swarm_depth=none;swarm_passes=0'
  Assert-True ($Approval.version -eq 1 -and $Approval.lanes -eq 5 -and $Approval.swarm_depth -ceq 'none') 'Canonical deep approval receipt did not preserve its exact bindings.'
  Assert-Throws { Resolve-OCRouterOwnerApprovalRecord -Record $ApprovalPath -Target 'RingFall' -Epic 'A4-A' -Candidate 'candidate-1' -ReviewProfile 'deep' -SwarmDepth 'none' -LaneCount 4 -CostEnvelope 'meta_lanes=5;swarm_depth=none;swarm_passes=0' | Out-Null } 'Lane-count drift must invalidate an Owner approval receipt.'
  $BlankApproval = $ApprovalText -replace 'Approval version: 1', 'Approval version: '
  Set-Content -LiteralPath $ApprovalPath -Value $BlankApproval -Encoding UTF8
  Assert-Throws { Resolve-OCRouterOwnerApprovalRecord -Record $ApprovalPath -Target 'RingFall' -Epic 'A4-A' -Candidate 'candidate-1' -ReviewProfile 'deep' -SwarmDepth 'none' -LaneCount 5 -CostEnvelope 'meta_lanes=5;swarm_depth=none;swarm_passes=0' | Out-Null } 'Blank approval version must fail closed.'
}
finally {
  if (Test-Path -LiteralPath $ApprovalPath) { Remove-Item -LiteralPath $ApprovalPath -Force }
}

# Exact Track shorthand and explicit generic-lane ABI.
$ParsedLanes = @(ConvertTo-OCRouterLaneCollection -LaneSpecs @('track-a|WorldSim|W1-E1', 'track-b|RingFall|W2-E3') -Config $null)
Assert-True ($ParsedLanes.Count -eq 2 -and $ParsedLanes[0].target -ceq 'WorldSim' -and $ParsedLanes[0].epic_id -ceq 'W1-E1') 'Three-part lane ABI did not preserve Target and Epic.'
Assert-True ($ParsedLanes[0].lane_class -ceq 'TRACK') 'Ordinary Track lane class must be TRACK.'
$SpecialistLane = @(ConvertTo-OCRouterLaneCollection -LaneSpecs @('smr-analyst|WorldSim|EPIC|SMR Analysis|SPECIALIST_DELIVERY|worldsim-smr') -Config $null)
Assert-True ($SpecialistLane.Count -eq 1 -and $SpecialistLane[0].track_key -ceq 'smr-analyst' -and $SpecialistLane[0].target -ceq 'WorldSim' -and $SpecialistLane[0].epic_id -ceq 'EPIC' -and $SpecialistLane[0].accountable_lane -ceq 'SMR Analysis' -and $SpecialistLane[0].lane_class -ceq 'SPECIALIST_DELIVERY' -and $SpecialistLane[0].lane_profile -ceq 'worldsim-smr') 'Explicit generic-lane ABI did not preserve its exact six-field identity.'
$ProjectSessionConfig = [pscustomobject]@{ sessions = [pscustomobject][ordered]@{ 'simulation-delivery' = [pscustomobject]@{ sessionId='session-simulation'; title='Simulation Delivery Session' } } }
$ConfiguredSpecialist = @(ConvertTo-OCRouterLaneCollection -LaneSpecs @('simulation-delivery|WorldSim|EPIC-SIM|Simulation Delivery|SPECIALIST_DELIVERY|worldsim-simulation-delivery') -Config $ProjectSessionConfig)
Assert-True ($ConfiguredSpecialist.Count -eq 1 -and $ConfiguredSpecialist[0].track_key -ceq 'simulation-delivery' -and $ConfiguredSpecialist[0].role_label -ceq 'Simulation Delivery' -and $ConfiguredSpecialist[0].target -ceq 'WorldSim' -and $ConfiguredSpecialist[0].epic_id -ceq 'EPIC-SIM' -and $ConfiguredSpecialist[0].accountable_lane -ceq 'Simulation Delivery' -and $ConfiguredSpecialist[0].lane_class -ceq 'SPECIALIST_DELIVERY' -and $ConfiguredSpecialist[0].lane_profile -ceq 'worldsim-simulation-delivery' -and $ConfiguredSpecialist[0].session_entry.sessionId -ceq 'session-simulation') 'Project-defined configured specialist lane did not preserve exact identity/session binding.'
Assert-Throws { ConvertTo-OCRouterLaneCollection -LaneSpecs @('unknown-delivery|WorldSim|EPIC-SIM|Unknown Delivery|SPECIALIST_DELIVERY|worldsim-unknown') -Config $ProjectSessionConfig | Out-Null } 'Unknown project-defined configured session must fail closed.'
Assert-Throws { ConvertTo-OCRouterLaneCollection -LaneSpecs @('smr-analyst|WorldSim|EPIC') -Config $null | Out-Null } 'Three-field non-Track lane must fail closed.'
Assert-Throws { ConvertTo-OCRouterLaneCollection -LaneSpecs @('smr-analyst|WorldSim|EPIC|SMR Analysis|INVALID|worldsim-smr') -Config $null | Out-Null } 'Invalid explicit lane class must fail closed.'
Assert-Throws { ConvertTo-OCRouterLaneCollection -LaneSpecs @('track-a|W1-E1') -Config $null | Out-Null } 'Legacy two-part lane ABI must fail closed.'
Assert-Throws { ConvertTo-OCRouterLaneCollection -LaneSpecs @('track-a|WorldSim|') -Config $null | Out-Null } 'Blank Epic must fail closed.'

# /seq-next initial plan.
$TrackPlan = Join-ContractLines @(
  'EPIC IMPLEMENTATION PLAN',
  'Target: WorldSim',
  'Epic: W1-E1',
  'Wave: W1',
  "Accountable Lane / class / profile: $LaneValue",
  'Prerequisites/current state: repository inspected',
  'Scope/non-goals: routing only; no unrelated changes',
  'Interfaces/ownership: Track A owns implementation',
  'Feature -> User Story -> Task: Feature routing -> User Story safe handoff -> Task enforce identity',
  'Risks: stale candidate selection',
  'Ordered implementation plan: inspect then change then verify',
  'Acceptance -> verification -> evidence: exact binding -> tests -> artifact',
  'Handoffs/exact blockers: Meta review required',
  'Plan artifact: W1-E1.plan.v1',
  'Next route: /terv-review',
  'Readiness: READY'
)
Assert-True (Test-OCRouterExpectedOutputKind -Text $TrackPlan -ExpectedOutputKind 'track_plan' -ExpectedOutputContext $LaneContext) 'Exact initial Track plan must pass.'
Assert-True (Test-OCRouterOpaqueArtifactIdentity -Identity 'Plan.v1@lane-a:+~') 'Allowed opaque artifact identity grammar regressed.'
Assert-False (Test-OCRouterOpaqueArtifactIdentity -Identity 'plans/W1-E1.md') 'Slash-bearing path passed opaque artifact identity validation.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($TrackPlan -replace 'W1-E1.plan.v1','plans/W1-E1.md') -ExpectedOutputKind 'track_plan') 'Path-like initial Plan artifact classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($TrackPlan -replace 'W1-E1.plan.v1','W1-E1.plan.v1;path') -ExpectedOutputKind 'track_plan') 'Semicolon initial Plan artifact classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($TrackPlan -replace 'Plan artifact: W1-E1.plan.v1','Plan artifact: W1-E1.plan.v1 ') -ExpectedOutputKind 'track_plan') 'Trailing-whitespace initial Plan artifact classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($TrackPlan -replace 'Target: WorldSim', 'Target: RingFall') -ExpectedOutputKind 'track_plan' -ExpectedOutputContext $LaneContext) 'Wrong Target plan passed context binding.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($TrackPlan -replace 'Next route: /terv-review', 'Next route: /implement') -ExpectedOutputKind 'track_plan') 'Initial READY plan bypassed Meta review.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ("> " + ($TrackPlan -replace "`n", "`n> ")) -ExpectedOutputKind 'track_plan') 'Quoted plan template classified as output.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($TrackPlan + "`nExtra: prose") -ExpectedOutputKind 'track_plan') 'Plan with an extra line classified.'

# /terv-review and /terv-review-utan.
$MetaContext = [pscustomobject]@{
  target = $Target; epic = $Epic; accountable_lane = 'Track A'; lane_class = 'TRACK'; lane_profile = 'track-a'; plan_class = 'EPIC_PLAN'; plan_artifact = 'W1-E1.plan.v1'
}
$MetaReview = Join-ContractLines @(
  'META PLAN REVIEW',
  'Target: WorldSim',
  'Epic: W1-E1',
  'Plan class: EPIC_PLAN',
  'Plan artifact: W1-E1.plan.v1',
  "Accountable Lane / class / profile: $LaneValue",
  'Overall verdict: GREEN',
  'Blocking corrections: NONE',
  'Non-blocking improvements: keep evidence concise',
  'Ownership/dependency decision: Track A owns changes',
  'Acceptance/evidence decision: targeted checks required',
  'Exact Delivery Lane action: invoke /terv-review-utan with this review'
)
Assert-True (Test-OCRouterExpectedOutputKind -Text $MetaReview -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $MetaContext) 'Exact Meta plan review must pass.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($MetaReview -replace 'W1-E1.plan.v1', 'W1-E1.plan.other') -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $MetaContext) 'Wrong plan artifact passed Meta binding.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($MetaReview -replace 'Plan class: EPIC_PLAN', 'Plan class: REVIEW_FIX_PLAN') -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $MetaContext) 'Wrong expected Plan class passed Meta binding.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($MetaReview -replace "Plan class: EPIC_PLAN`n", '') -ExpectedOutputKind 'meta_plan_review') 'Meta review without Plan class classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($MetaReview -replace 'Plan class: EPIC_PLAN', 'Plan class: UNKNOWN') -ExpectedOutputKind 'meta_plan_review') 'Unknown Meta plan class classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($MetaReview -replace 'Overall verdict: GREEN', 'Overall verdict: GREEN | YELLOW | RED') -ExpectedOutputKind 'meta_plan_review') 'Verdict template classified as a Meta review.'

$RevisionArgument = New-OCRouterPlanRevisionArgument -SourcePlanText $TrackPlan -MetaReviewText $MetaReview
$RevisionPayload = New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $RevisionArgument | ConvertTo-Json -Depth 10
$ParsedRevisionPayload = $RevisionPayload | ConvertFrom-Json
Assert-True ([string]$ParsedRevisionPayload.command -ceq 'terv-review-utan') 'Plan-revision payload changed the command name.'
Assert-True ([regex]::Matches([string]$ParsedRevisionPayload.arguments, [regex]::Escape($TrackPlan)).Count -eq 1) 'Plan-revision payload did not preserve the exact pinned source plan exactly once.'
Assert-True ([regex]::Matches([string]$ParsedRevisionPayload.arguments, [regex]::Escape($MetaReview)).Count -eq 1) 'Plan-revision payload did not preserve the matching exact Meta review exactly once.'
Assert-True ([regex]::Matches([string]$ParsedRevisionPayload.arguments, [regex]::Escape('=== OC ROUTER PINNED SOURCE PLAN OR FIX-PLAN START ===')).Count -eq 1 -and [regex]::Matches([string]$ParsedRevisionPayload.arguments, [regex]::Escape('=== OC ROUTER MATCHING EXACT META REVIEW START ===')).Count -eq 1) 'Plan-revision payload markers are missing or duplicated.'
$ChangedSourceArgument = New-OCRouterPlanRevisionArgument -SourcePlanText ($TrackPlan -replace 'Risks: stale candidate selection', 'Risks: changed source') -MetaReviewText $MetaReview
$ChangedReviewArgument = New-OCRouterPlanRevisionArgument -SourcePlanText $TrackPlan -MetaReviewText ($MetaReview -replace 'Non-blocking improvements: keep evidence concise', 'Non-blocking improvements: changed review')
$RevisionArgumentHash = Get-OCRouterStringSha256 -Text $RevisionArgument
Assert-True ($RevisionArgumentHash -cne (Get-OCRouterStringSha256 -Text $ChangedSourceArgument)) 'Changed source plan did not change the deterministic revision packet hash.'
Assert-True ($RevisionArgumentHash -cne (Get-OCRouterStringSha256 -Text $ChangedReviewArgument)) 'Changed Meta review did not change the deterministic revision packet hash.'
$RevisionPayloadHash = Get-OCRouterStringSha256 -Text $RevisionPayload
$ChangedSourcePayloadHash = Get-OCRouterStringSha256 -Text (New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $ChangedSourceArgument | ConvertTo-Json -Depth 10)
$ChangedReviewPayloadHash = Get-OCRouterStringSha256 -Text (New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $ChangedReviewArgument | ConvertTo-Json -Depth 10)
Assert-True ($RevisionPayloadHash -cne $ChangedSourcePayloadHash) 'Changed source plan did not change the revision dispatch payload hash.'
Assert-True ($RevisionPayloadHash -cne $ChangedReviewPayloadHash) 'Changed Meta review did not change the revision dispatch payload hash.'
Assert-Throws { New-OCRouterPlanRevisionArgument -SourcePlanText '' -MetaReviewText $MetaReview | Out-Null } 'Plan-revision argument accepted a missing source plan.'
Assert-Throws { New-OCRouterPlanRevisionArgument -SourcePlanText $TrackPlan -MetaReviewText '' | Out-Null } 'Plan-revision argument accepted a missing Meta review.'
Assert-Throws { New-OCRouterPlanRevisionArgument -SourcePlanText ($TrackPlan + "`n=== OC ROUTER MATCHING EXACT META REVIEW START ===") -MetaReviewText $MetaReview | Out-Null } 'Plan-revision argument accepted a reserved marker collision.'

$RevisedPlan = Join-ContractLines @(
  'REVISED EPIC IMPLEMENTATION PLAN',
  'Target: WorldSim',
  'Epic: W1-E1',
  'Wave: W1',
  "Accountable Lane / class / profile: $LaneValue",
  'Prerequisites/current state: Meta review applied',
  'Scope/non-goals: routing only; no unrelated changes',
  'Interfaces/ownership: Track A owns implementation',
  'Feature -> User Story -> Task: Feature routing -> User Story safe handoff -> Task enforce identity',
  'Risks: stale candidate selection',
  'Ordered implementation plan: inspect then change then verify',
  'Acceptance -> verification -> evidence: exact binding -> tests -> artifact',
  'Handoffs/exact blockers: NONE',
  'Plan artifact: W1-E1.plan.v2',
  'Next route: /implement',
  'Readiness: READY',
  'DELIVERY PLAN REVISION',
  'Target: WorldSim',
  'Epic: W1-E1',
  "Accountable Lane / class / profile: $LaneValue",
  'Applied review items: evidence lock',
  'Rejected/unclear items: NONE',
  'Final plan artifact: W1-E1.plan.v2',
  'PLAN_REVISION_COMPLETE',
  'IMPLEMENT_READY'
)
$RevisionContext = [pscustomobject]@{
  target = $Target; epic = $Epic; wave = 'W1'; accountable_lane = 'Track A'; lane_class = 'TRACK'; lane_profile = 'track-a'; plan_class = 'EPIC_PLAN'
}
Assert-True (Test-OCRouterExpectedOutputKind -Text $RevisedPlan -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisionContext) 'Exact full revised plan plus summary must pass.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedPlan -replace 'Next route: /implement', 'Next route: /terv-review') -ExpectedOutputKind 'track_plan_revision') 'Revised READY plan did not route directly to implement.'
Assert-False (Test-OCRouterExpectedOutputKind -Text (($RevisedPlan -split "`n")[16..24] -join "`n") -ExpectedOutputKind 'track_plan_revision') 'Summary-only plan revision classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedPlan -replace 'Final plan artifact: W1-E1.plan.v2', 'Final plan artifact: W1-E1.plan.drift') -ExpectedOutputKind 'track_plan_revision') 'Revision artifact drift classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedPlan -replace 'W1-E1.plan.v2', 'W1-E1.plan.v2;path') -ExpectedOutputKind 'track_plan_revision') 'Semicolon-bearing composite revision identity classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedPlan -replace 'W1-E1.plan.v2', 'plans/W1-E1.md') -ExpectedOutputKind 'track_plan_revision') 'Path-like revision identity classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedPlan -replace 'Plan artifact: W1-E1.plan.v2', 'Plan artifact: W1-E1.plan.v2 ') -ExpectedOutputKind 'track_plan_revision') 'Trailing-whitespace revision identity classified.'

$ObservedDetailedRevision = $RevisedPlan `
  -replace 'Target: WorldSim', 'Target: WorldSim repository / local master' `
  -replace 'Track A / TRACK / track-a', '`Track A / TRACK / track-a`' `
  -replace 'Plan artifact: W1-E1.plan.v2', 'Plan artifact: Final identity plan-v1; canonical pointer plans/W1-E1-revised.md' `
  -replace 'Final plan artifact: W1-E1.plan.v2', 'Final plan artifact: plan-v1 -> plans/W1-E1-revised.md'
$ObservedDiagnostic = Get-OCRouterOutputContractDiagnostic -Text $ObservedDetailedRevision -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisionContext
Assert-False ([bool]$ObservedDiagnostic.matches_expected) 'Detailed non-canonical revision bypassed the strict contract.'
Assert-True (@($ObservedDiagnostic.reasons) -contains 'plan_artifact_or_exact_envelope_mismatch') 'Detailed revision diagnostic did not identify its exact-envelope/artifact mismatch.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $ObservedDetailedRevision -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisionContext) 'A diagnostic-only candidate became routable.'

# /implement report.
$Implementation = Join-ContractLines @(
  'IMPLEMENTATION RESULT',
  'Target: WorldSim',
  'Epic: W1-E1',
  "Accountable Lane / class / profile: $LaneValue",
  'Plan/fix-plan identity: W1-E1.plan.v2',
  'Changed artifacts: src/router.ps1',
  'Explicit non-changes: no unrelated files',
  'Acceptance mapping: identity lock -> routing tests',
  'Checks/results: targeted tests PASS; TODO/FIXME/HACK/XXX/unimplemented search found no match',
  'Candidate identity/worktree limitations: candidate-1',
  'Diff self-review: PASS',
  'Unresolved risks/findings: NONE',
  'Exact route: Meta /step-review',
  'REVIEW_READY'
)
$ImplementationContext = [pscustomobject]@{ target=$Target; epic=$Epic; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a'; plan_artifact_identity='W1-E1.plan.v2' }
Assert-True (Test-OCRouterExpectedOutputKind -Text $Implementation -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $ImplementationContext) 'Exact implementation report must pass with the dispatched revised-plan identity.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Implementation -replace 'Epic: W1-E1', 'Epic: W9-E9') -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $LaneContext) 'Implementation with wrong Epic passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $Implementation -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext ([pscustomobject]@{ target=$Target; epic=$Epic; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a'; plan_artifact_identity='W1-E1.plan.v3' })) 'Implementation report passed a mismatched dispatched revised-plan identity.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Implementation -replace 'W1-E1.plan.v2', 'plans/W1-E1.md') -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $LaneContext) 'Implementation report accepted a path-like plan identity.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Implementation -replace 'Plan/fix-plan identity: W1-E1.plan.v2', 'Plan/fix-plan identity: W1-E1.plan.v2 ') -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $LaneContext) 'Implementation report accepted trailing whitespace in its plan identity.'
Assert-False (Test-OCRouterExpectedOutputKind -Text 'REVIEW_READY' -ExpectedOutputKind 'track_implementation_report') 'Bare implementation terminal classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Implementation -replace 'Checks/results: targeted tests PASS; TODO/FIXME/HACK/XXX/unimplemented search found no match', 'Checks/results: TODO') -ExpectedOutputKind 'track_implementation_report') 'Unresolved implementation TODO placeholder classified.'

# Historical Phase-1 and Swarm envelopes remain parser-only compatibility evidence.
$PhaseContext = [pscustomobject]@{
  target = $Target
  epic = $Epic
  candidate = 'candidate-1'
  evidence_pointers = 'track-a=artifacts/implementation.md#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  reviewed_scope_acceptance = 'routing=targeted checks'
  review_focus = 'correctness and evidence'
  review_profile = 'standard'
  internal_lanes = 'correctness_business_regression,tests_evidence,scope_acceptance_ownership'
  swarm_depth = 'bounded'
  cost_envelope = 'bounded-default'
  expansion_approval_path = ''
  expansion_approval_sha256 = ''
}
$SwarmPacket = Join-ContractLines @(
  'Target: WorldSim',
  'Epic: W1-E1',
  'Candidate: candidate-1',
  "Evidence pointers: $($PhaseContext.evidence_pointers)",
  "Reviewed scope/acceptance: $($PhaseContext.reviewed_scope_acceptance)",
  "Review focus: $($PhaseContext.review_focus)",
  'Review profile: standard',
  "Internal lanes: $($PhaseContext.internal_lanes)",
  'Swarm depth: bounded',
  'Cost envelope: bounded-default',
  'Expansion approval receipt: NONE'
)
$Phase1 = Join-ContractLines @('SWARM ASSISTANT PROMPT', '/swarm-review', $SwarmPacket, 'WAITING FOR GO')
Assert-True (Test-OCRouterExpectedOutputKind -Text $Phase1 -ExpectedOutputKind 'meta_step_review_phase1' -ExpectedOutputContext $PhaseContext) 'Exact Phase-1 Swarm packet must pass.'
Assert-True ((Get-OCRouterSwarmReviewPacket -Text $Phase1) -ceq $SwarmPacket) 'Swarm packet extraction changed content.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Phase1 -replace 'Candidate: candidate-1', 'Candidate: stale') -ExpectedOutputKind 'meta_step_review_phase1' -ExpectedOutputContext $PhaseContext) 'Wrong Phase-1 candidate passed.'

$SwarmFinding = '[{"id":"SW-1","severity":"Major","evidence":"src/router.ps1:10","impact":"wrong route","direction":"FIX","confidence":"HIGH","meta_suggestion":"accept for fix"}]'
$SwarmResult = Join-ContractLines @(
  'SWARM REVIEW RESULT',
  'Verdict: APPROVE WITH FIXES',
  'Acceptance authority: ADVISORY_ONLY_META_DECIDES',
  'Target: WorldSim',
  'Epic: W1-E1',
  'Candidate: candidate-1',
  "Reviewed scope: $($PhaseContext.reviewed_scope_acceptance)",
  "Findings: $SwarmFinding",
  'Coverage: routing and evidence',
  'Gates/evidence: targeted tests inspected',
  'Verification gaps/residual risk: bounded integration gap',
  'Evidence files: src/router.ps1',
  'Meta Coordinator triage packet: SW-1 requires decision'
)
$SwarmContext = [pscustomobject]@{ target = $Target; epic = $Epic; candidate = 'candidate-1'; reviewed_scope = $PhaseContext.reviewed_scope_acceptance }
Assert-True (Test-OCRouterExpectedOutputKind -Text $SwarmResult -ExpectedOutputKind 'swarm_review' -ExpectedOutputContext $SwarmContext) 'Exact Swarm result must pass.'
Assert-True ((@(Get-OCRouterSwarmFindingIds -Text $SwarmResult) -join ',') -ceq 'SW-1') 'Swarm finding IDs were not extracted.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($SwarmResult -replace '"id":"SW-1",', '"id":"SW-1","extra":"x",') -ExpectedOutputKind 'swarm_review') 'Swarm finding with an extra key classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($SwarmResult -replace 'Verdict: APPROVE WITH FIXES', 'Verdict: APPROVE|BLOCK') -ExpectedOutputKind 'swarm_review') 'Swarm verdict template classified.'

# Final synthesis semantics: accepted, rejected, downgraded, surfaced coverage.
$AcceptedFix = '[{"id":"SW-1","severity":"Major","resolution_state":"OPEN_FIX_REQUIRED","evidence":"src/router.ps1:10","owner":"Track A","route":"/implement","enforcing_gate":"fix-cycle","acceptance_authority":"NONE","reason":"route mismatch"}]'
$Rejected = '[{"id":"SW-2","disposition":"REJECTED","original_severity":"Minor","new_severity":"NONE","accepted_id":"NONE","evidence":"src/router.ps1:20","reason":"not reproducible"}]'
$FixFinal = New-FinalSynthesis -Verdict 'YELLOW' -Accepted $AcceptedFix -Rejected $Rejected -Verification 'PASS reproduced SW-1' -Disposition 'FIX_REQUIRED'
$FixFinalContext = [pscustomobject]@{
  target = $Target; epic = $Epic; candidate = 'candidate-1'; accountable_lane = 'Track A'; lane_class = 'TRACK'; lane_profile = 'track-a'; surfaced_finding_ids = @('SW-1', 'SW-2')
}
Assert-True (Test-OCRouterExpectedOutputKind -Text $FixFinal -ExpectedOutputKind 'meta_final_synthesis' -ExpectedOutputContext $FixFinalContext) 'Valid FIX_REQUIRED final synthesis must pass.'
Assert-True ((Get-OCRouterFinalSynthesisDisposition -Text $FixFinal) -ceq 'FIX_REQUIRED') 'Final disposition extraction failed.'
Assert-True ((@(Get-OCRouterFinalOpenFixFindingIds -Text $FixFinal) -join ',') -ceq 'SW-1') 'Open fix IDs extraction failed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $FixFinal -ExpectedOutputKind 'meta_final_synthesis' -ExpectedOutputContext ([pscustomobject]@{ target=$Target; epic=$Epic; candidate='candidate-1'; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a'; surfaced_finding_ids=@('SW-MISSING') })) 'A surfaced Swarm finding disappeared silently.'

$AcceptedDowngrade = '[{"id":"META-DOWN","severity":"Minor","resolution_state":"FIXED","evidence":"src/router.ps1:30","owner":"Track A","route":"/closeout-commit","enforcing_gate":"NONE","acceptance_authority":"NONE","reason":"bounded correction applied"}]'
$Downgrade = '[{"id":"SW-3","disposition":"DOWNGRADED","original_severity":"Major","new_severity":"Minor","accepted_id":"META-DOWN","evidence":"src/router.ps1:30","reason":"impact bounded"}]'
$DowngradedFinal = New-FinalSynthesis -Accepted $AcceptedDowngrade -Rejected $Downgrade -Verification 'PASS correction verified'
Assert-True (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $DowngradedFinal -Context ([pscustomobject]@{ surfaced_finding_ids = @('SW-3') })) 'Linked severity downgrade must pass.'
Assert-False (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text ($DowngradedFinal -replace '"new_severity":"Minor"', '"new_severity":"Major"')) 'Non-lowering downgrade classified.'
$MetaExtra = '[{"id":"SW-1","severity":"Major","resolution_state":"FIXED","evidence":"src/router.ps1:10","owner":"Track A","route":"/closeout-commit","enforcing_gate":"NONE","acceptance_authority":"NONE","reason":"fixed"},{"id":"META-1","severity":"Minor","resolution_state":"FIXED","evidence":"src/router.ps1:11","owner":"Track A","route":"/closeout-commit","enforcing_gate":"NONE","acceptance_authority":"NONE","reason":"Meta discovered"}]'
$AllowedWithExtra = New-FinalSynthesis -Accepted $MetaExtra -Verification 'PASS all checks'
Assert-True (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $AllowedWithExtra -Context ([pscustomobject]@{ surfaced_finding_ids = @('SW-1') })) 'Meta-only findings must be allowed in addition to complete Swarm coverage.'
Assert-False (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text (New-FinalSynthesis -Verdict 'RED')) 'RED cannot permit closeout.'
Assert-False (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text (New-FinalSynthesis -Delta '[{"path":"../state.md","field":"status","value":"done"}]')) 'Unsafe closeout delta path classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ("> " + ($AllowedWithExtra -replace "`n", "`n> ")) -ExpectedOutputKind 'meta_final_synthesis') 'Quoted final synthesis classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($AllowedWithExtra -replace '; shape=STANDARD;', '; extra_key=unsafe; shape=STANDARD;') -ExpectedOutputKind 'meta_final_synthesis') 'Unknown final-synthesis routing key classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($AllowedWithExtra -replace 'budget_policy=balanced; shape=STANDARD', 'shape=STANDARD; budget_policy=balanced') -ExpectedOutputKind 'meta_final_synthesis') 'Reordered final-synthesis routing fields classified.'

# Parallel envelopes bind metadata, per-lane artifact/candidate, and surfaced union.
$EnvelopeLanes = @(
  [pscustomobject]@{ track_key='track-a'; target='WorldSim'; epic_id='W1-E1'; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a'; candidate_identity='candidate-a'; plan_class='EPIC_PLAN'; plan_artifact='W1-E1.plan.v1' },
  [pscustomobject]@{ track_key='track-b'; target='RingFall'; epic_id='W2-E2'; accountable_lane='Track B'; lane_class='TRACK'; lane_profile='track-b'; candidate_identity='candidate-b'; plan_class='EPIC_PLAN'; plan_artifact='W2-E2.plan.v1' }
)
$MetaBodies = @{
  'track-a' = $MetaReview
  'track-b' = ($MetaReview -replace 'Target: WorldSim', 'Target: RingFall' -replace 'Epic: W1-E1', 'Epic: W2-E2' -replace 'Track A / TRACK / track-a', 'Track B / TRACK / track-b' -replace 'W1-E1.plan.v1', 'W2-E2.plan.v1')
}
$PlanEnvelope = New-TrackResponseEnvelope -Lanes $EnvelopeLanes -Bodies $MetaBodies -Command 'terv-review-utan'
Assert-True (Test-OCRouterParallelTrackResponseEnvelope -Text $PlanEnvelope -Lanes $EnvelopeLanes -ExpectedCommand 'terv-review-utan' -ExpectedBodyKind 'meta_plan_review') 'Valid parallel Meta plan envelope must pass.'
Assert-False (Test-OCRouterParallelTrackResponseEnvelope -Text ($PlanEnvelope -replace 'TARGET: WorldSim', 'TARGET: Other') -Lanes $EnvelopeLanes -ExpectedCommand 'terv-review-utan' -ExpectedBodyKind 'meta_plan_review') 'Wrong envelope Target classified.'

$FinalBodies = @{
  'track-a' = (New-FinalSynthesis -Candidate 'candidate-a' -Accepted $MetaExtra -Verification 'PASS all checks')
  'track-b' = (New-FinalSynthesis -Target 'RingFall' -Epic 'W2-E2' -Candidate 'candidate-b' -Lane 'Track B / TRACK / track-b')
}
$FinalEnvelope = New-TrackResponseEnvelope -Lanes $EnvelopeLanes -Bodies $FinalBodies -Command 'step-review-utan'
Assert-True (Test-OCRouterParallelTrackResponseEnvelope -Text $FinalEnvelope -Lanes $EnvelopeLanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds @('SW-1')) 'Parallel final envelope must cover the surfaced finding union.'
Assert-False (Test-OCRouterParallelTrackResponseEnvelope -Text $FinalEnvelope -Lanes $EnvelopeLanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds @('SW-MISSING')) 'Parallel final envelope lost a surfaced finding.'
Assert-False (Test-OCRouterParallelTrackResponseEnvelope -Text ($FinalEnvelope -replace 'Candidate: candidate-a', 'Candidate: stale-a') -Lanes $EnvelopeLanes -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis') 'Wrong per-lane Candidate classified.'

# Delivery response is disposition-driven, never color-driven.
$FixPlan = Join-ContractLines @(
  'FIX_PLAN_REQUIRED',
  'Target: WorldSim',
  'Epic: W1-E1',
  'Candidate: candidate-1',
  "Accountable Lane / class / profile: $LaneValue",
  'Accepted finding IDs: ["SW-1"]',
  'Allowed surfaces: src/router.ps1',
  'Forbidden surfaces: unrelated files',
  'Finding -> change -> acceptance/check: SW-1 -> correct route -> targeted test',
  'Dependencies: NONE',
  'Fix-plan artifact: W1-E1.fix.v1',
  'FIX_PLAN_READY_FOR_IMPLEMENT'
)
$DeliveryBase = [ordered]@{ target=$Target; epic=$Epic; candidate='candidate-1'; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a' }
$FixContext = [pscustomobject]($DeliveryBase + [ordered]@{ closeout_disposition='FIX_REQUIRED'; accepted_finding_ids=@('SW-1') })
$AllowedContext = [pscustomobject]($DeliveryBase + [ordered]@{ closeout_disposition='ALLOWED'; accepted_finding_ids=@() })
$BlockedContext = [pscustomobject]($DeliveryBase + [ordered]@{ closeout_disposition='BLOCKED'; accepted_finding_ids=@() })
Assert-True (Test-OCRouterExpectedOutputKind -Text $FixPlan -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $FixContext) 'Exact FIX response must pass FIX_REQUIRED routing.'
Assert-False (Test-OCRouterExpectedOutputKind -Text 'ACK_ONLY' -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $FixContext) 'ACK bypassed FIX_REQUIRED.'
Assert-True (Test-OCRouterExpectedOutputKind -Text 'ACK_ONLY' -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $AllowedContext) 'ACK must pass ALLOWED routing.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $FixPlan -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $AllowedContext) 'FIX plan bypassed ALLOWED ACK.'
Assert-True (Test-OCRouterExpectedOutputKind -Text "UNCLEAR`nAuthority gate owner must decide before closeout." -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $BlockedContext) 'BLOCKED must accept accountable UNCLEAR.'
Assert-False (Test-OCRouterExpectedOutputKind -Text "UNCLEAR`nSomething happened." -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $BlockedContext) 'Unaccountable UNCLEAR classified for BLOCKED.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($FixPlan -replace '\["SW-1"\]', '["SW-2"]') -ExpectedOutputKind 'delivery_step_response' -ExpectedOutputContext $FixContext) 'Wrong accepted finding set classified.'

# A bounded fix plan has the same single review/revision lifecycle as an Epic plan.
$FixMetaContext = [pscustomobject]@{
  target=$Target;epic=$Epic;accountable_lane='Track A';lane_class='TRACK';lane_profile='track-a';plan_class='REVIEW_FIX_PLAN';plan_artifact='W1-E1.fix.v1'
}
$FixMetaReview = $MetaReview -replace 'Plan class: EPIC_PLAN','Plan class: REVIEW_FIX_PLAN' -replace 'W1-E1.plan.v1','W1-E1.fix.v1'
Assert-True (Test-OCRouterExpectedOutputKind -Text $FixMetaReview -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $FixMetaContext) 'Canonical REVIEW_FIX_PLAN Meta review must pass.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $FixMetaReview -ExpectedOutputKind 'meta_plan_review' -ExpectedOutputContext $MetaContext) 'REVIEW_FIX_PLAN Meta review passed EPIC_PLAN context.'
$RevisedFixPlan = Join-ContractLines @(
  'REVISED REVIEW-FIX PLAN',
  'Target: WorldSim',
  'Epic: W1-E1',
  'Candidate: candidate-1',
  "Accountable Lane / class / profile: $LaneValue",
  'Accepted finding IDs: ["SW-1"]',
  'Allowed surfaces: src/router.ps1',
  'Forbidden surfaces: unrelated files',
  'Finding -> change -> acceptance/check: SW-1 -> correct route -> targeted test',
  'Dependencies: NONE',
  'Fix-plan artifact: W1-E1.fix.v2',
  'Next route: /implement',
  'Readiness: READY',
  'FIX_PLAN_READY_FOR_IMPLEMENT',
  'DELIVERY PLAN REVISION',
  'Target: WorldSim',
  'Epic: W1-E1',
  "Accountable Lane / class / profile: $LaneValue",
  'Applied review items: SW-1 evidence lock',
  'Rejected/unclear items: NONE',
  'Final plan artifact: W1-E1.fix.v2',
  'PLAN_REVISION_COMPLETE',
  'IMPLEMENT_READY'
)
$RevisedFixContext = [pscustomobject]@{
  target=$Target;epic=$Epic;candidate='candidate-1';accountable_lane='Track A';lane_class='TRACK';lane_profile='track-a';plan_class='REVIEW_FIX_PLAN';accepted_finding_ids=@('SW-1')
}
Assert-True (Test-OCRouterExpectedOutputKind -Text $RevisedFixPlan -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisedFixContext) 'Canonical revised review-fix plan must pass.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $FixPlan -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisedFixContext) 'Original unreviewed fix plan bypassed revision prerequisites.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $RevisedFixPlan -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisionContext) 'Revised review-fix plan passed EPIC_PLAN context.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace 'Candidate: candidate-1','Candidate: candidate-drift') -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisedFixContext) 'Revised review-fix candidate drift passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace '\["SW-1"\]','["SW-2"]') -ExpectedOutputKind 'track_plan_revision' -ExpectedOutputContext $RevisedFixContext) 'Revised review-fix finding drift passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace 'Final plan artifact: W1-E1.fix.v2','Final plan artifact: W1-E1.fix.v3') -ExpectedOutputKind 'track_plan_revision') 'Revised review-fix identity repetition drift passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace 'W1-E1.fix.v2','fix/W1-E1.v2') -ExpectedOutputKind 'track_plan_revision') 'Path-like revised fix identity passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace 'W1-E1.fix.v2','W1-E1.fix.v2;path') -ExpectedOutputKind 'track_plan_revision') 'Semicolon revised fix identity passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace 'Fix-plan artifact: W1-E1.fix.v2','Fix-plan artifact: W1-E1.fix.v2 ') -ExpectedOutputKind 'track_plan_revision') 'Trailing-whitespace revised fix identity passed.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($RevisedFixPlan -replace 'Candidate: candidate-1','Candidate: <candidate>') -ExpectedOutputKind 'track_plan_revision') 'Unresolved angle-bracket placeholder passed revised fix classification.'

# Closeout receipt binds candidate, staged paths, verification tree, commit, and ALLOWED+ACK proof.
$Tree = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
$Commit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
$Closeout = Join-ContractLines @(
  'CLOSEOUT + COMMIT RESULT',
  'Target: WorldSim',
  'Epic: W1-E1',
  "Accountable Lane / class / profile: $LaneValue",
  'workflow_verdict: COMPLETE',
  'domain_verdict: ACCEPTED',
  'routing_verdict: CLOSED',
  'next_role_action: NONE',
  'State/Combined/findings/evidence reconciliation: result=PASS; details=aligned',
  'Candidate identity: candidate-1',
  'Staged explicit paths: ["src/router.ps1"]',
  "Verification: result=PASS; candidate=candidate-1; committed_tree=$Tree; details=checks_pass",
  "Commit: sha=$Commit; tree=$Tree; message=workflow_done",
  'Push: NOT_PERFORMED'
)
$CloseoutContext = [pscustomobject]@{ target=$Target; epic=$Epic; candidate='candidate-1'; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a'; closeout_disposition='ALLOWED'; ack_proven=$true }
Assert-True (Test-OCRouterExpectedOutputKind -Text $Closeout -ExpectedOutputKind 'closeout_result' -ExpectedOutputContext $CloseoutContext) 'Exact closeout result must pass.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Closeout -replace 'Candidate identity: candidate-1', 'Candidate identity: stale') -ExpectedOutputKind 'closeout_result' -ExpectedOutputContext $CloseoutContext) 'Wrong closeout Candidate classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text ($Closeout -replace "committed_tree=$Tree", 'committed_tree=cccccccccccccccccccccccccccccccccccccccc') -ExpectedOutputKind 'closeout_result') 'Verification/commit tree drift classified.'
Assert-False (Test-OCRouterExpectedOutputKind -Text $Closeout -ExpectedOutputKind 'closeout_result' -ExpectedOutputContext ([pscustomobject]@{ target=$Target; epic=$Epic; candidate='candidate-1'; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a'; closeout_disposition='FIX_REQUIRED'; ack_proven=$false })) 'Closeout ran without ALLOWED+ACK proof.'
$WrappedCloseout = "Closeout completed.`n`n" + '```text' + "`n$Closeout`n" + '```'
Assert-False (Test-OCRouterExpectedOutputKind -Text $WrappedCloseout -ExpectedOutputKind 'closeout_result') 'Narrative/fenced closeout wrapper classified.'
$DelimitedCloseout = $Closeout -replace 'Candidate identity: candidate-1', 'Candidate identity: candidate-1;patch=abc' -replace 'candidate=candidate-1; committed_tree=', 'candidate=candidate-1;patch=abc; committed_tree='
Assert-False (Test-OCRouterExpectedOutputKind -Text $DelimitedCloseout -ExpectedOutputKind 'closeout_result') 'Semicolon-delimited closeout candidate identity classified.'

# Raw assistant baseline is authoritative even when the baseline has no text.
$OldFinal = New-TestMessage -Id 'old-final' -Created 1700000000000 -Text (New-FinalSynthesis)
$TextlessBaseline = New-TestMessage -Id 'raw-baseline' -Created 1800000000000 -Text '' -Textless
$NewFinal = New-TestMessage -Id 'new-final' -Created 1900000000000 -Text (New-FinalSynthesis)
$AfterBaseline = @(Get-OCRouterLatestOutputCandidates -Messages @($OldFinal, $TextlessBaseline, $NewFinal) -CandidateCount 3 -AssumeNewestFirst $false -ExpectedOutputKind 'meta_final_synthesis' -AfterMessageId 'raw-baseline')
Assert-True ($AfterBaseline.Count -eq 1 -and $AfterBaseline[0].MessageId -ceq 'new-final') 'Historical final leaked across the raw baseline.'
$NothingAfter = @(Get-OCRouterLatestOutputCandidates -Messages @($OldFinal, $TextlessBaseline) -CandidateCount 3 -AssumeNewestFirst $false -ExpectedOutputKind 'meta_final_synthesis' -AfterMessageId 'raw-baseline')
Assert-True ($NothingAfter.Count -eq 0) 'Textless raw baseline allowed stale fallback.'

# Risk-adaptive review controls remain evolvable and bounded.
$Standard = Resolve-OCRouterReviewControls
Assert-True ($Standard.review_transport -ceq 'native' -and $Standard.review_profile -ceq 'standard' -and [int]$Standard.meta_internal_lanes -eq 3) 'Default native review profile drifted.'
$Quick = Resolve-OCRouterReviewControls -ReviewProfile 'quick' -ExplicitReviewProfile $true
Assert-True ($Quick.review_transport -ceq 'native' -and $Quick.skip_swarm_review -and [int]$Quick.meta_internal_lanes -eq 0) 'Quick profile must remain Meta-only native review.'
$Deep = Resolve-OCRouterReviewControls -ReviewProfile 'deep' -ExplicitReviewProfile $true
Assert-True ($Deep.budget_policy -ceq 'quality_first' -and [int]$Deep.assignment_cap -eq 5) 'AWC 3.1 deep review must remain within the normal quality-first cap.'
Assert-Throws { Resolve-OCRouterReviewControls -ReviewProfile 'standard' -ExplicitReviewProfile $true -ExpandedReviewApproved $true | Out-Null } 'ExpandedReviewApproved without a pinned exact Owner envelope must fail closed.'
Assert-Throws { Resolve-OCRouterReviewControls -ExplicitUseSwarmReview $true | Out-Null } 'Retired Swarm transport must fail closed.'
Assert-Throws { Resolve-OCRouterReviewLanes -LaneCount 1 -RequestedReviewLanes @('unknown_lane') | Out-Null } 'Unknown typed lane must fail.'

# Atomic overwrite, artifact pins, durable dispatch intent, and delivery receipt.
$RuntimeDir = Join-Path $PSScriptRoot ('.test-review-routing-' + [guid]::NewGuid().ToString('N'))
$ResolvedRuntime = [IO.Path]::GetFullPath($RuntimeDir)
$ResolvedScripts = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not $ResolvedRuntime.StartsWith($ResolvedScripts, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test runtime path.' }
New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
try {
  $AtomicPath = Join-Path $RuntimeDir 'state.json'
  Write-OCRouterAtomicTextFile -Path $AtomicPath -Text 'one'
  Write-OCRouterAtomicTextFile -Path $AtomicPath -Text 'two'
  Assert-True ((Get-Content -LiteralPath $AtomicPath -Raw).Trim() -ceq 'two') 'Atomic overwrite did not replace content.'
  Assert-True (@(Get-ChildItem -LiteralPath $RuntimeDir -Force | Where-Object { $_.Name -match '\.(?:tmp|bak|t|b)\.[0-9a-f]+$' }).Count -eq 0) 'Atomic overwrite left temp/backup debris.'

  $ArtifactPath = Join-Path $RuntimeDir 'artifact.md'
  Write-OCRouterAtomicTextFile -Path $ArtifactPath -Text $TrackPlan
  $Pin = New-OCRouterArtifactPin -Path $ArtifactPath -ProducerMessageId 'message-plan-1' -Stage 'track_plan' -CandidateIdentity 'id:message-plan-1' -ExpectedOutputKind 'track_plan'
  Assert-OCRouterArtifactPin -Pin $Pin | Out-Null
  $script:Assertions += 1
  Write-OCRouterAtomicTextFile -Path $ArtifactPath -Text ($TrackPlan -replace 'Risks: stale candidate selection', 'Risks: changed after pin')
  Assert-Throws { Assert-OCRouterArtifactPin -Pin $Pin | Out-Null } 'Artifact hash drift did not fail.'
  Write-OCRouterAtomicTextFile -Path $ArtifactPath -Text $TrackPlan

  # A pinned review-fix handoff must bypass a newer session candidate before any review dispatch can be built.
  $SerialStepPath = Join-Path $PSScriptRoot 'run-step-review-flow.ps1'
  $SerialStepTokens = $null
  $SerialStepErrors = $null
  $SerialStepAst = [Management.Automation.Language.Parser]::ParseFile($SerialStepPath, [ref]$SerialStepTokens, [ref]$SerialStepErrors)
  foreach ($FunctionName in @('Resolve-FlowPinnedImplementationHandoff','Select-FlowImplementationSource')) {
    $FunctionAst = $SerialStepAst.Find({ param($Node) $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -ceq $FunctionName }, $true)
    Assert-True ($null -ne $FunctionAst -and @($SerialStepErrors).Count -eq 0) "Serial step-review pinned handoff function '$FunctionName' is missing or unparsable."
    . ([scriptblock]::Create($FunctionAst.Extent.Text))
  }
  $PinnedImplementationPath = Join-Path $RuntimeDir 'pinned-implementation.md'
  Write-OCRouterAtomicTextFile -Path $PinnedImplementationPath -Text $Implementation
  $PinnedImplementationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $PinnedImplementationPath).Hash
  $PinnedHandoff = Resolve-FlowPinnedImplementationHandoff -ArtifactPath $PinnedImplementationPath -ArtifactSha256 $PinnedImplementationHash -ProducerMessageId 'implementation-message-1' -Candidate 'candidate-1' -ExpectedContext $LaneContext
  $NewerImplementation = $Implementation -replace 'candidate-1', 'candidate-2'
  Assert-True (Test-OCRouterExpectedOutputKind -Text $NewerImplementation -ExpectedOutputKind 'track_implementation_report' -ExpectedOutputContext $LaneContext) 'Newer same-lane fixture is not a valid competing implementation report.'
  $script:LateCandidateResolverCalled = $false
  $SelectedPinnedSource = Select-FlowImplementationSource -PinnedHandoff $PinnedHandoff -LatestCandidateResolver {
    $script:LateCandidateResolverCalled = $true
    [pscustomobject]@{ MessageId='newer-message-2';Text=$NewerImplementation;TextLength=$NewerImplementation.Length }
  }
  Assert-True (-not $script:LateCandidateResolverCalled -and [string]$SelectedPinnedSource.source -ceq 'pinned_handoff' -and [string]$SelectedPinnedSource.text -ceq [string]$PinnedHandoff.text) 'Pinned handoff allowed the newer different-Candidate session output to be selected.'
  Assert-Throws { Resolve-FlowPinnedImplementationHandoff -ArtifactPath $PinnedImplementationPath -ArtifactSha256 $PinnedImplementationHash -ProducerMessageId 'implementation-message-1' -Candidate 'candidate-2' -ExpectedContext $LaneContext | Out-Null } 'Pinned handoff accepted a different Candidate before dispatch.'

  $FalIdentity = New-OCRouterFalCheckpointIdentity `
    -TargetProjectId 'test-project' `
    -TargetRepoKind 'non_git' `
    -TargetRepoRoot $RuntimeDir `
    -TargetWorktree $RuntimeDir `
    -TargetHead 'NOT_APPLICABLE' `
    -TargetRef 'NOT_APPLICABLE' `
    -TargetStatus 'unversioned' `
    -Wave 'W1' `
    -Epic $Epic `
    -Stage 'plan_revision_delivery_response' `
    -Candidate 'candidate-1' `
    -AccountableLaneId 'Track A' `
    -AccountableLaneClass 'TRACK' `
    -AccountableLaneProfile 'track-a' `
    -LogicalSender 'track-a' `
    -LogicalRecipient 'track-a' `
    -SourceSession 'track-a' `
    -ArtifactIdentity ([string]$Pin.candidate_identity) `
    -ArtifactPath $ArtifactPath `
    -ArtifactHash ([string]$Pin.sha256) `
    -ArtifactProducer ([string]$Pin.producer_message_id) `
    -ControlRoot $RuntimeDir `
    -SyncMode 'dry_run'
  Assert-OCRouterFalCheckpointIdentity -Identity $FalIdentity | Out-Null
  $script:Assertions += 1
  Assert-Throws {
    New-OCRouterFalCheckpointIdentity -TargetProjectId 'test-project' -TargetRepoKind 'non_git' -TargetRepoRoot $RuntimeDir -TargetWorktree $RuntimeDir -TargetHead 'NOT_APPLICABLE' -TargetRef 'NOT_APPLICABLE' -TargetStatus 'unversioned' -Wave 'W1' -Epic $Epic -Stage 'plan_revision_delivery_response' -Candidate 'candidate-1' -AccountableLaneId 'Track A' -AccountableLaneClass 'TRACK' -AccountableLaneProfile 'track-a' -LogicalSender 'track-a' -LogicalRecipient 'track-a' -SourceSession 'track-a' -ArtifactIdentity ([string]$Pin.candidate_identity) -ArtifactPath $ArtifactPath -ArtifactHash ('0' * 64) -ArtifactProducer ([string]$Pin.producer_message_id) -ControlRoot $RuntimeDir -SyncMode 'dry_run' | Out-Null
  } 'FAL identity accepted a drifted artifact hash.'

  $Payload = (New-OCRouterCommandRequestBodyObject -Command 'terv-review-utan' -Arguments $RevisionArgument | ConvertTo-Json -Depth 10)
  $Intent = Start-OCRouterDispatchIntent -RunDir $RuntimeDir -Transition 'meta-to-track' -Recipient 'track-a' -Kind command -Operation 'terv-review-utan' -Payload $Payload -BaselineIdentity 'id:raw-before' -CandidateIdentity 'id:meta-review' -Stage 'plan_revision'
  Assert-True ([bool]$Intent.should_send -and [string]$Intent.intent.status -ceq 'pending') 'First durable intent was not pending.'
  Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId 'transport-1' -TransportStatus 'accepted' | Out-Null
  $Replay = Start-OCRouterDispatchIntent -RunDir $RuntimeDir -Transition 'meta-to-track' -Recipient 'track-a' -Kind command -Operation 'terv-review-utan' -Payload $Payload -BaselineIdentity 'id:raw-before' -CandidateIdentity 'id:meta-review' -Stage 'plan_revision'
  Assert-False ([bool]$Replay.should_send) 'Completed durable intent allowed duplicate send.'
  Assert-Throws { Start-OCRouterDispatchIntent -RunDir $RuntimeDir -Transition 'meta-to-track' -Recipient 'track-a' -Kind command -Operation 'terv-review-utan' -Payload ($Payload + 'drift') -BaselineIdentity 'id:raw-before' -CandidateIdentity 'id:meta-review' -Stage 'plan_revision' | Out-Null } 'Durable intent payload drift did not fail.'

  $UncertainIntent = Start-OCRouterDispatchIntent -RunDir $RuntimeDir -Transition 'uncertain-post' -Recipient 'track-b' -Kind command -Operation 'implement' -Payload 'empty-arguments' -BaselineIdentity 'id:raw-before-uncertain' -CandidateIdentity 'packet-sha256:test' -Stage 'implementation_requested'
  Set-OCRouterDispatchIntentUncertain -Path $UncertainIntent.path -Reason 'simulated POST timeout' | Out-Null
  $UncertainRecord = Get-Content -LiteralPath $UncertainIntent.path -Raw | ConvertFrom-Json
  Assert-True ([string]$UncertainRecord.status -ceq 'pending' -and [string]$UncertainRecord.transport_status -ceq 'uncertain') 'POST timeout did not preserve a pending delivery-uncertain intent.'
  Assert-Throws { Start-OCRouterDispatchIntent -RunDir $RuntimeDir -Transition 'uncertain-post' -Recipient 'track-b' -Kind command -Operation 'implement' -Payload 'empty-arguments' -BaselineIdentity 'id:raw-before-uncertain' -CandidateIdentity 'packet-sha256:test' -Stage 'implementation_requested' | Out-Null } 'Pending delivery-uncertain intent allowed automatic resend.'

  Assert-True ((Get-OCRouterPostTimeoutExpectedOutputKind -Stage 'implementation_requested') -ceq 'track_implementation_report') 'Implementation POST timeout does not route to strict terminal reconciliation.'
  Assert-True ([string]::IsNullOrWhiteSpace((Get-OCRouterPostTimeoutExpectedOutputKind -Stage 'step_review_done'))) 'Unspecified stages must remain delivery-uncertain instead of guessing a terminal contract.'
  $ImplementationResponseContext = Get-OCRouterImplementationResponseContextFromPlan -Text $RevisedPlan
  Assert-True ($null -ne $ImplementationResponseContext -and [string]$ImplementationResponseContext.target -ceq $Target -and [string]$ImplementationResponseContext.epic -ceq $Epic -and [string]$ImplementationResponseContext.plan_artifact_identity -ceq 'W1-E1.plan.v2') 'Reviewed plan did not produce an exact implementation-response context.'
  Assert-True ($null -eq (Get-OCRouterImplementationResponseContextFromPlan -Text ($RevisedPlan -replace 'IMPLEMENT_READY$', 'IMPLEMENT_BLOCKED'))) 'Blocked revision produced implementation-response authority.'

  $PacketHash = 'A' * 64
  $FirstPacketRun = Resolve-OCRouterPacketRunDir -RouterDir $RuntimeDir -PacketHash $PacketHash
  $PacketIntent = Start-OCRouterDispatchIntent -RunDir $FirstPacketRun -Transition 'route-packet' -Recipient 'track-b' -Kind command -Operation 'implement' -Payload 'reviewed-plan' -BaselineIdentity 'id:packet-baseline' -CandidateIdentity "packet-sha256:$PacketHash" -Stage 'implementation_requested'
  Set-OCRouterDispatchIntentUncertain -Path $PacketIntent.path -Reason 'simulated timeout' | Out-Null
  $SamePacketRun = Resolve-OCRouterPacketRunDir -RouterDir $RuntimeDir -PacketHash $PacketHash
  Assert-True ([IO.Path]::GetFullPath($SamePacketRun) -ceq [IO.Path]::GetFullPath($FirstPacketRun)) 'Identical packet bytes did not resolve to the existing uncertain intent directory.'
  Assert-Throws { Start-OCRouterDispatchIntent -RunDir $SamePacketRun -Transition 'route-packet' -Recipient 'track-b' -Kind command -Operation 'implement' -Payload 'reviewed-plan' -BaselineIdentity 'id:packet-baseline' -CandidateIdentity "packet-sha256:$PacketHash" -Stage 'implementation_requested' | Out-Null } 'Identical renamed packet bypassed the pending no-resend intent.'

  $ResponsePath = Join-Path $RuntimeDir 'revision.md'
  Write-OCRouterAtomicTextFile -Path $ResponsePath -Text $RevisedPlan
  $ReceiptPath = Write-OCRouterArtifactDeliveryReceipt -RunDir $RuntimeDir -Name 'plan-revision' -ArtifactPath $ArtifactPath -ProducerSession 'track-a' -Command 'terv-review-utan' -Target $Target -Recipient 'track-a' -DeliveryProven $true -ResponseClass 'IMPLEMENT_READY' -ResponseArtifactPath $ResponsePath -ResponseMessageId 'revision-message-1' -DispatchIntentPath $Intent.path -FalCheckpointIdentity $FalIdentity
  Assert-OCRouterArtifactDeliveryReceipt -ReceiptPath $ReceiptPath -ArtifactPath $ArtifactPath -ProducerSession 'track-a' -Command 'terv-review-utan' -Target $Target -Recipient 'track-a' -ResponseClass 'IMPLEMENT_READY' -ResponseArtifactPath $ResponsePath -ResponseMessageId 'revision-message-1' -DispatchIntentPath $Intent.path -FalCheckpointIdentity $FalIdentity | Out-Null
  $script:Assertions += 1
  $Proposal = Write-OCRouterFalCheckpointTargetProposal -RunDir $RuntimeDir -Name 'plan-revision' -ProjectName 'Test Project' -Target $Target -CheckpointIdentity $FalIdentity -ReceiptPath $ReceiptPath -DeliveryResponseClass 'IMPLEMENT_READY'
  Assert-OCRouterFalCheckpointTargetProposal -ProposalPath $Proposal.path -CheckpointIdentity $FalIdentity -ProjectName 'Test Project' -Target $Target -ReceiptPath $ReceiptPath -DeliveryResponseClass 'IMPLEMENT_READY' | Out-Null
  $script:Assertions += 1

  # Exercise the staged parallel-step checkpoint producer itself without running transport orchestration.
  $ParallelStepPath = Join-Path $PSScriptRoot 'run-parallel-step-review-flow.ps1'
  $ParallelStepTokens = $null
  $ParallelStepErrors = $null
  $ParallelStepAst = [Management.Automation.Language.Parser]::ParseFile($ParallelStepPath, [ref]$ParallelStepTokens, [ref]$ParallelStepErrors)
  $CheckpointFunctionAst = $ParallelStepAst.Find({ param($Node) $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -ceq 'Publish-ParallelStepFalCheckpointProposal' }, $true)
  Assert-True ($null -ne $CheckpointFunctionAst -and @($ParallelStepErrors).Count -eq 0) 'Parallel-step FAL checkpoint producer function is missing or unparsable.'
  . ([scriptblock]::Create($CheckpointFunctionAst.Extent.Text))

  $ParallelFinalPath = Join-Path $RuntimeDir 'parallel-final.md'
  Write-OCRouterAtomicTextFile -Path $ParallelFinalPath -Text (New-FinalSynthesis)
  $ParallelFinalPin = New-OCRouterArtifactPin -Path $ParallelFinalPath -ProducerMessageId 'meta-final-message-1' -Stage 'parallel_meta_final_synthesis' -CandidateIdentity 'id:meta-final-message-1'
  $ParallelResponsePath = Join-Path $RuntimeDir 'parallel-track-response.md'
  Write-OCRouterAtomicTextFile -Path $ParallelResponsePath -Text 'ACK_ONLY'
  $ParallelIntent = Start-OCRouterDispatchIntent -RunDir $RuntimeDir -Transition 'step-review-utan-track-a' -Recipient 'track-a' -Kind command -Operation 'step-review-utan' -Payload 'parallel-final' -BaselineIdentity 'id:track-baseline' -CandidateIdentity 'candidate-1' -Stage 'parallel_delivery_response_dispatch'
  Complete-OCRouterDispatchIntent -Path $ParallelIntent.path -ReturnedId 'parallel-response-transport-1' -TransportStatus 'accepted' | Out-Null
  $ParallelLane = [pscustomobject]@{ track_key='track-a'; safe_name='track-a'; target='WorldSim'; epic_id='W1-E1'; candidate_identity='candidate-1'; accountable_lane='Track A'; lane_class='TRACK'; lane_profile='track-a' }
  $ParallelLaneState = [pscustomobject]@{ track_response_mode='ACK_ONLY'; track_response_message_id='parallel-response-message-1'; delivery_receipt_path=''; fal_checkpoint_identity=$null; fal_checkpoint_identity_sha256=''; fal_checkpoint_operation_path=''; fal_checkpoint_operation_sha256='' }
  $ParallelCheckpoint = Publish-ParallelStepFalCheckpointProposal -RunDir $RuntimeDir -LaneItem $ParallelLane -LaneState $ParallelLaneState -FinalArtifactPath $ParallelFinalPath -FinalArtifactPin $ParallelFinalPin -ResponseArtifactPath $ParallelResponsePath -DispatchIntentPath $ParallelIntent.path -Meta 'meta' -Wave 'W1' -Stage 'step_review_delivery_response' -ProjectId 'test-project' -ProjectName 'Test Project' -TargetRepoKind 'non_git' -TargetRepoRoot $RuntimeDir -TargetWorktree $RuntimeDir -TargetHead 'NOT_APPLICABLE' -TargetRef 'NOT_APPLICABLE' -TargetStatus 'unversioned' -ControlRoot $RuntimeDir
  Assert-OCRouterFalCheckpointTargetProposal -ProposalPath $ParallelCheckpoint.proposal_path -CheckpointIdentity $ParallelLaneState.fal_checkpoint_identity -ProjectName 'Test Project' -Target 'WorldSim' -ReceiptPath $ParallelCheckpoint.receipt_path -DeliveryResponseClass 'ACK_ONLY' | Out-Null
  $script:Assertions += 1
  $ParallelProposalDocument = Get-Content -LiteralPath $ParallelCheckpoint.proposal_path -Raw | ConvertFrom-Json
  Assert-True ([int]$ParallelProposalDocument.version -eq 2 -and [string]$ParallelProposalDocument.authority -ceq 'proposal_only' -and -not [bool]$ParallelProposalDocument.apply_authorized -and [string]$ParallelProposalDocument.checkpoint_identity.epic -ceq 'W1-E1' -and [string]$ParallelProposalDocument.checkpoint_identity.candidate -ceq 'candidate-1' -and [string]$ParallelProposalDocument.checkpoint_identity.accountable_lane.id -ceq 'Track A') 'Parallel-step checkpoint branch did not emit an exact proposal-only full-identity operation.'
  $DriftedParallelLane = $ParallelLane.PSObject.Copy()
  $DriftedParallelLane.candidate_identity = 'candidate-drift'
  Assert-Throws {
    Publish-ParallelStepFalCheckpointProposal -RunDir $RuntimeDir -LaneItem $DriftedParallelLane -LaneState $ParallelLaneState -FinalArtifactPath $ParallelFinalPath -FinalArtifactPin $ParallelFinalPin -ResponseArtifactPath $ParallelResponsePath -DispatchIntentPath $ParallelIntent.path -Meta 'meta' -Wave 'W1' -Stage 'step_review_delivery_response' -ProjectId 'test-project' -ProjectName 'Test Project' -TargetRepoKind 'non_git' -TargetRepoRoot $RuntimeDir -TargetWorktree $RuntimeDir -TargetHead 'NOT_APPLICABLE' -TargetRef 'NOT_APPLICABLE' -TargetStatus 'unversioned' -ControlRoot $RuntimeDir | Out-Null
  } 'Parallel-step checkpoint branch accepted Candidate identity drift.'
}
finally {
  if (Test-Path -LiteralPath $RuntimeDir) { Remove-Item -LiteralPath $RuntimeDir -Recurse -Force }
}

# Static migration invariants and parser health for all router entry points.
$Scripts = @(
  'oc-router-common.ps1', 'run-plan-review-flow.ps1', 'run-parallel-plan-review-flow.ps1',
  'run-step-review-flow.ps1', 'run-parallel-step-review-flow.ps1',
  'run-review-fix-cycle.ps1', 'run-parallel-review-fix-cycle.ps1',
  'wait-latest-output.ps1', 'read-latest-output.ps1', 'route-packet.ps1'
)
foreach ($Name in $Scripts) {
  $Path = Join-Path $PSScriptRoot $Name
  $Tokens = $null
  $Errors = $null
  [Management.Automation.Language.Parser]::ParseFile($Path, [ref]$Tokens, [ref]$Errors) | Out-Null
  Assert-True (@($Errors).Count -eq 0) "$Name has PowerShell parser errors."
}
$CommonText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'oc-router-common.ps1') -Raw
Assert-True ($CommonText -match '\[IO\.File\]::Replace\(\$TempPath, \$DestinationPath, \$BackupPath, \$true\)') 'Atomic replacement must use a concrete same-directory backup.'
Assert-False ($CommonText -match 'Invoke-OCRouterParallelFalSync|sync-fal-checkpoint') 'Common router still exposes or calls the retired inline FAL sync surface.'
Assert-True (@([regex]::Matches($CommonText, 'IsNullOrWhiteSpace\(\$ExpectedOutputKind\) -and \$Candidate\.TextLength -lt \$MinOutputChars')).Count -ge 2) 'Shared typed waits still reject strict terminal artifacts by text length.'
$SerialPlanText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'run-plan-review-flow.ps1') -Raw
Assert-True ($SerialPlanText -match 'Save-PlanFlowReconciliationRecord' -and $SerialPlanText -match "authority = 'diagnostic_only_no_resend_no_route'") 'Serial plan flow lacks a persisted diagnostic-only reconciliation receipt.'
Assert-True (@([regex]::Matches($SerialPlanText, '-PreviewOnly:\$PreviewOnly')).Count -ge 3) 'Serial plan flow does not propagate PreviewOnly through every dispatch.'
Assert-True ($SerialPlanText -match 'Preview-only /terv-review-utan completed; no revision wait or intent-path persistence was performed') 'Serial revision preview still resolves an absent dispatch-intent path.'
$StandaloneWaitText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'wait-latest-output.ps1') -Raw
Assert-True ($StandaloneWaitText -match 'BaselineIdentity must use the raw message-ID form' -and $StandaloneWaitText -match 'Min\(\$PollSeconds, \$RemainingSeconds\)' -and $StandaloneWaitText -match 'RequestTimeoutSeconds') 'Standalone wait lacks raw-ID recency or deadline-bounded GET protection.'
Assert-True (@([regex]::Matches($CommonText, 'Min\(\$PollSeconds, \$RemainingSeconds\)')).Count -ge 2 -and $CommonText -match 'RequestTimeoutSeconds') 'Shared serial/parallel waits can exceed their timeout budget during sleep or GET.'
Assert-True ($CommonText -match 'function Get-OCRouterLatestRawAssistantMessageFromUri[\s\S]+?RequestTimeoutSeconds = 30[\s\S]+?-TimeoutSec \$RequestTimeoutSeconds') 'Raw assistant baseline GET remains unbounded.'
$RoutePacketText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'route-packet.ps1') -Raw
Assert-True ($RoutePacketText -match 'Start-OCRouterDispatchIntent' -and $RoutePacketText -match 'Set-OCRouterDispatchIntentUncertain' -and $RoutePacketText -match '-TimeoutSec \$PostTimeoutSeconds') 'Route packet lacks bounded POST and durable delivery-uncertain handling.'
Assert-True ($RoutePacketText -match 'Get-OCRouterPostTimeoutExpectedOutputKind' -and $RoutePacketText -match 'accepted_transcript_reconciled' -and $RoutePacketText -match 'Wait-OCRouterNewOutput') 'Route packet does not reconcile an implementation POST timeout through a strict post-baseline terminal.'
Assert-True ($RoutePacketText -match 'Get-OCRouterImplementationResponseContextFromPlan' -and $RoutePacketText -match '-ExpectedOutputContext \$ExpectedResponseContext') 'Post-timeout implementation terminal is not bound to the exact reviewed plan context.'
Assert-True ($RoutePacketText -match 'Resolve-OCRouterPacketRunDir' -and $RoutePacketText -match 'if \(\$PostSucceeded\)') 'Packet identity deduplication or empty-success intent completion is missing.'
Assert-True ($RoutePacketText -match 'Enter-OCRouterRunLock -RunDir \$PacketRunDir' -and $RoutePacketText -match '-cnotin.*oldest_first.*newest_first' -and $RoutePacketText -match "message_order must be exactly oldest_first or newest_first") 'Packet dispatch is not exclusively locked or message ordering is not exact and fail-closed.'
Assert-True ($RoutePacketText -match 'lane_profile -cne \$TargetName' -and $RoutePacketText -match '\$ExpectedResponseContext = \$null') 'Specialist session/profile mismatch does not disable unsafe transcript-only reconciliation.'
Assert-True ($RoutePacketText -match 'Test-UnderPath -Path \$Resolved -Parent \$RootDir' -and $RoutePacketText -match 'Test-RouterPathHasReparsePoint' -and $RoutePacketText -match '\$RouterRoot = \(Resolve-Path' -and $RoutePacketText -match '\$ParentPrefix') 'Packet body containment, target-root binding, ancestor-reparse, or directory-boundary validation is missing.'
Assert-True (@([regex]::Matches($RoutePacketText, 'Packet bytes changed')).Count -eq 3) 'Packet bytes are not revalidated before claim, after lock acquisition, and before processed movement.'
Assert-True ($RoutePacketText -match '\$AllowTimeoutReconciliation -and' -and $RoutePacketText -match '\$InflightDir' -and $RoutePacketText -match 'Inflight packet claim hash mismatch') 'Timeout reconciliation lacks an explicit context gate or atomic inflight packet claim.'
Assert-True ($RoutePacketText -match '\$PacketBytes = \[IO\.File\]::ReadAllBytes' -and $RoutePacketText -match 'Get-RouterBytesSha256 -Bytes \$PacketBytes' -and $RoutePacketText -match 'UTF8Encoding\(\$false, \$true\)' -and $RoutePacketText -match '0xFEFF') 'Packet parsing and identity are not derived from one BOM-compatible strict UTF-8 byte snapshot.'
Assert-True ($RoutePacketText.IndexOf('Complete-OCRouterDispatchIntent') -lt $RoutePacketText.IndexOf('Move-Item $ResolvedPacketPath')) 'Route packet moves a packet before proving dispatch completion.'
foreach ($RetiredStub in @('invoke-command-and-wait.ps1','sync-fal-checkpoint.ps1')) {
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $RetiredOutput = @(& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $RetiredStub) -Session legacy-track -Command implement -Target WorldSim -Candidate stale 2>&1)
    $RetiredExit = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }
  Assert-True ($RetiredExit -ne 0 -and (($RetiredOutput | Out-String) -match 'RETIRED_HELPER')) "$RetiredStub did not fail closed on legacy-looking arguments."
}
$ParallelPlanText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'run-parallel-plan-review-flow.ps1') -Raw
Assert-True ($ParallelPlanText -match 'New-OCRouterFalCheckpointIdentity') 'Parallel plan flow lacks the full FAL checkpoint identity.'
Assert-True ($ParallelPlanText -match '-FalCheckpointIdentity \$CheckpointIdentity') 'Parallel plan receipt is not bound to the FAL identity.'
Assert-True ($ParallelPlanText -match '-CheckpointIdentity \$CheckpointIdentity') 'Parallel plan proposal is not bound to the FAL identity.'
Assert-True ($ParallelPlanText -match "FalSyncApply is retired") 'Parallel plan flow must reject direct FAL apply authority.'
$ParallelStepText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'run-parallel-step-review-flow.ps1') -Raw
Assert-True ($ParallelStepText -match 'surfaced_finding_ids') 'Parallel step flow does not persist surfaced Swarm IDs.'
Assert-True ($ParallelStepText -match '-SurfacedFindingIds @\(\$ParallelFinalContext\.surfaced_finding_ids\)') 'Parallel final envelope does not enforce surfaced finding coverage.'
Assert-True ($ParallelStepText -match 'Parallel GO is forbidden before proven Swarm dispatch') 'Parallel step flow does not prove Swarm delivery before GO.'
Assert-True ($ParallelStepText -match 'candidate_identity') 'Parallel step flow does not persist per-lane candidate identity.'
Assert-True ($ParallelStepText -match '-FalCheckpointIdentity \$CheckpointIdentity') 'Parallel step receipt is not bound to the exact FAL checkpoint identity.'
Assert-True ($ParallelStepText -match '-CheckpointIdentity \$CheckpointIdentity') 'Parallel step proposal is not bound to the exact FAL checkpoint identity.'
Assert-False ($ParallelStepText -match 'Write-OCRouterFalCheckpointTargetProposal[^\r\n]*-ProjectId') 'Parallel step flow still calls the retired FAL proposal signature.'
Assert-False ($ParallelStepText -match 'Write-OCRouterFalCheckpointTargetProposal[^\r\n]*-TargetRepoPath') 'Parallel step flow still passes obsolete repository parameters directly to the proposal writer.'
Assert-True ($ParallelStepText -match '\$LaneSpecs \+= "\{0\}\|\{1\}\|\{2\}\|\{3\}\|\{4\}\|\{5\}"') 'Parallel step resume collapses explicit six-field lane identity.'
$SerialStepText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'run-step-review-flow.ps1') -Raw
Assert-True ($SerialStepText -match 'New-OCRouterFalCheckpointIdentity') 'Serial step flow lacks the full FAL checkpoint identity.'
Assert-True ($SerialStepText -match '-FalCheckpointIdentity \$CheckpointIdentity') 'Serial step receipt is not bound to the FAL identity.'
Assert-True ($SerialStepText -match '-CheckpointIdentity \$CheckpointIdentity') 'Serial step proposal is not bound to the FAL identity.'
Assert-False ($SerialStepText -match '-ProjectId \$FalProjectId') 'Serial step flow still calls the retired FAL proposal signature.'
Assert-True ($SerialStepText -match 'Wave is required when FalSyncCheckpoint is enabled') 'Serial step FAL identity may infer or omit Wave.'
Assert-True ($SerialStepText -match 'Select-FlowImplementationSource' -and $SerialStepText -match 'Using exact pinned implementation handoff') 'Serial step-review lacks the pre-dispatch pinned implementation selection path.'
Assert-True ($SerialStepText.LastIndexOf('$PinnedImplementationHandoff = Resolve-FlowPinnedImplementationHandoff') -lt $SerialStepText.IndexOf('$StepReviewArguments =') -and $SerialStepText.LastIndexOf('$PinnedImplementationHandoff = Resolve-FlowPinnedImplementationHandoff') -ge 0) 'Serial pinned handoff validation occurs only after review dispatch construction.'
Assert-True ($ParallelStepText -match 'Resolve-ParallelStepPinnedImplementationManifest' -and $ParallelStepText -match 'session-latest selection is disabled') 'Parallel step-review lacks exact pre-dispatch pinned manifest consumption.'
Assert-True ($ParallelStepText.LastIndexOf('$PinnedImplementationManifest = Resolve-ParallelStepPinnedImplementationManifest') -ge 0 -and $ParallelStepText.LastIndexOf('$PinnedImplementationManifest = Resolve-ParallelStepPinnedImplementationManifest') -lt $ParallelStepText.IndexOf('Invoke-ParallelCommand -LogicalName $Meta')) 'Parallel pinned manifest validation occurs only after a Meta review dispatch path.'
$SerialReviewFixText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'run-review-fix-cycle.ps1') -Raw
$ParallelReviewFixText = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'run-parallel-review-fix-cycle.ps1') -Raw
Assert-True ($SerialReviewFixText -match 'PinnedImplementationArtifactPath = \$ImplementationPath' -and $SerialReviewFixText -match 'PinnedImplementationCandidate = \$ImplementedCandidate') 'Standalone review-fix parent does not pass its exact implementation pin to serial step-review.'
Assert-True ($ParallelReviewFixText -match 'PinnedImplementationArtifactPath' -and $ParallelReviewFixText -match 'PinnedImplementationManifestPath') 'Parallel review-fix parent does not pass exact serial/parallel implementation handoffs.'

Write-Host "PASS: $script:Assertions strict router contract, identity, disposition, durability, and migration assertions." -ForegroundColor Green
