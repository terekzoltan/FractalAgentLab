param(
  [Parameter(Mandatory=$true)]
  [string]$RunId,

  [string]$RouterDir = ".opencode-router",

  [switch]$Json
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: legacy parallel runs are historical and non-resumable.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

function Get-ParallelRunStateFile {
  param(
    [string]$RouterDir,
    [string]$RunId
  )

  $RunRoot = Join-Path $RouterDir "parallel-runs"
  $RunDir = Join-Path $RunRoot (Get-OCRouterSafeName -Value $RunId)
  $StatePath = Join-Path $RunDir "state.json"
  return [pscustomobject]@{
    run_dir = $RunDir
    state_path = $StatePath
  }
}

function Get-MissingArtifactWarnings {
  param(
    [string]$RunDir,
    [string[]]$Paths
  )

  $Warnings = New-Object System.Collections.Generic.List[string]
  foreach ($Path in $Paths) {
    if ([string]::IsNullOrWhiteSpace($Path)) {
      continue
    }

    $FullPath = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path $RunDir $Path }
    if (-not (Test-Path $FullPath)) {
      $Warnings.Add("Missing artifact: $FullPath")
    }
  }

  return @($Warnings)
}

function Get-PlanLaneStatus {
  param([object]$LaneState)

  if ([bool]$LaneState.sent_terv_review_utan) {
    return "handoff_sent"
  }
  if ([bool]$LaneState.plan_received) {
    return "plan_captured"
  }
  if ([bool]$LaneState.sent_seq_next) {
    return "waiting_for_plan"
  }
  return "pending_seq_next"
}

function Get-StepLaneStatus {
  param(
    [object]$LaneState,
    [bool]$WaitForTrackResponses
  )

  if ($WaitForTrackResponses -and [bool]$LaneState.track_response_received) {
    return "track_response_captured"
  }
  if ([bool]$LaneState.sent_step_review_utan) {
    return "handoff_sent"
  }
  if ([bool]$LaneState.implementation_received) {
    return "implementation_captured"
  }
  if ([bool]$LaneState.sent_implement) {
    return "waiting_for_implementation"
  }
  return "pending_implement"
}

$Resolved = Get-ParallelRunStateFile -RouterDir $RouterDir -RunId $RunId
if (-not (Test-Path $Resolved.state_path)) {
  throw "Parallel run state file not found: $($Resolved.state_path)"
}

$State = Get-Content $Resolved.state_path -Raw | ConvertFrom-Json
$Mode = [string]$State.mode
$ScriptsDir = $PSScriptRoot
$Summary = [ordered]@{
  run_id = $RunId
  run_dir = $Resolved.run_dir
  mode = $Mode
  created_at = [string]$State.created_at
  completed_at = [string]$State.completed_at
  resume_command = ""
  warnings = @()
  fal_reconcile_summary = ""
  child_fal_reconcile_summaries = @()
  fallback_state = $null
  lanes = @()
}

$FalSummaryPath = Join-Path $Resolved.run_dir "fal-parallel-reconcile-summary.json"
if (Test-Path $FalSummaryPath) {
  $Summary.fal_reconcile_summary = $FalSummaryPath
}

switch ($Mode) {
  "parallel-plan-review" {
    $Summary.resume_command = "powershell.exe -NoProfile -File `"$ScriptsDir\run-parallel-plan-review-flow.ps1`" -Resume -RunId `"$RunId`" -AutoApprove -AutoUseFirstStable"
    foreach ($LaneState in @($State.lanes)) {
      $SafeName = Get-OCRouterSafeName -Value ([string]$LaneState.track_key)
      $Warnings = Get-MissingArtifactWarnings -RunDir $Resolved.run_dir -Paths @(
        $(if ([bool]$LaneState.plan_received) { "01-$SafeName-plan.md" } else { "" }),
        $(if ([bool]$State.meta_plan_review_received) { "03-meta-combined-plan-review.md" } else { "" }),
        $(if ([bool]$LaneState.sent_terv_review_utan) { "04-$SafeName-terv-review-utan.md" } else { "" }),
        $(if (-not [string]::IsNullOrWhiteSpace($Summary.fal_reconcile_summary)) { "fal-sync-$SafeName-meta_plan_review_done.md" } else { "" })
      )
      $Summary.warnings += @($Warnings)
      $Summary.lanes += [pscustomobject]@{
        track_key = [string]$LaneState.track_key
        target = [string]$LaneState.target
        status = Get-PlanLaneStatus -LaneState $LaneState
        fal_marker = "fal-sync-$SafeName-meta_plan_review_done.md"
      }
    }
  }
  "parallel-step-review" {
    $Summary.resume_command = "powershell.exe -NoProfile -File `"$ScriptsDir\run-parallel-step-review-flow.ps1`" -Resume -RunId `"$RunId`" -AutoApprove -AutoUseFirstStable"
    $WaitForTrackResponses = [bool]$State.wait_for_track_responses
    foreach ($LaneState in @($State.lanes)) {
      $SafeName = Get-OCRouterSafeName -Value ([string]$LaneState.track_key)
      $FalStage = if ([int]$State.review_cycle_index -gt 0) { "review_fix_done" } else { "step_review_done" }
      $Warnings = Get-MissingArtifactWarnings -RunDir $Resolved.run_dir -Paths @(
        $(if ([bool]$LaneState.implementation_received) { "01-$SafeName-implementation.md" } else { "" }),
        $(if ([bool]$State.meta_phase1_received) { "03-meta-phase1.md" } else { "" }),
        $(if ([bool]$State.swarm_review_received) { "05-swarm-review.md" } else { "" }),
        $(if ([bool]$State.meta_final_received) { "06-meta-final-synthesis.md" } else { "" }),
        $(if ([bool]$LaneState.sent_step_review_utan) { "07-$SafeName-step-review-utan.md" } else { "" }),
        $(if ([bool]$LaneState.track_response_received) { "08-$SafeName-track-response.md" } else { "" }),
        $(if (-not [string]::IsNullOrWhiteSpace($Summary.fal_reconcile_summary)) { "fal-sync-$SafeName-$FalStage.md" } else { "" })
      )
      $Summary.warnings += @($Warnings)
      $Summary.lanes += [pscustomobject]@{
        track_key = [string]$LaneState.track_key
        target = [string]$LaneState.target
        status = Get-StepLaneStatus -LaneState $LaneState -WaitForTrackResponses $WaitForTrackResponses
        response_mode = [string]$LaneState.track_response_mode
        fal_marker = "fal-sync-$SafeName-$FalStage.md"
      }
    }
  }
  "parallel-review-fix-cycle" {
    $StepReviewRunId = [string]$State.step_review_run_id
    $StepRunDir = Join-Path (Join-Path $RouterDir "parallel-runs") (Get-OCRouterSafeName -Value $StepReviewRunId)
    $StepStatePath = Join-Path $StepRunDir "state.json"
    $StepFalSummaryPath = Join-Path $StepRunDir "fal-parallel-reconcile-summary.json"
    $ResumeStage = if (Test-Path $StepStatePath) { "step" } else { "auto" }
    $Summary.resume_command = "powershell.exe -NoProfile -File `"$ScriptsDir\run-parallel-review-fix-cycle.ps1`" -Resume -RunId `"$RunId`" -ResumeStage $ResumeStage -AutoApprove -AutoUseFirstStable"
    $Summary.warnings += @(Get-MissingArtifactWarnings -RunDir $Resolved.run_dir -Paths @(
      $(if ([string]::IsNullOrWhiteSpace($StepReviewRunId)) { "" } else { $StepStatePath })
    ))
    foreach ($ChildSummary in @(
      [pscustomobject]@{ stage = "step"; path = $StepFalSummaryPath }
    )) {
      if (Test-Path $ChildSummary.path) {
        $Summary.child_fal_reconcile_summaries += $ChildSummary
      }
      elseif (Test-Path (Split-Path $ChildSummary.path -Parent)) {
        $Summary.warnings += "Missing child FAL summary for $($ChildSummary.stage): $($ChildSummary.path)"
      }
    }

    $FallbackStatePath = [string]$State.fallback_state_path
    if ([string]::IsNullOrWhiteSpace($FallbackStatePath)) {
      $FallbackStatePath = Join-Path $Resolved.run_dir "fal-single-lane-fallback-state.json"
    }
    if (Test-Path $FallbackStatePath) {
      $FallbackState = Get-Content $FallbackStatePath -Raw | ConvertFrom-Json
      $Summary.fallback_state = $FallbackState
      $Expected = $FallbackState.expected_child_evidence
      foreach ($PropertyName in @("state_path", "final_synthesis")) {
        if ($null -ne $Expected.PSObject.Properties[$PropertyName]) {
          $ExpectedPath = [string]$Expected.$PropertyName
          if (-not [string]::IsNullOrWhiteSpace($ExpectedPath) -and -not (Test-Path $ExpectedPath)) {
            $Summary.warnings += "Missing single-lane fallback child evidence ($PropertyName): $ExpectedPath"
          }
        }
      }
    }
    elseif ([string]$State.fallback_mode -eq "single_lane_serial") {
      $Summary.warnings += "Missing single-lane fallback state: $FallbackStatePath"
    }

    foreach ($LaneSpec in @($State.base_lanes)) {
      $Summary.lanes += [pscustomobject]@{
        lane = [string]$LaneSpec
        status = if ([string]::IsNullOrWhiteSpace([string]$State.completed_at)) { "resume_needed" } else { "completed" }
      }
    }
  }
  default {
    throw "Unsupported parallel run mode '$Mode' in $($Resolved.state_path)"
  }
}

if ($Json) {
  $Summary | ConvertTo-Json -Depth 10
  exit 0
}

Write-Host "=== Parallel Run Inspect ===" -ForegroundColor Cyan
Write-Host "Run ID:         $($Summary.run_id)"
Write-Host "Run dir:        $($Summary.run_dir)"
Write-Host "Mode:           $($Summary.mode)"
Write-Host "Created:        $($Summary.created_at)"
Write-Host "Completed:      $(if ([string]::IsNullOrWhiteSpace($Summary.completed_at)) { '<not completed>' } else { $Summary.completed_at })"
Write-Host "Resume command: $($Summary.resume_command)"
Write-Host "FAL summary:    $(if ([string]::IsNullOrWhiteSpace($Summary.fal_reconcile_summary)) { '<none>' } else { $Summary.fal_reconcile_summary })"
if (@($Summary.child_fal_reconcile_summaries).Count -gt 0) {
  Write-Host "Child FAL summaries:"
  foreach ($ChildSummary in @($Summary.child_fal_reconcile_summaries)) {
    Write-Host "- $($ChildSummary.stage): $($ChildSummary.path)"
  }
}
if ($null -ne $Summary.fallback_state) {
  Write-Host "Fallback mode:  $($Summary.fallback_state.fallback_mode)"
  Write-Host "Fallback status:$($Summary.fallback_state.status)"
  Write-Host "Child run id:   $($Summary.fallback_state.child_run_id)"
  Write-Host "Child command:  $($Summary.fallback_state.child_command)"
  if ($null -ne $Summary.fallback_state.expected_child_evidence) {
    Write-Host "Expected child evidence:"
    foreach ($Property in @($Summary.fallback_state.expected_child_evidence.PSObject.Properties)) {
      Write-Host "- $($Property.Name): $($Property.Value)"
    }
  }
}
Write-Host ""
Write-Host "Lane status:" -ForegroundColor Cyan
foreach ($Lane in @($Summary.lanes)) {
  if ($null -ne $Lane.PSObject.Properties["track_key"]) {
    Write-Host "- $($Lane.track_key) -> $($Lane.target) status=$($Lane.status)$(if ($null -ne $Lane.PSObject.Properties['response_mode'] -and -not [string]::IsNullOrWhiteSpace([string]$Lane.response_mode)) { " response_mode=$($Lane.response_mode)" } else { '' })$(if ($null -ne $Lane.PSObject.Properties['fal_marker']) { " fal_marker=$($Lane.fal_marker)" } else { '' })"
  }
  else {
    Write-Host "- $($Lane.lane) status=$($Lane.status)"
  }
}

if (@($Summary.warnings).Count -gt 0) {
  Write-Host ""
  Write-Host "Warnings:" -ForegroundColor Yellow
  foreach ($Warning in @($Summary.warnings | Sort-Object -Unique)) {
    Write-Host "- $Warning"
  }
}

[pscustomobject]$Summary
