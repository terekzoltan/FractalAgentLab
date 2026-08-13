param(
  [string]$ProfilePath = (Join-Path $PSScriptRoot "..\config\model-profiles.json")
)

$ErrorActionPreference = "Stop"
$BriefingPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'docs/review-model-routing-briefing.md'
$Briefing = [IO.File]::ReadAllText($BriefingPath)
if (-not $Briefing.Contains('SUPERSEDED / NON-OPERATIONAL')) { throw 'Native review briefing is not marked superseded.' }
Write-Output 'PASS: legacy external-review model profile is non-operational; Meta native review owns routing.'
exit 0
$Manifest = Get-Content -Path $ProfilePath -Raw | ConvertFrom-Json
$ExpectedRoles = @(
  "architect", "sme", "researcher", "docs", "docs_design", "designer",
  "critic_sounding_board", "critic_drift_verifier", "critic_hallucination_verifier",
  "critic_architecture_supervisor", "curator_init", "curator_phase",
  "curator_postmortem", "curator_consolidation", "council_generalist",
  "council_skeptic", "council_domain_expert", "skill_improver", "spec_writer",
  "reviewer", "critic", "critic_oversight", "explorer", "coder", "test_engineer"
)

$QualityRoles = @($Manifest.profiles.quality.agents.PSObject.Properties.Name)
if ($QualityRoles.Count -ne 25) {
  throw "Quality profile must define 25 roles; found $($QualityRoles.Count)."
}
foreach ($Role in $ExpectedRoles) {
  if ($Role -notin $QualityRoles) {
    throw "Quality profile is missing role '$Role'."
  }
}

if ([string]$Manifest.default_profile -ne "economy") {
  throw "The default profile must be economy so normal review roles use the active cost-aware routing policy."
}
foreach ($Role in @("reviewer", "critic", "critic_oversight")) {
  $BalancedRole = $Manifest.profiles.balanced.agents.PSObject.Properties[$Role].Value
  if ([string]$BalancedRole.model -ne "openai/gpt-5.6-terra" -or [string]$BalancedRole.variant -ne "xhigh" -or @($BalancedRole.fallback_models) -notcontains "openai/gpt-5.4-mini") {
    throw "Balanced profile must route '$Role' through Terra xhigh with a mini fallback."
  }
  $QualityRole = $Manifest.profiles.quality.agents.PSObject.Properties[$Role].Value
  $AuditRole = $Manifest.profiles.audit.agents.PSObject.Properties[$Role].Value
  if ([string]$QualityRole.model -ne "openai/gpt-5.6-sol" -or [string]$QualityRole.variant -ne "high") {
    throw "Quality escalation must retain Sol high for '$Role'."
  }
  $ExpectedAuditModel = if ($Role -eq "critic") { "openai/gpt-5.6-sol" } else { "openai/gpt-5.6-terra" }
  $ExpectedAuditVariant = if ($Role -eq "critic") { "high" } else { "xhigh" }
  if ([string]$AuditRole.model -ne $ExpectedAuditModel -or [string]$AuditRole.variant -ne $ExpectedAuditVariant) { throw "Audit routing mismatch for '$Role'." }
}
foreach ($LaneProperty in $Manifest.review_lanes.PSObject.Properties) {
  foreach ($RequiredField in @("agent", "fallback_agent", "audit_agent")) {
    if ($LaneProperty.Value.PSObject.Properties.Name -notcontains $RequiredField) {
      throw "Review lane '$($LaneProperty.Name)' is missing '$RequiredField'."
    }
  }
}

$ForbiddenModels = @("opencode/big-pickle", "opencode/gpt-5-nano", "openai/gpt-5.4-nano", "openai/gpt-5.4")
foreach ($ProfileProperty in $Manifest.profiles.PSObject.Properties) {
  $ProfileDefinition = $ProfileProperty.Value
  foreach ($AgentSetName in @("agents", "all_agents")) {
    if ($ProfileDefinition.PSObject.Properties.Name -notcontains $AgentSetName) { continue }
    $AgentSet = $ProfileDefinition.PSObject.Properties[$AgentSetName].Value
    $AgentProperties = if ($AgentSetName -eq "all_agents") { @([pscustomobject]@{ Name = "*"; Value = $AgentSet }) } else { @($AgentSet.PSObject.Properties) }
    foreach ($Property in $AgentProperties) {
      if ($Property.Value.model -in $ForbiddenModels) {
        throw "Forbidden primary model '$($Property.Value.model)' in profile '$($ProfileProperty.Name)' on role '$($Property.Name)'."
      }
      foreach ($Fallback in @($Property.Value.fallback_models)) {
        if ($Fallback -in $ForbiddenModels) {
          throw "Forbidden fallback '$Fallback' in profile '$($ProfileProperty.Name)' on role '$($Property.Name)'."
        }
      }
    }
  }
}

$ApplyToolPath = Join-Path $PSScriptRoot "set-review-model-profile.ps1"
function Assert-ApplyToolExitCode {
  param([string]$Override, [int]$ExpectedExitCode)
  $PreviousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $Output = & powershell.exe -NoProfile -File $ApplyToolPath -Profile quality -Scope Global -RoleModelOverride $Override 2>&1
    $ExitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }
  if ($ExitCode -ne $ExpectedExitCode) {
    throw "Profile apply tool exit mismatch for '$Override': expected $ExpectedExitCode, found $ExitCode. Output: $($Output -join ' ')"
  }
}

Assert-ApplyToolExitCode -Override "explorer=invalid/luna" -ExpectedExitCode 1
Assert-ApplyToolExitCode -Override "architect=openai/gpt-5.6-terra" -ExpectedExitCode 1
Assert-ApplyToolExitCode -Override "sme=openai/gpt-5.6-sol" -ExpectedExitCode 0

$ExpectedProfiles = @("quick", "focused", "standard", "high_risk", "deep", "wide", "audit", "custom")
foreach ($Name in $ExpectedProfiles) {
  if ($Manifest.review_profiles.PSObject.Properties.Name -notcontains $Name) {
    throw "Missing review profile '$Name'."
  }
}
if ([int]$Manifest.review_profiles.quick.lane_count -ne 0) { throw "quick must use 0 lanes." }
if ([int]$Manifest.review_profiles.standard.lane_count -ne 3) { throw "standard must use 3 lanes." }
if ([int]$Manifest.review_profiles.high_risk.lane_count -ne 4) { throw "high_risk must use 4 lanes." }
if ([int]$Manifest.review_profiles.deep.lane_count -ne 5) { throw "deep must use 5 lanes." }
if ([int]$Manifest.review_profiles.wide.lane_count -ne 7) { throw "wide must use 7 lanes." }

$RequiredLanes = @(
  "correctness_business_regression", "tests_evidence", "scope_acceptance_ownership",
  "security_safety", "architecture_contracts", "regression_edge_cases", "domain_specialist"
)
foreach ($Lane in $RequiredLanes) {
  if ($Manifest.review_lanes.PSObject.Properties.Name -notcontains $Lane) {
    throw "Missing review lane '$Lane'."
  }
}

$AppliedConfigs = @(
  @{ Path = (Join-Path $env:USERPROFILE ".config\opencode\opencode-swarm.json"); ExpectedCount = 25; IsGlobal = $true },
  @{ Path = "C:\EGYETEM\FUNSTUFF\FractalAgentLab\.opencode\opencode-swarm.json"; ExpectedCount = 6 },
  @{ Path = "C:\EGYETEM\FUNSTUFF\TriageCI\.opencode\opencode-swarm.json"; ExpectedCount = 7 },
  @{ Path = "C:\EGYETEM\FUNSTUFF\WorldSim\.opencode\opencode-swarm.json"; ExpectedCount = 5 },
  @{ Path = "C:\EGYETEM\FUNSTUFF\RingFall\.opencode\opencode-swarm.json"; ExpectedCount = 6 }
)
foreach ($Item in $AppliedConfigs) {
  if (-not (Test-Path $Item.Path)) { continue }
  $Bytes = [System.IO.File]::ReadAllBytes($Item.Path)
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 239 -and $Bytes[1] -eq 187 -and $Bytes[2] -eq 191) {
    throw "Applied config contains a UTF-8 BOM: $($Item.Path)"
  }
  $Applied = [System.Text.Encoding]::UTF8.GetString($Bytes) | ConvertFrom-Json
  if ($Applied.PSObject.Properties.Name -contains "agents") {
    throw "Applied config still uses deprecated top-level agents: $($Item.Path)"
  }
  $Count = @($Applied.swarms.default.agents.PSObject.Properties).Count
  if ($Count -ne [int]$Item.ExpectedCount) {
    throw "Applied config role count mismatch for $($Item.Path): expected $($Item.ExpectedCount), found $Count."
  }
  if ($Item.IsGlobal) {
    foreach ($Role in @("architect", "coder")) {
      $Assignment = $Applied.swarms.default.agents.PSObject.Properties[$Role].Value
      if ([string]$Assignment.model -ne "openai/gpt-5.6-sol" -or [string]$Assignment.variant -ne "high") {
        throw "Global main-session role '$Role' must remain on Sol high."
      }
    }
    foreach ($Role in @("critic", "critic_oversight")) {
      $Assignment = $Applied.swarms.default.agents.PSObject.Properties[$Role].Value
      if ([string]$Assignment.model -ne "openai/gpt-5.6-terra" -or [string]$Assignment.variant -ne "xhigh") {
        throw "Global normal-review role '$Role' must use Terra xhigh."
      }
    }
  }
}

$GlobalOpenCodeConfigPath = Join-Path $env:USERPROFILE ".config\opencode\opencode.json"
$GlobalOpenCodeConfig = Get-Content -Path $GlobalOpenCodeConfigPath -Raw | ConvertFrom-Json
$AllowedPrimaryModels = @("openai/gpt-5.6-sol", "openai/gpt-5.6-sol-pro")
$BuildAgent = $GlobalOpenCodeConfig.agent."build-xhigh"
$BuildEffort = if ($null -ne $BuildAgent.reasoningEffort) { [string]$BuildAgent.reasoningEffort } else { [string]$BuildAgent.options.reasoning.effort }
if ([string]$GlobalOpenCodeConfig.model -notin $AllowedPrimaryModels -or [string]$BuildAgent.model -notin $AllowedPrimaryModels -or $BuildEffort -notin @("high", "xhigh")) {
  throw "Global primary session defaults must remain on a GPT-5.6 Sol high/xhigh route."
}

$ExpectedReviewAgentFiles = @("review-correctness.md", "review-tests.md", "review-scope.md", "review-security.md", "review-architecture.md", "review-regression.md", "review-domain.md")
$GlobalAgentRoot = Join-Path $env:USERPROFILE ".config\opencode\agents"
foreach ($AgentFile in $ExpectedReviewAgentFiles) {
  $AgentPath = Join-Path $GlobalAgentRoot $AgentFile
  if (-not (Test-Path $AgentPath)) { throw "Missing global review agent: $AgentPath" }
  $AgentText = Get-Content -Path $AgentPath -Raw
  if ($AgentText -notmatch '(?m)^model: openai/gpt-5\.6-(luna|terra|sol)$') { throw "Global review agent model is invalid: $AgentPath" }
}

$TierAgentExpectations = @{
  "review-luna-medium.md" = "openai/gpt-5.6-luna"
  "review-luna-high.md" = "openai/gpt-5.6-luna"
  "review-terra-medium.md" = "openai/gpt-5.6-terra"
  "review-terra-high.md" = "openai/gpt-5.6-terra"
  "review-terra-xhigh.md" = "openai/gpt-5.6-terra"
  "review-sol-medium.md" = "openai/gpt-5.6-sol"
  "review-sol-high.md" = "openai/gpt-5.6-sol"
  "review-sol-pro.md" = "openai/gpt-5.6-sol"
}
foreach ($AgentFile in $TierAgentExpectations.Keys) {
  $AgentPath = Join-Path $GlobalAgentRoot $AgentFile
  if (-not (Test-Path $AgentPath)) { throw "Missing tier review agent: $AgentPath" }
  $AgentText = Get-Content -Path $AgentPath -Raw
  if ($AgentText -notmatch ("(?m)^model: " + [regex]::Escape($TierAgentExpectations[$AgentFile]) + "$")) { throw "Tier review agent model mismatch: $AgentPath" }
  if ($AgentText -notmatch '(?m)^\s*edit: deny$' -or $AgentText -notmatch '(?m)^\s*bash: deny$') { throw "Tier review agent must remain read-only: $AgentPath" }
}

$GlobalSwarmConfig = Get-Content -Path (Join-Path $env:USERPROFILE ".config\opencode\opencode-swarm.json") -Raw | ConvertFrom-Json
foreach ($SwarmId in @("default", "reviewbalanced", "reviewaudit")) {
  if ($GlobalSwarmConfig.swarms.PSObject.Properties.Name -notcontains $SwarmId) { throw "Missing review Swarm roster '$SwarmId'." }
}
if ([string]$GlobalSwarmConfig.swarms.default.agents.reviewer.model -ne "openai/gpt-5.6-terra") { throw "Economy default reviewer must be Terra-primary while Luna transport is suspended." }
if ([string]$GlobalSwarmConfig.swarms.default.agents.test_engineer.model -ne "openai/gpt-5.6-terra") { throw "Economy default test engineer must be Terra-primary while Luna transport is suspended." }
if ([string]$GlobalSwarmConfig.swarms.default.agents.sme.model -ne "openai/gpt-5.6-terra") { throw "Economy default SME must be Terra-primary while Luna transport is suspended." }
if ([string]$GlobalSwarmConfig.swarms.reviewbalanced.agents.reviewer.model -ne "openai/gpt-5.6-terra") { throw "Balanced reviewer must use Terra." }
if ([string]$GlobalSwarmConfig.swarms.reviewaudit.agents.critic.model -ne "openai/gpt-5.6-sol") { throw "Audit critic must use selective Sol escalation." }

Write-Host "PASS: model profile manifest and applied no-BOM swarms.default configs are valid." -ForegroundColor Green
