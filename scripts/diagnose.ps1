param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

$task = Get-ScheduledTask -TaskName 'WeChat Codex Bridge' -ErrorAction SilentlyContinue
$processes = @(Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -match '[\\/]src[\\/]service\.js'
})
$state = Join-Path $env:APPDATA 'wechat-codex-bridge'

[pscustomobject]@{
  ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
  TaskState = if ($task) { $task.State } else { 'NotInstalled' }
  BridgeProcesses = $processes.Count
  CredentialsPresent = Test-Path -LiteralPath (Join-Path $state 'credentials.json')
  ConfigPresent = Test-Path -LiteralPath (Join-Path $ProjectRoot 'config.json')
}

$log = Join-Path $state 'bridge.log'
if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 20 }
