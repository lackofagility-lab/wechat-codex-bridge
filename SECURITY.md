# Security

The bridge can let an authorized WeChat user instruct Codex to read or modify files in the configured workspace.

- Pair only accounts you trust.
- Use a dedicated workspace and keep `sandbox` set to `workspace-write`.
- Treat `danger-full-access` as a high-risk local opt-in: the paired account can direct Codex across the computer.
- Keep private applications out of `computerUseAppAliases`; never use wildcard app approval.
- Never commit `%APPDATA%\wechat-codex-bridge`, `config.json`, memory files, or credentials.
- Report vulnerabilities privately through GitHub Security Advisories.

Unknown WeChat users are ignored until they send the one-time pairing code generated during setup.
