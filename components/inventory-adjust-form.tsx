"use client";

import React, { useEffect, useMemo, useState } from "react";
import { updateInventoryQuantity } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Inventory, Product } from "@/lib/types";
import { useRouter } from "next/navigation";
import { cn, dateToYYYYMMDD, formatDate, formatNumber } from "@/lib/utils";
import { uk } from "date-fns/locale";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function InventoryAdjustForm({
  products,
  inventory,
  onInventoryUpdated,
}: {
  products: Product[];
  inventory: Inventory[];
  onInventoryUpdated?: () => Promise<void>;
}) {
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [newQuantity, setNewQuantity] = useState<string>("");
  const [quantityDelta, setQuantityDelta] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [adjustmentDate, setAdjustmentDate] = useState<Date>(new Date());
  const router = useRouter();

  const quantityByProductId = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of inventory) {
      if (item.product_id != null) {
        map.set(item.product_id, item.quantity ?? 0);
      }
    }
    return map;
  }, [inventory]);

  const selectedStock =
    selectedProduct !== ""
      ? (quantityByProductId.get(Number.parseInt(selectedProduct, 10)) ?? 0)
      : null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const productsByCategory: Record<string, Product[]> = {};

  products.forEach((product) => {
    const categoryName = product.category?.name || "Без категорії";
    if (!productsByCategory[categoryName]) {
      productsByCategory[categoryName] = [];
    }
    productsByCategory[categoryName].push(product);
  });

  const sortedCategories = Object.keys(productsByCategory).sort();

  function handleProductChange(productId: string) {
    setSelectedProduct(productId);
    setNewQuantity("");
    setQuantityDelta("");
  }

  function handleDeltaChange(value: string) {
    setQuantityDelta(value);
    if (selectedStock == null || value.trim() === "") {
      setNewQuantity("");
      return;
    }
    const delta = Number.parseFloat(value);
    if (Number.isFinite(delta)) {
      setNewQuantity(String(selectedStock + delta));
    }
  }

  function handleNewQuantityChange(value: string) {
    setNewQuantity(value);
    if (selectedStock == null || value.trim() === "") {
      setQuantityDelta("");
      return;
    }
    const next = Number.parseFloat(value);
    if (Number.isFinite(next)) {
      setQuantityDelta(String(next - selectedStock));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);

    try {
      if (!selectedProduct) {
        toast.error("Помилка", {
          description: "Виберіть продукт",
        });
        return;
      }

      const hasNewQuantity = newQuantity.trim() !== "";
      const hasDelta = quantityDelta.trim() !== "";

      if (!hasNewQuantity && !hasDelta) {
        toast.error("Помилка", {
          description: "Вкажіть зміну кількості або новий залишок",
        });
        return;
      }

      const productId = Number.parseInt(selectedProduct, 10);
      let quantityValue: number;

      if (hasNewQuantity) {
        quantityValue = Number.parseFloat(newQuantity);
      } else {
        const delta = Number.parseFloat(quantityDelta);
        quantityValue = (selectedStock ?? 0) + delta;
      }

      if (!Number.isFinite(quantityValue)) {
        toast.error("Помилка", {
          description: "Кількість повинна бути числом",
        });
        return;
      }

      if (quantityValue < 0) {
        toast.error("Помилка", {
          description: "Залишок на складі не може бути від'ємним",
        });
        return;
      }

      if (hasDelta && !hasNewQuantity) {
        const delta = Number.parseFloat(quantityDelta);
        if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
          toast.error("Помилка", {
            description: "Вкажіть ненульову зміну кількості",
          });
          return;
        }
      }

      const result = await updateInventoryQuantity(
        productId,
        quantityValue,
        notes,
        dateToYYYYMMDD(adjustmentDate)
      );

      if (result.success) {
        toast.success("Успішно", {
          description: "Кількість на складі успішно оновлено",
        });

        setSelectedProduct("");
        setNewQuantity("");
        setQuantityDelta("");
        setNotes("");
        setAdjustmentDate(new Date());

        if (onInventoryUpdated) {
          try {
            await onInventoryUpdated();
          } catch (refreshError) {
            console.error("Помилка при оновленні інвентарю:", refreshError);
          }
        } else {
          router.refresh();
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося оновити кількість на складі",
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні кількості на складі",
      });
    } finally {
      setIsPending(false);
    }
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product">Продукт</Label>
        <Select value={selectedProduct} onValueChange={handleProductChange}>
          <SelectTrigger id="product">
            <SelectValue placeholder="Виберіть продукт" />
          </SelectTrigger>
          <SelectContent>
            {sortedCategories.map((category) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-sm font-semibold">
                  {category}
                </div>
                {productsByCategory[category].map((product) => {
                  const stock = quantityByProductId.get(product.id) ?? 0;
                  return (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name} ({formatNumber(stock)} шт)
                    </SelectItem>
                  );
                })}
              </div>
            ))}
          </SelectContent>
        </Select>
        {selectedStock != null ? (
          <p className="text-xs text-muted-foreground">
            Поточний залишок: {formatNumber(selectedStock)} шт
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity-delta">Додати або відняти</Label>
        <Input
          id="quantity-delta"
          type="number"
          step="0.01"
          value={quantityDelta}
          onChange={(e) => handleDeltaChange(e.target.value)}
          placeholder="Напр. 50 або -20"
          disabled={!selectedProduct}
        />
        <p className="text-xs text-muted-foreground">
          Додатне число — додати до залишку, від&apos;ємне — відняти від залишку
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Нова кількість</Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          min="0"
          value={newQuantity}
          onChange={(e) => handleNewQuantityChange(e.target.value)}
          placeholder="Або вкажіть новий залишок"
          disabled={!selectedProduct}
        />
        <p className="text-xs text-muted-foreground">
          Загальна кількість на складі після коригування (синхронізується з полем
          вище)
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="adjustment-date">Дата коригування</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="adjustment-date"
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !adjustmentDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {adjustmentDate ? (
                formatDate(adjustmentDate.toISOString())
              ) : (
                <span>Оберіть дату</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={adjustmentDate}
              onSelect={(date) => {
                if (date) setAdjustmentDate(date);
              }}
              locale={uk}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Примітки</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Причина коригування кількості"
          rows={3}
        />
      </div>
      <Button type="submit" disabled={isPending || !selectedProduct} aria-busy={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Оновлення…
          </>
        ) : (
          "Оновити кількість"
        )}
      </Button>
    </form>
  );
}
