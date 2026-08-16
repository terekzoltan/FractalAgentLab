$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "session-context-status-core.ps1")

function Assert-Equal {
  param($Actual, $Expected, [string]$Message)

  if ($Actual -cne $Expected) {
    throw "$Message. Expected '$Expected', got '$Actual'."
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)

  if (-not $Condition) {
    throw $Message
  }
}

function New-AssistantMessage {
  param(
    [string]$Id,
    [int64]$Created,
    [int64]$InputTokens,
    [int64]$OutputTokens,
    [int64]$CacheReadTokens,
    [Nullable[int64]]$TotalTokens = $null
  )

  $Tokens = [ordered]@{
    input = $InputTokens
    output = $OutputTokens
    reasoning = 0
    cache = [ordered]@{ read = $CacheReadTokens; write = 0 }
  }
  if ($null -ne $TotalTokens) {
    $Tokens.total = $TotalTokens
  }

  return [pscustomobject]@{
    info = [pscustomobject]@{
      id = $Id
      role = "assistant"
      providerID = "openai"
      modelID = "gpt-5.6-sol"
      time = [pscustomobject]@{ created = $Created; completed = $Created + 1 }
      tokens = [pscustomobject]$Tokens
    }
    parts = @([pscustomobject]@{ type = "text"; text = "private-response-$Id" })
  }
}

$Messages = @(
  (New-AssistantMessage -Id "old" -Created 1000 -InputTokens 290000 -OutputTokens 10000 -CacheReadTokens 10000 -TotalTokens 310000),
  (New-AssistantMessage -Id "latest" -Created 2000 -InputTokens 260000 -OutputTokens 8000 -CacheReadTokens 7000 -TotalTokens 280000)
)
$Incomplete = New-AssistantMessage -Id "incomplete" -Created 3000 -InputTokens 0 -OutputTokens 0 -CacheReadTokens 0 -TotalTokens 0
$Incomplete.info.time.PSObject.Properties.Remove("completed")
$Messages += $Incomplete

$ActiveContext = @(
  [pscustomobject]@{ type = "user"; text = "private-user-content"; time = [pscustomobject]@{ created = 1500 } },
  [pscustomobject]@{ type = "assistant"; content = @([pscustomobject]@{ type = "text"; text = "private-active-content" }); time = [pscustomobject]@{ created = 2000 } }
)

$Providers = [pscustomobject]@{
  all = @(
    [pscustomobject]@{
      id = "openai"
      models = [pscustomobject]@{
        "gpt-5.6-sol" = [pscustomobject]@{
          id = "gpt-5.6-sol"
          providerID = "openai"
          limit = [pscustomobject]@{ context = 500000; input = 500000; output = 128000 }
        }
      }
    }
  )
}

$Report = New-OCRouterSessionContextReport `
  -LogicalName "meta" `
  -QueryScope "router_target" `
  -SessionState "idle" `
  -Messages $Messages `
  -ActiveContext $ActiveContext `
  -ProviderCatalog $Providers `
  -WarnRatio 0.5 `
  -CriticalRatio 0.62 `
  -PolicyIdentity "policy-fixture-v1" `
  -SessionStateSource "status_map_explicit"

Assert-Equal $Report.schema_version "session-context-status/v1" "Schema version must be stable"
Assert-Equal $Report.provider_observation.total_tokens 280000 "Only the latest completed assistant observation may drive pressure"
Assert-Equal $Report.pressure.state "warn" "280K of 500K must cross the 250K warning threshold"
Assert-Equal $Report.pressure.warn_tokens 250000 "Warn threshold must be 250K for a 500K model"
Assert-Equal $Report.pressure.critical_tokens 310000 "Critical threshold must be 310K for a 500K model"
Assert-Equal $Report.pressure.best_available_source "provider_observed_last_completion" "Provider observation must outrank the estimate"
Assert-Equal $Report.policy.identity "policy-fixture-v1" "Telemetry must record the effective policy identity"
Assert-Equal $Report.policy.warn_ratio 0.5 "Telemetry must record the effective warning ratio"
Assert-Equal $Report.policy.critical_ratio 0.62 "Telemetry must record the effective critical ratio"
Assert-Equal $Report.session.state_source "status_map_explicit" "Explicit status provenance must be recorded"
Assert-Equal $Report.capabilities.may_compact $false "Telemetry must never authorize compaction"

$Serialized = $Report | ConvertTo-Json -Depth 12
Assert-True (-not $Serialized.Contains("private-user-content")) "Report must not disclose user content"
Assert-True (-not $Serialized.Contains("private-active-content")) "Report must not disclose active context content"
Assert-True (-not $Serialized.Contains("private-response")) "Report must not disclose assistant content"

$FallbackMessages = @(
  (New-AssistantMessage -Id "fallback" -Created 3000 -InputTokens 330000 -OutputTokens 10000 -CacheReadTokens 12000)
)
$FallbackReport = New-OCRouterSessionContextReport `
  -QueryScope "router_explicit" `
  -SessionState "busy" `
  -Messages $FallbackMessages `
  -ActiveContext @() `
  -ProviderCatalog $Providers

Assert-Equal $FallbackReport.provider_observation.total_tokens 352000 "Missing total must use the OpenCode overflow fallback formula"
Assert-Equal $FallbackReport.provider_observation.total_source "computed_opencode_overflow_formula" "Fallback provenance must be explicit"
Assert-Equal $FallbackReport.pressure.state "critical" "352K of 500K must be critical"
Assert-Equal $FallbackReport.session.state "busy" "Busy status must be preserved"

$UnknownReport = New-OCRouterSessionContextReport `
  -QueryScope "router_explicit" `
  -SessionState "idle" `
  -Messages @() `
  -ActiveContext @() `
  -ProviderCatalog ([pscustomobject]@{ all = @() })

Assert-Equal $UnknownReport.pressure.state "unknown" "Missing telemetry must not create fake pressure"
Assert-Equal $UnknownReport.provider_observation.status "unavailable" "Missing provider observation must be explicit"

$CompactedContext = @(
  [pscustomobject]@{ type = "compaction"; reason = "manual"; summary = "private-summary"; time = [pscustomobject]@{ created = 4000 } },
  [pscustomobject]@{ type = "user"; text = ("x" * 1200); time = [pscustomobject]@{ created = 5000 } }
)
$EstimateOnlyReport = New-OCRouterSessionContextReport `
  -QueryScope "self" `
  -SessionState "idle" `
  -Messages @() `
  -ActiveContext $CompactedContext `
  -ProviderCatalog $Providers `
  -SessionModel ([pscustomobject]@{ providerID = "openai"; modelID = "gpt-5.6-sol" })

Assert-Equal $EstimateOnlyReport.pressure.best_available_source "derived_active_context_estimate" "Active estimate must be the bounded fallback when provider usage is absent"
Assert-True ($EstimateOnlyReport.active_context.estimated_tokens -gt 0) "Active context estimate must be positive"
Assert-Equal $EstimateOnlyReport.active_context.last_compaction_utc "1970-01-01T00:00:04.0000000Z" "Latest compaction time must be preserved"
$EstimateJson = $EstimateOnlyReport | ConvertTo-Json -Depth 12
Assert-True (-not $EstimateJson.Contains("private-summary")) "Compaction summary content must not leak"

$OverLimitMessages = @(
  (New-AssistantMessage -Id "overflow" -Created 6000 -InputTokens 490000 -OutputTokens 20000 -CacheReadTokens 5000 -TotalTokens 515000)
)
$OverLimitReport = New-OCRouterSessionContextReport `
  -QueryScope "router_explicit" `
  -Messages $OverLimitMessages `
  -ProviderCatalog $Providers

Assert-Equal $OverLimitReport.pressure.state "over_limit" "Usage at or above the model limit must be over_limit"
Assert-Equal $OverLimitReport.pressure.recommendation "urgent_recovery_required_no_automatic_compact" "Over-limit telemetry must not auto-compact"

$MappedConfig = [pscustomobject]@{ sessions = [pscustomobject]@{ target = [pscustomobject]@{ sessionId = "mapped-session" } } }
$MappedIdentity = Resolve-OCRouterMappedSessionIdentity -Config $MappedConfig -LogicalName "target"
Assert-True $MappedIdentity.success "A structurally valid target mapping must resolve"
Assert-Equal $MappedIdentity.session_id "mapped-session" "The mapped session identity must be preserved internally"

$MissingMapping = Resolve-OCRouterMappedSessionIdentity -Config $MappedConfig -LogicalName "missing"
Assert-Equal $MissingMapping.failure_code "ROUTER_TARGET_UNMAPPED" "A missing target mapping must fail closed"

$MalformedMappingConfig = [pscustomobject]@{ sessions = [pscustomobject]@{ target = [pscustomobject]@{ sessionId = "" } } }
$MalformedMapping = Resolve-OCRouterMappedSessionIdentity -Config $MalformedMappingConfig -LogicalName "target"
Assert-Equal $MalformedMapping.failure_code "ROUTER_SESSION_MAPPING_MALFORMED" "A missing mapped session ID must fail closed"

$InvalidMappingConfig = [pscustomobject]@{ sessions = [pscustomobject]@{ target = [pscustomobject]@{ sessionId = "bad/session" } } }
$InvalidMapping = Resolve-OCRouterMappedSessionIdentity -Config $InvalidMappingConfig -LogicalName "target"
Assert-Equal $InvalidMapping.failure_code "ROUTER_SESSION_MAPPING_MALFORMED" "A malformed mapped session ID must fail closed"

foreach ($ExplicitState in @("busy", "retry", "idle")) {
  $ExplicitMap = [pscustomobject]@{ "mapped-session" = [pscustomobject]@{ type = $ExplicitState } }
  $ExplicitObservation = Resolve-OCRouterSessionStateObservation -StatusMap $ExplicitMap -ResolvedSessionId "mapped-session" -DirectLookupOutcome "success"
  Assert-True $ExplicitObservation.success "Explicit $ExplicitState status must be accepted"
  Assert-Equal $ExplicitObservation.state $ExplicitState "Explicit $ExplicitState status must remain exact"
  Assert-Equal $ExplicitObservation.source "status_map_explicit" "Explicit $ExplicitState status must retain map provenance"
}

$OtherSessionMap = [pscustomobject]@{ "other-session" = [pscustomobject]@{ type = "busy" } }
$OmittedIdle = Resolve-OCRouterSessionStateObservation -StatusMap $OtherSessionMap -ResolvedSessionId "mapped-session" -DirectLookupOutcome "success"
Assert-True $OmittedIdle.success "A valid omitted map entry plus successful direct lookup must resolve"
Assert-Equal $OmittedIdle.state "idle" "A proven valid map omission must mean idle"
Assert-Equal $OmittedIdle.source "map_omission_idle" "Map omission idle provenance must be explicit"

$MalformedMap = Resolve-OCRouterSessionStateObservation -StatusMap @() -ResolvedSessionId "mapped-session" -DirectLookupOutcome "success"
Assert-Equal $MalformedMap.failure_code "SESSION_STATUS_MALFORMED" "A malformed status map must fail closed"
$MalformedEntryMap = [pscustomobject]@{ "mapped-session" = [pscustomobject]@{ type = "sleeping" } }
$MalformedEntry = Resolve-OCRouterSessionStateObservation -StatusMap $MalformedEntryMap -ResolvedSessionId "mapped-session" -DirectLookupOutcome "success"
Assert-Equal $MalformedEntry.failure_code "SESSION_STATUS_MALFORMED" "A malformed target status entry must fail closed"
$MalformedOtherEntryMap = [pscustomobject]@{ "other-session" = [pscustomobject]@{ type = "sleeping" } }
$MalformedOtherEntry = Resolve-OCRouterSessionStateObservation -StatusMap $MalformedOtherEntryMap -ResolvedSessionId "mapped-session" -DirectLookupOutcome "success"
Assert-Equal $MalformedOtherEntry.failure_code "SESSION_STATUS_MALFORMED" "A malformed unrelated status entry must prevent omission-idle inference"

$MissingDirect = Resolve-OCRouterSessionStateObservation -StatusMap ([pscustomobject]@{}) -ResolvedSessionId "mapped-session" -DirectLookupOutcome "not_found"
Assert-Equal $MissingDirect.failure_code "SESSION_NOT_FOUND" "A direct target 404 must fail as SESSION_NOT_FOUND"
$FailedDirect = Resolve-OCRouterSessionStateObservation -StatusMap ([pscustomobject]@{}) -ResolvedSessionId "mapped-session" -DirectLookupOutcome "failure"
Assert-Equal $FailedDirect.failure_code "SESSION_TELEMETRY_UNAVAILABLE" "Other required direct telemetry failure must fail closed"
Assert-Equal (Get-OCRouterTelemetryFailureCode -ErrorRecord $null -RequestClass "status") "SESSION_STATUS_UNAVAILABLE" "A status request failure must use its exact code"
$Mock404 = [pscustomobject]@{ Exception = [pscustomobject]@{ Response = [pscustomobject]@{ StatusCode = 404 } } }
Assert-Equal (Get-OCRouterTelemetryFailureCode -ErrorRecord $Mock404 -RequestClass "session") "SESSION_NOT_FOUND" "A mocked direct target 404 must use SESSION_NOT_FOUND"
$Mock500 = [pscustomobject]@{ Exception = [pscustomobject]@{ Response = [pscustomobject]@{ StatusCode = 500 } } }
Assert-Equal (Get-OCRouterTelemetryFailureCode -ErrorRecord $Mock500 -RequestClass "session") "SESSION_TELEMETRY_UNAVAILABLE" "A mocked non-404 direct target failure must use SESSION_TELEMETRY_UNAVAILABLE"

$RedactedFailure = [pscustomobject][ordered]@{
  schema_version = "session-context-status/v1-error"
  session = [pscustomobject]@{ logical_name = "target"; state = "unknown"; state_source = "unavailable"; identity_disclosed = $false }
  error = [pscustomobject]@{ code = "SESSION_NOT_FOUND"; message = "Session context telemetry could not be read." }
}
$RedactedFailureJson = $RedactedFailure | ConvertTo-Json -Depth 5
Assert-True (-not $RedactedFailureJson.Contains("mapped-session")) "Failure reports must not disclose concrete session IDs"
Assert-True (-not $RedactedFailureJson.Contains("127.0.0.1")) "Failure reports must not disclose endpoints or ports"

$TelemetrySource = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'session-context-status.ps1'))
$TelemetryRequest = [regex]::Match($TelemetrySource, '(?s)function Invoke-OCRouterTelemetryGet\s*\{.*?\n\}')
Assert-True $TelemetryRequest.Success "Telemetry request helper must exist"
Assert-True ($TelemetryRequest.Value.Contains('-MaximumRedirection 0')) "Every telemetry GET must reject redirects"

Write-Host "SESSION CONTEXT STATUS TEST PASSED"
