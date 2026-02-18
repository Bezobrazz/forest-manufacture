import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  return `${day}.${month}.${year}`;
}

export function dateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  let day = date.getUTCDate();
  let month = date.getUTCMonth();
  let year = date.getUTCFullYear();
  let hours = date.getUTCHours();
  let minutes = date.getUTCMinutes();

  const isUkrainianDST = () => {
    const year = date.getUTCFullYear();
    const marchLastSunday = new Date(Date.UTC(year, 2, 31));
    marchLastSunday.setUTCDate(31 - marchLastSunday.getUTCDay());
    const octoberLastSunday = new Date(Date.UTC(year, 9, 31));
    octoberLastSunday.setUTCDate(31 - octoberLastSunday.getUTCDay());
    return date >= marchLastSunday && date < octoberLastSunday;
  };

  const offsetHours = isUkrainianDST() ? 3 : 2;
  hours = hours + offsetHours;

  if (hours >= 24) {
    hours = hours - 24;
    day = day + 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month = month + 1;
      if (month > 11) {
        month = 0;
        year = year + 1;
      }
    }
  }

  const dayStr = day.toString().padStart(2, "0");
  const monthStr = (month + 1).toString().padStart(2, "0");
  const yearStr = year.toString();
  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");

  return `${dayStr}.${monthStr}.${yearStr} ${hoursStr}:${minutesStr}`;
}

export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const firstSaturday = new Date(firstDayOfYear);
  const dayOfWeek = firstDayOfYear.getDay();
  const diff = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  firstSaturday.setDate(firstDayOfYear.getDate() + diff);

  if (date < firstSaturday) {
    return 1;
  }

  const pastDays = Math.floor(
    (date.getTime() - firstSaturday.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.floor(pastDays / 7) + 1;
}

export function getDateRangeForPeriod(
  period: "year" | "month" | "week",
  year?: number,
  monthIndex?: number
): { startDate: Date; endDate: Date } {
  const now = new Date();
  const selectedYear = year ?? now.getFullYear();

  switch (period) {
    case "year":
      return {
        startDate: new Date(selectedYear, 0, 1),
        endDate: new Date(selectedYear, 11, 31, 23, 59, 59),
      };
    case "month": {
      const month = monthIndex ?? now.getMonth();
      const start = new Date(selectedYear, month, 1);
      const end = new Date(selectedYear, month + 1, 0, 23, 59, 59);
      return { startDate: start, endDate: end };
    }
    case "week": {
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(now);
      start.setDate(now.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    default:
      return {
        startDate: new Date(selectedYear, 0, 1),
        endDate: new Date(selectedYear, 11, 31, 23, 59, 59),
      };
  }
}

export function formatNumber(
  value: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {}
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useGrouping = true,
  } = options;

  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  }).format(value);
}

export function formatNumberWithUnit(
  value: number,
  unit: string,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {}
): string {
  const formattedNumber = formatNumber(value, options);
  return `${formattedNumber} ${unit}`;
}

export function formatPercentage(
  value: number,
  decimalPlaces: number = 1
): string {
  return (
    new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(value) + "%"
  );
}
