/** Узгоджено з фільтром у complete_shift_apply_production (міграція). */
export function isBarkFinishedProductName(name: string): boolean {
  const n = name.toLowerCase();
  if (!n.includes("кора")) return false;
  if (n.includes("мішок") || n.includes("пакувальн")) return false;
  return true;
}
