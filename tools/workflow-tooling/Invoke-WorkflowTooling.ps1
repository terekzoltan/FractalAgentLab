[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Plan','Apply','Status','Resume','Restore')][string]$Action,
    [object[]]$Mapping = @(),
    [string]$StateRoot = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'FractalAgentLab/workflow-tooling'),
    [string]$PlanId,
    [string]$TransactionId,
    [switch]$AdoptExisting,
    [ValidateSet('Unknown','Absent','Running')][string]$ServerState = 'Unknown',
    [string]$LoadedEvidencePath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'WorkflowTooling.psm1') -Force -DisableNameChecking
Invoke-WorkflowTooling @PSBoundParameters
