import test from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import { validateTelegramInitData } from "./validate-init-data";

function buildInitData(
  botToken: string,
  user: Record<string, unknown>,
  authDate: number
): string {
  const params: Record<string, string> = {
    auth_date: String(authDate),
    query_id: "AAEtest",
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const TOKEN = "test-bot-token";
const NOW = 1_700_000_000;

test("validateTelegramInitData: валідний hash повертає telegram id", () => {
  const initData = buildInitData(
    TOKEN,
    { id: 4242, username: "driver" },
    NOW - 60
  );
  const parsed = validateTelegramInitData(initData, TOKEN, NOW);
  assert.deepStrictEqual(parsed, {
    telegramId: 4242,
    username: "driver",
    authDate: NOW - 60,
  });
});

test("validateTelegramInitData: підроблений hash — null", () => {
  const initData = buildInitData(TOKEN, { id: 1 }, NOW);
  const tampered = initData.replace("hash=", "hash=00");
  assert.strictEqual(validateTelegramInitData(tampered, TOKEN, NOW), null);
});

test("validateTelegramInitData: прострочений auth_date — null", () => {
  const initData = buildInitData(TOKEN, { id: 1 }, NOW - 90_000);
  assert.strictEqual(
    validateTelegramInitData(initData, TOKEN, NOW, 3600),
    null
  );
});
