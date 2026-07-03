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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stateDir = getStateDir();
const configPath = process.env.WECHAT_CODEX_CONFIG || path.join(projectRoot, "config.json");
const credentialsPath = path.join(stateDir, "credentials.json");
const sessionsPath = path.join(stateDir, "sessions.json");
const syncPath = path.join(stateDir, "sync.json");
const memoryPath = path.join(stateDir, "memory.json");
const accessPath = path.join(stateDir, "access.json");
const logPath = path.join(stateDir, "bridge.log");
const instanceLockPort = 47653;

function log(message, error = null) {
  fs.mkdirSync(stateDir, { recursive: true });
  const cause = error?.cause ? `\nCaused by: ${error.cause.stack ?? error.cause}` : "";
  const suffix = error ? ` ${error.stack ?? error}${cause}` : "";
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
  console.log(message);
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
    computerUseAppAliases: {
      "记事本": "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
      "notepad": "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
      "google": "Chrome",
      "谷歌": "Chrome",
      "chrome": "Chrome",
      "浏览器": "Chrome",
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

function commandReply(text, userId, sessions) {
  const command = text.trim().toLowerCase();
  if (command === "/new" || command === "/reset") {
    sessions.resetThread(userId);
    return "已创建新的 Codex 会话。";
  }
  if (command === "/status") {
    const thread = sessions.getThread(userId);
    return thread ? `Codex 已连接。会话：${thread}` : "Codex 已连接，下一条消息将创建新会话。";
  }
  if (command === "/progress on") {
    sessions.setProgressEnabled(userId, true);
    return "Progress updates enabled. Hidden reasoning is never transmitted.";
  }
  if (command === "/progress off") {
    sessions.setProgressEnabled(userId, false);
    return "Progress updates disabled.";
  }
  if (command === "/help") {
    return "命令：/new 新会话；/status 查看状态；/help 查看帮助。";
  }
  return null;
}

let instanceLock;
try {
  instanceLock = await acquireInstanceLock();
} catch (error) {
  if (error?.code === "EADDRINUSE") process.exit(0);
  throw error;
}

const config = loadConfig();
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

function approvedComputerUseApp(text) {
  if (config.computerUseEnabled === false) return null;
  const normalized = text.toLowerCase();
  for (const [alias, appId] of Object.entries(config.computerUseAppAliases ?? {})) {
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
  try {
    let reply = directReply;
    let rememberTurn = false;
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
      codex.setApprovedComputerUseApp(approvedComputerUseApp(message.text));
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const prompt = memory.buildPrompt(message.from, message.text);
          result = await codexReady.then(() => codex.run(prompt, existingThread));
          break;
        } catch (error) {
          lastError = error;
          log(`codex attempt ${attempt}/3 failed id=${message.id}`, error);
          codex.restart(error);
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        }
      }
      if (!result) throw lastError;
      if (result.threadId) sessions.setThread(message.from, result.threadId);
      reply = result.text;
      rememberTurn = true;
    }
    await wechat.sendText({
      to: message.from,
      text: reply,
      contextToken: message.contextToken,
      clientId: `codex-reply-${message.id}`,
    });
    if (rememberTurn) memory.remember(message.from, message.text, reply);
    sessions.markProcessed(message.id);
    log(`reply sent id=${message.id}`);
    return true;
  } catch (error) {
    log(`message failed id=${message.id}`, error);
    await wechat.sendText({
      to: message.from,
      text: `Codex 处理失败：${error.message}`.slice(0, 1000),
      contextToken: message.contextToken,
      clientId: `codex-error-${message.id}`,
    }).catch((sendError) => log("failed to send error reply", sendError));
    throw error;
  }
}

const codexReady = (async () => {
  await codex.start();
  const warmupKey = "__bridge_warmup__";
  const result = await codex.run(
    "This is a connection warm-up. Reply with exactly READY.",
    sessions.getThread(warmupKey),
  );
  if (result.threadId) sessions.setThread(warmupKey, result.threadId);
  log("codex warm-up completed");
})().catch((error) => {
  log("codex warm-up failed; first user turn will retry", error);
});

async function main() {
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
  process.exit(0);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("uncaughtException", (error) => {
  log("uncaught exception; exiting for service restart", error);
  process.exit(1);
});
process.on("unhandledRejection", (error) => {
  log("unhandled rejection; exiting for service restart", error);
  process.exit(1);
});

await main();
