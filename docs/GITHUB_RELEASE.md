# GitHub release materials

## Repository

- Name: `wechat-codex-bridge`
- Description: `Cross-platform bridge for using local Codex, desktop control, browser automation, and screenshots from WeChat ClawBot.`
- Topics: `wechat`, `codex`, `clawbot`, `windows`, `macos`, `computer-use`, `playwright`, `ai-agent`, `nodejs`
- License: MIT

## Current release highlights

- One Node installer for Windows and macOS; no PowerShell requirement
- Direct WeChat-to-local-Codex conversations
- Native background startup and crash recovery
- Native process-scoped wake locks for display-off/locked always-on use
- Durable memory, pairing, allowlisting, and deterministic message IDs
- Windows Computer Use, macOS Peekaboo, and Playwright web-task routing
- Encrypted screenshot delivery to WeChat
- Full process-tree cleanup and no automatic replay of desktop actions
- Clear quota/login errors without duplicate retry loops

## Before publishing

- Run `npm ci`, `npm run check`, `npm test`, `npm run smoke:browser`, and Skill validation.
- Confirm one daemon and one service process on Windows.
- Confirm config, state, memory, logs, credentials, and unrelated local files are excluded.
- Confirm CI covers Windows and macOS.
