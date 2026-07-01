import assert from "node:assert/strict";
import test from "node:test";
import { WechatClient } from "../src/wechat-client.js";

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
