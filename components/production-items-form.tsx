"use client";

import { useState, useEffect, type FormEvent } from "react";
import type { Product, Production, Shift } from "@/lib/types";
import { updateProduction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [localProduction, setLocalProduction] =
    useState<Production[]>(existingProduction);
  console.log("localProduction", localProduction);

  const router = useRouter();

  useEffect(() => {
    const initialQuantities: Record<number, string> = {};

    existingProduction.forEach((item) => {
      initialQuantities[item.product_id] = item.quantity.toString();
    });

    setQuantities(initialQuantities);
    setLocalProduction(existingProduction);
  }, [existingProduction]);

  async function submitEntries(entries: Array<[string, string]>) {
    setIsSubmitting(true);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const [productIdString, quantity] of entries) {
        const formData = new FormData();
        formData.append("shift_id", shift.id.toString());
        formData.append("product_id", productIdString);
        formData.append("quantity", quantity);

        const result = await updateProduction(formData);

        if (result.success && result.data && result.data.length > 0) {
          successCount += 1;
          const productId = Number.parseInt(productIdString, 10);
          const updatedProduction = result.data[0] as Production;

          setLocalProduction((prev) => {
            const existingIndex = prev.findIndex(
              (p) => p.product_id === productId,
            );

            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = updatedProduction;
              return updated;
            }

            return [...prev, updatedProduction];
          });

          if (onProductionUpdated) {
            onProductionUpdated(updatedProduction);
          }
        } else {
          errorCount += 1;
        }
      }

      if (errorCount === 0) {
        toast.success("Дані оновлено", {
          description: `Кількість продукції збережено (${successCount} позицій)`,
        });
      } else {
        toast.error("Частину даних не збережено", {
          description: `Успішно: ${successCount}, з помилкою: ${errorCount}`,
        });
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating production:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні кількості продукції",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitAll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || shift.status !== "active") return;

    const filledEntries = Object.entries(quantities).filter(
      ([, value]) => value.trim() !== "",
    );

    if (filledEntries.length === 0) {
      toast.error("Помилка", {
        description: "Вкажіть хоча б одну кількість продукції",
      });
      return;
    }

    const invalidEntry = filledEntries.find(([, value]) =>
      Number.isNaN(Number.parseFloat(value)),
    );
    if (invalidEntry) {
      toast.error("Помилка", {
        description: "Введіть коректні числові значення",
      });
      return;
    }

    const hasEmptyFields = products.some((product) => {
      const value = quantities[product.id];
      return !value || value.trim() === "";
    });

    if (hasEmptyFields) {
      setConfirmOpen(true);
      return;
    }

    await submitEntries(filledEntries);
  }

  async function handleConfirmSubmit() {
    const filledEntries = Object.entries(quantities).filter(
      ([, value]) => value.trim() !== "",
    );

    setConfirmOpen(false);
    await submitEntries(filledEntries);
  }

  function handleQuantityChange(productId: number, value: string) {
    setQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }

  function getFractionNumber(productDescription?: string): number {
    if (!productDescription) return 999;
    const match = productDescription.match(/(\d)\s*(фракц(ія)?|фр\.?)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 999; // Якщо не знайдено, ставимо в кінець
  }

  const productsByCategory: Record<string, Product[]> = {};

  productsByCategory["Без категорії"] = [];

  products.forEach((product) => {
    const categoryName = product.category?.name || "Без категорії";
    if (!productsByCategory[categoryName]) {
      productsByCategory[categoryName] = [];
    }
    productsByCategory[categoryName].push(product);
  });

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmitAll}>
        {Object.entries(productsByCategory).map(
          ([categoryName, categoryProducts]) =>
            categoryProducts.length > 0 && (
              <Card key={categoryName} className="mb-4">
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-2">{categoryName}</h3>
                  <div className="grid gap-4">
                    {categoryProducts
                      .slice()
                      .sort((a, b) => {
                        const isBarkA = a.name.toLowerCase().includes("кора");
                        const isBarkB = b.name.toLowerCase().includes("кора");
                        if (isBarkA && isBarkB) {
                          return (
                            getFractionNumber(a.description ?? undefined) -
                            getFractionNumber(b.description ?? undefined)
                          );
                        }
                        if (isBarkA) return -1;
                        if (isBarkB) return 1;
                        return 0;
                      })
                      .map((product) => {
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
                            <div className="flex items-center justify-end w-56">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={quantities[product.id] || ""}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    product.id,
                                    e.target.value,
                                  )
                                }
                                placeholder="Кількість"
                                disabled={
                                  isSubmitting || shift.status !== "active"
                                }
                                className="w-32"
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ),
        )}

        {shift.status === "active" && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0 mr-2" />
              ) : null}
              Зберегти всю продукцію
            </Button>
          </div>
        )}
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Не всі поля заповнені</AlertDialogTitle>
            <AlertDialogDescription>
              Частина полів кількості залишилась порожньою. Зберегти тільки
              заповнені позиції?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Повернутись
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
            >
              Підтвердити сабміт
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
