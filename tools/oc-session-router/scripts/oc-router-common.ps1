$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Invoke-RestMethod:MaximumRedirection'] = 0

function Get-OCRouterConfig {
  param([string]$RouterDir)

  $SessionsPath = Join-Path $RouterDir "sessions.json"
  if (-not (Test-Path $SessionsPath)) {
    throw "Missing sessions registry: $SessionsPath"
  }

  $Config = Get-Content $SessionsPath -Raw | ConvertFrom-Json
  if ($Config.PSObject.Properties.Name -cnotcontains 'server') {
    throw 'Router sessions registry is missing its server endpoint.'
  }
  $Config.server = Resolve-OCRouterLiteralLoopbackServer -Server ([string]$Config.server)
  return $Config
}

function Resolve-OCRouterLiteralLoopbackServer {
  param([string]$Server)

  $Uri = $null
  if (-not [Uri]::TryCreate($Server, [UriKind]::Absolute, [ref]$Uri) -or
      $Uri.Scheme -notin @('http','https') -or $Uri.Host -cne '127.0.0.1' -or
      $Uri.Port -lt 1 -or $Uri.Port -gt 65535 -or $Uri.AbsolutePath -cne '/' -or
      -not [string]::IsNullOrEmpty($Uri.Query) -or -not [string]::IsNullOrEmpty($Uri.Fragment) -or
      -not [string]::IsNullOrEmpty($Uri.UserInfo)) {
    throw 'Router server must be an explicit literal 127.0.0.1 endpoint.'
  }
  return $Server.TrimEnd('/')
}

function Get-OCRouterSettings {
  param([string]$RouterDir)

  $SettingsPath = Join-Path $RouterDir "router-settings.json"
  if (-not (Test-Path $SettingsPath)) {
    return [pscustomobject]@{}
  }

  return Get-Content $SettingsPath -Raw | ConvertFrom-Json
}

function Get-OCRouterSettingValue {
  param(
    [object]$Settings,
    [string]$Name,
    $DefaultValue
  )

  if ($null -eq $Settings) {
    return $DefaultValue
  }

  if ($Settings.PSObject.Properties.Name -contains $Name) {
    return $Settings.$Name
  }

  return $DefaultValue
}

function Initialize-OCRouterDefaultFromSettings {
  param(
    [hashtable]$BoundParameters,
    [object]$Settings,
    [string]$ParameterName,
    $CurrentValue,
    [string]$SettingName
  )

  if ($BoundParameters.ContainsKey($ParameterName)) {
    return $CurrentValue
  }

  return Get-OCRouterSettingValue -Settings $Settings -Name $SettingName -DefaultValue $CurrentValue
}

function Get-OCRouterSessionEntry {
  param(
    [object]$Config,
    [string]$Name
  )

  $Entry = $Config.sessions.PSObject.Properties[$Name].Value
  if ($null -eq $Entry) {
    $Available = ($Config.sessions.PSObject.Properties.Name -join ", ")
    throw "Unknown session '$Name'. Available sessions: $Available"
  }

  return $Entry
}

function New-OCRouterBasicAuthHeader {
  param(
    [string]$Username,
    [string]$Password
  )

  $Pair = "$Username`:$Password"
  $Encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($Pair))
  return @{ Authorization = "Basic $Encoded" }
}

function Get-OCRouterRoleLabel {
  param([string]$Key)

  switch ($Key) {
    "track-a" { "Track A" }
    "track-b" { "Track B" }
    "track-c" { "Track C" }
    "track-d" { "Track D" }
    "track-e" { "Track E" }
    "track-metaops" { "Track MetaOps" }
    "meta" { "Meta Coordinator" }
    "swarm-assistant" { "Swarm Assistant" }
    "smr-analyst" { "SMR Analyst" }
    default { "" }
  }
}

function Get-OCRouterMessageCollection {
  param([object]$Response)

  if ($null -eq $Response) {
    return @()
  }

  if ($Response -is [System.Array]) {
    return @($Response)
  }

  foreach ($PropertyName in @("messages", "data", "items", "results")) {
    if ($Response.PSObject.Properties.Name -contains $PropertyName) {
      return @($Response.$PropertyName)
    }
  }

  return @($Response)
}

function Get-OCRouterMessageRole {
  param([object]$Message)

  $Values = New-Object System.Collections.Generic.List[string]

  if ($Message.PSObject.Properties.Name -contains "info" -and $null -ne $Message.info) {
    foreach ($PropertyName in @("role", "type", "kind", "actor", "source", "author")) {
      if ($Message.info.PSObject.Properties.Name -contains $PropertyName) {
        $Values.Add([string]$Message.info.$PropertyName)
      }
    }
  }

  foreach ($PropertyName in @("role", "type", "kind", "actor", "source", "author")) {
    if ($Message.PSObject.Properties.Name -contains $PropertyName) {
      $Values.Add([string]$Message.$PropertyName)
    }
  }

  foreach ($Value in $Values) {
    $Normalized = $Value.ToLowerInvariant()
    if ($Normalized -match "assistant") { return "assistant" }
    if ($Normalized -match "user") { return "user" }
    if ($Normalized -match "tool") { return "tool" }
    if ($Normalized -match "system") { return "system" }
  }

  return "unknown"
}

function Get-OCRouterMessageId {
  param([object]$Message)

  if ($Message.PSObject.Properties.Name -contains "info" -and $null -ne $Message.info) {
    foreach ($PropertyName in @("id", "messageID", "messageId", "message_id")) {
      if ($Message.info.PSObject.Properties.Name -contains $PropertyName) {
        return [string]$Message.info.$PropertyName
      }
    }
  }

  foreach ($PropertyName in @("id", "messageID", "messageId", "message_id")) {
    if ($Message.PSObject.Properties.Name -contains $PropertyName) {
      return [string]$Message.$PropertyName
    }
  }

  return ""
}

function Get-OCRouterMessageParentId {
  param([object]$Message)

  if ($Message.PSObject.Properties.Name -contains 'info' -and $null -ne $Message.info) {
    foreach ($PropertyName in @('parentID','parentId','parent_id')) {
      if ($Message.info.PSObject.Properties.Name -contains $PropertyName) { return [string]$Message.info.$PropertyName }
    }
  }
  foreach ($PropertyName in @('parentID','parentId','parent_id')) {
    if ($Message.PSObject.Properties.Name -contains $PropertyName) { return [string]$Message.$PropertyName }
  }
  return ''
}

function Get-OCRouterMessageTimestamp {
  param([object]$Message)

  $Values = New-Object System.Collections.Generic.List[object]

  if ($Message.PSObject.Properties.Name -contains "info" -and $null -ne $Message.info) {
    foreach ($PropertyName in @("createdAt", "created_at", "time", "timestamp", "updatedAt", "updated_at")) {
      if ($Message.info.PSObject.Properties.Name -contains $PropertyName) {
        $Values.Add($Message.info.$PropertyName)
      }
    }
  }

  foreach ($PropertyName in @("createdAt", "created_at", "time", "timestamp", "updatedAt", "updated_at")) {
    if ($Message.PSObject.Properties.Name -contains $PropertyName) {
      $Values.Add($Message.$PropertyName)
    }
  }

  $ExpandedValues = New-Object System.Collections.Generic.List[object]
  foreach ($Value in $Values) {
    if ($null -eq $Value) {
      continue
    }

    if ($Value -isnot [string] -and $Value.PSObject) {
      $NestedTimestampFound = $false
      foreach ($PropertyName in @("created", "updated", "completed", "createdAt", "updatedAt")) {
        if ($Value.PSObject.Properties.Name -contains $PropertyName) {
          $ExpandedValues.Add($Value.$PropertyName)
          $NestedTimestampFound = $true
        }
      }
      if ($NestedTimestampFound) {
        continue
      }
    }

    $ExpandedValues.Add($Value)
  }

  foreach ($Value in $ExpandedValues) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
      continue
    }

    $UnixValue = [long]0
    if ([long]::TryParse([string]$Value, [ref]$UnixValue)) {
      try {
        if ([math]::Abs($UnixValue) -ge 100000000000) {
          return [DateTimeOffset]::FromUnixTimeMilliseconds($UnixValue).UtcDateTime
        }
        if ([math]::Abs($UnixValue) -ge 1000000000) {
          return [DateTimeOffset]::FromUnixTimeSeconds($UnixValue).UtcDateTime
        }
      }
      catch {
        # Fall through to normal date parsing for malformed/out-of-range values.
      }
    }

    $Parsed = [datetime]::MinValue
    if ([datetime]::TryParse($Value, [ref]$Parsed)) {
      return $Parsed.ToUniversalTime()
    }
  }

  return $null
}

function Test-OCRouterReasoningPart {
  param([object]$Part)

  $Values = New-Object System.Collections.Generic.List[string]

  foreach ($PropertyName in @("type", "kind", "role", "name", "source", "format", "phase")) {
    if ($Part.PSObject.Properties.Name -contains $PropertyName) {
      $Values.Add([string]$Part.$PropertyName)
    }
  }

  foreach ($ContainerName in @("info", "metadata", "meta")) {
    if ($Part.PSObject.Properties.Name -contains $ContainerName -and $null -ne $Part.$ContainerName) {
      foreach ($PropertyName in @("type", "kind", "role", "name", "source", "format", "phase")) {
        if ($Part.$ContainerName.PSObject.Properties.Name -contains $PropertyName) {
          $Values.Add([string]$Part.$ContainerName.$PropertyName)
        }
      }
    }
  }

  foreach ($Value in $Values) {
    $Normalized = $Value.ToLowerInvariant()
    if ($Normalized -match "reasoning|thinking|thought|analysis|chain[_ -]?of[_ -]?thought") {
      return $true
    }
  }

  return $false
}

function Remove-OCRouterLeadingReasoningPrelude {
  param(
    [string]$Text,
    [bool]$IncludeReasoningParts = $false
  )

  if ($IncludeReasoningParts -or [string]::IsNullOrWhiteSpace($Text)) {
    return $Text
  }

  # Keep a canonical Track handoff intact when it embeds reviewer verdict blocks.
  if ($Text -match '(?im)^\s*#\s+STEP\b.*\bIMPLEMENTATION\s+REPORT\b') {
    return $Text
  }

  foreach ($Pattern in @("(?im)^\s*(\*\*)?Turn-gate status\s*:", "(?im)^\s*VERDICT\s*:")) {
    $Match = [regex]::Match($Text, $Pattern)
    if ($Match.Success -and $Match.Index -gt 0) {
      return $Text.Substring($Match.Index).Trim()
    }
  }

  return $Text
}

function Get-OCRouterPartText {
  param(
    [object]$Part,
    [bool]$IncludeReasoningParts = $false
  )

  $PartType = ""
  if ($Part.PSObject.Properties.Name -contains "type") {
    $PartType = ([string]$Part.type).ToLowerInvariant()
  }

  if (-not $IncludeReasoningParts -and (Test-OCRouterReasoningPart -Part $Part)) {
    return ""
  }

  if ($PartType -match "tool|file|attachment|image") {
    return ""
  }

  foreach ($PropertyName in @("text", "content", "markdown", "value")) {
    if ($Part.PSObject.Properties.Name -contains $PropertyName) {
      $Value = $Part.$PropertyName
      if ($Value -is [string] -and -not [string]::IsNullOrWhiteSpace($Value)) {
        return $Value
      }
    }
  }

  return ""
}

function Get-OCRouterMessageText {
  param(
    [object]$Message,
    [bool]$IncludeReasoningParts = $false
  )

  $Chunks = New-Object System.Collections.Generic.List[string]

  if ($Message.PSObject.Properties.Name -contains "parts" -and $null -ne $Message.parts) {
    foreach ($Part in @($Message.parts)) {
      $Text = Get-OCRouterPartText -Part $Part -IncludeReasoningParts $IncludeReasoningParts
      if (-not [string]::IsNullOrWhiteSpace($Text)) {
        $Chunks.Add($Text.Trim())
      }
    }
  }

  if ($Chunks.Count -eq 0) {
    foreach ($PropertyName in @("text", "content", "markdown")) {
      if ($Message.PSObject.Properties.Name -contains $PropertyName) {
        $Value = $Message.$PropertyName
        if ($Value -is [string] -and -not [string]::IsNullOrWhiteSpace($Value)) {
          $Chunks.Add($Value.Trim())
        }
      }
    }
  }

  $Joined = ($Chunks -join "`n`n")
  return (Remove-OCRouterLeadingReasoningPrelude -Text $Joined -IncludeReasoningParts $IncludeReasoningParts)
}

function Get-OCRouterLatestOutputCandidates {
  param(
    [object[]]$Messages,
    [int]$CandidateCount = 3,
    [bool]$AssumeNewestFirst = $true,
    [bool]$IncludeReasoningParts = $false,
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [string]$AfterMessageId = "",
    [string]$ExpectedParentMessageId = ""
  )

  # A text-less progress message can be a valid wait baseline. Restricting
  # selection before extracting text prevents an older final from masquerading
  # as a new result when that baseline is absent from the candidate list.
  if (-not [string]::IsNullOrWhiteSpace($AfterMessageId)) {
    $BaselineIndex = -1
    for ($Index = 0; $Index -lt $Messages.Count; $Index++) {
      if ((Get-OCRouterMessageId -Message $Messages[$Index]) -eq $AfterMessageId) {
        $BaselineIndex = $Index
        break
      }
    }

    if ($BaselineIndex -lt 0) {
      return @()
    }

    if ($AssumeNewestFirst) {
      if ($BaselineIndex -eq 0) {
        return @()
      }
      $Messages = @($Messages[0..($BaselineIndex - 1)])
    }
    elseif ($BaselineIndex -ge ($Messages.Count - 1)) {
      return @()
    }
    else {
      $Messages = @($Messages[($BaselineIndex + 1)..($Messages.Count - 1)])
    }
  }

  $Candidates = New-Object System.Collections.Generic.List[object]

  for ($Index = 0; $Index -lt $Messages.Count; $Index++) {
    $Message = $Messages[$Index]
    if (-not [string]::IsNullOrWhiteSpace($ExpectedParentMessageId) -and
        (Get-OCRouterMessageParentId -Message $Message) -cne $ExpectedParentMessageId) { continue }
    $Role = Get-OCRouterMessageRole -Message $Message
    if ($Role -eq "user" -or $Role -eq "tool" -or $Role -eq "system") {
      continue
    }

    $Text = Get-OCRouterMessageText -Message $Message -IncludeReasoningParts $IncludeReasoningParts
    if ([string]::IsNullOrWhiteSpace($Text)) {
      continue
    }

    $TrimmedText = $Text.Trim()

    $Candidates.Add([pscustomobject]@{
      MessageIndex = $Index
      Role = $Role
      MessageId = Get-OCRouterMessageId -Message $Message
      Timestamp = Get-OCRouterMessageTimestamp -Message $Message
      Text = $TrimmedText
      TextLength = $TrimmedText.Length
      OutputKind = Get-OCRouterOutputKind -Text $TrimmedText
      IsProgressLike = Test-OCRouterProgressLikeOutput -Text $TrimmedText
      Message = $Message
    })
  }

  $CandidateArray = @($Candidates.ToArray())
  $HasTimestamp = $false
  foreach ($Candidate in $CandidateArray) {
    if ($null -ne $Candidate.Timestamp) {
      $HasTimestamp = $true
      break
    }
  }

  if ($HasTimestamp) {
    $CandidateArray = @($CandidateArray | Sort-Object -Property @{ Expression = "Timestamp"; Descending = $true }, @{ Expression = "MessageIndex"; Descending = $true })
  }
  elseif ($AssumeNewestFirst) {
    $CandidateArray = @($CandidateArray | Sort-Object -Property @{ Expression = "MessageIndex"; Descending = $false })
  }
  else {
    $CandidateArray = @($CandidateArray | Sort-Object -Property @{ Expression = "MessageIndex"; Descending = $true })
  }

  if (-not [string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
    $CandidateArray = @($CandidateArray | Where-Object {
      Test-OCRouterExpectedOutputKind -Text $_.Text -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext
    })
  }

  return @($CandidateArray | Select-Object -First $CandidateCount)
}

function Get-OCRouterLatestRawAssistantMessage {
  param(
    [object[]]$Messages,
    [bool]$AssumeNewestFirst = $true
  )

  $RawCandidates = New-Object System.Collections.Generic.List[object]
  for ($Index = 0; $Index -lt $Messages.Count; $Index++) {
    $Message = $Messages[$Index]
    $Role = Get-OCRouterMessageRole -Message $Message
    if ($Role -eq 'user' -or $Role -eq 'tool' -or $Role -eq 'system') { continue }
    $MessageId = Get-OCRouterMessageId -Message $Message
    if ([string]::IsNullOrWhiteSpace($MessageId)) { continue }
    $RawCandidates.Add([pscustomobject]@{
      MessageIndex = $Index
      MessageId = $MessageId
      Timestamp = Get-OCRouterMessageTimestamp -Message $Message
      Role = $Role
      Message = $Message
    })
  }
  $Array = @($RawCandidates.ToArray())
  if ($Array.Count -eq 0) { return $null }
  if (@($Array | Where-Object { $null -ne $_.Timestamp }).Count -gt 0) {
    return @($Array | Sort-Object -Property @{ Expression = 'Timestamp'; Descending = $true }, @{ Expression = 'MessageIndex'; Descending = $true })[0]
  }
  if ($AssumeNewestFirst) { return @($Array | Sort-Object -Property MessageIndex)[0] }
  return @($Array | Sort-Object -Property MessageIndex -Descending)[0]
}

function Get-OCRouterLatestRawAssistantMessageFromUri {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [bool]$AssumeNewestFirst,
    [int]$RequestTimeoutSeconds = 30
  )

  if ($RequestTimeoutSeconds -lt 1) { throw 'RequestTimeoutSeconds must be at least 1 for a raw assistant baseline read.' }
  $Response = Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers -ContentType 'application/json' -TimeoutSec $RequestTimeoutSeconds
  $Baseline = Get-OCRouterLatestRawAssistantMessage -Messages @(Get-OCRouterMessageCollection -Response $Response) -AssumeNewestFirst:$AssumeNewestFirst
  if ($null -eq $Baseline -or [string]::IsNullOrWhiteSpace([string]$Baseline.MessageId)) {
    throw "Cannot establish a raw assistant message-ID baseline for '$Uri'; routing fails closed."
  }
  return $Baseline
}

function Write-OCRouterSelectedCandidateSummary {
  param([object]$Candidate)

  $Id = if ([string]::IsNullOrWhiteSpace($Candidate.MessageId)) { "<none>" } else { $Candidate.MessageId }
  $Timestamp = if ($null -eq $Candidate.Timestamp) { "<unknown>" } else { $Candidate.Timestamp.ToString("o") }
  $Kind = if ($null -eq $Candidate.PSObject.Properties["OutputKind"]) { Get-OCRouterOutputKind -Text $Candidate.Text } else { [string]$Candidate.OutputKind }
  Write-Host "Selected latest output: role=$($Candidate.Role) kind=$Kind message_id=$Id timestamp=$Timestamp chars=$($Candidate.TextLength)"
}

function Write-OCRouterTextPreview {
  param(
    [string]$Text,
    [int]$MaxCharacters = 3000
  )

  Write-Host "----------------------------------------"
  if ($Text.Length -gt $MaxCharacters) {
    Write-Host $Text.Substring(0, $MaxCharacters)
    Write-Host "`n...[truncated preview]..."
  }
  else {
    Write-Host $Text
  }
  Write-Host "----------------------------------------"
}

function Write-OCRouterCandidateList {
  param([object[]]$Candidates)

  for ($Index = 0; $Index -lt $Candidates.Count; $Index++) {
    $Candidate = $Candidates[$Index]
    $Preview = ($Candidate.Text -replace "\s+", " ").Trim()
    if ($Preview.Length -gt 180) {
      $Preview = $Preview.Substring(0, 180) + "..."
    }
    $DisplayIndex = $Index + 1
    $Id = if ([string]::IsNullOrWhiteSpace($Candidate.MessageId)) { "<none>" } else { $Candidate.MessageId }
    $Timestamp = if ($null -eq $Candidate.Timestamp) { "<unknown>" } else { $Candidate.Timestamp.ToString("o") }
    $Kind = if ($null -eq $Candidate.PSObject.Properties["OutputKind"]) { Get-OCRouterOutputKind -Text $Candidate.Text } else { [string]$Candidate.OutputKind }
    Write-Host "$DisplayIndex. role=$($Candidate.Role) kind=$Kind message_id=$Id timestamp=$Timestamp chars=$($Candidate.TextLength)"
    Write-Host "   preview=$Preview"
  }
}

function Select-OCRouterOutputCandidate {
  param(
    [object[]]$Candidates,
    [switch]$AutoSelectLatest
  )

  if ($Candidates.Count -eq 0) {
    return $null
  }

  Write-Host "Latest assistant candidates found:" -ForegroundColor Cyan
  Write-OCRouterCandidateList -Candidates $Candidates

  if ($AutoSelectLatest) {
    Write-Host "AutoSelectLatest active. Using candidate 1." -ForegroundColor Yellow
    return $Candidates[0]
  }

  $Prompt = "Use candidate? [1-$($Candidates.Count)/N]"
  while ($true) {
    $Answer = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($Answer) -or $Answer -eq "n" -or $Answer -eq "N") {
      return $null
    }

    $Number = 0
    if ([int]::TryParse($Answer, [ref]$Number)) {
      if ($Number -ge 1 -and $Number -le $Candidates.Count) {
        return $Candidates[$Number - 1]
      }
    }

    Write-Host "Invalid selection." -ForegroundColor Yellow
  }
}

function Get-OCRouterSafeTimestamp {
  return (Get-Date -Format "yyyyMMdd-HHmmss")
}

function Get-OCRouterSafeName {
  param([string]$Value)

  $Safe = $Value -replace "[^A-Za-z0-9_-]", "-"
  if ([string]::IsNullOrWhiteSpace($Safe)) {
    return "session"
  }
  return $Safe
}

function Get-OCRouterSwarmAssistantPrompt {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $SlashMatch = [regex]::Match($Text, '(?ims)^\s*/swarm-review\b.*?(?=^\s*(WAITING\s+FOR\s+GO|META\s+STEP\s+REVIEW\s+DRAFT|FINAL\s+STEP\s+REVIEW\s+SYNTHESIS)\b|\z)')
  if ($SlashMatch.Success) {
    return $SlashMatch.Value.Trim()
  }

  $MarkerMatch = [regex]::Match($Text, '(?im)^.*SWARM\s+ASSISTANT\s+PROMPT.*$')
  if (-not $MarkerMatch.Success) {
    return ""
  }

  $AfterMarker = $Text.Substring($MarkerMatch.Index + $MarkerMatch.Length)
  $FenceMatch = [regex]::Match($AfterMarker, '(?ims)```(?:\w+)?\s*(.*?)\s*```')
  if ($FenceMatch.Success) {
    return $FenceMatch.Groups[1].Value.Trim()
  }

  $PromptMatch = [regex]::Match($AfterMarker, '(?ims).*?(?=^\s*(WAITING\s+FOR\s+GO|META\s+STEP\s+REVIEW\s+DRAFT|FINAL\s+STEP\s+REVIEW\s+SYNTHESIS)\b|\z)')
  if ($PromptMatch.Success) {
    return $PromptMatch.Value.Trim()
  }

  return ""
}

function Get-OCRouterSwarmReviewPacket {
  param([string]$Text)

  if (-not (Test-OCRouterStrictStepReviewPhase1Output -Text $Text)) {
    return ""
  }
  $Normalized = $Text -replace "`r`n", "`n"
  $Match = [regex]::Match($Normalized, '(?ms)^SWARM ASSISTANT PROMPT\s*\n/swarm-review(?:\s*\n|\s+)(?<packet>.*?)\nWAITING FOR GO\s*$')
  if (-not $Match.Success) {
    return ""
  }
  return $Match.Groups['packet'].Value.Trim()
}

function Test-OCRouterSwarmReviewPacketOutput {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 11) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  $Patterns = @(
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Candidate:\s*\S.+$', '^Evidence pointers:\s*\S.+$',
    '^Reviewed scope/acceptance:\s*\S.+$', '^Review focus:\s*\S.+$', '^Review profile:\s*\S.+$', '^Internal lanes:\s*\S.+$',
    '^Swarm depth:\s*(bounded|full|adaptive)$', '^Cost envelope:\s*\S.+$',
    '^Expansion approval receipt:\s*\S.+$'
  )
  $Values = @{}
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index]
    if ($Line -cnotmatch $Patterns[$Index] -or $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
    $Colon = $Line.IndexOf(':')
    $Values[$Line.Substring(0, $Colon)] = $Line.Substring($Colon + 1).Trim()
  }
  $ApprovalValue = [string]$Values['Expansion approval receipt']
  $ApprovalMatch = [regex]::Match($ApprovalValue, '^(?<path>.+)#(?<sha>[0-9A-Fa-f]{64})$')
  if ($ApprovalValue -cne 'NONE' -and -not $ApprovalMatch.Success) { return $false }

  if ($null -ne $Context) {
    foreach ($Name in @('target', 'epic', 'candidate', 'review_profile', 'internal_lanes', 'swarm_depth', 'cost_envelope')) {
      if ($null -eq $Context.PSObject.Properties[$Name] -or [string]::IsNullOrWhiteSpace([string]$Context.$Name)) { return $false }
    }
    foreach ($Binding in @(
      @('Target', 'target'), @('Epic', 'epic'), @('Candidate', 'candidate'), @('Review profile', 'review_profile'),
      @('Internal lanes', 'internal_lanes'), @('Swarm depth', 'swarm_depth'), @('Cost envelope', 'cost_envelope')
    )) {
      if ([string]$Values[$Binding[0]] -cne [string]$Context.($Binding[1])) { return $false }
    }
    foreach ($OptionalBinding in @(
      @('Evidence pointers', 'evidence_pointers'), @('Reviewed scope/acceptance', 'reviewed_scope_acceptance'), @('Review focus', 'review_focus')
    )) {
      if ($null -ne $Context.PSObject.Properties[$OptionalBinding[1]] -and
          -not [string]::IsNullOrWhiteSpace([string]$Context.($OptionalBinding[1])) -and
          [string]$Values[$OptionalBinding[0]] -cne [string]$Context.($OptionalBinding[1])) {
        return $false
      }
    }
    $ExpectedApprovalPath = if ($null -eq $Context.PSObject.Properties['expansion_approval_path']) { '' } else { [string]$Context.expansion_approval_path }
    if ([string]::IsNullOrWhiteSpace($ExpectedApprovalPath)) {
      if ($ApprovalValue -cne 'NONE') { return $false }
    }
    else {
      if ($null -eq $Context.PSObject.Properties['expansion_approval_sha256'] -or [string]::IsNullOrWhiteSpace([string]$Context.expansion_approval_sha256)) { return $false }
      if (-not $ApprovalMatch.Success -or
          $ApprovalMatch.Groups['path'].Value -cne $ExpectedApprovalPath -or
          $ApprovalMatch.Groups['sha'].Value -cne [string]$Context.expansion_approval_sha256 -or
          -not (Test-Path -LiteralPath $ExpectedApprovalPath -PathType Leaf) -or
          (Get-FileHash -Algorithm SHA256 -LiteralPath $ExpectedApprovalPath).Hash -cne [string]$Context.expansion_approval_sha256) {
        return $false
      }
    }
  }
  return $true
}

function Normalize-OCRouterSwarmReviewDepth {
  param([string]$Depth)

  $Value = if ([string]::IsNullOrWhiteSpace($Depth)) { "auto" } else { $Depth.Trim().ToLowerInvariant() }
  $Allowed = @("auto", "none", "adaptive", "full", "standard", "focused", "quick")
  if ($Allowed -notcontains $Value) {
    throw "SwarmReviewDepth must be one of: auto, none, adaptive, full, standard, focused, quick."
  }

  return $Value
}

function ConvertTo-OCRouterModelObject {
  param([string]$Model)

  if ([string]::IsNullOrWhiteSpace($Model)) {
    return $null
  }

  $Parts = $Model.Trim() -split "/", 2
  if ($Parts.Count -ne 2 -or [string]::IsNullOrWhiteSpace($Parts[0]) -or [string]::IsNullOrWhiteSpace($Parts[1])) {
    throw "Model must use provider/model syntax, for example openai/gpt-5.6-sol. Invalid value: '$Model'."
  }

  return [ordered]@{
    providerID = $Parts[0]
    modelID = $Parts[1]
  }
}

function New-OCRouterMessageRequestBodyObject {
  param(
    [string]$Text,
    [string]$Agent = "",
    [string]$Model = ""
  )

  $Body = [ordered]@{
    parts = @(
      [ordered]@{
        type = "text"
        text = $Text
      }
    )
  }
  if (-not [string]::IsNullOrWhiteSpace($Agent)) {
    $Body["agent"] = $Agent
  }
  if (-not [string]::IsNullOrWhiteSpace($Model)) {
    $Body["model"] = ConvertTo-OCRouterModelObject -Model $Model
  }
  return $Body
}

function New-OCRouterCommandRequestBodyObject {
  param(
    [string]$Command,
    [string]$Arguments = "",
    [string]$Agent = "",
    [string]$Model = ""
  )

  $Body = [ordered]@{
    command = $Command.Trim().TrimStart("/")
    arguments = $Arguments
  }
  if (-not [string]::IsNullOrWhiteSpace($Agent)) {
    $Body["agent"] = $Agent
  }
  if (-not [string]::IsNullOrWhiteSpace($Model)) {
    # The command endpoint accepts a provider/model string, unlike the
    # message endpoint which accepts the structured provider/model object.
    $null = ConvertTo-OCRouterModelObject -Model $Model
    $Body["model"] = $Model.Trim()
  }
  return $Body
}

function New-OCRouterPlanRevisionArgument {
  param(
    [string]$SourcePlanText,
    [string]$MetaReviewText
  )

  if ([string]::IsNullOrWhiteSpace($SourcePlanText)) {
    throw 'Cannot construct a plan-revision argument without the exact pinned source plan or fix-plan.'
  }
  if ([string]::IsNullOrWhiteSpace($MetaReviewText)) {
    throw 'Cannot construct a plan-revision argument without the matching exact Meta review.'
  }

  $SourceStartMarker = '=== OC ROUTER PINNED SOURCE PLAN OR FIX-PLAN START ==='
  $SourceEndMarker = '=== OC ROUTER PINNED SOURCE PLAN OR FIX-PLAN END ==='
  $ReviewStartMarker = '=== OC ROUTER MATCHING EXACT META REVIEW START ==='
  $ReviewEndMarker = '=== OC ROUTER MATCHING EXACT META REVIEW END ==='
  foreach ($Marker in @($SourceStartMarker, $SourceEndMarker, $ReviewStartMarker, $ReviewEndMarker)) {
    if ($SourcePlanText.Contains($Marker) -or $MetaReviewText.Contains($Marker)) {
      throw "Plan-revision source artifacts contain reserved router marker '$Marker'."
    }
  }

  return $SourceStartMarker + "`n" + $SourcePlanText + "`n" + $SourceEndMarker + "`n" +
    $ReviewStartMarker + "`n" + $MetaReviewText + "`n" + $ReviewEndMarker
}

function Test-OCRouterCommandRequiresParentSession {
  param([string]$CommandName)

  $Normalized = $CommandName.Trim().TrimStart('/').ToLowerInvariant()
  return $Normalized -in @('terv-review-utan', 'step-review-utan')
}

function Assert-OCRouterParentSessionCommandSafe {
  param(
    [string]$Server,
    [hashtable]$Headers,
    [string]$CommandName,
    [object[]]$CommandEntries = @()
  )

  if (-not (Test-OCRouterCommandRequiresParentSession -CommandName $CommandName)) {
    return
  }

  if ($CommandEntries.Count -eq 0) {
    $LiveResponse = Invoke-RestMethod `
      -Method Get `
      -Uri "$($Server.TrimEnd('/'))/command" `
      -Headers $Headers `
      -ContentType "application/json"
    $CommandEntries = @($LiveResponse)
  }

  $Normalized = $CommandName.Trim().TrimStart('/').ToLowerInvariant()
  $Entry = @($CommandEntries | Where-Object {
    [string]$_.name -eq $Normalized
  } | Select-Object -First 1)

  if ($Entry.Count -eq 0) {
    throw "Refusing /${Normalized}: the live OpenCode command registry has no matching entry. Restart OpenCode and verify the command before routing a continuity-critical handoff."
  }

  $RunsAsSubtask = $false
  if ($Entry[0].PSObject.Properties.Name -contains 'subtask' -and $null -ne $Entry[0].subtask) {
    $RunsAsSubtask = [bool]$Entry[0].subtask
  }

  if ($RunsAsSubtask) {
    throw "Refusing /${Normalized}: the live OpenCode command registry still reports subtask=true. The disk definition may already be fixed, but the running server has cached stale command metadata. Restart OpenCode, then retry; do not route this handoff into a child session."
  }
}

function Normalize-OCRouterReviewProfile {
  param([string]$Profile)

  $Value = if ([string]::IsNullOrWhiteSpace($Profile)) { "auto" } else { $Profile.Trim().ToLowerInvariant() }
  if ($Value -notmatch '^[a-z0-9][a-z0-9._-]*$') {
    throw "ReviewProfile must be 'auto' or a registry-declared identifier using letters, digits, dot, underscore, or hyphen."
  }
  return $Value
}

function Normalize-OCRouterProjectReviewContext {
  param([string]$Context)

  $Value = if ([string]::IsNullOrWhiteSpace($Context)) { "auto" } else { $Context.Trim().ToLowerInvariant() }
  if ($Value -notmatch '^[a-z0-9][a-z0-9._-]*$') {
    throw "ProjectReviewContext must be 'auto' or a registry-declared identifier using letters, digits, dot, underscore, or hyphen."
  }
  return $Value
}

function Get-OCRouterReviewRegistry {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw "ReviewRegistryPath is required for target-declared review profiles or lanes."
  }
  $Resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  try {
    $Registry = Get-Content -LiteralPath $Resolved -Raw | ConvertFrom-Json
  }
  catch {
    throw "Review registry is not valid JSON: $Resolved. $($_.Exception.Message)"
  }
  if ($null -eq $Registry -or [int]$Registry.version -lt 1) {
    throw "Review registry must declare version >= 1: $Resolved"
  }
  if ($null -eq $Registry.lanes -or $null -eq $Registry.projects) {
    throw "Review registry must declare top-level lanes and projects mappings: $Resolved"
  }
  $Registry | Add-Member -NotePropertyName resolved_path -NotePropertyValue $Resolved -Force
  $Registry | Add-Member -NotePropertyName sha256 -NotePropertyValue ((Get-FileHash -Algorithm SHA256 -LiteralPath $Resolved).Hash) -Force
  return $Registry
}

function Get-OCRouterBuiltInReviewProfiles {
  return @('quick', 'focused', 'standard', 'high_risk', 'deep', 'audit', 'wide', 'custom')
}

function Get-OCRouterKnownReviewLanes {
  return @(
    'intent-correctness',
    'tests-evidence',
    'scope-ownership',
    'security-safety',
    'architecture-boundaries',
    'regression-edge-cases',
    'domain-invariants',
    'maintainability-complexity',
    'contracts-compatibility',
    'concurrency-idempotency',
    'data-integrity-migrations',
    'reliability-failure-recovery',
    'performance-scalability',
    'observability-diagnostics',
    'deployment-rollout-rollback',
    'dependencies-supply-chain',
    'configuration-environments-iac',
    'privacy-data-governance',
    'documentation-dx',
    'ux-accessibility',
    'cost-capacity',
    'portability-platforms',
    'compliance-auditability'
  )
}

function Convert-OCRouterLegacyReviewLane {
  param([string]$Lane)
  $Value = ([string]$Lane).Trim().ToLowerInvariant()
  $Aliases = @{
    correctness_business_regression = 'intent-correctness'
    tests_evidence = 'tests-evidence'
    scope_acceptance_ownership = 'scope-ownership'
    security_safety = 'security-safety'
    architecture_contracts = 'architecture-boundaries'
    regression_edge_cases = 'regression-edge-cases'
    domain_specialist = 'domain-invariants'
  }
  if ($Aliases.ContainsKey($Value)) { return [string]$Aliases[$Value] }
  return $Value
}

function Get-OCRouterRegistryPropertyValue {
  param(
    [object]$Object,
    [string]$Name,
    [string]$Label
  )

  if ($null -eq $Object) {
    throw "Missing registry mapping while resolving $Label '$Name'."
  }
  $Property = @($Object.PSObject.Properties | Where-Object { $_.Name -ieq $Name })
  if ($Property.Count -ne 1) {
    throw "Review registry has no unique $Label mapping for '$Name'."
  }
  return $Property[0].Value
}

function Resolve-OCRouterReviewRegistryContext {
  param(
    [object]$Registry,
    [string]$ProjectReviewContext,
    [string]$ReviewProfile
  )

  $ProjectId = Normalize-OCRouterProjectReviewContext -Context $ProjectReviewContext
  if ($ProjectId -eq 'auto') {
    $ProjectId = if (-not [string]::IsNullOrWhiteSpace([string]$Registry.default_project)) {
      ([string]$Registry.default_project).Trim().ToLowerInvariant()
    }
    elseif (@($Registry.projects.PSObject.Properties).Count -eq 1) {
      ([string]@($Registry.projects.PSObject.Properties)[0].Name).Trim().ToLowerInvariant()
    }
    else {
      throw "ProjectReviewContext 'auto' is ambiguous. The review registry must declare default_project or contain exactly one project."
    }
  }

  $Project = Get-OCRouterRegistryPropertyValue -Object $Registry.projects -Name $ProjectId -Label 'project'
  $ProfileId = Normalize-OCRouterReviewProfile -Profile $ReviewProfile
  if ($ProfileId -eq 'auto' -and -not [string]::IsNullOrWhiteSpace([string]$Project.default_profile)) {
    $ProfileId = ([string]$Project.default_profile).Trim().ToLowerInvariant()
  }
  $Profile = $null
  if ($null -ne $Project.profiles -and $ProfileId -ne 'auto') {
    $ProfileProperty = @($Project.profiles.PSObject.Properties | Where-Object { $_.Name -ieq $ProfileId })
    if ($ProfileProperty.Count -gt 1) {
      throw "Review registry has duplicate profile mappings for '$ProjectId/$ProfileId'."
    }
    if ($ProfileProperty.Count -eq 1) {
      $Profile = $ProfileProperty[0].Value
    }
  }

  return [pscustomobject]@{
    project_id = $ProjectId
    project = $Project
    profile_id = $ProfileId
    profile = $Profile
    has_profile_mapping = ($null -ne $Profile)
  }
}

function Resolve-OCRouterReviewLanes {
  param(
    [int]$LaneCount,
    [string]$ReviewProfile,
    [string]$ReviewFocus = "",
    [string[]]$ImplementationTexts = @(),
    [object]$Registry,
    [object]$RegistryContext,
    [string[]]$RequestedReviewLanes = @(),
    [bool]$ExplicitReviewLanes = $false
  )

  if ($LaneCount -lt 0 -or $LaneCount -gt 7) {
    throw "MetaInternalLanes must be between 0 and 7."
  }

  if ($LaneCount -eq 0) {
    if (@($RequestedReviewLanes | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }).Count -gt 0) {
      throw "A zero-lane review profile cannot declare ReviewLanes."
    }
    return [pscustomobject]@{ lanes = @(); reason = "registry-zero-lane-profile" }
  }
  $Known = New-Object System.Collections.Generic.List[string]
  foreach ($Lane in @(Get-OCRouterKnownReviewLanes)) { $Known.Add($Lane) }
  if ($null -ne $Registry) {
    foreach ($LaneProperty in @($Registry.lanes.PSObject.Properties)) {
      $LaneId = $LaneProperty.Name.Trim().ToLowerInvariant()
      if ($LaneId -notmatch '^[a-z0-9][a-z0-9._-]*$') { throw "Invalid registry lane identifier '$LaneId'." }
      if (-not $Known.Contains($LaneId)) { $Known.Add($LaneId) }
    }
  }
  $Requested = New-Object System.Collections.Generic.List[string]
  foreach ($Value in @($RequestedReviewLanes)) {
    foreach ($Lane in @(([string]$Value) -split ",")) {
      $NormalizedLane = Convert-OCRouterLegacyReviewLane -Lane $Lane
      if ([string]::IsNullOrWhiteSpace($NormalizedLane)) { continue }
      if ($NormalizedLane -notmatch '^[a-z0-9][a-z0-9._-]*$' -or -not $Known.Contains($NormalizedLane)) {
        throw "Review lane '$NormalizedLane' is neither canonical nor declared by the target registry. Declared lanes: $($Known -join ', ')."
      }
      if (-not $Requested.Contains($NormalizedLane)) {
        $Requested.Add($NormalizedLane)
      }
    }
  }

  if ($ExplicitReviewLanes -or $Requested.Count -gt 0) {
    if ($Requested.Count -gt 7) {
      throw "At most 7 explicit review lanes may be selected."
    }
    if ($Requested.Count -ne $LaneCount) {
      throw "Explicit ReviewLanes count ($($Requested.Count)) must match MetaInternalLanes ($LaneCount)."
    }
    return [pscustomobject]@{
      lanes = @($Requested.ToArray())
      reason = "explicit-review-lanes"
    }
  }

  $Mapped = @()
  if ($null -ne $RegistryContext -and [bool]$RegistryContext.has_profile_mapping) {
    $Mapped = @($RegistryContext.profile.lanes | ForEach-Object { Convert-OCRouterLegacyReviewLane -Lane ([string]$_) } | Where-Object { $_ })
  }
  if ($Mapped.Count -eq 0) {
    $Signals = (($ReviewFocus, ($ImplementationTexts -join "`n")) -join "`n").ToLowerInvariant()
    $RiskLane = if ($Signals -match 'security|safety|secret|auth|permission|injection|shell|trust.boundary|redact') {
      'security-safety'
    }
    elseif ($Signals -match 'domain|business.logic|simulation|determinism|belief|failurepacket') {
      'domain-invariants'
    }
    elseif ($Signals -match 'regression|edge.case|compatib') {
      'regression-edge-cases'
    }
    else {
      'architecture-boundaries'
    }
    $Mapped = switch ($ReviewProfile) {
      'focused' { @($RiskLane) }
      'standard' { @('intent-correctness', 'tests-evidence', 'scope-ownership') }
      'high_risk' {
        $Fourth = if ($RiskLane -in @('intent-correctness', 'tests-evidence', 'scope-ownership')) { 'architecture-boundaries' } else { $RiskLane }
        @('intent-correctness', 'tests-evidence', 'scope-ownership', $Fourth)
      }
      'deep' { @('intent-correctness', 'tests-evidence', 'scope-ownership', 'security-safety', 'architecture-boundaries') }
      'audit' { @('intent-correctness', 'tests-evidence', 'scope-ownership', 'security-safety', 'architecture-boundaries') }
      'wide' { @('intent-correctness', 'tests-evidence', 'scope-ownership', 'security-safety', 'architecture-boundaries', 'regression-edge-cases', 'domain-invariants') }
      'quick' { @() }
      'custom' { throw "custom review requires explicit ReviewLanes." }
      default { throw "Unknown review profile '$ReviewProfile' is not declared by the target registry." }
    }
  }
  if ($Mapped.Count -lt $LaneCount) {
    throw "Review profile '$ReviewProfile' maps $($Mapped.Count) lanes but $LaneCount were requested."
  }
  $Resolved = @($Mapped | Select-Object -First $LaneCount)
  if (@($Resolved | Select-Object -Unique).Count -ne $Resolved.Count) {
    throw "Review profile '$ReviewProfile' contains duplicate lane IDs."
  }
  foreach ($Lane in $Resolved) {
    if (-not $Known.Contains($Lane)) {
      throw "Review profile '$ReviewProfile' references undeclared lane '$Lane'."
    }
  }

  return [pscustomobject]@{
    lanes = @($Resolved)
    reason = if ($null -ne $RegistryContext -and [bool]$RegistryContext.has_profile_mapping) { "target-registry-profile:$($RegistryContext.project_id)/$ReviewProfile" } else { "portable-canonical-profile:$ReviewProfile" }
  }
}

function Resolve-OCRouterSwarmReviewDepth {
  param(
    [string]$RequestedDepth = "auto",
    [object]$ReviewControls
  )

  $Depth = Normalize-OCRouterSwarmReviewDepth -Depth $RequestedDepth
  if ($null -eq $ReviewControls) {
    throw "ReviewControls are required to resolve Swarm depth."
  }
  if ([bool]$ReviewControls.skip_swarm_review) {
    if ($Depth -notin @('auto', 'none')) {
      throw "The resolved review profile forbids Swarm; an explicit SwarmReviewDepth cannot override it."
    }
    return "none"
  }

  $AllowedDepth = [string]$ReviewControls.swarm_review_depth
  if ($AllowedDepth -notin @('standard', 'full')) {
    throw "Resolved review controls have invalid Swarm depth '$AllowedDepth'."
  }

  if ($Depth -eq 'auto') {
    return $AllowedDepth
  }
  if ($Depth -eq 'none') {
    return 'none'
  }
  if ($Depth -in @('full', 'adaptive') -and $AllowedDepth -ne 'full') {
    throw "Full Swarm is outside the resolved bounded review authority. Select an approved full/adaptive profile with OwnerApprovalRecord."
  }
  if ($Depth -eq 'adaptive') {
    return 'full'
  }
  if ($Depth -in @('quick', 'focused', 'standard')) {
    return $Depth
  }
  return $AllowedDepth
}

function New-OCRouterSwarmReviewControlBlock {
  param(
    [string]$Depth,
    [string]$Focus = ""
  )

  $EffectiveDepth = Normalize-OCRouterSwarmReviewDepth -Depth $Depth
  if ($EffectiveDepth -eq "auto") {
    $EffectiveDepth = "standard"
  }

  $Lines = New-Object System.Collections.Generic.List[string]
  $Lines.Add("ROUTER SWARM REVIEW CONTROLS:")
  $Lines.Add(("- Review depth: {0}" -f $EffectiveDepth))

  switch ($EffectiveDepth) {
    "full" {
      $Lines.Add("- Run the normal full Swarm review. Use every QA gate/subagent that is relevant to the task risk.")
      $Lines.Add("- Report blockers, regressions, missing tests, security issues, ownership drift, and unsupported claims.")
    }
    "standard" {
      $Lines.Add("- Run a standard Swarm review. Prioritize correctness, scope/ownership, tests, security when applicable, and integration risk.")
      $Lines.Add("- Skip repetitive or low-value gate work unless the implementation clearly needs escalation.")
    }
    "focused" {
      $Lines.Add("- Run a focused Swarm review. Do one concise pass for blockers, high-risk regressions, contract/scope drift, and meaningful test gaps.")
      $Lines.Add("- Do not fan out exhaustive subagent/gate work unless you find an obvious critical risk; if so, say that deeper review is needed.")
    }
    "quick" {
      $Lines.Add("- Run a quick Swarm smoke audit only. Report blockers, high-confidence regressions, and whether a deeper Swarm review is recommended.")
      $Lines.Add("- Avoid exhaustive QA gate fanout in this mode.")
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($Focus)) {
    $Lines.Add(("- Operator focus: {0}" -f $Focus.Trim()))
  }

  $Lines.Add("- If these controls conflict with an explicit safety, security, or user requirement, escalate and state why.")
  return ($Lines -join "`n")
}

function Add-OCRouterSwarmReviewControls {
  param(
    [string]$Prompt,
    [string]$Depth,
    [string]$Focus = ""
  )

  if ([string]::IsNullOrWhiteSpace($Prompt)) {
    return $Prompt
  }

  if (-not [string]::IsNullOrWhiteSpace($Depth) -and $Depth.Trim().ToLowerInvariant() -eq "none") {
    return $Prompt
  }

  $EffectiveDepth = Normalize-OCRouterSwarmReviewDepth -Depth $Depth

  if ($Prompt -match '(?im)^\s*ROUTER SWARM REVIEW CONTROLS:\s*$') {
    return $Prompt
  }

  $ControlBlock = New-OCRouterSwarmReviewControlBlock -Depth $EffectiveDepth -Focus $Focus
  $Normalized = $Prompt -replace "`r`n", "`n"
  $SlashMatch = [regex]::Match($Normalized, '(?m)^\s*/swarm-review\b.*$')
  if (-not $SlashMatch.Success) {
    return ($ControlBlock + "`n`n" + $Normalized.Trim())
  }

  $InsertAt = $SlashMatch.Index + $SlashMatch.Length
  $Before = $Normalized.Substring(0, $InsertAt).TrimEnd()
  $After = $Normalized.Substring($InsertAt).TrimStart()
  if ([string]::IsNullOrWhiteSpace($After)) {
    return ($Before + "`n`n" + $ControlBlock)
  }

  return ($Before + "`n`n" + $ControlBlock + "`n`n" + $After)
}

function Get-OCRouterTopLevelLineRecords {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @()
  }

  $Records = New-Object System.Collections.Generic.List[object]
  $Fence = ""
  $Lines = ($Text -replace "`r`n", "`n" -replace "`r", "`n") -split "`n"

  for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
    $Raw = [string]$Lines[$Index]
    $Trimmed = $Raw.Trim()
    if ([string]::IsNullOrWhiteSpace($Trimmed)) {
      continue
    }

    $FenceMatch = [regex]::Match($Trimmed, '^(?<marker>`{3,}|~{3,})')
    if ($FenceMatch.Success) {
      $Marker = $FenceMatch.Groups['marker'].Value.Substring(0, 3)
      if ([string]::IsNullOrWhiteSpace($Fence)) {
        $Fence = $Marker
      }
      elseif ($Fence -eq $Marker) {
        $Fence = ""
      }
      continue
    }

    if (-not [string]::IsNullOrWhiteSpace($Fence)) {
      continue
    }
    if ($Trimmed.StartsWith('>') -or $Raw -match '^(?: {4,}|\t)') {
      continue
    }

    $Records.Add([pscustomobject]@{
      LineIndex = $Index
      Text = $Trimmed
    })
  }

  return @($Records.ToArray())
}

function Get-OCRouterFinalStepReviewSynthesis {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  if (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text) {
    return $Text.Trim()
  }

  return ""
}

function Get-OCRouterNormalizedVerdict {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $Verdicts = New-Object System.Collections.Generic.List[string]
  foreach ($Record in @(Get-OCRouterTopLevelLineRecords -Text $Text)) {
    $Line = ([string]$Record.Text -replace '^#{1,6}\s*', '').Trim()
    if ($Line.StartsWith('"') -or $Line.StartsWith("'") -or $Line.StartsWith('`')) {
      continue
    }

    $Line = ($Line -replace '\*', '').Trim()
    $Match = [regex]::Match($Line, '^(?:Overall\s+verdict|Verdict)\s*:\s*(?<value>.+?)\s*$', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $Match.Success) {
      continue
    }

    $Normalized = ([regex]::Replace($Match.Groups['value'].Value.Trim().ToUpperInvariant(), '\s+', ' '))
    $Mapped = switch -Regex ($Normalized) {
      '^(GREEN|APPROVE|APPROVED|PASS)$' { 'GREEN'; break }
      '^(YELLOW|APPROVE WITH FIXES|CONCERNS|WARN|WARNING|NEEDS REVISION|NEEDS-REVISION)$' { 'YELLOW'; break }
      '^(RED|BLOCK|BLOCKED|REJECT|REJECTED|FAIL|FAILED)$' { 'RED'; break }
      default { '' }
    }
    if (-not [string]::IsNullOrWhiteSpace($Mapped)) {
      $Verdicts.Add($Mapped)
    }
    else {
      return ""
    }
  }

  $Unique = @($Verdicts.ToArray() | Select-Object -Unique)
  if ($Unique.Count -eq 1) {
    return [string]$Unique[0]
  }

  return ""
}

function Test-OCRouterCompactionSummaryLikeOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $HeadingHits = 0
  foreach ($Pattern in @(
    '(?im)^\s*##\s+Goal\s*$',
    '(?im)^\s*##\s+Constraints\s*&\s*Preferences\s*$',
    '(?im)^\s*##\s+Progress\s*$',
    '(?im)^\s*##\s+Key\s+Decisions\s*$',
    '(?im)^\s*##\s+Next\s+Steps\s*$',
    '(?im)^\s*##\s+Relevant\s+Files\s*$',
    '(?im)^\s*##\s+Critical\s+Context\s*$'
  )) {
    if ($Text -match $Pattern) {
      $HeadingHits += 1
    }
  }

  return $HeadingHits -ge 3
}

function Test-OCRouterOpaqueArtifactIdentity {
  param([string]$Identity)

  if ([string]::IsNullOrWhiteSpace($Identity)) { return $false }
  return $Identity -cmatch '^[A-Za-z0-9][A-Za-z0-9._@:+~-]*$'
}

function Test-OCRouterFixPlanOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 12) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})' -or [string]$RawLine -match '\s$') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'FIX_PLAN_REQUIRED' -or [string]$Lines[11] -cne 'FIX_PLAN_READY_FOR_IMPLEMENT') { return $false }
  $Patterns = @(
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Candidate:\s*\S.+$',
    '^Accountable Lane / class / profile:\s*\S.+$', '^Accepted finding IDs:\s*\S.+$',
    '^Allowed surfaces:\s*\S.+$', '^Forbidden surfaces:\s*\S.+$',
    '^Finding -> change -> acceptance/check:\s*\S.+$', '^Dependencies:\s*\S.+$',
    '^Fix-plan artifact:\s*\S.+$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    if ($Line -cnotmatch $Patterns[$Index] -or $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }
  $IdsValue = ([string]$Lines[5] -replace '^Accepted finding IDs:\s*', '').Trim()
  $JsonString = '"(?:\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4}|[^"\\\x00-\x1F])*"'
  if ($IdsValue -cnotmatch ('^\[' + $JsonString + '(?:,' + $JsonString + ')*\]$')) { return $false }
  try {
    $ParsedIds = ConvertFrom-Json -InputObject $IdsValue
    $Ids = @($ParsedIds)
  }
  catch { return $false }
  if ($Ids.Count -eq 0) { return $false }
  $SeenIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($Id in $Ids) {
    if ($Id -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Id) -or
        [string]$Id -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})' -or
        -not $SeenIds.Add([string]$Id)) { return $false }
  }
  $ArtifactIdentity = ([string]$Lines[10] -replace '^Fix-plan artifact:\s*', '')
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $ArtifactIdentity)) { return $false }
  return $true
}

function Get-OCRouterFixPlanAcceptedFindingIds {
  param([string]$Text)

  if (-not (Test-OCRouterFixPlanOutput -Text $Text)) { return @() }
  $Value = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Accepted finding IDs'
  try {
    # Windows PowerShell 5.1 can preserve a JSON array as one nested Object[].
    # Pipe the parsed value so callers always receive the individual string IDs.
    return @((ConvertFrom-Json -InputObject $Value) | ForEach-Object { $_ })
  }
  catch { return @() }
}

function Test-OCRouterUnclearOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Records = @(Get-OCRouterTopLevelLineRecords -Text $Text)
  if ($Records.Count -lt 2 -or (Get-OCRouterModeFromText -Text $Text) -ne 'UNCLEAR') {
    return $false
  }

  $ClassMarkers = @($Records | Where-Object { [string]$_.Text -ceq 'UNCLEAR' })
  if ($ClassMarkers.Count -ne 1 -or [string]$Records[0].Text -cne 'UNCLEAR') {
    return $false
  }

  if (@($Records | Where-Object {
    [string]$_.Text -match '^(?i:Next\s+route)\s*:' -or
    [string]$_.Text -in @('ACK_ONLY', 'FIX_PLAN_REQUIRED', 'FIX_PLAN_READY_FOR_IMPLEMENT', 'REVIEW_READY', 'IMPLEMENT_BLOCKED', 'PLAN_REVISION_COMPLETE', 'IMPLEMENT_READY')
  }).Count -gt 0) {
    return $false
  }

  return ($Records.Count -gt 1)
}

function Test-OCRouterRevisedTrackPlanOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 16) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})' -or [string]$RawLine -match '\s$') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'REVISED EPIC IMPLEMENTATION PLAN') { return $false }
  $Patterns = @(
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Wave:\s*\S.+$', '^Accountable Lane / class / profile:\s*\S.+$',
    '^Prerequisites/current state:\s*\S.+$', '^Scope/non-goals:\s*\S.+$', '^Interfaces/ownership:\s*\S.+$',
    '^Feature -> User Story -> Task:\s*\S.+$', '^Risks:\s*\S.+$', '^Ordered implementation plan:\s*\S.+$',
    '^Acceptance -> verification -> evidence:\s*\S.+$', '^Handoffs/exact blockers:\s*\S.+$', '^Plan artifact:\s*\S.+$',
    '^Next route:\s*\S.+$', '^Readiness:\s*(READY|BLOCKED)$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    if ($Line -cnotmatch $Patterns[$Index] -or $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }
  $HierarchyValue = ([string]$Lines[8] -replace '^Feature -> User Story -> Task:\s*', '')
  if ($HierarchyValue -notmatch '(?i)\bFeature\b.+\bUser\s+Story\b.+\bTask\b') { return $false }
  $Route = ([string]$Lines[14] -replace '^Next route:\s*', '').Trim()
  $Readiness = ([string]$Lines[15] -replace '^Readiness:\s*', '').Trim()
  $ArtifactIdentity = ([string]$Lines[13] -replace '^Plan artifact:\s*', '')
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $ArtifactIdentity)) { return $false }
  if ($Readiness -ceq 'READY') { return ($Route -ceq '/implement') }
  return ($Route -match '^(?i:Meta(?:\s+Coordinator)?|Orchestrator|Meta/Orchestrator)(?:\s+.+)?$')
}

function Test-OCRouterRevisedReviewFixPlanOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 14) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})' -or [string]$RawLine -match '\s$') { return $false }
  }
  $Lines = @($RawLines)
  if ([string]$Lines[0] -cne 'REVISED REVIEW-FIX PLAN' -or [string]$Lines[13] -cne 'FIX_PLAN_READY_FOR_IMPLEMENT') { return $false }
  $Patterns = @(
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Candidate:\s*\S.+$',
    '^Accountable Lane / class / profile:\s*\S.+$', '^Accepted finding IDs:\s*\S.+$',
    '^Allowed surfaces:\s*\S.+$', '^Forbidden surfaces:\s*\S.+$',
    '^Finding -> change -> acceptance/check:\s*\S.+$', '^Dependencies:\s*\S.+$',
    '^Fix-plan artifact:\s*\S.+$', '^Next route:\s*\S.+$', '^Readiness:\s*(READY|BLOCKED)$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    if ($Line -cnotmatch $Patterns[$Index] -or $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }
  $IdsValue = ([string]$Lines[5] -replace '^Accepted finding IDs:\s*', '')
  $JsonString = '"(?:\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4}|[^"\\\x00-\x1F])*"'
  if ($IdsValue -cnotmatch ('^\[' + $JsonString + '(?:,' + $JsonString + ')*\]$')) { return $false }
  try {
    $ParsedIds = ConvertFrom-Json -InputObject $IdsValue
    $Ids = @($ParsedIds)
  }
  catch { return $false }
  if ($Ids.Count -eq 0) { return $false }
  $SeenIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($Id in $Ids) {
    if ($Id -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Id) -or
        [string]$Id -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})' -or
        -not $SeenIds.Add([string]$Id)) { return $false }
  }
  $ArtifactIdentity = ([string]$Lines[10] -replace '^Fix-plan artifact:\s*', '')
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $ArtifactIdentity)) { return $false }
  $Route = ([string]$Lines[11] -replace '^Next route:\s*', '')
  $Readiness = ([string]$Lines[12] -replace '^Readiness:\s*', '')
  if ($Readiness -ceq 'READY') { return ($Route -ceq '/implement') }
  return ($Route -match '^(?i:Meta(?:\s+Coordinator)?|Orchestrator|Meta/Orchestrator)(?:\s+.+)?$')
}

function Test-OCRouterPlanRevisionOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})' -or [string]$RawLine -match '\s$') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  $SummaryIndexes = @(for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
    if ([string]$Lines[$Index] -ceq 'DELIVERY PLAN REVISION') { $Index }
  })
  if ($SummaryIndexes.Count -ne 1) { return $false }
  $SummaryIndex = [int]$SummaryIndexes[0]
  if (($Lines.Count - $SummaryIndex) -ne 9) { return $false }

  # A revision is never summary-only and never reuses the INITIAL /terv-review
  # route. It carries the complete corrected plan under its own class heading.
  $PlanClass = switch ([string]$Lines[0]) {
    'REVISED EPIC IMPLEMENTATION PLAN' { 'EPIC_PLAN' }
    'REVISED REVIEW-FIX PLAN' { 'REVIEW_FIX_PLAN' }
    default { return $false }
  }
  $ExpectedSummaryIndex = if ($PlanClass -ceq 'EPIC_PLAN') { 16 } else { 14 }
  if ($SummaryIndex -ne $ExpectedSummaryIndex) { return $false }
  $Preamble = @($Lines[0..($SummaryIndex - 1)]) -join "`n"
  if (($PlanClass -ceq 'EPIC_PLAN' -and -not (Test-OCRouterRevisedTrackPlanOutput -Text $Preamble)) -or
      ($PlanClass -ceq 'REVIEW_FIX_PLAN' -and -not (Test-OCRouterRevisedReviewFixPlanOutput -Text $Preamble))) { return $false }
  $Summary = @($Lines[$SummaryIndex..($Lines.Count - 1)])
  $Patterns = @(
    '^Target:\s*\S.+$',
    '^Epic:\s*\S.+$',
    '^Accountable Lane / class / profile:\s*\S.+$',
    '^Applied review items:\s*\S.+$',
    '^Rejected/unclear items:\s*\S.+$',
    '^Final plan artifact:\s*\S.+$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    if ([string]$Summary[$Index + 1] -cnotmatch $Patterns[$Index] -or
        [string]$Summary[$Index + 1] -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') {
      return $false
    }
  }
  if ([string]$Summary[7] -cne 'PLAN_REVISION_COMPLETE' -or [string]$Summary[8] -cnotmatch '^IMPLEMENT_(READY|BLOCKED)$') {
    return $false
  }
  $ReadinessIndex = if ($PlanClass -ceq 'EPIC_PLAN') { 15 } else { 12 }
  $ArtifactIndex = if ($PlanClass -ceq 'EPIC_PLAN') { 13 } else { 10 }
  $ArtifactLabel = if ($PlanClass -ceq 'EPIC_PLAN') { 'Plan artifact' } else { 'Fix-plan artifact' }
  $RevisionReadiness = ([string]$Lines[$ReadinessIndex] -replace '^Readiness:\s*', '')
  if (($RevisionReadiness -ceq 'READY' -and [string]$Summary[8] -cne 'IMPLEMENT_READY') -or
      ($RevisionReadiness -ceq 'BLOCKED' -and [string]$Summary[8] -cne 'IMPLEMENT_BLOCKED')) { return $false }
  foreach ($Pair in @(@(1, 1, 'Target'), @(2, 2, 'Epic'), @(4, 3, 'Accountable Lane / class / profile'))) {
    $BodyValue = ([string]$Lines[$Pair[0]] -replace ('^' + [regex]::Escape([string]$Pair[2]) + ':\s*'), '')
    $SummaryValue = ([string]$Summary[$Pair[1]] -replace ('^' + [regex]::Escape([string]$Pair[2]) + ':\s*'), '')
    if ($BodyValue -cne $SummaryValue) { return $false }
  }
  $BodyArtifact = ([string]$Lines[$ArtifactIndex] -replace ('^' + [regex]::Escape($ArtifactLabel) + ':\s*'), '')
  $SummaryArtifact = ([string]$Summary[6] -replace '^Final plan artifact:\s*', '')
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $BodyArtifact) -or $BodyArtifact -cne $SummaryArtifact) { return $false }
  $AllTerminals = @($Lines | Where-Object { [string]$_ -cmatch '^(?:PLAN_REVISION_COMPLETE|IMPLEMENT_READY|IMPLEMENT_BLOCKED)$' })
  return ($AllTerminals.Count -eq 2)
}

function Test-OCRouterPlanRevisionContextBinding {
  param(
    [string]$Text,
    [object]$Context
  )

  if ($null -eq $Context) { return $true }
  if (-not (Test-OCRouterPlanRevisionOutput -Text $Text)) { return $false }
  foreach ($Name in @('target', 'epic', 'accountable_lane', 'lane_class', 'lane_profile')) {
    if ($null -eq $Context.PSObject.Properties[$Name] -or [string]::IsNullOrWhiteSpace([string]$Context.$Name)) { return $false }
  }
  $Lines = @(($Text -replace "`r`n", "`n" -replace "`r", "`n") -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $ObservedPlanClass = if ([string]$Lines[0] -ceq 'REVISED EPIC IMPLEMENTATION PLAN') { 'EPIC_PLAN' } elseif ([string]$Lines[0] -ceq 'REVISED REVIEW-FIX PLAN') { 'REVIEW_FIX_PLAN' } else { return $false }
  if ($null -ne $Context.PSObject.Properties['plan_class'] -and
      -not [string]::IsNullOrWhiteSpace([string]$Context.plan_class) -and
      [string]$Context.plan_class -cne $ObservedPlanClass) { return $false }
  $ExpectedLane = "{0} / {1} / {2}" -f [string]$Context.accountable_lane, [string]$Context.lane_class, [string]$Context.lane_profile
  if (([string]$Lines[1] -replace '^Target:\s*', '').Trim() -cne [string]$Context.target -or
      ([string]$Lines[2] -replace '^Epic:\s*', '').Trim() -cne [string]$Context.epic -or
      ([string]$Lines[4] -replace '^Accountable Lane / class / profile:\s*', '').Trim() -cne $ExpectedLane) { return $false }
  if ($ObservedPlanClass -ceq 'EPIC_PLAN' -and $null -ne $Context.PSObject.Properties['wave'] -and -not [string]::IsNullOrWhiteSpace([string]$Context.wave) -and
      ([string]$Lines[3] -replace '^Wave:\s*', '').Trim() -cne [string]$Context.wave) { return $false }
  if ($ObservedPlanClass -ceq 'REVIEW_FIX_PLAN') {
    foreach ($Name in @('candidate', 'accepted_finding_ids')) {
      if ($null -eq $Context.PSObject.Properties[$Name]) { return $false }
    }
    $Candidate = ([string]$Lines[3] -replace '^Candidate:\s*', '')
    if ($Candidate -cne [string]$Context.candidate) { return $false }
    $ObservedIds = @(Get-OCRouterFixPlanAcceptedFindingIds -Text ((@('FIX_PLAN_REQUIRED') + @($Lines[1..10]) + @('FIX_PLAN_READY_FOR_IMPLEMENT')) -join "`n") | ForEach-Object { [string]$_ } | Sort-Object)
    $ExpectedIds = @($Context.accepted_finding_ids | ForEach-Object { [string]$_ } | Sort-Object)
    if (($ObservedIds -join "`n") -cne ($ExpectedIds -join "`n")) { return $false }
  }
  return $true
}

function Test-OCRouterMetaPlanReviewOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 12) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})' -or [string]$RawLine -match '\s$') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'META PLAN REVIEW') { return $false }
  $Patterns = @(
    '^Target:\s*\S.+$',
    '^Epic:\s*\S.+$',
    '^Plan class:\s*(EPIC_PLAN|REVIEW_FIX_PLAN)$',
    '^Plan artifact:\s*\S.+$',
    '^Accountable Lane / class / profile:\s*\S.+$',
    '^Overall verdict:\s*(GREEN|YELLOW|RED)$',
    '^Blocking corrections:\s*\S.+$',
    '^Non-blocking improvements:\s*\S.+$',
    '^Ownership/dependency decision:\s*\S.+$',
    '^Acceptance/evidence decision:\s*\S.+$',
    '^Exact Delivery Lane action:\s*invoke /terv-review-utan with this review$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    if ($Line -cnotmatch $Patterns[$Index] -or
        $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})' -or
        $Line -match '(?:ACK_ONLY|FIX_PLAN_REQUIRED|FIX_PLAN_READY_FOR_IMPLEMENT|PLAN_REVISION_COMPLETE|IMPLEMENT_READY|IMPLEMENT_BLOCKED|REVIEW_READY|WAITING FOR GO|FINAL STEP REVIEW SYNTHESIS)') {
      return $false
    }
  }
  $ArtifactIdentity = ([string]$Lines[4] -replace '^Plan artifact:\s*', '')
  return (Test-OCRouterOpaqueArtifactIdentity -Identity $ArtifactIdentity)
}

function Get-OCRouterSectionHitCount {
  param(
    [string]$Text,
    [string[]]$Patterns
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return 0
  }

  $Hits = 0
  foreach ($Pattern in $Patterns) {
    if ($Text -match $Pattern) {
      $Hits += 1
    }
  }

  return $Hits
}

function Test-OCRouterTrackPlanOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 16) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})' -or [string]$RawLine -match '\s$') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'EPIC IMPLEMENTATION PLAN') { return $false }
  $Patterns = @(
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Wave:\s*\S.+$', '^Accountable Lane / class / profile:\s*\S.+$',
    '^Prerequisites/current state:\s*\S.+$', '^Scope/non-goals:\s*\S.+$', '^Interfaces/ownership:\s*\S.+$',
    '^Feature -> User Story -> Task:\s*\S.+$', '^Risks:\s*\S.+$', '^Ordered implementation plan:\s*\S.+$',
    '^Acceptance -> verification -> evidence:\s*\S.+$', '^Handoffs/exact blockers:\s*\S.+$', '^Plan artifact:\s*\S.+$',
    '^Next route:\s*\S.+$', '^Readiness:\s*(READY|NOT_READY|BLOCKED)$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    if ($Line -cnotmatch $Patterns[$Index] -or $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }

  $HierarchyValue = ([string]$Lines[8] -replace '^Feature -> User Story -> Task:\s*', '')
  if ($HierarchyValue -notmatch '(?i)\bFeature\b.+\bUser\s+Story\b.+\bTask\b') {
    return $false
  }

  $ReadinessValue = ([string]$Lines[15] -replace '^Readiness:\s*', '').Trim()
  $RouteValue = ([string]$Lines[14] -replace '^Next route:\s*', '').Trim()
  $ArtifactIdentity = ([string]$Lines[13] -replace '^Plan artifact:\s*', '')
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $ArtifactIdentity)) { return $false }
  if ($ReadinessValue -eq 'READY') {
    return $RouteValue -ceq '/terv-review'
  }

  if ($RouteValue -notmatch '^(?i:Meta(?:\s+Coordinator)?|Orchestrator|Meta/Orchestrator)$') {
    return $false
  }
  return $true
}

function Test-OCRouterTrackImplementationOutput {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 14) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'IMPLEMENTATION RESULT') { return $false }
  $Patterns = @(
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Accountable Lane / class / profile:\s*\S.+$', '^Plan/fix-plan identity:\s*\S.+$',
    '^Changed artifacts:\s*\S.+$', '^Explicit non-changes:\s*\S.+$', '^Acceptance mapping:\s*\S.+$',
    '^Checks/results:\s*\S.+$', '^Candidate identity/worktree limitations:\s*\S.+$', '^Diff self-review:\s*\S.+$',
    '^Unresolved risks/findings:\s*\S.+$', '^Exact route:\s*\S.+$', '^(REVIEW_READY|IMPLEMENT_BLOCKED)$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    $PlaceholderCheckLine = $Line
    if ($Index -eq 7) {
      $PlaceholderCheckLine = $PlaceholderCheckLine -replace '(?i)\bTODO/FIXME/HACK/XXX/unimplemented search found no match\b', 'negative-marker search found no match'
    }
    if ($Line -cnotmatch $Patterns[$Index] -or $PlaceholderCheckLine -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }
  $PlanArtifactIdentity = ([string]$RawLines[4] -replace '^Plan/fix-plan identity:\s*', '')
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $PlanArtifactIdentity)) { return $false }
  if ($null -ne $Context -and $null -ne $Context.PSObject.Properties['plan_artifact_identity']) {
    $ExpectedPlanArtifactIdentity = [string]$Context.plan_artifact_identity
    if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $ExpectedPlanArtifactIdentity) -or
        $PlanArtifactIdentity -cne $ExpectedPlanArtifactIdentity) { return $false }
  }
  $TerminalValue = [string]$Lines[13]
  $RouteValue = ([string]$Lines[12] -replace '^Exact route:\s*', '').Trim()
  if ($TerminalValue -ceq 'REVIEW_READY') {
    return $RouteValue -ceq 'Meta /step-review'
  }

  return $RouteValue -match '^(?i:Meta(?:\s+Coordinator)?|Orchestrator|Meta/Orchestrator)(?:\s+.+)?$'
}

function Test-OCRouterStrictStepReviewPhase1Output {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 14) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'SWARM ASSISTANT PROMPT' -or [string]$Lines[1] -cne '/swarm-review' -or [string]$Lines[13] -cne 'WAITING FOR GO') {
    return $false
  }
  $Packet = @($Lines[2..12]) -join "`n"
  return (Test-OCRouterSwarmReviewPacketOutput -Text $Packet -Context $Context)
}

function Test-OCRouterStrictSwarmReviewOutput {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 13) { return $false }
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})') { return $false }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'SWARM REVIEW RESULT') { return $false }
  $Patterns = @(
    '^Verdict:\s*(APPROVE|APPROVE WITH FIXES|BLOCK)$',
    '^Acceptance authority:\s*ADVISORY_ONLY_META_DECIDES$',
    '^Target:\s*\S.+$', '^Epic:\s*\S.+$', '^Candidate:\s*\S.+$', '^Reviewed scope:\s*\S.+$',
    '^Findings:\s*\S.+$',
    '^Coverage:\s*\S.+$', '^Gates/evidence:\s*\S.+$',
    '^Verification gaps/residual risk:\s*\S.+$', '^Evidence files:\s*\S.+$',
    '^Meta Coordinator triage packet:\s*\S.+$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    $Line = [string]$Lines[$Index + 1]
    if ($Line -cnotmatch $Patterns[$Index] -or $Line -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }
  if ($null -ne $Context) {
    foreach ($Binding in @(@('Target', 'target', 3), @('Epic', 'epic', 4), @('Candidate', 'candidate', 5), @('Reviewed scope', 'reviewed_scope', 6))) {
      if ($null -eq $Context.PSObject.Properties[$Binding[1]] -or [string]::IsNullOrWhiteSpace([string]$Context.($Binding[1]))) { return $false }
      $Actual = ([string]$Lines[$Binding[2]] -replace ('^' + [regex]::Escape([string]$Binding[0]) + ':\s*'), '').Trim()
      if ($Actual -cne [string]$Context.($Binding[1])) { return $false }
    }
  }
  $FindingsValue = ([string]$Lines[7] -replace '^Findings:\s*', '').Trim()
  if ($FindingsValue -ceq 'NONE') { return $true }
  $JsonString = '"(?:\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4}|[^"\\\x00-\x1F])*"'
  $FindingPattern = '\{"id":(?<id>' + $JsonString + '),"severity":(?<severity>"(?:Blocking|Major|Minor|Nit)"),"evidence":(?<evidence>' + $JsonString + '),"impact":(?<impact>' + $JsonString + '),"direction":(?<direction>"(?:ACCEPT|REJECT|DOWNGRADE|FIX)"),"confidence":(?<confidence>"(?:HIGH|MEDIUM|LOW)"),"meta_suggestion":(?<suggestion>' + $JsonString + ')\}'
  if ($FindingsValue -cnotmatch ('^\[' + $FindingPattern + '(?:,' + $FindingPattern + ')*\]$')) { return $false }
  try {
    $ParsedFindings = ConvertFrom-Json -InputObject $FindingsValue
    $Findings = @($ParsedFindings)
  }
  catch { return $false }
  if ($Findings.Count -eq 0) { return $false }
  $SeenIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($Finding in $Findings) {
    $PropertyNames = @($Finding.PSObject.Properties.Name)
    if ($PropertyNames.Count -ne 7 -or ($PropertyNames -join "`n") -cne "id`nseverity`nevidence`nimpact`ndirection`nconfidence`nmeta_suggestion") { return $false }
    foreach ($Name in @('id', 'evidence', 'impact', 'meta_suggestion')) {
      $Value = [string]$Finding.$Name
      if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
    }
    if (-not $SeenIds.Add([string]$Finding.id)) { return $false }
  }
  return $true
}

function Get-OCRouterSwarmFindingIds {
  param([string]$Text)

  if (-not (Test-OCRouterStrictSwarmReviewOutput -Text $Text)) { return @() }
  $Value = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Findings'
  if ($Value -ceq 'NONE') { return @() }
  try { return @((ConvertFrom-Json -InputObject $Value) | ForEach-Object { [string]$_.id }) }
  catch { return @() }
}

function Test-OCRouterStrictFinalStepReviewSynthesisOutput {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 16) {
    return $false
  }

  # A final synthesis is a routing artifact, not a prose container. Reject
  # quoted/fenced/indented examples and require the complete block verbatim.
  foreach ($RawLine in $RawLines) {
    if ([string]$RawLine -match '^(?:\s|>|`{3,}|~{3,})') {
      return $false
    }
  }
  $Lines = @($RawLines | ForEach-Object { ([string]$_).TrimEnd() })
  if ([string]$Lines[0] -cne 'FINAL STEP REVIEW SYNTHESIS') {
    return $false
  }

  $Patterns = @(
    '^Target:\s*\S.+$',
    '^Epic:\s*\S.+$',
    '^Candidate:\s*\S.+$',
    '^Accountable Lane / class / profile:\s*\S.+$',
    '^Reviewed scope:\s*\S.+$',
    '^Overall verdict:\s*(GREEN|YELLOW|RED)$',
    '^Review routing:\s*\S.+$',
    '^Acceptance/evidence matrix:\s*\S.+$',
    '^Accepted findings:\s*\S.+$',
    '^Rejected/downgraded findings:\s*\S.+$',
    '^Verification result:\s*\S.+$',
    '^Proposed closeout delta:\s*\S.+$',
    '^Closeout disposition:\s*(ALLOWED|FIX_REQUIRED|BLOCKED)$',
    '^Commit status:\s*DEFERRED_TO_CLOSEOUT$',
    '^Exact Delivery Lane action:\s*invoke /step-review-utan with this exact synthesis$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    if ([string]$Lines[$Index + 1] -cnotmatch $Patterns[$Index]) {
      return $false
    }
  }

  $Values = @{}
  foreach ($Line in $Lines[1..15]) {
    $Colon = ([string]$Line).IndexOf(':')
    if ($Colon -lt 1) { return $false }
    $Values[([string]$Line).Substring(0, $Colon)] = ([string]$Line).Substring($Colon + 1).Trim()
  }
  foreach ($Name in @('Target', 'Epic', 'Accountable Lane / class / profile', 'Candidate', 'Reviewed scope', 'Review routing', 'Acceptance/evidence matrix', 'Accepted findings', 'Rejected/downgraded findings', 'Verification result')) {
    $Value = [string]$Values[$Name]
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') {
      return $false
    }
  }

  $Routing = [string]$Values['Review routing']
  if ($Routing -cnotmatch '^budget_policy=(?<budget>conserve|balanced|quality_first|exact|exact \+ expanded_audit); shape=(?<shape>META_ONLY|FOCUSED|STANDARD|DEEP|WIDE|EXPANDED_AUDIT); assignments=(?<assignments>.+?); omitted_domains=(?<omitted>.+?); escalation=(?<escalation>.+?); limitations=(?<limitations>.+)$') {
    return $false
  }
  $RoutingFields = [ordered]@{
    budget = [string]$Matches.budget
    shape = [string]$Matches.shape
    assignments = [string]$Matches.assignments
    omitted = [string]$Matches.omitted
    escalation = [string]$Matches.escalation
    limitations = [string]$Matches.limitations
  }
  foreach ($RoutingValue in $RoutingFields.Values) {
    if ([string]::IsNullOrWhiteSpace([string]$RoutingValue) -or [string]$RoutingValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') {
      return $false
    }
  }
  if (($RoutingFields.shape -ceq 'META_ONLY') -ne ($RoutingFields.assignments -ceq 'NONE')) { return $false }
  if (($RoutingFields.shape -ceq 'EXPANDED_AUDIT') -ne ($RoutingFields.budget -ceq 'exact + expanded_audit')) { return $false }
  if ($RoutingFields.assignments -match '(?i)swarm|review-sol-pro') { return $false }

  $JsonString = '"(?:\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4}|[^"\\\x00-\x1F])*"'
  $Accepted = [string]$Values['Accepted findings']
  $AcceptedItems = @()
  $SeenFindingIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  if ($Accepted -cne 'NONE') {
    $FindingObjectPattern = '\{"id":(?<id>' + $JsonString + '),"severity":(?<severity>"(?:Blocking|Major|Minor|Nit)"),"resolution_state":(?<resolution>"(?:FIXED|OPEN_FIX_REQUIRED|OPEN_BLOCKED|DEFERRED_TO_GATE|ACCEPTED_RISK)"),"evidence":(?<evidence>' + $JsonString + '),"owner":(?<owner>' + $JsonString + '),"route":(?<route>' + $JsonString + '),"enforcing_gate":(?<gate>' + $JsonString + '),"acceptance_authority":(?<authority>' + $JsonString + '),"reason":(?<reason>' + $JsonString + ')\}'
    $FindingArrayPattern = '^\[' + $FindingObjectPattern + '(?:,' + $FindingObjectPattern + ')*\]$'
    if ($Accepted -cnotmatch $FindingArrayPattern) { return $false }
    try {
      $ParsedFindings = ConvertFrom-Json -InputObject $Accepted
      $AcceptedItems = @($ParsedFindings)
    }
    catch {
      return $false
    }
    if ($AcceptedItems.Count -eq 0) { return $false }
    foreach ($Finding in $AcceptedItems) {
      $PropertyNames = @($Finding.PSObject.Properties.Name)
      if ($PropertyNames.Count -ne 9 -or ($PropertyNames -join "`n") -cne "id`nseverity`nresolution_state`nevidence`nowner`nroute`nenforcing_gate`nacceptance_authority`nreason") {
        return $false
      }
      foreach ($Name in @('id', 'evidence', 'owner', 'route', 'enforcing_gate', 'acceptance_authority', 'reason')) {
        $FindingValue = [string]$Finding.$Name
        if ([string]::IsNullOrWhiteSpace($FindingValue) -or $FindingValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') {
          return $false
        }
      }
      if (-not $SeenFindingIds.Add([string]$Finding.id)) { return $false }
      $StateValue = [string]$Finding.resolution_state
      $GateValue = [string]$Finding.enforcing_gate
      $AuthorityValue = [string]$Finding.acceptance_authority
      switch ($StateValue) {
        'FIXED' {
          if ($GateValue -cne 'NONE' -or $AuthorityValue -cne 'NONE') { return $false }
        }
        'OPEN_FIX_REQUIRED' {
          if ($AuthorityValue -cne 'NONE') { return $false }
        }
        'OPEN_BLOCKED' {
          if ($AuthorityValue -cne 'NONE' -or $GateValue -ceq 'NONE') { return $false }
        }
        'DEFERRED_TO_GATE' {
          if ($GateValue -ceq 'NONE') { return $false }
        }
        'ACCEPTED_RISK' {
          if ($AuthorityValue -ceq 'NONE') { return $false }
        }
        default { return $false }
      }
    }
  }

  $RejectedValue = [string]$Values['Rejected/downgraded findings']
  $RejectedItems = @()
  if ($RejectedValue -cne 'NONE') {
    $RejectedObjectPattern = '\{"id":(?<id>' + $JsonString + '),"disposition":(?<disposition>"(?:REJECTED|DOWNGRADED)"),"original_severity":(?<original>"(?:Blocking|Major|Minor|Nit)"),"new_severity":(?<new>"(?:NONE|Blocking|Major|Minor|Nit)"),"accepted_id":(?<accepted>' + $JsonString + '),"evidence":(?<evidence>' + $JsonString + '),"reason":(?<reason>' + $JsonString + ')\}'
    $RejectedArrayPattern = '^\[' + $RejectedObjectPattern + '(?:,' + $RejectedObjectPattern + ')*\]$'
    if ($RejectedValue -cnotmatch $RejectedArrayPattern) { return $false }
    try {
      $ParsedRejected = ConvertFrom-Json -InputObject $RejectedValue
      $RejectedItems = @($ParsedRejected)
    }
    catch { return $false }
    if ($RejectedItems.Count -eq 0) { return $false }
    $SeverityRank = @{ Blocking = 4; Major = 3; Minor = 2; Nit = 1 }
    foreach ($Finding in $RejectedItems) {
      $PropertyNames = @($Finding.PSObject.Properties.Name)
      if ($PropertyNames.Count -ne 7 -or ($PropertyNames -join "`n") -cne "id`ndisposition`noriginal_severity`nnew_severity`naccepted_id`nevidence`nreason") { return $false }
      foreach ($Name in @('id', 'accepted_id', 'evidence', 'reason')) {
        $FindingValue = [string]$Finding.$Name
        if ([string]::IsNullOrWhiteSpace($FindingValue) -or $FindingValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
      }
      if (-not $SeenFindingIds.Add([string]$Finding.id)) { return $false }
      if ([string]$Finding.disposition -ceq 'REJECTED') {
        if ([string]$Finding.new_severity -cne 'NONE' -or [string]$Finding.accepted_id -cne 'NONE') { return $false }
      }
      elseif ([string]$Finding.disposition -ceq 'DOWNGRADED') {
        if ([string]$Finding.new_severity -ceq 'NONE' -or
            [int]$SeverityRank[[string]$Finding.new_severity] -ge [int]$SeverityRank[[string]$Finding.original_severity] -or
            [string]$Finding.accepted_id -ceq 'NONE') { return $false }
        $LinkedAccepted = @($AcceptedItems | Where-Object { [string]$_.id -ceq [string]$Finding.accepted_id })
        if ($LinkedAccepted.Count -ne 1 -or [string]$LinkedAccepted[0].severity -cne [string]$Finding.new_severity) { return $false }
      }
      else { return $false }
    }
  }

  if ($null -ne $Context -and $null -ne $Context.PSObject.Properties['surfaced_finding_ids']) {
    $ExpectedFindingIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($Id in @($Context.surfaced_finding_ids)) {
      if ([string]::IsNullOrWhiteSpace([string]$Id) -or -not $ExpectedFindingIds.Add([string]$Id)) { return $false }
    }
    $ObservedSourceIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $DowngradedAcceptedIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($Finding in $RejectedItems) {
      [void]$ObservedSourceIds.Add([string]$Finding.id)
      if ([string]$Finding.disposition -ceq 'DOWNGRADED') { [void]$DowngradedAcceptedIds.Add([string]$Finding.accepted_id) }
    }
    foreach ($Finding in $AcceptedItems) {
      if (-not $DowngradedAcceptedIds.Contains([string]$Finding.id)) { [void]$ObservedSourceIds.Add([string]$Finding.id) }
    }
    foreach ($Id in $ExpectedFindingIds) {
      if (-not $ObservedSourceIds.Contains($Id)) { return $false }
    }
  }

  $Delta = [string]$Values['Proposed closeout delta']
  $HasDeterministicDelta = $false
  if ($Delta -ceq 'NONE') {
    $HasDeterministicDelta = $true
  }
  else {
    # The operation list is deliberately a one-line minified JSON subset with
    # fixed key order. This keeps the proposed closeout mutation deterministic
    # and prevents aliases, extra keys, or whitespace-shaped lookalikes.
    $ObjectPattern = '\{"path":(?<path>' + $JsonString + '),"field":(?<field>' + $JsonString + '),"value":(?<value>' + $JsonString + ')\}'
    $ArrayPattern = '^\[' + $ObjectPattern + '(?:,' + $ObjectPattern + ')*\]$'
    if ($Delta -cnotmatch $ArrayPattern) {
      return $false
    }
    try {
      $ParsedOperations = ConvertFrom-Json -InputObject $Delta
      $Operations = @($ParsedOperations)
    }
    catch {
      return $false
    }
    if ($Operations.Count -eq 0) { return $false }
    $SeenBindings = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($Operation in $Operations) {
      $PropertyNames = @($Operation.PSObject.Properties.Name)
      if ($PropertyNames.Count -ne 3 -or ($PropertyNames -join "`n") -cne "path`nfield`nvalue") {
        return $false
      }
      $PathValue = [string]$Operation.path
      $FieldValue = [string]$Operation.field
      $OperationValue = [string]$Operation.value
      if ([string]::IsNullOrWhiteSpace($PathValue) -or [string]::IsNullOrWhiteSpace($FieldValue) -or [string]::IsNullOrWhiteSpace($OperationValue)) {
        return $false
      }
      if ($PathValue -match '^(?:[A-Za-z]:|[\\/]{1,2}|[A-Za-z][A-Za-z0-9+.-]*://)' -or
          @($PathValue -split '[\\/]' | Where-Object { $_ -ceq '..' }).Count -gt 0 -or
          $PathValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})' -or
          $FieldValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})' -or
          $OperationValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') {
        return $false
      }
      if (-not $SeenBindings.Add($PathValue + [char]0 + $FieldValue)) {
        return $false
      }
    }
    $HasDeterministicDelta = $true
  }

  $Verdict = [string]$Values['Overall verdict']
  $Disposition = [string]$Values['Closeout disposition']
  if ($Verdict -ceq 'RED' -and $Disposition -ceq 'ALLOWED') {
    return $false
  }
  if (($Disposition -ceq 'FIX_REQUIRED' -or $Disposition -ceq 'BLOCKED') -and $Delta -cne 'NONE') {
    return $false
  }
  if ($Disposition -ceq 'FIX_REQUIRED') {
    if ($AcceptedItems.Count -eq 0 -or @($AcceptedItems | Where-Object { [string]$_.resolution_state -ceq 'OPEN_FIX_REQUIRED' }).Count -eq 0) {
      return $false
    }
  }
  if ($Disposition -ceq 'ALLOWED') {
    if (-not $HasDeterministicDelta -or
        @($AcceptedItems | Where-Object { [string]$_.resolution_state -in @('OPEN_FIX_REQUIRED', 'OPEN_BLOCKED') }).Count -gt 0 -or
        @($AcceptedItems | Where-Object {
          [string]$_.severity -in @('Blocking', 'Major') -and [string]$_.resolution_state -notin @('FIXED', 'ACCEPTED_RISK')
        }).Count -gt 0) {
      return $false
    }
  }
  if ($Disposition -ceq 'BLOCKED' -and
      @($AcceptedItems | Where-Object { [string]$_.resolution_state -ceq 'OPEN_BLOCKED' }).Count -eq 0 -and
      [string]$Values['Verification result'] -cnotmatch '(?i)(?:\bBLOCKED\b|\bblocker\b|\bauthority(?:\s+|[_-])block(?:ed|er)\b)') {
    return $false
  }
  return $true
}

function Test-OCRouterCloseoutResultOutput {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $RawLines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($RawLines.Count -ne 14) {
    return $false
  }

  # This is deliberately stricter than the general top-level record helper:
  # closeout is a terminal mutation receipt, so quoted/fenced/indented examples
  # and prose surrounding an otherwise valid-looking block must fail closed.
  foreach ($RawLine in $RawLines) {
    if ($RawLine -match '^(?:\s|>|`{3,}|~{3,})') {
      return $false
    }
  }

  $Lines = @($RawLines | ForEach-Object { ([string]$_).Trim() })
  if ([string]$Lines[0] -cne 'CLOSEOUT + COMMIT RESULT') {
    return $false
  }

  $Patterns = @(
    '^Target:\s*\S.+$',
    '^Epic:\s*\S.+$',
    '^Accountable Lane / class / profile:\s*\S.+$',
    '^workflow_verdict:\s*(COMPLETE|INCOMPLETE|BLOCKED|NOT_YET_EVALUATED)$',
    '^domain_verdict:\s*(ACCEPTED|LIMITED|REJECTED|NOT_YET_EVALUATED)$',
    '^routing_verdict:\s*(CONTINUE|BLOCKED|CLOSED|NOT_YET_EVALUATED)$',
    '^next_role_action:\s*\S.+$',
    '^State/Combined/findings/evidence reconciliation:\s*result=(PASS|FAIL|NOT_REQUIRED); details=\S.+$',
    '^Candidate identity:\s*\S.+$',
    '^Staged explicit paths:\s*\S.+$',
    '^Verification:\s*result=(PASS|FAIL|NOT_RUN); candidate=[^;]+; committed_tree=[^;]+; details=\S.+$',
    '^Commit:\s*(?:NO_COMMIT reason=\S.+|sha=(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64}); tree=(?:[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64}); message=\S.+)$',
    '^Push:\s*NOT_PERFORMED$'
  )
  for ($Index = 0; $Index -lt $Patterns.Count; $Index++) {
    if ([string]$Lines[$Index + 1] -cnotmatch $Patterns[$Index]) {
      return $false
    }
    if ([string]$Lines[$Index + 1] -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b)') {
      return $false
    }
  }

  $WorkflowVerdict = ([string]$Lines[4] -replace '^workflow_verdict:\s*', '').Trim()
  $DomainVerdict = ([string]$Lines[5] -replace '^domain_verdict:\s*', '').Trim()
  $RoutingVerdict = ([string]$Lines[6] -replace '^routing_verdict:\s*', '').Trim()
  $NextRoleAction = ([string]$Lines[7] -replace '^next_role_action:\s*', '').Trim()
  $Reconciliation = [regex]::Match([string]$Lines[8], '^State/Combined/findings/evidence reconciliation:\s*result=(?<result>PASS|FAIL|NOT_REQUIRED); details=(?<details>\S.+)$')
  if (-not $Reconciliation.Success) { return $false }

  $StagedValue = ([string]$Lines[10] -replace '^Staged explicit paths:\s*', '').Trim()
  $StagedPaths = @()
  if ($StagedValue -cne 'NONE') {
    $JsonString = '"(?:\\["\\/bfnrt]|\\u[0-9A-Fa-f]{4}|[^"\\\x00-\x1F])*"'
    if ($StagedValue -cnotmatch ('^\[' + $JsonString + '(?:,' + $JsonString + ')*\]$')) { return $false }
    try {
      $ParsedPaths = ConvertFrom-Json -InputObject $StagedValue
      $StagedPaths = @($ParsedPaths)
    }
    catch { return $false }
    if ($StagedPaths.Count -eq 0) { return $false }
    $SeenPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($StagedPath in $StagedPaths) {
      if ($StagedPath -isnot [string]) { return $false }
      $PathValue = [string]$StagedPath
      if ([string]::IsNullOrWhiteSpace($PathValue) -or
          $PathValue -match '^(?:[A-Za-z]:|[\\/]{1,2}|[A-Za-z][A-Za-z0-9+.-]*://)' -or
          @($PathValue -split '[\\/]' | Where-Object { $_ -ceq '..' }).Count -gt 0 -or
          $PathValue -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})' -or
          -not $SeenPaths.Add($PathValue)) {
        return $false
      }
    }
  }

  $Verification = [regex]::Match([string]$Lines[11], '^Verification:\s*result=(?<result>PASS|FAIL|NOT_RUN); candidate=(?<candidate>[^;]+); committed_tree=(?<tree>[^;]+); details=(?<details>\S.+)$')
  if (-not $Verification.Success) { return $false }
  foreach ($Value in @($Verification.Groups['candidate'].Value, $Verification.Groups['tree'].Value, $Verification.Groups['details'].Value, $Reconciliation.Groups['details'].Value)) {
    if ([string]::IsNullOrWhiteSpace([string]$Value) -or [string]$Value -match '(?i)(<[^>]+>|\bTBD\b|\bTODO\b|\{\{[^}]+\}\})') { return $false }
  }
  $ReceiptCandidate = ([string]$Lines[9] -replace '^Candidate identity:\s*', '').Trim()
  if ($ReceiptCandidate -cne $Verification.Groups['candidate'].Value.Trim()) { return $false }
  if ($null -ne $Context -and $null -ne $Context.PSObject.Properties['candidate'] -and
      -not [string]::IsNullOrWhiteSpace([string]$Context.candidate) -and $ReceiptCandidate -cne [string]$Context.candidate) { return $false }

  $CommitLine = [string]$Lines[12]
  $NoCommit = $CommitLine -cmatch '^Commit:\s*NO_COMMIT reason=\S.+$'
  if ($NoCommit) {
    if ($StagedValue -cne 'NONE' -or $Verification.Groups['tree'].Value.Trim() -cne 'NOT_APPLICABLE') { return $false }
  }
  else {
    $CommitMatch = [regex]::Match($CommitLine, '^Commit:\s*sha=(?<sha>[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64}); tree=(?<tree>[0-9A-Fa-f]{40}|[0-9A-Fa-f]{64}); message=(?<message>\S.+)$')
    if (-not $CommitMatch.Success -or $StagedValue -ceq 'NONE' -or [string]$Verification.Groups['result'].Value -cne 'PASS' -or
        $Verification.Groups['tree'].Value.Trim() -cne $CommitMatch.Groups['tree'].Value) { return $false }
  }

  if ($null -ne $Context -and $null -ne $Context.PSObject.Properties['closeout_disposition']) {
    if ([string]$Context.closeout_disposition -cne 'ALLOWED' -or $null -eq $Context.PSObject.Properties['ack_proven'] -or -not [bool]$Context.ack_proven) { return $false }
  }

  if ($RoutingVerdict -ceq 'CLOSED') {
    if ($WorkflowVerdict -cne 'COMPLETE' -or $DomainVerdict -notin @('ACCEPTED', 'LIMITED') -or
        [string]$Reconciliation.Groups['result'].Value -notin @('PASS', 'NOT_REQUIRED') -or
        [string]$Verification.Groups['result'].Value -cne 'PASS' -or $NextRoleAction -cne 'NONE') {
      return $false
    }
  }
  return $true
}

function Test-OCRouterTrackAckOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $Records = @(Get-OCRouterTopLevelLineRecords -Text $Text)
  return ($Records.Count -eq 1 -and [string]$Records[0].Text -ceq 'ACK_ONLY' -and $Text.Trim() -ceq 'ACK_ONLY')
}

function Get-OCRouterFinalSynthesisDisposition {
  param([string]$Text)

  if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text)) { return '' }
  return Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Closeout disposition'
}

function Get-OCRouterFinalOpenFixFindingIds {
  param([string]$Text)

  if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text)) { return @() }
  $Accepted = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Accepted findings'
  if ($Accepted -ceq 'NONE') { return @() }
  try {
    return @((ConvertFrom-Json -InputObject $Accepted) | Where-Object { [string]$_.resolution_state -ceq 'OPEN_FIX_REQUIRED' } | ForEach-Object { [string]$_.id })
  }
  catch { return @() }
}

function Get-OCRouterFinalDispositionSourceFindingIds {
  param([string]$Text)

  if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text)) { return @() }
  $AcceptedValue = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Accepted findings'
  $RejectedValue = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Rejected/downgraded findings'
  $Accepted = if ($AcceptedValue -ceq 'NONE') { @() } else { @(ConvertFrom-Json -InputObject $AcceptedValue) }
  $Rejected = if ($RejectedValue -ceq 'NONE') { @() } else { @(ConvertFrom-Json -InputObject $RejectedValue) }
  $Linked = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($Finding in $Rejected) { if ([string]$Finding.disposition -ceq 'DOWNGRADED') { [void]$Linked.Add([string]$Finding.accepted_id) } }
  $Ids = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($Finding in $Rejected) { [void]$Ids.Add([string]$Finding.id) }
  foreach ($Finding in $Accepted) { if (-not $Linked.Contains([string]$Finding.id)) { [void]$Ids.Add([string]$Finding.id) } }
  return @($Ids)
}

function Test-OCRouterDeliveryStepResponseOutput {
  param(
    [string]$Text,
    [object]$Context = $null
  )

  $IsAck = Test-OCRouterTrackAckOutput -Text $Text
  $IsFix = Test-OCRouterFixPlanOutput -Text $Text
  $IsUnclear = Test-OCRouterUnclearOutput -Text $Text
  if (-not ($IsAck -or $IsFix -or $IsUnclear)) { return $false }
  if ($null -eq $Context -or $null -eq $Context.PSObject.Properties['closeout_disposition']) { return $true }

  $Disposition = [string]$Context.closeout_disposition
  switch ($Disposition) {
    'ALLOWED' { return $IsAck }
    'FIX_REQUIRED' {
      if (-not $IsFix) { return $false }
      if (-not (Test-OCRouterLaneContextBinding -Text $Text -Context $Context -Marker 'FIX_PLAN_REQUIRED')) { return $false }
      if ($null -eq $Context.PSObject.Properties['accepted_finding_ids']) { return $false }
      $ExpectedIds = @($Context.accepted_finding_ids | ForEach-Object { [string]$_ } | Sort-Object)
      $ActualIds = @(Get-OCRouterFixPlanAcceptedFindingIds -Text $Text | ForEach-Object { [string]$_ } | Sort-Object)
      return (($ExpectedIds -join "`n") -ceq ($ActualIds -join "`n"))
    }
    'BLOCKED' {
      return ($IsUnclear -and $Text -match '(?i)(?:\bgate\b|\bowner\b|\bauthority\b)')
    }
    default { return $false }
  }
}

function Test-OCRouterLaneContextBinding {
  param(
    [string]$Text,
    [object]$Context,
    [string]$Marker = ''
  )

  if ($null -eq $Context) { return $true }
  foreach ($Name in @('target', 'epic', 'accountable_lane', 'lane_class', 'lane_profile')) {
    if ($null -eq $Context.PSObject.Properties[$Name] -or [string]::IsNullOrWhiteSpace([string]$Context.$Name)) {
      return $false
    }
  }
  $Records = @(Get-OCRouterTopLevelLineRecords -Text $Text)
  if (-not [string]::IsNullOrWhiteSpace($Marker)) {
    $Markers = @($Records | Where-Object { [string]$_.Text -ceq $Marker })
    if ($Markers.Count -ne 1) { return $false }
    $MarkerLine = [int]$Markers[0].LineIndex
    $Records = @($Records | Where-Object { [int]$_.LineIndex -ge $MarkerLine })
  }
  $TargetExpected = [string]$Context.target
  $EpicExpected = [string]$Context.epic
  $LaneExpected = "{0} / {1} / {2}" -f [string]$Context.accountable_lane, [string]$Context.lane_class, [string]$Context.lane_profile
  $TargetLines = @($Records | Where-Object { [string]$_.Text -cmatch '^Target:\s*\S.+' })
  $EpicLines = @($Records | Where-Object { [string]$_.Text -cmatch '^Epic:\s*\S.+' })
  $LaneLines = @($Records | Where-Object { [string]$_.Text -cmatch '^Accountable Lane / class / profile:\s*\S.+' })
  if ($TargetLines.Count -ne 1 -or $EpicLines.Count -ne 1 -or $LaneLines.Count -ne 1) { return $false }
  $TargetActual = ([string]$TargetLines[0].Text -replace '^Target:\s*', '').Trim()
  $EpicActual = ([string]$EpicLines[0].Text -replace '^Epic:\s*', '').Trim()
  $LaneActual = ([string]$LaneLines[0].Text -replace '^Accountable Lane / class / profile:\s*', '').Trim()
  if ($TargetActual -cne $TargetExpected -or $EpicActual -cne $EpicExpected -or $LaneActual -cne $LaneExpected) { return $false }
  if ($null -ne $Context.PSObject.Properties['candidate'] -and -not [string]::IsNullOrWhiteSpace([string]$Context.candidate)) {
    $CandidateLabel = if ($Marker -ceq 'CLOSEOUT + COMMIT RESULT') { 'Candidate identity' } else { 'Candidate' }
    $CandidatePattern = '^' + [regex]::Escape($CandidateLabel) + ':\s*\S.+'
    $CandidateLines = @($Records | Where-Object { [string]$_.Text -cmatch $CandidatePattern })
    if ($CandidateLines.Count -ne 1) { return $false }
    $CandidateActual = ([string]$CandidateLines[0].Text -replace ('^' + [regex]::Escape($CandidateLabel) + ':\s*'), '').Trim()
    if ($CandidateActual -cne [string]$Context.candidate) { return $false }
  }
  if ($null -ne $Context.PSObject.Properties['plan_artifact'] -and -not [string]::IsNullOrWhiteSpace([string]$Context.plan_artifact)) {
    $ArtifactLines = @($Records | Where-Object { [string]$_.Text -cmatch '^Plan artifact:\s*\S.+' })
    if ($ArtifactLines.Count -ne 1) { return $false }
    $ArtifactActual = ([string]$ArtifactLines[0].Text -replace '^Plan artifact:\s*', '').Trim()
    if ($ArtifactActual -cne [string]$Context.plan_artifact) { return $false }
  }
  if ($null -ne $Context.PSObject.Properties['plan_class'] -and -not [string]::IsNullOrWhiteSpace([string]$Context.plan_class)) {
    $PlanClassLines = @($Records | Where-Object { [string]$_.Text -cmatch '^Plan class:\s*(EPIC_PLAN|REVIEW_FIX_PLAN)$' })
    if ($PlanClassLines.Count -ne 1) { return $false }
    $PlanClassActual = ([string]$PlanClassLines[0].Text -replace '^Plan class:\s*', '')
    if ($PlanClassActual -cne [string]$Context.plan_class) { return $false }
  }
  return $true
}

function Test-OCRouterProgressLikeOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  if (Test-OCRouterTrackPlanOutput -Text $Text) { return $false }
  if (Test-OCRouterTrackImplementationOutput -Text $Text) { return $false }
  if (Test-OCRouterStrictStepReviewPhase1Output -Text $Text) { return $false }
  if (Test-OCRouterStrictSwarmReviewOutput -Text $Text) { return $false }
  if (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text) { return $false }
  if (Test-OCRouterCloseoutResultOutput -Text $Text) { return $false }

  foreach ($Pattern in @(
    '(?im)^\s*(I''ll|I\u2019ll|I''m|I\u2019m|I am)\b',
    '(?im)\b(now|currently)\s+(checking|reviewing|verifying|reading|running|sending|doing)\b',
    '(?im)\bbefore\s+(producing|returning|self-review|the\s+main\s+deep\s+pass)\b',
    '(?im)^\s*Most\b',
    '(?im)^\s*A\s+working\s+tree\b',
    '(?im)^\s*Build/test/.*\bnow\b',
    '(?im)^\s*Meta\s+Phase\s+\d+\b',
    '(?im)^\s*WAITING\s+FOR\s+GO\s*$'
  )) {
    if ($Text -match $Pattern) {
      return $true
    }
  }

  return $false
}

function Get-OCRouterOutputKind {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return 'unknown'
  }

  if (Test-OCRouterCompactionSummaryLikeOutput -Text $Text) {
    return 'compaction_summary'
  }

  if (Test-OCRouterCloseoutResultOutput -Text $Text) {
    return 'closeout_result'
  }

  if (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text) {
    return 'meta_final_synthesis'
  }

  if (Test-OCRouterStrictStepReviewPhase1Output -Text $Text) {
    return 'meta_step_review_phase1'
  }

  if (Test-OCRouterStrictSwarmReviewOutput -Text $Text) {
    return 'swarm_review'
  }

  if (Test-OCRouterTrackImplementationOutput -Text $Text) {
    return 'track_implementation_report'
  }

  if (Test-OCRouterPlanRevisionOutput -Text $Text) {
    return 'track_plan_revision'
  }

  if (Test-OCRouterUnclearOutput -Text $Text) {
    return 'track_unclear'
  }

  if (Test-OCRouterFixPlanOutput -Text $Text) {
    return 'track_fix_plan'
  }

  if (Test-OCRouterTrackPlanOutput -Text $Text) {
    return 'track_plan'
  }

  if (Test-OCRouterTrackAckOutput -Text $Text) {
    return 'track_ack'
  }

  if (Test-OCRouterMetaPlanReviewOutput -Text $Text) {
    return 'meta_plan_review'
  }

  if (Test-OCRouterProgressLikeOutput -Text $Text) {
    return 'progress_update'
  }

  return 'unknown'
}

function Get-OCRouterOutputContractDiagnostic {
  param(
    [string]$Text,
    [string]$ExpectedOutputKind,
    [object]$ExpectedOutputContext = $null
  )

  $Reasons = New-Object System.Collections.Generic.List[string]
  $DetectedKind = Get-OCRouterOutputKind -Text $Text
  $MatchesExpected = Test-OCRouterExpectedOutputKind -Text $Text -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext

  if (-not $MatchesExpected) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
      $Reasons.Add('empty_output')
    }
    else {
      $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
      $Lines = @($Normalized -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
      if (Test-OCRouterProgressLikeOutput -Text $Text) {
        $Reasons.Add('progress_output_not_terminal')
      }

      switch ($ExpectedOutputKind) {
        'track_plan_revision' {
          $ExpectedLineCount = if ($Lines.Count -gt 0 -and ([string]$Lines[0]).TrimEnd() -ceq 'REVISED REVIEW-FIX PLAN') { 23 } else { 25 }
          if ($Lines.Count -ne $ExpectedLineCount) { $Reasons.Add("expected_${ExpectedLineCount}_nonblank_lines_actual_$($Lines.Count)") }
          if ($Lines.Count -eq 0 -or ([string]$Lines[0]).TrimEnd() -notin @('REVISED EPIC IMPLEMENTATION PLAN', 'REVISED REVIEW-FIX PLAN')) { $Reasons.Add('missing_revised_plan_heading') }
          if (@($Lines | Where-Object { ([string]$_).TrimEnd() -ceq 'DELIVERY PLAN REVISION' }).Count -ne 1) { $Reasons.Add('missing_or_duplicate_delivery_plan_revision_marker') }
          if (@($Lines | Where-Object { ([string]$_).TrimEnd() -ceq 'PLAN_REVISION_COMPLETE' }).Count -ne 1) { $Reasons.Add('missing_or_duplicate_plan_revision_complete_terminal') }
          if (@($Lines | Where-Object { ([string]$_).TrimEnd() -cmatch '^IMPLEMENT_(READY|BLOCKED)$' }).Count -ne 1) { $Reasons.Add('missing_or_duplicate_implement_disposition') }
          if (Test-OCRouterPlanRevisionOutput -Text $Text) {
            if (-not (Test-OCRouterPlanRevisionContextBinding -Text $Text -Context $ExpectedOutputContext)) { $Reasons.Add('target_epic_wave_or_lane_context_mismatch') }
          }
          elseif ($Text -match '(?m)^Plan artifact:' -and $Text -match '(?m)^Final plan artifact:') {
            $Reasons.Add('plan_artifact_or_exact_envelope_mismatch')
          }
        }
        'track_implementation_report' {
          if ($Lines.Count -ne 14) { $Reasons.Add("expected_14_nonblank_lines_actual_$($Lines.Count)") }
          if ($Lines.Count -eq 0 -or ([string]$Lines[0]).TrimEnd() -cne 'IMPLEMENTATION RESULT') { $Reasons.Add('missing_implementation_result_heading') }
          if (@($Lines | Where-Object { ([string]$_).TrimEnd() -cmatch '^(REVIEW_READY|IMPLEMENT_BLOCKED)$' }).Count -ne 1) { $Reasons.Add('missing_or_duplicate_implementation_terminal') }
          if (Test-OCRouterTrackImplementationOutput -Text $Text -Context $ExpectedOutputContext -and -not (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext -Marker 'IMPLEMENTATION RESULT')) {
            $Reasons.Add('target_epic_or_lane_context_mismatch')
          }
        }
        default {
          if ($DetectedKind -cne $ExpectedOutputKind) { $Reasons.Add("detected_kind_$DetectedKind") }
        }
      }

      if ($Reasons.Count -eq 0) { $Reasons.Add('strict_output_or_context_contract_mismatch') }
    }
  }

  return [pscustomobject]@{
    expected_kind = $ExpectedOutputKind
    detected_kind = $DetectedKind
    matches_expected = [bool]$MatchesExpected
    progress_like = [bool](Test-OCRouterProgressLikeOutput -Text $Text)
    text_length = if ($null -eq $Text) { 0 } else { $Text.Length }
    reasons = @($Reasons.ToArray())
  }
}

function Write-OCRouterOutputContractDiagnostic {
  param(
    [object]$Candidate,
    [string]$ExpectedOutputKind,
    [object]$ExpectedOutputContext = $null,
    [string]$Prefix = ''
  )

  if ($null -eq $Candidate) { return $null }
  $Diagnostic = Get-OCRouterOutputContractDiagnostic -Text ([string]$Candidate.Text) -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext
  $Identity = Get-OCRouterCandidateIdentity -Candidate $Candidate
  $ReasonText = if (@($Diagnostic.reasons).Count -eq 0) { 'NONE' } else { @($Diagnostic.reasons) -join ',' }
  Write-Host "$Prefix reconciliation candidate: identity=$Identity detected=$($Diagnostic.detected_kind) progress=$($Diagnostic.progress_like) chars=$($Diagnostic.text_length) mismatches=$ReasonText" -ForegroundColor Yellow
  return $Diagnostic
}

function Test-OCRouterExpectedOutputKind {
  param(
    [string]$Text,
    [string]$ExpectedOutputKind,
    [object]$ExpectedOutputContext = $null
  )

  if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
    return $true
  }

  switch ($ExpectedOutputKind) {
    'track_plan' {
      if (-not (Test-OCRouterTrackPlanOutput -Text $Text)) { return $false }
      return (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext)
    }
    'track_fix_plan' {
      if (-not (Test-OCRouterFixPlanOutput -Text $Text)) { return $false }
      return (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext -Marker 'FIX_PLAN_REQUIRED')
    }
    'track_plan_revision' {
      if (-not (Test-OCRouterPlanRevisionOutput -Text $Text)) { return $false }
      return (Test-OCRouterPlanRevisionContextBinding -Text $Text -Context $ExpectedOutputContext)
    }
    'meta_plan_review' {
      if (-not (Test-OCRouterMetaPlanReviewOutput -Text $Text)) { return $false }
      if ($null -eq $ExpectedOutputContext -or
          $null -eq $ExpectedOutputContext.PSObject.Properties['plan_class'] -or
          [string]$ExpectedOutputContext.plan_class -notin @('EPIC_PLAN', 'REVIEW_FIX_PLAN')) { return $false }
      return (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext -Marker 'META PLAN REVIEW')
    }
    'track_implementation_report' {
      if (-not (Test-OCRouterTrackImplementationOutput -Text $Text -Context $ExpectedOutputContext)) { return $false }
      return (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext -Marker 'IMPLEMENTATION RESULT')
    }
    'meta_step_review_phase1' { return (Test-OCRouterStrictStepReviewPhase1Output -Text $Text -Context $ExpectedOutputContext) }
    'swarm_review_packet' { return (Test-OCRouterSwarmReviewPacketOutput -Text $Text -Context $ExpectedOutputContext) }
    'swarm_review' { return (Test-OCRouterStrictSwarmReviewOutput -Text $Text -Context $ExpectedOutputContext) }
    'meta_final_synthesis' {
      if (-not (Test-OCRouterStrictFinalStepReviewSynthesisOutput -Text $Text -Context $ExpectedOutputContext)) { return $false }
      return (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext -Marker 'FINAL STEP REVIEW SYNTHESIS')
    }
    'parallel_meta_plan_review' {
      if ($null -eq $ExpectedOutputContext) { return $false }
      return (Test-OCRouterParallelTrackResponseEnvelope -Text $Text -Lanes @($ExpectedOutputContext.lanes) -ExpectedCommand 'terv-review-utan' -ExpectedBodyKind 'meta_plan_review')
    }
    'parallel_meta_final_synthesis' {
      if ($null -eq $ExpectedOutputContext) { return $false }
      $SurfacedFindingIds = if ($null -ne $ExpectedOutputContext.PSObject.Properties['surfaced_finding_ids']) {
        @($ExpectedOutputContext.surfaced_finding_ids)
      }
      else {
        @()
      }
      return (Test-OCRouterParallelTrackResponseEnvelope -Text $Text -Lanes @($ExpectedOutputContext.lanes) -ExpectedCommand 'step-review-utan' -ExpectedBodyKind 'meta_final_synthesis' -SurfacedFindingIds $SurfacedFindingIds)
    }
    'closeout_result' {
      if (-not (Test-OCRouterCloseoutResultOutput -Text $Text -Context $ExpectedOutputContext)) { return $false }
      return (Test-OCRouterLaneContextBinding -Text $Text -Context $ExpectedOutputContext -Marker 'CLOSEOUT + COMMIT RESULT')
    }
    'track_ack' { return (Test-OCRouterTrackAckOutput -Text $Text) }
    'track_unclear' { return (Test-OCRouterUnclearOutput -Text $Text) }
    'delivery_step_response' { return (Test-OCRouterDeliveryStepResponseOutput -Text $Text -Context $ExpectedOutputContext) }
    default { return $false }
  }
}

function Get-OCRouterExpectedOutputKindForRouteStage {
  param([string]$Stage)

  switch ($Stage) {
    'plan_ready_for_meta_review' { return 'track_plan' }
    'implementation_done' { return 'track_implementation_report' }
    'meta_plan_review_done' { return 'meta_plan_review' }
    'step_review_done' { return 'meta_final_synthesis' }
    'review_fix_done' { return 'meta_final_synthesis' }
    default { return '' }
  }
}

function Get-OCRouterPostTimeoutExpectedOutputKind {
  param([string]$Stage)

  switch ($Stage) {
    'implementation_requested' { return 'track_implementation_report' }
    default { return '' }
  }
}

function Get-OCRouterImplementationResponseContextFromPlan {
  param([string]$Text)

  if (-not (Test-OCRouterPlanRevisionOutput -Text $Text)) { return $null }
  $Lines = @(($Text -replace "`r`n", "`n" -replace "`r", "`n") -split "`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ([string]$Lines[$Lines.Count - 1] -cne 'IMPLEMENT_READY') { return $null }
  $LaneValue = ([string]$Lines[4] -replace '^Accountable Lane / class / profile:\s*', '')
  $LaneMatch = [regex]::Match($LaneValue, '^(.+?) / (TRACK|SPECIALIST_DELIVERY|GOVERNANCE) / ([A-Za-z0-9._-]+)$')
  if (-not $LaneMatch.Success) { return $null }
  $PlanIdentity = Get-OCRouterTopLevelFieldValue -Text $Text -Field 'Final plan artifact'
  if (-not (Test-OCRouterOpaqueArtifactIdentity -Identity $PlanIdentity)) { return $null }
  return [pscustomobject]@{
    target = ([string]$Lines[1] -replace '^Target:\s*', '')
    epic = ([string]$Lines[2] -replace '^Epic:\s*', '')
    accountable_lane = [string]$LaneMatch.Groups[1].Value
    lane_class = [string]$LaneMatch.Groups[2].Value
    lane_profile = [string]$LaneMatch.Groups[3].Value
    plan_artifact_identity = $PlanIdentity
  }
}

function Resolve-OCRouterPacketRunDir {
  param(
    [string]$RouterDir,
    [string]$PacketHash
  )

  if ($PacketHash -cnotmatch '^[A-Fa-f0-9]{64}$') { throw 'PacketHash must be a SHA-256 identity.' }
  $PacketRunsDir = Join-Path $RouterDir 'packet-runs'
  if (Test-Path -LiteralPath $PacketRunsDir -PathType Container) {
    foreach ($RunDirectory in @(Get-ChildItem -LiteralPath $PacketRunsDir -Directory -ErrorAction Stop)) {
      $IntentPath = Join-Path (Join-Path $RunDirectory.FullName 'dispatch-intents') 'route-packet.json'
      if (-not (Test-Path -LiteralPath $IntentPath -PathType Leaf)) { continue }
      try { $Intent = Get-Content -LiteralPath $IntentPath -Raw | ConvertFrom-Json }
      catch { continue }
      if ([string]$Intent.candidate_identity -ceq "packet-sha256:$($PacketHash.ToUpperInvariant())") {
        return $RunDirectory.FullName
      }
    }
  }
  return (Join-Path $PacketRunsDir ("packet-{0}" -f $PacketHash.ToLowerInvariant()))
}

function Get-OCRouterExpectedOutputKindForCommand {
  param([string]$CommandName)

  if ([string]::IsNullOrWhiteSpace($CommandName)) {
    return ''
  }

  switch ($CommandName.Trim().TrimStart('/').ToLowerInvariant()) {
    'implement' { return 'track_implementation_report' }
    'closeout-commit' { return 'closeout_result' }
    default { return '' }
  }
}

function Test-OCRouterFinalSynthesisOutput {
  param(
    [string]$Text,
    [string]$SourcePath = ""
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $false
  }

  $NormalizedSourcePath = ($SourcePath -replace '\\', '/').ToLowerInvariant()
  if ($NormalizedSourcePath -match '/parallel-runs/.*/06-meta-final-synthesis\.md$') {
    return $false
  }

  foreach ($Pattern in @(
    '(?im)^.*FINAL\s+STEP\s+REVIEW\s+SYNTHESIS.*$',
    '(?im)^\s*Overall\s+verdict\s*:',
    '(?im)^\s*Verdict\s*:'
  )) {
    if ($Text -match $Pattern) {
      return $true
    }
  }

  return $false
}

function Get-OCRouterP1CheckpointSourceKind {
  param(
    [string]$Stage,
    [string]$SourcePath,
    [string]$Text
  )

  if (-not [string]::IsNullOrWhiteSpace($Text) -and $Text -match '(?m)^=== FAL CHECKPOINT START ===\s*$') {
    $StageMatch = [regex]::Match($Text, '(?im)^\s*CHECKPOINT_STAGE\s*:\s*([^\r\n]+?)\s*$')
    if (-not $StageMatch.Success) {
      return "unclassified"
    }
    $MarkerStage = $StageMatch.Groups[1].Value.Trim()
    if (-not [string]::IsNullOrWhiteSpace($Stage) -and $MarkerStage -ne $Stage) {
      return "unclassified"
    }
    return "marker_block"
  }

  switch ($Stage) {
    "meta_plan_review_done" {
      if (Test-OCRouterMetaPlanReviewOutput -Text $Text) {
        return "artifact_extractor"
      }
    }
    "step_review_done" {
      if (Test-OCRouterFinalSynthesisOutput -Text $Text -SourcePath $SourcePath) {
        return "artifact_extractor"
      }
    }
    "review_fix_done" {
      if (Test-OCRouterFinalSynthesisOutput -Text $Text -SourcePath $SourcePath) {
        return "artifact_extractor"
      }
    }
    "handoff_done" {
      if ($Text -match '(?im)^\s*(handoff|next action|next actor|allowed scope|forbidden scope)\b') {
        return "artifact_extractor"
      }
    }
    "implementation_done" {
      if ($Text -match '(?im)^\s*###\s*(Implemented changes|Verification eredm.ny|Build/Review readiness)\b') {
        return "artifact_extractor"
      }
    }
  }

  return "unclassified"
}

function Test-OCRouterPathUnderRoot {
  param(
    [string]$Path,
    [string]$Root
  )

  $FullPath = [System.IO.Path]::GetFullPath($Path)
  $FullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  return $FullPath.StartsWith($FullRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
    $FullPath.Equals($FullRoot, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-OCRouterParallelFalSyncFileName {
  param(
    [string]$LaneSafeName,
    [string]$Stage
  )

  if ([string]::IsNullOrWhiteSpace($LaneSafeName)) {
    throw "LaneSafeName is required for parallel FAL sync marker naming."
  }
  if ([string]::IsNullOrWhiteSpace($Stage)) {
    throw "Stage is required for parallel FAL sync marker naming."
  }

  return "fal-sync-$LaneSafeName-$Stage.md"
}

function Get-OCRouterTextSummaryLine {
  param(
    [string]$Text,
    [string]$DefaultValue = "Parallel lane checkpoint captured."
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $DefaultValue
  }

  foreach ($Line in @($Text -split "`r?`n")) {
    $Trimmed = $Line.Trim()
    if ([string]::IsNullOrWhiteSpace($Trimmed)) {
      continue
    }
    if ($Trimmed -match '^===') {
      continue
    }
    if ($Trimmed.Length -gt 180) {
      return ($Trimmed.Substring(0, 180) + "...")
    }
    return $Trimmed
  }

  return $DefaultValue
}

function New-OCRouterParallelFalMarkerText {
  param(
    [object]$Lane,
    [string]$Stage,
    [string]$LaneArtifactPath,
    [string]$CombinedArtifactPath,
    [string]$StatePath,
    [string]$LaneText,
    [string]$Decision = "",
    [string[]]$BlockingConditions = @(),
    [string[]]$RequiredFollowups = @()
  )

  if ($null -eq $Lane) {
    throw "Lane is required for parallel FAL marker generation."
  }
  if ([string]::IsNullOrWhiteSpace($Stage)) {
    throw "Stage is required for parallel FAL marker generation."
  }
  if ([string]::IsNullOrWhiteSpace($LaneArtifactPath) -or -not (Test-Path $LaneArtifactPath)) {
    throw "Lane artifact is required for parallel FAL marker generation: $LaneArtifactPath"
  }
  if ([string]::IsNullOrWhiteSpace($CombinedArtifactPath) -or -not (Test-Path $CombinedArtifactPath)) {
    throw "Combined artifact is required for parallel FAL marker generation: $CombinedArtifactPath"
  }
  if ([string]::IsNullOrWhiteSpace($StatePath) -or -not (Test-Path $StatePath)) {
    throw "State artifact is required for parallel FAL marker generation: $StatePath"
  }

  $EffectiveDecision = if ([string]::IsNullOrWhiteSpace($Decision)) { Get-OCRouterNormalizedVerdict -Text $LaneText } else { $Decision }
  if ([string]::IsNullOrWhiteSpace($EffectiveDecision)) {
    $EffectiveDecision = "unknown"
  }

  $EffectiveBlockingConditions = New-Object System.Collections.Generic.List[string]
  foreach ($Item in @($BlockingConditions)) {
    if (-not [string]::IsNullOrWhiteSpace($Item)) { $EffectiveBlockingConditions.Add($Item) }
  }
  $EffectiveRequiredFollowups = New-Object System.Collections.Generic.List[string]
  foreach ($Item in @($RequiredFollowups)) {
    if (-not [string]::IsNullOrWhiteSpace($Item)) { $EffectiveRequiredFollowups.Add($Item) }
  }
  if ($EffectiveDecision -match 'RED|REJECT|FAIL|BLOCK' -and $EffectiveBlockingConditions.Count -eq 0) {
    $EffectiveBlockingConditions.Add("Lane-specific checkpoint is not clean; see lane artifact and combined synthesis references.")
  }
  if ($EffectiveDecision -match 'YELLOW|CONCERN|WARN' -and $EffectiveRequiredFollowups.Count -eq 0) {
    $EffectiveRequiredFollowups.Add("Lane-specific concerns require follow-up; do not infer clean closeout from the combined verdict.")
  }
  $EffectiveReconcileDebt = New-Object System.Collections.Generic.List[string]
  if ($EffectiveDecision -eq "unknown") {
    $EffectiveReconcileDebt.Add("lane_decision:unknown")
    if ($EffectiveRequiredFollowups.Count -eq 0) {
      $EffectiveRequiredFollowups.Add("Lane checkpoint decision could not be parsed; inspect the lane body before claiming clean closeout.")
    }
  }

  $Summary = Get-OCRouterTextSummaryLine -Text $LaneText -DefaultValue "Parallel lane checkpoint captured for $($Lane.track_key)."
  $NextAction = switch ($Stage) {
    "meta_plan_review_done" { "Proceed according to the lane-specific /terv-review-utan response." }
    "review_fix_done" { "Proceed according to the lane-specific review-fix final synthesis." }
    default { "Proceed according to the lane-specific /step-review-utan response." }
  }

  $ScopeSummary = "Lane-specific parallel checkpoint for $($Lane.track_key) / $($Lane.target). Combined artifacts are references only, not all-lane proof."
  $Lines = New-Object System.Collections.Generic.List[string]
  $Lines.Add("=== FAL CHECKPOINT START ===")
  $Lines.Add("CHECKPOINT_STAGE: $Stage")
  $Lines.Add("TARGET: $($Lane.target)")
  $Lines.Add("ORIGIN_SESSION: meta")
  $Lines.Add("DECISION: $EffectiveDecision")
  $Lines.Add("SUMMARY: $Summary")
  $Lines.Add("NEXT_ACTION: $NextAction")
  $Lines.Add("ACCEPTED_SCOPE_SUMMARY: $ScopeSummary")
  $Lines.Add("ARTIFACT_REFS:")
  $Lines.Add("- $CombinedArtifactPath")
  $Lines.Add("- $LaneArtifactPath")
  $Lines.Add("- $StatePath")
  if ($EffectiveBlockingConditions.Count -gt 0) {
    $Lines.Add("BLOCKING_CONDITIONS:")
    foreach ($Item in @($EffectiveBlockingConditions.ToArray())) {
      $Lines.Add("- $Item")
    }
  }
  if ($EffectiveRequiredFollowups.Count -gt 0) {
    $Lines.Add("REQUIRED_FOLLOWUPS:")
    foreach ($Item in @($EffectiveRequiredFollowups.ToArray())) {
      $Lines.Add("- $Item")
    }
  }
  $Lines.Add("=== FAL CHECKPOINT END ===")
  $Lines.Add("")
  $Lines.Add("Lane checkpoint source law: this generated marker is the pinned -SourcePath. The combined Meta artifact alone is not lane-level checkpoint proof.")

  return [pscustomobject]@{
    text = ($Lines -join "`n")
    decision = $EffectiveDecision
    summary = $Summary
    reconcile_debt = @($EffectiveReconcileDebt.ToArray())
    blocking_conditions = @($EffectiveBlockingConditions.ToArray())
    required_followups = @($EffectiveRequiredFollowups.ToArray())
  }
}

function New-OCRouterParallelFalSyncResult {
  param(
    [object]$Lane,
    [string]$Stage,
    [string]$Decision = "unknown",
    [string]$SourcePath = "",
    [string]$LaneArtifactPath = "",
    [string]$CombinedArtifactPath = "",
    [bool]$SyncAttempted,
    [ValidateSet("succeeded", "failed", "skipped")]
    [string]$SyncStatus,
    [bool]$ApplyRequested,
    [string]$ErrorMessage = "",
    [string[]]$ReconcileDebt = @(),
    [string[]]$BlockingConditions = @(),
    [string[]]$RequiredFollowups = @()
  )

  $Debt = New-Object System.Collections.Generic.List[string]
  foreach ($Item in @($ReconcileDebt)) {
    if (-not [string]::IsNullOrWhiteSpace($Item)) { $Debt.Add($Item) }
  }
  if ($Decision -eq "unknown" -and -not $Debt.Contains("lane_decision:unknown")) {
    $Debt.Add("lane_decision:unknown")
  }
  if (-not $Debt.Contains("context_delta:unknown")) {
    $Debt.Add("context_delta:unknown")
  }

  return [pscustomobject]@{
    track_key = [string]$Lane.track_key
    target = [string]$Lane.target
    stage = $Stage
    decision = $Decision
    source_path = $SourcePath
    lane_artifact = $LaneArtifactPath
    combined_artifact = $CombinedArtifactPath
    sync_attempted = $SyncAttempted
    sync_status = $SyncStatus
    mode = if ($ApplyRequested) { "apply_requested" } else { "dry_run" }
    apply_requested = $ApplyRequested
    error = $ErrorMessage
    reconcile_debt = @($Debt.ToArray())
    blocking_conditions = @($BlockingConditions)
    required_followups = @($RequiredFollowups)
  }
}

function Write-OCRouterParallelFalReconcileSummary {
  param(
    [string]$RunDir,
    [string]$RunId,
    [string]$Stage,
    [bool]$ApplyRequested,
    [object[]]$LaneResults
  )

  $Failed = @($LaneResults | Where-Object { [string]$_.sync_status -ne "succeeded" })
  $Summary = [ordered]@{
    schema_version = "fal.parallel_reconcile_summary.v1"
    run_id = $RunId
    stage = $Stage
    mode = if ($ApplyRequested) { "apply_requested" } else { "dry_run" }
    dry_run = -not $ApplyRequested
    apply_requested = $ApplyRequested
    sync_attempted = @($LaneResults).Count -gt 0
    sync_succeeded = @($LaneResults | Where-Object { [string]$_.sync_status -eq "succeeded" }).Count
    sync_failed = $Failed.Count
    reconcile_debt = @($LaneResults | ForEach-Object { @($_.reconcile_debt) } | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Sort-Object -Unique)
    lanes = @($LaneResults)
  }

  $Path = Join-Path $RunDir "fal-parallel-reconcile-summary.json"
  try {
    $Summary | ConvertTo-Json -Depth 10 | Set-Content -Path $Path -Encoding UTF8
    return $Path
  }
  catch {
    throw "Failed to write core FAL parallel reconcile evidence artifact '$Path': $($_.Exception.Message)"
  }
}

function Get-OCRouterCandidateIdentity {
  param([object]$Candidate)

  if ($null -eq $Candidate) {
    return ""
  }
  if (-not [string]::IsNullOrWhiteSpace($Candidate.MessageId)) {
    return "id:$($Candidate.MessageId)"
  }
  return "text:$($Candidate.Text)"
}

function Get-OCRouterCandidateStableSignature {
  param([object]$Candidate)

  if ($null -eq $Candidate) {
    return ""
  }

  $Tail = $Candidate.Text
  if ($Tail.Length -gt 240) {
    $Tail = $Tail.Substring($Tail.Length - 240)
  }

  return "$(Get-OCRouterCandidateIdentity -Candidate $Candidate)|len:$($Candidate.TextLength)|tail:$Tail"
}

function Get-OCRouterLatestCandidate {
  param(
    [string]$Uri,
    [hashtable]$Headers,
    [int]$CandidateCount,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [string]$AfterMessageId = "",
    [int]$RequestTimeoutSeconds = 0
  )

  $Request = @{
    Method = 'Get'
    Uri = $Uri
    Headers = $Headers
    ContentType = 'application/json'
  }
  if ($RequestTimeoutSeconds -gt 0) { $Request.TimeoutSec = $RequestTimeoutSeconds }
  $Response = Invoke-RestMethod @Request

  $Messages = @(Get-OCRouterMessageCollection -Response $Response)
  $Candidates = @(Get-OCRouterLatestOutputCandidates `
    -Messages $Messages `
    -CandidateCount $CandidateCount `
    -AssumeNewestFirst:$AssumeNewestFirst `
    -IncludeReasoningParts:$IncludeReasoningParts `
    -ExpectedOutputKind $ExpectedOutputKind `
    -ExpectedOutputContext $ExpectedOutputContext `
    -AfterMessageId $AfterMessageId)

  if ($Candidates.Count -eq 0) {
    return $null
  }

  return $Candidates[0]
}

function Wait-OCRouterNewOutput {
  param(
    [string]$Label,
    [string]$Uri,
    [hashtable]$Headers,
    [string]$BaselineIdentity,
    [string]$BaselineMessageId,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [int]$CandidateCount,
    [int]$PollSeconds,
    [int]$TimeoutMinutes,
    [int]$StablePolls,
    [int]$MinOutputChars,
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [switch]$AutoUseFirstStable
  )

  $Deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  if ([string]::IsNullOrWhiteSpace($BaselineMessageId)) {
    throw "Waiting for '$Label' requires a persisted raw assistant baseline message ID."
  }
  $Ignored = @{}
  $LastSignature = ""
  $StableCount = 0
  $LastDiagnosticIdentity = ""
  $LastDiagnostic = $null

  Write-Host "Waiting for $Label. Press Ctrl+C to stop." -ForegroundColor Cyan
  while ((Get-Date) -lt $Deadline) {
    $RemainingSeconds = [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds)
    if ($RemainingSeconds -le 0) { break }
    Start-Sleep -Seconds ([Math]::Min($PollSeconds, $RemainingSeconds))
    if ((Get-Date) -ge $Deadline) { break }
    $RequestTimeoutSeconds = [Math]::Max(1, [Math]::Min(30, [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds)))
    $Candidate = Get-OCRouterLatestCandidate `
      -Uri $Uri `
      -Headers $Headers `
      -CandidateCount $CandidateCount `
      -AssumeNewestFirst $AssumeNewestFirst `
      -IncludeReasoningParts:$IncludeReasoningParts `
      -ExpectedOutputKind $ExpectedOutputKind `
      -ExpectedOutputContext $ExpectedOutputContext `
      -AfterMessageId $BaselineMessageId `
      -RequestTimeoutSeconds $RequestTimeoutSeconds

    if ($null -eq $Candidate) {
      if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
        Write-Host "No assistant candidate yet."
      }
      else {
        Write-Host "No assistant candidate of expected kind '$ExpectedOutputKind' yet."
        if ((Get-Date) -ge $Deadline) { break }
        $DiagnosticCandidate = Get-OCRouterLatestCandidate `
          -Uri $Uri `
          -Headers $Headers `
          -CandidateCount 1 `
          -AssumeNewestFirst $AssumeNewestFirst `
          -IncludeReasoningParts:$IncludeReasoningParts `
          -AfterMessageId $BaselineMessageId `
          -RequestTimeoutSeconds ([Math]::Max(1, [Math]::Min(30, [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds))))
        if ($null -ne $DiagnosticCandidate) {
          $DiagnosticIdentity = Get-OCRouterCandidateIdentity -Candidate $DiagnosticCandidate
          $LastDiagnostic = Get-OCRouterOutputContractDiagnostic -Text $DiagnosticCandidate.Text -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext
          if ($DiagnosticIdentity -cne $LastDiagnosticIdentity) {
            Write-OCRouterOutputContractDiagnostic -Candidate $DiagnosticCandidate -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext -Prefix "[$Label]" | Out-Null
            $LastDiagnosticIdentity = $DiagnosticIdentity
          }
        }
      }
      continue
    }

    $Identity = Get-OCRouterCandidateIdentity -Candidate $Candidate
    if ($Identity -eq $BaselineIdentity -or $Ignored.ContainsKey($Identity)) {
      Write-Host "No new $Label candidate yet. latest=$Identity chars=$($Candidate.TextLength)"
      continue
    }

    if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind) -and $Candidate.TextLength -lt $MinOutputChars) {
      Write-Host "New $Label candidate is too short. latest=$Identity chars=$($Candidate.TextLength) min=$MinOutputChars"
      continue
    }

    $Signature = Get-OCRouterCandidateStableSignature -Candidate $Candidate
    if ($Signature -eq $LastSignature) {
      $StableCount += 1
    }
    else {
      $LastSignature = $Signature
      $StableCount = 1
    }

    Write-Host "New $Label candidate observed. latest=$Identity chars=$($Candidate.TextLength) stable=$StableCount/$StablePolls"
    if ($StableCount -lt $StablePolls) {
      continue
    }

    Write-Host ""
    Write-OCRouterSelectedCandidateSummary -Candidate $Candidate
    Write-Host "$Label preview:" -ForegroundColor Yellow
    Write-OCRouterTextPreview -Text $Candidate.Text

    if ($AutoUseFirstStable) {
      return $Candidate
    }

    $Answer = Read-Host "Use this $Label? [u]se/[w]ait/[n]abort"
    if ($Answer -eq "u" -or $Answer -eq "U" -or $Answer -eq "y" -or $Answer -eq "Y") {
      return $Candidate
    }
    elseif ($Answer -eq "w" -or $Answer -eq "W") {
      $Ignored[$Identity] = $true
      $LastSignature = ""
      $StableCount = 0
      Write-Host "Continuing to wait for newer $Label." -ForegroundColor Yellow
      continue
    }
    else {
      throw "Aborted while waiting for $Label."
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($LastDiagnosticIdentity)) {
    throw "Timed out after $TimeoutMinutes minutes waiting for $Label. A newer assistant output exists but failed the strict '$ExpectedOutputKind' contract: identity=$LastDiagnosticIdentity mismatches=$(@($LastDiagnostic.reasons) -join ','). Reconcile the saved run and transcript read-only; do not resend."
  }
  throw "Timed out after $TimeoutMinutes minutes waiting for $Label."
}

function Wait-OCRouterParallelOutputs {
  param(
    [object[]]$LaneContexts,
    [hashtable]$Headers,
    [bool]$AssumeNewestFirst,
    [bool]$IncludeReasoningParts,
    [int]$CandidateCount,
    [int]$PollSeconds,
    [int]$TimeoutMinutes,
    [int]$StablePolls,
    [int]$MinOutputChars,
    [string]$ExpectedOutputKind = "",
    [object]$ExpectedOutputContext = $null,
    [switch]$AutoUseFirstStable,
    [scriptblock]$OnLaneCompleted
  )

  if ($null -eq $LaneContexts -or $LaneContexts.Count -eq 0) {
    return @()
  }

  $Deadline = (Get-Date).AddMinutes($TimeoutMinutes)
  foreach ($LaneContext in $LaneContexts) {
    if ($null -eq $LaneContext.PSObject.Properties["label"]) {
      throw "Parallel wait lane context is missing 'label'."
    }
    if ($null -eq $LaneContext.PSObject.Properties["uri"]) {
      throw "Parallel wait lane context '$($LaneContext.label)' is missing 'uri'."
    }
    if ($null -eq $LaneContext.PSObject.Properties["baseline_identity"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "baseline_identity" -Value ""
    }
    if ($null -eq $LaneContext.PSObject.Properties["baseline_message_id"] -or [string]::IsNullOrWhiteSpace([string]$LaneContext.baseline_message_id)) {
      throw "Parallel wait lane context '$($LaneContext.label)' is missing its persisted raw assistant baseline message ID."
    }
    if ($null -eq $LaneContext.PSObject.Properties["ignored_identities"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "ignored_identities" -Value (@{})
    }
    elseif ($LaneContext.ignored_identities -isnot [hashtable]) {
      $LaneContext.ignored_identities = @{}
    }
    if ($null -eq $LaneContext.PSObject.Properties["last_signature"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "last_signature" -Value ""
    }
    if ($null -eq $LaneContext.PSObject.Properties["stable_count"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "stable_count" -Value 0
    }
    if ($null -eq $LaneContext.PSObject.Properties["completed"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "completed" -Value $false
    }
    if ($null -eq $LaneContext.PSObject.Properties["selected_candidate"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "selected_candidate" -Value $null
    }
    if ($null -eq $LaneContext.PSObject.Properties["selected_identity"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "selected_identity" -Value ""
    }
    if ($null -eq $LaneContext.PSObject.Properties["last_diagnostic_identity"]) {
      Add-Member -InputObject $LaneContext -MemberType NoteProperty -Name "last_diagnostic_identity" -Value ""
    }
  }

  Write-Host "Waiting for $($LaneContexts.Count) parallel outputs. Press Ctrl+C to stop." -ForegroundColor Cyan
  while ((Get-Date) -lt $Deadline) {
    $PendingCount = 0

    foreach ($LaneContext in $LaneContexts) {
      if ([bool]$LaneContext.completed) {
        continue
      }

      $PendingCount += 1
      if ((Get-Date) -ge $Deadline) { break }
      $RequestTimeoutSeconds = [Math]::Max(1, [Math]::Min(30, [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds)))
      $LaneExpectedOutputContext = if ($null -ne $LaneContext.PSObject.Properties['expected_output_context']) { $LaneContext.expected_output_context } else { $ExpectedOutputContext }
      $Candidate = Get-OCRouterLatestCandidate `
        -Uri ([string]$LaneContext.uri) `
        -Headers $Headers `
        -CandidateCount $CandidateCount `
        -AssumeNewestFirst $AssumeNewestFirst `
        -IncludeReasoningParts:$IncludeReasoningParts `
        -ExpectedOutputKind $ExpectedOutputKind `
        -ExpectedOutputContext $LaneExpectedOutputContext `
        -AfterMessageId ([string]$LaneContext.baseline_message_id) `
        -RequestTimeoutSeconds $RequestTimeoutSeconds

      if ($null -eq $Candidate) {
        if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind)) {
          Write-Host "[$($LaneContext.label)] No assistant candidate yet."
        }
        else {
          Write-Host "[$($LaneContext.label)] No assistant candidate of expected kind '$ExpectedOutputKind' yet."
          if ((Get-Date) -ge $Deadline) { break }
          $DiagnosticCandidate = Get-OCRouterLatestCandidate `
            -Uri ([string]$LaneContext.uri) `
            -Headers $Headers `
            -CandidateCount 1 `
            -AssumeNewestFirst $AssumeNewestFirst `
            -IncludeReasoningParts:$IncludeReasoningParts `
            -AfterMessageId ([string]$LaneContext.baseline_message_id) `
            -RequestTimeoutSeconds ([Math]::Max(1, [Math]::Min(30, [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds))))
          if ($null -ne $DiagnosticCandidate) {
            $DiagnosticIdentity = Get-OCRouterCandidateIdentity -Candidate $DiagnosticCandidate
            if ($DiagnosticIdentity -cne [string]$LaneContext.last_diagnostic_identity) {
              Write-OCRouterOutputContractDiagnostic -Candidate $DiagnosticCandidate -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $LaneExpectedOutputContext -Prefix "[$($LaneContext.label)]" | Out-Null
              $LaneContext.last_diagnostic_identity = $DiagnosticIdentity
            }
          }
        }
        continue
      }

      $Identity = Get-OCRouterCandidateIdentity -Candidate $Candidate
      if ($Identity -eq [string]$LaneContext.baseline_identity -or $LaneContext.ignored_identities.ContainsKey($Identity)) {
        Write-Host "[$($LaneContext.label)] No new candidate yet. latest=$Identity chars=$($Candidate.TextLength)"
        continue
      }

      if ([string]::IsNullOrWhiteSpace($ExpectedOutputKind) -and $Candidate.TextLength -lt $MinOutputChars) {
        Write-Host "[$($LaneContext.label)] New candidate is too short. latest=$Identity chars=$($Candidate.TextLength) min=$MinOutputChars"
        continue
      }

      $Signature = Get-OCRouterCandidateStableSignature -Candidate $Candidate
      if ($Signature -eq [string]$LaneContext.last_signature) {
        $LaneContext.stable_count = [int]$LaneContext.stable_count + 1
      }
      else {
        $LaneContext.last_signature = $Signature
        $LaneContext.stable_count = 1
      }

      Write-Host "[$($LaneContext.label)] New candidate observed. latest=$Identity chars=$($Candidate.TextLength) stable=$($LaneContext.stable_count)/$StablePolls"
      if ([int]$LaneContext.stable_count -lt $StablePolls) {
        continue
      }

      Write-Host ""
      Write-OCRouterSelectedCandidateSummary -Candidate $Candidate
      Write-Host "$($LaneContext.label) preview:" -ForegroundColor Yellow
      Write-OCRouterTextPreview -Text $Candidate.Text

      $AcceptCandidate = $true
      if (-not $AutoUseFirstStable) {
        $Answer = Read-Host "Use this $($LaneContext.label)? [u]se/[w]ait/[n]abort"
        if ($Answer -eq "w" -or $Answer -eq "W") {
          $LaneContext.ignored_identities[$Identity] = $true
          $LaneContext.last_signature = ""
          $LaneContext.stable_count = 0
          $AcceptCandidate = $false
          Write-Host "Continuing to wait for newer $($LaneContext.label)." -ForegroundColor Yellow
        }
        elseif ($Answer -ne "u" -and $Answer -ne "U" -and $Answer -ne "y" -and $Answer -ne "Y") {
          throw "Aborted while waiting for $($LaneContext.label)."
        }
      }

      if (-not $AcceptCandidate) {
        continue
      }

      $LaneContext.completed = $true
      $LaneContext.selected_candidate = $Candidate
      $LaneContext.selected_identity = $Identity

      if ($null -ne $OnLaneCompleted) {
        & $OnLaneCompleted $LaneContext $Candidate
      }
    }

    if (@($LaneContexts | Where-Object { -not [bool]$_.completed }).Count -eq 0) {
      return @($LaneContexts)
    }

    $RemainingSeconds = [Math]::Ceiling(($Deadline - (Get-Date)).TotalSeconds)
    if ($RemainingSeconds -le 0) { break }
    Start-Sleep -Seconds ([Math]::Min($PollSeconds, $RemainingSeconds))
  }

  $PendingLabels = @($LaneContexts | Where-Object { -not [bool]$_.completed } | ForEach-Object { [string]$_.label })
  throw "Timed out after $TimeoutMinutes minutes waiting for parallel outputs: $($PendingLabels -join ', ')"
}

function ConvertTo-OCRouterLaneCollection {
  param(
    [string[]]$LaneSpecs,
    [object]$Config
  )

  if ($null -eq $LaneSpecs -or $LaneSpecs.Count -eq 0) {
    throw "At least one -Lane '<session-key>|<project-or-repo-target>|<epic>' value is required. Non-Track lanes must append '|<accountable-lane-id>|<lane-class>|<lane-profile>'."
  }

  $SeenSessions = @{}
  $Lanes = New-Object System.Collections.Generic.List[object]
  for ($Index = 0; $Index -lt $LaneSpecs.Count; $Index++) {
    $Spec = [string]$LaneSpecs[$Index]
    $Parts = @($Spec -split '\|')
    if ($Parts.Count -eq 2) {
      throw "Legacy ambiguous lane spec '$Spec' is rejected. Use <session-key>|<project-or-repo-target>|<epic>; Target and Epic are distinct bindings."
    }
    if ($Parts.Count -notin @(3, 6)) {
      throw "Invalid lane spec '$Spec'. Expected <session-key>|<target>|<epic> for a Track, or <session-key>|<target>|<epic>|<accountable-lane-id>|<lane-class>|<lane-profile>."
    }

    $SessionKey = $Parts[0].Trim()
    $Target = $Parts[1].Trim()
    $Epic = $Parts[2].Trim()
    if ([string]::IsNullOrWhiteSpace($SessionKey) -or [string]::IsNullOrWhiteSpace($Target) -or [string]::IsNullOrWhiteSpace($Epic)) {
      throw "Invalid lane spec '$Spec'. Session key, project/repo target, and Epic must all be non-empty."
    }

    if ($SeenSessions.ContainsKey($SessionKey.ToLowerInvariant())) {
      throw "Duplicate session key in lane specs: '$SessionKey'. Use one accountable lane per session."
    }
    $SeenSessions[$SessionKey.ToLowerInvariant()] = $true

    $BuiltInRoleLabel = Get-OCRouterRoleLabel -Key $SessionKey
    $AccountableLane = if ($Parts.Count -eq 6) { $Parts[3].Trim() } else { $BuiltInRoleLabel }
    $LaneClass = if ($Parts.Count -eq 6) { $Parts[4].Trim().ToUpperInvariant() } else { 'TRACK' }
    $LaneProfile = if ($Parts.Count -eq 6) { $Parts[5].Trim() } else { $SessionKey }
    if ([string]::IsNullOrWhiteSpace($AccountableLane) -or [string]::IsNullOrWhiteSpace($LaneProfile)) {
      throw "Invalid lane spec '$Spec'. Accountable lane ID and profile must be non-empty."
    }
    if ($LaneClass -notin @('TRACK', 'SPECIALIST_DELIVERY', 'GOVERNANCE')) {
      throw "Invalid lane class '$LaneClass' in '$Spec'. Expected TRACK, SPECIALIST_DELIVERY, or GOVERNANCE."
    }
    if ($Parts.Count -eq 3 -and $SessionKey -notmatch '^track-') {
      throw "Non-Track session '$SessionKey' requires the explicit six-field lane form; lane class may not be inferred."
    }

    $RoleLabel = $BuiltInRoleLabel
    if ([string]::IsNullOrWhiteSpace($RoleLabel)) {
      if ($Parts.Count -eq 6) {
        $RoleLabel = $AccountableLane
      } else {
        throw "Track session '$SessionKey' does not map to a known built-in role label. Use the explicit six-field form for a project-defined session."
      }
    }

    $SessionEntry = $null
    if ($null -ne $Config) {
      $SessionEntry = Get-OCRouterSessionEntry -Config $Config -Name $SessionKey
    }

    $Lanes.Add([pscustomobject]@{
      index = $Index + 1
      session_key = $SessionKey
      track_key = $SessionKey
      role_label = $RoleLabel
      target = $Target
      epic_id = $Epic
      accountable_lane = $AccountableLane
      lane_class = $LaneClass
      lane_profile = $LaneProfile
      relevant_dependency = 'none'
      safe_name = (Get-OCRouterSafeName -Value $SessionKey)
      session_entry = $SessionEntry
    })
  }

  return @($Lanes.ToArray())
}

function New-OCRouterTrackResponseContract {
  param(
    [object[]]$Lanes,
    [string]$Command
  )

  $Lines = New-Object System.Collections.Generic.List[string]
  $Lines.Add("=== RESPONSE CONTRACT START ===")
  $Lines.Add("Return exactly $($Lanes.Count) track response blocks.")
  $Lines.Add("Do not merge lanes.")
  $Lines.Add("Do not let one Track's findings or next actions bleed into another Track block.")
  $Lines.Add("Each block must be copy-pasteable as the full body for the named Track's /$Command handoff.")
  $Lines.Add("")

  foreach ($Lane in $Lanes) {
    $Lines.Add("=== TRACK RESPONSE START ===")
    $Lines.Add("TRACK: $($Lane.track_key)")
    $Lines.Add("TARGET: $($Lane.target)")
    $Lines.Add("EPIC: $($Lane.epic_id)")
    $Lines.Add("ACCOUNTABLE LANE: $($Lane.accountable_lane)")
    $Lines.Add("LANE CLASS / PROFILE: $($Lane.lane_class) / $($Lane.lane_profile)")
    $Lines.Add("RELEVANT SHARED DEPENDENCY: <none or one exact dependency>")
    $Lines.Add("COMMAND: $Command")
    $Lines.Add("<body only for $($Lane.role_label) / $($Lane.target)>")
    $Lines.Add("=== TRACK RESPONSE END ===")
    $Lines.Add("")
  }

  $Lines.Add("=== RESPONSE CONTRACT END ===")
  return ($Lines -join "`n")
}

function New-OCRouterParallelPlanReviewRequest {
  param(
    [object[]]$Lanes,
    [hashtable]$LaneTexts
  )

  $Lines = New-Object System.Collections.Generic.List[string]
  for ($Index = 0; $Index -lt $Lanes.Count; $Index++) {
    $Lane = $Lanes[$Index]
    $Text = [string]$LaneTexts[$Lane.track_key]
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw "Missing plan text for lane '$($Lane.track_key)'."
    }

    $Lines.Add("Target: $($Lane.target)")
    $Lines.Add("Track: $($Lane.role_label)")
    $Lines.Add("TrackKey: $($Lane.track_key)")
    $Lines.Add("")
    $Lines.Add("Plan:")
    $Lines.Add($Text.Trim())

    if ($Index -lt ($Lanes.Count - 1)) {
      $Lines.Add("")
      $Lines.Add("=== NEXT LANE ===")
      $Lines.Add("")
    }
  }

  $Lines.Add("")
  $Lines.Add("PARALLEL PLAN REVIEW INSTRUCTION:")
  $Lines.Add("- This request contains $($Lanes.Count) parallel lanes for one combined Meta plan review pass.")
  $Lines.Add("- Review all lanes together, but keep guidance isolated per Track.")
  $Lines.Add("- Do not let Track ownership, blockers, or implementation details leak between lanes unless they are truly shared dependencies.")
  $Lines.Add("- If one lane is GREEN and another is YELLOW/RED, reflect that separately in the track response blocks.")
  $Lines.Add("")
  $Lines.Add((New-OCRouterTrackResponseContract -Lanes $Lanes -Command "terv-review-utan"))
  return ($Lines -join "`n")
}

function New-OCRouterParallelStepReviewRequest {
  param(
    [object[]]$Lanes,
    [hashtable]$LaneTexts
  )

  $Lines = New-Object System.Collections.Generic.List[string]
  for ($Index = 0; $Index -lt $Lanes.Count; $Index++) {
    $Lane = $Lanes[$Index]
    $Text = [string]$LaneTexts[$Lane.track_key]
    if ([string]::IsNullOrWhiteSpace($Text)) {
      throw "Missing implementation brief for lane '$($Lane.track_key)'."
    }

    $Lines.Add("Target: $($Lane.target)")
    $Lines.Add("Track: $($Lane.role_label)")
    $Lines.Add("TrackKey: $($Lane.track_key)")
    $Lines.Add("")
    $Lines.Add("Brief:")
    $Lines.Add($Text.Trim())

    if ($Index -lt ($Lanes.Count - 1)) {
      $Lines.Add("")
      $Lines.Add("=== NEXT LANE ===")
      $Lines.Add("")
    }
  }

  $Lines.Add("")
  $Lines.Add("PARALLEL STEP REVIEW INSTRUCTION:")
  $Lines.Add("- This request contains $($Lanes.Count) parallel lanes for one combined Meta step-review pass.")
  $Lines.Add("- Phase 1 must produce one combined Swarm Assistant prompt that covers every lane.")
  $Lines.Add("- The combined Swarm prompt must ask the reviewer to keep findings lane-specific.")
  $Lines.Add("- Final synthesis must return one isolated track response block per lane using the exact contract below.")
  $Lines.Add("")
  $Lines.Add("Phase 1 must use the canonical exact envelope:")
  $Lines.Add("SWARM ASSISTANT PROMPT")
  $Lines.Add("/swarm-review")
  $Lines.Add("<complete combined Swarm review packet for all lanes>")
  $Lines.Add("WAITING FOR GO")
  $Lines.Add("")
  $Lines.Add((New-OCRouterTrackResponseContract -Lanes $Lanes -Command "step-review-utan"))
  return ($Lines -join "`n")
}

function Get-OCRouterDelimitedBlock {
  param(
    [string]$Text,
    [string]$StartMarker,
    [string]$EndMarker
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $Pattern = '(?ms)' + [regex]::Escape($StartMarker) + '\s*(?<body>.*?)\s*' + [regex]::Escape($EndMarker)
  $Match = [regex]::Match($Text, $Pattern)
  if (-not $Match.Success) {
    return ""
  }

  return $Match.Groups['body'].Value.Trim()
}

function Get-OCRouterCombinedSwarmPrompt {
  param([string]$Text)

  $Prompt = Get-OCRouterDelimitedBlock -Text $Text -StartMarker '=== SWARM PROMPT START ===' -EndMarker '=== SWARM PROMPT END ==='
  if (-not [string]::IsNullOrWhiteSpace($Prompt)) {
    return $Prompt
  }

  return Get-OCRouterSwarmAssistantPrompt -Text $Text
}

function Get-OCRouterTrackResponseBlocks {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @()
  }

  $Pattern = '(?ms)^\s*=== TRACK RESPONSE START ===\s*TRACK:\s*(?<track>[^\r\n]+)\s*TARGET:\s*(?<target>[^\r\n]+)\s*EPIC:\s*(?<epic>[^\r\n]+)\s*ACCOUNTABLE LANE:\s*(?<accountable>[^\r\n]+)\s*LANE CLASS / PROFILE:\s*(?<laneclass>[^/\r\n]+)\s*/\s*(?<laneprofile>[^\r\n]+)\s*RELEVANT SHARED DEPENDENCY:\s*(?<dependency>[^\r\n]+)\s*COMMAND:\s*(?<command>[^\r\n]+)\s*(?<body>.*?)^\s*=== TRACK RESPONSE END ==='
  $Matches = [regex]::Matches($Text, $Pattern)
  $Blocks = New-Object System.Collections.Generic.List[object]
  foreach ($Match in $Matches) {
    $Blocks.Add([pscustomobject]@{
      track = $Match.Groups['track'].Value.Trim()
      target = $Match.Groups['target'].Value.Trim()
      epic = $Match.Groups['epic'].Value.Trim()
      accountable_lane = $Match.Groups['accountable'].Value.Trim()
      lane_class = $Match.Groups['laneclass'].Value.Trim()
      lane_profile = $Match.Groups['laneprofile'].Value.Trim()
      relevant_dependency = $Match.Groups['dependency'].Value.Trim()
      command = $Match.Groups['command'].Value.Trim().TrimStart('/')
      body = $Match.Groups['body'].Value.Trim()
    })
  }

  return @($Blocks.ToArray())
}

function Test-OCRouterParallelTrackResponseEnvelope {
  param(
    [string]$Text,
    [object[]]$Lanes,
    [string]$ExpectedCommand,
    [string]$ExpectedBodyKind,
    [string[]]$SurfacedFindingIds = @()
  )

  if ([string]::IsNullOrWhiteSpace($Text) -or $null -eq $Lanes -or $Lanes.Count -eq 0 -or
      [string]::IsNullOrWhiteSpace($ExpectedCommand) -or [string]::IsNullOrWhiteSpace($ExpectedBodyKind)) {
    return $false
  }

  $Normalized = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  $Pattern = '(?ms)^=== TRACK RESPONSE START ===\nTRACK: (?<track>[^\n]+)\nTARGET: (?<target>[^\n]+)\nEPIC: (?<epic>[^\n]+)\nACCOUNTABLE LANE: (?<accountable>[^\n]+)\nLANE CLASS / PROFILE: (?<laneclass>[^/\n]+) / (?<laneprofile>[^\n]+)\nRELEVANT SHARED DEPENDENCY: (?<dependency>[^\n]+)\nCOMMAND: (?<command>[^\n]+)\n(?<body>.*?)\n=== TRACK RESPONSE END ===(?=\n|\z)'
  $BlockMatches = [regex]::Matches($Normalized, $Pattern)
  if ($BlockMatches.Count -ne $Lanes.Count) {
    return $false
  }

  $Cursor = 0
  foreach ($Match in $BlockMatches) {
    if ($Match.Index -lt $Cursor -or $Normalized.Substring($Cursor, $Match.Index - $Cursor) -notmatch '^\s*$') {
      return $false
    }
    $Cursor = $Match.Index + $Match.Length
  }
  if ($Normalized.Substring($Cursor) -notmatch '^\s*$') {
    return $false
  }

  $LaneMap = [System.Collections.Generic.Dictionary[string,object]]::new([System.StringComparer]::Ordinal)
  foreach ($Lane in $Lanes) {
    $TrackKey = [string]$Lane.track_key
    if ([string]::IsNullOrWhiteSpace($TrackKey) -or $LaneMap.ContainsKey($TrackKey)) {
      return $false
    }
    $LaneMap.Add($TrackKey, $Lane)
  }

  $Seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
  $EnvelopeFindingIds = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach ($Match in $BlockMatches) {
    $Track = [string]$Match.Groups['track'].Value
    $Target = [string]$Match.Groups['target'].Value
    $Epic = [string]$Match.Groups['epic'].Value
    $Accountable = [string]$Match.Groups['accountable'].Value
    $LaneClass = [string]$Match.Groups['laneclass'].Value
    $LaneProfile = [string]$Match.Groups['laneprofile'].Value
    $Dependency = [string]$Match.Groups['dependency'].Value
    $Command = [string]$Match.Groups['command'].Value
    $Body = [string]$Match.Groups['body'].Value.Trim()
    if (-not $LaneMap.ContainsKey($Track) -or -not $Seen.Add($Track)) {
      return $false
    }
    $Lane = $LaneMap[$Track]
    if ($Target -cne [string]$Lane.target -or $Epic -cne [string]$Lane.epic_id -or
        $Accountable -cne [string]$Lane.accountable_lane -or $LaneClass -cne [string]$Lane.lane_class -or
        $LaneProfile -cne [string]$Lane.lane_profile -or $Command -cne $ExpectedCommand -or
        [string]::IsNullOrWhiteSpace($Dependency) -or $Dependency -match '^(?i:<[^>]+>|TBD|TODO)$' -or
        [string]::IsNullOrWhiteSpace($Body)) {
      return $false
    }
    $BodyContext = [pscustomobject]@{
      target = [string]$Lane.target
      epic = [string]$Lane.epic_id
      accountable_lane = [string]$Lane.accountable_lane
      lane_class = [string]$Lane.lane_class
      lane_profile = [string]$Lane.lane_profile
      candidate = if ($ExpectedBodyKind -cne 'meta_final_synthesis' -or $null -eq $Lane.PSObject.Properties['candidate_identity']) { '' } else { [string]$Lane.candidate_identity }
      plan_artifact = if ($ExpectedBodyKind -cne 'meta_plan_review' -or $null -eq $Lane.PSObject.Properties['plan_artifact']) { '' } else { [string]$Lane.plan_artifact }
      plan_class = if ($ExpectedBodyKind -cne 'meta_plan_review' -or $null -eq $Lane.PSObject.Properties['plan_class']) { '' } else { [string]$Lane.plan_class }
    }
    if (($ExpectedBodyKind -ceq 'meta_final_synthesis' -and [string]::IsNullOrWhiteSpace([string]$BodyContext.candidate)) -or
        ($ExpectedBodyKind -ceq 'meta_plan_review' -and [string]::IsNullOrWhiteSpace([string]$BodyContext.plan_artifact))) {
      return $false
    }
    if (-not (Test-OCRouterExpectedOutputKind -Text $Body -ExpectedOutputKind $ExpectedBodyKind -ExpectedOutputContext $BodyContext)) {
      return $false
    }
    if ($ExpectedBodyKind -ceq 'meta_final_synthesis') {
      foreach ($FindingId in @(Get-OCRouterFinalDispositionSourceFindingIds -Text $Body)) { [void]$EnvelopeFindingIds.Add([string]$FindingId) }
    }
    $BodyEpic = Get-OCRouterTopLevelFieldValue -Text $Body -Field 'Epic'
    if ([string]::IsNullOrWhiteSpace($BodyEpic) -or $BodyEpic -cne $Epic) {
      return $false
    }
  }

  foreach ($FindingId in @($SurfacedFindingIds)) {
    if ([string]::IsNullOrWhiteSpace([string]$FindingId) -or -not $EnvelopeFindingIds.Contains([string]$FindingId)) { return $false }
  }
  return ($Seen.Count -eq $Lanes.Count)
}

function Get-OCRouterTrackResponseBlock {
  param(
    [string]$Text,
    [string]$Track,
    [string]$ExpectedTarget = "",
    [string]$ExpectedCommand = ""
  )

  $Blocks = @(Get-OCRouterTrackResponseBlocks -Text $Text)
  $Filtered = @($Blocks | Where-Object { $_.track.Trim().ToLowerInvariant() -eq $Track.Trim().ToLowerInvariant() })
  if ($Filtered.Count -eq 0) {
    throw "No TRACK RESPONSE block found for track '$Track'."
  }
  if ($Filtered.Count -gt 1) {
    throw "Multiple TRACK RESPONSE blocks found for track '$Track'."
  }

  $Block = $Filtered[0]
  if (-not [string]::IsNullOrWhiteSpace($ExpectedTarget) -and $Block.target -ne $ExpectedTarget) {
    throw "TRACK RESPONSE block for '$Track' had target '$($Block.target)' but expected '$ExpectedTarget'."
  }
  if (-not [string]::IsNullOrWhiteSpace($ExpectedCommand) -and $Block.command.TrimStart('/').ToLowerInvariant() -ne $ExpectedCommand.TrimStart('/').ToLowerInvariant()) {
    throw "TRACK RESPONSE block for '$Track' had command '$($Block.command)' but expected '$ExpectedCommand'."
  }

  return $Block
}

function Get-OCRouterModeFromText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $Modes = New-Object System.Collections.Generic.List[string]
  foreach ($Record in @(Get-OCRouterTopLevelLineRecords -Text $Text)) {
    $Line = [string]$Record.Text
    $Match = [regex]::Match($Line, '^(ACK_ONLY|FIX_PLAN_REQUIRED|UNCLEAR|REVIEW_READY|IMPLEMENT_BLOCKED)$')
    if ($Match.Success) {
      $Modes.Add($Match.Groups[1].Value.ToUpperInvariant())
    }
  }

  $Unique = @($Modes.ToArray() | Select-Object -Unique)
  if ($Unique.Count -eq 1) {
    return [string]$Unique[0]
  }

  return ""
}

function Get-OCRouterImplementationTouchedPaths {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @()
  }

  $Normalized = $Text -replace "`r`n", "`n"
  $SectionText = $Normalized
  $HeadingMatches = [regex]::Matches($Normalized, '(?m)^###\s+')
  if ($HeadingMatches.Count -ge 2) {
    $StartIndex = $HeadingMatches[1].Index
    $EndIndex = if ($HeadingMatches.Count -ge 3) { $HeadingMatches[2].Index } else { $Normalized.Length }
    $SectionText = $Normalized.Substring($StartIndex, $EndIndex - $StartIndex)
  }

  $Paths = New-Object System.Collections.Generic.List[string]
  $Seen = @{}

  foreach ($Match in [regex]::Matches($SectionText, '`(?<path>[^`\r\n]+\.[A-Za-z0-9]+)`')) {
    $Path = $Match.Groups['path'].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($Path)) {
      continue
    }

    $Key = $Path.ToLowerInvariant()
    if (-not $Seen.ContainsKey($Key)) {
      $Seen[$Key] = $true
      $Paths.Add($Path)
    }
  }

  if ($Paths.Count -gt 0) {
    return @($Paths.ToArray())
  }

  foreach ($Match in [regex]::Matches($SectionText, '(?m)^\s*-\s+(?<path>[A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)\s*$')) {
    $Path = $Match.Groups['path'].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($Path)) {
      continue
    }

    $Key = $Path.ToLowerInvariant()
    if (-not $Seen.ContainsKey($Key)) {
      $Seen[$Key] = $true
      $Paths.Add($Path)
    }
  }

  return @($Paths.ToArray())
}

function Test-OCRouterContractRiskPath {
  param([string]$Path)

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $false
  }

  $Normalized = ($Path -replace '\\', '/').Trim()
  $Patterns = @(
    '(?i)(^|/)(commands|skills)/',
    '(?i)(^|/).*snapshot.*\.cs$',
    '(?i)(^|/)readmodel/.*\.cs$',
    '(?i)(^|/)(openapi|swagger)\.(json|ya?ml)$',
    '(?i)(^|/).*schema.*\.(json|ya?ml|md)$',
    '(?i)\.(json|ya?ml)$',
    '(?i)(^|/).*prompt.*\.md$'
  )

  foreach ($Pattern in $Patterns) {
    if ($Normalized -match $Pattern) {
      return $true
    }
  }

  return $false
}

function Get-OCRouterContractRiskPathsFromImplementationTexts {
  param([string[]]$Texts)

  $Matches = New-Object System.Collections.Generic.List[string]
  $Seen = @{}

  foreach ($Text in @($Texts)) {
    foreach ($Path in @(Get-OCRouterImplementationTouchedPaths -Text $Text)) {
      if (-not (Test-OCRouterContractRiskPath -Path $Path)) {
        continue
      }

      $Key = $Path.ToLowerInvariant()
      if (-not $Seen.ContainsKey($Key)) {
        $Seen[$Key] = $true
        $Matches.Add($Path)
      }
    }
  }

  return @($Matches.ToArray())
}

function Get-OCRouterFixCycleReviewTier {
  param([int]$ReviewCycleIndex)

  # Cycle count is evidence for observability only. It never chooses breadth,
  # lanes, or Swarm. Every cycle must resolve the current candidate's risk.
  return [pscustomobject]@{
    review_cycle_index = [Math]::Max(0, $ReviewCycleIndex)
    source = 'cycle-count-signal-only'
  }
}

function Get-OCRouterTopLevelFieldValue {
  param(
    [string]$Text,
    [string]$Field
  )

  $Pattern = '^' + [regex]::Escape($Field) + '\s*:\s*(?<value>\S.*?)\s*$'
  $Matches = @()
  foreach ($Record in @(Get-OCRouterTopLevelLineRecords -Text $Text)) {
    $Match = [regex]::Match([string]$Record.Text, $Pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($Match.Success) { $Matches += $Match.Groups['value'].Value.Trim() }
  }
  if ($Matches.Count -eq 1) { return [string]$Matches[0] }
  return ""
}

function Resolve-OCRouterOwnerApprovalRecord {
  param(
    [string]$Record,
    [string]$Target,
    [string]$Epic,
    [string]$Candidate,
    [string]$ReviewProfile,
    [string]$SwarmDepth,
    [int]$LaneCount,
    [string]$CostEnvelope
  )

  if ([string]::IsNullOrWhiteSpace($Record)) {
    return $null
  }
  $RecordPath = $Record.Trim()
  $Uri = $null
  if ([uri]::TryCreate($RecordPath, [UriKind]::Absolute, [ref]$Uri) -and -not $Uri.IsFile) {
    throw "OwnerApprovalRecord URI scheme '$($Uri.Scheme)' is not supported by this wrapper; provide a pinned local path or file URI."
  }
  if ($null -ne $Uri -and $Uri.IsFile) { $RecordPath = $Uri.LocalPath }
  $Resolved = (Resolve-Path -LiteralPath $RecordPath -ErrorAction Stop).Path
  $Text = Get-Content -LiteralPath $Resolved -Raw
  $Records = @(Get-OCRouterTopLevelLineRecords -Text $Text)
  if ($Records.Count -ne 10 -or [string]$Records[0].Text -cne 'OWNER REVIEW EXPANSION APPROVAL') {
    throw "Owner approval artifact has no canonical OWNER REVIEW EXPANSION APPROVAL envelope: $Resolved"
  }

  $Expected = [ordered]@{
    'Approval version' = '1'
    'Target' = $Target
    'Epic' = $Epic
    'Candidate' = $Candidate
    'Review profile' = $ReviewProfile
    'Swarm depth' = $SwarmDepth
    'Lanes' = [string]$LaneCount
    'Cost envelope' = $CostEnvelope
    'Owner approval' = 'APPROVED'
  }
  $ExpectedIndex = 1
  foreach ($Entry in $Expected.GetEnumerator()) {
    if ([string]::IsNullOrWhiteSpace([string]$Entry.Value)) {
      throw "Approval binding '$($Entry.Key)' cannot be empty."
    }
    $Actual = Get-OCRouterTopLevelFieldValue -Text $Text -Field ([string]$Entry.Key)
    if ([string]::IsNullOrWhiteSpace($Actual) -or $Actual -cne [string]$Entry.Value) {
      throw "Owner approval artifact binding mismatch for '$($Entry.Key)': expected '$($Entry.Value)', got '$Actual'."
    }
    if ([string]$Records[$ExpectedIndex].Text -cne "$($Entry.Key): $($Entry.Value)") {
      throw "Owner approval artifact field '$($Entry.Key)' is not in the canonical exact order."
    }
    $ExpectedIndex += 1
  }

  return [pscustomobject]@{
    path = $Resolved
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Resolved).Hash
    version = 1
    target = $Target
    epic = $Epic
    candidate = $Candidate
    review_profile = $ReviewProfile
    swarm_depth = $SwarmDepth
    lanes = $LaneCount
    cost_envelope = $CostEnvelope
  }
}

function Resolve-OCRouterReviewControls {
  param(
    [int]$ReviewCycleIndex = 0,
    [int]$RequestedMetaInternalLanes = -1,
    [bool]$ExplicitMetaInternalLanes = $false,
    [bool]$ExplicitSkipSwarmReview = $false,
    [bool]$ExplicitUseSwarmReview = $false,
    [bool]$ForceFullReview = $false,
    [string]$ReviewProfile = "auto",
    [bool]$ExplicitReviewProfile = $false,
    [string]$ProjectReviewContext = "auto",
    [string]$ReviewFocus = "",
    [string[]]$RequestedReviewLanes = @(),
    [bool]$ExplicitReviewLanes = $false,
    [bool]$ExpandedReviewApproved = $false,
    [string]$OwnerApprovalRecord = "",
    [string]$ReviewRegistryPath = "",
    [string]$RequestedSwarmReviewDepth = "auto",
    [string]$ApprovalTarget = "",
    [string]$ApprovalEpic = "",
    [string]$ApprovalCandidate = "",
    [string]$ApprovalCostEnvelope = "",
    [string[]]$ImplementationTexts = @()
  )

  if ($ExplicitUseSwarmReview -or $ForceFullReview) {
    throw "Active Swarm review transport is retired by Agent Workflow Canon 3.x. Start a fresh candidate-bound native /step-review."
  }

  if ($ExplicitMetaInternalLanes) {
    if ($RequestedMetaInternalLanes -lt 0 -or $RequestedMetaInternalLanes -gt 7) {
      throw "MetaInternalLanes must be between 0 and 7 when explicitly set."
    }
  }

  $RequestedProfile = Normalize-OCRouterReviewProfile -Profile $ReviewProfile
  $RequestedProject = Normalize-OCRouterProjectReviewContext -Context $ProjectReviewContext
  if ($RequestedProfile -in @('full', 'adaptive')) {
    throw "full/adaptive were retired Swarm topology controls. Use a native review budget policy and assignment cap."
  }
  $ContractRiskPaths = @(Get-OCRouterContractRiskPathsFromImplementationTexts -Texts $ImplementationTexts)
  $Signals = (($ReviewFocus, ($ImplementationTexts -join "`n")) -join "`n").ToLowerInvariant()
  $RiskEscalation = $ContractRiskPaths.Count -gt 0 -or $Signals -match 'security|safety|auth|permission|injection|trust.boundary|architecture|contract|schema|public.api|serialization'

  $Registry = $null
  $RegistryContext = $null
  if (-not [string]::IsNullOrWhiteSpace($ReviewRegistryPath)) {
    $Registry = Get-OCRouterReviewRegistry -Path $ReviewRegistryPath
  }
  elseif ($RequestedProject -ne 'auto') {
    throw "A target-specific ProjectReviewContext requires ReviewRegistryPath or target router setting mapping."
  }

  $NormalizedProfile = if ($RequestedProfile -eq 'auto') { if ($RiskEscalation) { 'high_risk' } else { 'standard' } } else { $RequestedProfile }
  $NormalizedProjectContext = $RequestedProject
  if ($null -ne $Registry) {
    $RegistryContext = Resolve-OCRouterReviewRegistryContext -Registry $Registry -ProjectReviewContext $RequestedProject -ReviewProfile $NormalizedProfile
    $NormalizedProjectContext = [string]$RegistryContext.project_id
    if ($RequestedProfile -eq 'auto' -and -not $RiskEscalation -and [string]$RegistryContext.profile_id -ne 'auto') {
      $NormalizedProfile = [string]$RegistryContext.profile_id
      $RegistryContext = Resolve-OCRouterReviewRegistryContext -Registry $Registry -ProjectReviewContext $NormalizedProjectContext -ReviewProfile $NormalizedProfile
    }
  }

  $BuiltInProfiles = @(Get-OCRouterBuiltInReviewProfiles)
  if ($BuiltInProfiles -notcontains $NormalizedProfile -and ($null -eq $RegistryContext -or -not [bool]$RegistryContext.has_profile_mapping)) {
    throw "Unknown custom review profile '$NormalizedProfile'; declare it in the target review registry."
  }
  $MappedLanes = if ($null -eq $RegistryContext -or -not [bool]$RegistryContext.has_profile_mapping) { @() } else { @($RegistryContext.profile.lanes) }
  $DefaultLaneCount = switch ($NormalizedProfile) {
    'quick' { 0 }
    'focused' { 1 }
    'standard' { 3 }
    'high_risk' { 4 }
    'deep' { 5 }
    'audit' { 5 }
    'wide' { 7 }
    'custom' { -1 }
    default { $MappedLanes.Count }
  }
  $MetaInternalLanes = if ($ExplicitReviewLanes) {
    @($RequestedReviewLanes | ForEach-Object { @(([string]$_) -split ',') } | ForEach-Object { $_.Trim() } | Where-Object { $_ }).Count
  }
  elseif ($ExplicitMetaInternalLanes) {
    $RequestedMetaInternalLanes
  }
  else {
    $DefaultLaneCount
  }
  if ($MetaInternalLanes -lt 0) { throw "ReviewProfile '$NormalizedProfile' requires explicit ReviewLanes or MetaInternalLanes." }
  if ($ExplicitMetaInternalLanes -and $ExplicitReviewLanes -and $MetaInternalLanes -ne $RequestedMetaInternalLanes) {
    throw "Explicit ReviewLanes count ($MetaInternalLanes) must match MetaInternalLanes ($RequestedMetaInternalLanes)."
  }

  $ConfiguredSwarm = 'none'

  switch ($NormalizedProfile) {
    'quick' {
      if ($MetaInternalLanes -ne 0) { throw "quick review requires zero delegated lanes." }
      if ($ConfiguredSwarm -ne 'none') { throw "quick review must use native Meta review only." }
    }
    'focused' {
      if ($MetaInternalLanes -ne 1) { throw "focused review requires exactly one delegated lane." }
    }
    'standard' {
      if ($MetaInternalLanes -gt 3) { throw "standard review supports at most three delegated lanes." }
    }
    'high_risk' {
      if ($MetaInternalLanes -gt 4) { throw "high_risk review supports at most four delegated lanes." }
    }
    'deep' { if ($MetaInternalLanes -ne 5) { throw "deep review requires exactly five delegated lanes." } }
    'audit' { if ($MetaInternalLanes -ne 5) { throw "audit review requires exactly five delegated lanes." } }
    'wide' { if ($MetaInternalLanes -ne 7) { throw "wide review requires exactly seven delegated lanes." } }
    'custom' { if (-not $ExplicitReviewLanes) { throw "custom review requires explicit ReviewLanes." } }
  }

  $RequestedDepth = Normalize-OCRouterSwarmReviewDepth -Depth $RequestedSwarmReviewDepth
  if ($RequestedDepth -notin @('auto', 'none')) {
    throw "SwarmReviewDepth '$RequestedDepth' is retired. Native review breadth is expressed by budget policy and assignment cap."
  }
  $EffectiveSwarmDepth = 'none'
  $ApprovalDepthBinding = 'none'
  $ApprovalRequired =
    ($null -ne $RegistryContext -and [bool]$RegistryContext.has_profile_mapping -and [bool]$RegistryContext.profile.owner_approval_required)
  $Approval = $null
  if ($ApprovalRequired -or -not [string]::IsNullOrWhiteSpace($OwnerApprovalRecord)) {
    $Approval = Resolve-OCRouterOwnerApprovalRecord `
      -Record $OwnerApprovalRecord `
      -Target $ApprovalTarget `
      -Epic $ApprovalEpic `
      -Candidate $ApprovalCandidate `
      -ReviewProfile $NormalizedProfile `
      -SwarmDepth $ApprovalDepthBinding `
      -LaneCount $MetaInternalLanes `
      -CostEnvelope $ApprovalCostEnvelope
  }
  if ($ApprovalRequired -and $null -eq $Approval) {
    throw "This exact native-review envelope requires a verified candidate-bound OwnerApprovalRecord artifact."
  }
  if ($ExpandedReviewApproved -and $null -eq $Approval) {
    throw "ExpandedReviewApproved without a verified pinned OwnerApprovalRecord is not authority."
  }

  $LaneResolution = Resolve-OCRouterReviewLanes `
    -LaneCount $MetaInternalLanes `
    -ReviewProfile $NormalizedProfile `
    -ReviewFocus $ReviewFocus `
    -ImplementationTexts $ImplementationTexts `
    -Registry $Registry `
    -RegistryContext $RegistryContext `
    -RequestedReviewLanes $RequestedReviewLanes `
    -ExplicitReviewLanes $ExplicitReviewLanes
  $Source = if ($RiskEscalation -and -not $ExplicitReviewProfile) { 'current-risk-re-resolved' } elseif ($ExplicitReviewProfile) { 'explicit-review-profile' } else { 'portable-canonical-default' }
  $BudgetPolicy = switch ($NormalizedProfile) {
    'quick' { 'conserve' }
    'focused' { 'conserve' }
    'standard' { 'balanced' }
    'high_risk' { 'quality_first' }
    'deep' { 'quality_first' }
    'audit' { 'quality_first' }
    'wide' { 'exact' }
    'custom' { 'exact' }
    default { 'balanced' }
  }

  return [pscustomobject]@{
    review_cycle_index = $ReviewCycleIndex
    review_transport = 'native'
    budget_policy = $BudgetPolicy
    assignment_cap = [int]$MetaInternalLanes
    requested_domains = @($LaneResolution.lanes)
    skip_swarm_review = $true
    swarm_review_depth = $EffectiveSwarmDepth
    swarm_topology_control = $ApprovalDepthBinding
    meta_internal_lanes = [int]$MetaInternalLanes
    source = $Source
    contract_risk_paths = @($ContractRiskPaths)
    review_profile = $NormalizedProfile
    project_review_context = $NormalizedProjectContext
    review_focus = $ReviewFocus
    review_lanes = @($LaneResolution.lanes)
    lane_selection_reason = [string]$LaneResolution.reason
    review_registry_path = if ($null -eq $Registry) { '' } else { [string]$Registry.resolved_path }
    review_registry_sha256 = if ($null -eq $Registry) { '' } else { [string]$Registry.sha256 }
    review_registry_version = if ($null -eq $Registry) { 0 } else { [int]$Registry.version }
    owner_approval_record = if ($null -eq $Approval) { '' } else { [string]$Approval.path }
    owner_approval_sha256 = if ($null -eq $Approval) { '' } else { [string]$Approval.sha256 }
    owner_approval_version = if ($null -eq $Approval) { 0 } else { [int]$Approval.version }
    owner_approval_target = if ($null -eq $Approval) { '' } else { [string]$Approval.target }
    owner_approval_epic = if ($null -eq $Approval) { '' } else { [string]$Approval.epic }
    owner_approval_candidate = if ($null -eq $Approval) { '' } else { [string]$Approval.candidate }
    owner_approval_cost_envelope = if ($null -eq $Approval) { '' } else { [string]$Approval.cost_envelope }
    owner_approval_identity = if ($null -eq $Approval) { '' } else { "$($Approval.target)|$($Approval.epic)|$($Approval.candidate)|$($Approval.review_profile)|$($Approval.swarm_depth)|$($Approval.lanes)|$($Approval.cost_envelope)" }
  }
}

function New-OCRouterReviewControlArgumentPrefix {
  param(
    [bool]$SkipSwarmReview,
    [int]$MetaInternalLanes,
    [string]$ReviewProfile = "standard",
    [string]$ProjectReviewContext = "auto",
    [string]$ModelProfile = "economy",
    [bool]$ExpandedReviewApproved = $false,
    [string]$OwnerApprovalRecord = "",
    [string]$ReviewRegistryPath = "",
    [string]$ReviewFocus = "",
    [string[]]$ReviewLanes = @()
  )

  $BudgetPolicy = switch ($ReviewProfile) {
    'quick' { 'conserve' }
    'focused' { 'conserve' }
    'standard' { 'balanced' }
    'high_risk' { 'quality_first' }
    'deep' { 'quality_first' }
    'audit' { 'quality_first' }
    'wide' { 'exact' }
    'custom' { 'exact' }
    default { 'balanced' }
  }
  $Lines = @(
    '--review-control-version 3',
    '--review-transport native',
    ('--budget-policy {0}' -f $BudgetPolicy),
    ('--assignment-cap {0}' -f $MetaInternalLanes),
    ('--legacy-shape-alias {0}' -f $ReviewProfile),
    ('--project-review-context {0}' -f $ProjectReviewContext),
    ('--review-model-profile {0}' -f $ModelProfile),
    ('--expanded-review-approved {0}' -f $ExpandedReviewApproved.ToString().ToLowerInvariant())
  )
  if (@($ReviewLanes).Count -gt 0) {
    $Lines += ('--requested-domains {0}' -f (@($ReviewLanes) -join ','))
  }
  if (-not [string]::IsNullOrWhiteSpace($ReviewFocus)) {
    $Lines += ('--review-focus {0}' -f $ReviewFocus.Trim())
  }
  if (-not [string]::IsNullOrWhiteSpace($OwnerApprovalRecord)) {
    $Lines += ('--owner-approval-record {0}' -f $OwnerApprovalRecord.Trim())
  }
  if (-not [string]::IsNullOrWhiteSpace($ReviewRegistryPath)) {
    $Lines += ('--review-registry {0}' -f $ReviewRegistryPath.Trim())
  }
  return $Lines -join "`n"
}

function Assert-OCRouterFalCheckpointScalar {
  param(
    [string]$Field,
    [string]$Value,
    [switch]$AllowNotApplicable
  )

  $Normalized = ([string]$Value).Trim()
  if ([string]::IsNullOrWhiteSpace($Normalized) -or $Normalized -match '[\r\n]') {
    throw "FAL checkpoint identity field '$Field' is missing or contains a line break."
  }
  if ($Normalized -match '(?i)^(?:<[^>]*>|UNKNOWN|TBD|TODO|NULL|UNRESOLVED|PLACEHOLDER)$') {
    throw "FAL checkpoint identity field '$Field' is unresolved: '$Normalized'."
  }
  if (-not $AllowNotApplicable -and $Normalized -match '(?i)^(?:N/?A|NOT_APPLICABLE)$') {
    throw "FAL checkpoint identity field '$Field' cannot be not-applicable."
  }
  return $Normalized
}

function Resolve-OCRouterFalCheckpointDirectory {
  param(
    [string]$Field,
    [string]$Path
  )

  $Checked = Assert-OCRouterFalCheckpointScalar -Field $Field -Value $Path
  if (-not (Test-Path -LiteralPath $Checked -PathType Container)) {
    throw "FAL checkpoint identity field '$Field' is not an existing directory: $Checked"
  }
  return (Resolve-Path -LiteralPath $Checked -ErrorAction Stop).Path
}

function Invoke-OCRouterFalCheckpointGitText {
  param(
    [string]$WorkingDirectory,
    [string[]]$GitArguments,
    [string]$Description
  )

  $Output = @(& git -C $WorkingDirectory @GitArguments 2>$null)
  $ExitCode = $LASTEXITCODE
  if ($ExitCode -ne 0) {
    throw "Cannot resolve FAL checkpoint Git $Description for '$WorkingDirectory' (exit $ExitCode)."
  }
  return (($Output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

function Resolve-OCRouterFalCheckpointGitCommonDir {
  param([string]$WorkingDirectory)

  $Raw = Invoke-OCRouterFalCheckpointGitText -WorkingDirectory $WorkingDirectory -GitArguments @('rev-parse', '--git-common-dir') -Description 'common directory'
  $Candidate = if ([IO.Path]::IsPathRooted($Raw)) { $Raw } else { Join-Path $WorkingDirectory $Raw }
  return (Resolve-Path -LiteralPath $Candidate -ErrorAction Stop).Path
}

function Get-OCRouterFalCheckpointIdentityHash {
  param([object]$Identity)

  if ($null -eq $Identity) { throw 'FAL checkpoint identity is missing.' }
  return Get-OCRouterStringSha256 -Text ($Identity | ConvertTo-Json -Depth 12 -Compress)
}

function New-OCRouterFalCheckpointIdentity {
  param(
    [string]$TargetProjectId,
    [string]$TargetRepoKind,
    [string]$TargetRepoRoot,
    [string]$TargetWorktree,
    [string]$TargetHead = '',
    [string]$TargetRef = '',
    [string]$TargetStatus = '',
    [string]$Wave,
    [string]$Epic,
    [string]$Stage,
    [string]$Candidate,
    [string]$AccountableLaneId,
    [string]$AccountableLaneClass,
    [string]$AccountableLaneProfile,
    [string]$LogicalSender,
    [string]$LogicalRecipient,
    [string]$SourceSession,
    [string]$ArtifactIdentity,
    [string]$ArtifactPath,
    [string]$ArtifactHash = '',
    [string]$ArtifactProducer,
    [string]$ControlRoot,
    [ValidateSet('dry_run', 'apply')]
    [string]$SyncMode = 'dry_run'
  )

  $ResolvedProjectId = Assert-OCRouterFalCheckpointScalar -Field 'TargetProjectId' -Value $TargetProjectId
  $RepoKindInput = (Assert-OCRouterFalCheckpointScalar -Field 'TargetRepoKind' -Value $TargetRepoKind).ToLowerInvariant().Replace('-', '_').Replace(' ', '_')
  $ResolvedRepoKind = switch ($RepoKindInput) {
    'git' { 'git' }
    'git_repository' { 'git' }
    'non_git' { 'non_git' }
    'non_git_project' { 'non_git' }
    'declared_equivalent' { 'declared_equivalent' }
    'equivalent' { 'declared_equivalent' }
    default { throw "Unsupported FAL checkpoint TargetRepoKind '$TargetRepoKind'." }
  }
  $ResolvedRepoRoot = Resolve-OCRouterFalCheckpointDirectory -Field 'TargetRepoRoot' -Path $TargetRepoRoot
  $ResolvedWorktree = Resolve-OCRouterFalCheckpointDirectory -Field 'TargetWorktree' -Path $TargetWorktree
  $ResolvedControlRoot = Resolve-OCRouterFalCheckpointDirectory -Field 'ControlRoot' -Path $ControlRoot

  $ResolvedHead = ([string]$TargetHead).Trim()
  $ResolvedRef = ([string]$TargetRef).Trim()
  $ResolvedStatus = ([string]$TargetStatus).Trim().ToLowerInvariant()
  if ($ResolvedRepoKind -eq 'git') {
    if ((Invoke-OCRouterFalCheckpointGitText -WorkingDirectory $ResolvedRepoRoot -GitArguments @('rev-parse', '--is-inside-work-tree') -Description 'repository kind') -cne 'true') {
      throw "FAL checkpoint TargetRepoRoot is not a Git worktree: $ResolvedRepoRoot"
    }
    if ((Invoke-OCRouterFalCheckpointGitText -WorkingDirectory $ResolvedWorktree -GitArguments @('rev-parse', '--is-inside-work-tree') -Description 'worktree kind') -cne 'true') {
      throw "FAL checkpoint TargetWorktree is not a Git worktree: $ResolvedWorktree"
    }
    $RepoCommonDir = Resolve-OCRouterFalCheckpointGitCommonDir -WorkingDirectory $ResolvedRepoRoot
    $WorktreeCommonDir = Resolve-OCRouterFalCheckpointGitCommonDir -WorkingDirectory $ResolvedWorktree
    if (-not [StringComparer]::OrdinalIgnoreCase.Equals($RepoCommonDir, $WorktreeCommonDir)) {
      throw "FAL checkpoint target root and worktree do not belong to the same Git repository."
    }

    $ActualHead = (Invoke-OCRouterFalCheckpointGitText -WorkingDirectory $ResolvedWorktree -GitArguments @('rev-parse', 'HEAD') -Description 'HEAD').ToLowerInvariant()
    $RefOutput = @(& git -C $ResolvedWorktree symbolic-ref --quiet --short HEAD 2>$null)
    $RefExit = $LASTEXITCODE
    $ActualRef = if ($RefExit -eq 0) { (($RefOutput | ForEach-Object { [string]$_ }) -join "`n").Trim() } elseif ($RefExit -eq 1) { 'DETACHED' } else { throw "Cannot resolve FAL checkpoint Git ref for '$ResolvedWorktree' (exit $RefExit)." }
    $StatusOutput = @(& git -C $ResolvedWorktree status --porcelain=v1 --untracked-files=normal 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Cannot resolve FAL checkpoint Git worktree status for '$ResolvedWorktree'." }
    $ActualStatus = if ($StatusOutput.Count -eq 0) { 'clean' } else { 'dirty' }

    if (-not [string]::IsNullOrWhiteSpace($ResolvedHead) -and $ResolvedHead.ToLowerInvariant() -cne $ActualHead) {
      throw "FAL checkpoint TargetHead drift: expected '$ResolvedHead', observed '$ActualHead'."
    }
    if (-not [string]::IsNullOrWhiteSpace($ResolvedRef) -and $ResolvedRef -cne $ActualRef) {
      throw "FAL checkpoint TargetRef drift: expected '$ResolvedRef', observed '$ActualRef'."
    }
    if (-not [string]::IsNullOrWhiteSpace($ResolvedStatus) -and $ResolvedStatus -cne $ActualStatus) {
      throw "FAL checkpoint TargetStatus drift: expected '$ResolvedStatus', observed '$ActualStatus'."
    }
    $ResolvedHead = $ActualHead
    $ResolvedRef = $ActualRef
    $ResolvedStatus = $ActualStatus
  }
  else {
    $ResolvedHead = Assert-OCRouterFalCheckpointScalar -Field 'TargetHead' -Value $ResolvedHead -AllowNotApplicable
    $ResolvedRef = Assert-OCRouterFalCheckpointScalar -Field 'TargetRef' -Value $ResolvedRef -AllowNotApplicable
    $ResolvedStatus = (Assert-OCRouterFalCheckpointScalar -Field 'TargetStatus' -Value $ResolvedStatus).ToLowerInvariant()
  }

  $ResolvedWave = Assert-OCRouterFalCheckpointScalar -Field 'Wave' -Value $Wave
  $ResolvedEpic = Assert-OCRouterFalCheckpointScalar -Field 'Epic' -Value $Epic
  $ResolvedStage = Assert-OCRouterFalCheckpointScalar -Field 'Stage' -Value $Stage
  $ResolvedCandidate = Assert-OCRouterFalCheckpointScalar -Field 'Candidate' -Value $Candidate
  $ResolvedLaneId = Assert-OCRouterFalCheckpointScalar -Field 'AccountableLaneId' -Value $AccountableLaneId
  $ResolvedLaneClass = (Assert-OCRouterFalCheckpointScalar -Field 'AccountableLaneClass' -Value $AccountableLaneClass).ToUpperInvariant()
  if ($ResolvedLaneClass -notin @('TRACK', 'SPECIALIST_DELIVERY', 'GOVERNANCE')) {
    throw "Unsupported FAL checkpoint AccountableLaneClass '$AccountableLaneClass'."
  }
  $ResolvedLaneProfile = Assert-OCRouterFalCheckpointScalar -Field 'AccountableLaneProfile' -Value $AccountableLaneProfile
  $ResolvedSender = Assert-OCRouterFalCheckpointScalar -Field 'LogicalSender' -Value $LogicalSender
  $ResolvedRecipient = Assert-OCRouterFalCheckpointScalar -Field 'LogicalRecipient' -Value $LogicalRecipient
  $ResolvedSourceSession = Assert-OCRouterFalCheckpointScalar -Field 'SourceSession' -Value $SourceSession
  $ResolvedArtifactIdentity = Assert-OCRouterFalCheckpointScalar -Field 'ArtifactIdentity' -Value $ArtifactIdentity
  $ResolvedArtifactProducer = Assert-OCRouterFalCheckpointScalar -Field 'ArtifactProducer' -Value $ArtifactProducer
  $ResolvedArtifactPath = Assert-OCRouterFalCheckpointScalar -Field 'ArtifactPath' -Value $ArtifactPath
  if (-not (Test-Path -LiteralPath $ResolvedArtifactPath -PathType Leaf)) {
    throw "FAL checkpoint pinned artifact is missing: $ResolvedArtifactPath"
  }
  $ResolvedArtifactPath = (Resolve-Path -LiteralPath $ResolvedArtifactPath -ErrorAction Stop).Path
  $ActualArtifactHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedArtifactPath).Hash.ToUpperInvariant()
  if (-not [string]::IsNullOrWhiteSpace($ArtifactHash) -and $ArtifactHash.Trim().ToUpperInvariant() -cne $ActualArtifactHash) {
    throw "FAL checkpoint ArtifactHash drift for '$ResolvedArtifactPath'."
  }

  return [pscustomobject][ordered]@{
    version = 1
    target_project_id = $ResolvedProjectId
    target_repo_kind = $ResolvedRepoKind
    target_repo_root = $ResolvedRepoRoot
    target_worktree = $ResolvedWorktree
    target_head = $ResolvedHead
    target_ref = $ResolvedRef
    target_status = $ResolvedStatus
    wave = $ResolvedWave
    epic = $ResolvedEpic
    stage = $ResolvedStage
    candidate = $ResolvedCandidate
    accountable_lane = [pscustomobject][ordered]@{
      id = $ResolvedLaneId
      class = $ResolvedLaneClass
      profile = $ResolvedLaneProfile
    }
    logical_sender = $ResolvedSender
    logical_recipient = $ResolvedRecipient
    source_session = $ResolvedSourceSession
    artifact = [pscustomobject][ordered]@{
      identity = $ResolvedArtifactIdentity
      path = $ResolvedArtifactPath
      sha256 = $ActualArtifactHash
      producer = $ResolvedArtifactProducer
    }
    control_root = $ResolvedControlRoot
    sync_mode = $SyncMode
  }
}

function Assert-OCRouterFalCheckpointIdentity {
  param([object]$Identity)

  if ($null -eq $Identity) { throw 'FAL checkpoint identity is missing.' }
  $Rebuilt = New-OCRouterFalCheckpointIdentity `
    -TargetProjectId ([string]$Identity.target_project_id) `
    -TargetRepoKind ([string]$Identity.target_repo_kind) `
    -TargetRepoRoot ([string]$Identity.target_repo_root) `
    -TargetWorktree ([string]$Identity.target_worktree) `
    -TargetHead ([string]$Identity.target_head) `
    -TargetRef ([string]$Identity.target_ref) `
    -TargetStatus ([string]$Identity.target_status) `
    -Wave ([string]$Identity.wave) `
    -Epic ([string]$Identity.epic) `
    -Stage ([string]$Identity.stage) `
    -Candidate ([string]$Identity.candidate) `
    -AccountableLaneId ([string]$Identity.accountable_lane.id) `
    -AccountableLaneClass ([string]$Identity.accountable_lane.class) `
    -AccountableLaneProfile ([string]$Identity.accountable_lane.profile) `
    -LogicalSender ([string]$Identity.logical_sender) `
    -LogicalRecipient ([string]$Identity.logical_recipient) `
    -SourceSession ([string]$Identity.source_session) `
    -ArtifactIdentity ([string]$Identity.artifact.identity) `
    -ArtifactPath ([string]$Identity.artifact.path) `
    -ArtifactHash ([string]$Identity.artifact.sha256) `
    -ArtifactProducer ([string]$Identity.artifact.producer) `
    -ControlRoot ([string]$Identity.control_root) `
    -SyncMode ([string]$Identity.sync_mode)
  $ExpectedHash = Get-OCRouterFalCheckpointIdentityHash -Identity $Rebuilt
  $ActualHash = Get-OCRouterFalCheckpointIdentityHash -Identity $Identity
  if ($ActualHash -cne $ExpectedHash) {
    throw 'FAL checkpoint identity has missing, extra, reordered, or drifted canonical fields.'
  }
  return $true
}

function ConvertTo-OCRouterFalCheckpointArguments {
  param(
    [object]$Identity,
    [string]$ProjectName,
    [string]$Target,
    [string]$ReceiptPath,
    [string]$ReceiptHash,
    [string]$DeliveryResponseClass
  )

  Assert-OCRouterFalCheckpointIdentity -Identity $Identity | Out-Null
  $ResolvedProjectName = Assert-OCRouterFalCheckpointScalar -Field 'ProjectName' -Value $ProjectName
  $ResolvedTarget = Assert-OCRouterFalCheckpointScalar -Field 'Target' -Value $Target
  $ResolvedReceipt = Assert-OCRouterFalCheckpointScalar -Field 'ReceiptPath' -Value $ReceiptPath
  $ResolvedReceiptHash = Assert-OCRouterFalCheckpointScalar -Field 'ReceiptHash' -Value $ReceiptHash
  $ResolvedDeliveryClass = Assert-OCRouterFalCheckpointScalar -Field 'DeliveryResponseClass' -Value $DeliveryResponseClass
  return @(
    "TargetProjectId: $($Identity.target_project_id)",
    "ProjectName: $ResolvedProjectName",
    "TargetRepo: $($Identity.target_repo_root)",
    "TargetRepoKind: $($Identity.target_repo_kind)",
    "TargetWorktree: $($Identity.target_worktree)",
    "TargetHead: $($Identity.target_head)",
    "TargetRef: $($Identity.target_ref)",
    "TargetStatus: $($Identity.target_status)",
    "Target: $ResolvedTarget",
    "Wave: $($Identity.wave)",
    "Epic: $($Identity.epic)",
    "Stage: $($Identity.stage)",
    "Candidate: $($Identity.candidate)",
    "AccountableLaneId: $($Identity.accountable_lane.id)",
    "AccountableLaneClass: $($Identity.accountable_lane.class)",
    "AccountableLaneProfile: $($Identity.accountable_lane.profile)",
    "LogicalSender: $($Identity.logical_sender)",
    "LogicalRecipient: $($Identity.logical_recipient)",
    "SourceSession: $($Identity.source_session)",
    "ArtifactIdentity: $($Identity.artifact.identity)",
    "Artifact: $($Identity.artifact.path)",
    "ArtifactHash: $($Identity.artifact.sha256)",
    "ArtifactProducer: $($Identity.artifact.producer)",
    "Receipt: $ResolvedReceipt",
    "ReceiptHash: $ResolvedReceiptHash",
    "DeliveryResponseClass: $ResolvedDeliveryClass",
    "ControlRoot: $($Identity.control_root)",
    "SyncMode: $($Identity.sync_mode)"
  ) -join "`n"
}

function Write-OCRouterArtifactDeliveryReceipt {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$ArtifactPath,
    [string]$ProducerSession,
    [string]$Command,
    [string]$Target,
    [string]$Recipient,
    [bool]$DeliveryProven,
    [string]$ResponseClass = "",
    [string]$ResponseArtifactPath,
    [string]$ResponseMessageId,
    [string]$DispatchIntentPath,
    [object]$FalCheckpointIdentity = $null
  )

  if (-not (Test-Path -LiteralPath $ArtifactPath -PathType Leaf)) {
    throw "Cannot create delivery receipt for missing artifact: $ArtifactPath"
  }
  if (-not (Test-Path -LiteralPath $ResponseArtifactPath -PathType Leaf)) {
    throw "Cannot create delivery receipt for missing response artifact: $ResponseArtifactPath"
  }
  if ([string]::IsNullOrWhiteSpace($ResponseMessageId)) {
    throw "Cannot create delivery receipt without the response producer message ID."
  }
  if (-not (Test-Path -LiteralPath $DispatchIntentPath -PathType Leaf)) {
    throw "Cannot create delivery receipt for missing dispatch intent: $DispatchIntentPath"
  }
  New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
  $ResolvedArtifact = (Resolve-Path -LiteralPath $ArtifactPath).Path
  $ResolvedResponseArtifact = (Resolve-Path -LiteralPath $ResponseArtifactPath).Path
  $ResolvedDispatchIntent = (Resolve-Path -LiteralPath $DispatchIntentPath).Path
  $Intent = Get-Content -LiteralPath $ResolvedDispatchIntent -Raw | ConvertFrom-Json
  if ([string]$Intent.status -cne 'dispatched') {
    throw "Delivery receipt requires a completed dispatch intent: $ResolvedDispatchIntent"
  }
  $CheckpointIdentityHash = ''
  if ($null -ne $FalCheckpointIdentity) {
    Assert-OCRouterFalCheckpointIdentity -Identity $FalCheckpointIdentity | Out-Null
    if ([string]$FalCheckpointIdentity.logical_sender -cne $ProducerSession -or
        [string]$FalCheckpointIdentity.logical_recipient -cne $Recipient -or
        [string]$FalCheckpointIdentity.source_session -cne $ProducerSession -or
        [string]$FalCheckpointIdentity.artifact.path -cne $ResolvedArtifact -or
        [string]$FalCheckpointIdentity.artifact.sha256 -cne (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedArtifact).Hash) {
      throw 'Delivery receipt FAL checkpoint identity does not match its artifact producer/sender/recipient binding.'
    }
    $CheckpointIdentityHash = Get-OCRouterFalCheckpointIdentityHash -Identity $FalCheckpointIdentity
  }
  $ReceiptPath = Join-Path $RunDir ((Get-OCRouterSafeName -Value $Name) + '-receipt.json')
  $Receipt = [ordered]@{
    version = 3
    producer_session = $ProducerSession
    command = $Command.Trim().TrimStart('/')
    target = $Target
    artifact = $ResolvedArtifact
    artifact_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedArtifact).Hash
    timestamp = (Get-Date).ToString('o')
    recipient = $Recipient
    delivery_proven = $DeliveryProven
    response_class = $ResponseClass
    response_artifact = $ResolvedResponseArtifact
    response_artifact_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedResponseArtifact).Hash
    response_message_id = $ResponseMessageId
    dispatch_intent = $ResolvedDispatchIntent
    dispatch_intent_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedDispatchIntent).Hash
    dispatch_returned_id = [string]$Intent.returned_id
    fal_checkpoint_identity = $FalCheckpointIdentity
    fal_checkpoint_identity_sha256 = $CheckpointIdentityHash
  }
  Write-OCRouterAtomicJsonFile -Path $ReceiptPath -Value $Receipt
  return $ReceiptPath
}

function Assert-OCRouterArtifactDeliveryReceipt {
  param(
    [string]$ReceiptPath,
    [string]$ArtifactPath,
    [string]$ProducerSession,
    [string]$Command,
    [string]$Target,
    [string]$Recipient,
    [string]$ResponseClass,
    [string]$ResponseArtifactPath,
    [string]$ResponseMessageId,
    [string]$DispatchIntentPath,
    [object]$FalCheckpointIdentity = $null
  )

  if (-not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
    throw "Pinned delivery receipt is missing: $ReceiptPath"
  }
  $Receipt = Get-Content -LiteralPath $ReceiptPath -Raw | ConvertFrom-Json
  $ResolvedArtifact = (Resolve-Path -LiteralPath $ArtifactPath -ErrorAction Stop).Path
  $ResolvedResponseArtifact = (Resolve-Path -LiteralPath $ResponseArtifactPath -ErrorAction Stop).Path
  $ResolvedDispatchIntent = (Resolve-Path -LiteralPath $DispatchIntentPath -ErrorAction Stop).Path
  $Intent = Get-Content -LiteralPath $ResolvedDispatchIntent -Raw | ConvertFrom-Json
  $Expected = [ordered]@{
    version = 3
    producer_session = $ProducerSession
    command = $Command.Trim().TrimStart('/')
    target = $Target
    artifact = $ResolvedArtifact
    artifact_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedArtifact).Hash
    recipient = $Recipient
    response_class = $ResponseClass
    response_artifact = $ResolvedResponseArtifact
    response_artifact_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedResponseArtifact).Hash
    response_message_id = $ResponseMessageId
    dispatch_intent = $ResolvedDispatchIntent
    dispatch_intent_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedDispatchIntent).Hash
    dispatch_returned_id = [string]$Intent.returned_id
  }
  foreach ($Entry in $Expected.GetEnumerator()) {
    if ([string]$Receipt.($Entry.Key) -cne [string]$Entry.Value) {
      throw "Delivery receipt mismatch for '$($Entry.Key)': expected '$($Entry.Value)', got '$($Receipt.($Entry.Key))'."
    }
  }
  if (-not [bool]$Receipt.delivery_proven) {
    throw "Delivery receipt does not prove delivery: $ReceiptPath"
  }
  if ([string]$Intent.status -cne 'dispatched') {
    throw "Delivery receipt dispatch intent is not completed: $ResolvedDispatchIntent"
  }
  if ($null -eq $FalCheckpointIdentity) {
    if ($null -ne $Receipt.fal_checkpoint_identity -or -not [string]::IsNullOrWhiteSpace([string]$Receipt.fal_checkpoint_identity_sha256)) {
      throw "Delivery receipt contains an unexpected FAL checkpoint identity: $ReceiptPath"
    }
  }
  else {
    Assert-OCRouterFalCheckpointIdentity -Identity $FalCheckpointIdentity | Out-Null
    Assert-OCRouterFalCheckpointIdentity -Identity $Receipt.fal_checkpoint_identity | Out-Null
    $ExpectedCheckpointHash = Get-OCRouterFalCheckpointIdentityHash -Identity $FalCheckpointIdentity
    $ReceiptCheckpointHash = Get-OCRouterFalCheckpointIdentityHash -Identity $Receipt.fal_checkpoint_identity
    if ([string]$Receipt.fal_checkpoint_identity_sha256 -cne $ExpectedCheckpointHash -or $ReceiptCheckpointHash -cne $ExpectedCheckpointHash) {
      throw "Delivery receipt FAL checkpoint identity mismatch: $ReceiptPath"
    }
  }
  return $true
}

function Write-OCRouterFalCheckpointTargetProposal {
  param(
    [string]$RunDir,
    [string]$Name,
    [string]$ProjectName,
    [string]$Target,
    [object]$CheckpointIdentity,
    [string]$ReceiptPath,
    [string]$DeliveryResponseClass = ""
  )

  Assert-OCRouterFalCheckpointIdentity -Identity $CheckpointIdentity | Out-Null
  if ([string]$CheckpointIdentity.sync_mode -cne 'dry_run') {
    throw 'A proposal-only /fal-checkpoint-target operation must use SyncMode dry_run.'
  }
  if (-not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) {
    throw "FAL checkpoint proposal requires a delivery receipt: $ReceiptPath"
  }
  $ResolvedReceipt = (Resolve-Path -LiteralPath $ReceiptPath).Path
  $Receipt = Get-Content -LiteralPath $ResolvedReceipt -Raw | ConvertFrom-Json
  Assert-OCRouterFalCheckpointIdentity -Identity $Receipt.fal_checkpoint_identity | Out-Null
  $IdentityHash = Get-OCRouterFalCheckpointIdentityHash -Identity $CheckpointIdentity
  if ([string]$Receipt.fal_checkpoint_identity_sha256 -cne $IdentityHash -or
      (Get-OCRouterFalCheckpointIdentityHash -Identity $Receipt.fal_checkpoint_identity) -cne $IdentityHash -or
      [int]$Receipt.version -ne 3 -or -not [bool]$Receipt.delivery_proven -or
      [string]$Receipt.producer_session -cne [string]$CheckpointIdentity.logical_sender -or
      [string]$Receipt.recipient -cne [string]$CheckpointIdentity.logical_recipient -or
      [string]$Receipt.artifact -cne [string]$CheckpointIdentity.artifact.path -or
      [string]$Receipt.artifact_sha256 -cne [string]$CheckpointIdentity.artifact.sha256 -or
      [string]$Receipt.response_class -cne $DeliveryResponseClass) {
    throw 'FAL checkpoint proposal requires a delivery-proven receipt bound to the exact full identity tuple.'
  }
  $ReceiptHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedReceipt).Hash
  $Arguments = ConvertTo-OCRouterFalCheckpointArguments -Identity $CheckpointIdentity -ProjectName $ProjectName -Target $Target -ReceiptPath $ResolvedReceipt -ReceiptHash $ReceiptHash -DeliveryResponseClass $DeliveryResponseClass
  $ProposalPath = Join-Path $RunDir ((Get-OCRouterSafeName -Value $Name) + '-fal-checkpoint-target-operation.json')
  $Proposal = [ordered]@{
    version = 2
    operation = 'dispatch_command'
    command = 'fal-checkpoint-target'
    arguments = $Arguments
    authority = 'proposal_only'
    apply_authorized = $false
    checkpoint_identity = $CheckpointIdentity
    checkpoint_identity_sha256 = $IdentityHash
    artifact = [string]$CheckpointIdentity.artifact.path
    artifact_sha256 = [string]$CheckpointIdentity.artifact.sha256
    artifact_identity = [string]$CheckpointIdentity.artifact.identity
    artifact_producer = [string]$CheckpointIdentity.artifact.producer
    receipt = $ResolvedReceipt
    receipt_sha256 = $ReceiptHash
    created_at = (Get-Date).ToString('o')
  }
  Write-OCRouterAtomicJsonFile -Path $ProposalPath -Value $Proposal
  return [pscustomobject]@{
    path = $ProposalPath
    command = 'fal-checkpoint-target'
    arguments = $Arguments
    apply_authorized = $false
    checkpoint_identity = $CheckpointIdentity
    checkpoint_identity_sha256 = $IdentityHash
  }
}

function Write-OCRouterAtomicTextFile {
  param(
    [string]$Path,
    [string]$Text
  )

  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'Atomic write requires a destination path.' }
  $DestinationPath = [IO.Path]::GetFullPath($Path)
  $Directory = [IO.Path]::GetDirectoryName($DestinationPath)
  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $Leaf = [IO.Path]::GetFileName($DestinationPath)
  # Keep scratch suffixes short enough for Windows PowerShell's legacy
  # MAX_PATH behavior while retaining per-write uniqueness.
  $TempPath = Join-Path $Directory ($Leaf + '.t.' + [guid]::NewGuid().ToString('N').Substring(0, 12))
  $BackupPath = Join-Path $Directory ($Leaf + '.b.' + [guid]::NewGuid().ToString('N').Substring(0, 12))
  try {
    Set-Content -LiteralPath $TempPath -Value $Text -Encoding UTF8
    if (Test-Path -LiteralPath $DestinationPath) {
      # Windows PowerShell/.NET rejects a null backup path for File.Replace on
      # some hosts. A unique same-directory backup keeps the replacement atomic.
      [IO.File]::Replace($TempPath, $DestinationPath, $BackupPath, $true)
    }
    else {
      [IO.File]::Move($TempPath, $DestinationPath)
    }
  }
  finally {
    if (Test-Path -LiteralPath $TempPath) { Remove-Item -LiteralPath $TempPath -Force }
    if (Test-Path -LiteralPath $BackupPath) { Remove-Item -LiteralPath $BackupPath -Force }
  }
}

function Get-OCRouterStringSha256 {
  param([string]$Text)

  $Sha = [Security.Cryptography.SHA256]::Create()
  try {
    $Bytes = [Text.Encoding]::UTF8.GetBytes([string]$Text)
    return ([BitConverter]::ToString($Sha.ComputeHash($Bytes)) -replace '-', '')
  }
  finally {
    $Sha.Dispose()
  }
}

function Write-OCRouterAtomicJsonFile {
  param(
    [string]$Path,
    [object]$Value,
    [int]$Depth = 16
  )

  Write-OCRouterAtomicTextFile -Path $Path -Text ($Value | ConvertTo-Json -Depth $Depth)
}

function Enter-OCRouterRunLock {
  param([string]$RunDir)

  New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
  $Path = Join-Path $RunDir '.oc-router-run.lock'
  try {
    return [IO.File]::Open($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  }
  catch {
    throw "Run directory is already locked by another transport process: $RunDir"
  }
}

function Enter-OCRouterParticipantTransportLock {
  param([string]$RunDir, [Alias('Participant')][string]$PrivateSessionId)

  if ([string]::IsNullOrWhiteSpace($PrivateSessionId) -or $PrivateSessionId -cnotmatch '^[A-Za-z0-9_-]{1,160}$') { throw 'Participant transport lock requires an exact private session identity.' }
  $ParticipantKey = (Get-OCRouterStringSha256 -Text ("fal-router-private-session-fence/v1`n" + $PrivateSessionId)).ToLowerInvariant()

  $CurrentPath = [IO.Path]::GetFullPath($RunDir)
  $RootPath = [IO.Path]::GetPathRoot($CurrentPath)
  while (-not [string]::IsNullOrWhiteSpace($CurrentPath)) {
    if (Test-Path -LiteralPath $CurrentPath) {
      $Current = Get-Item -LiteralPath $CurrentPath -Force
      if ($Current.Name -ceq '.opencode-router') {
        if ($Current -isnot [IO.DirectoryInfo] -or ($Current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          throw 'Router transport root must be an ordinary non-reparse directory.'
        }
        $LockPath = Join-Path $Current.FullName ('.participant-transport.' + $ParticipantKey + '.lock')
        try { return [IO.File]::Open($LockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
        catch { throw 'Participant transport is locked by Compact or lifecycle dispatch; do not send until it settles.' }
      }
      if ($Current -isnot [IO.DirectoryInfo] -or ($Current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Router transport root must be an ordinary non-reparse directory.'
      }
    }
    if ($CurrentPath -ceq $RootPath) { break }
    $Parent = [IO.Directory]::GetParent($CurrentPath)
    if ($null -eq $Parent) { break }
    $CurrentPath = $Parent.FullName
  }
  return $null
}

function Start-OCRouterDispatchIntentCore {
  param(
    [string]$RunDir,
    [string]$Transition,
    [string]$Recipient,
    [ValidateSet('command', 'message')]
    [string]$Kind,
    [string]$Operation,
    [string]$Payload,
    [string]$BaselineIdentity,
    [string]$CandidateIdentity,
    [string]$Stage
  )

  if ([string]::IsNullOrWhiteSpace($BaselineIdentity)) {
      throw "Dispatch '$Transition' requires an unfiltered pre-send baseline identity."
    }
    $IntentDir = Join-Path $RunDir 'dispatch-intents'
    New-Item -ItemType Directory -Force -Path $IntentDir | Out-Null
    $Path = Join-Path $IntentDir ((Get-OCRouterSafeName -Value $Transition) + '.json')
    $PayloadHash = Get-OCRouterStringSha256 -Text $Payload
    if (Test-Path -LiteralPath $Path) {
      $Existing = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    foreach ($Pair in @(
      @('recipient', $Recipient), @('kind', $Kind), @('operation', $Operation),
      @('payload_sha256', $PayloadHash), @('baseline_identity', $BaselineIdentity),
      @('candidate_identity', $CandidateIdentity), @('stage', $Stage)
    )) {
      if ([string]$Existing.($Pair[0]) -cne [string]$Pair[1]) {
        throw "Dispatch intent drift for '$Transition' field '$($Pair[0])'."
      }
    }
      if ([string]$Existing.status -eq 'pending') {
        throw "Dispatch '$Transition' has a pending pre-send intent with unknown POST outcome. Reconcile read-only or resolve explicitly; automatic resend is forbidden."
      }
      if ([string]$Existing.status -eq 'dispatched') {
        return [pscustomobject]@{ path = $Path; should_send = $false; intent = $Existing }
      }
      throw "Dispatch '$Transition' has unsupported persisted status '$($Existing.status)'."
    }

    $Intent = [ordered]@{
      version = 1
      transition = $Transition
      recipient = $Recipient
      kind = $Kind
      operation = $Operation
      payload_sha256 = $PayloadHash
      baseline_identity = $BaselineIdentity
      candidate_identity = $CandidateIdentity
      stage = $Stage
      status = 'pending'
      created_at = (Get-Date).ToString('o')
      returned_id = ''
      transport_status = ''
      completed_at = ''
    }
    Write-OCRouterAtomicJsonFile -Path $Path -Value $Intent
  return [pscustomobject]@{ path = $Path; should_send = $true; intent = [pscustomobject]$Intent }
}

function Start-OCRouterDispatchIntent {
  param(
    [string]$RunDir,
    [string]$Transition,
    [string]$Recipient,
    [ValidateSet('command', 'message')]
    [string]$Kind,
    [string]$Operation,
    [string]$Payload,
    [string]$BaselineIdentity,
    [string]$CandidateIdentity,
    [string]$Stage
  )

  $TransportLock = Enter-OCRouterParticipantTransportLock -RunDir $RunDir -Participant $Recipient
  try { return Start-OCRouterDispatchIntentCore @PSBoundParameters }
  finally { if ($null -ne $TransportLock) { $TransportLock.Dispose() } }
}

function Complete-OCRouterDispatchIntent {
  param(
    [string]$Path,
    [string]$ReturnedId,
    [string]$TransportStatus = 'accepted'
  )

  $Intent = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  if ([string]$Intent.status -cne 'pending') {
    throw "Dispatch intent can be completed only from pending state: $Path"
  }
  $Intent.status = 'dispatched'
  $Intent.returned_id = $ReturnedId
  $Intent.transport_status = $TransportStatus
  $Intent.completed_at = (Get-Date).ToString('o')
  Write-OCRouterAtomicJsonFile -Path $Path -Value $Intent
  return $Intent
}

function Set-OCRouterDispatchIntentUncertain {
  param(
    [string]$Path,
    [string]$Reason
  )

  $Intent = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  if ([string]$Intent.status -cne 'pending') {
    throw "Only a pending dispatch intent can be marked transport-uncertain: $Path"
  }
  $Intent.transport_status = 'uncertain'
  $Intent | Add-Member -NotePropertyName transport_error -NotePropertyValue $Reason -Force
  $Intent | Add-Member -NotePropertyName last_observed_at -NotePropertyValue (Get-Date).ToString('o') -Force
  Write-OCRouterAtomicJsonFile -Path $Path -Value $Intent
  return $Intent
}

function Get-OCRouterTransportResponseIdentity {
  param([object]$Response)

  if ($null -eq $Response) { return '' }
  foreach ($Name in @('id', 'messageID', 'messageId', 'sessionID', 'sessionId')) {
    if ($Response.PSObject.Properties.Name -contains $Name -and -not [string]::IsNullOrWhiteSpace([string]$Response.$Name)) {
      return [string]$Response.$Name
    }
  }
  return ''
}

function New-OCRouterArtifactPin {
  param(
    [string]$Path,
    [string]$ProducerMessageId,
    [string]$Stage,
    [string]$CandidateIdentity,
    [string]$ExpectedOutputKind = '',
    [object]$ExpectedOutputContext = $null
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Artifact pin target is missing: $Path" }
  $Text = Get-Content -LiteralPath $Path -Raw
  if (-not [string]::IsNullOrWhiteSpace($ExpectedOutputKind) -and -not (Test-OCRouterExpectedOutputKind -Text $Text -ExpectedOutputKind $ExpectedOutputKind -ExpectedOutputContext $ExpectedOutputContext)) {
    throw "Artifact '$Path' does not match pinned output kind '$ExpectedOutputKind'."
  }
  return [pscustomobject]@{
    path = (Resolve-Path -LiteralPath $Path).Path
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
    producer_message_id = $ProducerMessageId
    stage = $Stage
    candidate_identity = $CandidateIdentity
    expected_output_kind = $ExpectedOutputKind
    expected_output_context = $ExpectedOutputContext
  }
}

function Assert-OCRouterArtifactPin {
  param([object]$Pin)

  if ($null -eq $Pin -or [string]::IsNullOrWhiteSpace([string]$Pin.path)) { throw 'Artifact pin is missing.' }
  if (-not (Test-Path -LiteralPath ([string]$Pin.path) -PathType Leaf)) { throw "Pinned artifact is missing: $($Pin.path)" }
  $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath ([string]$Pin.path)).Hash
  if ($Hash -cne [string]$Pin.sha256) { throw "Pinned artifact hash drift: $($Pin.path)" }
  if ([string]::IsNullOrWhiteSpace([string]$Pin.producer_message_id) -or [string]::IsNullOrWhiteSpace([string]$Pin.stage) -or [string]::IsNullOrWhiteSpace([string]$Pin.candidate_identity)) {
    throw "Pinned artifact lacks producer/stage/candidate binding: $($Pin.path)"
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$Pin.expected_output_kind)) {
    $Text = Get-Content -LiteralPath ([string]$Pin.path) -Raw
    $ExpectedOutputContext = if ($null -ne $Pin.PSObject.Properties['expected_output_context']) { $Pin.expected_output_context } else { $null }
    if (-not (Test-OCRouterExpectedOutputKind -Text $Text -ExpectedOutputKind ([string]$Pin.expected_output_kind) -ExpectedOutputContext $ExpectedOutputContext)) {
      throw "Pinned artifact strict class no longer validates: $($Pin.path)"
    }
  }
  return $true
}

function Assert-OCRouterFalCheckpointTargetProposal {
  param(
    [string]$ProposalPath,
    [object]$CheckpointIdentity,
    [string]$ProjectName,
    [string]$Target,
    [string]$ReceiptPath,
    [string]$DeliveryResponseClass
  )

  if (-not (Test-Path -LiteralPath $ProposalPath -PathType Leaf)) {
    throw "Pinned /fal-checkpoint-target operation is missing: $ProposalPath"
  }
  Assert-OCRouterFalCheckpointIdentity -Identity $CheckpointIdentity | Out-Null
  if ([string]$CheckpointIdentity.sync_mode -cne 'dry_run') {
    throw 'A pinned proposal-only /fal-checkpoint-target operation must use SyncMode dry_run.'
  }
  $Proposal = Get-Content -LiteralPath $ProposalPath -Raw | ConvertFrom-Json
  $ExpectedReceipt = (Resolve-Path -LiteralPath $ReceiptPath -ErrorAction Stop).Path
  $ExpectedReceiptHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $ExpectedReceipt).Hash
  $ExpectedIdentityHash = Get-OCRouterFalCheckpointIdentityHash -Identity $CheckpointIdentity
  $ExpectedArguments = ConvertTo-OCRouterFalCheckpointArguments `
    -Identity $CheckpointIdentity `
    -ProjectName $ProjectName `
    -Target $Target `
    -ReceiptPath $ExpectedReceipt `
    -ReceiptHash $ExpectedReceiptHash `
    -DeliveryResponseClass $DeliveryResponseClass

  Assert-OCRouterFalCheckpointIdentity -Identity $Proposal.checkpoint_identity | Out-Null
  $ProposalIdentityHash = Get-OCRouterFalCheckpointIdentityHash -Identity $Proposal.checkpoint_identity
  $Receipt = Get-Content -LiteralPath $ExpectedReceipt -Raw | ConvertFrom-Json
  Assert-OCRouterFalCheckpointIdentity -Identity $Receipt.fal_checkpoint_identity | Out-Null
  $ReceiptIdentityHash = Get-OCRouterFalCheckpointIdentityHash -Identity $Receipt.fal_checkpoint_identity

  if ([int]$Proposal.version -ne 2 -or
      [string]$Proposal.operation -cne 'dispatch_command' -or [string]$Proposal.command -cne 'fal-checkpoint-target' -or
      [string]$Proposal.authority -cne 'proposal_only' -or [bool]$Proposal.apply_authorized -or
      [string]$Proposal.arguments -cne $ExpectedArguments -or
      [string]$Proposal.checkpoint_identity_sha256 -cne $ExpectedIdentityHash -or $ProposalIdentityHash -cne $ExpectedIdentityHash -or
      [string]$Proposal.artifact -cne [string]$CheckpointIdentity.artifact.path -or
      [string]$Proposal.artifact_sha256 -cne [string]$CheckpointIdentity.artifact.sha256 -or
      [string]$Proposal.artifact_identity -cne [string]$CheckpointIdentity.artifact.identity -or
      [string]$Proposal.artifact_producer -cne [string]$CheckpointIdentity.artifact.producer -or
      [string]$Proposal.receipt -cne $ExpectedReceipt -or [string]$Proposal.receipt_sha256 -cne $ExpectedReceiptHash -or
      [int]$Receipt.version -ne 3 -or -not [bool]$Receipt.delivery_proven -or
      [string]$Receipt.fal_checkpoint_identity_sha256 -cne $ExpectedIdentityHash -or $ReceiptIdentityHash -cne $ExpectedIdentityHash -or
      [string]$Receipt.producer_session -cne [string]$CheckpointIdentity.logical_sender -or
      [string]$Receipt.recipient -cne [string]$CheckpointIdentity.logical_recipient -or
      [string]$Receipt.artifact -cne [string]$CheckpointIdentity.artifact.path -or
      [string]$Receipt.artifact_sha256 -cne [string]$CheckpointIdentity.artifact.sha256 -or
      [string]$Receipt.response_class -cne $DeliveryResponseClass) {
    throw "Pinned /fal-checkpoint-target operation no longer matches its proposal-only full identity/artifact/receipt binding."
  }
  return $true
}
