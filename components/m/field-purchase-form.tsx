"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { createSupplier, createSupplierDelivery } from "@/app/actions";
import type { Product, Supplier } from "@/lib/types";
import { dateToYYYYMMDD } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Props = {
  suppliers: Supplier[];
  warehouseId: string;
  productId: string;
  packingMaterials: Product[];
  defaultPackingProductId: string;
};

export function FieldPurchaseForm({
  suppliers: initialSuppliers,
  warehouseId,
  productId,
  packingMaterials,
  defaultPackingProductId,
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
  const [deliveryDate, setDeliveryDate] = useState(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [materialProductId, setMaterialProductId] = useState(
    defaultPackingProductId
  );
  const [materialQuantity, setMaterialQuantity] = useState("");
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
      toast.error("Заповніть обов’язкові поля");
      return;
    }
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("supplier_id", supplierId);
      formData.set("product_id", productId);
      formData.set("warehouse_id", warehouseId);
      formData.set("quantity", quantity);
      formData.set("delivery_date", dateToYYYYMMDD(deliveryDate));
      if (price.trim()) formData.set("price_per_unit", price);
      if (materialQuantity.trim() && Number(materialQuantity) > 0) {
        formData.set("material_product_id", materialProductId);
        formData.set("material_quantity", materialQuantity);
      }
      const result = await createSupplierDelivery(formData);
      if (!result.success) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Закупівлю збережено");
      setQuantity("");
      setPrice("");
      setMaterialQuantity("");
      router.push("/m");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TripDateField
        id="delivery_date"
        label="Дата *"
        date={deliveryDate}
        onSelect={setDeliveryDate}
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
          <PopoverContent className="w-[min(100vw-2rem,22rem)] p-0" align="start">
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
        <Label htmlFor="quantity">Кількість *</Label>
        <Input
          id="quantity"
          inputMode="decimal"
          className="h-11 text-base"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
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
          <Button type="button" variant="ghost" className="px-0 text-muted-foreground">
            {materialsOpen ? "Сховати матеріали" : "Матеріали (передано)"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Матеріал</Label>
            <Select value={materialProductId} onValueChange={setMaterialProductId}>
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
          "Зберегти закупівлю"
        )}
      </Button>
    </form>
  );
}
