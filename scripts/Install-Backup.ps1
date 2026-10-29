param([string]$OutputDirectory = (Join-Path $env:USERPROFILE 'Documents\Backups Young Contabil'))
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$repo = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $env:LOCALAPPDATA 'YoungContabil\Backup'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
function Protect-Directory([string]$directory) {
  [IO.Directory]::CreateDirectory($directory) | Out-Null
  $item = Get-Item -LiteralPath $directory -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Backup directory cannot be a link.' }
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  $propagation = [Security.AccessControl.PropagationFlags]::None
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', $inheritance, $propagation, 'Allow'))
  $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($system, 'FullControl', $inheritance, $propagation, 'Allow'))
  Set-Acl -LiteralPath $directory -AclObject $acl
}
Protect-Directory $runtime
Protect-Directory $OutputDirectory
$inputJson = [Console]::In.ReadToEnd()
if (!$inputJson) { throw 'Provide configuration through standard input; do not put secrets in arguments.' }
$config = $inputJson | ConvertFrom-Json
if (!$config.databaseUrl -or !$config.pgDumpPath -or !$config.apiOrigin) { throw 'Missing backup configuration.' }
$key = New-Object byte[] 32
$oldPath = Join-Path $runtime 'config.dpapi'
if (Test-Path -LiteralPath $oldPath) {
  $old = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($oldPath), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $key = [Convert]::FromBase64String(([Text.Encoding]::UTF8.GetString($old) | ConvertFrom-Json).backupKey)
} else { $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($key) } finally { $rng.Dispose() } }
$config | Add-Member -NotePropertyName backupKey -NotePropertyValue ([Convert]::ToBase64String($key)) -Force
$config | Add-Member -NotePropertyName outputDir -NotePropertyValue ([IO.Path]::GetFullPath($OutputDirectory)) -Force
$config | Add-Member -NotePropertyName retentionDays -NotePropertyValue 30 -Force
$config | Add-Member -NotePropertyName nodePath -NotePropertyValue (Get-Command node.exe).Source -Force
$dependencies = Join-Path $runtime 'node_modules'
[IO.Directory]::CreateDirectory((Join-Path $dependencies '@prisma')) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $dependencies '.prisma')) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $dependencies '@prisma\client')) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $dependencies '.prisma\client')) | Out-Null
Copy-Item -Path (Join-Path $repo 'backend\node_modules\@prisma\client\*') -Destination (Join-Path $dependencies '@prisma\client') -Recurse -Force
Copy-Item -Path (Join-Path $repo 'backend\node_modules\.prisma\client\*') -Destination (Join-Path $dependencies '.prisma\client') -Recurse -Force
$config | Add-Member -NotePropertyName prismaClientPath -NotePropertyValue (Join-Path $dependencies '@prisma\client') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'backup.cjs') -Destination (Join-Path $runtime 'backup.cjs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Backup.ps1') -Destination (Join-Path $runtime 'Backup.ps1') -Force
$encoded = [Text.Encoding]::UTF8.GetBytes(($config | ConvertTo-Json -Depth 20 -Compress))
$protected = [Security.Cryptography.ProtectedData]::Protect($encoded, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.File]::WriteAllBytes($oldPath, $protected)
$action = New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $runtime 'Backup.ps1') + '"')
$daily = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours(18))
$logon = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $sid.Value -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Young Contabil - Backup diario' -Action $action -Trigger @($daily, $logon) -Settings $settings -Principal $principal -Description 'Encrypted daily database and uploaded files backup; 30-day retention; run missed backups at logon.' -Force | Out-Null
Write-Output 'Encrypted local configuration installed. Daily backup scheduled at 18:00 with logon catch-up.'
Write-Output ('Backup folder: ' + $OutputDirectory)
