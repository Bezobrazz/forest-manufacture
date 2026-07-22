type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;

/** Ліміти на користувача за хвилину (етап 4). */
export const AI_RATE_LIMITS = {
  insights: 8,
  chat: 20,
} as const;

export type AiRateLimitKind = keyof typeof AI_RATE_LIMITS;

/**
 * Простий in-memory rate-limit (на інстанс).
 * Для Hobby/одного інстансу достатньо як захист від випадкових спайків.
 */
export function checkAiRateLimit(
  userId: string,
  kind: AiRateLimitKind
): { ok: true } | { ok: false; retryAfterSec: number } {
  const limit = AI_RATE_LIMITS[kind];
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { ok: true };
}
