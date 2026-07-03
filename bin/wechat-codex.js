#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { commandName, escapeXml, getStateDir } from "../src/platform.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRequire = createRequire(import.meta.url);
const runKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const runValue = "WeChatCodexBridge";
const launchLabel = "io.github.lackofagility.wechat-codex-bridge";
const stateDir = getStateDir();
const daemonPath = path.join(projectRoot, "scripts", "daemon.js");
const nodeServiceMarker = path.join(projectRoot, ".node-service-enabled");
const legacyTaskDisabledMarker = path.join(projectRoot, ".legacy-task-disabled");
const legacyWindowsTask = "WeChat Codex Bridge";
const maxLogBytes = 5 * 1024 * 1024;

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

function rotateLog(filePath) {
  try {
    if (fs.statSync(filePath).size < maxLogBytes) return;
    fs.rmSync(`${filePath}.1`, { force: true });
    fs.renameSync(filePath, `${filePath}.1`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function installWindows() {
  const taskCommand = `\"${process.execPath}\" \"${daemonPath}\"`;
  run("reg.exe", ["ADD", runKey, "/V", runValue, "/T", "REG_SZ", "/D", taskCommand, "/F"]);
  fs.writeFileSync(nodeServiceMarker, "managed by bin/wechat-codex.js\n", "utf8");
  // Old releases installed a minute-by-minute PowerShell task. It may be
  // protected by Windows and impossible to remove without elevation, so keep
  // an independent tombstone that remains effective even after uninstall.
  fs.writeFileSync(legacyTaskDisabledMarker, "legacy scheduled task disabled\n", "utf8");
  run("schtasks.exe", ["/End", "/TN", legacyWindowsTask], { allowFailure: true, stdio: "ignore" });
  run("schtasks.exe", ["/Delete", "/TN", legacyWindowsTask, "/F"], { allowFailure: true, stdio: "ignore" });
  stopPid();
  fs.mkdirSync(stateDir, { recursive: true });
  const supervisorLog = path.join(stateDir, "supervisor.log");
  rotateLog(supervisorLog);
  const logFd = fs.openSync(supervisorLog, "a");
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
  rotateLog(log);
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
    // Best effort: upgraded users can have a protected v1.0 task. Never
    // remove the tombstone, because that would let the task resurrect the old
    // service after an otherwise successful uninstall.
    fs.writeFileSync(legacyTaskDisabledMarker, "legacy scheduled task disabled\n", "utf8");
    run("schtasks.exe", ["/End", "/TN", legacyWindowsTask], { allowFailure: true, stdio: "ignore" });
    run("schtasks.exe", ["/Delete", "/TN", legacyWindowsTask, "/F"], { allowFailure: true, stdio: "ignore" });
  } else if (process.platform === "darwin") {
    const plist = plistPath();
    run("launchctl", ["bootout", `gui/${process.getuid()}`, plist], { allowFailure: true });
    try { fs.unlinkSync(plist); } catch {}
  }
  console.log("Background service removed. Credentials and memory were preserved.");
}

function status() {
  let autostart = null;
  if (process.platform === "win32") {
    autostart = run("reg.exe", ["QUERY", runKey, "/V", runValue], { allowFailure: true, stdio: "ignore" }).status === 0;
  } else if (process.platform === "darwin") {
    autostart = run("launchctl", ["print", `gui/${process.getuid()}/${launchLabel}`], { allowFailure: true, stdio: "ignore" }).status === 0;
  }
  if (autostart !== null) console.log(`Autostart: ${autostart ? "installed" : "not installed"}`);
  const pidPath = path.join(stateDir, "daemon.pid");
  const pid = fs.existsSync(pidPath) ? Number.parseInt(fs.readFileSync(pidPath, "utf8"), 10) : null;
  let alive = false;
  if (Number.isInteger(pid)) {
    try { process.kill(pid, 0); alive = true; } catch {}
  }
  console.log(alive ? `Daemon: running (PID ${pid})` : "Daemon: not running");
  const packageInfo = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  console.log(`Version: ${packageInfo.version}`);
  const configPath = path.join(projectRoot, "config.json");
  let parsedConfig = null;
  try {
    parsedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log(`Config: valid (${configPath})`);
  } catch (error) {
    console.log(`Config: INVALID (${error.message})`);
    process.exitCode = 1;
  }
  if (parsedConfig) console.log(`Idle sleep prevention: ${parsedConfig.preventSystemSleep === false ? "disabled" : "enabled"}`);
  const credentialsPath = path.join(stateDir, "credentials.json");
  let credentialsReady = false;
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    credentialsReady = Boolean(credentials.token && credentials.baseUrl);
  } catch {}
  console.log(`Credentials: ${credentialsReady ? "valid" : "missing or invalid"}`);
  const logPath = path.join(stateDir, "bridge.log");
  console.log(`Log: ${logPath}`);
  if (fs.existsSync(logPath)) {
    const recent = fs.readFileSync(logPath, "utf8").trim().split(/\r?\n/)
      .filter((line) => /^\d{4}-\d{2}-\d{2}T/.test(line)).slice(-5);
    console.log("Recent bridge events:");
    for (const line of recent) console.log(`  ${line}`);
  }
  if (!alive) process.exitCode = 1;
  if (!credentialsReady) process.exitCode = 1;
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
  const setupConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (setupConfig.preventSystemSleep !== false) {
    console.log("Idle system sleep prevention is enabled while the bridge runs. Display-off and lock still work; set preventSystemSleep=false to disable it.");
  }
  const accounts = path.join(os.homedir(), ".openclaw", "openclaw-weixin", "accounts.json");
  if (!fs.existsSync(accounts)) {
    console.log("Opening Tencent's official WeChat QR login...");
    run(commandName("npx"), ["-y", "@tencent-weixin/openclaw-weixin-cli@latest", "install"]);
  }
  run(process.execPath, [path.join(projectRoot, "scripts", "import-openclaw-credentials.js")]);
  const browserSmoke = run(process.execPath, [path.join(projectRoot, "scripts", "smoke-playwright.js")], { allowFailure: true });
  if (browserSmoke.status !== 0) {
    console.warn("Browser automation self-test failed. Chat and desktop tasks can still work; install Google Chrome or set browserAutomationFallback=false.");
  }
  if (process.platform === "darwin") {
    try { packageRequire.resolve("@steipete/peekaboo"); }
    catch { throw new Error("macOS desktop backend is missing. Run npm install again, then retry setup."); }
    console.log("macOS desktop control uses @steipete/peekaboo through MCP.");
    console.log("On first use, approve the terminal/Codex host in System Settings > Privacy & Security > Accessibility and Screen Recording.");
  }
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
