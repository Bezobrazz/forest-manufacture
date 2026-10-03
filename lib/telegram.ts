import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  const envBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const envChatId = process.env.TELEGRAM_CHAT_ID?.trim() || null;

  if (envBotToken && envChatId) {
    return { botToken: envBotToken, chatId: envChatId };
  }

  let data:
    | {
        telegram_bot_token: string | null;
        telegram_chat_id: string | null;
      }
    | null = null;

  try {
    // Service role: cron / Mini App не мають user-session cookies.
    const supabase = createServiceRoleClient();
    const { data: settings, error } = await supabase
      .from("settings")
      .select("telegram_bot_token, telegram_chat_id")
      .limit(1)
      .maybeSingle();

    if (error || !settings) {
      console.error("Error fetching Telegram config:", error);
      return null;
    }

    data = settings;
  } catch (error) {
    console.error("Error creating Supabase client for Telegram config:", error);
    return null;
  }

  const botToken = envBotToken ?? data.telegram_bot_token?.trim() ?? null;
  const chatId = envChatId ?? data.telegram_chat_id?.trim() ?? null;

  if (!botToken) {
    console.error("Telegram bot token is missing");
    return null;
  }

  if (!chatId) {
    console.error("Telegram chat id is missing");
    return null;
  }

  return { botToken, chatId };
}

export async function sendTelegramMessage(
  message: string
): Promise<boolean> {
  const config = await getTelegramConfig();

  if (!config) {
    console.error("Telegram configuration not found");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorBody}`);
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}
