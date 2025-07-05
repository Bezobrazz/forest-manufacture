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
import { formatDate, formatDateTime, getWeekNumber } from "@/lib/utils";
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
  searchParams: { week?: string };
}) {
  const shifts = await getShifts();

  // Отримуємо поточний тиждень або з параметрів URL
  const currentDate = new Date();
  const currentWeek = searchParams.week
    ? parseInt(searchParams.week)
    : getWeekNumber(currentDate);
  const currentYear = currentDate.getFullYear();

  // Отримуємо детальну інформацію про завершені зміни для розрахунку заробітної плати
  const completedShifts = shifts.filter(
    (shift) => shift.status === "completed"
  );
  const shiftsWithDetails = await Promise.all(
    completedShifts.map(async (shift) => await getShiftDetails(shift.id))
  );

  // Фільтруємо null значення
  const detailedShifts = shiftsWithDetails.filter(Boolean);

  // Функція для отримання дня тижня з дати
  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    const days = [
      "Неділя",
      "Понеділок",
      "Вівторок",
      "Середа",
      "Четвер",
      "П'ятниця",
      "Субота",
    ];
    return days[date.getDay()];
  };

  // Фільтруємо зміни за поточний тиждень
  const shiftsForCurrentWeek = shifts.filter((shift) => {
    const shiftDate = new Date(shift.shift_date);
    const shiftWeek = getWeekNumber(shiftDate);
    const shiftYear = shiftDate.getFullYear();
    return shiftWeek === currentWeek && shiftYear === currentYear;
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

  // Обробляємо кожну зміну
  detailedShifts.forEach((shift) => {
    if (!shift) return;

    const shiftDate = new Date(shift.shift_date);
    const dayOfWeek = getDayOfWeek(shift.shift_date);
    const weekNumber = getWeekNumber(shiftDate);
    const year = shiftDate.getFullYear();

    // Перевіряємо, чи зміна належить до поточного тижня
    const isCurrentWeek = weekNumber === currentWeek && year === currentYear;

    // Якщо не поточний тиждень, пропускаємо
    if (!isCurrentWeek) return;

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
    return `?week=${actualPrevWeek}${
      prevYear !== currentYear ? `&year=${prevYear}` : ""
    }`;
  };

  const getNextWeek = () => {
    const nextWeek = currentWeek + 1;
    const nextYear = nextWeek > 52 ? currentYear + 1 : currentYear;
    const actualNextWeek = nextWeek > 52 ? 1 : nextWeek;
    return `?week=${actualNextWeek}${
      nextYear !== currentYear ? `&year=${nextYear}` : ""
    }`;
  };

  const getCurrentWeekUrl = () => {
    return `?week=${getWeekNumber(new Date())}`;
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

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Зміни за тиждень {currentWeek}</h1>
          <div className="flex items-center gap-2">
            <Link href={getPreviousWeek()}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={getCurrentWeekUrl()}>
              <Button variant="outline" size="sm">
                Поточний тиждень
              </Button>
            </Link>
            <Link href={getNextWeek()}>
              <Button variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <Link href="/shifts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            <span>Створити зміну</span>
          </Button>
        </Link>
      </div>

      {/* Додаємо секцію з підсумком заробітної плати за тиждень */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <span>Заробітна плата за тиждень {currentWeek}</span>
          </CardTitle>
          <CardDescription>
            Підсумок заробітної плати за завершеними змінами тижня {currentWeek}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Загальна сума за тиждень
                </div>
                <div className="text-2xl font-bold">
                  {weeklyTotalWages.toFixed(2)} грн
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">
                  Кількість змін
                </div>
                <div className="text-2xl font-bold">
                  {shiftsForCurrentWeek.length}
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
                          {dayData.totalWages.toFixed(2)} грн
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Немає завершених змін за тиждень {currentWeek}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {shiftsForCurrentWeek.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Немає змін за тиждень {currentWeek}
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
          {shiftsForCurrentWeek.map((shift) => (
            <Link key={shift.id} href={`/shifts/${shift.id}`}>
              <Card className="h-full hover:bg-muted/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Зміна #{shift.id}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(shift.shift_date)}</span>
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
                          (s) => s?.id === shift.id
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
                                {shiftWages.toFixed(2)} грн
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
