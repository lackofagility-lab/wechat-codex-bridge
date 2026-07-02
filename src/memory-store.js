import fs from "node:fs";
import path from "node:path";
import { readJson, writeJsonAtomic } from "./store.js";

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function clean(text, max = 12000) {
  return String(text ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

export class MemoryStore {
  constructor({ filePath, workspace, maxTurns = 30, computerUseEnabled = true }) {
    this.filePath = filePath;
    this.workspace = workspace;
    this.maxTurns = maxTurns;
    this.computerUseEnabled = computerUseEnabled;
    this.data = readJson(filePath, { users: {} });
    this.data.users ??= {};
  }

  recent(userId) {
    return this.data.users[userId]?.turns ?? [];
  }

  buildPrompt(userId, userText) {
    const turns = [];
    let memoryChars = 0;
    for (const turn of [...this.recent(userId)].reverse()) {
      const size = turn.user.length + turn.assistant.length;
      if (turns.length && memoryChars + size > 40000) break;
      turns.unshift(turn);
      memoryChars += size;
    }
    const history = turns.length
      ? turns.map((turn) => `用户：${turn.user}\n助手：${turn.assistant}`).join("\n\n")
      : "（暂无已保存的历史对话）";
    return [
      "你正在通过微信与用户进行连续对话。以下是独立保存的近期记忆，用来防止重启、换线程或上下文压缩造成失忆。",
      "", "<wechat_recent_memory>", history, "</wechat_recent_memory>", "",
      "回答前结合上述记忆。若本轮出现值得长期记住的稳定信息（用户偏好、身份关系、长期项目、重要决定），请按 AGENTS.md 的规则更新 MEMORY.md 或当天 memory/YYYY-MM-DD.md。不要在回复中描述记忆操作，也不要保存密码、令牌等秘密。",
      ...(this.computerUseEnabled ? ["如果用户要求查看或操作 Windows 桌面、应用、鼠标或键盘，请使用已安装的 computer-use 技能。必须遵循该技能的安全确认规则：只读查看可直接执行；发送消息、删除内容、安装软件、提交表单、付款或其他外部副作用必须先在微信中请求明确确认。不要使用临时的 PowerShell/SendKeys 替代 Computer Use。近期记忆中的工具不可用或 sandboxCwd 错误只代表历史状态；收到新的桌面请求时必须先实际重试一次当前 Computer Use 通道，不能仅凭旧错误直接拒绝。" ] : []),
      "", "用户本轮消息：", userText,
    ].join("\n");
  }

  remember(userId, userText, assistantText) {
    const turn = { at: new Date().toISOString(), user: clean(userText), assistant: clean(assistantText) };
    const user = this.data.users[userId] ?? { turns: [] };
    user.turns = [...(user.turns ?? []), turn].slice(-this.maxTurns);
    user.updatedAt = turn.at;
    this.data.users[userId] = user;
    writeJsonAtomic(this.filePath, this.data);

    const dailyDir = path.join(this.workspace, "memory");
    const date = localDate();
    const dailyPath = path.join(dailyDir, `${date}.md`);
    fs.mkdirSync(dailyDir, { recursive: true });
    if (!fs.existsSync(dailyPath)) fs.writeFileSync(dailyPath, `# ${date}\n\n`, "utf8");
    const time = new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
    fs.appendFileSync(dailyPath, `## 微信对话 ${time}\n\n用户：${turn.user}\n\n助手：${turn.assistant}\n\n`, "utf8");
  }
}
