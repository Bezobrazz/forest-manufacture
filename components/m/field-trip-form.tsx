"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTrip,
  getSupplierDeliveryBagsCountForDate,
} from "@/app/trips/actions";
import type { Vehicle } from "@/app/vehicles/actions";
import { TYPE_DEFAULTS } from "@/lib/trips/constants";
import { dateToYYYYMMDD } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TripDateField } from "@/components/trip-date-field";

const DEFAULT_RAW_DRIVER_PAY_UAH = 1000;
const DEFAULT_RAW_TRIP_NAME = "Доставка сировини";

type Props = {
  vehicles: Vehicle[];
  lastVehicleId: string | null;
  initialBagsCount: number;
};

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function FieldTripForm({
  vehicles,
  lastVehicleId,
  initialBagsCount,
}: Props) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(
    lastVehicleId && vehicles.some((v) => v.id === lastVehicleId)
      ? lastVehicleId
      : (vehicles[0]?.id ?? "")
  );
  const [tripDate, setTripDate] = useState(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [bagsCount, setBagsCount] = useState(
    initialBagsCount > 0 ? String(initialBagsCount) : ""
  );
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [extraCosts, setExtraCosts] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const date = dateToYYYYMMDD(tripDate);
    let cancelled = false;
    getSupplierDeliveryBagsCountForDate(date).then((count) => {
      if (cancelled) return;
      setBagsCount(count > 0 ? String(count) : "");
    });
    return () => {
      cancelled = true;
    };
  }, [tripDate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      toast.error("Оберіть транспорт");
      return;
    }
    const defaults = TYPE_DEFAULTS[vehicle.type];
    const day = dateToYYYYMMDD(tripDate);
    setPending(true);
    try {
      const result = await createTrip({
        name: DEFAULT_RAW_TRIP_NAME,
        trip_start_date: day,
        trip_end_date: day,
        vehicle_id: vehicleId,
        trip_type: "raw",
        distance_input_mode: "odometer",
        start_odometer_km: parseNum(startOdometer),
        end_odometer_km: parseNum(endOdometer),
        fuel_consumption_l_per_100km:
          vehicle.default_fuel_consumption_l_per_100km ?? defaults.fuel,
        fuel_price_uah_per_l: null,
        depreciation_uah_per_km:
          vehicle.default_depreciation_uah_per_km ?? defaults.depreciation,
        days_count: 1,
        daily_taxes_uah: vehicle.default_daily_taxes_uah ?? defaults.dailyTaxes,
        freight_uah: 0,
        driver_pay_mode: "per_trip",
        driver_pay_uah: DEFAULT_RAW_DRIVER_PAY_UAH,
        extra_costs_uah: parseNum(extraCosts) ?? 0,
        bags_count: parseNum(bagsCount),
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Поїздку збережено");
      router.push("/m");
    } finally {
      setPending(false);
    }
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Немає транспорту в обліковому записі. Додайте авто в ERP, потім повторіть.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Транспорт *</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger className="h-11 text-base">
            <SelectValue placeholder="Оберіть транспорт" />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TripDateField
        id="trip_date"
        label="Дата *"
        date={tripDate}
        onSelect={setTripDate}
        open={dateOpen}
        onOpenChange={setDateOpen}
      />

      <div className="space-y-1.5">
        <Label htmlFor="bags">Мішки *</Label>
        <Input
          id="bags"
          inputMode="numeric"
          className="h-11 text-base"
          value={bagsCount}
          onChange={(e) => setBagsCount(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="odo_start">Одометр початок</Label>
          <Input
            id="odo_start"
            inputMode="decimal"
            className="h-11 text-base"
            value={startOdometer}
            onChange={(e) => setStartOdometer(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="odo_end">Одометр кінець</Label>
          <Input
            id="odo_end"
            inputMode="decimal"
            className="h-11 text-base"
            value={endOdometer}
            onChange={(e) => setEndOdometer(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="extra">Інші витрати, ₴</Label>
        <Input
          id="extra"
          inputMode="decimal"
          className="h-11 text-base"
          value={extraCosts}
          onChange={(e) => setExtraCosts(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Нотатки</Label>
        <Textarea
          id="notes"
          rows={3}
          className="text-base"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="h-12 w-full text-base"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Збереження…
          </>
        ) : (
          "Зберегти поїздку"
        )}
      </Button>
    </form>
  );
}
