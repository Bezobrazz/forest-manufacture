"use client";

import { useState } from "react";
import { createVehicle, type CreateVehiclePayload } from "@/app/vehicles/actions";
import { TYPE_DEFAULTS } from "@/lib/trips/constants";
import type { VehicleType } from "@/lib/trips/calc";
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
  onVehicleAdded?: () => void | Promise<void>;
}

export function VehicleForm({ onVehicleAdded }: VehicleFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<VehicleType>("van");
  const [fuel, setFuel] = useState<string>(String(TYPE_DEFAULTS.van.fuel));
  const [dailyTaxes, setDailyTaxes] = useState<string>(
    String(TYPE_DEFAULTS.van.dailyTaxes)
  );
  const [depreciation, setDepreciation] = useState<string>(
    String(TYPE_DEFAULTS.van.depreciation)
  );

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
    if (!name.trim()) {
      toast.error("Введіть назву транспорту");
      return;
    }
    setIsPending(true);
    const payload: CreateVehiclePayload = {
      name: name.trim(),
      type,
      default_fuel_consumption_l_per_100km: parseNum(fuel),
      default_daily_taxes_uah: parseNum(dailyTaxes),
      default_depreciation_uah_per_km: parseNum(depreciation),
    };
    try {
      const result = await createVehicle(payload);
      if (result.ok) {
        toast.success("Транспорт додано");
        setName("");
        setType("van");
        applyTypeDefaults("van");
        if (onVehicleAdded) {
          await onVehicleAdded();
        }
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
          type="number"
          min={0}
          step={0.1}
          value={fuel}
          onChange={(e) => setFuel(e.target.value)}
          placeholder="12"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vehicle-dailyTaxes">Щоденні податки (грн)</Label>
        <Input
          id="vehicle-dailyTaxes"
          type="number"
          min={0}
          step={1}
          value={dailyTaxes}
          onChange={(e) => setDailyTaxes(e.target.value)}
          placeholder="150"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vehicle-depreciation">Амортизація (грн/км)</Label>
        <Input
          id="vehicle-depreciation"
          type="number"
          min={0}
          step={0.1}
          value={depreciation}
          onChange={(e) => setDepreciation(e.target.value)}
          placeholder="1.2"
        />
      </div>
      <Button type="submit" disabled={isPending} className="gap-2">
        {isPending ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            Збереження...
          </>
        ) : (
          "Зберегти"
        )}
      </Button>
    </form>
  );
}
