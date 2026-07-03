export function isRetryableCodexError(error) {
  const message = String(error?.message ?? error);
  if (/(?:usage limit|quota|upgrade to pro|purchase more credits|not logged in|login required|authentication|unauthorized|invalid api key|not approved|approval|policy|sandboxCwd|file URI scheme)/i.test(message)) return false;
  return /(?:app-server exited|not writable|fetch failed|ECONNRESET|ECONNREFUSED|EPIPE|connection (?:closed|reset)|request timed out|HTTP 5\d\d|temporarily unavailable)/i.test(message);
}

export function userFacingCodexError(error) {
  const message = String(error?.message ?? error);
  if (/(?:usage limit|quota|purchase more credits)/i.test(message)) {
    const retryAt = message.match(/try again at ([^.]+(?:AM|PM))/i)?.[1];
    return retryAt
      ? `Codex 使用额度已到上限，请在 ${retryAt} 后再试。`
      : "Codex 使用额度已到上限，请稍后再试。";
  }
  if (/(?:not logged in|login required|authentication|unauthorized|invalid api key)/i.test(message)) {
    return "Codex 登录已失效，请在电脑上重新登录后再试。";
  }
  if (/(?:not approved|approval|policy)/i.test(message)) {
    return "Computer Use 被应用安全策略拦截。请在电脑端允许该应用后发送“重试”；桥接器不会绕过系统或 Codex 的安全限制。";
  }
  if (/(?:locked|lock screen|desktop is locked)/i.test(message)) {
    return "电脑当前处于锁屏状态。微信聊天仍可回复，但 Computer Use 必须在桌面解锁后才能操作应用。";
  }
  if (/(?:timed out|timeout)/i.test(message)) {
    return "这次操作超时了。为避免重复点击或输入，我没有自动重做；请查看电脑当前状态后发送“重试”。";
  }
  if (/(?:app-server exited|not writable|EPIPE|ECONNRESET|connection (?:closed|reset))/i.test(message)) {
    return "Codex 控制通道刚刚中断，后台会自动恢复。请发送“重试”。";
  }
  return "Codex 处理失败。详细原因已写入本机日志，可运行 wechat-codex status 检查。";
}
