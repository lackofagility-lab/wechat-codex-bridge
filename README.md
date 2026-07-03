# WeChat Codex Bridge

[简体中文](README.zh-CN.md)

Connect WeChat ClawBot directly to local Codex on Windows or macOS. Tencent's OpenClaw tool is used only for initial QR login; runtime prompts do not pass through an OpenClaw agent.

## Features

- Direct WeChat-to-local-Codex messaging
- Pairing code and persistent user allowlist
- Durable memory and daily notes
- Deduplicated acknowledgements and replies with deterministic message IDs
- Login auto-start, reconnect, crash recovery, and a single-instance lock
- A native wake lock keeps the system from idling to sleep while the bridge runs
- Scoped desktop control: official Computer Use on Windows and Peekaboo MCP on macOS
- Reliable web automation through a bundled local Microsoft Playwright MCP fallback
- Encrypted desktop and browser screenshot delivery to the active WeChat conversation

## Install

Requires Windows 10/11 or macOS, Node.js 22+, Git, a signed-in Codex CLI, and WeChat ClawBot access.

The same commands work in Windows Terminal, CMD, PowerShell, zsh, and bash. PowerShell scripts are not required.

```text
git clone https://github.com/lackofagility-lab/wechat-codex-bridge.git
cd wechat-codex-bridge
npm install
npm run setup
```

Setup opens Tencent's official QR login when needed, prints a one-time `/pair 123456` command, and installs a native per-user background service: a no-admin login startup entry on Windows and launchd on macOS.

```text
npm run status
npm run uninstall
npm test
npm run check
npm run smoke:browser
```

Uninstall preserves credentials, memory, and configuration.

## Platform support

- Windows and macOS both support chat, file and terminal work, memory, auto-start, recovery, and scoped desktop control.
- Windows uses the official Codex Computer Use plugin. macOS exposes the open-source [Peekaboo](https://github.com/openclaw/Peekaboo) MCP server only for turns that explicitly name an allowlisted app.
- Google, YouTube, URLs, and search tasks use the bundled [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) in a managed Chrome profile.
- Peekaboo is a third-party optional dependency, not OpenAI's official Computer Use. It is installed during `npm install` and requires user-granted Accessibility and Screen Recording permissions.

## Limitations

- Phone and Codex desktop conversations are separate and cannot yet be listed or switched from WeChat.
- The managed Playwright profile does not automatically share sign-in state with the user's everyday Chrome profile.
- With `preventSystemSleep: true` (the default), the display may turn off and the computer may lock while the bridge prevents idle system sleep. Set it to `false` to preserve normal idle sleep, especially on battery.
- Manual sleep, closing a laptop lid, hibernation, shutdown, or network loss still pauses replies until resume.
- Chat continues while the screen is locked, but desktop Computer Use requires an unlocked interactive desktop.
- Initial QR login uses Tencent's official OpenClaw WeChat tool, though runtime conversations do not use an OpenClaw agent.
- Up to three desktop/browser screenshots are returned per turn by default. Set `computerUseScreenshots` to `false`, adjust `computerUseMaxScreenshots`, or disable `browserAutomationFallback` locally.

## Security and skill

Unknown users are denied and Codex defaults to `workspace-write`. Whole-computer access is an explicit local opt-in. Computer Use uses exact per-app approval, not a wildcard. See [SECURITY.md](SECURITY.md).

Screenshots leave the computer and are uploaded to the active WeChat conversation. Never allowlist password, banking, camera, private-chat, remote-control, or other sensitive apps.

`autoApproveHighRiskComputerUseApps` remains off by default. Explicitly enabling it accepts request-level approval for apps classified as high risk, but cannot bypass Computer Use's built-in product safety policy.

The reusable Codex skill is in `skills/wechat-codex-bridge`.

MIT licensed. This community project is not affiliated with or endorsed by Tencent or OpenAI.
