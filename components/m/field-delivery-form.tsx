"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  createFieldDeliveryAndTrip,
  createFieldSupplier,
} from "@/app/m/actions";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Supplier } from "@/lib/types";
import { dateToYYYYMMDD, formatNumberWithUnit } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const PACKING_BAG_LABEL = "Мішок для сировини (білий)";

type Props = {
  accessName: string;
  suppliers: Supplier[];
  warehouseId: string;
  productId: string;
  packingProductId: string;
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
  accessName,
  suppliers: initialSuppliers,
  warehouseId,
  productId,
  packingProductId,
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
  const [actualPaid, setActualPaid] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [vehicleId, setVehicleId] = useState(
    lastVehicleId && vehicles.some((v) => v.id === lastVehicleId)
      ? lastVehicleId
      : (vehicles[0]?.id ?? "")
  );
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");
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

  const purchaseSum = useMemo(() => {
    const qty = parseNum(quantity);
    const unit = parseNum(price);
    if (qty == null || unit == null || qty <= 0 || unit < 0) return null;
    return Math.round(qty * unit * 100) / 100;
  }, [quantity, price]);

  async function handleCreateSupplier() {
    const name = newSupplierName.trim();
    if (!name) return;
    setCreatingSupplier(true);
    try {
      const result = await createFieldSupplier(name);
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      setSuppliers((prev) =>
        [...prev, result.supplier].sort((a, b) =>
          a.name.localeCompare(b.name, "uk")
        )
      );
      setSupplierId(String(result.supplier.id));
      setNewSupplierName("");
      setSupplierOpen(false);
      toast.success("Постачальника додано");
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supplierId || !productId || !warehouseId) {
      toast.error("Заповніть поля закупівлі");
      return;
    }
    const bags = parseNum(quantity);
    const pricePerUnit = parseNum(price);
    if (bags == null || bags < 1) {
      toast.error("Кількість має бути не менше 1");
      return;
    }
    if (pricePerUnit == null || pricePerUnit < 0) {
      toast.error("Вкажіть ціну за одиницю");
      return;
    }
    if (!vehicleId) {
      toast.error("Оберіть транспорт");
      return;
    }
    const startKm = parseNum(startOdometer);
    const endKm = parseNum(endOdometer);
    const fuelPriceUah = parseNum(fuelPrice);
    if (startKm == null || endKm == null) {
      toast.error("Вкажіть одометр початок і кінець");
      return;
    }
    if (endKm < startKm) {
      toast.error("Кінець одометра не може бути меншим за початок");
      return;
    }
    if (fuelPriceUah == null || fuelPriceUah < 0) {
      toast.error("Вкажіть вартість пального за літр");
      return;
    }

    setPending(true);
    try {
      const materialQty = parseNum(materialQuantity);
      const result = await createFieldDeliveryAndTrip({
        supplierId: Number(supplierId),
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        quantity: bags,
        pricePerUnit,
        actualPaid: parseNum(actualPaid),
        deliveryDate: dateToYYYYMMDD(eventDate),
        materialProductId:
          materialQty != null && materialQty > 0 && packingProductId
            ? Number(packingProductId)
            : null,
        materialQuantity:
          materialQty != null && materialQty > 0 ? materialQty : null,
        vehicleId,
        startOdometerKm: startKm,
        endOdometerKm: endKm,
        fuelPriceUahPerL: fuelPriceUah,
      });
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Закупівлю і поїздку збережено");
      setQuantity("");
      setPrice("");
      setActualPaid("");
      setMaterialQuantity("");
      setStartOdometer("");
      setEndOdometer("");
      setFuelPrice("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-sm text-destructive">
        Немає транспорту в автопарку. Додайте авто в ERP, потім повторіть.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ви входите як{" "}
        <span className="font-semibold text-foreground">{accessName}</span>
      </p>
      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Закупівля</h2>

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
          <Label htmlFor="price">Ціна за одиницю, ₴ *</Label>
          <Input
            id="price"
            inputMode="decimal"
            className="h-11 text-base"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase_sum">Сума, ₴</Label>
          <Input
            id="purchase_sum"
            className="h-11 text-base font-semibold tabular-nums"
            value={
              purchaseSum != null
                ? formatNumberWithUnit(purchaseSum, "₴")
                : ""
            }
            placeholder="—"
            readOnly
            disabled
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="actual_paid">Фактично сплачено, ₴</Label>
          <Input
            id="actual_paid"
            inputMode="decimal"
            className="h-11 text-base"
            value={actualPaid}
            onChange={(e) => setActualPaid(e.target.value)}
            placeholder={
              purchaseSum != null ? String(purchaseSum) : undefined
            }
          />
        </div>

        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="text-sm font-semibold">Матеріали (передано)</div>
          <div className="space-y-1.5">
            <Label>Матеріал</Label>
            <Input
              className="h-11 text-base"
              value={PACKING_BAG_LABEL}
              readOnly
              disabled
            />
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
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Поїздка</h2>

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
            <Label htmlFor="odo_start">Одометр початок *</Label>
            <Input
              id="odo_start"
              inputMode="decimal"
              className="h-11 text-base"
              value={startOdometer}
              onChange={(e) => setStartOdometer(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="odo_end">Одометр кінець *</Label>
            <Input
              id="odo_end"
              inputMode="decimal"
              className="h-11 text-base"
              value={endOdometer}
              onChange={(e) => setEndOdometer(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fuel_price">Вартість пального, ₴/л *</Label>
          <Input
            id="fuel_price"
            inputMode="decimal"
            className="h-11 text-base"
            value={fuelPrice}
            onChange={(e) => setFuelPrice(e.target.value)}
            required
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
