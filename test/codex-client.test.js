import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CodexClient, extractScreenshotSources, macComputerUseMcpArgs, playwrightMcpArgs, resolveScreenshotSource } from "../src/codex-client.js";

function approval(riskLevel) {
  return {
    id: 7,
    method: "mcpServer/elicitation/request",
    params: {
      mode: "openai/form",
      meta: {
        codex_approval_kind: "mcp_tool_call",
        connector_id: "computer-use",
        riskLevel,
      },
    },
  };
}

test("accepts low-risk Computer Use app approval", () => {
  const client = new CodexClient({ workspace: process.cwd() });
  let response;
  client.send = (message) => { response = message; };
  client.handleServerRequest(approval("low"));
  assert.equal(response.result.action, "accept");
});

test("declines high-risk Computer Use app approval", () => {
  const client = new CodexClient({ workspace: process.cwd() });
  let response;
  client.send = (message) => { response = message; };
  client.handleServerRequest(approval("high"));
  assert.equal(response.result.action, "decline");
});

test("accepts high-risk app approval after explicit local opt-in", () => {
  const client = new CodexClient({
    workspace: process.cwd(),
    autoApproveHighRiskComputerUseApps: true,
  });
  client.setApprovedComputerUseApp("Chrome");
  let response;
  client.send = (message) => { response = message; };
  client.handleServerRequest({
    id: 8,
    method: "mcpServer/elicitation/request",
    params: {
      _meta: {
        codex_approval_kind: "mcp_tool_call",
        connector_id: "computer-use",
        connector_name: "Computer Use",
        riskLevel: "high",
        tool_params: { app: "Chrome" },
      },
    },
  });
  assert.equal(response.result.action, "accept");
});

test("declines a high-risk app outside the current explicit scope", () => {
  const client = new CodexClient({
    workspace: process.cwd(),
    autoApproveHighRiskComputerUseApps: true,
  });
  client.setApprovedComputerUseApp("Chrome");
  let response;
  client.send = (message) => { response = message; };
  client.handleServerRequest({
    id: 9,
    method: "mcpServer/elicitation/request",
    params: { _meta: {
      codex_approval_kind: "mcp_tool_call",
      connector_id: "computer-use",
      riskLevel: "high",
      tool_params: { app: "Password Manager" },
    } },
  });
  assert.equal(response.result.action, "decline");
});

test("enables Peekaboo only for an explicitly approved macOS app", () => {
  assert.deepEqual(macComputerUseMcpArgs("win32", "Notes"), []);
  assert.deepEqual(macComputerUseMcpArgs("darwin", null), []);
  const macArgs = macComputerUseMcpArgs("darwin", "Notes", () => "/opt/peekaboo/peekaboo-mcp.js");
  assert.equal(macArgs[1], `mcp_servers.peekaboo.command=${JSON.stringify(process.execPath)}`);
  assert.equal(macArgs[3].includes("peekaboo-mcp.js"), true);
});

test("Windows app scope changes do not restart app-server", () => {
  const client = new CodexClient({ workspace: process.cwd(), platform: "win32" });
  let restarted = false;
  client.child = { killed: false };
  client.restart = () => { restarted = true; };
  client.setApprovedComputerUseApp("Chrome");
  assert.equal(restarted, false);
});

test("does not mistake an uninitialized live process for a ready channel", async () => {
  const client = new CodexClient({ workspace: process.cwd() });
  client.child = { killed: false };
  let starts = 0;
  client.startInternal = async () => { starts += 1; client.initialized = true; };
  await client.start();
  await client.start();
  assert.equal(starts, 1);
});

test("macOS backend scope changes restart app-server", () => {
  const client = new CodexClient({ workspace: process.cwd(), platform: "darwin" });
  let restarted = false;
  client.child = { killed: false };
  client.restart = () => { restarted = true; };
  client.setApprovedComputerUseApp("Safari");
  assert.equal(restarted, true);
});

test("mounts local Playwright MCP without npx network dependency", () => {
  const args = playwrightMcpArgs(process.cwd(), true);
  assert.equal(args[1].includes("mcp_servers.playwright.command"), true);
  assert.equal(args[3].includes("node_modules"), true);
  assert.deepEqual(playwrightMcpArgs(process.cwd(), false), []);
});

test("extracts and deduplicates screenshot outputs", () => {
  const dataUrl = "data:image/png;base64,aGVsbG8=";
  assert.deepEqual(extractScreenshotSources({
    type: "mcpToolCall",
    result: { content: [
      { type: "image", mimeType: "image/png", data: "aGVsbG8=" },
      { imageUrl: dataUrl },
      { screenshotPath: "/tmp/final.png" },
      { type: "text", text: "[Screenshot of viewport](playwright-output.png)" },
    ] },
  }), [dataUrl, "/tmp/final.png", "playwright-output.png"]);
});

test("resolves relative Playwright screenshots from the managed output directory", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-codex-source-"));
  const output = path.join(workspace, ".wechat-codex-screenshots");
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, "shot.png"), "png");
  assert.equal(resolveScreenshotSource("shot.png", workspace), path.join(output, "shot.png"));
  fs.rmSync(workspace, { recursive: true, force: true });
});
