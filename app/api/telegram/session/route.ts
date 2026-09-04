import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server-auth";
import { getTelegramBotToken } from "@/lib/telegram/bot";
import { validateTelegramInitData } from "@/lib/telegram/validate-init-data";

export async function POST(request: NextRequest) {
  const botToken = await getTelegramBotToken();
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
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, email")
    .eq("telegram_id", parsed.telegramId)
    .maybeSingle();

  if (profileError || !profile?.email) {
    return NextResponse.json(
      {
        ok: false,
        error: "unlinked",
        message: "Telegram не прив’язано. Зверніться до адміністратора.",
      },
      { status: 403 }
    );
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    console.error("generateLink failed:", linkError);
    return NextResponse.json(
      { ok: false, error: "Не вдалося створити сесію" },
      { status: 500 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  if (otpError) {
    console.error("verifyOtp failed:", otpError);
    return NextResponse.json(
      { ok: false, error: "Не вдалося увійти" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
