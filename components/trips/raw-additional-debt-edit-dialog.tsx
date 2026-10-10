"use client";

import { useEffect, useState } from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { uk } from "date-fns/locale";
import { toast } from "sonner";
import {
  updateRawAdditionalDebt,
  type RawAdditionalDebtItem,
} from "@/app/actions/raw-additional-debt";
import type { Vehicle } from "@/app/vehicles/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils";

const WEEK_STARTS_SAT = 6 as const;

type RawAdditionalDebtEditDialogProps = {
  debt: RawAdditionalDebtItem | null;
  vehicles: Vehicle[];
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatSelectedDates(range: DateRange | undefined): string {
  if (!range?.from) return "Оберіть дату або період";
  const fromLabel = formatDate(range.from.toISOString());
  if (!range.to || dateToYYYYMMDD(range.from) === dateToYYYYMMDD(range.to)) {
    return fromLabel;
  }
  return `${fromLabel} — ${formatDate(range.to.toISOString())}`;
}

export function RawAdditionalDebtEditDialog({
  debt,
  vehicles,
  onOpenChange,
  onUpdated,
}: RawAdditionalDebtEditDialogProps) {
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

  useEffect(() => {
    if (!debt) return;
    setVehicleId(debt.vehicle_id);
    setDateRange({
      from: parseYmdToLocalDate(debt.date_from),
      to: parseYmdToLocalDate(debt.date_to),
    });
    setAmount(String(debt.amount));
    setComment(debt.comment ?? "");
    setDatePickerOpen(false);
  }, [debt]);

  const handleSave = async () => {
    if (!debt) return;
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
      const result = await updateRawAdditionalDebt(debt.id, {
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
      toast.success("Додатковий борг доставки оновлено");
      onOpenChange(false);
      onUpdated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!debt}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Редагувати додатковий борг доставки</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 min-w-0 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Дата / період</Label>
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
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label
              htmlFor="edit-additional-debt-vehicle"
              className="text-xs text-muted-foreground"
            >
              Тип транспорту
            </Label>
            <Select
              value={vehicleId || undefined}
              onValueChange={setVehicleId}
              disabled={submitting}
            >
              <SelectTrigger
                id="edit-additional-debt-vehicle"
                className="h-10 w-full"
              >
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
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label
              htmlFor="edit-additional-debt-amount"
              className="text-xs text-muted-foreground"
            >
              Сума боргу (грн)
            </Label>
            <Input
              id="edit-additional-debt-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="h-10 w-full"
            />
          </div>

          <div className="space-y-1.5 min-w-0 sm:col-span-2">
            <Label
              htmlFor="edit-additional-debt-comment"
              className="text-xs text-muted-foreground"
            >
              Коментар
            </Label>
            <Textarea
              id="edit-additional-debt-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Необов'язково"
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Скасувати
          </Button>
          <Button
            type="button"
            disabled={submitting}
            aria-busy={submitting}
            onClick={() => void handleSave()}
            className="w-full sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Збереження…
              </>
            ) : (
              "Зберегти"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
