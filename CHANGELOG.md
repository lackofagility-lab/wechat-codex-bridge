# Changelog

## 1.4.1 - 2026-07-03

- Made the Windows daemon log directly to its own file so login startup works without a terminal or inherited console handles.
- Added durable in-flight message tracking so interrupted desktop actions are not silently replayed after a crash.
- Tightened screenshot-path parsing to prevent tool instructions from becoming fake image uploads.
- Verified daemon recovery with no console attached and automatic service restart after a forced crash.

## 1.4.0 - 2026-07-03

- Stopped restarting Windows app-server when Computer Use app scope changes.
- Removed the blocking model warm-up turn while retaining app-server initialization.
- Added bundled Microsoft Playwright MCP routing for Google, YouTube, URLs, and web search.
- Added protocol-level browser navigation and screenshot smoke testing.
- Recognized screenshot paths embedded in MCP Markdown output.
- Classified quota/login failures as non-retryable and prevented failed screenshot uploads from replaying completed tasks.
- Added real PID/config/credential health checks and Windows/macOS CI coverage.
- Added process-scoped Windows/macOS wake locks without PowerShell or permanent power-plan changes.
- Killed complete app-server/MCP process trees on restart and uninstall to prevent orphan control channels.
- Routed browser tasks consistently on both operating systems and resolved relative screenshot paths.
- Prevented automatic replay of desktop actions and collapsed screenshot failures into one message.
- Rotated bridge and supervisor logs for long-running installations.

## 1.3.3 - 2026-07-03

- Updated Computer Use elicitation parsing for the current app-server `_meta` schema.
- Added an explicit local opt-in for automatic high-risk app approval.
- Preserved the last explicitly approved app across retry/continue follow-ups.

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
