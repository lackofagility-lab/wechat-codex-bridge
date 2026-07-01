---
name: wechat-codex-bridge
description: Install, configure, diagnose, update, or uninstall the open-source WeChat Codex Bridge on Windows. Use when a user wants to chat with local Codex through WeChat ClawBot, pair an authorized WeChat account, repair delayed or duplicate replies, inspect the Windows Scheduled Task, or manage bridge memory and security.
---

# WeChat Codex Bridge

Operate the Windows bridge that connects Tencent WeChat ClawBot directly to the local Codex app-server.

## Install

1. Require Windows 10/11, Node.js 22+, Git, and a working `codex` login.
2. Clone the project repository into a user-selected folder.
3. Run `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1` from the repository.
4. Let Tencent's official installer display the QR code when credentials are absent.
5. Tell the user to send the printed `/pair NNNNNN` command to the bot.
6. Run the bundled `scripts/diagnose.ps1 -ProjectRoot <repo>` and verify exactly one bridge process.

Do not request, print, or copy the WeChat bearer token. It belongs only in `%APPDATA%\wechat-codex-bridge\credentials.json`.

## Diagnose

Run `scripts/diagnose.ps1 -ProjectRoot <repo>`. Then inspect only the relevant tail of `%APPDATA%\wechat-codex-bridge\bridge.log`.

- No process: reinstall the Scheduled Task with the repository's `scripts/install-service.ps1`.
- Multiple processes: stop the task, terminate only Node process trees whose command line ends in `src\service.js`, then start the task once.
- `errcode=-14`: rerun setup to refresh the WeChat QR login.
- Repeated Codex timeout: verify `codex login status`, network access, and app-server startup.
- Unknown user ignored: pair with the current code or add the intended ID to `allowedUserIds`; never disable authorization globally.
- Duplicate reply: verify stable client IDs and exactly one service process.

## Security

- Keep `sandbox` at `workspace-write` unless the user explicitly chooses a stricter mode.
- Never expose credentials, context tokens, memory, or personal workspace files.
- Keep unknown users and group participants denied by default.
- Explain that an authorized WeChat user can direct Codex to modify files inside the configured workspace.
- Preserve existing config and state during upgrades.

## Update and uninstall

For updates, stop the task, pull the repository, run `npm install` and tests, then restart it. Preserve `%APPDATA%\wechat-codex-bridge` and `config.json`.

For removal, run the repository's `scripts/uninstall-service.ps1`. Delete credentials or memory only when the user explicitly asks.

Read `references/architecture.md` only when changing protocol, persistence, or process-management code.
