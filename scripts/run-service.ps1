$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

# v1.1+ starts the bridge directly with Node from the per-user startup entry.
# Keep this legacy task harmless on upgraded installations that cannot remove it
# without elevation.
if ((Test-Path (Join-Path $projectRoot '.node-service-enabled')) -or
    (Test-Path (Join-Path $projectRoot '.legacy-task-disabled'))) { exit 0 }

$node = (Get-Command node).Source
$service = Join-Path $projectRoot 'src\service.js'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BridgePower {
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern uint SetThreadExecutionState(uint esFlags);
}
'@

# Keep Windows running while allowing the display to turn off and the session to lock.
$ES_CONTINUOUS = [uint32]::Parse('80000000', [System.Globalization.NumberStyles]::HexNumber)
$ES_SYSTEM_REQUIRED = [uint32]1
[void][BridgePower]::SetThreadExecutionState([uint32]($ES_CONTINUOUS + $ES_SYSTEM_REQUIRED))

try {
  while ($true) {
    & $node $service
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 5
  }
} finally {
  [void][BridgePower]::SetThreadExecutionState($ES_CONTINUOUS)
}
