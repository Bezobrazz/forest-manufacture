import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getMiniAppUrl } from "@/lib/telegram/app-url";
import {
  sendTelegramChatMessage,
  setTelegramChatMenuButton,
} from "@/lib/telegram/bot";
import { normalizeLinkCode } from "@/lib/telegram/link-code";

export type TelegramMessageUpdate = {
  message?: {
    chat?: { id?: number };
    from?: { id?: number; username?: string };
    text?: string;
  };
};

function fieldKeyboard() {
  const homeUrl = getMiniAppUrl("/m");
  return {
    keyboard: [[{ text: "Внести дані", web_app: { url: homeUrl } }]],
    resize_keyboard: true,
  };
}

function extractStartCode(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/start")) return null;
  const rest = trimmed.slice("/start".length).trim();
  if (!rest) return null;
  return normalizeLinkCode(rest.split(/\s+/)[0] ?? "");
}

export async function handleTelegramBotUpdate(
  botToken: string,
  update: TelegramMessageUpdate
): Promise<void> {
  const message = update.message;
  const chatId = message?.chat?.id;
  const fromId = message?.from?.id;
  const username = message?.from?.username ?? null;
  const text = message?.text?.trim() ?? "";
  if (chatId == null || fromId == null) return;

  await setTelegramChatMenuButton(botToken, getMiniAppUrl("/m"), chatId);

  if (!text.startsWith("/start")) {
    await sendTelegramChatMessage(
      botToken,
      chatId,
      "Оберіть дію нижче або відкрийте Mini App кнопкою «Внести дані».",
      { reply_markup: fieldKeyboard() }
    );
    return;
  }

  const code = extractStartCode(text);
  if (!code) {
    await sendTelegramChatMessage(
      botToken,
      chatId,
      "Щоб користуватися внесенням даних, адміністратор має створити доступ у ERP і надіслати код.\n\nПісля цього надішліть: <code>/start КОД</code>",
      { reply_markup: fieldKeyboard() }
    );
    return;
  }

  const result = await consumeMiniAppInviteCode(code, fromId, username);
  await sendTelegramChatMessage(botToken, chatId, result.message, {
    reply_markup: fieldKeyboard(),
  });
}

export async function consumeMiniAppInviteCode(
  code: string,
  telegramId: number,
  telegramUsername: string | null
): Promise<{ ok: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const normalized = normalizeLinkCode(code);
  if (!normalized) {
    return { ok: false, message: "Невірний код прив’язки." };
  }

  const { data: row, error } = await supabase
    .from("mini_app_invite_codes")
    .select("id, access_id, expires_at")
    .eq("code", normalized)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      message:
        "Код не знайдено або вже використано. Попросіть адміністратора згенерувати новий.",
    };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from("mini_app_invite_codes").delete().eq("id", row.id);
    return {
      ok: false,
      message: "Код прострочено. Попросіть адміністратора згенерувати новий.",
    };
  }

  const { data: access, error: accessError } = await supabase
    .from("mini_app_accesses")
    .select("id, display_name, status")
    .eq("id", row.access_id)
    .maybeSingle();

  if (accessError || !access) {
    return { ok: false, message: "Доступ не знайдено." };
  }

  if (access.status === "blocked") {
    return { ok: false, message: "Цей доступ заблоковано." };
  }

  const { data: taken } = await supabase
    .from("mini_app_accesses")
    .select("id")
    .eq("telegram_id", telegramId)
    .neq("id", access.id)
    .maybeSingle();

  if (taken) {
    return {
      ok: false,
      message: "Цей Telegram уже прив’язано до іншого доступу.",
    };
  }

  const { error: updateError } = await supabase
    .from("mini_app_accesses")
    .update({
      telegram_id: telegramId,
      telegram_username: telegramUsername,
      status: "active",
      linked_at: new Date().toISOString(),
      blocked_at: null,
    })
    .eq("id", access.id);

  if (updateError) {
    console.error("Failed to link mini_app_access:", updateError);
    return { ok: false, message: "Не вдалося прив’язати. Спробуйте пізніше." };
  }

  await supabase.from("mini_app_invite_codes").delete().eq("access_id", access.id);

  return {
    ok: true,
    message: `Прив’язано як «${access.display_name}». Відкрийте Mini App кнопкою «Внести дані».`,
  };
}
