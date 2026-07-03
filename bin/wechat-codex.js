#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { commandName, escapeXml, getStateDir } from "../src/platform.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const runValue = "WeChatCodexBridge";
const launchLabel = "io.github.lackofagility.wechat-codex-bridge";
const stateDir = getStateDir();
const daemonPath = path.join(projectRoot, "scripts", "daemon.js");
const nodeServiceMarker = path.join(projectRoot, ".node-service-enabled");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: "inherit", windowsHide: true, ...options });
  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
  return result;
}

function stopPid() {
  const pidPath = path.join(stateDir, "daemon.pid");
  if (!fs.existsSync(pidPath)) return;
  const pid = Number.parseInt(fs.readFileSync(pidPath, "utf8"), 10);
  if (Number.isInteger(pid)) { try { process.kill(pid, "SIGTERM"); } catch {} }
}

function installWindows() {
  const taskCommand = `\"${process.execPath}\" \"${daemonPath}\"`;
  run("reg.exe", ["ADD", runKey, "/V", runValue, "/T", "REG_SZ", "/D", taskCommand, "/F"]);
  fs.writeFileSync(nodeServiceMarker, "managed by bin/wechat-codex.js\n", "utf8");
  stopPid();
  fs.mkdirSync(stateDir, { recursive: true });
  const logFd = fs.openSync(path.join(stateDir, "supervisor.log"), "a");
  const child = spawn(process.execPath, [daemonPath], {
    cwd: projectRoot,
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  fs.closeSync(logFd);
}

function plistPath() {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${launchLabel}.plist`);
}

function installMac() {
  const plist = plistPath();
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  const log = path.join(stateDir, "supervisor.log");
  fs.writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${launchLabel}</string>
  <key>ProgramArguments</key><array><string>${escapeXml(process.execPath)}</string><string>${escapeXml(daemonPath)}</string></array>
  <key>WorkingDirectory</key><string>${escapeXml(projectRoot)}</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${escapeXml(log)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(log)}</string>
</dict></plist>\n`, "utf8");
  const domain = `gui/${process.getuid()}`;
  run("launchctl", ["bootout", domain, plist], { allowFailure: true });
  run("launchctl", ["bootstrap", domain, plist]);
  run("launchctl", ["kickstart", "-k", `${domain}/${launchLabel}`]);
}

function install() {
  if (process.platform === "win32") installWindows();
  else if (process.platform === "darwin") installMac();
  else throw new Error("Automatic background service installation currently supports Windows and macOS.");
  console.log(`Installed and started. State: ${stateDir}`);
}

function uninstall() {
  stopPid();
  if (process.platform === "win32") {
    run("reg.exe", ["DELETE", runKey, "/V", runValue, "/F"], { allowFailure: true });
    try { fs.unlinkSync(nodeServiceMarker); } catch {}
  } else if (process.platform === "darwin") {
    const plist = plistPath();
    run("launchctl", ["bootout", `gui/${process.getuid()}`, plist], { allowFailure: true });
    try { fs.unlinkSync(plist); } catch {}
  }
  console.log("Background service removed. Credentials and memory were preserved.");
}

function status() {
  if (process.platform === "win32") run("reg.exe", ["QUERY", runKey, "/V", runValue], { allowFailure: true });
  else if (process.platform === "darwin") run("launchctl", ["print", `gui/${process.getuid()}/${launchLabel}`], { allowFailure: true });
  const pidPath = path.join(stateDir, "daemon.pid");
  console.log(fs.existsSync(pidPath) ? `Daemon PID: ${fs.readFileSync(pidPath, "utf8").trim()}` : "Daemon PID: not running");
  console.log(`Log: ${path.join(stateDir, "bridge.log")}`);
}

function setup() {
  if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22 or newer is required.");
  run(commandName("codex"), ["login", "status"]);
  const configPath = path.join(projectRoot, "config.json");
  if (!fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "config.example.json"), "utf8"));
    const workspaceIndex = process.argv.indexOf("--workspace");
    config.workspace = path.resolve(workspaceIndex >= 0 ? process.argv[workspaceIndex + 1] : projectRoot);
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }
  const accounts = path.join(os.homedir(), ".openclaw", "openclaw-weixin", "accounts.json");
  if (!fs.existsSync(accounts)) {
    console.log("Opening Tencent's official WeChat QR login...");
    run(commandName("npx"), ["-y", "@tencent-weixin/openclaw-weixin-cli@latest", "install"]);
  }
  run(process.execPath, [path.join(projectRoot, "scripts", "import-openclaw-credentials.js")]);
  install();
}

const command = process.argv[2] || "help";
try {
  if (command === "setup") setup();
  else if (command === "install" || command === "start") install();
  else if (command === "status") status();
  else if (command === "uninstall") uninstall();
  else {
    console.log("Usage: wechat-codex <setup|install|status|uninstall> [--workspace PATH]");
    process.exitCode = command === "help" ? 0 : 1;
  }
} catch (error) {
  console.error(`wechat-codex: ${error.message}`);
  process.exitCode = 1;
}
