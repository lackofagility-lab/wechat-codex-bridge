# GitHub release materials

## Repository

- Suggested name: `wechat-codex-bridge`
- Description: `Secure Windows bridge for using local Codex and scoped Computer Use from WeChat ClawBot.`
- Topics: `wechat`, `codex`, `clawbot`, `windows`, `computer-use`, `ai-agent`, `nodejs`
- License: MIT

## v1.0.0 title

`WeChat Codex Bridge v1.0.0 — Windows, memory, and scoped Computer Use`

## Release notes

This first public release connects WeChat ClawBot directly to a local Codex app-server on Windows. It includes pairing and allowlisting, automatic startup and crash recovery, message deduplication, persistent memory, and optional per-application Computer Use. The secure default limits Codex to the configured workspace; whole-computer access is an explicit local opt-in.

Known limitations: Windows only, text-only replies, desktop and phone threads are separate, Computer Use requires an unlocked session and configured app aliases, and initial QR login uses Tencent's official OpenClaw WeChat installer.

## Before publishing

- Replace `YOUR_GITHUB_USERNAME` in both README files.
- Set the package repository URL after creating the GitHub repository.
- Run tests, Skill validation, staged secret scanning, and `git diff --cached --check`.
- Confirm `config.json`, memory, personal markdown files, logs, and credentials are ignored.
- Create the public repository, push `main`, and publish the release from commit `HEAD`.
