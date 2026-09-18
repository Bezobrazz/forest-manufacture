import { NextRequest, NextResponse } from "next/server";
import { getTelegramWorkBotToken } from "@/lib/telegram/bot";
import { handleTelegramBotUpdate } from "@/lib/telegram/handle-update";

function webhookSecretOk(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  return header === expected;
}

export async function POST(request: NextRequest) {
  if (!webhookSecretOk(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const botToken = getTelegramWorkBotToken();
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "bot token missing" }, { status: 503 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await handleTelegramBotUpdate(
      botToken,
      update && typeof update === "object" ? update : {}
    );
  } catch (error) {
    console.error("Telegram webhook handler error:", error);
  }

  return NextResponse.json({ ok: true });
}
