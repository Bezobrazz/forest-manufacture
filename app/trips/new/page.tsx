"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTrip, type CreateTripPayload } from "@/app/trips/actions";
import { getVehicles, type Vehicle } from "@/app/vehicles/actions";
import { calculateTripMetrics, type DriverPayMode, type TripType } from "@/lib/trips/calc";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { tripFormSchema } from "@/lib/trips/schemas";
import { formatUah, formatKm, formatL, formatPercent, parseNumericInput } from "@/lib/format";

const driverPayModeLabels: Record<DriverPayMode, string> = {
  per_trip: "За рейс",
  per_day: "За день",
  percent_of_freight: "% від фрахту",
};

const tripTypeLabels: Record<TripType, string> = {
  raw: "Сировина",
  commerce: "Комерція",
};

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Field({
  id,
  label,
  children,
  className = "",
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["space-y-1.5", className].join(" ")}>
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export default function NewTripPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const [name, setName] = useState("");
  const [tripStartDate, setTripStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [tripEndDate, setTripEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [tripType, setTripType] = useState<TripType>("raw");
  const [bagsCount, setBagsCount] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [fuelConsumption, setFuelConsumption] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");
  const [depreciation, setDepreciation] = useState("");
  const [daysCount, setDaysCount] = useState("1");
  const [dailyTaxes, setDailyTaxes] = useState("150");
  const [freightUah, setFreightUah] = useState("0");
  const [driverPayMode, setDriverPayMode] = useState<DriverPayMode>("per_trip");
  const [driverPayUah, setDriverPayUah] = useState("0");
  const [driverPayUahPerDay, setDriverPayUahPerDay] = useState("0");
  const [driverPayPercentOfFreight, setDriverPayPercentOfFreight] = useState("0");
  const [extraCostsUah, setExtraCostsUah] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    getVehicles().then((data) => {
      setVehicles(data);
      setVehiclesLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!vehicleId || vehicles.length === 0) return;
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;
    if (vehicle.default_fuel_consumption_l_per_100km != null) {
      setFuelConsumption(String(vehicle.default_fuel_consumption_l_per_100km));
    }
    if (vehicle.default_depreciation_uah_per_km != null) {
      setDepreciation(String(vehicle.default_depreciation_uah_per_km));
    }
    if (vehicle.default_daily_taxes_uah != null) {
      setDailyTaxes(String(vehicle.default_daily_taxes_uah));
    }
  }, [vehicleId, vehicles]);

  const previewMetrics = useMemo(() => {
    const input = {
      user_id: "",
      vehicle_id: vehicleId,
      trip_start_date: tripStartDate,
      trip_end_date: tripEndDate,
      trip_type: tripType,
      start_odometer_km: parseNum(startOdometer),
      end_odometer_km: parseNum(endOdometer),
      fuel_consumption_l_per_100km: parseNum(fuelConsumption),
      fuel_price_uah_per_l: parseNum(fuelPrice),
      depreciation_uah_per_km: parseNum(depreciation),
      days_count: parseNum(daysCount) ?? 1,
      daily_taxes_uah: parseNum(dailyTaxes) ?? 150,
      freight_uah: parseNum(freightUah) ?? 0,
      driver_pay_mode: driverPayMode,
      driver_pay_uah: driverPayMode === "per_trip" ? parseNum(driverPayUah) ?? 0 : 0,
      driver_pay_uah_per_day: driverPayMode === "per_day" ? parseNum(driverPayUahPerDay) ?? 0 : 0,
      driver_pay_percent_of_freight:
        driverPayMode === "percent_of_freight" ? parseNum(driverPayPercentOfFreight) ?? 0 : null,
      extra_costs_uah: parseNum(extraCostsUah) ?? 0,
    };
    try {
      return { metrics: calculateTripMetrics(input), error: null as string | null };
    } catch (err) {
      return { metrics: null, error: err instanceof Error ? err.message : "Помилка розрахунку" };
    }
  }, [
    vehicleId,
    tripStartDate,
    tripEndDate,
    tripType,
    startOdometer,
    endOdometer,
    fuelConsumption,
    fuelPrice,
    depreciation,
    daysCount,
    dailyTaxes,
    freightUah,
    driverPayMode,
    driverPayUah,
    driverPayUahPerDay,
    driverPayPercentOfFreight,
    extraCostsUah,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payloadForValidation = {
      name: name.trim(),
      trip_start_date: tripStartDate.trim(),
      trip_end_date: tripEndDate.trim(),
      vehicle_id: vehicleId,
      trip_type: tripType,
      start_odometer_km: parseNum(startOdometer),
      end_odometer_km: parseNum(endOdometer),
      fuel_consumption_l_per_100km: parseNum(fuelConsumption),
      fuel_price_uah_per_l: parseNum(fuelPrice),
      depreciation_uah_per_km: parseNum(depreciation),
      days_count: parseNum(daysCount) ?? 1,
      daily_taxes_uah: parseNum(dailyTaxes) ?? 150,
      freight_uah: parseNum(freightUah) ?? 0,
      driver_pay_mode: driverPayMode,
      driver_pay_uah: driverPayMode === "per_trip" ? parseNum(driverPayUah) ?? 0 : 0,
      driver_pay_uah_per_day: driverPayMode === "per_day" ? parseNum(driverPayUahPerDay) ?? 0 : 0,
      driver_pay_percent_of_freight:
        driverPayMode === "percent_of_freight" ? parseNum(driverPayPercentOfFreight) ?? 0 : null,
      extra_costs_uah: parseNum(extraCostsUah) ?? 0,
      bags_count: tripType === "raw" ? (parseNum(bagsCount) ?? null) : null,
      notes: notes.trim() || null,
    };
    const parsed = tripFormSchema.safeParse(payloadForValidation);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg =
        first.bags_count?.[0] ??
        first.end_odometer_km?.[0] ??
        first.name?.[0] ??
        first.trip_start_date?.[0] ??
        first.trip_end_date?.[0] ??
        first.vehicle_id?.[0] ??
        first.trip_type?.[0] ??
        parsed.error.message;
      toast.error(msg);
      return;
    }
    setIsPending(true);
    const payload: CreateTripPayload = {
      name: name.trim(),
      trip_start_date: tripStartDate.trim(),
      trip_end_date: tripEndDate.trim(),
      vehicle_id: vehicleId,
      trip_type: tripType,
      start_odometer_km: parseNum(startOdometer),
      end_odometer_km: parseNum(endOdometer),
      fuel_consumption_l_per_100km: parseNum(fuelConsumption),
      fuel_price_uah_per_l: parseNum(fuelPrice),
      depreciation_uah_per_km: parseNum(depreciation),
      days_count: parseNum(daysCount) ?? 1,
      daily_taxes_uah: parseNum(dailyTaxes) ?? 150,
      freight_uah: parseNum(freightUah) ?? 0,
      driver_pay_mode: driverPayMode,
      driver_pay_uah: driverPayMode === "per_trip" ? parseNum(driverPayUah) ?? 0 : 0,
      driver_pay_uah_per_day: driverPayMode === "per_day" ? parseNum(driverPayUahPerDay) ?? 0 : 0,
      driver_pay_percent_of_freight:
        driverPayMode === "percent_of_freight" ? parseNum(driverPayPercentOfFreight) ?? null : null,
      extra_costs_uah: parseNum(extraCostsUah) ?? 0,
      bags_count: tripType === "raw" ? (parseNum(bagsCount) ?? null) : null,
      notes: notes.trim() || null,
    };
    try {
      const result = await createTrip(payload);
      if (result.ok) {
        toast.success("Поїздку додано");
        router.push("/trips");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Помилка при збереженні");
    } finally {
      setIsPending(false);
    }
  };

  const extraCostsNum = parseNum(extraCostsUah) ?? 0;
  const statusIcon =
    previewMetrics.metrics?.status === "profit"
      ? "✅"
      : previewMetrics.metrics?.status === "breakeven"
        ? "⚠️"
        : "❌";
  const statusLabel =
    previewMetrics.metrics?.status === "profit"
      ? "Прибуток"
      : previewMetrics.metrics?.status === "breakeven"
        ? "Нуль"
        : "Збиток";

  if (vehiclesLoading) {
    return (
      <div className="container py-6 max-w-3xl">
        <div className="mb-6">
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад до поїздок</span>
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Нова поїздка</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Заповніть дані поїздки. Поля з * обов&apos;язкові.
          </p>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-48" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-20" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад до поїздок</span>
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Нова поїздка</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Заповніть дані поїздки. Поля з * обов&apos;язкові.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Дані поїздки</CardTitle>
            <CardDescription>
              Вся форма в одній картці — основне зверху, витрати та примітки нижче
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Основне: назва, дати, транспорт */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="trip_name" label="Назва поїздки *">
                <Input
                  id="trip_name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Наприклад: Рейс Київ — Львів"
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="trip_start_date" label="Дата початку поїздки *">
                <Input
                  id="trip_start_date"
                  type="date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  required
                />
              </Field>
              <Field id="trip_end_date" label="Дата кінця поїздки *">
                <Input
                  id="trip_end_date"
                  type="date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field id="trip_type" label="Тип поїздки *">
              <ToggleGroup
                type="single"
                value={tripType}
                onValueChange={(v) => v && setTripType(v as TripType)}
                className="justify-start"
              >
                <ToggleGroupItem value="raw" aria-label="Сировина">
                  {tripTypeLabels.raw}
                </ToggleGroupItem>
                <ToggleGroupItem value="commerce" aria-label="Комерція">
                  {tripTypeLabels.commerce}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {tripType === "raw" && (
              <Field id="bags_count" label="Кількість мішків *">
                <Input
                  id="bags_count"
                  type="text"
                  inputMode="numeric"
                  value={bagsCount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setBagsCount(v);
                  }}
                  placeholder="0"
                  required={tripType === "raw"}
                />
              </Field>
            )}
            <Field id="vehicle" label="Транспорт *">
              <Select
                value={vehicleId}
                onValueChange={setVehicleId}
                disabled={vehiclesLoading}
              >
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder={vehiclesLoading ? "Завантаження..." : "Оберіть транспорт"} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Separator />

            {/* Пробіг */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Пробіг
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="start_odometer" label="Початок (км)">
                  <Input
                    id="start_odometer"
                    type="text"
                    inputMode="decimal"
                    value={startOdometer}
                    onChange={(e) => setStartOdometer(parseNumericInput(e.target.value))}
                    placeholder="0"
                  />
                </Field>
                <Field id="end_odometer" label="Кінець (км)">
                  <Input
                    id="end_odometer"
                    type="text"
                    inputMode="decimal"
                    value={endOdometer}
                    onChange={(e) => setEndOdometer(parseNumericInput(e.target.value))}
                    placeholder="0"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Паливо та амортизація */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Паливо та амортизація
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="fuel_consumption" label="Витрата (л/100 км)">
                  <Input
                    id="fuel_consumption"
                    type="text"
                    inputMode="decimal"
                    value={fuelConsumption}
                    onChange={(e) => setFuelConsumption(parseNumericInput(e.target.value))}
                    placeholder="12"
                  />
                </Field>
                <Field id="fuel_price" label="Ціна за л (грн)">
                  <Input
                    id="fuel_price"
                    type="text"
                    inputMode="decimal"
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(parseNumericInput(e.target.value))}
                    placeholder="0"
                  />
                </Field>
                <Field id="depreciation" label="Амортизація (грн/км)">
                  <Input
                    id="depreciation"
                    type="text"
                    inputMode="decimal"
                    value={depreciation}
                    onChange={(e) => setDepreciation(parseNumericInput(e.target.value))}
                    placeholder="1.2"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Дні, податки, фрахт */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Дні, податки та дохід
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="days_count" label="Кількість днів">
                  <Input
                    id="days_count"
                    type="text"
                    inputMode="numeric"
                    value={daysCount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setDaysCount(v || "1");
                    }}
                    placeholder="1"
                  />
                </Field>
                <Field id="daily_taxes" label="Щоденні податки (грн)">
                  <Input
                    id="daily_taxes"
                    type="text"
                    inputMode="decimal"
                    value={dailyTaxes}
                    onChange={(e) => setDailyTaxes(parseNumericInput(e.target.value))}
                    placeholder="150"
                  />
                </Field>
                <Field id="freight_uah" label="Фрахт — дохід (грн)">
                  <Input
                    id="freight_uah"
                    type="text"
                    inputMode="decimal"
                    value={freightUah}
                    onChange={(e) => setFreightUah(parseNumericInput(e.target.value))}
                    placeholder="0"
                  />
                </Field>
              </div>
            </div>

            <Separator />

            {/* Водій */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Водій
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="driver_pay_mode" label="Оплата">
                  <Select
                    value={driverPayMode}
                    onValueChange={(v) => setDriverPayMode(v as DriverPayMode)}
                  >
                    <SelectTrigger id="driver_pay_mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_trip">{driverPayModeLabels.per_trip}</SelectItem>
                      <SelectItem value="per_day">{driverPayModeLabels.per_day}</SelectItem>
                      <SelectItem value="percent_of_freight">{driverPayModeLabels.percent_of_freight}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {driverPayMode === "per_trip" ? (
                  <Field id="driver_pay_uah" label="Сума за рейс (грн)">
                    <Input
                      id="driver_pay_uah"
                      type="text"
                      inputMode="decimal"
                      value={driverPayUah}
                      onChange={(e) => setDriverPayUah(parseNumericInput(e.target.value))}
                      placeholder="0"
                    />
                  </Field>
                ) : driverPayMode === "percent_of_freight" ? (
                  <Field id="driver_pay_percent_of_freight" label="Відсоток від фрахту (%)">
                    <Input
                      id="driver_pay_percent_of_freight"
                      type="text"
                      inputMode="decimal"
                      value={driverPayPercentOfFreight}
                      onChange={(e) => setDriverPayPercentOfFreight(parseNumericInput(e.target.value))}
                      placeholder="0"
                    />
                  </Field>
                ) : (
                  <Field id="driver_pay_uah_per_day" label="Сума за день (грн)">
                    <Input
                      id="driver_pay_uah_per_day"
                      type="text"
                      inputMode="decimal"
                      value={driverPayUahPerDay}
                      onChange={(e) => setDriverPayUahPerDay(parseNumericInput(e.target.value))}
                      placeholder="0"
                    />
                  </Field>
                )}
              </div>
            </div>

            <Separator />

            {/* Інші витрати та нотатки */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="extra_costs_uah" label="Інші витрати (грн)">
                <Input
                  id="extra_costs_uah"
                  type="text"
                  inputMode="decimal"
                  value={extraCostsUah}
                  onChange={(e) => setExtraCostsUah(parseNumericInput(e.target.value))}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field id="notes" label="Нотатки">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Додаткова інформація про поїздку"
                className="resize-none"
              />
            </Field>

            <Separator />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Збереження..." : "Зберегти поїздку"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/trips")}
              >
                Скасувати
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Результат</CardTitle>
          <CardDescription>
            Попередній розрахунок за поточними полями форми
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previewMetrics.error ? (
            <p className="text-sm text-destructive">{previewMetrics.error}</p>
          ) : previewMetrics.metrics ? (
            <div className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Відстань</span>
                  <span className="tabular-nums">{formatKm(previewMetrics.metrics.distance_km)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Паливо витрачено</span>
                  <span className="tabular-nums">{formatL(previewMetrics.metrics.fuel_used_l)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Витрати на паливо</span>
                  <span className="tabular-nums">{formatUah(previewMetrics.metrics.fuel_cost_uah)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Амортизація</span>
                  <span className="tabular-nums">{formatUah(previewMetrics.metrics.depreciation_cost_uah)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Податки</span>
                  <span className="tabular-nums">{formatUah(previewMetrics.metrics.taxes_cost_uah)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Водій</span>
                  <span className="tabular-nums">{formatUah(previewMetrics.metrics.driver_cost_uah)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b">
                  <span className="text-muted-foreground">Інші витрати</span>
                  <span className="tabular-nums">{formatUah(extraCostsNum)}</span>
                </div>
                <div className="flex justify-between gap-2 py-1.5 border-b font-medium">
                  <span className="text-muted-foreground">Всього витрат</span>
                  <span className="tabular-nums">{formatUah(previewMetrics.metrics.total_costs_uah)}</span>
                </div>
                {tripType !== "raw" && (
                  <>
                    <div className="flex justify-between gap-2 py-1.5 border-b font-medium">
                      <span className="text-muted-foreground">Прибуток</span>
                      <span className="tabular-nums">{formatUah(previewMetrics.metrics.profit_uah)}</span>
                    </div>
                    <div className="flex justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">Прибуток/км</span>
                      <span className="tabular-nums">{formatUah(previewMetrics.metrics.profit_per_km_uah)}</span>
                    </div>
                    <div className="flex justify-between gap-2 py-1.5 border-b">
                      <span className="text-muted-foreground">ROI</span>
                      <span className="tabular-nums">{formatPercent(previewMetrics.metrics.roi_percent)}</span>
                    </div>
                  </>
                )}
                {tripType === "raw" && (() => {
                  const bags = parseNum(bagsCount);
                  const costPerBag =
                    bags != null && bags >= 1 ? previewMetrics.metrics.total_costs_uah / bags : null;
                  return costPerBag != null ? (
                    <div className="flex justify-between gap-2 py-1.5 border-b font-medium">
                      <span className="text-muted-foreground">Вартість 1 мішка</span>
                      <span className="tabular-nums">{formatUah(costPerBag)}</span>
                    </div>
                  ) : null;
                })()}
              </div>
              {tripType !== "raw" && (
                <div className="flex items-center gap-2 pt-2 font-medium">
                  <span>{statusIcon}</span>
                  <span>{statusLabel}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Заповніть пробіг (початок і кінець) для розрахунку
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
