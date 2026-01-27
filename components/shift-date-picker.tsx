"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { formatDate, getWeekNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { uk } from "date-fns/locale";

// Функція для отримання початку тижня (субота) для даної дати
// Тиждень: субота (6) - п'ятниця (5)
function getWeekStart(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = неділя, 1 = понеділок, ..., 6 = субота
  // Якщо це субота (6), початок тижня - це сама дата
  // Якщо це неділя (0), початок тижня - вчора (субота)
  // Якщо це понеділок-п'ятниця (1-5), початок тижня - минула субота
  // Формула: для неділі (0) -> 1 день назад, для інших -> (dayOfWeek + 1) днів назад
  const daysToSubtract = dayOfWeek === 6 ? 0 : dayOfWeek === 0 ? 1 : dayOfWeek + 1;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - daysToSubtract);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Функція для отримання кінця тижня (п'ятниця) для даної дати
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // П'ятниця (субота + 6 днів)
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

export function ShiftDatePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    undefined
  );
  const [selectedWeek, setSelectedWeek] = React.useState<{
    week: number;
    year: number;
    start: Date;
    end: Date;
  } | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Використовуємо useRef для відстеження попередніх значень, щоб уникнути зациклення
  const prevParamsRef = React.useRef<string>("");

  // Отримуємо значення параметрів та створюємо стабільну залежність
  const weekParam = searchParams.get("week");
  const yearParam = searchParams.get("year");
  const paramsKey = React.useMemo(
    () => `${weekParam || ""}-${yearParam || ""}`,
    [weekParam, yearParam]
  );

  // Отримуємо поточний тиждень з URL параметрів
  React.useEffect(() => {
    // Перевіряємо, чи змінилися параметри
    if (prevParamsRef.current === paramsKey) {
      return;
    }
    prevParamsRef.current = paramsKey;
    
    // Скидаємо стан завантаження при зміні параметрів
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    // Якщо є параметри тижня, встановлюємо вибраний тиждень
    if (weekParam && yearParam) {
      const week = parseInt(weekParam);
      const year = parseInt(yearParam);
      
      // Знаходимо суботу цього тижня
      // Перша субота року
      const firstDayOfYear = new Date(year, 0, 1);
      const firstSaturday = new Date(firstDayOfYear);
      const dayOfWeek = firstDayOfYear.getDay();
      const diff = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
      firstSaturday.setDate(firstDayOfYear.getDate() + diff);
      
      // Субота вибраного тижня
      const weekStart = new Date(firstSaturday);
      weekStart.setDate(firstSaturday.getDate() + (week - 1) * 7);
      
      // Перевіряємо, чи не змінився тиждень, щоб уникнути зайвих оновлень
      setSelectedWeek((prev) => {
        if (prev && prev.week === week && prev.year === year) {
          return prev;
        }
        
        return {
          week,
          year,
          start: weekStart,
          end: getWeekEnd(weekStart),
        };
      });
      
      // Встановлюємо дату для відображення в календарі (субота тижня)
      setSelectedDate((prev) => {
        if (prev && prev.getTime() === weekStart.getTime()) {
          return prev;
        }
        return weekStart;
      });
    } else {
      setSelectedWeek((prev) => {
        if (!prev) return prev;
        return null;
      });
      setSelectedDate((prev) => {
        if (!prev) return prev;
        return undefined;
      });
    }
    
    return () => clearTimeout(timer);
  }, [paramsKey, weekParam, yearParam]);

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      setIsLoading(true);
      // Визначаємо тиждень для вибраної дати
      const week = getWeekNumber(date);
      const year = date.getFullYear();
      
      // Перевіряємо, чи не вибрано той самий тиждень
      if (selectedWeek && selectedWeek.week === week && selectedWeek.year === year) {
        setIsLoading(false);
        setIsOpen(false);
        return;
      }
      
      const weekStart = getWeekStart(date);
      const weekEnd = getWeekEnd(date);
      
      // Встановлюємо параметри тижня в URL
      router.push(`/shifts?week=${week}&year=${year}`);
      setIsOpen(false);
    } else {
      // Якщо дата не вибрана, очищаємо параметри
      setIsLoading(true);
      router.push("/shifts");
      setSelectedDate(undefined);
      setSelectedWeek(null);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setIsLoading(true);
    router.push("/shifts");
    setSelectedDate(undefined);
    setSelectedWeek(null);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selectedWeek ? "default" : "outline"}
          className={cn(
            "justify-start text-left font-normal w-full sm:w-auto",
            !selectedWeek && "text-muted-foreground"
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
              <span className="truncate">Завантаження...</span>
            </>
          ) : (
            <>
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {selectedWeek ? (
                <span className="truncate">
                  <span className="hidden sm:inline">
                    Тиждень {selectedWeek.week} ({selectedWeek.year} р.)
                  </span>
                  <span className="sm:hidden">
                    Т. {selectedWeek.week} ({selectedWeek.year})
                  </span>
                </span>
              ) : (
                <span className="truncate">Виберіть тиждень</span>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            locale={uk}
            weekStartsOn={6} // Тиждень починається з суботи
            initialFocus
            className="rounded-md"
          />
          {selectedWeek && (
            <div className="p-3 border-t space-y-2">
              <div className="text-sm text-muted-foreground">
                <div>Тиждень {selectedWeek.week} ({selectedWeek.year} р.)</div>
                <div className="text-xs mt-1 break-words">
                  {formatDate(selectedWeek.start.toISOString())} - {formatDate(selectedWeek.end.toISOString())}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleClear}
              >
                Очистити вибір
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
