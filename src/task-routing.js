const playwrightScope = "playwright";

export function isComputerUseRetry(text) {
  return /^(?:再试(?:一次)?|重试|继续|retry|try again|continue)[。！!\s]*$/i.test(text.trim());
}

export function isWebAutomationRequest(text) {
  const value = text.trim();
  if (/(?:https?:\/\/|www\.|youtube|油管|google|谷歌|chrome|safari|网页|网站|浏览器|website|browser)/i.test(value)) return true;
  if (/(?:搜索|search)/i.test(value) && !/(?:本地|文件|代码|项目|workspace|磁盘|电脑里|文件夹)/i.test(value)) return true;
  return false;
}

export function isBrowserAutomationScope(scope) {
  return scope === playwrightScope || /^(?:Chrome|Google Chrome|Safari)$/i.test(scope ?? "");
}

export { playwrightScope };
