---
name: wechat-codex-bridge
description: Install, configure, diagnose, update, or uninstall the open-source WeChat Codex Bridge on Windows or macOS. Use when a user wants to chat with local Codex through WeChat ClawBot, pair an authorized WeChat account, enable scoped desktop control through Windows Computer Use or macOS Peekaboo, repair delayed or duplicate replies, inspect the native background service, or manage bridge memory and security.
---

# WeChat Codex Bridge

Operate the cross-platform bridge that connects Tencent WeChat ClawBot directly to the local Codex app-server.

Detect the operating system before setup. On Windows, route UI requests through the official `computer-use` skill. On macOS, use the project-configured Peekaboo MCP backend. Preserve confirmation policy on both; never replace either with ad-hoc SendKeys, AppleScript, or shell-based UI automation.

## Install

1. Require Windows 10/11 or macOS, Node.js 22+, Git, and a working `codex` login.
   Require Codex desktop and Computer Use for Windows desktop control. On macOS, disclose that desktop control uses third-party open-source Peekaboo and requires user-approved Accessibility and Screen Recording permissions.
2. Clone the project repository into a user-selected folder.
3. Run `npm install`, then `npm run setup`. The Node installer selects a no-admin Windows user startup entry or macOS launchd; do not require PowerShell.
4. Let Tencent's official installer display the QR code when credentials are absent.
   On macOS, never bypass TCC. Tell the user to approve the terminal/Codex host under System Settings > Privacy & Security > Accessibility and Screen Recording when first prompted.
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

Desktop approval is exact and per app. Windows resolves `computerUseAppAliases` and injects temporary `x-oai-cua-approved-app` metadata. macOS resolves `macComputerUseAppAliases` and exposes Peekaboo only to the bridge-owned app-server and only for that scoped turn. Do not modify global Codex config or plugin caches.

Read approval metadata from the current app-server request `_meta` field as well as legacy nested request metadata. Keep `autoApproveHighRiskComputerUseApps` false unless the local operator explicitly requests it. Even after opt-in, never claim that built-in Computer Use product-policy blocks can be bypassed.

When `computerUseScreenshots` is enabled, every actual Computer Use turn must end with a fresh screenshot of the approved app. If the main turn emits none, issue one read-only capture follow-up in the same thread. Return only screenshots from that approved app-control turn. The bridge encrypts and uploads at most `computerUseMaxScreenshots` images with deterministic message IDs. Never capture the full macOS desktop when an app window can be scoped. Explain that screenshots leave the computer and enter the paired WeChat conversation.

Use GPT-5.4 with the HTTP-only provider on installations where the latest default model is incompatible with the internal Responses Lite route. Prefer the standard Codex provider and managed login for new public installations.

## Update and uninstall

For updates, pull the repository, run `npm install`, tests, and `node bin/wechat-codex.js install`. Preserve the platform state directory and `config.json`.

For removal, run `npm run uninstall`. Delete credentials or memory only when the user explicitly asks.

Read `references/architecture.md` only when changing protocol, persistence, or process-management code.
