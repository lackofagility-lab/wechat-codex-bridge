import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const codexScript = fileURLToPath(
  new URL("../node_modules/@openai/codex/bin/codex.js", import.meta.url),
);

const approvalPolicy = {
  granular: {
    mcp_elicitations: true,
    rules: false,
    sandbox_approval: false,
    request_permissions: false,
    skill_approval: false,
  },
};

export class CodexClient {
  constructor({ workspace, model, modelProvider = null, sandbox = "workspace-write", thinking = "medium", timeoutMs = 900000, autoApproveLowRiskComputerUse = true }) {
    this.workspace = workspace;
    this.model = model;
    this.modelProvider = modelProvider;
    this.sandbox = sandbox;
    this.thinking = thinking;
    this.timeoutMs = timeoutMs;
    this.autoApproveLowRiskComputerUse = autoApproveLowRiskComputerUse;
    this.approvedComputerUseApp = null;
    this.child = null;
    this.nextId = 1;
    this.requests = new Map();
    this.turns = new Map();
    this.loadedThreads = new Set();
    this.startPromise = null;
  }

  async start() {
    if (this.child && !this.child.killed) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  async startInternal() {
    const args = [codexScript, "app-server", "--listen", "stdio://"];
    if (this.modelProvider === "chatgpt-http") {
      args.push(
        "-c", 'model_provider="chatgpt-http"',
        "-c", 'model_providers.chatgpt-http.name="ChatGPT HTTP"',
        "-c", 'model_providers.chatgpt-http.base_url="https://chatgpt.com/backend-api/codex"',
        "-c", 'model_providers.chatgpt-http.wire_api="responses"',
        "-c", "model_providers.chatgpt-http.requires_openai_auth=true",
        "-c", "model_providers.chatgpt-http.supports_websockets=false",
      );
    }
    if (this.approvedComputerUseApp) {
      const requestMeta = JSON.stringify({
        "x-oai-cua-approved-app": this.approvedComputerUseApp,
      });
      args.push(
        "-c",
        `mcp_servers.node_repl.env.NODE_REPL_REQUEST_META=${JSON.stringify(requestMeta)}`,
      );
    }
    this.child = spawn(process.execPath, args, {
      cwd: this.workspace,
      windowsHide: true,
      env: {
        ...process.env,
        ...(this.approvedComputerUseApp ? {
          NODE_REPL_REQUEST_META: JSON.stringify({
            "x-oai-cua-approved-app": this.approvedComputerUseApp,
          }),
        } : {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.on("data", (chunk) => process.stderr.write(`[codex] ${chunk}`));
    this.child.on("exit", (code, signal) => this.failAll(new Error(`Codex app-server exited (${code ?? signal})`)));
    this.child.on("error", (error) => this.failAll(error));
    readline.createInterface({ input: this.child.stdout }).on("line", (line) => this.onLine(line));

    await this.request("initialize", {
      clientInfo: { name: "wechat-codex-bridge", title: "WeChat Codex Bridge", version: "1.0.0" },
      capabilities: {
        experimentalApi: true,
        mcpServerOpenaiFormElicitation: true,
      },
    });
    this.notify("initialized", {});
    this.loadedThreads.clear();
  }

  onLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id != null && message.method) {
      this.handleServerRequest(message);
      return;
    }
    if (message.id != null && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.requests.get(String(message.id));
      if (!pending) return;
      this.requests.delete(String(message.id));
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === "item/completed") {
      const { turnId, item } = message.params ?? {};
      if (item?.type === "agentMessage" && this.turns.has(turnId)) {
        this.turns.get(turnId).messages.push(item.text);
      }
      return;
    }
    if (message.method === "turn/completed") {
      const turn = message.params?.turn;
      const pending = this.turns.get(turn?.id);
      if (!pending) return;
      this.turns.delete(turn.id);
      clearTimeout(pending.timer);
      if (turn.status === "failed") {
        pending.reject(new Error(turn.error?.message ?? "Codex turn failed"));
      } else if (!pending.messages.length) {
        pending.reject(new Error("Codex returned no assistant message"));
      } else {
        pending.resolve(pending.messages.at(-1));
      }
    }
  }

  handleServerRequest(message) {
    if (message.method !== "mcpServer/elicitation/request") {
      this.send({ id: message.id, error: { code: -32601, message: `Unsupported server request: ${message.method}` } });
      return;
    }

    const request = message.params?.request ?? message.params ?? {};
    const meta = request.meta ?? {};
    const isComputerUseApproval =
      meta.codex_approval_kind === "mcp_tool_call" &&
      meta.connector_id === "computer-use";
    const canAccept =
      isComputerUseApproval &&
      this.autoApproveLowRiskComputerUse &&
      meta.riskLevel !== "high";
    this.send({
      id: message.id,
      result: { action: canAccept ? "accept" : "decline", content: canAccept ? {} : null },
    });
  }

  send(message) {
    if (!this.child?.stdin.writable) throw new Error("Codex app-server is not writable");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  notify(method, params) {
    this.send({ method, params });
  }

  request(method, params) {
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, Math.min(this.timeoutMs, 60000));
      this.requests.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }

  failAll(error) {
    for (const pending of this.requests.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    for (const pending of this.turns.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.requests.clear();
    this.turns.clear();
    this.loadedThreads.clear();
    this.child = null;
  }

  restart(reason = new Error("Codex app-server restart requested")) {
    const child = this.child;
    this.failAll(reason);
    if (child && !child.killed) child.kill();
  }

  setApprovedComputerUseApp(appId) {
    const next = appId || null;
    if (next === this.approvedComputerUseApp) return;
    this.approvedComputerUseApp = next;
    if (this.child) this.restart(new Error("Computer Use app scope changed"));
  }

  async ensureThread(threadId) {
    if (threadId && !this.loadedThreads.has(threadId)) {
      const params = {
        threadId,
        cwd: this.workspace,
        approvalPolicy,
        approvalsReviewer: "auto_review",
        sandbox: this.sandbox,
      };
      if (this.model) params.model = this.model;
      if (this.modelProvider) params.modelProvider = this.modelProvider;
      await this.request("thread/resume", params);
      this.loadedThreads.add(threadId);
      return threadId;
    }
    if (threadId) return threadId;

    const params = {
      cwd: this.workspace,
      model: this.model || undefined,
      approvalPolicy,
      approvalsReviewer: "auto_review",
      sandbox: this.sandbox,
      ephemeral: false,
      threadSource: "user",
    };
    if (this.modelProvider) params.modelProvider = this.modelProvider;
    const result = await this.request("thread/start", params);
    const newThreadId = result?.thread?.id;
    if (!newThreadId) throw new Error("Codex did not return a thread id");
    this.loadedThreads.add(newThreadId);
    return newThreadId;
  }

  async run(prompt, threadId = null) {
    await this.start();
    const activeThreadId = await this.ensureThread(threadId);
    const result = await this.request("turn/start", {
      threadId: activeThreadId,
      input: [{ type: "text", text: prompt }],
      effort: this.thinking,
      cwd: this.workspace,
      approvalPolicy,
    });
    const turnId = result?.turn?.id;
    if (!turnId) throw new Error("Codex did not return a turn id");
    const text = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turns.delete(turnId);
        const error = new Error(`Codex turn timed out after ${this.timeoutMs}ms`);
        reject(error);
        this.restart(error);
      }, this.timeoutMs);
      this.turns.set(turnId, { resolve, reject, timer, messages: [] });
    });
    return { threadId: activeThreadId, text };
  }
}
