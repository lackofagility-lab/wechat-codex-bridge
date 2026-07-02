# Architecture

`WechatClient` long-polls Tencent iLink endpoints. `Service` authorizes the sender, deduplicates inbound messages, calls `CodexClient`, sends a deterministic reply ID, and only then commits the sync cursor. `CodexClient` owns one local `codex app-server` child over stdio JSON-RPC. `SessionStore`, `AccessStore`, and `MemoryStore` persist non-secret state beneath `%APPDATA%\wechat-codex-bridge`; daily memory notes go to the configured workspace.

The Windows Scheduled Task runs `scripts/run-service.ps1`. A localhost port lock prevents multiple bridge instances. Display-off and screen lock are supported; sleep and hibernation suspend the process.

Tencent's official OpenClaw WeChat plugin is used only to complete QR login and save credentials. The bridge runtime does not send messages through an OpenClaw agent.

Desktop automation uses Codex's installed Computer Use plugin through the configured Node REPL MCP channel. The bridge does not implement its own mouse or keyboard injector. This preserves Computer Use safety confirmations and interruption handling.

The bridge starts app-server with `mcpServerOpenaiFormElicitation`, granular MCP elicitation support, and an auto-reviewer. Because standalone app-server clients cannot rely on the desktop UI to approve apps, the bridge resolves an application explicitly named by the paired user and passes its exact app id as temporary `x-oai-cua-approved-app` metadata. Changing the app scope restarts only the bridge-owned app-server. No wildcard approval is used.

The public default remains `workspace-write`. A local operator can explicitly select `danger-full-access`; this expands shell and filesystem reach but does not disable Computer Use confirmation rules for external side effects.
