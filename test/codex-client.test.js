import assert from "node:assert/strict";
import test from "node:test";
import { CodexClient } from "../src/codex-client.js";

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
