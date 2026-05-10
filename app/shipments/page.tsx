"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addDays, parseISO, startOfDay, startOfWeek } from "date-fns";
import { uk } from "date-fns/locale";
import { GripVertical, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  getKeepinSyncJobStatusAction,
  getCrmUnmappedProductsAction,
  getShipmentProductsAction,
  getShipmentQueue,
  getAvgDailyProductionByProduct,
  reorderShipmentQueueAction,
  saveCrmProductMappingAction,
  startKeepinSyncJobAction,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Inventory, CrmOrderWithDetails, ShipmentForecast, Product } from "@/lib/types";
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
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [databaseError, setDatabaseError] = useState(false);
  const [unmappedRefs, setUnmappedRefs] = useState<{ crm_product_ref: string; count: number }[]>(
    []
  );
  const [products, setProducts] = useState<Pick<Product, "id" | "name" | "description">[]>(
    []
  );
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfDay(new Date()));
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [isPending, startTransition] = useTransition();
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncHint, setSyncHint] = useState<string>("");
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [draggingQueueCrmId, setDraggingQueueCrmId] = useState<string | null>(null);
  const [dropTargetCrmId, setDropTargetCrmId] = useState<string | null>(null);
  const [isSavingQueueOrder, setIsSavingQueueOrder] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      const [unmapped, productsList] = await Promise.all([
        getCrmUnmappedProductsAction(),
        getShipmentProductsAction(),
      ]);
      setUnmappedRefs(unmapped);
      setProducts(productsList);
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
      const started = await startKeepinSyncJobAction();
      if (!started.success || !started.jobId) {
        toast.error("Помилка", { description: started.error ?? "Не вдалося стартувати sync" });
        return;
      }
      setSyncJobId(started.jobId);
      setSyncProgress(0);
      setSyncHint("Підготовка…");

      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      syncIntervalRef.current = setInterval(async () => {
        const statusResp = await getKeepinSyncJobStatusAction(started.jobId!);
        if (!statusResp.success || !statusResp.status) {
          setSyncHint(statusResp.error ?? "Не вдалося отримати статус");
          return;
        }
        const s = statusResp.status;
        const percent =
          s.total > 0 ? Math.min(100, Math.round((s.processed / s.total) * 100)) : 0;

        setSyncProgress(percent);
        if (s.total > 0) {
          setSyncHint(`Оброблено ${s.processed} із ${s.total}`);
        } else {
          setSyncHint("Завантаження списку угод…");
        }

        if (s.status === "done" || s.status === "error") {
          if (syncIntervalRef.current) {
            clearInterval(syncIntervalRef.current);
            syncIntervalRef.current = null;
          }

          if (s.status === "done") {
            setSyncProgress(100);
            setSyncHint(`Оновлено: ${s.upserted}, видалено: ${s.removed}`);
            toast.success("Синхронізація завершена", {
              description: `Оновлено угод: ${s.upserted}, видалено: ${s.removed}`,
            });
            await loadPage();
          } else {
            toast.error("Помилка sync", { description: s.error ?? "Unknown error" });
          }

          setTimeout(() => {
            setSyncProgress(null);
            setSyncHint("");
            setSyncJobId(null);
          }, 1400);
        }
      }, 800);
    });
  };

  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

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
            Прогноз ETA за середнім виробництвом за 30 днів і поточним складом. Порядок черги на
            вкладці «Черга» можна змінити вручну (вище — вищий пріоритет); за замовчуванням — за
            датою створення угоди в CRM.
          </p>
        </div>
        <Button
          onClick={syncFromKeepin}
          disabled={isPending || syncJobId !== null}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${syncJobId ? "animate-spin" : ""}`} />
          Синхронізувати з KeepinCRM
        </Button>
      </div>

      {syncProgress !== null ? (
        <div className="space-y-1">
          <Progress value={syncProgress} className="h-2" />
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Синхронізація: {Math.round(syncProgress)}%</span>
            <span>{syncProgress < 100 ? syncHint : "Завершено"}</span>
          </div>
        </div>
      ) : null}

      {unmappedRefs.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Мапінг товарів CRM</CardTitle>
            <CardDescription>
              Зіставте CRM-назви з вашими товарами, щоб ETA рахувався коректно.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {unmappedRefs.map((row) => (
              <div
                key={row.crm_product_ref}
                className="grid gap-2 md:grid-cols-[1.2fr_1fr_auto] md:items-center"
              >
                <div className="text-sm">
                  <div className="font-medium">{row.crm_product_ref}</div>
                  <div className="text-xs text-muted-foreground">
                    Невизначено у {row.count} позиціях
                  </div>
                </div>

                <Select
                  value={mappingDraft[row.crm_product_ref] ?? ""}
                  onValueChange={(value) =>
                    setMappingDraft((prev) => ({
                      ...prev,
                      [row.crm_product_ref]: value,
                    }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Оберіть товар…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  disabled={isSavingMapping || !mappingDraft[row.crm_product_ref]}
                  onClick={async () => {
                    const raw = mappingDraft[row.crm_product_ref];
                    const pid = Number(raw);
                    if (!Number.isFinite(pid) || pid <= 0) return;
                    setIsSavingMapping(true);
                    const res = await saveCrmProductMappingAction(row.crm_product_ref, pid);
                    setIsSavingMapping(false);
                    if (!res.success) {
                      toast.error("Не вдалося зберегти мапінг", {
                        description: res.error,
                      });
                      return;
                    }
                    toast.success("Мапінг збережено");
                    await loadPage();
                  }}
                >
                  Зберегти
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="month" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="month">Місяць</TabsTrigger>
          <TabsTrigger value="week">Тиждень</TabsTrigger>
          <TabsTrigger value="list">Черга</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="space-y-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
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
          <p className="text-xs text-muted-foreground -mt-1 mb-2">
            Перетягніть карточки за ручку або за всю картку. Після відпускання порядок зберігається в
            базі і впливає на розрахунок ETA.
          </p>
          {forecasts.map((f) => {
            const crmId = f.order.crm_id;
            const isDragging = draggingQueueCrmId === crmId;
            const isDropOver = dropTargetCrmId === crmId;
            return (
              <Card
                key={crmId}
                draggable={!isSavingQueueOrder}
                onDragStart={(e) => {
                  setDraggingQueueCrmId(crmId);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", crmId);
                }}
                onDragEnd={() => {
                  setDraggingQueueCrmId(null);
                  setDropTargetCrmId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTargetCrmId((prev) => (prev === crmId ? prev : crmId));
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDropTargetCrmId((prev) => (prev === crmId ? null : prev));
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDropTargetCrmId(null);
                  const draggedId = e.dataTransfer.getData("text/plain").trim();
                  if (!draggedId || draggedId === crmId) {
                    setDraggingQueueCrmId(null);
                    return;
                  }
                  const ids = forecasts.map((x) => x.order.crm_id);
                  const nextIds = reorderCrmIds(ids, draggedId, crmId);
                  const byId = new Map(queue.map((o) => [o.crm_id, o]));
                  const restored = [...queue];
                  const optimistic = nextIds.map((id, idx) => {
                    const row = byId.get(id);
                    return row ? { ...row, queue_rank: idx } : null;
                  });
                  const nextQueue = optimistic.filter(Boolean) as CrmOrderWithDetails[];
                  if (nextQueue.length !== nextIds.length) {
                    toast.error("Помилка", { description: "Не вдалося оновити чергу" });
                    setDraggingQueueCrmId(null);
                    return;
                  }
                  setQueue(nextQueue);
                  setIsSavingQueueOrder(true);
                  const res = await reorderShipmentQueueAction(nextIds);
                  setIsSavingQueueOrder(false);
                  setDraggingQueueCrmId(null);
                  if (!res.success) {
                    setQueue(restored);
                    toast.error("Не вдалося зберегти порядок", { description: res.error });
                    return;
                  }
                  toast.success("Пріоритет черги оновлено");
                }}
                className={`transition-shadow ${
                  isDragging ? "opacity-60" : ""
                } ${isDropOver && draggingQueueCrmId && draggingQueueCrmId !== crmId ? "ring-2 ring-primary/50" : ""}`}
              >
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 flex-wrap space-y-0">
                  <div className="flex gap-2 min-w-0 flex-1">
                    <div
                      className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground select-none [&:focus-visible]:outline-none [&:focus-visible]:ring-2 [&:focus-visible]:ring-ring rounded"
                      aria-hidden
                    >
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{f.order.customer.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Угода #{crmId}, створено {formatDate(f.order.crm_created_at)}
                      </CardDescription>
                    </div>
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
            );
          })}
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

function reorderCrmIds(ids: string[], draggedId: string, targetId: string): string[] {
  const i = ids.indexOf(draggedId);
  const j = ids.indexOf(targetId);
  if (i === -1 || j === -1 || i === j) return ids;
  const next = [...ids];
  const [removed] = next.splice(i, 1);
  next.splice(j, 0, removed);
  return next;
}

function dateToKyivMidnightIso(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00.000Z`;
}

function renderForecastMini(f: ShipmentForecast) {
  const itemsPreview = f.order.items.slice(0, 3);
  const restItemsCount = Math.max(f.order.items.length - itemsPreview.length, 0);
  const totalQty = f.order.items.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

  return (
    <div key={f.order.crm_id} className="rounded-md border p-3 text-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">Клієнт: {f.order.customer.name}</div>
        <Badge variant={f.isReady ? "default" : f.etaDate ? "secondary" : "destructive"}>
          {f.isReady ? "Готово сьогодні" : f.etaDate ? "Очікує виробництва" : "Без ETA"}
        </Badge>
      </div>

      <div className="text-muted-foreground text-xs flex flex-wrap gap-x-3 gap-y-1">
        <span>Угода #{f.order.crm_id}</span>
        <span>Створено: {formatDate(f.order.crm_created_at)}</span>
        {f.order.crm_status ? <span>Етап: {f.order.crm_status}</span> : null}
      </div>

      {f.order.customer.phone ? (
        <a
          className="text-xs text-primary underline-offset-2 hover:underline"
          href={`tel:${f.order.customer.phone}`}
        >
          {f.order.customer.phone}
        </a>
      ) : null}

      <div className="text-xs">
        <span className="text-muted-foreground">Кількість товару:</span>{" "}
        <span className="font-medium">{totalQty} шт</span>
      </div>

      <div className="space-y-1">
        {itemsPreview.map((item) => (
          <div key={item.id} className="text-xs flex items-center justify-between gap-2">
            <span className="text-muted-foreground truncate">
              {item.product?.name ?? item.crm_product_ref ?? "Позиція без назви"}
            </span>
            <span className="shrink-0">{item.quantity} шт</span>
          </div>
        ))}
        {restItemsCount > 0 ? (
          <div className="text-xs text-muted-foreground">+ ще {restItemsCount} позицій</div>
        ) : null}
      </div>

      {f.missing.length > 0 && (
        <div className="text-xs text-amber-600 space-y-0.5">
          <div>Нестача / немає норми виробництва:</div>
          {f.missing.slice(0, 2).map((m, idx) => (
            <div key={`${m.productId}-${idx}`}>
              • {m.productId > 0 ? `product_id ${m.productId}` : "без мапінгу"}: {m.needed} шт
            </div>
          ))}
          {f.missing.length > 2 ? <div>• ще {f.missing.length - 2} позицій</div> : null}
        </div>
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
