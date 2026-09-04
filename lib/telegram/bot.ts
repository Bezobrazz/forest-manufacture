import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function getTelegramBotToken(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("settings")
      .select("telegram_bot_token")
      .single();
    if (error || !data?.telegram_bot_token) return null;
    return data.telegram_bot_token;
  } catch (error) {
    console.error("Error fetching Telegram bot token:", error);
    return null;
  }
}

export async function sendTelegramChatMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  extra?: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          ...extra,
        }),
      }
    );
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Telegram sendMessage failed:", response.status, errorBody);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error sending Telegram chat message:", error);
    return false;
  }
}

export async function setTelegramChatMenuButton(
  botToken: string,
  webAppUrl: string,
  chatId?: number | string
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      menu_button: {
        type: "web_app",
        text: "Внести дані",
        web_app: { url: webAppUrl },
      },
    };
    if (chatId !== undefined) body.chat_id = chatId;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setChatMenuButton`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Telegram setChatMenuButton failed:", response.status, errorBody);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error setting Telegram menu button:", error);
    return false;
  }
}

export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string | null
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ["message"],
    };
    if (secretToken) body.secret_token = secretToken;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Telegram setWebhook failed:", response.status, errorBody);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error setting Telegram webhook:", error);
    return false;
  }
}
