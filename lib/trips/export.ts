import type { TripDetail } from "@/app/trips/actions";
import type { DriverPayMode, TripType } from "@/lib/trips/calc";

export type TripExportRow = TripDetail;

export type TripExportStatusFilter = "" | "profit" | "breakeven" | "loss";

export type TripExportFilter = {
  dateFrom?: string;
  dateTo?: string;
  vehicleId?: string;
  statusFilter: TripExportStatusFilter;
  tripType: TripType;
};

const driverPayModeLabels: Record<DriverPayMode, string> = {
  per_trip: "За рейс",
  per_day: "За день",
  percent_of_freight: "% від фрахту",
};

const tripTypeLabels: Record<TripType, string> = {
  raw: "Сировина",
  commerce: "Комерція",
};

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

function tripStatusLabel(profit: number | null): string {
  if (profit == null) return "";
  if (profit > 0) return "Прибуток";
  if (profit === 0) return "Нуль";
  return "Збиток";
}

/** Роздільник колонок для Excel (uk-UA): кома — десятковий знак, крапка в числі = текст. */
export const CSV_DELIMITER = ";";

/** Число для підсумків у таблиці: цілі без дробу, дробові з комою. */
export function formatExportNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(".", ",");
}

export function escapeCsvCell(
  value: string,
  delimiter: string = CSV_DELIMITER,
): string {
  const needsQuotes = new RegExp(`[${delimiter}"\\n\\r]`).test(value);
  if (needsQuotes) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function row(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => escapeCsvCell(v == null ? "" : String(v)))
    .join(CSV_DELIMITER);
}

export function filterTripsForExport(
  trips: TripExportRow[],
  filter: TripExportFilter,
): TripExportRow[] {
  return trips.filter((t) => {
    if (t.trip_type !== filter.tripType) return false;
    if (filter.dateFrom && t.trip_date < filter.dateFrom) return false;
    if (filter.dateTo && t.trip_date > filter.dateTo) return false;
    if (filter.vehicleId && t.vehicle_id !== filter.vehicleId) return false;
    if (filter.statusFilter) {
      const p = t.profit_uah ?? 0;
      if (filter.statusFilter === "profit" && p <= 0) return false;
      if (filter.statusFilter === "breakeven" && p !== 0) return false;
      if (filter.statusFilter === "loss" && p >= 0) return false;
    }
    return true;
  });
}

function tripToValues(trip: TripExportRow): string[] {
  const bags = trip.bags_count ?? 0;
  const totalCosts = trip.total_costs_uah ?? 0;
  const costPerBag =
    trip.trip_type === "raw" && bags > 0
      ? Math.round((totalCosts / bags) * 100) / 100
      : "";

  const driverMode = (trip.driver_pay_mode ?? "per_trip") as DriverPayMode;

  return [
    trip.id,
    trip.name?.trim() ?? "",
    tripTypeLabels[trip.trip_type === "commerce" ? "commerce" : "raw"],
    trip.vehicle?.name ?? "",
    formatDisplayDate(trip.trip_start_date ?? trip.trip_date),
    formatDisplayDate(trip.trip_end_date ?? trip.trip_date),
    trip.trip_start_date ?? trip.trip_date ?? "",
    trip.trip_end_date ?? trip.trip_date ?? "",
    formatExportNumber(trip.days_count),
    tripStatusLabel(trip.profit_uah),
    formatExportNumber(trip.start_odometer_km),
    formatExportNumber(trip.end_odometer_km),
    formatExportNumber(trip.distance_km),
    formatExportNumber(trip.fuel_consumption_l_per_100km),
    formatExportNumber(trip.fuel_price_uah_per_l),
    formatExportNumber(trip.fuel_used_l),
    formatExportNumber(trip.fuel_cost_uah),
    formatExportNumber(trip.depreciation_uah_per_km),
    formatExportNumber(trip.depreciation_cost_uah),
    formatExportNumber(trip.daily_taxes_uah),
    formatExportNumber(trip.taxes_cost_uah),
    formatExportNumber(trip.freight_uah),
    driverPayModeLabels[driverMode] ?? trip.driver_pay_mode ?? "",
    formatExportNumber(trip.driver_pay_uah),
    formatExportNumber(trip.driver_pay_uah_per_day),
    formatExportNumber(trip.driver_pay_percent_of_freight),
    formatExportNumber(trip.driver_cost_uah),
    formatExportNumber(trip.extra_costs_uah),
    trip.trip_type === "raw" ? formatExportNumber(trip.bags_count) : "",
    trip.trip_type === "raw" && typeof costPerBag === "number"
      ? formatExportNumber(costPerBag)
      : "",
    formatExportNumber(trip.total_costs_uah),
    formatExportNumber(trip.profit_uah),
    formatExportNumber(trip.profit_per_km_uah),
    formatExportNumber(trip.roi_percent),
    trip.notes?.trim() ?? "",
  ];
}

const EXPORT_HEADERS = [
  "ID",
  "Назва",
  "Тип",
  "Транспорт",
  "Дата початку",
  "Дата кінця",
  "Дата початку (ISO)",
  "Дата кінця (ISO)",
  "Днів",
  "Статус",
  "Одометр початок (км)",
  "Одометр кінець (км)",
  "Відстань (км)",
  "Витрата палива (л/100 км)",
  "Ціна палива (грн/л)",
  "Паливо використано (л)",
  "Вартість палива (грн)",
  "Амортизація (грн/км)",
  "Вартість амортизації (грн)",
  "Щоденні податки (грн)",
  "Вартість податків (грн)",
  "Фрахт (грн)",
  "Оплата водія — режим",
  "Оплата водія за рейс (грн)",
  "Оплата водія за день (грн)",
  "% водія від фрахту",
  "Вартість водія (грн)",
  "Додаткові витрати (грн)",
  "Мішки",
  "Ціна мішка (грн)",
  "Загальні витрати (грн)",
  "Прибуток (грн)",
  "Прибуток (грн/км)",
  "ROI (%)",
  "Примітки",
];

export function buildTripsCsv(trips: TripExportRow[]): string {
  const lines = [
    row(EXPORT_HEADERS),
    ...trips.map((t) => row(tripToValues(t))),
  ];
  return lines.join("\r\n");
}

const periodSlug: Record<string, string> = {
  all: "uves",
  year: "rik",
  month: "misyats",
  week: "tyzhden",
};

export function buildTripsExportFilename(
  tripType: TripType,
  period: string,
  year: number,
): string {
  const typePart = tripType === "commerce" ? "komeriya" : "syrovyna";
  const periodPart = periodSlug[period] ?? period;
  if (period === "all") {
    return `reyisy-${typePart}-${periodPart}.csv`;
  }
  return `reyisy-${typePart}-${year}-${periodPart}.csv`;
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
