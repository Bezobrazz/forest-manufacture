import { createServerClient } from "@/lib/supabase/server";

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("settings")
    .select("telegram_bot_token, telegram_chat_id")
    .single();

  if (error || !data) {
    console.error("Error fetching Telegram config:", error);
    return null;
  }

  return {
    botToken: data.telegram_bot_token,
    chatId: data.telegram_chat_id,
  };
}

export async function sendTelegramMessage(message: string): Promise<boolean> {
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
