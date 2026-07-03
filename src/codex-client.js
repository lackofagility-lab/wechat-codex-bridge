import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import readline from "node:readline";
import { terminateProcessTree } from "./process-tree.js";

const packageRequire = createRequire(import.meta.url);
const bridgeVersion = packageRequire("../package.json").version;
const codexScript = packageRequire.resolve("@openai/codex/bin/codex.js");
const playwrightMcpScript = path.join(path.dirname(packageRequire.resolve("@playwright/mcp")), "cli.js");

const approvalPolicy = {
  granular: {
    mcp_elicitations: true,
    rules: false,
    sandbox_approval: false,
    request_permissions: false,
    skill_approval: false,
  },
};

function approvalAppMatches(scope, requestedApp) {
  if (!scope || !requestedApp) return Boolean(scope);
  const left = String(scope).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const right = String(requestedApp).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left));
}

export function macComputerUseMcpArgs(platform, approvedApp, resolvePeekaboo = () => packageRequire.resolve("@steipete/peekaboo")) {
  if (platform !== "darwin" || !approvedApp) return [];
  const peekabooMcpScript = resolvePeekaboo();
  return [
    "-c", `mcp_servers.peekaboo.command=${JSON.stringify(process.execPath)}`,
    "-c", `mcp_servers.peekaboo.args=${JSON.stringify([peekabooMcpScript])}`,
  ];
}

export function playwrightMcpArgs(workspace, enabled = true) {
  if (!enabled) return [];
  const outputDir = path.join(workspace, ".wechat-codex-screenshots");
  return [
    "-c", `mcp_servers.playwright.command=${JSON.stringify(process.execPath)}`,
    "-c", `mcp_servers.playwright.args=${JSON.stringify([
      playwrightMcpScript,
      "--browser", "chrome",
      "--output-dir", outputDir,
    ])}`,
  ];
}

function looksLikeImageReference(value) {
  return typeof value === "string" && (
    /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value) ||
    /^file:\/\//i.test(value) ||
    /\.(?:png|jpe?g|webp)(?:\?.*)?$/i.test(value)
  );
}

export function extractScreenshotSources(item, limit = 3) {
  const found = [];
  const seen = new Set();
  function add(value) {
    if (!looksLikeImageReference(value) || seen.has(value) || found.length >= limit) return;
    seen.add(value);
    found.push(value);
  }
  function visit(value, key = "") {
    if (found.length >= limit || value == null) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, key);
      return;
    }
    if (typeof value !== "object") {
      if (/image|screenshot|path|url/i.test(key)) add(value);
      if (typeof value === "string") {
        const markdownTargets = [...value.matchAll(/\]\(([^)\n\r]+?\.(?:png|jpe?g|webp)(?:\?[^)]*)?)\)/gi)];
        for (const match of markdownTargets) add(match[1]);
        const references = value.match(/(?:data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+|file:\/\/[^\s)'"<>]+|[A-Za-z]:[\\/][^\n\r)'"<>]+?\.(?:png|jpe?g|webp)|\.{1,2}[\\/][^\s)'"<>]+?\.(?:png|jpe?g|webp)|\/[^\n\r)'"<>]+?\.(?:png|jpe?g|webp))/gi) ?? [];
        for (const reference of references) add(reference);
      }
      return;
    }
    if (value.type === "image" && typeof value.data === "string") {
      add(`data:${value.mimeType || "image/png"};base64,${value.data}`);
    }
    if (value.type === "inputImage" && typeof value.imageUrl === "string") add(value.imageUrl);
    for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
  }
  visit(item);
  return found;
}

export function resolveScreenshotSource(source, workspace) {
  if (typeof source !== "string" || /^data:image\//i.test(source) || /^https?:\/\//i.test(source) || /^file:\/\//i.test(source)) {
    return source;
  }
  if (path.isAbsolute(source)) return fs.existsSync(source) ? source : null;
  const workspaceCandidate = path.resolve(workspace, source);
  const outputCandidate = path.resolve(workspace, ".wechat-codex-screenshots", source);
  if (fs.existsSync(workspaceCandidate)) return workspaceCandidate;
  if (fs.existsSync(outputCandidate)) return outputCandidate;
  return null;
}

export class CodexClient {
  constructor({ workspace, model, modelProvider = null, sandbox = "workspace-write", thinking = "medium", timeoutMs = 900000, autoApproveLowRiskComputerUse = true, autoApproveHighRiskComputerUseApps = false, computerUseMaxScreenshots = 3, platform = process.platform, browserAutomationFallback = true }) {
    this.workspace = workspace;
    this.model = model;
    this.modelProvider = modelProvider;
    this.sandbox = sandbox;
    this.thinking = thinking;
    this.timeoutMs = timeoutMs;
    this.autoApproveLowRiskComputerUse = autoApproveLowRiskComputerUse;
    this.autoApproveHighRiskComputerUseApps = autoApproveHighRiskComputerUseApps;
    this.computerUseMaxScreenshots = Math.max(0, Math.min(10, Number(computerUseMaxScreenshots) || 0));
    this.platform = platform;
    this.browserAutomationFallback = browserAutomationFallback;
    this.approvedComputerUseApp = null;
    this.child = null;
    this.initialized = false;
    this.nextId = 1;
    this.requests = new Map();
    this.turns = new Map();
    this.loadedThreads = new Set();
    this.turnScreenshots = new Map();
    this.startPromise = null;
  }

  async start() {
    if (this.child && !this.child.killed && this.initialized) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } catch (error) {
      this.restart(error);
      throw error;
    } finally {
      this.startPromise = null;
    }
  }

  async startInternal() {
    this.initialized = false;
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
    args.push(...macComputerUseMcpArgs(this.platform, this.approvedComputerUseApp));
    args.push(...playwrightMcpArgs(this.workspace, this.browserAutomationFallback));
    this.child = spawn(process.execPath, args, {
      cwd: this.workspace,
      windowsHide: true,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.on("data", (chunk) => process.stderr.write(`[codex] ${chunk}`));
    this.child.on("exit", (code, signal) => this.failAll(new Error(`Codex app-server exited (${code ?? signal})`)));
    this.child.on("error", (error) => this.failAll(error));
    readline.createInterface({ input: this.child.stdout }).on("line", (line) => this.onLine(line));

    await this.request("initialize", {
      clientInfo: { name: "wechat-codex-bridge", title: "WeChat Codex Bridge", version: bridgeVersion },
      capabilities: {
        experimentalApi: true,
        mcpServerOpenaiFormElicitation: true,
      },
    });
    this.notify("initialized", {});
    this.loadedThreads.clear();
    this.initialized = true;
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
      if (turnId && this.turns.get(turnId)?.captureScreenshots && item?.type !== "agentMessage") {
        const existing = this.turnScreenshots.get(turnId) ?? [];
        const next = extractScreenshotSources(item, this.computerUseMaxScreenshots)
          .map((source) => resolveScreenshotSource(source, this.workspace))
          .filter(Boolean);
        if (next.length) {
          const merged = [...new Set([...existing, ...next])];
          this.turnScreenshots.set(turnId, merged.slice(-this.computerUseMaxScreenshots));
        }
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
        pending.resolve({
          text: pending.messages.at(-1),
          screenshots: this.turnScreenshots.get(turn.id) ?? [],
        });
      }
      this.turnScreenshots.delete(turn.id);
    }
  }

  handleServerRequest(message) {
    if (message.method !== "mcpServer/elicitation/request") {
      this.send({ id: message.id, error: { code: -32601, message: `Unsupported server request: ${message.method}` } });
      return;
    }

    const request = message.params?.request ?? message.params ?? {};
    const meta = request.meta ?? request._meta ?? message.params?._meta ?? {};
    const isComputerUseApproval =
      (meta.codex_approval_kind === "mcp_tool_call" && meta.connector_id === "computer-use") ||
      (meta.connector_name === "Computer Use" && typeof meta.tool_params?.app === "string");
    const canAccept =
      isComputerUseApproval &&
      this.autoApproveLowRiskComputerUse &&
      (meta.riskLevel !== "high" || (
        this.autoApproveHighRiskComputerUseApps &&
        approvalAppMatches(this.approvedComputerUseApp, meta.tool_params?.app)
      ));
    process.stderr.write(`[computer-use approval] method=${message.method} app=${meta.tool_params?.app ?? "unknown"} risk=${meta.riskLevel ?? "unknown"} action=${canAccept ? "accept" : "decline"}\n`);
    this.send({
      id: message.id,
      result: {
        action: canAccept ? "accept" : "decline",
        content: canAccept ? {} : null,
        ...(canAccept ? { _meta: { persist: "session" } } : {}),
      },
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
    this.turnScreenshots.clear();
    this.child = null;
    this.initialized = false;
  }

  restart(reason = new Error("Codex app-server restart requested")) {
    const child = this.child;
    this.failAll(reason);
    terminateProcessTree(child, "SIGTERM", this.platform);
  }

  stop() {
    this.restart(new Error("Codex app-server stopped"));
  }

  setApprovedComputerUseApp(appId) {
    const next = appId || null;
    if (next === this.approvedComputerUseApp) return;
    this.approvedComputerUseApp = next;
    if (this.child && this.platform === "darwin") {
      this.restart(new Error("macOS Computer Use backend scope changed"));
    }
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

  async run(prompt, threadId = null, { captureScreenshots = false } = {}) {
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
    const completed = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.turns.delete(turnId);
        const error = new Error(`Codex turn timed out after ${this.timeoutMs}ms`);
        reject(error);
        this.restart(error);
      }, this.timeoutMs);
      this.turns.set(turnId, { resolve, reject, timer, messages: [], captureScreenshots });
    });
    return { threadId: activeThreadId, text: completed.text, screenshots: completed.screenshots };
  }
}
