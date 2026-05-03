import test from "node:test";
import assert from "node:assert";
import { sendTelegramMessage } from "./telegram";

const originalFetch = globalThis.fetch;

let envTokenBefore: string | undefined;
let envChatBefore: string | undefined;

test.beforeEach(() => {
  envTokenBefore = process.env.TELEGRAM_BOT_TOKEN;
  envChatBefore = process.env.TELEGRAM_CHAT_ID;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (envTokenBefore === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = envTokenBefore;
  if (envChatBefore === undefined) delete process.env.TELEGRAM_CHAT_ID;
  else process.env.TELEGRAM_CHAT_ID = envChatBefore;
});

test("sendTelegramMessage: без токена — false, fetch не викликається", async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  let called = false;
  globalThis.fetch = () => {
    called = true;
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  const ok = await sendTelegramMessage("hi");
  assert.strictEqual(ok, false);
  assert.strictEqual(called, false);
});

test("sendTelegramMessage: env token+chat, 200 OK — true", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "12345";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /^https:\/\/api\.telegram\.org\/bottest-token\/sendMessage$/);
    assert.strictEqual(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.strictEqual(body.chat_id, "12345");
    assert.strictEqual(body.text, "Hello");
    assert.strictEqual(body.parse_mode, "HTML");
    return new Response("{}", { status: 200 });
  };
  const ok = await sendTelegramMessage("Hello");
  assert.strictEqual(ok, true);
});

test("sendTelegramMessage: HTTP помилка — false", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "t";
  process.env.TELEGRAM_CHAT_ID = "1";
  globalThis.fetch = () => Promise.resolve(new Response("bad", { status: 400 }));
  const ok = await sendTelegramMessage("x");
  assert.strictEqual(ok, false);
});
