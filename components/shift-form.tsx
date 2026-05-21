"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createShift } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils";
import { uk } from "date-fns/locale";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function ShiftForm() {
  const [isPending, setIsPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [shiftDate, setShiftDate] = useState<Date | undefined>();
  const [openedAt, setOpenedAt] = useState<Date | undefined>();
  const [shiftDatePopoverOpen, setShiftDatePopoverOpen] = useState(false);
  const [openedAtPopoverOpen, setOpenedAtPopoverOpen] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!shiftDate) {
      toast.error("Помилка", {
        description: "Оберіть дату зміни",
      });
      return;
    }

    setIsPending(true);

    try {
      const formData = new FormData();
      formData.append("shift_date", dateToYYYYMMDD(shiftDate));
      if (openedAt) {
        formData.append("opened_at", dateToYYYYMMDD(openedAt));
      }
      formData.append("notes", notes || "");
      formData.append("status", "active");
      const result = await createShift(formData);

      if (result.success) {
        toast.success("Зміну створено", {
          description: "Зміну успішно створено",
        });
        setShiftDate(undefined);
        setOpenedAt(undefined);
        setNotes("");
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при створенні зміни",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          <span>Створити зміну</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Створення нової зміни</DialogTitle>
          <DialogDescription>
            Заповніть форму для створення нової зміни
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="shiftDate">Дата зміни</Label>
              <Popover open={shiftDatePopoverOpen} onOpenChange={setShiftDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="shiftDate"
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full min-w-0 justify-start text-left font-normal",
                      !shiftDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {shiftDate ? (
                      formatDate(shiftDate.toISOString())
                    ) : (
                      <span>Оберіть дату</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={shiftDate}
                    onSelect={(nextDate) => {
                      setShiftDate(nextDate);
                      if (nextDate) setShiftDatePopoverOpen(false);
                    }}
                    locale={uk}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="min-w-0 space-y-2">
              <Label htmlFor="openedAt">Дата відкриття зміни (опціонально)</Label>
              <Popover open={openedAtPopoverOpen} onOpenChange={setOpenedAtPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="openedAt"
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full min-w-0 justify-start text-left font-normal",
                      !openedAt && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {openedAt ? (
                      formatDate(openedAt.toISOString())
                    ) : (
                      <span>Оберіть дату</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={openedAt}
                    onSelect={(nextDate) => {
                      setOpenedAt(nextDate);
                      if (nextDate) setOpenedAtPopoverOpen(false);
                    }}
                    locale={uk}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Якщо не вказано, буде використано поточну дату
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Примітки</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Введіть примітки до зміни"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                disabled={isPending || !shiftDate}
                aria-busy={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Створення...
                  </>
                ) : (
                  "Створити зміну"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
