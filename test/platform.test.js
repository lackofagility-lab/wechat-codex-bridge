import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { commandName, escapeXml, getStateDir } from "../src/platform.js";

test("uses native per-user state directories", () => {
  assert.equal(getStateDir("win32", { APPDATA: "C:\\Users\\me\\AppData\\Roaming" }, "C:\\Users\\me"), path.join("C:\\Users\\me\\AppData\\Roaming", "wechat-codex-bridge"));
  assert.equal(getStateDir("darwin", {}, "/Users/me"), path.join("/Users/me", "Library", "Application Support", "wechat-codex-bridge"));
});

test("honors overrides and platform command names", () => {
  assert.equal(getStateDir("darwin", { WECHAT_CODEX_STATE_DIR: "/tmp/bridge" }, "/Users/me"), path.resolve("/tmp/bridge"));
  assert.equal(commandName("codex", "win32"), "codex.cmd");
  assert.equal(commandName("codex", "darwin"), "codex");
});

test("escapes launchd XML values", () => {
  assert.equal(escapeXml('a&<\"'), "a&amp;&lt;&quot;");
});
