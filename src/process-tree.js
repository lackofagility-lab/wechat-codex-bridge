import { spawnSync } from "node:child_process";

/** Stop a child and everything it launched. Node's child.kill() only stops the
 * direct process on Windows, leaving MCP/browser helpers orphaned. */
export function terminateProcessTree(child, signal = "SIGTERM", platform = process.platform) {
  if (!child || !Number.isInteger(child.pid) || child.exitCode !== null) return;
  if (platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (!result.error) return;
  }
  try { child.kill(signal); } catch {}
}
