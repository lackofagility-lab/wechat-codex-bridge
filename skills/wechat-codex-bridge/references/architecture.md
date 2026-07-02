# Architecture

`WechatClient` long-polls Tencent iLink endpoints. `Service` authorizes the sender, deduplicates inbound messages, calls `CodexClient`, sends a deterministic reply ID, and only then commits the sync cursor. `CodexClient` owns one local `codex app-server` child over stdio JSON-RPC. `SessionStore`, `AccessStore`, and `MemoryStore` persist non-secret state beneath `%APPDATA%\wechat-codex-bridge`; daily memory notes go to the configured workspace.

The Windows Scheduled Task runs `scripts/run-service.ps1`. A localhost port lock prevents multiple bridge instances. Display-off and screen lock are supported; sleep and hibernation suspend the process.

Tencent's official OpenClaw WeChat plugin is used only to complete QR login and save credentials. The bridge runtime does not send messages through an OpenClaw agent.

Desktop automation uses Codex's installed Computer Use plugin through the configured Node REPL MCP channel. The bridge does not implement its own mouse or keyboard injector. This preserves Computer Use safety confirmations and interruption handling.
