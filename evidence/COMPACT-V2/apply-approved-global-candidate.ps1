param(
  [Parameter(Mandatory=$true)][string]$ApprovedCandidateManifest,
  [Parameter(Mandatory=$true)][string]$ApprovedTransactionManifest
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest

function Get-Hash([string]$Path){
  (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Replace-Atomic([string]$Source,[string]$Target){
  $backup=Join-Path ([IO.Path]::GetDirectoryName($Target)) ('.compact-v2-replace-backup-'+[Guid]::NewGuid().ToString('N')+'.tmp')
  [IO.File]::Replace($Source,$Target,$backup,$true)
  [IO.File]::Delete($backup)
}
function Write-Journal([object]$Value,[string]$Path){
  $temp="$Path.tmp.$([Guid]::NewGuid().ToString('N'))"
  [IO.File]::WriteAllText($temp,($Value|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
  if([IO.File]::Exists($Path)){Replace-Atomic $temp $Path}else{[IO.File]::Move($temp,$Path)}
}

$FalRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$TransactionPath=Join-Path $PSScriptRoot 'global-transaction-manifest.json'
if((Get-Hash $TransactionPath)-cne $ApprovedTransactionManifest){throw 'Approved transaction manifest drifted.'}
$Transaction=Get-Content -LiteralPath $TransactionPath -Raw|ConvertFrom-Json
if([string]$Transaction.candidate_manifest_sha256-cne$ApprovedCandidateManifest){throw 'Approved candidate binding differs from transaction manifest.'}
$LiveRoot=(Resolve-Path (Join-Path $HOME '.config\opencode')).Path
$CandidateRoot=(Resolve-Path (Join-Path $FalRoot ([string]$Transaction.candidate_root))).Path
$Stamp=(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$RecoveryParent=Join-Path $HOME '.config\opencode-recovery'
$RecoveryRoot=Join-Path $RecoveryParent "compact-v2-global-$Stamp"
[IO.Directory]::CreateDirectory($RecoveryRoot)|Out-Null

$journal=[ordered]@{
  schema_version='compact-v2-global-apply-journal/v1'
  candidate_id=[string]$Transaction.candidate_id
  candidate_manifest_sha256=$ApprovedCandidateManifest
  transaction_manifest_sha256=$ApprovedTransactionManifest
  live_root=$LiveRoot
  recovery_root=$RecoveryRoot
  state='PREPARED'
  created_utc=(Get-Date).ToUniversalTime().ToString('o')
  operations=@()
}
$JournalPath=Join-Path $RecoveryRoot 'transaction-journal.json'

foreach($Operation in @($Transaction.operations)){
  $relative=[string]$Operation.path
  if([IO.Path]::IsPathRooted($relative) -or $relative.Contains('..')){throw "Unsafe transaction path: $relative"}
  $target=[IO.Path]::GetFullPath((Join-Path $LiveRoot $relative))
  $source=[IO.Path]::GetFullPath((Join-Path $CandidateRoot $relative))
  if(-not $target.StartsWith($LiveRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Target escaped live root: $relative"}
  if(-not $source.StartsWith($CandidateRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw "Source escaped candidate root: $relative"}
  if(-not [IO.File]::Exists($source)){throw "Candidate source missing: $relative"}
  if((Get-Hash $source)-cne[string]$Operation.after_sha256){throw "Candidate source hash drifted: $relative"}
  if([string]$Operation.operation-ceq'REPLACE'){
    if(-not [IO.File]::Exists($target)){throw "Live baseline missing: $relative"}
    if((Get-Hash $target)-cne[string]$Operation.before_sha256){throw "Live baseline drifted: $relative"}
    $archive=Join-Path $RecoveryRoot $relative
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($archive))|Out-Null
    [IO.File]::Copy($target,$archive,$false)
    if((Get-Hash $archive)-cne[string]$Operation.before_sha256){throw "Recovery archive verification failed: $relative"}
  }elseif([string]$Operation.operation-ceq'CREATE'){
    if([IO.File]::Exists($target)){throw "Create target already exists: $relative"}
  }else{throw "Unsupported operation: $($Operation.operation)"}
  $journal.operations+=,[ordered]@{operation=[string]$Operation.operation;path=$relative;before_sha256=[string]$Operation.before_sha256;after_sha256=[string]$Operation.after_sha256;state='PENDING'}
}
Write-Journal $journal $JournalPath

try{
  for($index=0;$index-lt$journal.operations.Count;$index++){
    $entry=$journal.operations[$index]
    $source=Join-Path $CandidateRoot $entry.path
    $target=Join-Path $LiveRoot $entry.path
    $parent=[IO.Path]::GetDirectoryName($target)
    if(-not [IO.Directory]::Exists($parent)){throw "Target parent missing: $($entry.path)"}
    $temp=Join-Path $parent ('.compact-v2-'+[Guid]::NewGuid().ToString('N')+'.tmp')
    [IO.File]::Copy($source,$temp,$false)
    if((Get-Hash $temp)-cne$entry.after_sha256){throw "Staged hash mismatch: $($entry.path)"}
    if($entry.operation-ceq'REPLACE'){Replace-Atomic $temp $target}else{[IO.File]::Move($temp,$target)}
    if((Get-Hash $target)-cne$entry.after_sha256){throw "Applied hash mismatch: $($entry.path)"}
    $entry.state='APPLIED'
    Write-Journal $journal $JournalPath
  }
  $journal.state='APPLIED_AWAITING_RESTART'
  $journal.applied_utc=(Get-Date).ToUniversalTime().ToString('o')
  Write-Journal $journal $JournalPath
}catch{
  $journal.state='APPLY_FAILED_ROLLBACK_REQUIRED'
  $journal.failure_class='TRANSACTION_EXCEPTION'
  Write-Journal $journal $JournalPath
  for($index=$journal.operations.Count-1;$index-ge0;$index--){
    $entry=$journal.operations[$index]
    if($entry.state-cne'APPLIED'){continue}
    $target=Join-Path $LiveRoot $entry.path
    if(-not [IO.File]::Exists($target) -or (Get-Hash $target)-cne$entry.after_sha256){throw "Rollback blocked by target drift: $($entry.path)"}
    if($entry.operation-ceq'CREATE'){
      [IO.File]::Delete($target)
    }else{
      $archive=Join-Path $RecoveryRoot $entry.path
      $parent=[IO.Path]::GetDirectoryName($target)
      $temp=Join-Path $parent ('.compact-v2-rollback-'+[Guid]::NewGuid().ToString('N')+'.tmp')
      [IO.File]::Copy($archive,$temp,$false)
      Replace-Atomic $temp $target
      if((Get-Hash $target)-cne$entry.before_sha256){throw "Rollback verification failed: $($entry.path)"}
    }
    $entry.state='ROLLED_BACK'
    Write-Journal $journal $JournalPath
  }
  $journal.state='ROLLED_BACK'
  Write-Journal $journal $JournalPath
  throw
}

[ordered]@{state=$journal.state;candidate_id=$journal.candidate_id;candidate_manifest_sha256=$ApprovedCandidateManifest;transaction_manifest_sha256=$ApprovedTransactionManifest;recovery_root=$RecoveryRoot;journal_path=$JournalPath}|ConvertTo-Json -Compress
