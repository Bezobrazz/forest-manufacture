"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { createSupplier, createSupplierDelivery } from "@/app/actions";
import { createTrip } from "@/app/trips/actions";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Product, Supplier } from "@/lib/types";
import { TYPE_DEFAULTS } from "@/lib/trips/constants";
import { dateToYYYYMMDD } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TripDateField } from "@/components/trip-date-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_RAW_DRIVER_PAY_UAH = 1000;
const DEFAULT_RAW_TRIP_NAME = "Доставка сировини";

type Props = {
  suppliers: Supplier[];
  warehouseId: string;
  productId: string;
  packingMaterials: Product[];
  defaultPackingProductId: string;
  vehicles: Vehicle[];
  lastVehicleId: string | null;
};

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function FieldDeliveryForm({
  suppliers: initialSuppliers,
  warehouseId,
  productId,
  packingMaterials,
  defaultPackingProductId,
  vehicles,
  lastVehicleId,
}: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialProductId, setMaterialProductId] = useState(
    defaultPackingProductId
  );
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [vehicleId, setVehicleId] = useState(
    lastVehicleId && vehicles.some((v) => v.id === lastVehicleId)
      ? lastVehicleId
      : (vehicles[0]?.id ?? "")
  );
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [extraCosts, setExtraCosts] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  const selectedSupplier = suppliers.find((s) => String(s.id) === supplierId);

  async function handleCreateSupplier() {
    const name = newSupplierName.trim();
    if (!name) return;
    setCreatingSupplier(true);
    try {
      const formData = new FormData();
      formData.set("name", name);
      const result = await createSupplier(formData);
      if (!result.success || !result.data) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      const created = result.data as Supplier;
      setSuppliers((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "uk"))
      );
      setSupplierId(String(created.id));
      setNewSupplierName("");
      setSupplierOpen(false);
      toast.success("Постачальника додано");
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supplierId || !productId || !warehouseId || !quantity) {
      toast.error("Заповніть поля закупівлі");
      return;
    }
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      toast.error("Оберіть транспорт");
      return;
    }
    const bags = parseNum(quantity);
    if (bags == null || bags < 1) {
      toast.error("Кількість має бути не менше 1");
      return;
    }

    const day = dateToYYYYMMDD(eventDate);
    const defaults = TYPE_DEFAULTS[vehicle.type];
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("supplier_id", supplierId);
      formData.set("product_id", productId);
      formData.set("warehouse_id", warehouseId);
      formData.set("quantity", quantity);
      formData.set("delivery_date", day);
      if (price.trim()) formData.set("price_per_unit", price);
      if (materialQuantity.trim() && Number(materialQuantity) > 0) {
        formData.set("material_product_id", materialProductId);
        formData.set("material_quantity", materialQuantity);
      }

      const purchaseResult = await createSupplierDelivery(formData);
      if (!purchaseResult.success) {
        toast.error("Помилка закупівлі", {
          description: purchaseResult.error,
        });
        return;
      }

      const tripResult = await createTrip({
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
        bags_count: Math.floor(bags),
        notes: notes.trim() || null,
      });

      if (!tripResult.ok) {
        toast.error("Закупівлю збережено, поїздку — ні", {
          description: tripResult.error,
        });
        return;
      }

      toast.success("Закупівлю і поїздку збережено");
      setQuantity("");
      setPrice("");
      setMaterialQuantity("");
      setStartOdometer("");
      setEndOdometer("");
      setExtraCosts("");
      setNotes("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Немає транспорту в обліковому записі. Додайте авто в ERP, потім
        повторіть.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Закупівля</h2>

        <TripDateField
          id="event_date"
          label="Дата *"
          date={eventDate}
          onSelect={setEventDate}
          open={dateOpen}
          onOpenChange={setDateOpen}
        />

        <div className="space-y-1.5">
          <Label>Постачальник *</Label>
          <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="h-11 w-full justify-between text-base"
              >
                {selectedSupplier?.name ?? "Оберіть постачальника"}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(100vw-2rem,22rem)] p-0"
              align="start"
            >
              <div className="p-2">
                <Input
                  placeholder="Пошук…"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="mb-2 h-11"
                />
                <div className="max-h-52 overflow-auto">
                  {filteredSuppliers.map((supplier) => (
                    <button
                      type="button"
                      key={supplier.id}
                      className="flex w-full items-center gap-2 rounded-sm p-2 text-left hover:bg-accent"
                      onClick={() => {
                        setSupplierId(String(supplier.id));
                        setSupplierSearch("");
                        setSupplierOpen(false);
                      }}
                    >
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.phone ? (
                          <div className="text-xs text-muted-foreground">
                            {supplier.phone}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2 border-t pt-2">
                  <Input
                    placeholder="Новий постачальник"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={creatingSupplier || !newSupplierName.trim()}
                    aria-busy={creatingSupplier}
                    onClick={() => void handleCreateSupplier()}
                  >
                    {creatingSupplier ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quantity">Кількість (мішки) *</Label>
          <Input
            id="quantity"
            inputMode="decimal"
            className="h-11 text-base"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Також піде в поїздку як кількість мішків
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="price">Ціна за одиницю, ₴</Label>
          <Input
            id="price"
            inputMode="decimal"
            className="h-11 text-base"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <Collapsible open={materialsOpen} onOpenChange={setMaterialsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="px-0 text-muted-foreground"
            >
              {materialsOpen ? "Сховати матеріали" : "Матеріали (передано)"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Матеріал</Label>
              <Select
                value={materialProductId}
                onValueChange={setMaterialProductId}
              >
                <SelectTrigger className="h-11 text-base">
                  <SelectValue placeholder="Оберіть матеріал" />
                </SelectTrigger>
                <SelectContent>
                  {packingMaterials.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material_quantity">Кількість матеріалів</Label>
              <Input
                id="material_quantity"
                inputMode="decimal"
                className="h-11 text-base"
                value={materialQuantity}
                onChange={(e) => setMaterialQuantity(e.target.value)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <section className="space-y-4 border-t pt-4">
        <h2 className="text-sm font-medium text-muted-foreground">Поїздка</h2>

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
      </section>

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
          "Зберегти закупівлю і поїздку"
        )}
      </Button>
    </form>
  );
}
