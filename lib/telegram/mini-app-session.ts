import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const MINI_APP_COOKIE = "mini_app_access";
const COOKIE_TTL_SEC = 7 * 24 * 60 * 60;

export type MiniAppAccessStatus = "pending" | "active" | "blocked";

export type MiniAppAccess = {
  id: string;
  display_name: string;
  telegram_id: number | null;
  telegram_username: string | null;
  status: MiniAppAccessStatus;
  created_by: string;
  notes: string | null;
  created_at: string;
  linked_at: string | null;
  blocked_at: string | null;
};

function cookieSecret(): string | null {
  return (
    process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.TELEGRAM_BOT_WORK_TOKEN?.trim() ||
    null
  );
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function buildMiniAppAccessCookieValue(
  accessId: string,
  expiresAtSec: number = Math.floor(Date.now() / 1000) + COOKIE_TTL_SEC
): string | null {
  const secret = cookieSecret();
  if (!secret) return null;
  const payload = `${accessId}.${expiresAtSec}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function parseMiniAppAccessCookieValue(
  raw: string | undefined | null
): { accessId: string } | null {
  if (!raw) return null;
  const secret = cookieSecret();
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [accessId, expStr, sig] = parts;
  if (!accessId || !expStr || !sig) return null;
  const payload = `${accessId}.${expStr}`;
  if (!safeEqual(sign(payload, secret), sig)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  return { accessId };
}

export async function setMiniAppAccessCookie(accessId: string): Promise<boolean> {
  const value = buildMiniAppAccessCookieValue(accessId);
  if (!value) return false;
  const jar = await cookies();
  jar.set(MINI_APP_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_TTL_SEC,
  });
  return true;
}

export async function clearMiniAppAccessCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(MINI_APP_COOKIE);
}

export async function getMiniAppAccessFromCookie(): Promise<MiniAppAccess | null> {
  const jar = await cookies();
  const parsed = parseMiniAppAccessCookieValue(jar.get(MINI_APP_COOKIE)?.value);
  if (!parsed) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("mini_app_accesses")
    .select(
      "id, display_name, telegram_id, telegram_username, status, created_by, notes, created_at, linked_at, blocked_at"
    )
    .eq("id", parsed.accessId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== "active") return null;
  return data as MiniAppAccess;
}

export async function requireMiniAppAccess(): Promise<
  { ok: true; access: MiniAppAccess } | { ok: false; error: string }
> {
  const access = await getMiniAppAccessFromCookie();
  if (!access) {
    return { ok: false, error: "Немає доступу Mini App. Зверніться до адміністратора." };
  }
  return { ok: true, access };
}
