"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarIcon, Loader2, Package, Truck } from "lucide-react";
import { uk } from "date-fns/locale";
import {
  getMiniAppOperations,
  type MiniAppOperation,
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

type FieldOperationsPanelProps = {
  active?: boolean;
};

export function FieldOperationsPanel({ active = true }: FieldOperationsPanelProps) {
  const [period, setPeriod] = useState<PeriodMode>("day");
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [operations, setOperations] = useState<MiniAppOperation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const result = await getMiniAppOperations(bounds.from, bounds.to);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setOperations([]);
        return;
      }
      setError(null);
      setOperations(result.operations);
    });
    return () => {
      cancelled = true;
    };
  }, [active, bounds.from, bounds.to]);

  const totals = useMemo(() => {
    return operations.reduce(
      (acc, op) => {
        acc.bags += Math.floor(op.quantity);
        acc.amount += op.payable_amount;
        return acc;
      },
      { bags: 0, amount: 0 }
    );
  }, [operations]);

  const pickerLabel =
    period === "month"
      ? formatPeriodLabel("month", bounds.from, bounds.to)
      : formatDate(`${dateToYYYYMMDD(anchorDate)}T12:00:00.000Z`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
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
                "justify-start font-normal",
                !anchorDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
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
                setAnchorDate(
                  new Date(anchorDate.getFullYear(), month, 1)
                );
              }}
            >
              <SelectTrigger className="h-8 w-[140px]">
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
              <SelectTrigger className="h-8 w-[100px]">
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

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>Період: {formatPeriodLabel(period, bounds.from, bounds.to)}</span>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Завантаження" />
        ) : (
          <span>
            {operations.length} оп. · {formatNumberWithUnit(totals.bags, "міш.")} ·{" "}
            {formatMoney(Math.round(totals.amount * 100) / 100)}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!error && !isPending && operations.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Немає внесених операцій за цей період
        </p>
      ) : null}

      <div className="space-y-2">
        {operations.map((op) => (
          <article
            key={op.id}
            className="rounded-lg border bg-card p-3 text-sm shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{op.supplier_name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Package className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{op.product_name}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-medium">{formatMoney(op.payable_amount)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(op.created_at)}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{formatNumberWithUnit(Math.floor(op.quantity), "міш.")}</span>
              {op.price_per_unit != null ? (
                <span>{formatMoney(op.price_per_unit)} / од.</span>
              ) : null}
              {op.material_quantity != null && op.material_quantity > 0 ? (
                <span>
                  Мішки: {formatNumberWithUnit(op.material_quantity, "шт")}
                </span>
              ) : null}
              {op.access_name ? <span>Хто: {op.access_name}</span> : null}
            </div>
            {op.additional_info ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {op.additional_info}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
