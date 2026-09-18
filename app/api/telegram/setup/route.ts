import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, getMiniAppUrl } from "@/lib/telegram/app-url";
import {
  getTelegramWorkBotToken,
  setTelegramChatMenuButton,
  setTelegramWebhook,
} from "@/lib/telegram/bot";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("token") === secret;
}

/** Реєструє webhook бота та Menu Button Mini App. Захищено CRON_SECRET. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const botToken = getTelegramWorkBotToken();
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "bot token missing" }, { status: 503 });
  }

  const webhookUrl = `${getAppBaseUrl()}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
  const webhookOk = await setTelegramWebhook(botToken, webhookUrl, secret);
  const menuOk = await setTelegramChatMenuButton(botToken, getMiniAppUrl("/m"));

  return NextResponse.json({
    ok: webhookOk && menuOk,
    webhookUrl,
    webhookOk,
    menuOk,
  });
}
