"use client";

import { useState, useEffect } from "react";
import type { Product, Production, Shift } from "@/lib/types";
import { updateProduction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";

interface ProductionItemsFormProps {
  shift: Shift;
  products: Product[];
  existingProduction?: Production[];
  onProductionUpdated?: (updatedProduction: Production) => void; // Додаємо callback для оновлення батьківського компонента
}

export function ProductionItemsForm({
  shift,
  products,
  existingProduction = [],
  onProductionUpdated,
}: ProductionItemsFormProps) {
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [pendingProducts, setPendingProducts] = useState<Set<number>>(
    new Set()
  );
  const [localProduction, setLocalProduction] =
    useState<Production[]>(existingProduction);
  console.log("localProduction", localProduction);

  const router = useRouter();

  // Ініціалізуємо кількості з існуючих даних
  useEffect(() => {
    const initialQuantities: Record<number, string> = {};

    existingProduction.forEach((item) => {
      initialQuantities[item.product_id] = item.quantity.toString();
    });

    setQuantities(initialQuantities);
    setLocalProduction(existingProduction);
  }, [existingProduction]);

  // Функція для оновлення кількості продукту
  async function handleUpdateQuantity(productId: number) {
    if (pendingProducts.has(productId)) return;

    const quantity = quantities[productId];
    if (!quantity) return;

    const numericQuantity = Number.parseFloat(quantity);
    if (isNaN(numericQuantity)) {
      toast({
        title: "Помилка",
        description: "Введіть коректне числове значення",
        variant: "destructive",
      });
      return;
    }

    setPendingProducts((prev) => new Set(prev).add(productId));

    const formData = new FormData();
    formData.append("shift_id", shift.id.toString());
    formData.append("product_id", productId.toString());
    formData.append("quantity", quantity);

    try {
      const result = await updateProduction(formData);
      console.log("Результат оновлення кількості продукції:", result);

      if (result.success && result.data && result.data.length > 0) {
        // Оновлюємо локальний стан
        const updatedProduction = result.data[0] as Production;

        // Оновлюємо локальний стан продукції
        setLocalProduction((prev) => {
          // Перевіряємо, чи існує вже такий запис
          const existingIndex = prev.findIndex(
            (p) => p.product_id === productId
          );

          if (existingIndex >= 0) {
            // Оновлюємо існуючий запис
            const updated = [...prev];
            updated[existingIndex] = updatedProduction;
            return updated;
          } else {
            // Додаємо новий запис
            return [...prev, updatedProduction];
          }
        });

        // Викликаємо callback, якщо він є
        if (onProductionUpdated) {
          onProductionUpdated(updatedProduction);
        }

        toast({
          title: "Дані оновлено",
          description: "Кількість продукції успішно оновлено",
        });
        // Примусово оновлюємо сторінку
        setTimeout(() => {
          router.refresh();
        }, 1000); // Затримка в 1 секунду
      } else {
        toast({
          title: "Помилка",
          description: result.error || "Не вдалося оновити кількість продукції",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating production:", error);
      toast({
        title: "Помилка",
        description: "Сталася помилка при оновленні кількості продукції",
        variant: "destructive",
      });
    } finally {
      setPendingProducts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  }

  // Функція для оновлення значення в стані
  function handleQuantityChange(productId: number, value: string) {
    setQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }

  // Групуємо продукти за категоріями
  const productsByCategory: Record<string, Product[]> = {};

  // Додаємо категорію "Без категорії"
  productsByCategory["Без категорії"] = [];

  // Розподіляємо продукти за категоріями
  products.forEach((product) => {
    const categoryName = product.category?.name || "Без категорії";
    if (!productsByCategory[categoryName]) {
      productsByCategory[categoryName] = [];
    }
    productsByCategory[categoryName].push(product);
  });

  return (
    <div className="space-y-4">
      {Object.entries(productsByCategory).map(
        ([categoryName, categoryProducts]) =>
          // Додаємо перевірку, щоб не відображати категорії без товарів
          categoryProducts.length > 0 && (
            <Card key={categoryName} className="mb-4">
              <CardContent className="p-4">
                <h3 className="font-medium text-lg mb-2">{categoryName}</h3>
                <div className="grid gap-4">
                  {categoryProducts.map((product) => {
                    // Використовуємо локальний стан для перевірки існуючих елементів
                    const existingItem = localProduction.find(
                      (p) => p.product_id === product.id
                    );
                    const isPending = pendingProducts.has(product.id);

                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground">
                              {product.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 w-48">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={quantities[product.id] || ""}
                            onChange={(e) =>
                              handleQuantityChange(product.id, e.target.value)
                            }
                            placeholder="Кількість"
                            disabled={isPending || shift.status !== "active"}
                            className="w-24"
                          />
                          {shift.status === "active" && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateQuantity(product.id)}
                              disabled={isPending || !quantities[product.id]}
                            >
                              {isPending
                                ? "Оновлення..."
                                : existingItem
                                ? "Оновити"
                                : "Додати"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )
      )}
    </div>
  );
}
