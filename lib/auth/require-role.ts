import { redirect } from "next/navigation";
import { getUserWithRole } from "./get-user-role";
import { hasAnyRole } from "./roles";
import type { UserRole } from "./roles";

/**
 * Перевіряє, чи користувач має необхідну роль, інакше перенаправляє
 * Використовується в Server Components та Server Actions
 */
export async function requireRole(
  allowedRoles: UserRole[],
  redirectTo: string = "/"
) {
  const { user, role } = await getUserWithRole();

  if (!user) {
    redirect("/auth/login");
  }

  if (!hasAnyRole(role, allowedRoles)) {
    redirect(redirectTo);
  }

  return { user, role };
}

/**
 * Перевіряє, чи користувач авторизований
 */
export async function requireAuth() {
  const { user, role } = await getUserWithRole();

  if (!user) {
    redirect("/auth/login");
  }

  return { user, role };
}
