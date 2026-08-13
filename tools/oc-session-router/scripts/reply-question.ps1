param(
  [Parameter(Mandatory=$true)]
  [string]$RequestId,

  [string[]]$Answer = @(),
  [string]$AnswersJson = "",

  [string]$RouterDir = ".opencode-router",

  [string]$Username = $(if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME } else { "opencode" }),
  [string]$Password = $env:OPENCODE_SERVER_PASSWORD
)

$ErrorActionPreference = "Stop"
$FAL_EXPLICIT_STAGE_ROUTER_RETIRED = $true
throw 'FAL_EXPLICIT_STAGE_ROUTER_RETIRED: question replies require a separately reviewed explicit action API.'
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Read-Host "OpenCode server password"
}

if ([string]::IsNullOrWhiteSpace($AnswersJson) -and $Answer.Count -eq 0) {
  throw "Provide -Answer for a single question or -AnswersJson for multiple questions."
}

if (-not [string]::IsNullOrWhiteSpace($AnswersJson) -and $Answer.Count -gt 0) {
  throw "Use either -Answer or -AnswersJson, not both."
}

$Config = Get-OCRouterConfig -RouterDir $RouterDir
$Server = Resolve-OCRouterLiteralLoopbackServer ([string]$Config.server)
$Headers = New-OCRouterBasicAuthHeader -Username $Username -Password $Password
if ($RequestId -cnotmatch '^[A-Za-z0-9_-]{1,160}$') { throw 'Question request identity has an unsafe shape.' }

$Body = ""
if (-not [string]::IsNullOrWhiteSpace($AnswersJson)) {
  $Body = "{`"answers`":$AnswersJson}"
}
else {
  $EscapedLabels = @($Answer | ForEach-Object { [string]$_ | ConvertTo-Json -Compress }) -join ","
  $Body = "{`"answers`": [[$EscapedLabels]]}"
}

function Get-ExactQuestionRequest {
  $Response = Invoke-RestMethod -Method Get -Uri "$Server/question" -Headers $Headers -ContentType 'application/json' -MaximumRedirection 0
  $Rows = if ($Response -is [array]) { @($Response) } elseif ($null -ne $Response -and $Response.PSObject.Properties.Name -contains 'id') { @($Response) } else { @() }
  $Matches = @($Rows | Where-Object { [string]$_.id -ceq $RequestId })
  if ($Matches.Count -ne 1) { throw 'Question request is missing or ambiguous.' }
  return $Matches[0]
}
$Request = Get-ExactQuestionRequest
$SessionMatches = @($Config.sessions.PSObject.Properties | Where-Object { [string]$_.Value.sessionId -ceq [string]$Request.sessionID })
if ($SessionMatches.Count -ne 1) { throw 'Question request does not map to exactly one logical participant.' }
$Participant = [string]$SessionMatches[0].Name
$TransportLock = Enter-OCRouterParticipantTransportLock -RunDir $RouterDir -Participant $Participant
try {
  $LockedRequest = Get-ExactQuestionRequest
  if ([string]$LockedRequest.sessionID -cne [string]$Request.sessionID) { throw 'Question request session drifted before reply.' }
  $ReplyRunDir = Join-Path (Join-Path $RouterDir 'packet-runs') ('question-reply-' + [guid]::NewGuid().ToString('N'))
  $Intent = Start-OCRouterDispatchIntentCore -RunDir $ReplyRunDir -Transition 'reply-question' -Recipient $Participant -Kind message -Operation 'reply-question' -Payload $Body -BaselineIdentity ('request:'+$RequestId) -CandidateIdentity ('sha256:'+(Get-OCRouterStringSha256 -Text $Body).ToLowerInvariant()) -Stage 'question_reply'
  $Result = Invoke-RestMethod -Method Post -Uri "$Server/question/$([Uri]::EscapeDataString($RequestId))/reply" -Headers $Headers -ContentType 'application/json' -Body $Body -MaximumRedirection 0
  Complete-OCRouterDispatchIntent -Path $Intent.path -ReturnedId 'response-not-retained' | Out-Null
}
finally { if ($null -ne $TransportLock) { $TransportLock.Dispose() } }

Write-Host "Question reply result: $Result" -ForegroundColor Green
