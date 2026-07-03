# WeChat Codex Bridge

[简体中文](README.zh-CN.md)

Connect WeChat ClawBot directly to local Codex on Windows or macOS. Tencent's OpenClaw tool is used only for initial QR login; runtime prompts do not pass through an OpenClaw agent.

## Features

- Direct WeChat-to-local-Codex messaging
- Pairing code and persistent user allowlist
- Durable memory and daily notes
- Exactly-once acknowledgements and replies
- Login auto-start, reconnect, crash recovery, and a single-instance lock
- Optional scoped Windows Computer Use

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
```

Uninstall preserves credentials, memory, and configuration.

## Platform support

- Windows and macOS: WeChat chat, Codex file and terminal work, memory, auto-start, and recovery.
- Windows: current official Computer Use plugin support.
- macOS: the current official Computer Use runtime has no equivalent Mac implementation. This project does not disguise AppleScript as Computer Use or bypass its approval model.

## Limitations

- Phone and Codex desktop conversations are separate and cannot yet be listed or switched from WeChat.
- Screen lock and display-off are supported. Sleep, hibernation, shutdown, or network loss pauses replies until resume.
- Initial QR login uses Tencent's official OpenClaw WeChat tool, though runtime conversations do not use an OpenClaw agent.
- Replies are text-first; Computer Use screenshots are not sent to WeChat yet.

## Security and skill

Unknown users are denied and Codex defaults to `workspace-write`. Whole-computer access is an explicit local opt-in. Computer Use uses exact per-app approval, not a wildcard. See [SECURITY.md](SECURITY.md).

The reusable Codex skill is in `skills/wechat-codex-bridge`.

MIT licensed. This community project is not affiliated with or endorsed by Tencent or OpenAI.
