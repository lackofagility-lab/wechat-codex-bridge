---
name: wechat-codex-bridge
description: Install, configure, diagnose, update, or uninstall the open-source WeChat Codex Bridge on Windows. Use when a user wants to chat with local Codex through WeChat ClawBot, pair an authorized WeChat account, enable scoped Computer Use desktop control, repair delayed or duplicate replies, inspect the Windows Scheduled Task, or manage bridge memory and security.
---

# WeChat Codex Bridge

Operate the Windows bridge that connects Tencent WeChat ClawBot directly to the local Codex app-server.

When desktop control is enabled, route Windows UI requests through the installed `computer-use` skill. Preserve its confirmation policy; never replace it with ad-hoc SendKeys or shell-based UI automation.

## Install

1. Require Windows 10/11, Node.js 22+, Git, and a working `codex` login.
   Require the Codex desktop app and installed Computer Use plugin only when desktop control is requested.
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
- `sandboxCwd must use the file URI scheme`: require `@openai/codex` 0.142.5 or newer, restart the bridge, and start a new phone thread.
- `Computer Use was not approved to use <App>`: add an exact alias-to-app-id entry under `computerUseAppAliases`; restart the bridge. Never patch the installed Computer Use plugin or replace its helper.
- A remembered old tool error: reset the phone thread while preserving `memory.json`; new desktop requests must retry the live tool once.

## Security

- Keep `sandbox` at `workspace-write` by default. Set `danger-full-access` only after the user explicitly requests whole-computer file and command access and understands the risk.
- Never expose credentials, context tokens, memory, or personal workspace files.
- Keep unknown users and group participants denied by default.
- Explain that an authorized WeChat user can direct Codex to modify files inside the configured workspace.
- Preserve existing config and state during upgrades.
- Approve Computer Use only for an application explicitly named in the current message. Keep chat, banking, password, camera, remote-control, security, and private-browsing apps denied unless the user explicitly changes that policy.

## Computer Use

Read `references/computer-use.md` before changing app approval, aliases, sandbox access, or desktop-control behavior.

Computer Use app approval is exact and per app id. Resolve a natural-language alias from `computerUseAppAliases`, restart only the bridge-owned app-server when the approved app scope changes, and inject `x-oai-cua-approved-app` through the temporary `NODE_REPL_REQUEST_META` MCP config override. Do not modify global Codex config or plugin caches.

Use GPT-5.4 with the HTTP-only provider on installations where the latest default model is incompatible with the internal Responses Lite route. Prefer the standard Codex provider and managed login for new public installations.

## Update and uninstall

For updates, stop the task, pull the repository, run `npm install` and tests, then restart it. Preserve `%APPDATA%\wechat-codex-bridge` and `config.json`.

For removal, run the repository's `scripts/uninstall-service.ps1`. Delete credentials or memory only when the user explicitly asks.

Read `references/architecture.md` only when changing protocol, persistence, or process-management code.
