import type { Employee } from "@/lib/types";

function inclusiveDaysBetweenYmd(startYmd: string, endYmd: string): number {
  const [ys, ms, ds] = startYmd.split("-").map((x) => Number.parseInt(x, 10));
  const [ye, me, de] = endYmd.split("-").map((x) => Number.parseInt(x, 10));
  const startUtc = Date.UTC(ys, ms - 1, ds, 12);
  const endUtc = Date.UTC(ye, me - 1, de, 12);
  return Math.max(0, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

export function sumManagerMonthlySalaries(employees: Employee[]): number {
  return employees.reduce((sum, employee) => {
    if (!employee.is_manager) return sum;
    const salary = Number(employee.salary ?? 0);
    return Number.isFinite(salary) && salary > 0 ? sum + salary : sum;
  }, 0);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseYmd(ymd: string): { year: number; monthIndex: number; day: number } {
  const [year, month, day] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return { year, monthIndex: month - 1, day };
}

export function prorateMonthlyAmountForDateRange(
  monthlyAmount: number,
  startYmd: string,
  endYmd: string
): number {
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return 0;

  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (startYmd > endYmd) return 0;

  let year = start.year;
  let monthIndex = start.monthIndex;
  let total = 0;

  while (
    year < end.year ||
    (year === end.year && monthIndex <= end.monthIndex)
  ) {
    const monthDays = daysInMonth(year, monthIndex);
    const month = String(monthIndex + 1).padStart(2, "0");
    const monthStartYmd = `${year}-${month}-01`;
    const monthEndYmd = `${year}-${month}-${String(monthDays).padStart(2, "0")}`;

    const overlapStartYmd = startYmd > monthStartYmd ? startYmd : monthStartYmd;
    const overlapEndYmd = endYmd < monthEndYmd ? endYmd : monthEndYmd;

    if (overlapStartYmd <= overlapEndYmd) {
      const overlapDays = inclusiveDaysBetweenYmd(
        overlapStartYmd,
        overlapEndYmd
      );
      total += monthlyAmount * (overlapDays / monthDays);
    }

    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }

  return total;
}
