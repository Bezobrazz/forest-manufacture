"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTrip, type CreateTripPayload } from "@/app/trips/actions";
import { getVehicles, type Vehicle } from "@/app/vehicles/actions";
import type { DriverPayMode } from "@/lib/trips/calc";
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
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";

const driverPayModeLabels: Record<DriverPayMode, string> = {
  per_trip: "За рейс",
  per_day: "За день",
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
  const [tripDate, setTripDate] = useState("");
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
  const [extraCostsUah, setExtraCostsUah] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    getVehicles().then((data) => {
      setVehicles(data);
      setVehiclesLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Вкажіть назву поїздки");
      return;
    }
    if (!tripDate.trim()) {
      toast.error("Вкажіть дату поїздки");
      return;
    }
    if (!vehicleId) {
      toast.error("Оберіть транспорт");
      return;
    }
    setIsPending(true);
    const payload: CreateTripPayload = {
      name: name.trim(),
      trip_date: tripDate.trim(),
      vehicle_id: vehicleId,
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
      extra_costs_uah: parseNum(extraCostsUah) ?? 0,
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
            {/* Основне: назва, дата, транспорт */}
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
              <Field id="trip_date" label="Дата *">
                <Input
                  id="trip_date"
                  type="date"
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  required
                />
              </Field>
            </div>
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
                    type="number"
                    min={0}
                    step={0.1}
                    value={startOdometer}
                    onChange={(e) => setStartOdometer(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field id="end_odometer" label="Кінець (км)">
                  <Input
                    id="end_odometer"
                    type="number"
                    min={0}
                    step={0.1}
                    value={endOdometer}
                    onChange={(e) => setEndOdometer(e.target.value)}
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
                    type="number"
                    min={0}
                    step={0.1}
                    value={fuelConsumption}
                    onChange={(e) => setFuelConsumption(e.target.value)}
                    placeholder="12"
                  />
                </Field>
                <Field id="fuel_price" label="Ціна за л (грн)">
                  <Input
                    id="fuel_price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={fuelPrice}
                    onChange={(e) => setFuelPrice(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field id="depreciation" label="Амортизація (грн/км)">
                  <Input
                    id="depreciation"
                    type="number"
                    min={0}
                    step={0.1}
                    value={depreciation}
                    onChange={(e) => setDepreciation(e.target.value)}
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
                    type="number"
                    min={1}
                    value={daysCount}
                    onChange={(e) => setDaysCount(e.target.value)}
                    placeholder="1"
                  />
                </Field>
                <Field id="daily_taxes" label="Щоденні податки (грн)">
                  <Input
                    id="daily_taxes"
                    type="number"
                    min={0}
                    step={1}
                    value={dailyTaxes}
                    onChange={(e) => setDailyTaxes(e.target.value)}
                    placeholder="150"
                  />
                </Field>
                <Field id="freight_uah" label="Фрахт — дохід (грн)">
                  <Input
                    id="freight_uah"
                    type="number"
                    min={0}
                    step={0.01}
                    value={freightUah}
                    onChange={(e) => setFreightUah(e.target.value)}
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
                    </SelectContent>
                  </Select>
                </Field>
                {driverPayMode === "per_trip" ? (
                  <Field id="driver_pay_uah" label="Сума за рейс (грн)">
                    <Input
                      id="driver_pay_uah"
                      type="number"
                      min={0}
                      step={0.01}
                      value={driverPayUah}
                      onChange={(e) => setDriverPayUah(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                ) : (
                  <Field id="driver_pay_uah_per_day" label="Сума за день (грн)">
                    <Input
                      id="driver_pay_uah_per_day"
                      type="number"
                      min={0}
                      step={0.01}
                      value={driverPayUahPerDay}
                      onChange={(e) => setDriverPayUahPerDay(e.target.value)}
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
                  type="number"
                  min={0}
                  step={0.01}
                  value={extraCostsUah}
                  onChange={(e) => setExtraCostsUah(e.target.value)}
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
    </div>
  );
}
