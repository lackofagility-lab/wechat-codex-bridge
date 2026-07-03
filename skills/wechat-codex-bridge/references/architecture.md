# Architecture

`WechatClient` long-polls Tencent iLink endpoints. `Service` authorizes the sender, deduplicates inbound messages, calls `CodexClient`, sends a deterministic reply ID, and only then commits the sync cursor. `CodexClient` owns one local `codex app-server` child over stdio JSON-RPC. Stores persist state in the native per-user state directory; daily memory notes go to the configured workspace.

The Node CLI installs `scripts/daemon.js` directly as a no-admin Windows per-user login startup entry or macOS launchd agent, without a PowerShell runtime dependency. The daemon restarts a failed service child. A localhost port lock prevents multiple bridge instances. Display-off and screen lock are supported; sleep and hibernation suspend the process.

Tencent's official OpenClaw WeChat plugin is used only to complete QR login and save credentials. The bridge runtime does not send messages through an OpenClaw agent.

Windows desktop automation uses Codex's official Computer Use plugin. macOS desktop automation uses the third-party Peekaboo MCP server backed by Accessibility and Screen Recording APIs. The bridge loads either backend only after the paired user explicitly names an allowlisted app and does not implement its own mouse or keyboard injector.

For approved desktop turns, `CodexClient` extracts image blocks, data URLs, or local screenshot paths from completed tool items. `WechatClient` encrypts each image with AES-128-ECB, uploads it through Tencent's iLink CDN flow, and sends a deterministic image message after the text reply. Per-turn limits and processed-message state prevent screenshot floods and duplicates.

The bridge starts app-server with `mcpServerOpenaiFormElicitation`, granular MCP elicitation support, and an auto-reviewer. Because standalone app-server clients cannot rely on the desktop UI to approve apps, the bridge resolves an application explicitly named by the paired user and passes its exact app id as temporary `x-oai-cua-approved-app` metadata. Changing the app scope restarts only the bridge-owned app-server. No wildcard approval is used.

The public default remains `workspace-write`. A local operator can explicitly select `danger-full-access`; this expands shell and filesystem reach but does not disable Computer Use confirmation rules for external side effects.
