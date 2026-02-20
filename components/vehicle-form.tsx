"use client";

import { useState, useEffect } from "react";
import {
  createVehicle,
  updateVehicle,
  type CreateVehiclePayload,
  type Vehicle,
} from "@/app/vehicles/actions";
import { TYPE_DEFAULTS } from "@/lib/trips/constants";
import type { VehicleType } from "@/lib/trips/calc";
import { vehicleFormSchema } from "@/lib/vehicles/schemas";
import { parseNumericInput } from "@/lib/format";
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
import { toast } from "sonner";

const typeLabels: Record<VehicleType, string> = {
  van: "Фургон",
  truck: "Вантажівка",
};

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface VehicleFormProps {
  vehicleId?: string;
  initialData?: Vehicle | null;
  onVehicleAdded?: () => void | Promise<void>;
  onVehicleUpdated?: () => void | Promise<void>;
}

function toFormState(v: Vehicle | null | undefined) {
  if (!v) return null;
  return {
    name: v.name ?? "",
    type: (v.type ?? "van") as VehicleType,
    fuel:
      v.default_fuel_consumption_l_per_100km != null
        ? String(v.default_fuel_consumption_l_per_100km)
        : "",
    dailyTaxes:
      v.default_daily_taxes_uah != null ? String(v.default_daily_taxes_uah) : "",
    depreciation:
      v.default_depreciation_uah_per_km != null
        ? String(v.default_depreciation_uah_per_km)
        : "",
  };
}

export function VehicleForm({
  vehicleId,
  initialData,
  onVehicleAdded,
  onVehicleUpdated,
}: VehicleFormProps) {
  const isEdit = Boolean(vehicleId);
  const defaults = TYPE_DEFAULTS.van;
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<VehicleType>("van");
  const [fuel, setFuel] = useState<string>(String(defaults.fuel));
  const [dailyTaxes, setDailyTaxes] = useState<string>(String(defaults.dailyTaxes));
  const [depreciation, setDepreciation] = useState<string>(
    String(defaults.depreciation)
  );

  useEffect(() => {
    const state = toFormState(initialData ?? null);
    if (state) {
      setName(state.name);
      setType(state.type);
      setFuel(state.fuel || String(TYPE_DEFAULTS[state.type].fuel));
      setDailyTaxes(state.dailyTaxes || String(TYPE_DEFAULTS[state.type].dailyTaxes));
      setDepreciation(
        state.depreciation || String(TYPE_DEFAULTS[state.type].depreciation)
      );
    }
  }, [initialData]);

  const applyTypeDefaults = (newType: VehicleType) => {
    const d = TYPE_DEFAULTS[newType];
    setFuel(String(d.fuel));
    setDailyTaxes(String(d.dailyTaxes));
    setDepreciation(String(d.depreciation));
  };

  const handleTypeChange = (newType: VehicleType) => {
    setType(newType);
    applyTypeDefaults(newType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      type,
      default_fuel_consumption_l_per_100km: parseNum(fuel),
      default_depreciation_uah_per_km: parseNum(depreciation),
      default_daily_taxes_uah: parseNum(dailyTaxes),
    };
    const parsed = vehicleFormSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = first.name?.[0] ?? first.type?.[0] ?? parsed.error.message;
      toast.error(msg);
      return;
    }
    setIsPending(true);
    try {
      if (isEdit && vehicleId) {
        const result = await updateVehicle(vehicleId, parsed.data);
        if (result.ok) {
          toast.success("Транспорт оновлено");
          if (onVehicleUpdated) await onVehicleUpdated();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createVehicle(parsed.data);
        if (result.ok) {
          toast.success("Транспорт додано");
          setName("");
          setType("van");
          applyTypeDefaults("van");
          if (onVehicleAdded) await onVehicleAdded();
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("Помилка при збереженні");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vehicle-name">Назва *</Label>
        <Input
          id="vehicle-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Наприклад: ГАЗель А"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Тип</Label>
        <Select
          value={type}
          onValueChange={(v) => handleTypeChange(v as VehicleType)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="van">{typeLabels.van}</SelectItem>
            <SelectItem value="truck">{typeLabels.truck}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          При зміні типу підставляються типові значення; їх можна редагувати
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vehicle-fuel">Витрата палива (л/100 км)</Label>
        <Input
          id="vehicle-fuel"
          type="text"
          inputMode="decimal"
          value={fuel}
          onChange={(e) => setFuel(parseNumericInput(e.target.value))}
          placeholder="12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vehicle-dailyTaxes">Щоденні податки (грн)</Label>
        <Input
          id="vehicle-dailyTaxes"
          type="text"
          inputMode="decimal"
          value={dailyTaxes}
          onChange={(e) => setDailyTaxes(parseNumericInput(e.target.value))}
          placeholder="150"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vehicle-depreciation">Амортизація (грн/км)</Label>
        <Input
          id="vehicle-depreciation"
          type="text"
          inputMode="decimal"
          value={depreciation}
          onChange={(e) => setDepreciation(parseNumericInput(e.target.value))}
          placeholder="1.2"
        />
      </div>
      <Button type="submit" disabled={isPending} className="gap-2">
        {isPending ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            Збереження...
          </>
        ) : isEdit ? (
          "Зберегти зміни"
        ) : (
          "Зберегти"
        )}
      </Button>
    </form>
  );
}
