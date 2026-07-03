import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableCodexError, userFacingCodexError } from "../src/error-policy.js";

test("does not retry usage or authentication failures", () => {
  assert.equal(isRetryableCodexError(new Error("You've hit your usage limit. Try again at 9:03 PM.")), false);
  assert.equal(isRetryableCodexError(new Error("Login required")), false);
  assert.equal(isRetryableCodexError(new Error("fetch failed")), true);
});

test("retries only transport failures and never approval or policy failures", () => {
  assert.equal(isRetryableCodexError(new Error("Codex app-server exited (SIGTERM)")), true);
  assert.equal(isRetryableCodexError(new Error("Computer Use was not approved to use Notepad")), false);
  assert.equal(isRetryableCodexError(new Error("sandboxCwd must use the file URI scheme")), false);
  assert.equal(isRetryableCodexError(new Error("tool returned an unknown failure")), false);
});

test("turns usage limits into a concise Chinese reply", () => {
  assert.equal(
    userFacingCodexError(new Error("You've hit your usage limit. Try again at 9:03 PM.")),
    "Codex 使用额度已到上限，请在 9:03 PM 后再试。",
  );
});

test("returns actionable messages without exposing internal errors", () => {
  assert.match(userFacingCodexError(new Error("Computer Use was not approved to use Notepad")), /安全策略/);
  assert.match(userFacingCodexError(new Error("Codex turn timed out after 1000ms")), /没有自动重做/);
  assert.doesNotMatch(userFacingCodexError(new Error("secret internal stack value")), /secret internal/);
});
