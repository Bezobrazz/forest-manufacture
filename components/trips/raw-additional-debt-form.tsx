"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { uk } from "date-fns/locale";
import { toast } from "sonner";
import { createRawAdditionalDebt } from "@/app/actions/raw-additional-debt";
import type { Vehicle } from "@/app/vehicles/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils";

const WEEK_STARTS_SAT = 6 as const;

type RawAdditionalDebtFormProps = {
  vehicles: Vehicle[];
  onCreated: () => void;
};

function formatSelectedDates(range: DateRange | undefined): string {
  if (!range?.from) return "Оберіть дату або період";
  const fromLabel = formatDate(range.from.toISOString());
  if (!range.to || dateToYYYYMMDD(range.from) === dateToYYYYMMDD(range.to)) {
    return fromLabel;
  }
  return `${fromLabel} — ${formatDate(range.to.toISOString())}`;
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function RawAdditionalDebtForm({
  vehicles,
  onCreated,
}: RawAdditionalDebtFormProps) {
  const [vehicleId, setVehicleId] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calendarMonths, setCalendarMonths] = useState(1);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setCalendarMonths(mq.matches ? 2 : 1);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const resetForm = () => {
    setVehicleId("");
    setDateRange(undefined);
    setAmount("");
    setComment("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId.trim()) {
      toast.error("Оберіть транспорт");
      return;
    }
    if (!dateRange?.from) {
      toast.error("Оберіть дату або період");
      return;
    }
    const amountValue = Number(amount);
    if (!(amountValue > 0)) {
      toast.error("Вкажіть суму більше нуля");
      return;
    }

    const dateFrom = dateToYYYYMMDD(dateRange.from);
    const dateTo = dateRange.to ? dateToYYYYMMDD(dateRange.to) : dateFrom;

    setSubmitting(true);
    try {
      const result = await createRawAdditionalDebt({
        vehicleId,
        amount: amountValue,
        dateFrom,
        dateTo,
        comment,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Додатковий борг доставки додано");
      resetForm();
      onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Дата / період">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className={cn(
                  "h-10 w-full justify-start text-left font-normal",
                  !dateRange?.from && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {formatSelectedDates(dateRange)}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(100vw-2rem,auto)] max-w-[calc(100vw-2rem)] p-0 sm:w-auto sm:max-w-none"
              align="start"
            >
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  if (!range) {
                    setDateRange(undefined);
                    return;
                  }
                  setDateRange({
                    from: range.from,
                    to: range.to ?? range.from,
                  });
                  if (range.from && range.to) {
                    setDatePickerOpen(false);
                  }
                }}
                numberOfMonths={calendarMonths}
                locale={uk}
                weekStartsOn={WEEK_STARTS_SAT}
              />
              <div className="border-t p-2 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setDateRange(undefined)}
                >
                  Скинути
                </Button>
                {dateRange?.from && !dateRange.to ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setDateRange({
                        from: dateRange.from,
                        to: dateRange.from,
                      });
                      setDatePickerOpen(false);
                    }}
                  >
                    Одна дата
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        </Field>

        <Field label="Тип транспорту" htmlFor="additional-debt-vehicle">
          <Select
            value={vehicleId || undefined}
            onValueChange={setVehicleId}
            disabled={submitting}
          >
            <SelectTrigger id="additional-debt-vehicle" className="h-10 w-full">
              <SelectValue placeholder="Оберіть авто" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Сума боргу (грн)" htmlFor="additional-debt-amount">
          <Input
            id="additional-debt-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            className="h-10 w-full"
          />
        </Field>

        <Field label="Коментар" htmlFor="additional-debt-comment">
          <Input
            id="additional-debt-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Необов'язково"
            disabled={submitting}
            className="h-10 w-full"
          />
        </Field>
      </div>

      <div className="flex justify-stretch sm:justify-end">
        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="h-10 w-full sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Збереження…
            </>
          ) : (
            "Додати борг"
          )}
        </Button>
      </div>
    </form>
  );
}
