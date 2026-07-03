import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getStateDir } from "../src/platform.js";
import { terminateProcessTree } from "../src/process-tree.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = getStateDir();
const pidPath = path.join(stateDir, "daemon.pid");
const supervisorLogPath = path.join(stateDir, "supervisor.log");
let child;
let stopping = false;

fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(pidPath, `${process.pid}\n`, "utf8");

function removeOwnPid() {
  try {
    if (Number.parseInt(fs.readFileSync(pidPath, "utf8"), 10) === process.pid) fs.unlinkSync(pidPath);
  } catch {}
}

function daemonLog(message) {
  try {
    fs.appendFileSync(supervisorLogPath, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {}
}

function launch() {
  const service = path.join(projectRoot, "src", "service.js");
  const logFd = fs.openSync(supervisorLogPath, "a");
  child = spawn(process.execPath, [service], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  fs.closeSync(logFd);
  let settled = false;
  const restart = (reason) => {
    if (settled) return;
    settled = true;
    child = undefined;
    if (stopping) return;
    daemonLog(`Bridge stopped (${reason}); restarting in 5 seconds.`);
    setTimeout(launch, 5000);
  };
  child.once("exit", (code, signal) => restart(signal || code));
  child.once("error", (error) => restart(error.message));
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  terminateProcessTree(child, signal);
  removeOwnPid();
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("exit", removeOwnPid);
launch();
