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

function num(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function row(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => escapeCsvCell(v == null ? "" : String(v)))
    .join(",");
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
    num(trip.days_count),
    tripStatusLabel(trip.profit_uah),
    num(trip.start_odometer_km),
    num(trip.end_odometer_km),
    num(trip.distance_km),
    num(trip.fuel_consumption_l_per_100km),
    num(trip.fuel_price_uah_per_l),
    num(trip.fuel_used_l),
    num(trip.fuel_cost_uah),
    num(trip.depreciation_uah_per_km),
    num(trip.depreciation_cost_uah),
    num(trip.daily_taxes_uah),
    num(trip.taxes_cost_uah),
    num(trip.freight_uah),
    driverPayModeLabels[driverMode] ?? trip.driver_pay_mode ?? "",
    num(trip.driver_pay_uah),
    num(trip.driver_pay_uah_per_day),
    num(trip.driver_pay_percent_of_freight),
    num(trip.driver_cost_uah),
    num(trip.extra_costs_uah),
    trip.trip_type === "raw" ? num(trip.bags_count) : "",
    trip.trip_type === "raw" && typeof costPerBag === "number"
      ? num(costPerBag)
      : "",
    num(trip.total_costs_uah),
    num(trip.profit_uah),
    num(trip.profit_per_km_uah),
    num(trip.roi_percent),
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
