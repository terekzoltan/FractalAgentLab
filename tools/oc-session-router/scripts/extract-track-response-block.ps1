param(
  [Parameter(Mandatory=$true)]
  [string]$Track,

  [string]$TextPath = "",
  [string]$Text = "",
  [string]$Target = "",
  [string]$Command = "",
  [string]$OutputPath = "",
  [switch]$List
)

$ErrorActionPreference = "Stop"
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  throw 'FAL_EXPLICIT_STAGE_ROUTER_BLOCKED_WRITE: legacy extraction cannot write artifacts.'
}
. (Join-Path $PSScriptRoot "oc-router-common.ps1")

if (-not $List -and [string]::IsNullOrWhiteSpace($TextPath) -and [string]::IsNullOrWhiteSpace($Text)) {
  throw "Provide either -TextPath or -Text."
}

$SourceText = $Text
if (-not [string]::IsNullOrWhiteSpace($TextPath)) {
  if (-not (Test-Path $TextPath)) {
    throw "TextPath does not exist: $TextPath"
  }
  $SourceText = Get-Content $TextPath -Raw
}

if ($List) {
  $Blocks = @(Get-OCRouterTrackResponseBlocks -Text $SourceText)
  if ($Blocks.Count -eq 0) {
    throw "No TRACK RESPONSE blocks found."
  }

  $Blocks | Select-Object track, target, command
  exit 0
}

$Block = Get-OCRouterTrackResponseBlock -Text $SourceText -Track $Track -ExpectedTarget $Target -ExpectedCommand $Command
$Body = [string]$Block.body

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
  $Parent = Split-Path $OutputPath -Parent
  if (-not [string]::IsNullOrWhiteSpace($Parent)) {
    New-Item -ItemType Directory -Force $Parent | Out-Null
  }
  Set-Content -Path $OutputPath -Value $Body -Encoding UTF8
  Write-Host "Saved TRACK RESPONSE block to: $OutputPath" -ForegroundColor Green
}
else {
  Write-Output $Body
}
