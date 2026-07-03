import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getStateDir } from "../src/platform.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = getStateDir();
const pidPath = path.join(stateDir, "daemon.pid");
let child;
let stopping = false;

fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(pidPath, `${process.pid}\n`, "utf8");

function launch() {
  const service = path.join(projectRoot, "src", "service.js");
  child = spawn(process.execPath, [service], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.once("exit", (code, signal) => {
    child = undefined;
    if (stopping) return;
    console.error(`Bridge exited (${signal || code}); restarting in 5 seconds.`);
    setTimeout(launch, 5000);
  });
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (child && !child.killed) child.kill(signal);
  try { fs.unlinkSync(pidPath); } catch {}
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("exit", () => { try { fs.unlinkSync(pidPath); } catch {} });
launch();
