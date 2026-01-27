import Link from "next/link";
import { getShifts, getShiftDetails } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NavigationButton } from "@/components/navigation-button";
import { ShiftDatePicker } from "@/components/shift-date-picker";
import { formatDate, getWeekNumber, formatNumberWithUnit } from "@/lib/utils";

import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    year?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const shifts = await getShifts();

  // Розгортаємо Promise searchParams
  const params = await searchParams;

  // Отримуємо поточний тиждень або з параметрів URL
  const currentDate = new Date();
  const currentWeek = params.week
    ? parseInt(params.week)
    : getWeekNumber(currentDate);
  const currentYear = params.year
    ? parseInt(params.year)
    : currentDate.getFullYear();

  // Перевіряємо, чи використовується діапазон дат
  const useDateRange = params.startDate && params.endDate;
  const startDate = params.startDate ? new Date(params.startDate) : null;
  const endDate = params.endDate ? new Date(params.endDate) : null;

  // Отримуємо детальну інформацію про завершені зміни для розрахунку заробітної плати
  const completedShifts = shifts.filter(
    (shift) => shift.status === "completed",
  );
  const shiftsWithDetails = await Promise.all(
    completedShifts.map(async (shift) => await getShiftDetails(shift.id)),
  );

  // Фільтруємо null значення
  const detailedShifts = shiftsWithDetails.filter(Boolean);

  // Функція для отримання дня тижня з дати
  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    const days = [
      "Субота", // 0 (буде використовуватись для getDay() === 6)
      "Неділя", // 1
      "Понеділок", // 2
      "Вівторок", // 3
      "Середа", // 4
      "Четвер", // 5
      "П'ятниця", // 6
    ];
    // Для getDay(): 0 — неділя, 1 — понеділок, ..., 5 — п'ятниця, 6 — субота
    // Але для відображення тижня — субота перша, п'ятниця остання
    // Тому для getDay() використовуємо days[(date.getDay() + 1) % 7]
    return days[(date.getDay() + 1) % 7];
  };

  // Фільтруємо зміни за поточний тиждень або діапазон дат
  const filteredShifts = shifts.filter((shift) => {
    // Використовуємо opened_at, created_at або shift_date для визначення дати зміни
    const shiftDate = new Date(
      shift.opened_at || shift.created_at || shift.shift_date,
    );

    if (useDateRange && startDate && endDate) {
      // Використовуємо діапазон дат
      return shiftDate >= startDate && shiftDate <= endDate;
    } else {
      // Використовуємо тиждень
      const shiftWeek = getWeekNumber(shiftDate);
      const shiftYear = shiftDate.getFullYear();
      return shiftWeek === currentWeek && shiftYear === currentYear;
    }
  });

  // Групуємо зміни за днями тижня і розраховуємо заробітну плату
  const shiftsByDay: Record<
    string,
    {
      day: string;
      date: string;
      shifts: typeof detailedShifts;
      totalWages: number;
    }
  > = {};

  // Загальна сума за тиждень
  let weeklyTotalWages = 0;
  // Додаємо підрахунок загальної кількості продукції за тиждень
  let weeklyTotalProduction = 0;

  // Обробляємо кожну зміну
  detailedShifts.forEach((shift) => {
    if (!shift) return;

    // Використовуємо opened_at, created_at або shift_date для визначення дати зміни
    const shiftDate = new Date(
      shift.opened_at || shift.created_at || shift.shift_date,
    );
    const dayOfWeek = getDayOfWeek(
      shift.opened_at || shift.created_at || shift.shift_date,
    );

    // Перевіряємо, чи зміна належить до фільтрованого діапазону
    let isInRange = false;

    if (useDateRange && startDate && endDate) {
      // Використовуємо діапазон дат
      isInRange = shiftDate >= startDate && shiftDate <= endDate;
    } else {
      // Використовуємо тиждень
      const weekNumber = getWeekNumber(shiftDate);
      const year = shiftDate.getFullYear();
      isInRange = weekNumber === currentWeek && year === currentYear;
    }

    // Якщо не в діапазоні, пропускаємо
    if (!isInRange) return;

    // Розраховуємо заробітну плату для зміни
    let shiftWages = 0;
    if (shift.production && shift.production.length > 0) {
      shift.production.forEach((item) => {
        if (item.product.reward && item.product.reward > 0) {
          shiftWages += item.quantity * item.product.reward;
        }
      });
    }

    // Додаємо до загальної суми за тиждень
    weeklyTotalWages += shiftWages;

    // Додаємо підрахунок продукції
    if (shift.production && shift.production.length > 0) {
      shift.production.forEach((item) => {
        weeklyTotalProduction += item.quantity;
      });
    }

    // Додаємо до групи за днем тижня
    const dateKey = shiftDate.toISOString().split("T")[0]; // Формат YYYY-MM-DD

    if (!shiftsByDay[dateKey]) {
      shiftsByDay[dateKey] = {
        day: dayOfWeek,
        date: shiftDate.toISOString(),
        shifts: [],
        totalWages: 0,
      };
    }

    shiftsByDay[dateKey].shifts.push(shift);
    shiftsByDay[dateKey].totalWages += shiftWages;
  });

  // Сортуємо дні за датою (від найновішого до найстарішого)
  const sortedDays = Object.keys(shiftsByDay).sort().reverse();

  // Функції для навігації між тижнями
  const getPreviousWeek = () => {
    const prevWeek = currentWeek - 1;
    const prevYear = prevWeek <= 0 ? currentYear - 1 : currentYear;
    const actualPrevWeek = prevWeek <= 0 ? 52 : prevWeek; // Приблизно 52 тижні в році
    return `?week=${actualPrevWeek}&year=${prevYear}`;
  };

  const getNextWeek = () => {
    const nextWeek = currentWeek + 1;
    const nextYear = nextWeek > 52 ? currentYear + 1 : currentYear;
    const actualNextWeek = nextWeek > 52 ? 1 : nextWeek;
    return `?week=${actualNextWeek}&year=${nextYear}`;
  };

  const getCurrentWeekUrl = () => {
    const now = new Date();
    return `?week=${getWeekNumber(now)}&year=${now.getFullYear()}`;
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold">
            {useDateRange
              ? startDate &&
                endDate &&
                startDate.toISOString().split("T")[0] ===
                  endDate.toISOString().split("T")[0]
                ? `Зміни за ${formatDate(startDate.toISOString())}`
                : `Зміни з ${formatDate(
                    startDate!.toISOString(),
                  )} по ${formatDate(endDate!.toISOString())}`
              : `Зміни за тиждень ${currentWeek} (${currentYear} р.)`}
          </h1>
          <Link href="/shifts/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              <span>Створити зміну</span>
            </Button>
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-shrink-0">
            <ShiftDatePicker />
          </div>
          {!useDateRange && (
            <div className="flex items-center gap-2 flex-wrap">
              <NavigationButton href={getPreviousWeek()}>
                <ChevronLeft className="h-4 w-4" />
              </NavigationButton>
              <NavigationButton
                href={getCurrentWeekUrl()}
                isCurrentWeek={currentWeek === getWeekNumber(new Date())}
                currentWeekMessage="Ви вже переглядаєте поточний тиждень"
              >
                <span className="hidden sm:inline">Поточний тиждень</span>
                <span className="sm:hidden">Поточний</span>
              </NavigationButton>
              <NavigationButton href={getNextWeek()}>
                <ChevronRight className="h-4 w-4" />
              </NavigationButton>
            </div>
          )}
        </div>
      </div>

      {/* Додаємо секцію з підсумком заробітної плати за тиждень */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <span>
              {useDateRange
                ? `Заробітна плата з ${formatDate(
                    startDate!.toISOString(),
                  )} по ${formatDate(endDate!.toISOString())}`
                : `Заробітна плата за тиждень ${currentWeek}`}
            </span>
          </CardTitle>
          <CardDescription>
            {useDateRange
              ? `Підсумок заробітної плати за завершеними змінами з ${formatDate(
                  startDate!.toISOString(),
                )} по ${formatDate(endDate!.toISOString())}`
              : `Підсумок заробітної плати за завершеними змінами тижня ${currentWeek}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Загальна сума за тиждень
                </div>
                <div className="text-2xl font-bold">
                  {formatNumberWithUnit(weeklyTotalWages, "грн", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Кількість змін
                </div>
                <div className="text-2xl font-bold">
                  {filteredShifts.length}
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Виготовлено продукції
                </div>
                <div className="text-2xl font-bold">
                  {weeklyTotalProduction} шт
                </div>
              </div>
            </div>

            {sortedDays.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Деталі по днях</h4>
                <div className="space-y-2">
                  {sortedDays.map((dateKey) => {
                    const dayData = shiftsByDay[dateKey];
                    return (
                      <div
                        key={dateKey}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <div className="font-medium">{dayData.day}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(dayData.date)}
                          </div>
                        </div>
                        <div className="font-medium">
                          {formatNumberWithUnit(dayData.totalWages, "грн", {
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {useDateRange
                  ? `Немає завершених змін з ${formatDate(
                      startDate!.toISOString(),
                    )} по ${formatDate(endDate!.toISOString())}`
                  : `Немає завершених змін за тиждень ${currentWeek}`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {filteredShifts.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                {useDateRange
                  ? `Немає змін з ${formatDate(
                      startDate!.toISOString(),
                    )} по ${formatDate(endDate!.toISOString())}`
                  : `Немає змін за тиждень ${currentWeek}`}
              </p>
              <Link href="/shifts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Створити зміну</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {filteredShifts.map((shift) => (
            <Link key={shift.id} href={`/shifts/${shift.id}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Зміна #{shift.id}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDate(
                        shift.opened_at || shift.created_at || shift.shift_date,
                      )}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <Badge
                      variant={
                        shift.status === "active" ? "default" : "secondary"
                      }
                    >
                      {shift.status === "active" ? "Активна" : "Завершена"}
                    </Badge>

                    {shift.status === "completed" && shift.completed_at && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Завершено: {formatDate(shift.completed_at)}</span>
                      </div>
                    )}

                    {/* Додаємо інформацію про заробітну плату для завершених змін */}
                    {shift.status === "completed" &&
                      (() => {
                        const shiftDetail = detailedShifts.find(
                          (s) => s?.id === shift.id,
                        );
                        if (!shiftDetail) return null;

                        let shiftWages = 0;
                        if (
                          shiftDetail.production &&
                          shiftDetail.production.length > 0
                        ) {
                          shiftDetail.production.forEach((item) => {
                            if (
                              item.product.reward &&
                              item.product.reward > 0
                            ) {
                              shiftWages += item.quantity * item.product.reward;
                            }
                          });
                        }

                        if (shiftWages > 0) {
                          return (
                            <div className="flex items-center gap-1 text-xs mt-1">
                              <DollarSign className="h-3 w-3 text-primary" />
                              <span className="font-medium">
                                {formatNumberWithUnit(shiftWages, "грн", {
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                    {shift.notes && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {shift.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
