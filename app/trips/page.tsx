"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
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
import { ArrowLeft, MapPin, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "" | "profit" | "breakeven" | "loss";

function formatDate(s: string) {
  const d = new Date(s + "Z");
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNum(n: number | null): string {
  if (n == null) return "—";
  return String(n);
}

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

  useEffect(() => {
    Promise.all([getTrips(), getVehicles()]).then(([tripsData, vehiclesData]) => {
      setTrips(tripsData);
      setVehicles(vehiclesData ?? []);
      setIsLoading(false);
    });
  }, []);

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

  const totals = useMemo(() => {
    if (filteredTrips.length === 0) return null;
    let sumFreightUah = 0;
    let sumFuelCostUah = 0;
    let sumDriverCostUah = 0;
    let sumTotalCostsUah = 0;
    let sumProfitUah = 0;
    let sumProfitPerKmUah = 0;
    let sumRoiPercent = 0;
    let countRoi = 0;
    let countProfitPerKm = 0;
    for (const t of filteredTrips) {
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
      avgProfitPerKmUah: countProfitPerKm > 0 ? sumProfitPerKmUah / countProfitPerKm : null,
      avgRoiPercent: countRoi > 0 ? sumRoiPercent / countRoi : null,
    };
  }, [filteredTrips]);

  const round2 = (n: number) => Math.round(n * 100) / 100;

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
        <Skeleton className="h-64" />
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
                  <Label htmlFor="date-from" className="text-xs text-muted-foreground">
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
                  <Label htmlFor="date-to" className="text-xs text-muted-foreground">
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
                  <Label className="text-xs text-muted-foreground">Транспорт</Label>
                  <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                    <SelectTrigger id="vehicle-filter">
                      <SelectValue placeholder="Усі" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Усі</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Статус</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                  >
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Усі" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Усі</SelectItem>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
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
                  {filteredTrips.map((t) => {
                  const status = tripStatus(t.profit_uah);
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/trips/${t.id}`)}
                    >
                      <TableCell className="font-medium">
                        {formatDate(t.trip_date)}
                      </TableCell>
                      <TableCell>{t.vehicle?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.distance_km != null ? `${t.distance_km} км` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(t.freight_uah)} грн
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(t.total_costs_uah)} грн
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(t.profit_uah)} грн
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.roi_percent != null ? `${t.roi_percent}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <span title={status.label}>{status.icon}</span>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
              {filteredTrips.length === 0 && trips.length > 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  За обраними фільтрами рейсів не знайдено
                </p>
              )}
            </CardContent>
          </Card>

          {totals && (
            <Card>
              <CardHeader>
                <CardTitle>Підсумки по фільтру</CardTitle>
                <CardDescription>
                  Суми та середні за {filteredTrips.length}{" "}
                  {filteredTrips.length === 1 ? "рейс" : filteredTrips.length < 5 ? "рейси" : "рейсів"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Фрахт (дохід)</span>
                    <span className="tabular-nums font-medium">
                      {round2(totals.sumFreightUah)} грн
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Паливо</span>
                    <span className="tabular-nums">
                      {round2(totals.sumFuelCostUah)} грн
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Водій</span>
                    <span className="tabular-nums">
                      {round2(totals.sumDriverCostUah)} грн
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Всього витрат</span>
                    <span className="tabular-nums font-medium">
                      {round2(totals.sumTotalCostsUah)} грн
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Прибуток</span>
                    <span className="tabular-nums font-medium">
                      {round2(totals.sumProfitUah)} грн
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Середній прибуток/км</span>
                    <span className="tabular-nums">
                      {totals.avgProfitPerKmUah != null
                        ? `${round2(totals.avgProfitPerKmUah)} грн`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b">
                    <span className="text-muted-foreground">Середній ROI</span>
                    <span className="tabular-nums">
                      {totals.avgRoiPercent != null
                        ? `${round2(totals.avgRoiPercent)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
