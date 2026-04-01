"use client";

import type React from "react";
import { useState } from "react";
import { createPackingBagPurchase } from "@/app/packing-bags/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PackingBagFormProps {
  onCreated?: () => Promise<void>;
}

export function PackingBagForm({ onCreated }: PackingBagFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    purchase_date: "",
    quantity: "",
    price_uah: "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const result = await createPackingBagPurchase({
        purchase_date: formData.purchase_date,
        quantity: Number(formData.quantity),
        price_uah: Number(formData.price_uah),
      });

      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }

      toast.success("Запис додано", {
        description: "Покупку мішків успішно додано",
      });
      setFormData({ purchase_date: "", quantity: "", price_uah: "" });
      await onCreated?.();
    } catch (error) {
      console.error("Помилка створення покупки мішків:", error);
      toast.error("Помилка", {
        description: "Не вдалося додати покупку мішків",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bag-purchase-date">Дата покупки *</Label>
        <Input
          id="bag-purchase-date"
          type="date"
          value={formData.purchase_date}
          onChange={(e) => setFormData((prev) => ({ ...prev, purchase_date: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bag-quantity">Кількість *</Label>
        <Input
          id="bag-quantity"
          type="number"
          min="0.01"
          step="0.01"
          value={formData.quantity}
          onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bag-price">Ціна, грн *</Label>
        <Input
          id="bag-price"
          type="number"
          min="0"
          step="0.01"
          value={formData.price_uah}
          onChange={(e) => setFormData((prev) => ({ ...prev, price_uah: e.target.value }))}
          required
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Збереження..." : "Додати покупку"}
      </Button>
    </form>
  );
}
