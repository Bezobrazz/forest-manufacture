"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import {
  getSupplierDeliveries,
  getSuppliers,
  getMaterials,
  getProductsByCategoryName,
  getWarehouses,
  createSupplierDelivery,
} from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Truck,
  Search,
  Package,
  DollarSign,
  Plus,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierForm } from "@/components/supplier-form";
import { DatabaseError } from "@/components/database-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatNumber,
  formatNumberWithUnit,
  dateToYYYYMMDD,
} from "@/lib/utils";
import { toast } from "sonner";
import type {
  SupplierDelivery,
  Supplier,
  Product,
  Warehouse,
} from "@/lib/types";
import { uk } from "date-fns/locale";
import { EditSupplierDeliveryDialog } from "@/components/edit-supplier-delivery-dialog";
import { DeleteSupplierDeliveryButton } from "@/components/delete-supplier-delivery-button";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-6 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupplierTransactionsPage() {
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Product[]>([]);
  const [productsMaterialsCategory, setProductsMaterialsCategory] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "supplier" | "product">("date");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(
    new Date()
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialPopoverOpen, setMaterialPopoverOpen] = useState(false);
  const [quantity, setQuantity] = useState<string>("");
  const [pricePerUnit, setPricePerUnit] = useState<string>("");
  const [selectedMaterialProductId, setSelectedMaterialProductId] = useState<string>("");
  const [materialProductSearchQuery, setMaterialProductSearchQuery] = useState("");
  const [materialProductPopoverOpen, setMaterialProductPopoverOpen] = useState(false);
  const [materialQuantity, setMaterialQuantity] = useState<string>("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addSupplierDialogOpen, setAddSupplierDialogOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setDatabaseError(false);

    try {
      const [deliveriesData, suppliersData, materialsData, productsMaterialsData, warehousesData] =
        await Promise.all([
          getSupplierDeliveries(),
          getSuppliers(),
          getMaterials(),
          getProductsByCategoryName("Матеріали"),
          getWarehouses(),
        ]);
      setDeliveries(deliveriesData);
      setSuppliers(suppliersData);
      setMaterials(materialsData);
      setProductsMaterialsCategory(productsMaterialsData);
      setWarehouses(warehousesData);

      const mainWarehouse = warehousesData.find((w) =>
        w.name.toLowerCase().includes("main")
      );
      if (mainWarehouse) {
        setSelectedWarehouseId(mainWarehouse.id.toString());
      }
    } catch (err: any) {
      console.error("Помилка при завантаженні даних:", err);

      if (
        err?.message?.includes("Supabase") ||
        err?.message?.includes("credentials")
      ) {
        setDatabaseError(true);
      } else {
        setError("Не вдалося завантажити дані. Будь ласка, спробуйте пізніше.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const filteredAndSortedDeliveries = useMemo(() => {
    let filtered = deliveries.filter((delivery) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const supplierMatch =
        delivery.supplier?.name.toLowerCase().includes(query) || false;
      const productMatch =
        delivery.product?.name.toLowerCase().includes(query) || false;
      const warehouseMatch =
        delivery.warehouse?.name.toLowerCase().includes(query) || false;

      return supplierMatch || productMatch || warehouseMatch;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else if (sortBy === "supplier") {
        return (a.supplier?.name || "").localeCompare(
          b.supplier?.name || "",
          "uk"
        );
      } else {
        return (a.product?.name || "").localeCompare(
          b.product?.name || "",
          "uk"
        );
      }
    });

    return filtered;
  }, [deliveries, searchQuery, sortBy]);

  const totalPages = Math.ceil(
    filteredAndSortedDeliveries.length / itemsPerPage
  );
  const paginatedDeliveries = filteredAndSortedDeliveries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchQuery.trim()) return suppliers;
    const query = supplierSearchQuery.toLowerCase();
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        supplier.phone?.toLowerCase().includes(query)
    );
  }, [suppliers, supplierSearchQuery]);

  const materialsSyrovyna = useMemo(
    () => materials.filter((m) => m.category?.name === "Сировина"),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    if (!materialSearchQuery.trim()) return materialsSyrovyna;
    const query = materialSearchQuery.toLowerCase();
    return materialsSyrovyna.filter((material) =>
      material.name.toLowerCase().includes(query)
    );
  }, [materialsSyrovyna, materialSearchQuery]);

  const filteredMaterialProducts = useMemo(() => {
    if (!materialProductSearchQuery.trim()) return productsMaterialsCategory;
    const query = materialProductSearchQuery.toLowerCase();
    return productsMaterialsCategory.filter((p) =>
      p.name.toLowerCase().includes(query)
    );
  }, [productsMaterialsCategory, materialProductSearchQuery]);

  const purchaseTotal = useMemo(() => {
    const qty = Number(quantity) || 0;
    const price = Number(pricePerUnit) || 0;
    return qty * price;
  }, [quantity, pricePerUnit]);

  const handleAddTransaction = async () => {
    if (!selectedSupplierId || !selectedMaterialId) {
      toast.error("Заповніть всі обов'язкові поля");
      return;
    }

    if (!selectedWarehouseId) {
      toast.error("Склад не вибрано. Будь ласка, оновіть сторінку.");
      return;
    }

    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error("Введіть коректну кількість");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("supplier_id", selectedSupplierId);
      formData.append("product_id", selectedMaterialId);
      formData.append("warehouse_id", selectedWarehouseId);
      formData.append("quantity", quantity);
      if (pricePerUnit) {
        formData.append("price_per_unit", pricePerUnit);
      }
      if (deliveryDate) {
        formData.append("delivery_date", dateToYYYYMMDD(deliveryDate));
      }
      if (selectedMaterialProductId && materialQuantity.trim()) {
        const mQty = Number(materialQuantity);
        if (mQty > 0) {
          formData.append("material_product_id", selectedMaterialProductId);
          formData.append("material_quantity", materialQuantity);
        }
      }

      const result = await createSupplierDelivery(formData);

      if (result.success && result.data) {
        setDeliveries([result.data as SupplierDelivery, ...deliveries]);
        toast.success("Транзакцію успішно додано");

        setSelectedSupplierId("");
        setSupplierSearchQuery("");
        setSelectedMaterialId("");
        setMaterialSearchQuery("");
        setQuantity("");
        setPricePerUnit("");
        setSelectedMaterialProductId("");
        setMaterialProductSearchQuery("");
        setMaterialQuantity("");
        setDeliveryDate(new Date());
      } else {
        toast.error(result.error || "Помилка при створенні транзакції");
      }
    } catch (err) {
      console.error("Помилка при створенні транзакції:", err);
      toast.error("Сталася непередбачена помилка");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDeliveries = deliveries.length;
  const totalQuantity = deliveries.reduce(
    (sum, delivery) => sum + Number(delivery.quantity),
    0
  );
  const totalAmount = deliveries.reduce((sum, delivery) => {
    const quantity = Number(delivery.quantity);
    const price = delivery.price_per_unit ? Number(delivery.price_per_unit) : 0;
    return sum + quantity * price;
  }, 0);

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
              <h1 className="text-2xl sm:text-3xl font-bold">
                Транзакції з постачальниками
              </h1>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              {totalDeliveries}{" "}
              {totalDeliveries === 1
                ? "транзакція"
                : totalDeliveries < 5
                ? "транзакції"
                : "транзакцій"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base hidden sm:block">
            Історія операцій з постачальниками та поставок товарів
          </p>
        </div>
      </div>

      {!isLoading && !databaseError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Закупівля сировини
            </CardTitle>
            <CardDescription>
              Додайте нову транзакцію закупівлі сировини у постачальника
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="delivery-date">Дата закупівлі</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="delivery-date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? (
                        formatDate(
                          deliveryDate instanceof Date
                            ? deliveryDate.toISOString()
                            : new Date(deliveryDate).toISOString()
                        )
                      ) : (
                        <span>Оберіть дату</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      locale={uk}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Постачальник *</Label>
                <Popover
                  open={supplierPopoverOpen}
                  onOpenChange={setSupplierPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="supplier"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedSupplierId
                        ? suppliers.find(
                            (s) => s.id === Number(selectedSupplierId)
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
                                setSelectedSupplierId(supplier.id.toString());
                                setSupplierSearchQuery("");
                                setSupplierPopoverOpen(false);
                              }}
                            >
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {supplier.name}
                                </div>
                                {supplier.phone && (
                                  <div className="text-xs text-muted-foreground">
                                    {supplier.phone}
                                  </div>
                                )}
                              </div>
                              {selectedSupplierId ===
                                supplier.id.toString() && (
                                <span className="text-primary">✓</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedSupplierId && (
                  <div className="text-xs text-muted-foreground">
                    Обрано:{" "}
                    {suppliers.find((s) => s.id === Number(selectedSupplierId))
                      ?.name || ""}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="material">Сировина *</Label>
                <Popover
                  open={materialPopoverOpen}
                  onOpenChange={setMaterialPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="material"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedMaterialId
                        ? materials.find(
                            (m) => m.id === Number(selectedMaterialId)
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
                                setSelectedMaterialId(material.id.toString());
                                setMaterialSearchQuery("");
                                setMaterialPopoverOpen(false);
                              }}
                            >
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {material.name}
                                </div>
                                {material.category && (
                                  <div className="text-xs text-muted-foreground">
                                    {material.category.name}
                                  </div>
                                )}
                              </div>
                              {selectedMaterialId ===
                                material.id.toString() && (
                                <span className="text-primary">✓</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedMaterialId && (
                  <div className="text-xs text-muted-foreground">
                    Обрано:{" "}
                    {materials.find((m) => m.id === Number(selectedMaterialId))
                      ?.name || ""}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="material-product">Матеріали</Label>
                <Popover
                  open={materialProductPopoverOpen}
                  onOpenChange={setMaterialProductPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      id="material-product"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedMaterialProductId
                        ? productsMaterialsCategory.find(
                            (p) => p.id === Number(selectedMaterialProductId)
                          )?.name || "Оберіть матеріали"
                        : "Оберіть матеріали"}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <div className="p-2">
                      <Input
                        placeholder="Пошук матеріалів..."
                        value={materialProductSearchQuery}
                        onChange={(e) =>
                          setMaterialProductSearchQuery(e.target.value)
                        }
                        className="mb-2"
                      />
                      <div className="max-h-[200px] overflow-auto">
                        {filteredMaterialProducts.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Матеріалів не знайдено
                          </div>
                        ) : (
                          filteredMaterialProducts.map((product) => (
                            <div
                              key={product.id}
                              className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer rounded-sm"
                              onClick={() => {
                                setSelectedMaterialProductId(
                                  product.id.toString()
                                );
                                setMaterialProductSearchQuery("");
                                setMaterialProductPopoverOpen(false);
                              }}
                            >
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 font-medium">
                                {product.name}
                              </div>
                              {selectedMaterialProductId ===
                                product.id.toString() && (
                                <span className="text-primary">✓</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedMaterialProductId && (
                  <Input
                    type="number"
                    placeholder="Кількість матеріалів"
                    value={materialQuantity}
                    onChange={(e) => setMaterialQuantity(e.target.value)}
                    min="0"
                    step="0.01"
                    className="mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Кількість *</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Ціна за одиницю (₴)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0.00"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {purchaseTotal > 0 && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Сума закупівлі:</span>
                  <span className="text-lg font-bold">
                    {formatNumber(purchaseTotal, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ₴
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={handleAddTransaction}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>Додавання...</>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Додати транзакцію
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !databaseError && totalDeliveries > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Всього транзакцій</CardDescription>
              <CardTitle className="text-2xl">{totalDeliveries}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Загальна кількість</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumberWithUnit(totalQuantity, "шт")}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Загальна сума</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(totalAmount, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                ₴
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {databaseError ? (
        <div className="py-8">
          <DatabaseError onRetry={loadData} />
        </div>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-lg sm:text-xl">
                  Список транзакцій
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  {filteredAndSortedDeliveries.length === totalDeliveries
                    ? `Показано всі ${totalDeliveries} транзакцій`
                    : `Показано ${filteredAndSortedDeliveries.length} з ${totalDeliveries} транзакцій`}
                  {totalPages > 1 && (
                    <span className="block sm:inline">
                      {" • "}
                      Сторінка {currentPage} з {totalPages}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Select
                  value={sortBy}
                  onValueChange={(value) =>
                    setSortBy(value as "date" | "supplier" | "product")
                  }
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Сортувати за датою</SelectItem>
                    <SelectItem value="supplier">
                      Сортувати за постачальником
                    </SelectItem>
                    <SelectItem value="product">
                      Сортувати за продуктом
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 на сторінці</SelectItem>
                    <SelectItem value="10">10 на сторінці</SelectItem>
                    <SelectItem value="20">20 на сторінці</SelectItem>
                    <SelectItem value="50">50 на сторінці</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Пошук по постачальнику, продукту або складу..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {paginatedDeliveries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Не знайдено транзакцій за вашим запитом"
                    : "Немає транзакцій з постачальниками"}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Постачальник</TableHead>
                        <TableHead>Продукт</TableHead>
                        <TableHead>Склад</TableHead>
                        <TableHead className="text-right">Кількість</TableHead>
                        <TableHead className="text-right">
                          Ціна за одиницю
                        </TableHead>
                        <TableHead className="text-right">Сума</TableHead>
                        <TableHead className="text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDeliveries.map((delivery) => {
                        const quantity = Number(delivery.quantity);
                        const pricePerUnit = delivery.price_per_unit
                          ? Number(delivery.price_per_unit)
                          : null;
                        const total = pricePerUnit
                          ? quantity * pricePerUnit
                          : null;

                        return (
                          <TableRow key={delivery.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(delivery.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {delivery.supplier?.name ||
                                    "Невідомий постачальник"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {delivery.product?.name ||
                                    "Невідомий продукт"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {delivery.warehouse?.name || "Невідомий склад"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">
                                {formatNumberWithUnit(quantity, "шт")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {pricePerUnit ? (
                                <span>
                                  {formatNumber(pricePerUnit, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  ₴
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {total ? (
                                <span className="font-semibold">
                                  {formatNumber(total, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  ₴
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <EditSupplierDeliveryDialog
                                  delivery={delivery}
                                  onDeliveryUpdated={async () => {
                                    const updatedDeliveries =
                                      await getSupplierDeliveries();
                                    setDeliveries(updatedDeliveries);
                                  }}
                                />
                                <DeleteSupplierDeliveryButton
                                  delivery={delivery}
                                  onDeliveryDeleted={async () => {
                                    const updatedDeliveries =
                                      await getSupplierDeliveries();
                                    setDeliveries(updatedDeliveries);
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-6 overflow-x-auto">
                    <Pagination>
                      <PaginationContent className="flex-wrap justify-center">
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={(e) => {
                              e.preventDefault();
                              goToPreviousPage();
                            }}
                            href="#"
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1
                        ).map((page) => {
                          const showPage =
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 &&
                              page <= currentPage + 1);

                          if (!showPage) {
                            if (
                              (page === currentPage - 2 && currentPage > 3) ||
                              (page === currentPage + 2 &&
                                currentPage < totalPages - 2)
                            ) {
                              return (
                                <PaginationItem key={page}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                            return null;
                          }

                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={(e) => {
                                  e.preventDefault();
                                  goToPage(page);
                                }}
                                href="#"
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={(e) => {
                              e.preventDefault();
                              goToNextPage();
                            }}
                            href="#"
                            className={
                              currentPage === totalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
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
    </div>
  );
}
