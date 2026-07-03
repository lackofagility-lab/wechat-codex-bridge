# 微信 Codex Bridge

让 Windows 或 macOS 电脑上的本地 Codex 直接连接微信 ClawBot。腾讯工具只用于首次扫码取得微信凭据，不参与后续 Agent、模型或会话处理。

## 功能

- 微信直接调用本机 Codex
- 配对码与用户白名单，陌生账号默认无权使用
- 登录自启、断线重连、崩溃自愈、单实例运行
- 防止重复“收到”和重复最终回复
- 保存近期对话与每日记忆
- Windows 使用官方 Computer Use；macOS 使用 Peekaboo MCP，均只控制明确点名且允许的应用

## 安装

需要 Windows 10/11 或 macOS、Node.js 22+、Git、已登录的 Codex CLI，以及可用的微信 ClawBot。

以下命令在 Windows Terminal、CMD、PowerShell、zsh 和 bash 中相同；主流程不依赖 PowerShell：

```text
git clone https://github.com/lackofagility-lab/wechat-codex-bridge.git
cd wechat-codex-bridge
npm install
npm run setup
```

首次安装会打开腾讯官方二维码登录。扫码后，把终端显示的 `/pair 123456` 发给 ClawBot。Windows 会安装无需管理员权限的当前用户登录启动项，macOS 会安装 launchd 用户服务。

```text
npm run status
npm run uninstall
npm test
npm run check
```

卸载后台服务不会删除凭据、记忆或配置。

## 微信命令

- `/new` 或 `/reset`：新建 Codex 会话
- `/status`：查看连接状态
- `/progress on|off`：开关单次“正在处理”提示
- `/help`：查看命令

## 平台能力

- Windows 与 macOS 均支持微信聊天、文件与终端任务、记忆、自启、恢复和桌面应用控制。
- Windows 使用 Codex 官方 Computer Use；macOS 自动接入开源 Peekaboo MCP。
- 两端都只有在消息明确点名 `config.json` 中登记的应用时才启用桌面控制，高风险外部操作仍需确认。
- Peekaboo 是第三方后端，并非 OpenAI 官方 Computer Use。首次使用由 `npx` 获取，用户必须亲自在系统设置中批准“辅助功能”和“屏幕录制”。

## 局限

- 微信端与 Codex 桌面端会话彼此独立，暂时不能查看或切换桌面聊天。
- 锁屏和关闭显示器时桥接仍可回复；真正睡眠、休眠、关机或断网时会暂停，恢复后自动继续。
- 首次扫码借助腾讯官方 OpenClaw 微信工具取得凭据，但运行时不经过 OpenClaw Agent。
- 回复以文字为主，Computer Use 截图尚不会回传微信。

## 安全

默认使用 `workspace-write`。只有明确理解风险时才改为 `danger-full-access`。Computer Use 使用逐应用授权，不开放“所有应用”通配权限。

详见 [SECURITY.md](SECURITY.md)。项目采用 MIT 许可证。
