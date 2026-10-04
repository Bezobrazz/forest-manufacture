"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Loader2, Package, Route, Truck } from "lucide-react";
import { uk } from "date-fns/locale";
import {
  getMiniAppOperations,
  type MiniAppOperation,
  type MiniAppTripOperation,
} from "@/app/m/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cn,
  dateToYYYYMMDD,
  formatDate,
  formatNumberWithUnit,
} from "@/lib/utils";

type PeriodMode = "day" | "week" | "month";

const MONTH_LABELS = [...Array(12)].map((_, i) =>
  new Date(2024, i, 15).toLocaleDateString("uk-UA", { month: "long" })
);

const WEEK_STARTS_SAT = 6 as const;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekStart(date: Date): Date {
  const d = startOfLocalDay(date);
  const day = d.getDay();
  const saturdayOffset = day === 6 ? 0 : day === 0 ? -1 : -(day + 1);
  d.setDate(d.getDate() + saturdayOffset);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

function getPeriodBounds(
  period: PeriodMode,
  anchor: Date
): { from: string; to: string } {
  if (period === "day") {
    const ymd = dateToYYYYMMDD(anchor);
    return { from: ymd, to: ymd };
  }
  if (period === "week") {
    return {
      from: dateToYYYYMMDD(getWeekStart(anchor)),
      to: dateToYYYYMMDD(getWeekEnd(anchor)),
    };
  }
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: dateToYYYYMMDD(from), to: dateToYYYYMMDD(to) };
}

function formatPeriodLabel(period: PeriodMode, from: string, to: string): string {
  if (period === "day" || from === to) {
    return formatDate(`${from}T12:00:00.000Z`);
  }
  if (period === "month") {
    const [y, m] = from.split("-").map(Number);
    const monthName = MONTH_LABELS[(m ?? 1) - 1] ?? "";
    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}`;
  }
  return `${formatDate(`${from}T12:00:00.000Z`)} — ${formatDate(`${to}T12:00:00.000Z`)}`;
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₴`;
}

function dayKeyFromIso(value: string): string {
  return value.slice(0, 10);
}

type DayGroup = {
  day: string;
  trips: MiniAppTripOperation[];
  purchases: MiniAppOperation[];
};

type FieldOperationsPanelProps = {
  active?: boolean;
};

export function FieldOperationsPanel({
  active = true,
}: FieldOperationsPanelProps) {
  const [period, setPeriod] = useState<PeriodMode>("month");
  const [anchorDate, setAnchorDate] = useState(() =>
    startOfLocalDay(new Date())
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [operations, setOperations] = useState<MiniAppOperation[]>([]);
  const [trips, setTrips] = useState<MiniAppTripOperation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const bounds = useMemo(
    () => getPeriodBounds(period, anchorDate),
    [period, anchorDate]
  );

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const anchorYear = anchorDate.getFullYear();
    const years = new Set<number>();
    for (let y = current - 2; y <= current + 1; y += 1) years.add(y);
    years.add(anchorYear);
    return [...years].sort((a, b) => a - b);
  }, [anchorDate]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      const result = await getMiniAppOperations(bounds.from, bounds.to);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setOperations([]);
        setTrips([]);
        setIsLoading(false);
        return;
      }
      setOperations(result.operations);
      setTrips(result.trips);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, bounds.from, bounds.to]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, DayGroup>();

    for (const trip of trips) {
      const day = trip.trip_date;
      if (!day) continue;
      const group = map.get(day) ?? { day, trips: [], purchases: [] };
      group.trips.push(trip);
      map.set(day, group);
    }

    for (const purchase of operations) {
      const day = dayKeyFromIso(purchase.created_at);
      if (!day) continue;
      const group = map.get(day) ?? { day, trips: [], purchases: [] };
      group.purchases.push(purchase);
      map.set(day, group);
    }

    return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [operations, trips]);

  const totals = useMemo(() => {
    const bags = operations.reduce(
      (sum, op) => sum + Math.floor(op.quantity),
      0
    );
    const amount = operations.reduce((sum, op) => sum + op.payable_amount, 0);
    return {
      bags,
      amount: Math.round(amount * 100) / 100,
      trips: trips.length,
      purchases: operations.length,
    };
  }, [operations, trips]);

  const pickerLabel =
    period === "month"
      ? formatPeriodLabel("month", bounds.from, bounds.to)
      : formatDate(`${dateToYYYYMMDD(anchorDate)}T12:00:00.000Z`);

  const isEmpty = !isLoading && !error && dayGroups.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["day", "День"],
            ["week", "Тиждень"],
            ["month", "Місяць"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            className="h-9 px-3 text-sm"
            variant={period === value ? "default" : "outline"}
            onClick={() => setPeriod(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-9 justify-start font-normal",
                !anchorDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0" />
              {pickerLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={anchorDate}
              onSelect={(date) => {
                if (!date) return;
                setAnchorDate(startOfLocalDay(date));
                setCalendarOpen(false);
              }}
              defaultMonth={anchorDate}
              locale={uk}
              weekStartsOn={WEEK_STARTS_SAT}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {period === "month" ? (
          <>
            <Select
              value={String(anchorDate.getMonth())}
              onValueChange={(value) => {
                const month = Number(value);
                setAnchorDate(new Date(anchorDate.getFullYear(), month, 1));
              }}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Місяць" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_LABELS.map((label, idx) => (
                  <SelectItem key={label} value={String(idx)}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(anchorDate.getFullYear())}
              onValueChange={(value) => {
                const year = Number(value);
                setAnchorDate(new Date(year, anchorDate.getMonth(), 1));
              }}
            >
              <SelectTrigger className="h-9 w-[100px]">
                <SelectValue placeholder="Рік" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
      </div>

      <div className="space-y-1 text-sm text-muted-foreground">
        <div>Період: {formatPeriodLabel(period, bounds.from, bounds.to)}</div>
        {!isLoading ? (
          <div>
            {totals.purchases} закупівель · {totals.trips} поїздок ·{" "}
            {formatNumberWithUnit(totals.bags, "міш.")} ·{" "}
            {formatMoney(totals.amount)}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isLoading ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          <p className="text-sm">Завантаження операцій…</p>
        </div>
      ) : null}

      {isEmpty ? (
        <p className="py-10 text-center text-base text-muted-foreground">
          Немає внесених операцій за цей період
        </p>
      ) : null}

      {!isLoading ? (
        <div className="space-y-5">
          {dayGroups.map((group) => (
            <section key={group.day} className="space-y-3">
              <h2 className="text-base font-semibold">
                {formatDate(`${group.day}T12:00:00.000Z`)}
              </h2>

              {group.trips.map((trip) => (
                <article
                  key={`trip-${trip.id}`}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 text-base font-semibold">
                        <Route className="h-5 w-5 shrink-0 text-primary" />
                        <span>Поїздка</span>
                      </div>
                      <p className="text-base font-medium">{trip.vehicle_name}</p>
                    </div>
                    {trip.distance_km != null ? (
                      <div className="shrink-0 text-right text-base font-semibold">
                        {formatNumberWithUnit(trip.distance_km, "км")}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {trip.start_odometer_km != null &&
                    trip.end_odometer_km != null ? (
                      <div className="rounded-lg bg-background/70 px-3 py-2">
                        <div className="text-xs text-muted-foreground">
                          Одометр
                        </div>
                        <div className="font-medium">
                          {trip.start_odometer_km} → {trip.end_odometer_km}
                        </div>
                      </div>
                    ) : null}
                    {trip.bags_count != null ? (
                      <div className="rounded-lg bg-background/70 px-3 py-2">
                        <div className="text-xs text-muted-foreground">
                          Мішки
                        </div>
                        <div className="font-medium">
                          {formatNumberWithUnit(trip.bags_count, "шт")}
                        </div>
                      </div>
                    ) : null}
                    {trip.fuel_cost_uah != null ? (
                      <div className="rounded-lg bg-background/70 px-3 py-2">
                        <div className="text-xs text-muted-foreground">
                          Пальне
                        </div>
                        <div className="font-medium">
                          {formatMoney(trip.fuel_cost_uah)}
                        </div>
                      </div>
                    ) : null}
                    {trip.total_costs_uah != null ? (
                      <div className="rounded-lg bg-background/70 px-3 py-2">
                        <div className="text-xs text-muted-foreground">
                          Витрати
                        </div>
                        <div className="font-medium">
                          {formatMoney(trip.total_costs_uah)}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {trip.access_name ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Хто: {trip.access_name}
                    </p>
                  ) : null}
                </article>
              ))}

              {group.purchases.map((op) => (
                <article
                  key={`purchase-${op.id}`}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 text-base font-semibold">
                        <Truck className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{op.supplier_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4 shrink-0" />
                        <span className="truncate">{op.product_name}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-semibold">
                        {formatMoney(op.payable_amount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumberWithUnit(Math.floor(op.quantity), "міш.")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {op.price_per_unit != null ? (
                      <span>{formatMoney(op.price_per_unit)} / од.</span>
                    ) : null}
                    {op.material_quantity != null &&
                    op.material_quantity > 0 ? (
                      <span>
                        Мішки:{" "}
                        {formatNumberWithUnit(op.material_quantity, "шт")}
                      </span>
                    ) : null}
                    {op.access_name ? <span>Хто: {op.access_name}</span> : null}
                  </div>

                  {op.additional_info ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {op.additional_info}
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
