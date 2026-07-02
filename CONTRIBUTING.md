# Contributing

Contributions are welcome. Keep security defaults conservative and do not commit credentials, user ids, conversation memory, local paths, or logs.

## Development

```powershell
npm ci
npm run check
npm test
python "$HOME\.codex\skills\.system\skill-creator\scripts\quick_validate.py" .\skills\wechat-codex-bridge
```

Pull requests should explain behavior changes, security impact, Windows versions tested, and manual verification performed. Add tests for message deduplication, access control, app approvals, persistence, or retry behavior when changing those areas.

Do not modify installed Codex plugin caches or bypass Computer Use confirmation mechanisms.
