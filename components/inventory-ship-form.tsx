"use client";

import type React from "react";
import { useState } from "react";
import { shipInventory } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Inventory } from "@/lib/types";

interface InventoryShipFormProps {
  inventory: Inventory[];
  onInventoryUpdated?: () => Promise<void>;
}

export function InventoryShipForm({
  inventory,
  onInventoryUpdated,
}: InventoryShipFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Фільтруємо інвентар, щоб показувати тільки продукти з кількістю > 0
  const availableInventory = inventory.filter((item) => item.quantity > 0);

  // Групуємо інвентар за категоріями для зручності вибору
  const inventoryByCategory: Record<string, Inventory[]> = {};

  availableInventory.forEach((item) => {
    const categoryName = item.product?.category?.name || "Без категорії";
    if (!inventoryByCategory[categoryName]) {
      inventoryByCategory[categoryName] = [];
    }
    inventoryByCategory[categoryName].push(item);
  });

  // Сортуємо категорії за алфавітом
  const sortedCategories = Object.keys(inventoryByCategory).sort();

  // Знаходимо максимальну доступну кількість для вибраного продукту
  const selectedInventoryItem = availableInventory.find(
    (item) => item.product_id.toString() === selectedProduct
  );
  const maxQuantity = selectedInventoryItem?.quantity || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);

    try {
      if (!selectedProduct || !quantity) {
        toast({
          title: "Помилка",
          description: "Виберіть продукт та вкажіть кількість",
          variant: "destructive",
        });
        setIsPending(false);
        return;
      }

      const quantityValue = Number.parseFloat(quantity);

      if (isNaN(quantityValue) || quantityValue <= 0) {
        toast({
          title: "Помилка",
          description: "Кількість повинна бути додатнім числом",
          variant: "destructive",
        });
        setIsPending(false);
        return;
      }

      if (quantityValue > maxQuantity) {
        toast({
          title: "Помилка",
          description: `Недостатньо продукції на складі. Доступно: ${maxQuantity}`,
          variant: "destructive",
        });
        setIsPending(false);
        return;
      }

      const formData = new FormData();
      formData.append("product_id", selectedProduct);
      formData.append("quantity", quantity);
      formData.append("notes", notes);

      const result = await shipInventory(formData);

      if (result.success) {
        // Очищаємо форму
        setSelectedProduct("");
        setQuantity("");
        setNotes("");

        // Показуємо тост
        toast({
          title: "Успішно",
          description: "Продукцію успішно відвантажено зі складу",
        });

        // Оновлюємо дані через callback
        if (onInventoryUpdated) {
          try {
            await onInventoryUpdated();
          } catch (refreshError) {
            console.error("Помилка при оновленні інвентарю:", refreshError);
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast({
          title: "Помилка",
          description: result.error || "Не вдалося відвантажити продукцію",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Сталася помилка при відвантаженні продукції",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product">Продукт</Label>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger id="product">
            <SelectValue placeholder="Виберіть продукт" />
          </SelectTrigger>
          <SelectContent>
            {sortedCategories.length > 0 ? (
              sortedCategories.map((category) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    {category}
                  </div>
                  {inventoryByCategory[category].map((item) => (
                    <SelectItem
                      key={item.product_id}
                      value={item.product_id.toString()}
                    >
                      {item.product?.name} ({item.quantity} шт)
                    </SelectItem>
                  ))}
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Немає продуктів на складі
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Кількість для відвантаження</Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          min="0.01"
          max={maxQuantity}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Введіть кількість"
          disabled={!selectedProduct}
        />
        {selectedProduct && (
          <p className="text-xs text-muted-foreground">
            Доступно на складі: {maxQuantity} шт
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Примітки</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Інформація про відвантаження"
          rows={3}
        />
      </div>
      <Button
        type="submit"
        disabled={isPending || !selectedProduct || !quantity}
      >
        {isPending ? "Відвантаження..." : "Відвантажити продукцію"}
      </Button>
    </form>
  );
}
