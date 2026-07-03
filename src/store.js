import fs from "node:fs";
import path from "node:path";

export function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

export function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);
}

export class SessionStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = readJson(filePath, { users: {}, processedMessageIds: [], acknowledgedMessageIds: [] });
    this.data.acknowledgedMessageIds ??= [];
  }

  getThread(userId) {
    return this.data.users[userId]?.threadId ?? null;
  }

  setThread(userId, threadId) {
    this.data.users[userId] = {
      ...(this.data.users[userId] ?? {}),
      threadId,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  getApprovedComputerUseApp(userId) {
    return this.data.users[userId]?.approvedComputerUseApp ?? null;
  }

  setApprovedComputerUseApp(userId, appId) {
    this.data.users[userId] = {
      ...(this.data.users[userId] ?? {}),
      approvedComputerUseApp: appId || null,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  resetThread(userId) {
    delete this.data.users[userId];
    this.save();
  }

  getProgressEnabled(userId, fallback = true) {
    return this.data.users[userId]?.progressUpdates ?? fallback;
  }

  setProgressEnabled(userId, enabled) {
    this.data.users[userId] = {
      ...(this.data.users[userId] ?? {}),
      progressUpdates: enabled,
      updatedAt: new Date().toISOString(),
    };
    this.save();
  }

  hasProcessed(messageId) {
    return this.data.processedMessageIds.includes(String(messageId));
  }

  markProcessed(messageId) {
    const id = String(messageId);
    this.data.processedMessageIds = [
      ...this.data.processedMessageIds.filter((item) => item !== id),
      id,
    ].slice(-500);
    this.save();
  }

  hasAcknowledged(messageId) {
    return this.data.acknowledgedMessageIds.includes(String(messageId));
  }

  markAcknowledged(messageId) {
    const id = String(messageId);
    this.data.acknowledgedMessageIds = [
      ...this.data.acknowledgedMessageIds.filter((item) => item !== id),
      id,
    ].slice(-500);
    this.save();
  }

  save() {
    writeJsonAtomic(this.filePath, this.data);
  }
}
