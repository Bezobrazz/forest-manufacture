import { createServerSupabaseClient } from "@/lib/supabase/server-auth";
import { getDefaultRole } from "./roles";

export type UserRole = "owner" | "admin" | "worker";

/**
 * Отримує роль користувача з таблиці public.users
 * Якщо запису немає або ролі немає, автоматично створює запис з роллю за замовчуванням
 */
export async function getUserRole(
  userId: string | null
): Promise<UserRole | null> {
  if (!userId) return null;

  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", userId)
      .single();

    // Якщо запису немає, створюємо його з роллю за замовчуванням
    if (error || !data) {
      // Отримуємо email користувача з auth.users
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        console.error("Error fetching user role: user not found");
        return null;
      }

      // Створюємо запис з роллю за замовчуванням
      const defaultRole = getDefaultRole();
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: authUser.email || "",
          role: defaultRole,
        })
        .select("role")
        .single();

      if (insertError || !newUser) {
        console.error("Error creating user record:", insertError);
        return null;
      }

      console.log(`Created user record with role: ${defaultRole}`);
      return newUser.role as UserRole;
    }

    // Якщо запис є, але ролі немає, встановлюємо роль за замовчуванням
    if (!data.role) {
      const defaultRole = getDefaultRole();
      const { error: updateError } = await supabase
        .from("users")
        .update({ role: defaultRole })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating user role:", updateError);
        return null;
      }

      console.log(`Updated user role to: ${defaultRole}`);
      return defaultRole;
    }

    // Перевірка, що роль відповідає типу
    const role = data.role as UserRole;
    if (role === "owner" || role === "admin" || role === "worker") {
      return role;
    }

    // Якщо роль невалідна, встановлюємо роль за замовчуванням
    const defaultRole = getDefaultRole();
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: defaultRole })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating invalid user role:", updateError);
      return null;
    }

    return defaultRole;
  } catch (error) {
    console.error("Error in getUserRole:", error);
    return null;
  }
}

/**
 * Отримує користувача та його роль одночасно
 */
export async function getUserWithRole() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, role: null };
  }

  const role = await getUserRole(user.id);
  return { user, role };
}
