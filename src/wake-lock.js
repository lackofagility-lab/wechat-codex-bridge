import { spawn } from "node:child_process";

const ES_CONTINUOUS = 0x80000000;
const ES_SYSTEM_REQUIRED = 0x00000001;

export async function acquireWakeLock({
  platform = process.platform,
  pid = process.pid,
  spawnImpl = spawn,
  loadKoffi = () => import("koffi"),
} = {}) {
  if (platform === "win32") {
    const imported = await loadKoffi();
    const koffi = imported.default ?? imported;
    const kernel32 = koffi.load("kernel32.dll");
    const setThreadExecutionState = kernel32.func("uint32 SetThreadExecutionState(uint32 esFlags)");
    const result = setThreadExecutionState((ES_CONTINUOUS | ES_SYSTEM_REQUIRED) >>> 0);
    if (!result) throw new Error("SetThreadExecutionState failed");
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setThreadExecutionState(ES_CONTINUOUS);
    };
  }
  if (platform === "darwin") {
    const child = spawnImpl("/usr/bin/caffeinate", ["-i", "-w", String(pid)], {
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref?.();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      try { child.kill(); } catch {}
    };
  }
  return () => {};
}
