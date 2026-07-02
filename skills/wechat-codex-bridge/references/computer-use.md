# Computer Use integration

## Preconditions

- Windows must be unlocked.
- Codex desktop and the bundled Computer Use plugin/runtime must be installed.
- `@openai/codex` must be compatible with the desktop runtime; 0.142.5 fixed the file-URI mismatch observed with 0.139.0.
- The requested app must be present in `computerUseAppAliases` and explicitly named in the paired user's current message.

## Approval flow

1. Match the message against aliases, case-insensitively.
2. Select one exact app id; do not use wildcard approval.
3. Restart the bridge-owned app-server only when the app scope changes.
4. Pass `NODE_REPL_REQUEST_META` as a temporary app-server MCP config override containing `x-oai-cua-approved-app`.
5. Let the official Computer Use skill and helper perform the operation.
6. Preserve mandatory confirmations for messages, deletion, installation, submissions, payments, account changes, and sensitive-data transmission.

Default-deny private categories: chat and meeting clients, password managers, banking/payment software, cameras, private browsers, remote-control tools, security settings, uninstallers, and cloud drives. Chrome may be allowed when the operator explicitly chooses it.

## Common ids

- Notepad: `Microsoft.WindowsNotepad_8wekyb3d8bbwe!App`
- Chrome: `Chrome`
- Word: `Microsoft.Office.WINWORD.EXE.15`
- Excel: `Microsoft.Office.EXCEL.EXE.15`
- PowerPoint: `Microsoft.Office.POWERPNT.EXE.15`
- Calculator: `Microsoft.WindowsCalculator_8wekyb3d8bbwe!App`

App ids can differ by installation. Obtain them through the official Computer Use `list_apps` call; never guess executable paths.
