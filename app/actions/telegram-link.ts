"use server";

import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  generateTelegramLinkCode,
  LINK_CODE_TTL_MS,
} from "@/lib/telegram/link-code";

export async function getTelegramLinkStatus(): Promise<{
  linked: boolean;
  telegramId: number | null;
}> {
  const user = await getServerUser();
  if (!user) return { linked: false, telegramId: null };

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", user.id)
    .maybeSingle();

  const telegramId =
    data?.telegram_id != null ? Number(data.telegram_id) : null;
  return {
    linked: telegramId != null && Number.isFinite(telegramId),
    telegramId,
  };
}

export async function createTelegramLinkCode(): Promise<
  { ok: true; code: string; expiresAt: string } | { ok: false; error: string }
> {
  const user = await getServerUser();
  if (!user) return { ok: false, error: "Необхідно авторизуватися" };

  const supabase = await createServerSupabaseClient();
  await supabase.from("telegram_link_codes").delete().eq("user_id", user.id);

  const code = generateTelegramLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();

  const { error } = await supabase.from("telegram_link_codes").insert({
    user_id: user.id,
    code,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("Error creating telegram link code:", error);
    return { ok: false, error: "Не вдалося згенерувати код" };
  }

  return { ok: true, code, expiresAt };
}

export async function unlinkTelegramAccount(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getServerUser();
  if (!user) return { ok: false, error: "Необхідно авторизуватися" };

  try {
    const admin = createServiceRoleClient();
    const { error } = await admin
      .from("users")
      .update({ telegram_id: null })
      .eq("id", user.id);

    if (error) {
      console.error("Error unlinking telegram:", error);
      return { ok: false, error: "Не вдалося відв’язати Telegram" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Error unlinking telegram:", error);
    return { ok: false, error: "Не вдалося відв’язати Telegram" };
  }
}
