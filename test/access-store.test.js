import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AccessStore } from "../src/access-store.js";

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
