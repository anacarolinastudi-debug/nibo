param(
  [ValidateSet('Run', 'Verify', 'Extract')][string]$Action = 'Run',
  [string]$BackupFile,
  [string]$Destination,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$root = Join-Path $env:LOCALAPPDATA 'YoungContabil\Backup'
$mutex = $null
$ownsMutex = $false
try {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [Threading.Mutex]::new($false, ('Global\YoungContabilBackup-' + $sid))
  try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
  if (!$ownsMutex) { Write-Output 'Another backup operation is already running.'; exit 0 }
  $bytes = [IO.File]::ReadAllBytes((Join-Path $root 'config.dpapi'))
  $json = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $config = [Text.Encoding]::UTF8.GetString($json) | ConvertFrom-Json
  if ($Action -eq 'Run') {
    $lockFile = Join-Path $config.outputDir '.running'
    if (Test-Path -LiteralPath $lockFile) {
      $item = Get-Item -LiteralPath $lockFile -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Invalid backup lock.' }
      $owner = $null
      try { $owner = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json } catch {}
      $ownerPid = if ($owner -is [int]) { $owner } else { $owner.pid }
      if ($ownerPid -and (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) { throw 'A previous backup process is still running.' }
      if (!$ownerPid -and $item.LastWriteTime -gt [datetime]::Now.AddMinutes(-5)) { throw 'A backup is still initializing.' }
      Remove-Item -LiteralPath $lockFile -Force
    }
  }
  if ($Action -eq 'Run' -and !$Force) {
    $statusFile = Join-Path $config.outputDir 'status.json'
    if (Test-Path -LiteralPath $statusFile) {
      $status = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
      if ($status.status -eq 'complete' -and ([datetime]$status.lastRun).ToLocalTime().Date -eq [datetime]::Today) { Write-Output 'A complete backup already exists for today.'; exit 0 }
    }
  }
  if ($Action -ne 'Run') {
    if (!$BackupFile) { throw 'Select a backup file.' }
    $config | Add-Member -NotePropertyName file -NotePropertyValue ([IO.Path]::GetFullPath($BackupFile)) -Force
    if ($Action -eq 'Extract') {
      if (!$Destination) { throw 'Select a new extraction directory.' }
      $config | Add-Member -NotePropertyName destination -NotePropertyValue ([IO.Path]::GetFullPath($Destination)) -Force
    }
  }
  $result = ($config | ConvertTo-Json -Depth 20 -Compress) | & $config.nodePath --use-system-ca (Join-Path $root 'backup.cjs') $Action.ToLowerInvariant()
  $code = $LASTEXITCODE
  if ($Action -eq 'Run') {
    $log = '{0:u} Exit={1} {2}' -f [datetime]::Now, $code, ($result -join ' ')
    Add-Content -LiteralPath (Join-Path $config.outputDir 'backup.log') -Value $log -Encoding UTF8
  }
  Write-Output $result
  exit $code
} catch {
  Write-Error 'Backup could not finish. Existing copies were preserved. Check configuration, internet and PostgreSQL tools.'
  exit 1
} finally {
  if ($ownsMutex -and $mutex) { $mutex.ReleaseMutex() }
  if ($mutex) { $mutex.Dispose() }
}
