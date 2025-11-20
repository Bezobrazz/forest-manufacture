"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShiftOpenedAt } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Pencil, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { uk } from "date-fns/locale";
import type { Shift } from "@/lib/types";

interface EditShiftOpenedDateProps {
  shift: Shift;
}

export function EditShiftOpenedDate({ shift }: EditShiftOpenedDateProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Правильно ініціалізуємо дату, щоб уникнути проблем з часовими поясами
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (!shift.opened_at) return undefined;
    
    // Створюємо дату з UTC
    const utcDate = new Date(shift.opened_at);
    // Використовуємо UTC методи для отримання компонентів, щоб уникнути зміщення
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth();
    const day = utcDate.getUTCDate();
    
    // Створюємо нову дату в локальному часовому поясі з тими ж компонентами
    // Використовуємо локальний конструктор, щоб календарь показував правильну дату
    return new Date(year, month, day);
  });

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
      
      // Використовуємо локальні методи для отримання дати, щоб уникнути проблем з часовими поясами
      const year = selectedDate.getFullYear();
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
      const day = selectedDate.getDate().toString().padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      
      formData.append("opened_at", dateString);

      const result = await updateShiftOpenedAt(formData);

      if (result.success) {
        toast.success("Дату відкриття оновлено", {
          description: "Дату відкриття зміни успішно оновлено",
        });
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні дати відкриття",
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
          title="Редагувати дату відкриття"
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
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                }
              }}
              locale={uk}
              initialFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Скасувати
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !selectedDate}>
              {isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

