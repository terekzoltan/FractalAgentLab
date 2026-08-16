$ErrorActionPreference = "Stop"

function Get-OCRouterPropertyValue {
  param(
    [object]$Value,
    [string]$Name,
    $DefaultValue = $null
  )

  if ($null -eq $Value) {
    return $DefaultValue
  }
  if ($Value -is [System.Collections.IDictionary]) {
    if ($Value.Contains($Name)) {
      return $Value[$Name]
    }
    return $DefaultValue
  }
  if ($Value.PSObject.Properties.Name -contains $Name) {
    return $Value.$Name
  }
  return $DefaultValue
}

function Get-OCRouterNestedPropertyValue {
  param(
    [object]$Value,
    [string[]]$Path,
    $DefaultValue = $null
  )

  $Current = $Value
  foreach ($Name in $Path) {
    $Current = Get-OCRouterPropertyValue -Value $Current -Name $Name -DefaultValue $null
    if ($null -eq $Current) {
      return $DefaultValue
    }
  }
  return $Current
}

function Test-OCRouterSessionIdShape {
  param([object]$Value)

  return $Value -is [string] -and [string]$Value -cmatch '^[A-Za-z0-9_-]{1,160}$'
}

function Resolve-OCRouterMappedSessionIdentity {
  param(
    [object]$Config,
    [string]$LogicalName
  )

  $Sessions = Get-OCRouterPropertyValue -Value $Config -Name "sessions"
  if ($null -eq $Sessions -or
      ($Sessions -isnot [System.Collections.IDictionary] -and $Sessions -isnot [pscustomobject])) {
    return [pscustomobject]@{ success = $false; session_id = $null; failure_code = "ROUTER_TARGET_UNMAPPED" }
  }

  $Entry = Get-OCRouterPropertyValue -Value $Sessions -Name $LogicalName
  if ($null -eq $Entry) {
    return [pscustomobject]@{ success = $false; session_id = $null; failure_code = "ROUTER_TARGET_UNMAPPED" }
  }

  $MappedSessionId = $null
  if ($Entry -is [string]) {
    $MappedSessionId = [string]$Entry
  }
  elseif ($Entry -is [System.Collections.IDictionary] -or $Entry -is [pscustomobject]) {
    foreach ($Name in @("sessionId", "sessionID", "id")) {
      $CandidateSessionId = Get-OCRouterPropertyValue -Value $Entry -Name $Name
      if ($null -ne $CandidateSessionId) {
        $MappedSessionId = $CandidateSessionId
        break
      }
    }
  }

  if (-not (Test-OCRouterSessionIdShape -Value $MappedSessionId)) {
    return [pscustomobject]@{ success = $false; session_id = $null; failure_code = "ROUTER_SESSION_MAPPING_MALFORMED" }
  }

  return [pscustomobject]@{ success = $true; session_id = [string]$MappedSessionId; failure_code = $null }
}

function Resolve-OCRouterSessionStateObservation {
  param(
    [object]$StatusMap,
    [string]$ResolvedSessionId,
    [ValidateSet("not_attempted", "success", "not_found", "failure")][string]$DirectLookupOutcome = "not_attempted"
  )

  if (-not (Test-OCRouterSessionIdShape -Value $ResolvedSessionId)) {
    return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "ROUTER_SESSION_MAPPING_MALFORMED" }
  }
  if ($null -eq $StatusMap -or $StatusMap -is [System.Array] -or
      ($StatusMap -isnot [System.Collections.IDictionary] -and $StatusMap -isnot [pscustomobject])) {
    return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_STATUS_MALFORMED" }
  }

  $StatusProperties = if ($StatusMap -is [System.Collections.IDictionary]) {
    @($StatusMap.GetEnumerator() | ForEach-Object { [pscustomobject]@{ Name = [string]$_.Key; Value = $_.Value } })
  }
  else {
    @($StatusMap.PSObject.Properties | ForEach-Object { [pscustomobject]@{ Name = [string]$_.Name; Value = $_.Value } })
  }
  foreach ($StatusProperty in $StatusProperties) {
    if (-not (Test-OCRouterSessionIdShape -Value $StatusProperty.Name) -or
        $null -eq $StatusProperty.Value -or $StatusProperty.Value -is [string] -or $StatusProperty.Value -is [System.Array] -or
        ($StatusProperty.Value -isnot [System.Collections.IDictionary] -and $StatusProperty.Value -isnot [pscustomobject])) {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_STATUS_MALFORMED" }
    }
    $ObservedStateType = Get-OCRouterPropertyValue -Value $StatusProperty.Value -Name "type"
    if ($ObservedStateType -isnot [string] -or [string]$ObservedStateType -cnotin @("idle", "busy", "retry")) {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_STATUS_MALFORMED" }
    }
  }

  $StatusEntryPresent = if ($StatusMap -is [System.Collections.IDictionary]) {
    $StatusMap.Contains($ResolvedSessionId)
  }
  else {
    $null -ne $StatusMap.PSObject.Properties[$ResolvedSessionId]
  }

  if ($StatusEntryPresent) {
    $StatusEntry = Get-OCRouterPropertyValue -Value $StatusMap -Name $ResolvedSessionId
    if ($null -eq $StatusEntry -or $StatusEntry -is [string] -or $StatusEntry -is [System.Array] -or
        ($StatusEntry -isnot [System.Collections.IDictionary] -and $StatusEntry -isnot [pscustomobject])) {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_STATUS_MALFORMED" }
    }
    $StateType = Get-OCRouterPropertyValue -Value $StatusEntry -Name "type"
    if ($StateType -isnot [string] -or [string]$StateType -cnotin @("idle", "busy", "retry")) {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_STATUS_MALFORMED" }
    }
    return [pscustomobject]@{ success = $true; state = [string]$StateType; source = "status_map_explicit"; failure_code = $null }
  }

  switch ($DirectLookupOutcome) {
    "success" {
      return [pscustomobject]@{ success = $true; state = "idle"; source = "map_omission_idle"; failure_code = $null }
    }
    "not_found" {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_NOT_FOUND" }
    }
    "failure" {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_TELEMETRY_UNAVAILABLE" }
    }
    default {
      return [pscustomobject]@{ success = $false; state = "unknown"; source = "unavailable"; failure_code = "SESSION_TELEMETRY_UNAVAILABLE" }
    }
  }
}

function Get-OCRouterTelemetryFailureCode {
  param(
    [object]$ErrorRecord,
    [ValidateSet("status", "session", "telemetry")][string]$RequestClass
  )

  if ($RequestClass -ceq "status") {
    return "SESSION_STATUS_UNAVAILABLE"
  }

  $StatusCode = 0
  $Response = Get-OCRouterNestedPropertyValue -Value $ErrorRecord -Path @("Exception", "Response")
  if ($null -ne $Response) {
    try { $StatusCode = [int](Get-OCRouterPropertyValue -Value $Response -Name "StatusCode" -DefaultValue 0) }
    catch { $StatusCode = 0 }
  }
  if ($RequestClass -ceq "session" -and $StatusCode -eq 404) {
    return "SESSION_NOT_FOUND"
  }
  return "SESSION_TELEMETRY_UNAVAILABLE"
}

function ConvertTo-OCRouterIsoUtc {
  param($EpochMilliseconds)

  if ($null -eq $EpochMilliseconds) {
    return $null
  }
  try {
    return [DateTimeOffset]::FromUnixTimeMilliseconds([int64]$EpochMilliseconds).UtcDateTime.ToString("o")
  }
  catch {
    return $null
  }
}

function Get-OCRouterAssistantObservation {
  param([object[]]$Messages)

  $Candidates = @()
  foreach ($Message in @($Messages)) {
    $Info = Get-OCRouterPropertyValue -Value $Message -Name "info" -DefaultValue $Message
    if (([string](Get-OCRouterPropertyValue -Value $Info -Name "role" -DefaultValue "")).ToLowerInvariant() -ne "assistant") {
      continue
    }
    $Tokens = Get-OCRouterPropertyValue -Value $Info -Name "tokens"
    if ($null -eq $Tokens) {
      continue
    }
    $CompletedValue = Get-OCRouterNestedPropertyValue -Value $Info -Path @("time", "completed")
    if ($null -eq $CompletedValue) {
      continue
    }
    $Created = Get-OCRouterNestedPropertyValue -Value $Info -Path @("time", "created") -DefaultValue 0
    $Completed = $CompletedValue
    $Candidates += [pscustomobject]@{
      info = $Info
      tokens = $Tokens
      created = [int64]$Created
      completed = [int64]$Completed
    }
  }

  if ($Candidates.Count -eq 0) {
    return $null
  }

  $Latest = $Candidates | Sort-Object completed, created | Select-Object -Last 1
  $InputTokens = [int64](Get-OCRouterPropertyValue -Value $Latest.tokens -Name "input" -DefaultValue 0)
  $OutputTokens = [int64](Get-OCRouterPropertyValue -Value $Latest.tokens -Name "output" -DefaultValue 0)
  $ReasoningTokens = [int64](Get-OCRouterPropertyValue -Value $Latest.tokens -Name "reasoning" -DefaultValue 0)
  $CacheReadTokens = [int64](Get-OCRouterNestedPropertyValue -Value $Latest.tokens -Path @("cache", "read") -DefaultValue 0)
  $CacheWriteTokens = [int64](Get-OCRouterNestedPropertyValue -Value $Latest.tokens -Path @("cache", "write") -DefaultValue 0)
  $ReportedTotal = Get-OCRouterPropertyValue -Value $Latest.tokens -Name "total"

  if ($null -ne $ReportedTotal -and [int64]$ReportedTotal -gt 0) {
    $TotalTokens = [int64]$ReportedTotal
    $TotalSource = "provider_reported_total"
  }
  else {
    # Mirrors OpenCode's overflow fallback; reasoning is already accounted for by provider output semantics.
    $TotalTokens = $InputTokens + $OutputTokens + $CacheReadTokens + $CacheWriteTokens
    $TotalSource = "computed_opencode_overflow_formula"
  }

  return [pscustomobject]@{
    status = "available"
    as_of_utc = ConvertTo-OCRouterIsoUtc -EpochMilliseconds $Latest.completed
    provider_id = [string](Get-OCRouterPropertyValue -Value $Latest.info -Name "providerID" -DefaultValue "")
    model_id = [string](Get-OCRouterPropertyValue -Value $Latest.info -Name "modelID" -DefaultValue "")
    input_tokens = $InputTokens
    output_tokens = $OutputTokens
    reasoning_tokens = $ReasoningTokens
    cache_read_tokens = $CacheReadTokens
    cache_write_tokens = $CacheWriteTokens
    total_tokens = $TotalTokens
    total_source = $TotalSource
    source = "provider_observed_last_completion"
  }
}

function Find-OCRouterModelInfo {
  param(
    [object]$ProviderCatalog,
    [string]$ProviderId,
    [string]$ModelId
  )

  if ([string]::IsNullOrWhiteSpace($ProviderId) -or [string]::IsNullOrWhiteSpace($ModelId)) {
    return $null
  }

  $Catalog = Get-OCRouterPropertyValue -Value $ProviderCatalog -Name "data" -DefaultValue $ProviderCatalog
  foreach ($Provider in @(Get-OCRouterPropertyValue -Value $Catalog -Name "all" -DefaultValue @())) {
    if ([string](Get-OCRouterPropertyValue -Value $Provider -Name "id" -DefaultValue "") -cne $ProviderId) {
      continue
    }

    $Models = Get-OCRouterPropertyValue -Value $Provider -Name "models"
    if ($null -eq $Models) {
      return $null
    }
    if ($Models -is [System.Array]) {
      return @($Models | Where-Object { [string](Get-OCRouterPropertyValue -Value $_ -Name "id" -DefaultValue "") -ceq $ModelId }) | Select-Object -First 1
    }
    if ($Models -is [System.Collections.IDictionary] -and $Models.Contains($ModelId)) {
      return $Models[$ModelId]
    }
    if ($Models.PSObject.Properties.Name -contains $ModelId) {
      return $Models.$ModelId
    }
    return $null
  }
  return $null
}

function Get-OCRouterActiveContextSummary {
  param([object[]]$ActiveContext)

  $Items = @($ActiveContext)
  if ($Items.Count -eq 0) {
    return [pscustomobject]@{
      status = "unavailable"
      messages_since_compaction = 0
      last_compaction_utc = $null
      estimated_tokens = $null
      source = "unavailable"
      confidence = "none"
    }
  }

  $LastCompaction = $null
  foreach ($Item in $Items) {
    if ([string](Get-OCRouterPropertyValue -Value $Item -Name "type" -DefaultValue "") -ne "compaction") {
      continue
    }
    $Created = Get-OCRouterNestedPropertyValue -Value $Item -Path @("time", "created")
    if ($null -ne $Created -and ($null -eq $LastCompaction -or [int64]$Created -gt [int64]$LastCompaction)) {
      $LastCompaction = [int64]$Created
    }
  }

  $Json = $Items | ConvertTo-Json -Depth 30 -Compress
  $ByteCount = [Text.Encoding]::UTF8.GetByteCount($Json)
  $EstimatedTokens = [int64][Math]::Ceiling($ByteCount / 4.0)

  return [pscustomobject]@{
    status = "available_estimate"
    messages_since_compaction = $Items.Count
    last_compaction_utc = ConvertTo-OCRouterIsoUtc -EpochMilliseconds $LastCompaction
    estimated_tokens = $EstimatedTokens
    source = "derived_active_context_estimate"
    confidence = "low"
  }
}

function New-OCRouterSessionContextReport {
  param(
    [string]$LogicalName = "",
    [ValidateSet("router_target", "router_explicit", "router_all", "self")][string]$QueryScope,
    [ValidateSet("idle", "busy", "retry", "unknown")][string]$SessionState = "unknown",
    [object[]]$Messages = @(),
    [object[]]$ActiveContext = @(),
    [object]$ProviderCatalog = $null,
    [object]$SessionModel = $null,
    [ValidateRange(0.01, 0.99)][double]$WarnRatio = 0.5,
    [ValidateRange(0.01, 0.99)][double]$CriticalRatio = 0.62,
    [string]$PolicyIdentity = "telemetry-default-v1",
    [ValidateSet("status_map_explicit", "map_omission_idle", "unavailable")][string]$SessionStateSource = "unavailable"
  )

  if ($CriticalRatio -le $WarnRatio) {
    throw "CriticalRatio must be greater than WarnRatio."
  }
  if ($PolicyIdentity -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:@+~-]{0,159}$') {
    throw "PolicyIdentity has an invalid shape."
  }

  $Observation = Get-OCRouterAssistantObservation -Messages $Messages
  if ($null -eq $Observation) {
    $Observation = [pscustomobject]@{
      status = "unavailable"
      as_of_utc = $null
      provider_id = [string](Get-OCRouterPropertyValue -Value $SessionModel -Name "providerID" -DefaultValue "")
      model_id = [string](Get-OCRouterPropertyValue -Value $SessionModel -Name "modelID" -DefaultValue (Get-OCRouterPropertyValue -Value $SessionModel -Name "id" -DefaultValue ""))
      input_tokens = $null
      output_tokens = $null
      reasoning_tokens = $null
      cache_read_tokens = $null
      cache_write_tokens = $null
      total_tokens = $null
      total_source = "unavailable"
      source = "unavailable"
    }
  }

  $ProviderId = $Observation.provider_id
  $ModelId = $Observation.model_id
  if ([string]::IsNullOrWhiteSpace($ProviderId)) {
    $ProviderId = [string](Get-OCRouterPropertyValue -Value $SessionModel -Name "providerID" -DefaultValue "")
  }
  if ([string]::IsNullOrWhiteSpace($ModelId)) {
    $ModelId = [string](Get-OCRouterPropertyValue -Value $SessionModel -Name "modelID" -DefaultValue (Get-OCRouterPropertyValue -Value $SessionModel -Name "id" -DefaultValue ""))
  }

  $ModelInfo = Find-OCRouterModelInfo -ProviderCatalog $ProviderCatalog -ProviderId $ProviderId -ModelId $ModelId
  $ContextLimit = if ($null -eq $ModelInfo) { 0 } else { [int64](Get-OCRouterNestedPropertyValue -Value $ModelInfo -Path @("limit", "context") -DefaultValue 0) }
  $InputLimit = if ($null -eq $ModelInfo) { $null } else { Get-OCRouterNestedPropertyValue -Value $ModelInfo -Path @("limit", "input") }
  $OutputLimit = if ($null -eq $ModelInfo) { $null } else { Get-OCRouterNestedPropertyValue -Value $ModelInfo -Path @("limit", "output") }
  $ActiveSummary = Get-OCRouterActiveContextSummary -ActiveContext $ActiveContext

  $BestTokens = $null
  $BestSource = "unavailable"
  if ($Observation.status -eq "available") {
    $BestTokens = [int64]$Observation.total_tokens
    $BestSource = "provider_observed_last_completion"
  }
  elseif ($null -ne $ActiveSummary.estimated_tokens) {
    $BestTokens = [int64]$ActiveSummary.estimated_tokens
    $BestSource = "derived_active_context_estimate"
  }

  $WarnTokens = if ($ContextLimit -gt 0) { [int64][Math]::Floor($ContextLimit * $WarnRatio) } else { $null }
  $CriticalTokens = if ($ContextLimit -gt 0) { [int64][Math]::Floor($ContextLimit * $CriticalRatio) } else { $null }
  $UsageRatio = if ($ContextLimit -gt 0 -and $null -ne $BestTokens) { [Math]::Round($BestTokens / [double]$ContextLimit, 6) } else { $null }
  $PressureState = "unknown"
  $Recommendation = "inspect_telemetry_do_not_guess"
  if ($null -ne $UsageRatio) {
    if ($UsageRatio -ge 1.0) {
      $PressureState = "over_limit"
      $Recommendation = "urgent_recovery_required_no_automatic_compact"
    }
    elseif ($UsageRatio -ge $CriticalRatio) {
      $PressureState = "critical"
      $Recommendation = "recommend_at_next_safe_boundary"
    }
    elseif ($UsageRatio -ge $WarnRatio) {
      $PressureState = "warn"
      $Recommendation = "monitor_and_prepare_boundary"
    }
    else {
      $PressureState = "normal"
      $Recommendation = "none"
    }
  }

  return [pscustomobject][ordered]@{
    schema_version = "session-context-status/v1"
    query_scope = $QueryScope
    observed_at_utc = [DateTime]::UtcNow.ToString("o")
    session = [pscustomobject][ordered]@{
      logical_name = if ([string]::IsNullOrWhiteSpace($LogicalName)) { $null } else { $LogicalName }
      state = $SessionState
      state_source = $SessionStateSource
      identity_disclosed = $false
    }
    policy = [pscustomobject][ordered]@{
      identity = $PolicyIdentity
      warn_ratio = $WarnRatio
      critical_ratio = $CriticalRatio
    }
    model = [pscustomobject][ordered]@{
      provider_id = if ([string]::IsNullOrWhiteSpace($ProviderId)) { $null } else { $ProviderId }
      model_id = if ([string]::IsNullOrWhiteSpace($ModelId)) { $null } else { $ModelId }
      context_limit = if ($ContextLimit -gt 0) { $ContextLimit } else { $null }
      input_limit = if ($null -eq $InputLimit) { $null } else { [int64]$InputLimit }
      output_limit = if ($null -eq $OutputLimit) { $null } else { [int64]$OutputLimit }
      limit_source = if ($null -eq $ModelInfo) { "unavailable" } else { "opencode_provider_catalog" }
    }
    provider_observation = $Observation
    active_context = $ActiveSummary
    pressure = [pscustomobject][ordered]@{
      best_available_tokens = $BestTokens
      best_available_source = $BestSource
      usage_ratio = $UsageRatio
      usage_percent = if ($null -eq $UsageRatio) { $null } else { [Math]::Round($UsageRatio * 100, 2) }
      warn_ratio = $WarnRatio
      critical_ratio = $CriticalRatio
      warn_tokens = $WarnTokens
      critical_tokens = $CriticalTokens
      state = $PressureState
      recommendation = $Recommendation
    }
    capabilities = [pscustomobject][ordered]@{
      read_only = $true
      may_compact = $false
      may_send = $false
      may_mutate = $false
    }
    limitations = @(
      "The provider observation describes the last completed request, not an exact live current context measurement.",
      "The active-context value is a local estimate and excludes hidden provider, system, and tool-schema overhead.",
      "Token pressure may recommend a boundary; it never authorizes compaction."
    )
  }
}
