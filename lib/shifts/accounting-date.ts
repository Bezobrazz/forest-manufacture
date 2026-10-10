import { toKyivDateString } from "@/lib/datetime/kyiv";

type ShiftDateSource = {
  opened_at?: string | null;
  created_at?: string | null;
  shift_date?: string | null;
};

/** Канонічна дата урахування зміни — день відкриття (Київ). */
export const getShiftAccountingDateKey = (shift: ShiftDateSource): string => {
  const raw = shift.opened_at || shift.created_at || shift.shift_date || "";
  return toKyivDateString(raw);
};

export const getShiftAccountingLocalDate = (shift: ShiftDateSource): Date => {
  const key = getShiftAccountingDateKey(shift);
  const [year, month, day] = key
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, day);
};
