"use client";

import type React from "react";
import { useState, useEffect } from "react";
import type { SupplierDelivery, Supplier, Product, Warehouse } from "@/lib/types";
import { updateSupplierDelivery, getSuppliers, getMaterials, getWarehouses } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Pencil, Calendar as CalendarIcon, Search, Truck, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { uk } from "date-fns/locale";
import { SupplierForm } from "@/components/supplier-form";

interface EditSupplierDeliveryDialogProps {
  delivery: SupplierDelivery;
  onDeliveryUpdated?: () => void;
}

export function EditSupplierDeliveryDialog({
  delivery,
  onDeliveryUpdated,
}: EditSupplierDeliveryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [formData, setFormData] = useState({
    delivery_id: delivery.id,
    supplier_id: delivery.supplier_id.toString(),
    product_id: delivery.product_id.toString(),
    warehouse_id: delivery.warehouse_id.toString(),
    quantity: delivery.quantity.toString(),
    price_per_unit: delivery.price_per_unit?.toString() || "",
    delivery_date: delivery.created_at ? new Date(delivery.created_at) : new Date(),
  });

  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  const [addSupplierDialogOpen, setAddSupplierDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [suppliersData, materialsData, warehousesData] = await Promise.all([
        getSuppliers(),
        getMaterials(),
        getWarehouses(),
      ]);
      setSuppliers(suppliersData);
      setMaterials(materialsData);
      setWarehouses(warehousesData);
    } catch (error) {
      console.error("Помилка завантаження даних:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const refreshSuppliers = async () => {
    try {
      const suppliersData = await getSuppliers();
      setSuppliers(suppliersData);
      setAddSupplierDialogOpen(false);
      setSupplierPopoverOpen(false);
    } catch (error) {
      console.error("Помилка оновлення постачальників:", error);
    }
  };

  useEffect(() => {
    setFormData({
      delivery_id: delivery.id,
      supplier_id: delivery.supplier_id.toString(),
      product_id: delivery.product_id.toString(),
      warehouse_id: delivery.warehouse_id.toString(),
      quantity: delivery.quantity.toString(),
      price_per_unit: delivery.price_per_unit?.toString() || "",
      delivery_date: delivery.created_at ? new Date(delivery.created_at) : new Date(),
    });
  }, [delivery]);

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!supplierSearchQuery.trim()) return true;
    const query = supplierSearchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query)
    );
  });

  const filteredMaterials = materials.filter((material) => {
    if (!materialSearchQuery.trim()) return true;
    const query = materialSearchQuery.toLowerCase();
    return material.name.toLowerCase().includes(query);
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append("delivery_id", formData.delivery_id.toString());
      submitFormData.append("supplier_id", formData.supplier_id);
      submitFormData.append("product_id", formData.product_id);
      submitFormData.append("warehouse_id", formData.warehouse_id);
      submitFormData.append("quantity", formData.quantity);
      if (formData.price_per_unit) {
        submitFormData.append("price_per_unit", formData.price_per_unit);
      }
      submitFormData.append(
        "delivery_date",
        formData.delivery_date.toISOString().split("T")[0]
      );

      const result = await updateSupplierDelivery(submitFormData);

      if (result.success) {
        setOpen(false);
        toast.success("Транзакцію оновлено", {
          description: "Інформацію про транзакцію успішно оновлено",
        });

        if (onDeliveryUpdated) {
          try {
            await onDeliveryUpdated();
          } catch (refreshError) {
            console.error(
              "Помилка при оновленні списку транзакцій:",
              refreshError
            );
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося оновити транзакцію",
        });
      }
    } catch (error) {
      console.error("Помилка при оновленні транзакції:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні транзакції",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Редагувати</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редагування транзакції</DialogTitle>
          <DialogDescription>
            Змініть інформацію про транзакцію та натисніть "Зберегти зміни"
          </DialogDescription>
        </DialogHeader>
        {isLoadingData ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Завантаження даних...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Дата */}
              <div className="space-y-2">
                <Label htmlFor="edit-delivery-date">Дата закупівлі</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="edit-delivery-date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.delivery_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.delivery_date ? (
                        formatDate(formData.delivery_date.toISOString())
                      ) : (
                        <span>Оберіть дату</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.delivery_date}
                      onSelect={(date) => {
                        if (date) {
                          setFormData((prev) => ({ ...prev, delivery_date: date }));
                        }
                      }}
                      locale={uk}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Постачальник */}
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Постачальник *</Label>
                <Popover
                  open={supplierPopoverOpen}
                  onOpenChange={setSupplierPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="edit-supplier"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {formData.supplier_id
                        ? suppliers.find(
                            (s) => s.id === Number(formData.supplier_id)
                          )?.name || "Оберіть постачальника"
                        : "Оберіть постачальника"}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <div className="p-2">
                      <Input
                        placeholder="Пошук постачальника..."
                        value={supplierSearchQuery}
                        onChange={(e) => setSupplierSearchQuery(e.target.value)}
                        className="mb-2"
                      />
                      <div className="max-h-[200px] overflow-auto">
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-2 space-y-2">
                            <div className="text-sm text-muted-foreground">
                              Постачальників не знайдено
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSupplierPopoverOpen(false);
                                setAddSupplierDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Додати постачальника
                            </Button>
                          </div>
                        ) : (
                          filteredSuppliers.map((supplier) => (
                            <div
                              key={supplier.id}
                              className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer rounded-sm"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  supplier_id: supplier.id.toString(),
                                }));
                                setSupplierSearchQuery("");
                                setSupplierPopoverOpen(false);
                              }}
                            >
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">{supplier.name}</div>
                                {supplier.phone && (
                                  <div className="text-xs text-muted-foreground">
                                    {supplier.phone}
                                  </div>
                                )}
                              </div>
                              {formData.supplier_id === supplier.id.toString() && (
                                <span className="text-primary">✓</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Сировина */}
              <div className="space-y-2">
                <Label htmlFor="edit-material">Сировина *</Label>
                <Popover
                  open={materialPopoverOpen}
                  onOpenChange={setMaterialPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="edit-material"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {formData.product_id
                        ? materials.find(
                            (m) => m.id === Number(formData.product_id)
                          )?.name || "Оберіть сировину"
                        : "Оберіть сировину"}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <div className="p-2">
                      <Input
                        placeholder="Пошук сировини..."
                        value={materialSearchQuery}
                        onChange={(e) => setMaterialSearchQuery(e.target.value)}
                        className="mb-2"
                      />
                      <div className="max-h-[200px] overflow-auto">
                        {filteredMaterials.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Сировини не знайдено
                          </div>
                        ) : (
                          filteredMaterials.map((material) => (
                            <div
                              key={material.id}
                              className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer rounded-sm"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  product_id: material.id.toString(),
                                }));
                                setMaterialSearchQuery("");
                                setMaterialPopoverOpen(false);
                              }}
                            >
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">{material.name}</div>
                                {material.category && (
                                  <div className="text-xs text-muted-foreground">
                                    {material.category.name}
                                  </div>
                                )}
                              </div>
                              {formData.product_id === material.id.toString() && (
                                <span className="text-primary">✓</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Кількість */}
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Кількість *</Label>
                <Input
                  id="edit-quantity"
                  name="quantity"
                  type="number"
                  placeholder="0"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              {/* Ціна за одиницю */}
              <div className="space-y-2">
                <Label htmlFor="edit-price">Ціна за одиницю (₴)</Label>
                <Input
                  id="edit-price"
                  name="price_per_unit"
                  type="number"
                  placeholder="0.00"
                  value={formData.price_per_unit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Склад */}
              <div className="space-y-2">
                <Label htmlFor="edit-warehouse">Склад *</Label>
                <Select
                  value={formData.warehouse_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, warehouse_id: value }))
                  }
                >
                  <SelectTrigger id="edit-warehouse">
                    <SelectValue placeholder="Оберіть склад" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem
                        key={warehouse.id}
                        value={warehouse.id.toString()}
                      >
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Скасувати
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Збереження..." : "Зберегти зміни"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
      <Dialog open={addSupplierDialogOpen} onOpenChange={setAddSupplierDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Додати нового постачальника</DialogTitle>
            <DialogDescription>
              Заповніть інформацію про постачальника. Поля з позначкою * є
              обов'язковими.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SupplierForm onSupplierAdded={refreshSuppliers} />
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

