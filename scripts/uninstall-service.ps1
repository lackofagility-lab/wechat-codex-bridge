$ErrorActionPreference = 'Stop'
$taskName = 'WeChat Codex Bridge'
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
$services = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -match '[\\/]src[\\/]service\.js'
}
foreach ($service in $services) { & taskkill.exe /PID $service.ProcessId /T /F | Out-Null }
Write-Host 'WeChat Codex Bridge service removed. Credentials and memory were kept in AppData.'
