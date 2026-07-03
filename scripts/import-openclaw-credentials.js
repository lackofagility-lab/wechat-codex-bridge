import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { getStateDir } from "../src/platform.js";

const sourceRoot = path.join(os.homedir(), ".openclaw", "openclaw-weixin");
const accountIds = JSON.parse(fs.readFileSync(path.join(sourceRoot, "accounts.json"), "utf8"));
if (!Array.isArray(accountIds) || accountIds.length === 0) throw new Error("No WeChat account found");
const accountId = accountIds.at(-1);
const accountPath = path.join(sourceRoot, "accounts", `${accountId}.json`);
const syncPath = path.join(sourceRoot, "accounts", `${accountId}.sync.json`);
const account = JSON.parse(fs.readFileSync(accountPath, "utf8"));
if (!account.token || !account.baseUrl) throw new Error("WeChat credential is incomplete");

const targetRoot = getStateDir();
const existingPath = path.join(targetRoot, "credentials.json");
let pairingCode = String(crypto.randomInt(100000, 1000000));
if (fs.existsSync(existingPath)) {
  pairingCode = JSON.parse(fs.readFileSync(existingPath, "utf8")).pairingCode || pairingCode;
}
fs.mkdirSync(targetRoot, { recursive: true });
fs.writeFileSync(
  path.join(targetRoot, "credentials.json"),
  `${JSON.stringify({ accountId, token: account.token, baseUrl: account.baseUrl, pairingCode }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
if (fs.existsSync(syncPath)) {
  fs.copyFileSync(syncPath, path.join(targetRoot, "sync.json"));
}
console.log(`Imported WeChat account ${accountId} into ${targetRoot}`);
console.log(`Send this message to the bot once to authorize your WeChat: /pair ${pairingCode}`);
