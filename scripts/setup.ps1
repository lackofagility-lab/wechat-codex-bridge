param([string]$Workspace = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22+ is required: https://nodejs.org/' }
if ([int](node -p "process.versions.node.split('.')[0]") -lt 22) { throw 'Node.js 22 or newer is required.' }
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { throw 'Install Codex first: npm install -g @openai/codex' }

npm install

$configPath = Join-Path $projectRoot 'config.json'
if (-not (Test-Path -LiteralPath $configPath)) {
  $config = Get-Content (Join-Path $projectRoot 'config.example.json') -Raw | ConvertFrom-Json
  $config.workspace = (Resolve-Path -LiteralPath $Workspace).Path
  $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8
}

$accounts = Join-Path $HOME '.openclaw\openclaw-weixin\accounts.json'
if (-not (Test-Path -LiteralPath $accounts)) {
  Write-Host 'Opening the official Tencent WeChat ClawBot installer. Scan its QR code in WeChat.'
  npx -y '@tencent-weixin/openclaw-weixin-cli@latest' install
}
if (-not (Test-Path -LiteralPath $accounts)) { throw 'WeChat login was not completed. Run setup.ps1 again after scanning the QR code.' }

node (Join-Path $projectRoot 'scripts\import-openclaw-credentials.js')
& (Join-Path $projectRoot 'scripts\install-service.ps1')
Write-Host 'Setup complete. Send the /pair code printed above to the WeChat bot.'
