import { createServerClient } from "@/lib/supabase/server";

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  const envConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  };

  if (envConfig.botToken && envConfig.chatId) {
    return {
      botToken: envConfig.botToken,
      chatId: envConfig.chatId,
    };
  }

  if (!envConfig.botToken) {
    console.error("Telegram bot token is missing");
    return null;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("settings")
    .select("telegram_chat_id")
    .single();

  if (error || !data) {
    console.error("Error fetching Telegram chat id:", error);
    return null;
  }

  if (!data.telegram_chat_id) {
    console.error("Telegram chat id is missing");
    return null;
  }

  return {
    botToken: envConfig.botToken,
    chatId: data.telegram_chat_id,
  };
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}
