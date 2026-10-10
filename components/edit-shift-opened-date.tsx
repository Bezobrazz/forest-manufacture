"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateShiftOpenedAt } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  getKyivDateString,
  getKyivDateTimeParts,
  kyivCalendarDate,
  toKyivDateString,
} from "@/lib/datetime/kyiv";
import { dateToYYYYMMDD } from "@/lib/utils";
import { uk } from "date-fns/locale";
import type { Shift } from "@/lib/types";

interface EditShiftOpenedDateProps {
  shift: Shift;
}

const pad = (value: number) => String(value).padStart(2, "0");

const initialOpenedSource = (shift: Shift) =>
  shift.opened_at || shift.created_at || shift.shift_date;

export function EditShiftOpenedDate({ shift }: EditShiftOpenedDateProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const openedSource = initialOpenedSource(shift);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() =>
    openedSource ? kyivCalendarDate(openedSource) : undefined,
  );
  const todayKey = getKyivDateString();
  const selectedDateKey = selectedDate ? dateToYYYYMMDD(selectedDate) : "";
  const isToday = selectedDateKey === todayKey;

  const initialTime = useMemo(() => {
    if (!openedSource) return "09:00";
    const openDay = toKyivDateString(openedSource);
    if (openDay !== todayKey) return "09:00";
    const parts = getKyivDateTimeParts(openedSource);
    if (!parts) return "09:00";
    return `${pad(parts.hour)}:${pad(parts.minute)}`;
  }, [openedSource, todayKey]);

  const [openedTime, setOpenedTime] = useState(initialTime);

  const handleSelectDate = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const key = dateToYYYYMMDD(date);
    if (key !== todayKey) {
      setOpenedTime("09:00");
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedDate) {
      toast.error("Помилка", {
        description: "Необхідно вибрати дату відкриття",
      });
      return;
    }

    setIsPending(true);

    try {
      const formData = new FormData();
      formData.append("shift_id", shift.id.toString());
      formData.append("opened_at", dateToYYYYMMDD(selectedDate));
      formData.append(
        "opened_time",
        dateToYYYYMMDD(selectedDate) === todayKey ? openedTime : "09:00",
      );

      const result = await updateShiftOpenedAt(formData);

      if (result.success) {
        toast.success("Час відкриття оновлено", {
          description: "Дату й час відкриття зміни успішно оновлено",
        });
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch {
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні часу відкриття",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1 text-muted-foreground hover:text-foreground"
          title="Редагувати дату й час відкриття"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Дата відкриття зміни</label>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDate}
              locale={uk}
              initialFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opened_time">Час відкриття (Київ)</Label>
            <Input
              id="opened_time"
              type="time"
              value={isToday ? openedTime : "09:00"}
              onChange={(e) => setOpenedTime(e.target.value)}
              disabled={!isToday}
              required
            />
            {!isToday && (
              <p className="text-xs text-muted-foreground">
                Для дня, відмінного від сьогодні, час відкриття — 09:00
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !selectedDate}
              aria-busy={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Збереження…
                </>
              ) : (
                "Зберегти"
              )}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
