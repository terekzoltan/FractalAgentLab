# Internal writer. Data crosses stdin, never an interpolated shell command.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$mutex = $null; $held = $false; $temporary = $null; $backup = $null
function Hash-Bytes([byte[]]$Bytes) {
  $hash = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hash.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() } finally { $hash.Dispose() }
}
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $root = [IO.Path]::GetFullPath([string]$request.root).TrimEnd([char[]]@('\','/'))
  $file = [IO.Path]::GetFullPath((Join-Path $root ([string]$request.relativePath)))
  if (-not $file.StartsWith($root + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($file) -cne 'PROJECT_STATE.md') { throw 'PATH_UNSAFE' }
  for($current=$file; $current; $current=[IO.Path]::GetDirectoryName($current)) {
    if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'PATH_UNSAFE' }
  }
  $name = 'Local\FAL.ObservedProgress.' + (Hash-Bytes $utf8.GetBytes($file.ToLowerInvariant()))
  $mutex = New-Object Threading.Mutex($false,$name)
  try { $held=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held=$true }
  if(-not $held){ @{status='DEFERRED';reason='STATE_WRITER_BUSY'}|ConvertTo-Json -Compress; exit 0 }
  $before=[IO.File]::ReadAllBytes($file)
  if((Hash-Bytes $before) -cne $request.expectedSha256){ @{status='DEFERRED';reason='STATE_CHANGED'}|ConvertTo-Json -Compress; exit 0 }
  $text=$utf8.GetString($before); $startMarker='<!-- FAL-OBSERVED-PROGRESS:BEGIN -->'; $endMarker='<!-- FAL-OBSERVED-PROGRESS:END -->'
  $start=$text.IndexOf($startMarker,[StringComparison]::Ordinal); $end=$text.IndexOf($endMarker,[StringComparison]::Ordinal)
  if($start -lt 0 -or $end -lt $start -or $text.IndexOf($startMarker,$start+1,[StringComparison]::Ordinal) -ge 0 -or $text.IndexOf($endMarker,$end+1,[StringComparison]::Ordinal) -ge 0 -or $request.body.Contains($startMarker) -or $request.body.Contains($endMarker)){throw 'MARKERS_INVALID'}
  $next=$text.Substring(0,$start+$startMarker.Length)+"`n"+$request.body.Trim()+"`n"+$text.Substring($end)
  $suffix=[Guid]::NewGuid().ToString('N'); $temporary=$file+'.'+$suffix+'.tmp'; $backup=$file+'.'+$suffix+'.replaced'
  [IO.File]::WriteAllBytes($temporary,$utf8.GetBytes($next))
  if((Hash-Bytes ([IO.File]::ReadAllBytes($file))) -cne $request.expectedSha256){ @{status='DEFERRED';reason='STATE_CHANGED'}|ConvertTo-Json -Compress; exit 0 }
  [IO.File]::Replace($temporary,$file,$backup); $temporary=$null
  # Keep the actually displaced version if an uncoordinated editor raced Replace.
  if((Hash-Bytes ([IO.File]::ReadAllBytes($backup))) -cne $request.expectedSha256){ @{status='DRIFT_RECOVERABLE';reason='DISPLACED_STATE_CHANGED';recoveryFile=[IO.Path]::GetFileName($backup)}|ConvertTo-Json -Compress; $backup=$null; exit 0 }
  if((Hash-Bytes ([IO.File]::ReadAllBytes($file))) -cne (Hash-Bytes $utf8.GetBytes($next))){ @{status='DEFERRED';reason='POST_WRITE_STATE_CHANGED';recoveryFile=[IO.Path]::GetFileName($backup)}|ConvertTo-Json -Compress; $backup=$null; exit 0 }
  [IO.File]::Delete($backup); $backup=$null
  @{status='UPDATED'}|ConvertTo-Json -Compress
} catch { @{status='DEFERRED';reason='STATE_WRITE_FAILED';recoveryFile=if($backup){[IO.Path]::GetFileName($backup)}else{$null}}|ConvertTo-Json -Compress }
finally { if($temporary -and [IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)}; if($held){$mutex.ReleaseMutex()}; if($mutex){$mutex.Dispose()} }
