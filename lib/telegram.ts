import { createServerClient } from "@/lib/supabase/server";

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  const envConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
    chatId: process.env.TELEGRAM_CHAT_ID ?? null,
  };

  if (envConfig.botToken && envConfig.chatId) {
    return { botToken: envConfig.botToken, chatId: envConfig.chatId };
  }

  let data:
    | {
        telegram_bot_token: string | null;
        telegram_chat_id: string | null;
      }
    | null = null;

  try {
    const supabase = await createServerClient();
    const { data: settings, error } = await supabase
      .from("settings")
      .select("telegram_bot_token, telegram_chat_id")
      .single();

    if (error || !settings) {
      console.error("Error fetching Telegram config:", error);
      return null;
    }

    data = settings;
  } catch (error) {
    console.error("Error creating Supabase client for Telegram config:", error);
    return null;
  }

  const botToken = envConfig.botToken ?? data.telegram_bot_token;
  const chatId = envConfig.chatId ?? data.telegram_chat_id;

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
