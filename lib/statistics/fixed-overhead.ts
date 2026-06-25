export const AVERAGE_PRODUCTION_MONTHS_BACK = 6;

export type ShiftProductionLike = {
  shift_date: string;
  status: string;
  production?: { quantity?: number | null }[] | null;
};

function monthProduction(
  shifts: ShiftProductionLike[],
  year: number,
  monthIndex: number
): number {
  const month = String(monthIndex + 1).padStart(2, "0");
  const prefix = `${year}-${month}`;

  return shifts.reduce((sum, shift) => {
    if (shift.status !== "completed") return sum;
    const day = String(shift.shift_date).slice(0, 10);
    if (!day.startsWith(prefix)) return sum;
    const producedInShift =
      shift.production?.reduce(
        (acc, item) => acc + Number(item.quantity ?? 0),
        0
      ) ?? 0;
    return sum + producedInShift;
  }, 0);
}

export function averageMonthlyProductionBags(
  shifts: ShiftProductionLike[],
  referenceEndYmd: string,
  monthsBack: number = AVERAGE_PRODUCTION_MONTHS_BACK
): number | null {
  if (!referenceEndYmd || monthsBack < 1) return null;

  const [year, month] = referenceEndYmd
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  let monthIndex = month - 1;
  let currentYear = year;
  const monthlyTotals: number[] = [];

  for (let i = 0; i < monthsBack; i++) {
    monthlyTotals.push(monthProduction(shifts, currentYear, monthIndex));
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      currentYear -= 1;
    }
  }

  const monthsWithProduction = monthlyTotals.filter((total) => total > 0);
  if (monthsWithProduction.length === 0) return null;

  return (
    monthsWithProduction.reduce((sum, total) => sum + total, 0) /
    monthsWithProduction.length
  );
}

export function monthlyOverheadPerBag(
  monthlyAmount: number,
  averageMonthlyProduction: number | null
): number {
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return 0;
  if (
    averageMonthlyProduction == null ||
    !Number.isFinite(averageMonthlyProduction) ||
    averageMonthlyProduction <= 0
  ) {
    return 0;
  }

  return monthlyAmount / averageMonthlyProduction;
}
