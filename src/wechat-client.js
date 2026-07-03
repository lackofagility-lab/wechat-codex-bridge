import crypto from "node:crypto";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CHANNEL_VERSION = "2.4.3";
const ILINK_APP_ID = "bot";
const ILINK_APP_CLIENT_VERSION = (2 << 16) | (4 << 8) | 3;
const CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;

export function aesEcbPaddedSize(size) {
  return Math.ceil((size + 1) / 16) * 16;
}

function encryptAesEcb(buffer, key) {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

async function loadImageSource(source) {
  if (/^data:image\//i.test(source)) {
    const comma = source.indexOf(",");
    if (comma < 0 || !/;base64$/i.test(source.slice(0, comma))) throw new Error("Unsupported image data URL");
    return Buffer.from(source.slice(comma + 1), "base64");
  }
  if (/^file:\/\//i.test(source)) return fs.readFile(fileURLToPath(source));
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Screenshot download HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return fs.readFile(source);
}

function randomWechatUin() {
  const value = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(value), "utf8").toString("base64");
}

function baseInfo() {
  return {
    channel_version: CHANNEL_VERSION,
    bot_agent: "Codex/1.0 (WeChat Bridge)",
  };
}

function messageText(message) {
  for (const item of message.item_list ?? []) {
    if (item.type === 1 && item.text_item?.text != null) {
      return String(item.text_item.text).trim();
    }
    if (item.type === 3 && item.voice_item?.text) {
      return String(item.voice_item.text).trim();
    }
  }
  return "";
}

export class WechatClient {
  constructor({ baseUrl, token, pollTimeoutMs = 40000 }) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    this.token = token;
    this.pollTimeoutMs = pollTimeoutMs;
  }

  headers() {
    return {
      "Content-Type": "application/json",
      AuthorizationType: "ilink_bot_token",
      Authorization: `Bearer ${this.token}`,
      "X-WECHAT-UIN": randomWechatUin(),
      "iLink-App-Id": ILINK_APP_ID,
      "iLink-App-ClientVersion": String(ILINK_APP_CLIENT_VERSION),
    };
  }

  async post(endpoint, body, timeoutMs = 15000) {
    const response = await fetch(new URL(endpoint, this.baseUrl), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...body, base_info: baseInfo() }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  async notifyStart() {
    return this.post("ilink/bot/msg/notifystart", {}, 10000);
  }

  async notifyStop() {
    return this.post("ilink/bot/msg/notifystop", {}, 10000);
  }

  async getUpdates(syncBuffer = "") {
    try {
      return await this.post(
        "ilink/bot/getupdates",
        { get_updates_buf: syncBuffer },
        this.pollTimeoutMs,
      );
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return { ret: 0, msgs: [], get_updates_buf: syncBuffer };
      }
      throw error;
    }
  }

  async sendText({ to, text, contextToken, clientId = null }) {
    const resolvedClientId = clientId || `codex-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await this.post("ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: to,
        client_id: resolvedClientId,
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text } }],
        context_token: contextToken || undefined,
      },
    });
    return resolvedClientId;
  }

  async sendImage({ to, source, contextToken, clientId = null }) {
    const plaintext = await loadImageSource(source);
    if (!plaintext.length || plaintext.length > MAX_SCREENSHOT_BYTES) {
      throw new Error(`Screenshot size must be between 1 byte and ${MAX_SCREENSHOT_BYTES} bytes`);
    }
    const filekey = crypto.randomBytes(16).toString("hex");
    const aeskey = crypto.randomBytes(16);
    const ciphertext = encryptAesEcb(plaintext, aeskey);
    const upload = await this.post("ilink/bot/getuploadurl", {
      filekey,
      media_type: 1,
      to_user_id: to,
      rawsize: plaintext.length,
      rawfilemd5: crypto.createHash("md5").update(plaintext).digest("hex"),
      filesize: ciphertext.length,
      no_need_thumb: true,
      aeskey: aeskey.toString("hex"),
    }, 20000);
    const uploadUrl = upload.upload_full_url?.trim() ||
      `${CDN_BASE_URL}/upload?encrypted_query_param=${encodeURIComponent(upload.upload_param || "")}&filekey=${encodeURIComponent(filekey)}`;
    if (!upload.upload_full_url && !upload.upload_param) throw new Error("WeChat did not return a screenshot upload URL");
    let encryptedParam;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Uint8Array(ciphertext),
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) throw new Error(`WeChat screenshot CDN HTTP ${response.status}`);
        encryptedParam = response.headers.get("x-encrypted-param");
        if (!encryptedParam) throw new Error("WeChat screenshot CDN omitted x-encrypted-param");
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
    if (!encryptedParam) throw lastError;
    const resolvedClientId = clientId || `codex-image-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await this.post("ilink/bot/sendmessage", {
      msg: {
        from_user_id: "",
        to_user_id: to,
        client_id: resolvedClientId,
        message_type: 2,
        message_state: 2,
        item_list: [{
          type: 2,
          image_item: {
            media: {
              encrypt_query_param: encryptedParam,
              aes_key: Buffer.from(aeskey.toString("hex")).toString("base64"),
              encrypt_type: 1,
            },
            mid_size: ciphertext.length,
          },
        }],
        context_token: contextToken || undefined,
      },
    });
    return resolvedClientId;
  }

  normalize(message) {
    return {
      id: message.message_id ?? message.client_id ?? `${message.from_user_id}:${message.create_time_ms}`,
      from: message.from_user_id ?? "",
      text: messageText(message),
      contextToken: message.context_token,
      timestamp: message.create_time_ms,
      isUser: message.message_type === 1,
      isFinished: message.message_state == null || message.message_state === 2,
    };
  }
}
