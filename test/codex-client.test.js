import assert from "node:assert/strict";
import test from "node:test";
import { CodexClient, extractScreenshotSources, macComputerUseMcpArgs } from "../src/codex-client.js";

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

test("enables Peekaboo only for an explicitly approved macOS app", () => {
  assert.deepEqual(macComputerUseMcpArgs("win32", "Notes"), []);
  assert.deepEqual(macComputerUseMcpArgs("darwin", null), []);
  assert.deepEqual(macComputerUseMcpArgs("darwin", "Notes"), [
    "-c", 'mcp_servers.peekaboo.command="npx"',
    "-c", 'mcp_servers.peekaboo.args=["-y","@steipete/peekaboo"]',
  ]);
});

test("extracts and deduplicates screenshot outputs", () => {
  const dataUrl = "data:image/png;base64,aGVsbG8=";
  assert.deepEqual(extractScreenshotSources({
    type: "mcpToolCall",
    result: { content: [
      { type: "image", mimeType: "image/png", data: "aGVsbG8=" },
      { imageUrl: dataUrl },
      { screenshotPath: "/tmp/final.png" },
    ] },
  }), [dataUrl, "/tmp/final.png"]);
});
