import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { terminateProcessTree } from "../src/process-tree.js";
import { extractScreenshotSources, resolveScreenshotSource } from "../src/codex-client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRequire = createRequire(import.meta.url);
const cli = path.join(path.dirname(packageRequire.resolve("@playwright/mcp")), "cli.js");
const outputDir = path.join(root, ".wechat-codex-screenshots");
const screenshotName = `mcp-smoke-${Date.now()}.png`;
fs.mkdirSync(outputDir, { recursive: true });
const child = spawn(process.execPath, [cli, "--browser", "chrome", "--headless", "--output-dir", outputDir], {
  cwd: root,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});
const pending = new Map();
let nextId = 1;
let childStderr = "";

child.stderr.on("data", (chunk) => { childStderr = `${childStderr}${chunk}`.slice(-4000); });
child.on("error", (error) => {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
});
child.on("exit", (code, signal) => {
  if (!pending.size) return;
  const error = new Error(`Playwright MCP exited (${code ?? signal})${childStderr ? `: ${childStderr.trim()}` : ""}`);
  for (const request of pending.values()) request.reject(error);
  pending.clear();
});

readline.createInterface({ input: child.stdout }).on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 30000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

try {
  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "wechat-codex-smoke", version: "1.0.0" },
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
  const tools = await request("tools/list");
  const names = new Set((tools.tools ?? []).map((tool) => tool.name));
  if (!names.has("browser_navigate") || !names.has("browser_take_screenshot")) {
    throw new Error("Playwright MCP browser tools are missing");
  }
  await request("tools/call", { name: "browser_navigate", arguments: { url: "data:text/html,<title>Bridge Smoke Test</title><h1>OK</h1>" } });
  const shot = await request("tools/call", { name: "browser_take_screenshot", arguments: { type: "png", filename: screenshotName } });
  const bridgeSources = extractScreenshotSources(shot).map((source) => resolveScreenshotSource(source, root));
  const screenshotPath = [path.join(outputDir, screenshotName), path.join(root, screenshotName)]
    .find((candidate) => fs.existsSync(candidate));
  if (!screenshotPath || fs.statSync(screenshotPath).size === 0) {
    throw new Error(`Playwright screenshot was not created: ${JSON.stringify(shot)}`);
  }
  if (!bridgeSources.includes(screenshotPath)) throw new Error(`Bridge resolved the wrong Playwright screenshot path: ${JSON.stringify({ bridgeSources, screenshotPath, shot })}`);
  console.log(JSON.stringify({ ok: true, toolCount: names.size, screenshotBytes: fs.statSync(screenshotPath).size }));
} finally {
  terminateProcessTree(child);
  fs.rmSync(path.join(outputDir, screenshotName), { force: true });
  fs.rmSync(path.join(root, screenshotName), { force: true });
}
