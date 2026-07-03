# Changelog

## 1.3.2 - 2026-07-03

- Fixed Windows Chrome approval by using the current exact `Google Chrome` app id.
- Added YouTube aliases so browser-control turns receive the correct approval scope.

## 1.3.1 - 2026-07-03

- Require every actual Computer Use turn to finish with an approved-app screenshot.
- Retry once with a read-only capture when the primary turn emits no image.

## 1.3.0 - 2026-07-03

- Added encrypted Computer Use screenshot delivery to WeChat on Windows and macOS.
- Added screenshot extraction for MCP image blocks, data URLs, and local image paths.
- Added deterministic screenshot IDs, a three-image default limit, and a local disable switch.

## 1.2.0 - 2026-07-03

- Added OS-selected desktop control: official Computer Use on Windows and scoped Peekaboo MCP on macOS.
- Added macOS app aliases, TCC permission guidance, and per-turn backend gating.

## 1.1.0 - 2026-07-03

- Added one cross-platform Node CLI for setup, native service installation, status, and uninstall.
- Added macOS launchd support and removed PowerShell from the primary Windows path.
- Added portable state directories and a crash-restarting daemon.
- Kept official Computer Use on Windows while preparing the cross-platform installer.

## 1.0.0 - 2026-07-02

- Direct WeChat ClawBot to local Codex app-server bridge
- Windows Scheduled Task installation and crash recovery
- Pairing code, allowlist, single-instance lock, and deterministic reply ids
- Persistent recent memory and daily notes
- HTTP-only provider compatibility and Codex 0.142.5 upgrade
- Optional scoped Computer Use with per-app aliases
- Optional full-computer file and command access
- Codex installation and diagnostics skill
