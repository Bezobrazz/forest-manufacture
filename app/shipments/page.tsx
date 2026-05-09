"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, parseISO, startOfDay, startOfWeek } from "date-fns";
import { uk } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  reconcileCrmOrdersAction,
  getShipmentQueue,
  getAvgDailyProductionByProduct,
} from "@/app/actions/shipments";
import { getInventory } from "@/app/actions";
import { PreviousPageButton } from "@/components/previous-page-button";
import { QuickActionsButton } from "@/components/quick-actions-button";
import { DatabaseError } from "@/components/database-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Inventory, CrmOrderWithDetails, ShipmentForecast } from "@/lib/types";
import { calculateForecast } from "@/lib/shipments/eta";
import { dateToYYYYMMDD, formatDate } from "@/lib/utils";

const WEEK_STARTS_SAT = 6;

function LoadingSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full max-w-xl" />
    </div>
  );
}

export default function ShipmentsPage() {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [queue, setQueue] = useState<CrmOrderWithDetails[]>([]);
  const [avgDaily, setAvgDaily] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [isPending, startTransition] = useTransition();

  const loadPage = async () => {
    setIsLoading(true);
    setDatabaseError(false);
    try {
      const [inv, q, avg] = await Promise.all([
        getInventory(),
        getShipmentQueue(),
        getAvgDailyProductionByProduct(30),
      ]);
      setInventory(inv);
      setQueue(q);
      setAvgDaily(avg);
    } catch (err: unknown) {
      console.error("ShipmentsPage load:", err);
      if (
        err &&
        typeof err === "object" &&
        "message" in err &&
        String((err as { message?: unknown }).message).includes("Supabase")
      ) {
        setDatabaseError(true);
      }
      toast.error("Помилка", { description: "Не вдалося завантажити дані" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const inventoryMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const row of inventory) {
      m[row.product_id] = Number(row.quantity) || 0;
    }
    return m;
  }, [inventory]);

  const forecasts = useMemo(
    () =>
      calculateForecast({
        queue,
        inventory: inventoryMap,
        avgDailyProduction: avgDaily,
        today: startOfDay(new Date()),
      }),
    [queue, inventoryMap, avgDaily]
  );

  const forecastsByEta = useMemo(() => {
    const m = new Map<string, ShipmentForecast[]>();
    for (const f of forecasts) {
      if (!f.etaDate) continue;
      const list = m.get(f.etaDate) ?? [];
      list.push(f);
      m.set(f.etaDate, list);
    }
    return m;
  }, [forecasts]);

  const calendarMarkedDates = useMemo(
    () => [...forecastsByEta.keys()].map((d) => parseISO(`${d}T12:00:00`)),
    [forecastsByEta]
  );

  const selectedDayKey = dateToYYYYMMDD(selectedDay);

  const selectedDayEtaList = forecastsByEta.get(selectedDayKey) ?? [];

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: WEEK_STARTS_SAT });
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const syncFromKeepin = () => {
    startTransition(async () => {
      const r = await reconcileCrmOrdersAction();
      if (r.success) {
        toast.success("Синхронізація", {
          description: `Оновлено угод: ${r.upserted ?? 0}, видалено: ${r.removed ?? 0}`,
        });
        await loadPage();
      } else {
        toast.error("Помилка", { description: r.error ?? "CRM" });
      }
    });
  };

  if (databaseError) {
    return (
      <div className="container py-12">
        <DatabaseError onRetry={loadPage} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="mb-2 flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <QuickActionsButton />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Календар відвантажень</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Прогноз ETA за середнім виробництво за 30 днів і поточним складом. Черга за датою
            створення угоди в CRM.
          </p>
        </div>
        <Button onClick={syncFromKeepin} disabled={isPending} className="gap-2 shrink-0">
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Синхронізувати з KeepinCRM
        </Button>
      </div>

      <Tabs defaultValue="month" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="month">Місяць</TabsTrigger>
          <TabsTrigger value="week">Тиждень</TabsTrigger>
          <TabsTrigger value="list">Черга</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Card className="flex-1 max-w-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Прогноз по днях</CardTitle>
                <CardDescription>Дні з хоча б одним відвантаженням підсвічені.</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  month={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  locale={uk}
                  weekStartsOn={WEEK_STARTS_SAT}
                  selected={selectedDay}
                  onSelect={(d) => {
                    if (d) setSelectedDay(startOfDay(d));
                  }}
                  modifiers={{ hasShipment: calendarMarkedDates }}
                  modifiersClassNames={{
                    hasShipment:
                      "font-semibold text-primary relative after:pointer-events-none after:absolute after:left-1/2 after:bottom-0.5 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  }}
                />
              </CardContent>
            </Card>

            <div className="flex-1 space-y-3 min-h-[280px]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{formatDate(selectedDay.toISOString())}</CardTitle>
                  <CardDescription>
                    {selectedDayEtaList.length
                      ? `Угоди з прогнозом ETA на цю дату: ${selectedDayEtaList.length}`
                      : "Немає угод із прогнозом ETA на цю дату"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDayEtaList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Оберіть день з позначкою в календарі або перевірте таб «Черга».
                    </p>
                  ) : (
                    selectedDayEtaList.map(renderForecastMini)
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="week">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setWeekAnchor((d) => addDays(d, -7))}>
              ‹
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekAnchor((d) => addDays(d, 7))}>
              ›
            </Button>
            <span className="text-sm text-muted-foreground">
              Тиждень з {formatDate(dateToKyivMidnightIso(weekStart))}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const key = dateToYYYYMMDD(d);
              const list = forecastsByEta.get(key) ?? [];
              return (
                <Card key={key} className="min-h-[220px]">
                  <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-xs font-medium">
                      {d.toLocaleDateString("uk-UA", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        timeZone: "Europe/Kyiv",
                      })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {list.map(renderForecastTiny)}
                    {list.length === 0 && (
                      <div className="text-xs text-muted-foreground py-4">—</div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-3">
          {forecasts.map((f) => (
            <Card key={f.order.crm_id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 flex-wrap space-y-0">
                <div>
                  <CardTitle className="text-base">{f.order.customer.name}</CardTitle>
                  <CardDescription className="text-xs">
                    Угода #{f.order.crm_id}, створено {formatDate(f.order.crm_created_at)}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {f.etaDate ? (
                    <Badge variant={f.isReady ? "default" : "secondary"}>
                      ETA {formatDate(`${f.etaDate}T12:00:00.000Z`)}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Без ETA</Badge>
                  )}
                  {f.missing.length > 0 ? (
                    <Badge variant="outline">Мапінг / норма</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {f.order.items.map((it) => (
                  <div key={it.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">
                      {it.product?.name ?? it.crm_product_ref ?? "—"}
                    </span>
                    <span className="shrink-0">{it.quantity} шт</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {forecasts.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Немає активних угод. Синхронізуйте з KeepinCRM або перевірте фільтр етапів
                (KEEPINCRM_ACTIVE_STAGE_IDS).
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function dateToKyivMidnightIso(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00.000Z`;
}

function renderForecastMini(f: ShipmentForecast) {
  return (
    <div key={f.order.crm_id} className="rounded-md border p-3 text-sm space-y-1">
      <div className="font-medium">{f.order.customer.name}</div>
      <div className="text-muted-foreground text-xs">Угода #{f.order.crm_id}</div>
      {f.missing.length > 0 && (
        <div className="text-xs text-amber-600">Є позиції без мапінгу або без норми виробництва</div>
      )}
    </div>
  );
}

function renderForecastTiny(f: ShipmentForecast) {
  return (
    <div
      key={f.order.crm_id}
      className="text-xs rounded border px-1.5 py-1 truncate"
      title={f.order.customer.name}
    >
      {f.order.customer.name}
    </div>
  );
}
