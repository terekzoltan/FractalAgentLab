[CmdletBinding(DefaultParameterSetName = "Target")]
param(
  [Parameter(Mandatory, ParameterSetName = "Target")][string]$Target,
  [Parameter(Mandatory, ParameterSetName = "Session")][string]$SessionId,
  [Parameter(Mandatory, ParameterSetName = "All")][switch]$AllMapped,
  [string]$Server = "",
  [string]$RouterDir = ".opencode-router",
  [int]$MessageLimit = 200,
  [ValidateRange(1, 60)][int]$TimeoutSeconds = 15,
  [ValidateRange(0.01, 0.99)][double]$WarnRatio = 0.5,
  [ValidateRange(0.01, 0.99)][double]$CriticalRatio = 0.62,
  [string]$PolicyIdentity = "telemetry-default-v1",
  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "oc-router-common.ps1")
. (Join-Path $PSScriptRoot "session-context-status-core.ps1")

function Assert-OCRouterSessionId {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value) -or $Value -cnotmatch '^[A-Za-z0-9_-]{1,160}$') {
    throw "Session id has an invalid shape."
  }
}

function New-OCRouterTelemetryHeaders {
  if ([string]::IsNullOrWhiteSpace($Password)) {
    return @{}
  }
  return New-OCRouterBasicAuthHeader -Username $Username -Password $Password
}

function Invoke-OCRouterTelemetryGet {
  param(
    [string]$BaseUri,
    [string]$RelativePath,
    [hashtable]$Headers
  )

  return Invoke-RestMethod `
    -Method Get `
    -Uri ($BaseUri.TrimEnd("/") + $RelativePath) `
    -Headers $Headers `
    -TimeoutSec $TimeoutSeconds `
    -MaximumRedirection 0
}

function Get-OCRouterSessionModel {
  param([object]$SessionInfo)

  $Model = Get-OCRouterPropertyValue -Value $SessionInfo -Name "model"
  if ($null -ne $Model) {
    return $Model
  }
  return $null
}

function New-OCRouterFailedStatus {
  param(
    [string]$LogicalName,
    [string]$QueryScope,
    [string]$ErrorCode,
    [string]$EffectivePolicyIdentity,
    [double]$EffectiveWarnRatio,
    [double]$EffectiveCriticalRatio
  )

  return [pscustomobject][ordered]@{
    schema_version = "session-context-status/v1-error"
    query_scope = $QueryScope
    observed_at_utc = [DateTime]::UtcNow.ToString("o")
    session = [pscustomobject][ordered]@{
      logical_name = if ([string]::IsNullOrWhiteSpace($LogicalName)) { $null } else { $LogicalName }
      state = "unknown"
      state_source = "unavailable"
      identity_disclosed = $false
    }
    policy = [pscustomobject][ordered]@{
      identity = $EffectivePolicyIdentity
      warn_ratio = $EffectiveWarnRatio
      critical_ratio = $EffectiveCriticalRatio
    }
    error = [pscustomobject][ordered]@{
      code = $ErrorCode
      message = "Session context telemetry could not be read."
    }
    capabilities = [pscustomobject][ordered]@{
      read_only = $true
      may_compact = $false
      may_send = $false
      may_mutate = $false
    }
  }
}

if ($CriticalRatio -le $WarnRatio) {
  throw "CriticalRatio must be greater than WarnRatio."
}
if ($MessageLimit -lt 1 -or $MessageLimit -gt 1000) {
  throw "MessageLimit must be between 1 and 1000."
}
if ($PolicyIdentity -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._:@+~-]{0,159}$') {
  throw "PolicyIdentity has an invalid shape."
}

$Config = $null
if ($PSCmdlet.ParameterSetName -ne "Session" -or [string]::IsNullOrWhiteSpace($Server)) {
  $Config = Get-OCRouterConfig -RouterDir $RouterDir
}
if ([string]::IsNullOrWhiteSpace($Server)) {
  $Server = [string](Get-OCRouterPropertyValue -Value $Config -Name "server" -DefaultValue "")
}
if ($Server -cnotmatch '^https?://(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$') {
  throw "Server must be an explicit loopback HTTP(S) endpoint."
}

$Queries = @()
switch ($PSCmdlet.ParameterSetName) {
  "Target" {
    if ($Target -cnotmatch '^[A-Za-z0-9._-]{1,80}$') {
      throw "Target has an invalid shape."
    }
    $Mapping = Resolve-OCRouterMappedSessionIdentity -Config $Config -LogicalName $Target
    if (-not [bool]$Mapping.success) {
      New-OCRouterFailedStatus -LogicalName $Target -QueryScope "router_target" -ErrorCode ([string]$Mapping.failure_code) -EffectivePolicyIdentity $PolicyIdentity -EffectiveWarnRatio $WarnRatio -EffectiveCriticalRatio $CriticalRatio | ConvertTo-Json -Depth 15
      return
    }
    $Queries = @([pscustomobject]@{ logical_name = $Target; session_id = [string]$Mapping.session_id; scope = "router_target" })
  }
  "Session" {
    $Queries = @([pscustomobject]@{ logical_name = ""; session_id = $SessionId; scope = "router_explicit" })
  }
  "All" {
    $Queries = @(
      $Config.sessions.PSObject.Properties |
        Sort-Object Name |
        ForEach-Object {
          [pscustomobject]@{
            logical_name = $_.Name
            session_id = [string](Resolve-OCRouterMappedSessionIdentity -Config $Config -LogicalName $_.Name).session_id
            scope = "router_all"
          }
        }
    )
  }
}

foreach ($Query in $Queries) {
  Assert-OCRouterSessionId -Value $Query.session_id
}

$Headers = New-OCRouterTelemetryHeaders
try {
  $StatusMap = Invoke-OCRouterTelemetryGet -BaseUri $Server -RelativePath "/session/status" -Headers $Headers
}
catch {
  $StatusFailureReports = @($Queries | ForEach-Object {
    New-OCRouterFailedStatus -LogicalName $_.logical_name -QueryScope $_.scope -ErrorCode "SESSION_STATUS_UNAVAILABLE" -EffectivePolicyIdentity $PolicyIdentity -EffectiveWarnRatio $WarnRatio -EffectiveCriticalRatio $CriticalRatio
  })
  if ($PSCmdlet.ParameterSetName -eq "All") {
    [pscustomobject][ordered]@{ schema_version = "session-context-status-collection/v1"; observed_at_utc = [DateTime]::UtcNow.ToString("o"); reports = $StatusFailureReports } | ConvertTo-Json -Depth 15
  }
  else { $StatusFailureReports[0] | ConvertTo-Json -Depth 15 }
  return
}
$Reports = @()

foreach ($Query in $Queries) {
  $InitialState = Resolve-OCRouterSessionStateObservation -StatusMap $StatusMap -ResolvedSessionId $Query.session_id
  if (-not [bool]$InitialState.success -and [string]$InitialState.failure_code -ceq "SESSION_STATUS_MALFORMED") {
    $Reports += New-OCRouterFailedStatus -LogicalName $Query.logical_name -QueryScope $Query.scope -ErrorCode "SESSION_STATUS_MALFORMED" -EffectivePolicyIdentity $PolicyIdentity -EffectiveWarnRatio $WarnRatio -EffectiveCriticalRatio $CriticalRatio
    continue
  }
  try {
    $EncodedId = [Uri]::EscapeDataString($Query.session_id)
    try { $SessionInfo = Invoke-OCRouterTelemetryGet -BaseUri $Server -RelativePath "/session/$EncodedId" -Headers $Headers }
    catch {
      $DirectFailureCode = Get-OCRouterTelemetryFailureCode -ErrorRecord $_ -RequestClass "session"
      $Reports += New-OCRouterFailedStatus -LogicalName $Query.logical_name -QueryScope $Query.scope -ErrorCode $DirectFailureCode -EffectivePolicyIdentity $PolicyIdentity -EffectiveWarnRatio $WarnRatio -EffectiveCriticalRatio $CriticalRatio
      continue
    }
    $SessionState = Resolve-OCRouterSessionStateObservation -StatusMap $StatusMap -ResolvedSessionId $Query.session_id -DirectLookupOutcome "success"
    if (-not [bool]$SessionState.success) {
      $Reports += New-OCRouterFailedStatus -LogicalName $Query.logical_name -QueryScope $Query.scope -ErrorCode ([string]$SessionState.failure_code) -EffectivePolicyIdentity $PolicyIdentity -EffectiveWarnRatio $WarnRatio -EffectiveCriticalRatio $CriticalRatio
      continue
    }
    $ProviderCatalog = Invoke-OCRouterTelemetryGet -BaseUri $Server -RelativePath "/provider" -Headers $Headers
    $MessagesResponse = Invoke-OCRouterTelemetryGet -BaseUri $Server -RelativePath "/session/$EncodedId/message?limit=$MessageLimit" -Headers $Headers
    $Messages = Get-OCRouterMessageCollection -Response $MessagesResponse
    try {
      $ActiveContextResponse = Invoke-OCRouterTelemetryGet -BaseUri $Server -RelativePath "/api/session/$EncodedId/context" -Headers $Headers
      $ActiveContext = Get-OCRouterMessageCollection -Response $ActiveContextResponse
    }
    catch {
      $ActiveContext = @()
    }

    $Reports += New-OCRouterSessionContextReport `
      -LogicalName $Query.logical_name `
      -QueryScope $Query.scope `
      -SessionState ([string]$SessionState.state) `
      -SessionStateSource ([string]$SessionState.source) `
      -Messages $Messages `
      -ActiveContext $ActiveContext `
      -ProviderCatalog $ProviderCatalog `
      -SessionModel (Get-OCRouterSessionModel -SessionInfo $SessionInfo) `
      -WarnRatio $WarnRatio `
      -CriticalRatio $CriticalRatio `
      -PolicyIdentity $PolicyIdentity
  }
  catch {
    $Reports += New-OCRouterFailedStatus -LogicalName $Query.logical_name -QueryScope $Query.scope -ErrorCode "SESSION_TELEMETRY_UNAVAILABLE" -EffectivePolicyIdentity $PolicyIdentity -EffectiveWarnRatio $WarnRatio -EffectiveCriticalRatio $CriticalRatio
  }
}

if ($PSCmdlet.ParameterSetName -eq "All") {
  [pscustomobject][ordered]@{
    schema_version = "session-context-status-collection/v1"
    observed_at_utc = [DateTime]::UtcNow.ToString("o")
    reports = $Reports
  } | ConvertTo-Json -Depth 15
}
else {
  $Reports[0] | ConvertTo-Json -Depth 15
}
