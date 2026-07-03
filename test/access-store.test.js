import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AccessStore } from "../src/access-store.js";
import { SessionStore } from "../src/store.js";

test("persists paired users", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-codex-access-"));
  const filePath = path.join(dir, "access.json");
  try {
    const first = new AccessStore(filePath);
    assert.equal(first.isAllowed("alice"), false);
    first.add("alice");
    assert.equal(new AccessStore(filePath).isAllowed("alice"), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("persists the last explicitly approved Computer Use app", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-codex-session-"));
  const filePath = path.join(dir, "sessions.json");
  try {
    const first = new SessionStore(filePath);
    first.setApprovedComputerUseApp("alice", "Google Chrome");
    assert.equal(new SessionStore(filePath).getApprovedComputerUseApp("alice"), "Google Chrome");
    first.resetThread("alice");
    assert.equal(first.getApprovedComputerUseApp("alice"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("persists in-flight messages and clears them only after completion", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-codex-inflight-"));
  const filePath = path.join(dir, "sessions.json");
  try {
    const first = new SessionStore(filePath);
    first.markInFlight("message-1");
    const second = new SessionStore(filePath);
    assert.equal(second.isInFlight("message-1"), true);
    second.markProcessed("message-1");
    const third = new SessionStore(filePath);
    assert.equal(third.isInFlight("message-1"), false);
    assert.equal(third.hasProcessed("message-1"), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
