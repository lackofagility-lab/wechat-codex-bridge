# 微信 Codex Bridge

把 Windows 电脑上的本地 Codex 连接到微信 ClawBot。微信消息直接交给本机 `codex app-server`，不经过 OpenClaw Agent、模型或会话系统。

## 能做什么

- 在微信里向本机 Codex 提问、处理项目和运行任务
- 配对码与用户白名单，陌生微信账号默认无权使用
- 开机自启、断线重连、进程自愈、单实例运行
- 防止重复“收到”和重复最终回复
- 保存近期对话和每日记忆，重启或换线程后继续使用
- 可选 Computer Use：控制明确点名并已配置的 Windows 应用
- 可选 `danger-full-access`：整机文件和命令权限，默认不开启

## 安装条件

- Windows 10/11
- Node.js 22+
- Git
- 已登录的 Codex CLI
- 如需桌面控制：Codex 桌面版及 Computer Use 插件
- 可使用微信 ClawBot

## 安装

```powershell
git clone https://github.com/YOUR_GITHUB_USERNAME/wechat-codex-bridge.git
cd wechat-codex-bridge
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

首次安装会调用腾讯官方工具显示微信二维码。扫码后，终端会显示 `/pair 123456`，把这条命令发送给 ClawBot 即可完成配对。

## 微信命令

- `/new` 或 `/reset`：新建 Codex 会话
- `/status`：查看连接状态
- `/progress on|off`：开关单次“正在处理”提示
- `/help`：查看命令

## Computer Use

应用必须在 `config.json` 的 `computerUseAppAliases` 中登记，并在当前微信消息中明确点名。项目不会使用全局通配符批准所有应用。聊天、密码、银行支付、相机、远程控制、安全设置、隐私浏览和云盘应用建议保持禁止。

例如：

```json
{
  "computerUseAppAliases": {
    "记事本": "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
    "google": "Chrome"
  }
}
```

## 局限

- 当前只正式支持 Windows。
- 电脑关机、睡眠、休眠或断网时不能回复；锁屏时无法可靠操作桌面。
- 微信端聊天与 Codex 桌面端聊天目前相互独立，不能在微信查看或切换桌面会话。
- 首次微信扫码仍借助腾讯官方 OpenClaw 微信插件取得凭据，但运行时不依赖 OpenClaw Agent。
- 微信端只支持文本回复，尚未回传 Computer Use 截图。
- 新安装的桌面应用需要补充应用别名后才能控制。

## 安全

默认使用 `workspace-write`。只有明确理解风险时才把 `sandbox` 改为 `danger-full-access`。获得授权的微信账号可能指挥 Codex 修改文件或操作应用；请勿向他人泄露配对码和微信账号。

详见 [SECURITY.md](SECURITY.md)。

## Skill

将 `skills/wechat-codex-bridge` 复制到 `%USERPROFILE%\.codex\skills\wechat-codex-bridge`，然后在 Codex 中说：

> 使用 `$wechat-codex-bridge` 帮我安装或诊断微信桥接。

## 许可证

MIT。微信扫码授权基于腾讯 MIT 许可的 [openclaw-weixin](https://github.com/Tencent/openclaw-weixin)；Codex 由 [OpenAI Codex](https://github.com/openai/codex) 提供。
