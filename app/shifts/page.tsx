import Link from "next/link";
import { getExpenses, getShifts } from "@/app/actions";
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
import { QuickActionsButton } from "@/components/quick-actions-button";
import { PreviousPageButton } from "@/components/previous-page-button";
import { formatDate, getWeekNumber, formatNumberWithUnit } from "@/lib/utils";
import {
  parseShiftHourlyWageKind,
  type HourlyWageKind,
} from "@/lib/shifts/hourly-wage-description";

import {
  Calendar,
  Clock,
  Plus,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ShiftWageBreakdown = {
  shiftId: number;
  productionReward: number;
  accounting: number;
  manual: number;
  loadingCount: number;
  loading: number;
  total: number;
};

const emptyHourlyByKind = (): Record<HourlyWageKind, number> => ({
  accounting: 0,
  manual: 0,
  loading_count: 0,
  loading: 0,
});

const WAGE_BREAKDOWN_LABELS: Array<{
  key: keyof Pick<
    ShiftWageBreakdown,
    | "productionReward"
    | "accounting"
    | "manual"
    | "loadingCount"
    | "loading"
  >;
  label: string;
}> = [
  { key: "productionReward", label: "Винагорода за продукцію" },
  { key: "accounting", label: "Облік витрат (погодинна)" },
  { key: "manual", label: "Сума витрат" },
  { key: "loadingCount", label: "Підрахунок завантаження" },
  { key: "loading", label: "Завантаження продукції" },
];

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
  const expenses = await getExpenses();

  const params = await searchParams;

  const currentDate = new Date();
  const currentWeek = params.week
    ? parseInt(params.week)
    : getWeekNumber(currentDate);
  const currentYear = params.year
    ? parseInt(params.year)
    : currentDate.getFullYear();

  const useDateRange = params.startDate && params.endDate;
  const startDate = params.startDate ? new Date(params.startDate) : null;
  const endDate = params.endDate ? new Date(params.endDate) : null;

  const detailedShifts = shifts.filter(
    (shift) => shift.status === "completed",
  );
  const completedShiftIds = new Set(detailedShifts.map((shift) => shift.id));

  const hourlyExpensesByShiftId = new Map<number, number>();
  const hourlyByKindByShiftId = new Map<number, Record<HourlyWageKind, number>>();

  expenses.forEach((expense) => {
    const categoryName = expense?.category?.name;
    const isShiftWageCategory =
      categoryName === "З.П. Погодинна" ||
      categoryName === "З/П Підрахунок завантаження";
    if (!isShiftWageCategory) return;

    const description = expense.description ?? "";
    const shiftMatch = description.match(/Зміна\s*#(\d+)/i);
    if (!shiftMatch) return;

    const shiftId = Number.parseInt(shiftMatch[1], 10);
    if (!completedShiftIds.has(shiftId)) return;

    const amount = Number(expense.amount ?? 0);
    const currentAmount = hourlyExpensesByShiftId.get(shiftId) ?? 0;
    hourlyExpensesByShiftId.set(shiftId, currentAmount + amount);

    const kind = parseShiftHourlyWageKind(description, shiftId);
    const byKind = hourlyByKindByShiftId.get(shiftId) ?? emptyHourlyByKind();
    byKind[kind] += amount;
    hourlyByKindByShiftId.set(shiftId, byKind);
  });

  const buildShiftWageBreakdown = (
    shift: (typeof detailedShifts)[number],
  ): ShiftWageBreakdown => {
    let productionReward = 0;
    if (shift.production && shift.production.length > 0) {
      shift.production.forEach((item) => {
        const rewardPerUnit = Number(
          item.reward_override ?? item.product.reward ?? 0,
        );
        if (rewardPerUnit > 0) {
          productionReward += item.quantity * rewardPerUnit;
        }
      });
    }

    const byKind = hourlyByKindByShiftId.get(shift.id) ?? emptyHourlyByKind();
    const accounting = byKind.accounting;
    const manual = byKind.manual;
    const loadingCount = byKind.loading_count;
    const loading = byKind.loading;
    const hourlyTotal =
      hourlyExpensesByShiftId.get(shift.id) ??
      accounting + manual + loadingCount + loading;

    return {
      shiftId: shift.id,
      productionReward,
      accounting,
      manual,
      loadingCount,
      loading,
      total: productionReward + hourlyTotal,
    };
  };

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

  const filteredShifts = shifts.filter((shift) => {
    const shiftDate = new Date(
      shift.opened_at || shift.created_at || shift.shift_date,
    );

    if (useDateRange && startDate && endDate) {
      return shiftDate >= startDate && shiftDate <= endDate;
    } else {
      const shiftWeek = getWeekNumber(shiftDate);
      const shiftYear = shiftDate.getFullYear();
      return shiftWeek === currentWeek && shiftYear === currentYear;
    }
  });

  const shiftsByDay: Record<
    string,
    {
      day: string;
      date: string;
      shifts: typeof detailedShifts;
      breakdowns: ShiftWageBreakdown[];
      totalWages: number;
    }
  > = {};

  let weeklyTotalWages = 0;
  let weeklyTotalProduction = 0;

  detailedShifts.forEach((shift) => {
    if (!shift) return;

    const shiftDate = new Date(
      shift.opened_at || shift.created_at || shift.shift_date,
    );
    const dayOfWeek = getDayOfWeek(
      shift.opened_at || shift.created_at || shift.shift_date,
    );

    let isInRange = false;

    if (useDateRange && startDate && endDate) {
      isInRange = shiftDate >= startDate && shiftDate <= endDate;
    } else {
      const weekNumber = getWeekNumber(shiftDate);
      const year = shiftDate.getFullYear();
      isInRange = weekNumber === currentWeek && year === currentYear;
    }

    if (!isInRange) return;

    const breakdown = buildShiftWageBreakdown(shift);
    weeklyTotalWages += breakdown.total;

    if (shift.production && shift.production.length > 0) {
      shift.production.forEach((item) => {
        weeklyTotalProduction += item.quantity;
      });
    }

    const dateKey = shiftDate.toISOString().split("T")[0];

    if (!shiftsByDay[dateKey]) {
      shiftsByDay[dateKey] = {
        day: dayOfWeek,
        date: shiftDate.toISOString(),
        shifts: [],
        breakdowns: [],
        totalWages: 0,
      };
    }

    shiftsByDay[dateKey].shifts.push(shift);
    shiftsByDay[dateKey].breakdowns.push(breakdown);
    shiftsByDay[dateKey].totalWages += breakdown.total;
  });

  const sortedDays = Object.keys(shiftsByDay).sort().reverse();

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
      <div className="mb-6 flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <QuickActionsButton />
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
              ? `Підсумок заробітної плати (продукція + погодинні витрати) за завершеними змінами з ${formatDate(
                  startDate!.toISOString(),
                )} по ${formatDate(endDate!.toISOString())}`
              : `Підсумок заробітної плати (продукція + погодинні витрати) за завершеними змінами тижня ${currentWeek}`}
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
                <div className="space-y-4">
                  {sortedDays.map((dateKey) => {
                    const dayData = shiftsByDay[dateKey];
                    return (
                      <div
                        key={dateKey}
                        className="rounded-lg border bg-muted/30 p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{dayData.day}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(dayData.date)}
                            </div>
                          </div>
                          <div className="font-medium tabular-nums">
                            {formatNumberWithUnit(dayData.totalWages, "грн", {
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {dayData.breakdowns.map((breakdown) => {
                            const parts = WAGE_BREAKDOWN_LABELS.filter(
                              ({ key }) => breakdown[key] > 0,
                            );
                            return (
                              <div
                                key={breakdown.shiftId}
                                className="rounded-md border bg-background p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <Link
                                    href={`/shifts/${breakdown.shiftId}`}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    Зміна #{breakdown.shiftId}
                                  </Link>
                                  <div className="font-medium tabular-nums">
                                    {formatNumberWithUnit(breakdown.total, "грн", {
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                </div>
                                {parts.length > 0 ? (
                                  <div className="space-y-1">
                                    {parts.map(({ key, label }) => (
                                      <div
                                        key={key}
                                        className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                                      >
                                        <span>{label}</span>
                                        <span className="tabular-nums">
                                          {formatNumberWithUnit(
                                            breakdown[key],
                                            "грн",
                                            { maximumFractionDigits: 2 },
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    Немає нарахувань за цю зміну
                                  </p>
                                )}
                              </div>
                            );
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

                    {shift.status === "completed" &&
                      (() => {
                        const shiftDetail = detailedShifts.find(
                          (s) => s?.id === shift.id,
                        );
                        if (!shiftDetail) return null;

                        const shiftWages =
                          buildShiftWageBreakdown(shiftDetail).total;

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
