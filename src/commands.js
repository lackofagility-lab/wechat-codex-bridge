export function commandReply(text, userId, sessions) {
  const command = text.trim().toLowerCase();
  if (command === "/new" || command === "/reset") {
    sessions.resetThread(userId);
    return "已创建新的 Codex 会话。";
  }
  if (command === "/status") {
    return sessions.getThread(userId)
      ? "Codex 已连接，当前会话可以继续。"
      : "Codex 已连接，下一条消息将创建新会话。";
  }
  if (command === "/progress on") {
    sessions.setProgressEnabled(userId, true);
    return "已开启“正在处理”提示。隐藏思考过程不会发送到微信。";
  }
  if (command === "/progress off") {
    sessions.setProgressEnabled(userId, false);
    return "已关闭“正在处理”提示。";
  }
  if (command === "/help") {
    return "命令：/new 新会话；/status 查看连接；/progress on|off 开关处理提示；/help 查看帮助。";
  }
  return null;
}
