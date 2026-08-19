export const SHIFT_EMPLOYEE_COUNT_MAX = 5;
export const SHIFT_EMPLOYEE_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;

export type ShiftEmployeeCount = (typeof SHIFT_EMPLOYEE_COUNT_OPTIONS)[number];

export function shiftEmployeeCountLabel(count: number): string {
  if (count === 1) return "1 працівник";
  if (count >= 2 && count <= 4) return `${count} працівники`;
  return `${count} працівників`;
}

export function parseShiftEmployeeCount(value: unknown): ShiftEmployeeCount | null {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > SHIFT_EMPLOYEE_COUNT_MAX
  ) {
    return null;
  }

  return parsed as ShiftEmployeeCount;
}

export function getShiftEmployeeCount(shift: {
  employee_count?: number | null;
  employees?: unknown[] | null;
}): number {
  return parseShiftEmployeeCount(shift.employee_count) ?? shift.employees?.length ?? 0;
}
