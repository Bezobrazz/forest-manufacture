"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server-auth";
import {
  generateTelegramLinkCode,
  LINK_CODE_TTL_MS,
} from "@/lib/telegram/link-code";
import type { MiniAppAccess } from "@/lib/telegram/mini-app-session";

export type MiniAppAccessListItem = MiniAppAccess & {
  creator_email?: string | null;
};

export async function listMiniAppAccesses(): Promise<MiniAppAccessListItem[]> {
  await requireRole(["owner", "admin"]);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("mini_app_accesses")
    .select(
      "id, display_name, telegram_id, telegram_username, status, created_by, notes, created_at, linked_at, blocked_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listMiniAppAccesses:", error);
    return [];
  }

  const rows = (data ?? []) as MiniAppAccess[];
  const creatorIds = [...new Set(rows.map((r) => r.created_by))];
  const emailById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, email")
      .in("id", creatorIds);
    for (const u of users ?? []) {
      emailById.set(u.id, u.email);
    }
  }

  return rows.map((row) => ({
    ...row,
    creator_email: emailById.get(row.created_by) ?? null,
  }));
}

export async function createMiniAppAccess(displayName: string): Promise<
  { ok: true; access: MiniAppAccess } | { ok: false; error: string }
> {
  const { user } = await requireRole(["owner", "admin"]);
  const name = displayName.trim();
  if (!name) return { ok: false, error: "Вкажіть імʼя доступу" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("mini_app_accesses")
    .insert({
      display_name: name,
      status: "pending",
      created_by: user.id,
    })
    .select(
      "id, display_name, telegram_id, telegram_username, status, created_by, notes, created_at, linked_at, blocked_at"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Не вдалося створити доступ" };
  }

  revalidatePath("/mini-app-access");
  return { ok: true, access: data as MiniAppAccess };
}

export async function createMiniAppInviteCode(accessId: string): Promise<
  { ok: true; code: string; expiresAt: string } | { ok: false; error: string }
> {
  await requireRole(["owner", "admin"]);
  if (!accessId) return { ok: false, error: "Невірний доступ" };

  const supabase = await createServerSupabaseClient();
  const { data: access } = await supabase
    .from("mini_app_accesses")
    .select("id, status")
    .eq("id", accessId)
    .maybeSingle();

  if (!access) return { ok: false, error: "Доступ не знайдено" };
  if (access.status === "blocked") {
    return { ok: false, error: "Спочатку розблокуйте доступ" };
  }

  await supabase.from("mini_app_invite_codes").delete().eq("access_id", accessId);

  const code = generateTelegramLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
  const { error } = await supabase.from("mini_app_invite_codes").insert({
    access_id: accessId,
    code,
    expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, code, expiresAt };
}

export async function blockMiniAppAccess(
  accessId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("mini_app_accesses")
    .update({
      status: "blocked",
      blocked_at: new Date().toISOString(),
    })
    .eq("id", accessId);

  if (error) return { ok: false, error: error.message };
  await supabase.from("mini_app_invite_codes").delete().eq("access_id", accessId);
  revalidatePath("/mini-app-access");
  return { ok: true };
}

export async function unblockMiniAppAccess(
  accessId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const supabase = await createServerSupabaseClient();
  const { data: access } = await supabase
    .from("mini_app_accesses")
    .select("telegram_id")
    .eq("id", accessId)
    .maybeSingle();

  if (!access) return { ok: false, error: "Доступ не знайдено" };

  const { error } = await supabase
    .from("mini_app_accesses")
    .update({
      status: access.telegram_id != null ? "active" : "pending",
      blocked_at: null,
    })
    .eq("id", accessId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/mini-app-access");
  return { ok: true };
}
