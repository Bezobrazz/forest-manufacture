"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  createRawCostRepayment,
  deleteExpense,
  getRawRepayments,
  type RawRepaymentItem,
  updateRawRepayment,
} from "@/app/actions";
import { getTrips, type TripListItem } from "@/app/trips/actions";
import { getVehicles, type Vehicle } from "@/app/vehicles/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUah, formatKm, formatPercent } from "@/lib/format";

type StatusFilter = "" | "profit" | "breakeven" | "loss";

function formatDate(s: string) {
  const d = new Date(s + "Z");
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTripDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  fallback: string | null,
): string {
  if (start && end && start !== end) {
    return `${formatDate(start)} — ${formatDate(end)}`;
  }
  if (start) return formatDate(start);
  if (fallback) return formatDate(fallback);
  return "—";
}

const tripTypeLabels: Record<string, string> = {
  raw: "Сировина",
  commerce: "Комерція",
};

function tripStatus(profit: number | null): { icon: string; label: string } {
  if (profit == null) return { icon: "—", label: "—" };
  if (profit > 0) return { icon: "✅", label: "Прибуток" };
  if (profit === 0) return { icon: "⚠️", label: "Нуль" };
  return { icon: "❌", label: "Збиток" };
}

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [repaymentDate, setRepaymentDate] = useState("");
  const [repaymentAmount, setRepaymentAmount] = useState("");
  const [repaymentSubmitting, setRepaymentSubmitting] = useState(false);
  const [repaymentsList, setRepaymentsList] = useState<RawRepaymentItem[]>([]);
  const [editingRepayment, setEditingRepayment] = useState<RawRepaymentItem | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteRepaymentId, setDeleteRepaymentId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const repaymentsSum = useMemo(
    () => repaymentsList.reduce((s, r) => s + r.amount, 0),
    [repaymentsList],
  );

  useEffect(() => {
    Promise.all([getTrips(), getVehicles()]).then(
      ([tripsData, vehiclesData]) => {
        setTrips(tripsData);
        setVehicles(vehiclesData ?? []);
        setIsLoading(false);
      },
    );
  }, []);

  const refetchRepayments = () =>
    getRawRepayments(dateFrom || undefined, dateTo || undefined).then(setRepaymentsList);

  useEffect(() => {
    refetchRepayments();
  }, [dateFrom, dateTo]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (dateFrom && t.trip_date < dateFrom) return false;
      if (dateTo && t.trip_date > dateTo) return false;
      if (vehicleFilter && t.vehicle_id !== vehicleFilter) return false;
      if (statusFilter) {
        const p = t.profit_uah ?? 0;
        if (statusFilter === "profit" && p <= 0) return false;
        if (statusFilter === "breakeven" && p !== 0) return false;
        if (statusFilter === "loss" && p >= 0) return false;
      }
      return true;
    });
  }, [trips, dateFrom, dateTo, vehicleFilter, statusFilter]);

  const commerceTrips = useMemo(
    () => filteredTrips.filter((t) => t.trip_type === "commerce"),
    [filteredTrips],
  );
  const rawTrips = useMemo(
    () => filteredTrips.filter((t) => t.trip_type === "raw"),
    [filteredTrips],
  );

  const commerceTotals = useMemo(() => {
    if (commerceTrips.length === 0) return null;
    let sumFreightUah = 0;
    let sumFuelCostUah = 0;
    let sumDriverCostUah = 0;
    let sumTotalCostsUah = 0;
    let sumProfitUah = 0;
    let sumProfitPerKmUah = 0;
    let sumRoiPercent = 0;
    let countRoi = 0;
    let countProfitPerKm = 0;
    for (const t of commerceTrips) {
      sumFreightUah += t.freight_uah ?? 0;
      sumFuelCostUah += t.fuel_cost_uah ?? 0;
      sumDriverCostUah += t.driver_cost_uah ?? 0;
      sumTotalCostsUah += t.total_costs_uah ?? 0;
      sumProfitUah += t.profit_uah ?? 0;
      if (t.profit_per_km_uah != null) {
        sumProfitPerKmUah += t.profit_per_km_uah;
        countProfitPerKm += 1;
      }
      if (t.roi_percent != null) {
        sumRoiPercent += t.roi_percent;
        countRoi += 1;
      }
    }
    return {
      sumFreightUah,
      sumFuelCostUah,
      sumDriverCostUah,
      sumTotalCostsUah,
      sumProfitUah,
      avgProfitPerKmUah:
        countProfitPerKm > 0 ? sumProfitPerKmUah / countProfitPerKm : null,
      avgRoiPercent: countRoi > 0 ? sumRoiPercent / countRoi : null,
    };
  }, [commerceTrips]);

  const rawTotals = useMemo(() => {
    if (rawTrips.length === 0) return null;
    let sumTotalCostsUah = 0;
    let sumBags = 0;
    for (const t of rawTrips) {
      sumTotalCostsUah += t.total_costs_uah ?? 0;
      sumBags += t.bags_count ?? 0;
    }
    const avgCostPerBagUah = sumBags > 0 ? sumTotalCostsUah / sumBags : null;
    return { sumTotalCostsUah, sumBags, avgCostPerBagUah };
  }, [rawTrips]);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </Link>
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Поїздки</h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Список поїздок та прибутковість
          </p>
        </div>
        <Button asChild>
          <Link href="/trips/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Нова поїздка
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Фільтри</CardTitle>
              <CardDescription>
                Обмежити список за датою, транспортом або статусом
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-[140px]" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-10 w-[140px]" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-[160px]" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-10 w-[140px]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-80 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="inline-flex h-10 rounded-md bg-muted p-1 gap-1">
                <Skeleton className="h-8 w-[120px]" />
                <Skeleton className="h-8 w-[100px]" />
              </div>
              <div className="rounded-md border">
                <div className="flex border-b bg-muted/50">
                  <Skeleton className="h-10 flex-1 min-w-[80px]" />
                  <Skeleton className="h-10 flex-1 min-w-[100px]" />
                  <Skeleton className="h-10 flex-1 min-w-[90px]" />
                  <Skeleton className="h-10 flex-1 min-w-[80px]" />
                  <Skeleton className="h-10 flex-1 min-w-[70px]" />
                  <Skeleton className="h-10 flex-1 min-w-[80px]" />
                </div>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex border-b last:border-0">
                    <Skeleton className="h-12 flex-1 min-w-[80px] rounded-none" />
                    <Skeleton className="h-12 flex-1 min-w-[100px] rounded-none" />
                    <Skeleton className="h-12 flex-1 min-w-[90px] rounded-none" />
                    <Skeleton className="h-12 flex-1 min-w-[80px] rounded-none" />
                    <Skeleton className="h-12 flex-1 min-w-[70px] rounded-none" />
                    <Skeleton className="h-12 flex-1 min-w-[80px] rounded-none" />
                  </div>
                ))}
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : trips.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-4">Немає поїздок</p>
            <Button asChild>
              <Link href="/trips/new" className="gap-2">
                <Plus className="h-4 w-4" />
                Додати поїздку
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Фільтри</CardTitle>
              <CardDescription>
                Обмежити список за датою, транспортом або статусом
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="date-from"
                    className="text-xs text-muted-foreground"
                  >
                    Дата від
                  </Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="date-to"
                    className="text-xs text-muted-foreground"
                  >
                    Дата до
                  </Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 min-w-[160px]">
                  <Label className="text-xs text-muted-foreground">
                    Транспорт
                  </Label>
                  <Select
                    value={vehicleFilter || "__all__"}
                    onValueChange={(v) =>
                      setVehicleFilter(v === "__all__" ? "" : v)
                    }
                  >
                    <SelectTrigger id="vehicle-filter">
                      <SelectValue placeholder="Усі" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Усі</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">
                    Статус
                  </Label>
                  <Select
                    value={statusFilter || "__all__"}
                    onValueChange={(v) =>
                      setStatusFilter(
                        (v === "__all__" ? "" : v) as StatusFilter,
                      )
                    }
                  >
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Усі" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Усі</SelectItem>
                      <SelectItem value="profit">✅ Прибуток</SelectItem>
                      <SelectItem value="breakeven">⚠️ Нуль</SelectItem>
                      <SelectItem value="loss">❌ Збиток</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(dateFrom || dateTo || vehicleFilter || statusFilter) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setVehicleFilter("");
                      setStatusFilter("");
                    }}
                  >
                    Скинути
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Рейси</CardTitle>
              <CardDescription>
                {filteredTrips.length === trips.length
                  ? `Показано ${trips.length} ${trips.length === 1 ? "рейс" : trips.length < 5 ? "рейси" : "рейсів"}.`
                  : `Показано ${filteredTrips.length} з ${trips.length} рейсів.`}{" "}
                Клік по рядку — деталі та редагування.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="commerce" className="w-full">
                <TabsList className="grid w-full max-w-[280px] grid-cols-2">
                  <TabsTrigger value="commerce">
                    {tripTypeLabels.commerce} ({commerceTrips.length})
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    {tripTypeLabels.raw} ({rawTrips.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="commerce" className="mt-4 space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Назва</TableHead>
                        <TableHead>Транспорт</TableHead>
                        <TableHead className="text-right">Відстань</TableHead>
                        <TableHead className="text-right">Фрахт</TableHead>
                        <TableHead className="text-right">Витрати</TableHead>
                        <TableHead className="text-right">Прибуток</TableHead>
                        <TableHead className="text-right">ROI</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commerceTrips.map((t) => {
                        const status = tripStatus(t.profit_uah);
                        return (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer"
                            onClick={() => router.push(`/trips/${t.id}`)}
                          >
                            <TableCell className="font-medium">
                              {formatTripDateRange(
                                t.trip_start_date,
                                t.trip_end_date,
                                t.trip_date,
                              )}
                            </TableCell>
                            <TableCell>{t.name?.trim() ?? "—"}</TableCell>
                            <TableCell>{t.vehicle?.name ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatKm(t.distance_km)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatUah(t.freight_uah)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatUah(t.total_costs_uah)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatUah(t.profit_uah)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatPercent(t.roi_percent)}
                            </TableCell>
                            <TableCell>
                              <span title={status.label}>{status.icon}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {commerceTrips.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Немає комерційних рейсів за обраними фільтрами
                    </p>
                  )}
                  {commerceTotals && (
                    <div className="rounded-lg border p-4">
                      <h3 className="text-sm font-medium mb-3">
                        Підсумки (Комерція)
                      </h3>
                      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">
                            Фрахт (дохід)
                          </span>
                          <span className="tabular-nums font-medium">
                            {formatUah(commerceTotals.sumFreightUah)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">Паливо</span>
                          <span className="tabular-nums">
                            {formatUah(commerceTotals.sumFuelCostUah)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">Водій</span>
                          <span className="tabular-nums">
                            {formatUah(commerceTotals.sumDriverCostUah)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">
                            Всього витрат
                          </span>
                          <span className="tabular-nums font-medium">
                            {formatUah(commerceTotals.sumTotalCostsUah)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">
                            Прибуток
                          </span>
                          <span className="tabular-nums font-medium">
                            {formatUah(commerceTotals.sumProfitUah)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">
                            Середній прибуток/км
                          </span>
                          <span className="tabular-nums">
                            {formatUah(commerceTotals.avgProfitPerKmUah)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 py-2 border-b">
                          <span className="text-muted-foreground">
                            Середній ROI
                          </span>
                          <span className="tabular-nums">
                            {formatPercent(commerceTotals.avgRoiPercent)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="raw" className="mt-4 space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Транспорт</TableHead>
                        <TableHead className="text-right">Відстань</TableHead>
                        <TableHead className="text-right">Витрати</TableHead>
                        <TableHead className="text-right">Мішки</TableHead>
                        <TableHead className="text-right">Ціна мішка</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawTrips.map((t) => {
                        const costPerBag =
                          t.bags_count != null &&
                          t.bags_count >= 1 &&
                          t.total_costs_uah != null
                            ? t.total_costs_uah / t.bags_count
                            : null;
                        return (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer"
                            onClick={() => router.push(`/trips/${t.id}`)}
                          >
                            <TableCell className="font-medium">
                              {formatTripDateRange(
                                t.trip_start_date,
                                t.trip_end_date,
                                t.trip_date,
                              )}
                            </TableCell>
                            <TableCell>{t.vehicle?.name ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatKm(t.distance_km)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatUah(t.total_costs_uah)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {t.bags_count != null ? t.bags_count : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatUah(costPerBag)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {rawTrips.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Немає рейсів «Сировина» за обраними фільтрами
                    </p>
                  )}
                  {rawTotals && (
                    <div className="rounded-lg border p-4">
                      <h3 className="text-sm font-medium mb-3">
                        Підсумки (Сировина)
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-lg border bg-muted/40 p-4">
                          <p className="text-xs text-muted-foreground mb-1">
                            Середня вартість мішка
                          </p>
                          <p className="text-xl font-semibold tabular-nums">
                            {rawTotals.avgCostPerBagUah != null
                              ? formatUah(rawTotals.avgCostPerBagUah)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/40 p-4">
                          <p className="text-xs text-muted-foreground mb-1">
                            Всього мішків
                          </p>
                          <p className="text-xl font-semibold tabular-nums">
                            {rawTotals.sumBags}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/40 p-4">
                          <p className="text-xs text-muted-foreground mb-1">
                            Всього витрат
                          </p>
                          <p className="text-xl font-semibold tabular-nums">
                            {formatUah(rawTotals.sumTotalCostsUah)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {rawTotals && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border bg-muted/40 p-4">
                        <h3 className="text-sm font-medium mb-3">
                          Залишилось погасити
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">
                              Всього витрат
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatUah(rawTotals.sumTotalCostsUah)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">
                              Погашено
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatUah(repaymentsSum)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2 border-t pt-2">
                            <span className="font-medium">
                              Залишилось погасити
                            </span>
                            <span className="tabular-nums font-semibold">
                              {formatUah(
                                Math.max(
                                  0,
                                  rawTotals.sumTotalCostsUah - repaymentsSum,
                                ),
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <h3 className="text-sm font-medium mb-3">
                          Погасити доставку
                        </h3>
                        <form
                          className="flex flex-wrap items-end gap-4"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const amount = Number(repaymentAmount);
                            if (!repaymentDate.trim()) {
                              toast.error("Оберіть дату");
                              return;
                            }
                            if (!(amount > 0)) {
                              toast.error("Вкажіть суму більше нуля");
                              return;
                            }
                            setRepaymentSubmitting(true);
                            const result = await createRawCostRepayment(
                              repaymentDate,
                              amount,
                            );
                            setRepaymentSubmitting(false);
                            if (result.ok) {
                              toast.success("Погашення витрат збережено");
                              setRepaymentDate("");
                              setRepaymentAmount("");
                              refetchRepayments();
                            } else {
                              toast.error(result.error);
                            }
                          }}
                        >
                          <div className="space-y-1.5">
                            <Label
                              htmlFor="repayment-date"
                              className="text-xs text-muted-foreground"
                            >
                              Дата
                            </Label>
                            <Input
                              id="repayment-date"
                              type="date"
                              value={repaymentDate}
                              onChange={(e) => setRepaymentDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label
                              htmlFor="repayment-amount"
                              className="text-xs text-muted-foreground"
                            >
                              Сума погашення (грн)
                            </Label>
                            <Input
                              id="repayment-amount"
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0.00"
                              value={repaymentAmount}
                              onChange={(e) =>
                                setRepaymentAmount(e.target.value)
                              }
                            />
                          </div>
                          <Button type="submit" disabled={repaymentSubmitting}>
                            {repaymentSubmitting ? "Збереження…" : "Погасити"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  )}
                  {rawTotals && (
                    <div className="mt-4 rounded-lg border p-4">
                      <h3 className="text-sm font-medium mb-3">Погашення</h3>
                      {repaymentsList.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">
                          Немає погашень за обраний період
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Дата</TableHead>
                              <TableHead className="text-right">Сума</TableHead>
                              <TableHead className="w-[100px] text-right">
                                Дії
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {repaymentsList.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="tabular-nums">
                                  {formatDate(
                                    item.date.startsWith("20")
                                      ? item.date.slice(0, 10)
                                      : item.date,
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-medium">
                                  {formatUah(item.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setEditingRepayment(item);
                                        setEditDate(item.date.slice(0, 10));
                                        setEditAmount(
                                          String(item.amount),
                                        );
                                      }}
                                      aria-label="Редагувати"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() =>
                                        setDeleteRepaymentId(item.id)
                                      }
                                      aria-label="Видалити"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                  <Dialog
                    open={!!editingRepayment}
                    onOpenChange={(open) => {
                      if (!open) setEditingRepayment(null);
                    }}
                  >
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>Редагувати погашення</DialogTitle>
                      </DialogHeader>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!editingRepayment) return;
                          const amount = Number(editAmount);
                          if (!editDate.trim()) {
                            toast.error("Оберіть дату");
                            return;
                          }
                          if (!(amount > 0)) {
                            toast.error("Вкажіть суму більше нуля");
                            return;
                          }
                          setEditSubmitting(true);
                          const result = await updateRawRepayment(
                            editingRepayment.id,
                            editDate,
                            amount,
                          );
                          setEditSubmitting(false);
                          if (result.ok) {
                            toast.success("Погашення оновлено");
                            setEditingRepayment(null);
                            refetchRepayments();
                          } else {
                            toast.error(result.error);
                          }
                        }}
                        className="space-y-4 pt-2"
                      >
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-date">Дата</Label>
                          <Input
                            id="edit-date"
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-amount">Сума (грн)</Label>
                          <Input
                            id="edit-amount"
                            type="number"
                            min={0}
                            step={0.01}
                            value={editAmount}
                            onChange={(e) =>
                              setEditAmount(e.target.value)
                            }
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditingRepayment(null)}
                          >
                            Скасувати
                          </Button>
                          <Button type="submit" disabled={editSubmitting}>
                            {editSubmitting ? "Збереження…" : "Зберегти"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <AlertDialog
                    open={deleteRepaymentId !== null}
                    onOpenChange={(open) => {
                      if (!open) setDeleteRepaymentId(null);
                    }}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Видалити погашення?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Цю дію не можна скасувати. Запис про погашення буде
                          видалено.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Скасувати</AlertDialogCancel>
                        <Button
                          variant="destructive"
                          disabled={deleteSubmitting}
                          onClick={async () => {
                            if (deleteRepaymentId === null) return;
                            setDeleteSubmitting(true);
                            try {
                              await deleteExpense(deleteRepaymentId);
                              toast.success("Погашення видалено");
                              setDeleteRepaymentId(null);
                              refetchRepayments();
                            } catch {
                              toast.error("Помилка при видаленні");
                            } finally {
                              setDeleteSubmitting(false);
                            }
                          }}
                        >
                          {deleteSubmitting ? "Видалення…" : "Видалити"}
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TabsContent>
              </Tabs>
              {filteredTrips.length === 0 && trips.length > 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  За обраними фільтрами рейсів не знайдено
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
