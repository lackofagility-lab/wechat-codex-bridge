import assert from "node:assert/strict";
import test from "node:test";
import { terminateProcessTree } from "../src/process-tree.js";

test("terminates the direct child on POSIX", () => {
  let receivedSignal;
  const child = {
    pid: 123,
    exitCode: null,
    kill(signal) { receivedSignal = signal; },
  };
  terminateProcessTree(child, "SIGINT", "darwin");
  assert.equal(receivedSignal, "SIGINT");
});

test("does not terminate an already exited child", () => {
  const child = {
    pid: 123,
    exitCode: 0,
    kill() { throw new Error("should not be called"); },
  };
  assert.doesNotThrow(() => terminateProcessTree(child, "SIGTERM", "darwin"));
});
