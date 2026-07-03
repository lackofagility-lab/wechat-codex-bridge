import assert from "node:assert/strict";
import test from "node:test";
import { aesEcbPaddedSize, WechatClient } from "../src/wechat-client.js";

test("normalizes a finished text message", () => {
  const client = new WechatClient({ baseUrl: "https://example.com", token: "test" });
  const message = client.normalize({
    message_id: 42,
    from_user_id: "user@im.wechat",
    message_type: 1,
    message_state: 2,
    context_token: "context",
    item_list: [{ type: 1, text_item: { text: " hello " } }],
  });
  assert.deepEqual(message, {
    id: 42,
    from: "user@im.wechat",
    text: "hello",
    contextToken: "context",
    timestamp: undefined,
    isUser: true,
    isFinished: true,
  });
});

test("computes AES padded screenshot sizes", () => {
  assert.equal(aesEcbPaddedSize(0), 16);
  assert.equal(aesEcbPaddedSize(15), 16);
  assert.equal(aesEcbPaddedSize(16), 32);
});

test("uploads and sends an encrypted screenshot", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("getuploadurl")) {
      return new Response(JSON.stringify({ upload_full_url: "https://cdn.example/upload" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url) === "https://cdn.example/upload") {
      return new Response("", { status: 200, headers: { "x-encrypted-param": "download-param" } });
    }
    return new Response(JSON.stringify({ ret: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const client = new WechatClient({ baseUrl: "https://api.example/", token: "test" });
    const id = await client.sendImage({
      to: "user@im.wechat",
      source: "data:image/png;base64,aGVsbG8=",
      contextToken: "context",
      clientId: "shot-1",
    });
    assert.equal(id, "shot-1");
    assert.equal(requests.length, 3);
    const sent = JSON.parse(requests[2].options.body);
    assert.equal(sent.msg.item_list[0].type, 2);
    assert.equal(sent.msg.item_list[0].image_item.media.encrypt_query_param, "download-param");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
