"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  createFieldDeliveriesAndTrip,
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

type PurchaseLine = {
  key: string;
  supplierId: string;
  quantity: string;
  price: string;
  actualPaid: string;
  materialQuantity: string;
};

function parseNum(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function createEmptyLine(): PurchaseLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    supplierId: "",
    quantity: "",
    price: "",
    actualPaid: "",
    materialQuantity: "",
  };
}

function linePurchaseSum(line: PurchaseLine): number | null {
  const qty = parseNum(line.quantity);
  const unit = parseNum(line.price);
  if (qty == null || unit == null || qty <= 0 || unit < 0) return null;
  return Math.round(qty * unit * 100) / 100;
}

function isLineDirty(line: PurchaseLine): boolean {
  return Boolean(
    line.supplierId ||
      line.quantity.trim() ||
      line.price.trim() ||
      line.actualPaid.trim() ||
      line.materialQuantity.trim()
  );
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
  const defaultVehicleId =
    lastVehicleId && vehicles.some((v) => v.id === lastVehicleId)
      ? lastVehicleId
      : (vehicles[0]?.id ?? "");

  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [purchases, setPurchases] = useState<PurchaseLine[]>(() => [
    createEmptyLine(),
  ]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpenKey, setSupplierOpenKey] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [eventDate, setEventDate] = useState(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
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

  const bagsTotal = useMemo(
    () =>
      purchases.reduce((sum, line) => {
        const qty = parseNum(line.quantity);
        return sum + (qty != null && qty > 0 ? Math.floor(qty) : 0);
      }, 0),
    [purchases]
  );

  const sessionDirty = useMemo(() => {
    if (purchases.length > 1) return true;
    if (purchases.some(isLineDirty)) return true;
    if (startOdometer.trim() || endOdometer.trim() || fuelPrice.trim()) {
      return true;
    }
    if (vehicleId && vehicleId !== defaultVehicleId) return true;
    return false;
  }, [
    purchases,
    startOdometer,
    endOdometer,
    fuelPrice,
    vehicleId,
    defaultVehicleId,
  ]);

  function updateLine(key: string, patch: Partial<PurchaseLine>) {
    setPurchases((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function addPurchaseLine() {
    setPurchases((prev) => [...prev, createEmptyLine()]);
  }

  function removePurchaseLine(key: string) {
    setPurchases((prev) =>
      prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)
    );
  }

  function resetSession() {
    setPurchases([createEmptyLine()]);
    setSupplierSearch("");
    setSupplierOpenKey(null);
    setNewSupplierName("");
    setStartOdometer("");
    setEndOdometer("");
    setFuelPrice("");
    setVehicleId(defaultVehicleId);
  }

  function handleClearSession() {
    resetSession();
    toast.message("Форму очищено — можна змінити дату");
  }

  async function handleCreateSupplier(lineKey: string) {
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
      updateLine(lineKey, { supplierId: String(result.supplier.id) });
      setNewSupplierName("");
      setSupplierOpenKey(null);
      toast.success("Постачальника додано");
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!productId || !warehouseId) {
      toast.error("Заповніть поля закупівлі");
      return;
    }

    const parsedPurchases: {
      supplierId: number;
      quantity: number;
      pricePerUnit: number;
      actualPaid: number | null;
      materialProductId: number | null;
      materialQuantity: number | null;
    }[] = [];

    for (let i = 0; i < purchases.length; i++) {
      const line = purchases[i];
      const label = `Закупівля #${i + 1}`;
      if (!line.supplierId) {
        toast.error(`${label}: оберіть постачальника`);
        return;
      }
      const bags = parseNum(line.quantity);
      const pricePerUnit = parseNum(line.price);
      if (bags == null || bags < 1) {
        toast.error(`${label}: кількість має бути не менше 1`);
        return;
      }
      if (pricePerUnit == null || pricePerUnit < 0) {
        toast.error(`${label}: вкажіть ціну за одиницю`);
        return;
      }
      const materialQty = parseNum(line.materialQuantity);
      parsedPurchases.push({
        supplierId: Number(line.supplierId),
        quantity: bags,
        pricePerUnit,
        actualPaid: parseNum(line.actualPaid),
        materialProductId:
          materialQty != null && materialQty > 0 && packingProductId
            ? Number(packingProductId)
            : null,
        materialQuantity:
          materialQty != null && materialQty > 0 ? materialQty : null,
      });
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
      const result = await createFieldDeliveriesAndTrip({
        purchases: parsedPurchases,
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        deliveryDate: dateToYYYYMMDD(eventDate),
        vehicleId,
        startOdometerKm: startKm,
        endOdometerKm: endKm,
        fuelPriceUahPerL: fuelPriceUah,
      });
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success(
        parsedPurchases.length > 1
          ? `Збережено ${parsedPurchases.length} закупівлі і поїздку`
          : "Закупівлю і поїздку збережено"
      );
      resetSession();
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

      <section className="space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Дата рейсу</h2>
        <TripDateField
          id="event_date"
          label="Дата *"
          date={eventDate}
          onSelect={setEventDate}
          open={dateOpen}
          onOpenChange={setDateOpen}
          locked={sessionDirty}
        />
        {sessionDirty ? (
          <p className="text-xs text-muted-foreground">
            Дата зафіксована для поточної сесії. Щоб змінити число — збережіть
            або очистіть форму.
          </p>
        ) : null}
        {sessionDirty ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={handleClearSession}
          >
            Очистити форму
          </Button>
        ) : null}
      </section>

      {purchases.map((line, index) => {
        const selectedSupplier = suppliers.find(
          (s) => String(s.id) === line.supplierId
        );
        const purchaseSum = linePurchaseSum(line);
        const open = supplierOpenKey === line.key;

        return (
          <section
            key={line.key}
            className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                Закупівля {purchases.length > 1 ? `#${index + 1}` : ""}
              </h2>
              {purchases.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  disabled={pending}
                  aria-label={`Видалити закупівлю #${index + 1}`}
                  onClick={() => removePurchaseLine(line.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Постачальник *</Label>
              <Popover
                open={open}
                onOpenChange={(next) => {
                  setSupplierOpenKey(next ? line.key : null);
                  if (!next) setSupplierSearch("");
                }}
              >
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
                            updateLine(line.key, {
                              supplierId: String(supplier.id),
                            });
                            setSupplierSearch("");
                            setSupplierOpenKey(null);
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
                        disabled={
                          creatingSupplier || !newSupplierName.trim()
                        }
                        aria-busy={creatingSupplier}
                        onClick={() => void handleCreateSupplier(line.key)}
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
              <Label htmlFor={`quantity_${line.key}`}>
                Кількість (мішки) *
              </Label>
              <Input
                id={`quantity_${line.key}`}
                inputMode="decimal"
                className="h-11 text-base"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(line.key, { quantity: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`price_${line.key}`}>Ціна за одиницю, ₴ *</Label>
              <Input
                id={`price_${line.key}`}
                inputMode="decimal"
                className="h-11 text-base"
                value={line.price}
                onChange={(e) =>
                  updateLine(line.key, { price: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`purchase_sum_${line.key}`}>Сума, ₴</Label>
              <Input
                id={`purchase_sum_${line.key}`}
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
              <Label htmlFor={`actual_paid_${line.key}`}>
                Фактично сплачено, ₴
              </Label>
              <Input
                id={`actual_paid_${line.key}`}
                inputMode="decimal"
                className="h-11 text-base"
                value={line.actualPaid}
                onChange={(e) =>
                  updateLine(line.key, { actualPaid: e.target.value })
                }
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
                <Label htmlFor={`material_quantity_${line.key}`}>
                  Кількість матеріалів
                </Label>
                <Input
                  id={`material_quantity_${line.key}`}
                  inputMode="decimal"
                  className="h-11 text-base"
                  value={line.materialQuantity}
                  onChange={(e) =>
                    updateLine(line.key, {
                      materialQuantity: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </section>
        );
      })}

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full text-base"
        disabled={pending}
        onClick={addPurchaseLine}
      >
        <Plus className="mr-2 h-4 w-4" />
        Додати закупівлю
      </Button>

      <section className="space-y-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
        <h2 className="text-base font-semibold">Поїздка</h2>
        <p className="text-sm text-muted-foreground">
          У поїздку:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {bagsTotal}
          </span>{" "}
          мішків (сума по всіх закупівлях)
        </p>

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
        ) : purchases.length > 1 ? (
          `Зберегти ${purchases.length} закупівлі і поїздку`
        ) : (
          "Зберегти закупівлю і поїздку"
        )}
      </Button>
    </form>
  );
}
