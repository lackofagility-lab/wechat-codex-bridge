import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexClient } from "./codex-client.js";
import { AccessStore } from "./access-store.js";
import { MemoryStore } from "./memory-store.js";
import { SessionStore, readJson, writeJsonAtomic } from "./store.js";
import { WechatClient } from "./wechat-client.js";
import { getStateDir } from "./platform.js";
import { isRetryableCodexError, userFacingCodexError } from "./error-policy.js";
import { commandReply } from "./commands.js";
import { isBrowserAutomationScope, isComputerUseRetry, isWebAutomationRequest, playwrightScope } from "./task-routing.js";
import { acquireWakeLock } from "./wake-lock.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = getStateDir();
const configPath = process.env.WECHAT_CODEX_CONFIG || path.join(projectRoot, "config.json");
const credentialsPath = path.join(stateDir, "credentials.json");
const sessionsPath = path.join(stateDir, "sessions.json");
const syncPath = path.join(stateDir, "sync.json");
const memoryPath = path.join(stateDir, "memory.json");
const accessPath = path.join(stateDir, "access.json");
const logPath = path.join(stateDir, "bridge.log");
const maxLogBytes = 5 * 1024 * 1024;
const instanceLockPort = 47653;
const defaultMacComputerUseAppAliases = {
  "safari": "Safari", "notes": "Notes", "备忘录": "Notes",
  "textedit": "TextEdit", "文本编辑": "TextEdit",
  "finder": "Finder", "访达": "Finder",
  "preview": "Preview", "预览": "Preview",
  "calculator": "Calculator", "计算器": "Calculator",
  "pages": "Pages", "numbers": "Numbers", "keynote": "Keynote",
  "chrome": "Google Chrome", "google": "Google Chrome",
};

function log(message, error = null) {
  fs.mkdirSync(stateDir, { recursive: true });
  try {
    if (fs.statSync(logPath).size >= maxLogBytes) {
      fs.rmSync(`${logPath}.1`, { force: true });
      fs.renameSync(logPath, `${logPath}.1`);
    }
  } catch (rotateError) {
    if (rotateError?.code !== "ENOENT") console.error(`log rotation failed: ${rotateError.message}`);
  }
  const cause = error?.cause ? `\nCaused by: ${error.cause.stack ?? error.cause}` : "";
  const suffix = error ? ` ${error.stack ?? error}${cause}` : "";
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
  console.log(message);
}

function cleanupManagedScreenshot(source) {
  if (typeof source !== "string" || /^data:|^https?:/i.test(source)) return;
  let localPath;
  try {
    localPath = /^file:\/\//i.test(source)
      ? fileURLToPath(source)
      : path.resolve(config.workspace, source);
  } catch { return; }
  const relative = path.relative(managedScreenshotDir, localPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return;
  try { fs.rmSync(localPath, { force: true }); }
  catch (error) { log(`managed screenshot cleanup failed path=${localPath}`, error); }
}

function loadConfig() {
  return readJson(configPath, {
    workspace: projectRoot,
    model: null,
    modelProvider: null,
    sandbox: "workspace-write",
    thinking: "medium",
    progressUpdates: true,
    pollTimeoutMs: 40000,
    codexTimeoutMs: 180000,
    memoryRecentTurns: 30,
    allowedUserIds: [],
    computerUseEnabled: true,
    autoApproveLowRiskComputerUse: true,
    autoApproveHighRiskComputerUseApps: false,
    computerUseScreenshots: true,
    computerUseMaxScreenshots: 3,
    browserAutomationFallback: true,
    preventSystemSleep: true,
    computerUseAppAliases: {
      "记事本": "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
      "notepad": "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
      "google": "Chrome", "谷歌": "Chrome", "chrome": "Chrome",
      "浏览器": "Chrome", "youtube": "Chrome", "油管": "Chrome",
      "word": "Microsoft.Office.WINWORD.EXE.15",
      "excel": "Microsoft.Office.EXCEL.EXE.15",
      "powerpoint": "Microsoft.Office.POWERPNT.EXE.15",
      "ppt": "Microsoft.Office.POWERPNT.EXE.15",
      "计算器": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
      "calculator": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
      "时钟": "Microsoft.WindowsAlarms_8wekyb3d8bbwe!App",
      "clock": "Microsoft.WindowsAlarms_8wekyb3d8bbwe!App",
      "docker": "Docker.DockerForWindows.Settings",
    },
    macComputerUseAppAliases: defaultMacComputerUseAppAliases,
  });
}

async function acquireInstanceLock() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(instanceLockPort, "127.0.0.1", resolve);
  });
  return server;
}

let instanceLock;
try {
  instanceLock = await acquireInstanceLock();
} catch (error) {
  if (error?.code === "EADDRINUSE") process.exit(0);
  throw error;
}

const config = loadConfig();
const managedScreenshotDir = path.resolve(config.workspace, ".wechat-codex-screenshots");
const credentials = readJson(credentialsPath, null);
if (!credentials?.token || !credentials?.baseUrl) {
  throw new Error(`Missing WeChat credentials: ${credentialsPath}`);
}

const wechat = new WechatClient({
  baseUrl: credentials.baseUrl,
  token: credentials.token,
  pollTimeoutMs: config.pollTimeoutMs,
});
const codex = new CodexClient({
  workspace: config.workspace,
  model: config.model,
  modelProvider: config.modelProvider,
  sandbox: config.sandbox,
  thinking: config.thinking,
  timeoutMs: config.codexTimeoutMs,
  autoApproveLowRiskComputerUse: config.autoApproveLowRiskComputerUse !== false,
  autoApproveHighRiskComputerUseApps: config.autoApproveHighRiskComputerUseApps === true,
  computerUseMaxScreenshots: config.computerUseScreenshots === false
    ? 0
    : (config.computerUseMaxScreenshots ?? 3),
  browserAutomationFallback: config.browserAutomationFallback !== false,
});
const sessions = new SessionStore(sessionsPath);
const access = new AccessStore(accessPath, config.allowedUserIds ?? []);
const memory = new MemoryStore({
  filePath: memoryPath,
  workspace: config.workspace,
  maxTurns: config.memoryRecentTurns ?? 30,
  computerUseEnabled: config.computerUseEnabled !== false,
});
let syncBuffer = readJson(syncPath, { get_updates_buf: "" }).get_updates_buf ?? "";
let stopping = false;
let releaseWakeLock = () => {};

function approvedComputerUseApp(text) {
  if (config.computerUseEnabled === false) return null;
  const normalized = text.toLowerCase();
  const aliases = process.platform === "darwin"
    ? (config.macComputerUseAppAliases ?? defaultMacComputerUseAppAliases)
    : config.computerUseAppAliases;
  for (const [alias, appId] of Object.entries(aliases ?? {})) {
    if (normalized.includes(alias.toLowerCase())) return appId;
  }
  return null;
}

async function handleMessage(rawMessage) {
  const message = wechat.normalize(rawMessage);
  if (!message.isUser || !message.isFinished || !message.from || !message.text) return;
  if (sessions.hasProcessed(message.id)) return;

  if (!access.isAllowed(message.from)) {
    const pairCode = String(credentials.pairingCode ?? "");
    if (!pairCode || message.text.trim() !== `/pair ${pairCode}`) {
      log(`unauthorized message ignored id=${message.id} user=${message.from}`);
      sessions.markProcessed(message.id);
      return;
    }
    access.add(message.from);
    await wechat.sendText({
      to: message.from,
      text: "配对成功。现在只有已授权的微信用户可以使用此 Codex。",
      contextToken: message.contextToken,
      clientId: `codex-paired-${message.id}`,
    });
    sessions.markProcessed(message.id);
    log(`user paired user=${message.from}`);
    return true;
  }

  log(`message received id=${message.id} user=${message.from}`);
  const directReply = commandReply(message.text, message.from, sessions);
  if (!directReply && sessions.isInFlight(message.id)) {
    await wechat.sendText({
      to: message.from,
      text: "上次处理被电脑重启或服务中断。为避免重复执行操作，我没有自动重做；请确认电脑当前状态后发送“重试”。",
      contextToken: message.contextToken,
      clientId: `codex-interrupted-${message.id}`,
    });
    sessions.markProcessed(message.id);
    log(`interrupted message suppressed id=${message.id}`);
    return true;
  }
  if (!directReply) sessions.markInFlight(message.id);
  try {
    let reply = directReply;
    let rememberTurn = false;
    let screenshots = [];
    if (!reply) {
      const existingThread = sessions.getThread(message.from);
      const progressEnabled = sessions.getProgressEnabled(
        message.from,
        config.progressUpdates !== false,
      );
      if (progressEnabled && !sessions.hasAcknowledged(message.id)) {
        await wechat.sendText({
          to: message.from,
          text: "收到，Codex 正在处理…",
          contextToken: message.contextToken,
          clientId: `codex-ack-${message.id}`,
        });
        sessions.markAcknowledged(message.id);
      }
      let result;
      let lastError;
      const requestedApp = approvedComputerUseApp(message.text);
      const approvedApp = requestedApp || (
        isComputerUseRetry(message.text) ? sessions.getApprovedComputerUseApp(message.from) : null
      );
      if (requestedApp) sessions.setApprovedComputerUseApp(message.from, requestedApp);
      const useBrowserBackend = config.browserAutomationFallback !== false && (
        isWebAutomationRequest(message.text) ||
        (isComputerUseRetry(message.text) && isBrowserAutomationScope(approvedApp))
      );
      if (useBrowserBackend) sessions.setApprovedComputerUseApp(message.from, requestedApp || approvedApp || playwrightScope);
      log(`desktop scope id=${message.id} requested=${requestedApp ?? "none"} active=${approvedApp ?? "none"} backend=${useBrowserBackend ? "playwright" : approvedApp ? "computer-use" : "none"}`);
      codex.setApprovedComputerUseApp(useBrowserBackend ? null : approvedApp);
      const maxAttempts = approvedApp || useBrowserBackend ? 1 : 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const platformPolicy = useBrowserBackend
            ? `This is a web-navigation task. Use the playwright MCP tools instead of desktop Computer Use because desktop browser control cannot reliably verify page URLs. Complete the user's request in the managed Chrome profile and finish by calling browser_take_screenshot without a filename so the image can be sent directly to WeChat. Do not use shell commands.\n\n`
            : approvedApp
            ? process.platform === "darwin"
              ? `Use the Peekaboo MCP tools for macOS desktop control in this turn. The explicitly approved app is ${approvedApp}; control and capture only that app window, never the full desktop. This Computer Use turn MUST finish by taking a fresh screenshot of the approved app so it can be sent to WeChat. Ask before sending, deleting, installing, submitting, purchasing, changing accounts, or transmitting sensitive data. Do not use AppleScript or shell input automation.\n\n`
              : `Use the installed Computer Use skill for the explicitly approved Windows app ${approvedApp}. This Computer Use turn MUST finish by taking a fresh screenshot of that app so it can be sent to WeChat. Follow the Computer Use confirmation policy and do not substitute PowerShell or SendKeys.\n\n`
            : "";
          const prompt = memory.buildPrompt(message.from, message.text) + "\n\n" + platformPolicy;
          result = await codex.run(prompt, existingThread, { captureScreenshots: Boolean(approvedApp || useBrowserBackend) });
          break;
        } catch (error) {
          lastError = error;
          log(`codex attempt ${attempt}/${maxAttempts} failed id=${message.id}`, error);
          if (!isRetryableCodexError(error)) break;
          if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        }
      }
      if (!result) throw lastError;
      if ((approvedApp || useBrowserBackend) && config.computerUseScreenshots !== false && !(result.screenshots?.length)) {
        log(`automation produced no screenshot; requesting final capture id=${message.id}`);
        const capturePrompt = useBrowserBackend
          ? "Use playwright browser_take_screenshot without a filename to capture the current managed browser page and return the image directly. Do not change the page."
          : process.platform === "darwin"
          ? `Use Peekaboo to take one fresh, read-only screenshot of only the approved ${approvedApp} app window. Do not change the UI or capture the full desktop.`
          : `Use the installed Computer Use skill to take one fresh, read-only screenshot of the approved ${approvedApp} app. Do not change the UI. You must actually call the screenshot/snapshot tool.`;
        try {
          const capture = await codex.run(capturePrompt, result.threadId || existingThread, { captureScreenshots: true });
          if (capture.threadId) result.threadId = capture.threadId;
          result.screenshots = capture.screenshots ?? [];
        } catch (error) {
          log(`final screenshot capture failed id=${message.id}`, error);
          result.screenshots = [];
        }
        if (!result.screenshots.length) result.text += "\n\n（任务已完成，但截图通道没有返回图像。）";
      }
      if (result.threadId) sessions.setThread(message.from, result.threadId);
      reply = result.text;
      screenshots = result.screenshots ?? [];
      rememberTurn = true;
    }
    await wechat.sendText({
      to: message.from,
      text: reply,
      contextToken: message.contextToken,
      clientId: `codex-reply-${message.id}`,
    });
    let screenshotFailures = 0;
    for (const [index, source] of screenshots.entries()) {
      try {
        await wechat.sendImage({
          to: message.from,
          source,
          contextToken: message.contextToken,
          clientId: `codex-shot-${message.id}-${index}`,
        });
        log(`screenshot sent id=${message.id} index=${index}`);
      } catch (error) {
        screenshotFailures += 1;
        log(`screenshot failed id=${message.id} index=${index}`, error);
      } finally {
        cleanupManagedScreenshot(source);
      }
    }
    if (screenshotFailures) {
      await wechat.sendText({
        to: message.from,
        text: screenshotFailures === screenshots.length
          ? "任务已完成，但截图发送失败。"
          : `任务已完成，但有 ${screenshotFailures} 张截图发送失败。`,
        contextToken: message.contextToken,
        clientId: `codex-shot-error-${message.id}`,
      }).catch((sendError) => log("failed to send screenshot error", sendError));
    }
    sessions.markProcessed(message.id);
    if (rememberTurn) {
      try { memory.remember(message.from, message.text, reply); }
      catch (error) { log(`memory update failed id=${message.id}`, error); }
    }
    log(`reply sent id=${message.id}`);
    return true;
  } catch (error) {
    log(`message failed id=${message.id}`, error);
    try {
      await wechat.sendText({
        to: message.from,
        text: userFacingCodexError(error),
        contextToken: message.contextToken,
        clientId: `codex-error-${message.id}`,
      });
      sessions.markProcessed(message.id);
      return true;
    } catch (sendError) {
      log("failed to send error reply", sendError);
      throw error;
    }
  }
}

const codexReady = (async () => {
  await codex.start();
  log("codex connection ready");
})().catch((error) => {
  log("codex connection initialization failed; first user turn will retry", error);
});

async function main() {
  if (config.preventSystemSleep !== false) {
    try {
      releaseWakeLock = await acquireWakeLock();
      log("idle system sleep prevention enabled");
    } catch (error) {
      log("could not prevent idle system sleep; continuing without wake lock", error);
    }
  }
  await wechat.notifyStart().catch((error) => log("notifyStart failed", error));
  log(`bridge started workspace=${config.workspace}`);
  let consecutivePollFailures = 0;
  while (!stopping) {
    try {
      const update = await wechat.getUpdates(syncBuffer);
      if (update.errcode === -14) throw new Error("WeChat authorization expired; reconnect required");
      if (update.ret != null && update.ret !== 0) throw new Error(`WeChat API ret=${update.ret}: ${update.errmsg ?? ""}`);
      for (const message of update.msgs ?? []) await handleMessage(message);
      if (typeof update.get_updates_buf === "string") {
        syncBuffer = update.get_updates_buf;
        writeJsonAtomic(syncPath, { get_updates_buf: syncBuffer });
      }
      consecutivePollFailures = 0;
    } catch (error) {
      consecutivePollFailures += 1;
      if (consecutivePollFailures === 1 || consecutivePollFailures % 10 === 0) {
        log(`poll failed (${consecutivePollFailures} consecutive)`, error);
      }
      const backoffMs = Math.min(30000, 1000 * (2 ** Math.min(consecutivePollFailures, 5)));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

async function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`stopping (${signal})`);
  await wechat.notifyStop().catch(() => {});
  releaseWakeLock();
  codex.stop();
  process.exit(0);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("uncaughtException", (error) => {
  log("uncaught exception; exiting for service restart", error);
  releaseWakeLock();
  codex.stop();
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  log("unhandled rejection; exiting for service restart", error);
  releaseWakeLock();
  codex.stop();
  process.exit(1);
});

await main();
