"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  getTrip,
  updateTrip,
  type CreateTripPayload,
  type TripDetail,
} from "@/app/trips/actions";
import { getVehicles, type Vehicle } from "@/app/vehicles/actions";
import type { DriverPayMode, TripType } from "@/lib/trips/calc";
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
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { tripFormSchema } from "@/lib/trips/schemas";
import { formatUah, formatKm, formatPercent, parseNumericInput } from "@/lib/format";

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

function fillStateFromTrip(
  trip: TripDetail
): Record<string, string> {
  return {
    name: trip.name?.trim() ?? "",
    tripStartDate: trip.trip_start_date ?? trip.trip_date ?? "",
    tripEndDate: trip.trip_end_date ?? trip.trip_date ?? "",
    tripType: (trip.trip_type === "commerce" ? "commerce" : "raw") as TripType,
    vehicleId: trip.vehicle_id ?? "",
    startOdometer: trip.start_odometer_km != null ? String(trip.start_odometer_km) : "",
    endOdometer: trip.end_odometer_km != null ? String(trip.end_odometer_km) : "",
    fuelConsumption: trip.fuel_consumption_l_per_100km != null ? String(trip.fuel_consumption_l_per_100km) : "",
    fuelPrice: trip.fuel_price_uah_per_l != null ? String(trip.fuel_price_uah_per_l) : "",
    depreciation: trip.depreciation_uah_per_km != null ? String(trip.depreciation_uah_per_km) : "",
    daysCount: trip.days_count != null ? String(trip.days_count) : "1",
    dailyTaxes: trip.daily_taxes_uah != null ? String(trip.daily_taxes_uah) : "150",
    freightUah: trip.freight_uah != null ? String(trip.freight_uah) : "0",
    driverPayMode:
      trip.driver_pay_mode === "per_day"
        ? "per_day"
        : trip.driver_pay_mode === "percent_of_freight"
          ? "percent_of_freight"
          : "per_trip",
    driverPayUah: trip.driver_pay_uah != null ? String(trip.driver_pay_uah) : "0",
    driverPayUahPerDay: trip.driver_pay_uah_per_day != null ? String(trip.driver_pay_uah_per_day) : "0",
    driverPayPercentOfFreight:
      trip.driver_pay_percent_of_freight != null ? String(trip.driver_pay_percent_of_freight) : "0",
    extraCostsUah: trip.extra_costs_uah != null ? String(trip.extra_costs_uah) : "0",
    bagsCount: trip.bags_count != null ? String(trip.bags_count) : "",
    notes: trip.notes?.trim() ?? "",
  };
}

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const [name, setName] = useState("");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
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
    if (!tripId) return;
    Promise.all([getTrip(tripId), getVehicles()]).then(([t, v]) => {
      setTrip(t ?? null);
      setVehicles(v ?? []);
      if (t) {
        const s = fillStateFromTrip(t);
        setName(s.name);
        setTripStartDate(s.tripStartDate);
        setTripEndDate(s.tripEndDate);
        setTripType(s.tripType);
        setVehicleId(s.vehicleId);
        setStartOdometer(s.startOdometer);
        setEndOdometer(s.endOdometer);
        setFuelConsumption(s.fuelConsumption);
        setFuelPrice(s.fuelPrice);
        setDepreciation(s.depreciation);
        setDaysCount(s.daysCount);
        setDailyTaxes(s.dailyTaxes);
        setFreightUah(s.freightUah);
        setDriverPayMode(s.driverPayMode as DriverPayMode);
        setDriverPayUah(s.driverPayUah);
        setDriverPayUahPerDay(s.driverPayUahPerDay);
        setDriverPayPercentOfFreight(s.driverPayPercentOfFreight);
        setExtraCostsUah(s.extraCostsUah);
        setBagsCount(s.bagsCount);
        setNotes(s.notes);
      }
      setLoading(false);
    });
  }, [tripId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) return;
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
      const result = await updateTrip(tripId, payload);
      if (result.ok) {
        toast.success("Поїздку оновлено");
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

  if (loading) {
    return (
      <div className="container py-6">
        <p className="text-muted-foreground">Завантаження...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="container py-6 space-y-4">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до поїздок
        </Link>
        <p className="text-muted-foreground">Поїздку не знайдено.</p>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-3xl space-y-6">
      <div>
        <Link
          href="/trips"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад до поїздок</span>
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">
            {trip.name?.trim() || "Редагування поїздки"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Деталі та редагування поїздки
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Дані поїздки</CardTitle>
            <CardDescription>
              Змініть поля та збережіть. Метрики перераховуються автоматично.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger id="vehicle">
                  <SelectValue placeholder="Оберіть транспорт" />
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
                  />
                </Field>
                <Field id="end_odometer" label="Кінець (км)">
                  <Input
                    id="end_odometer"
                    type="text"
                    inputMode="decimal"
                    value={endOdometer}
                    onChange={(e) => setEndOdometer(parseNumericInput(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <Separator />

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
                  />
                </Field>
                <Field id="fuel_price" label="Ціна за л (грн)">
                  <Input
                    id="fuel_price"
                    type="text"
                    inputMode="decimal"
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(parseNumericInput(e.target.value))}
                  />
                </Field>
                <Field id="depreciation" label="Амортизація (грн/км)">
                  <Input
                    id="depreciation"
                    type="text"
                    inputMode="decimal"
                    value={depreciation}
                    onChange={(e) => setDepreciation(parseNumericInput(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <Separator />

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
                  />
                </Field>
                <Field id="daily_taxes" label="Щоденні податки (грн)">
                  <Input
                    id="daily_taxes"
                    type="text"
                    inputMode="decimal"
                    value={dailyTaxes}
                    onChange={(e) => setDailyTaxes(parseNumericInput(e.target.value))}
                  />
                </Field>
                <Field id="freight_uah" label="Фрахт — дохід (грн)">
                  <Input
                    id="freight_uah"
                    type="text"
                    inputMode="decimal"
                    value={freightUah}
                    onChange={(e) => setFreightUah(parseNumericInput(e.target.value))}
                  />
                </Field>
              </div>
            </div>

            <Separator />

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
                    />
                  </Field>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="extra_costs_uah" label="Інші витрати (грн)">
                <Input
                  id="extra_costs_uah"
                  type="text"
                  inputMode="decimal"
                  value={extraCostsUah}
                  onChange={(e) => setExtraCostsUah(parseNumericInput(e.target.value))}
                />
              </Field>
            </div>
            <Field id="notes" label="Нотатки">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </Field>

            <Separator />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Збереження..." : "Зберегти зміни"}
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

      <Card>
        <CardHeader>
          <CardTitle>Поточний результат</CardTitle>
          <CardDescription>
            Збережені метрики цієї поїздки
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Відстань</span>
              <span className="tabular-nums">{formatKm(trip.distance_km)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Витрати всього</span>
              <span className="tabular-nums">{formatUah(trip.total_costs_uah)}</span>
            </div>
            {trip.trip_type !== "raw" && (
              <>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Прибуток</span>
                  <span className="tabular-nums">{formatUah(trip.profit_uah)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">ROI</span>
                  <span className="tabular-nums">{formatPercent(trip.roi_percent)}</span>
                </div>
              </>
            )}
            {trip.trip_type === "raw" &&
              trip.bags_count != null &&
              trip.bags_count >= 1 &&
              trip.total_costs_uah != null && (
                <div className="flex justify-between py-1.5 border-b font-medium">
                  <span className="text-muted-foreground">Вартість 1 мішка</span>
                  <span className="tabular-nums">
                    {formatUah(trip.total_costs_uah / trip.bags_count)}
                  </span>
                </div>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
