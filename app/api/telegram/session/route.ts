import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTelegramWorkBotToken } from "@/lib/telegram/bot";
import { setMiniAppAccessCookie } from "@/lib/telegram/mini-app-session";
import { validateTelegramInitData } from "@/lib/telegram/validate-init-data";

export async function POST(request: NextRequest) {
  const botToken = getTelegramWorkBotToken();
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "Telegram bot не налаштовано" },
      { status: 503 }
    );
  }

  let initData = "";
  try {
    const body = (await request.json()) as { initData?: unknown };
    initData = typeof body.initData === "string" ? body.initData : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Невірне тіло запиту" }, { status: 400 });
  }

  const parsed = validateTelegramInitData(initData, botToken);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "Недійсні дані Telegram" },
      { status: 401 }
    );
  }

  const admin = createServiceRoleClient();
  const { data: access, error } = await admin
    .from("mini_app_accesses")
    .select("id, status, display_name")
    .eq("telegram_id", parsed.telegramId)
    .maybeSingle();

  if (error || !access) {
    return NextResponse.json(
      {
        ok: false,
        error: "unlinked",
        message: "Telegram не прив’язано. Зверніться до адміністратора.",
      },
      { status: 403 }
    );
  }

  if (access.status === "blocked") {
    return NextResponse.json(
      {
        ok: false,
        error: "blocked",
        message: "Доступ заблоковано. Зверніться до адміністратора.",
      },
      { status: 403 }
    );
  }

  if (access.status !== "active") {
    return NextResponse.json(
      {
        ok: false,
        error: "pending",
        message: "Доступ ще не активовано.",
      },
      { status: 403 }
    );
  }

  if (parsed.username) {
    await admin
      .from("mini_app_accesses")
      .update({ telegram_username: parsed.username })
      .eq("id", access.id);
  }

  const cookieOk = await setMiniAppAccessCookie(access.id);
  if (!cookieOk) {
    return NextResponse.json(
      { ok: false, error: "Не вдалося створити сесію (немає секрету cookie)" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    displayName: access.display_name,
  });
}
