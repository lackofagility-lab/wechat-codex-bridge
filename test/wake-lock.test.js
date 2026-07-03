import assert from "node:assert/strict";
import test from "node:test";
import { acquireWakeLock } from "../src/wake-lock.js";

test("uses caffeinate only for the lifetime of the macOS service", async () => {
  let invocation;
  let killed = false;
  const release = await acquireWakeLock({
    platform: "darwin",
    pid: 42,
    spawnImpl(command, args, options) {
      invocation = { command, args, options };
      return { unref() {}, kill() { killed = true; } };
    },
  });
  assert.equal(invocation.command, "/usr/bin/caffeinate");
  assert.deepEqual(invocation.args, ["-i", "-w", "42"]);
  release();
  assert.equal(killed, true);
});

test("sets and releases the Windows execution-state wake lock", async () => {
  const calls = [];
  const release = await acquireWakeLock({
    platform: "win32",
    loadKoffi: async () => ({
      load() {
        return { func() { return (flags) => { calls.push(flags); return 1; }; } };
      },
    }),
  });
  release();
  release();
  assert.deepEqual(calls, [0x80000001, 0x80000000]);
});
