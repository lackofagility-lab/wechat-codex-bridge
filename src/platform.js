import os from "node:os";
import path from "node:path";

export function getStateDir(platform = process.platform, env = process.env, home = os.homedir()) {
  if (env.WECHAT_CODEX_STATE_DIR) return path.resolve(env.WECHAT_CODEX_STATE_DIR);
  if (platform === "win32") {
    return path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "wechat-codex-bridge");
  }
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "wechat-codex-bridge");
  }
  return path.join(env.XDG_STATE_HOME || path.join(home, ".local", "state"), "wechat-codex-bridge");
}

export function commandName(name, platform = process.platform) {
  return platform === "win32" ? `${name}.cmd` : name;
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
