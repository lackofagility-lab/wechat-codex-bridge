---
name: wechat-codex-bridge
description: Install, configure, diagnose, update, or uninstall the open-source WeChat Codex Bridge on Windows or macOS. Use when a user wants to chat with local Codex through WeChat ClawBot, pair an authorized WeChat account, enable scoped Windows Computer Use, repair delayed or duplicate replies, inspect the native background service, or manage bridge memory and security.
---

# WeChat Codex Bridge

Operate the cross-platform bridge that connects Tencent WeChat ClawBot directly to the local Codex app-server.

When desktop control is enabled, route Windows UI requests through the installed `computer-use` skill. Preserve its confirmation policy; never replace it with ad-hoc SendKeys or shell-based UI automation.

## Install

1. Require Windows 10/11 or macOS, Node.js 22+, Git, and a working `codex` login.
   Require the Codex desktop app and installed Computer Use plugin only when desktop control is requested.
2. Clone the project repository into a user-selected folder.
3. Run `npm install`, then `npm run setup`. The Node installer selects a no-admin Windows user startup entry or macOS launchd; do not require PowerShell.
4. Let Tencent's official installer display the QR code when credentials are absent.
5. Tell the user to send the printed `/pair NNNNNN` command to the bot.
6. Run `npm run status`, `npm test`, and `npm run check`; verify exactly one bridge process.

Do not request, print, or copy the WeChat bearer token. It belongs only in the platform state directory reported by `npm run status`.

## Diagnose

Run `npm run status`. Then inspect only the relevant tail of the reported `bridge.log`.

- No process: run `node bin/wechat-codex.js install`.
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

For updates, pull the repository, run `npm install`, tests, and `node bin/wechat-codex.js install`. Preserve the platform state directory and `config.json`.

For removal, run `npm run uninstall`. Delete credentials or memory only when the user explicitly asks.

Read `references/architecture.md` only when changing protocol, persistence, or process-management code.
