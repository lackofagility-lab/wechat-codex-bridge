# Computer Use integration

## Backends

- Windows: bundled official Codex Computer Use runtime.
- macOS: third-party MIT-licensed Peekaboo MCP (`@steipete/peekaboo`), loaded through `npx` only for an explicitly named allowlisted app.

## Preconditions

- The desktop must be unlocked.
- Windows requires Codex desktop and the bundled Computer Use plugin/runtime.
- macOS requires user-granted Accessibility and Screen Recording permission. Never bypass or automate TCC approval.
- `@openai/codex` must be compatible with the desktop runtime; 0.142.5 fixed the file-URI mismatch observed with 0.139.0.
- The requested app must be present in `computerUseAppAliases` and explicitly named in the paired user's current message.

## Approval flow

1. Match the message against aliases, case-insensitively.
2. Select one exact Windows app id or macOS app name; do not use wildcard approval.
3. Restart the bridge-owned app-server only when the app scope changes.
4. On Windows, pass temporary `x-oai-cua-approved-app` metadata. On macOS, expose Peekaboo only while that app is approved.
5. Let the selected backend perform the operation; do not fall back to AppleScript, SendKeys, or shell input automation.
6. Preserve mandatory confirmations for messages, deletion, installation, submissions, payments, account changes, and sensitive-data transmission.

Default-deny private categories: chat and meeting clients, password managers, banking/payment software, cameras, private browsers, remote-control tools, security settings, uninstallers, and cloud drives. Chrome may be allowed when the operator explicitly chooses it.

When screenshot delivery is enabled, capture only the approved application window. At most `computerUseMaxScreenshots` images are encrypted and sent to the paired user's active WeChat context. Do not forward unrelated desktop, notification, or sensitive-app imagery.

## Common Windows ids

- Notepad: `Microsoft.WindowsNotepad_8wekyb3d8bbwe!App`
- Chrome: `Chrome`
- Word: `Microsoft.Office.WINWORD.EXE.15`
- Excel: `Microsoft.Office.EXCEL.EXE.15`
- PowerPoint: `Microsoft.Office.POWERPNT.EXE.15`
- Calculator: `Microsoft.WindowsCalculator_8wekyb3d8bbwe!App`

App ids can differ by installation. Obtain them through the official Computer Use `list_apps` call; never guess executable paths.

Common macOS names include Safari, Notes, TextEdit, Finder, Preview, Calculator, Pages, Numbers, Keynote, and Google Chrome. Register aliases under `macComputerUseAppAliases`. Disclose that Peekaboo is third-party software during installation.
