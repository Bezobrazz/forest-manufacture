import { createHmac, timingSafeEqual } from "node:crypto";

export const TELEGRAM_INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

export type TelegramInitUser = {
  telegramId: number;
  username: string | null;
  authDate: number;
};

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * HMAC-перевірка Telegram Mini App initData.
 * Не довіряти user.id з клієнта без цієї перевірки.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  maxAgeSec: number = TELEGRAM_INIT_DATA_MAX_AGE_SEC
): TelegramInitUser | null {
  if (!initData?.trim() || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = hmacSha256("WebAppData", botToken);
  const computed = hmacSha256(secretKey, dataCheckString).toString("hex");
  if (!safeEqualHex(computed, hash)) return null;

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (nowSec - authDate > maxAgeSec) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    return null;
  }

  if (!userJson || typeof userJson !== "object") return null;
  const id = (userJson as { id?: unknown }).id;
  const telegramId = typeof id === "number" ? id : Number(id);
  if (!Number.isFinite(telegramId) || telegramId <= 0) return null;

  const usernameRaw = (userJson as { username?: unknown }).username;
  const username = typeof usernameRaw === "string" ? usernameRaw : null;

  return { telegramId, username, authDate };
}
