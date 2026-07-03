import assert from "node:assert/strict";
import test from "node:test";
import { isBrowserAutomationScope, isComputerUseRetry, isWebAutomationRequest } from "../src/task-routing.js";

test("routes browser tasks consistently on Windows and macOS", () => {
  for (const text of ["打开 YouTube", "用 Safari 打开 example.com", "搜索 OpenAI 最新文档", "https://example.com"]) {
    assert.equal(isWebAutomationRequest(text), true, text);
  }
  assert.equal(isBrowserAutomationScope("Chrome"), true);
  assert.equal(isBrowserAutomationScope("Google Chrome"), true);
  assert.equal(isBrowserAutomationScope("playwright"), true);
});

test("does not route local search into the browser", () => {
  assert.equal(isWebAutomationRequest("在本地项目里搜索这个文件"), false);
  assert.equal(isWebAutomationRequest("搜索电脑里的代码"), false);
});

test("recognizes concise retry messages", () => {
  assert.equal(isComputerUseRetry("再试一次"), true);
  assert.equal(isComputerUseRetry("continue"), true);
  assert.equal(isComputerUseRetry("继续写文档"), false);
});
