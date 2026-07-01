import crypto from "node:crypto";

const CHANNEL_VERSION = "2.4.3";
const ILINK_APP_ID = "bot";
const ILINK_APP_CLIENT_VERSION = (2 << 16) | (4 << 8) | 3;

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
