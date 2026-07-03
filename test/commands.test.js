import assert from "node:assert/strict";
import test from "node:test";
import { commandReply } from "../src/commands.js";

function sessions(thread = null) {
  return {
    thread,
    progress: true,
    getThread() { return this.thread; },
    resetThread() { this.thread = null; },
    setProgressEnabled(_user, value) { this.progress = value; },
  };
}

test("status hides internal thread ids", () => {
  const store = sessions("019f-secret-internal-id");
  const reply = commandReply("/status", "alice", store);
  assert.equal(reply, "Codex 已连接，当前会话可以继续。");
  assert.equal(reply.includes("019f"), false);
});

test("progress and reset commands update session state", () => {
  const store = sessions("thread");
  commandReply("/progress off", "alice", store);
  assert.equal(store.progress, false);
  commandReply("/new", "alice", store);
  assert.equal(store.thread, null);
});
