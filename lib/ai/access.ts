import { hasAnyRole, type UserRole } from "@/lib/auth/roles";

export const AI_ALLOWED_ROLES: UserRole[] = ["owner", "admin"];

export function canUseAiAssistant(role: UserRole | null | undefined): boolean {
  return hasAnyRole(role ?? null, AI_ALLOWED_ROLES);
}
