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
    from?: { id?: number };
    text?: string;
  };
};

function fieldKeyboard() {
  const purchaseUrl = getMiniAppUrl("/m/purchase");
  const tripUrl = getMiniAppUrl("/m/trip");
  return {
    keyboard: [
      [
        { text: "Закупівля сировини", web_app: { url: purchaseUrl } },
        { text: "Поїздка", web_app: { url: tripUrl } },
      ],
    ],
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
      "Щоб користуватися внесенням даних, адміністратор має згенерувати код прив’язки в профілі ERP.\n\nПісля цього надішліть: <code>/start КОД</code>",
      { reply_markup: fieldKeyboard() }
    );
    return;
  }

  const result = await consumeTelegramLinkCode(code, fromId);
  await sendTelegramChatMessage(botToken, chatId, result.message, {
    reply_markup: fieldKeyboard(),
  });
}

export async function consumeTelegramLinkCode(
  code: string,
  telegramId: number
): Promise<{ ok: boolean; message: string }> {
  const supabase = createServiceRoleClient();
  const normalized = normalizeLinkCode(code);
  if (!normalized) {
    return { ok: false, message: "Невірний код прив’язки." };
  }

  const { data: row, error } = await supabase
    .from("telegram_link_codes")
    .select("id, user_id, expires_at")
    .eq("code", normalized)
    .maybeSingle();

  if (error || !row) {
    return {
      ok: false,
      message: "Код не знайдено або вже використано. Згенеруйте новий у профілі ERP.",
    };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from("telegram_link_codes").delete().eq("id", row.id);
    return { ok: false, message: "Код прострочено. Згенеруйте новий у профілі ERP." };
  }

  const { data: taken } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .neq("id", row.user_id)
    .maybeSingle();

  if (taken) {
    return {
      ok: false,
      message: "Цей Telegram уже прив’язано до іншого облікового запису.",
    };
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ telegram_id: telegramId })
    .eq("id", row.user_id);

  if (updateError) {
    console.error("Failed to set telegram_id:", updateError);
    return { ok: false, message: "Не вдалося прив’язати акаунт. Спробуйте пізніше." };
  }

  await supabase.from("telegram_link_codes").delete().eq("id", row.id);

  return {
    ok: true,
    message:
      "Telegram прив’язано. Відкрийте Mini App кнопкою «Внести дані» або оберіть дію нижче.",
  };
}
