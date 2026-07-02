# WeChat Codex Bridge

Run Codex from WeChat on a Windows PC without routing conversations through an OpenClaw agent.

在 Windows 电脑上通过微信直接使用本机 Codex。OpenClaw/Tencent 插件只用于首次微信扫码授权，不参与后续 Agent、模型或会话处理。

## Features

- Direct WeChat ClawBot ↔ local Codex app-server connection
- One-time pairing code and persistent user allowlist
- Durable recent memory and daily conversation notes
- Optional Windows Computer Use for controlling desktop applications from WeChat
- Exactly-once message IDs to prevent duplicate acknowledgements and replies
- Auto-start, crash recovery, long-poll reconnect, and single-instance lock
- Screen lock and display-off supported; Windows sleep/hibernate still pauses replies

## Requirements

- Windows 10 or 11
- Node.js 22 or newer
- Codex CLI, signed in with ChatGPT or an API key
- Codex desktop app with the Computer Use plugin for desktop control
- WeChat with ClawBot access

## Install

Open PowerShell:

```powershell
git clone https://github.com/YOUR_GITHUB_USERNAME/wechat-codex-bridge.git
cd wechat-codex-bridge
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

The setup script uses Tencent's official `@tencent-weixin/openclaw-weixin-cli` for the QR-code login, imports the credential into `%APPDATA%\wechat-codex-bridge`, and installs the bridge as a per-user Scheduled Task. Send the printed `/pair 123456` message to the bot once.

## Commands

- `/new` or `/reset` — start a fresh Codex thread
- `/status` — show connection status
- `/progress on` or `/progress off` — toggle the single processing acknowledgement
- `/help` — list commands

## Configuration

Copy `config.example.json` to `config.json`. The setup script does this automatically and resolves `workspace` to an absolute path.

Security defaults:

- Unknown WeChat users are ignored.
- Codex is restricted to `workspace-write`.
- Read-only desktop inspection may run immediately; actions with external side effects require confirmation in WeChat.
- Low-risk Computer Use app access is approved by the bridge for the active paired-user turn; high-risk MCP approvals are declined until explicitly confirmed.
- Credentials, local config, personal memory, and logs are excluded from Git.

## Maintenance

```powershell
npm test
npm run check
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-service.ps1
```

## Codex Skill

The reusable skill lives in `skills/wechat-codex-bridge`. Copy it to `%USERPROFILE%\.codex\skills\wechat-codex-bridge`, then ask Codex:

> Use `$wechat-codex-bridge` to install or diagnose my bridge.

## Architecture and attribution

The runtime talks to Tencent's documented iLink bot endpoints and OpenAI's Codex app-server JSON-RPC interface. WeChat login bootstrap is provided by Tencent's MIT-licensed [openclaw-weixin](https://github.com/Tencent/openclaw-weixin). Codex is provided by OpenAI's [Codex](https://github.com/openai/codex).

This community project is not affiliated with or endorsed by Tencent or OpenAI. WeChat, ClawBot, OpenAI, and Codex are trademarks of their respective owners.

## License

MIT
