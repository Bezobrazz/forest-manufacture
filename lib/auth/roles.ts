// Типи ролей користувачів
export type UserRole = 'owner' | 'admin' | 'worker';

// Ієрархія ролей (вища роль має більше прав)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 3,
  admin: 2,
  worker: 1,
};

// Перевірка, чи одна роль має більше або рівні права ніж інша
export function hasRolePermission(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Перевірка, чи користувач має одну з дозволених ролей
export function hasAnyRole(userRole: UserRole | null, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

// Отримання ролі за замовчуванням
export function getDefaultRole(): UserRole {
  return 'worker';
}





