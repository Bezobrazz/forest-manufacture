"use client";

import type React from "react";
import { useState } from "react";
import { createPackingBagPurchase } from "@/app/packing-bags/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils";
import { uk } from "date-fns/locale";

interface PackingBagFormProps {
  onCreated?: () => Promise<void>;
}

export function PackingBagForm({ onCreated }: PackingBagFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState({
    purchase_date: dateToYYYYMMDD(new Date()),
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
      const now = new Date();
      setPurchaseDate(now);
      setFormData({
        purchase_date: dateToYYYYMMDD(now),
        quantity: "",
        price_uah: "",
      });
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
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              id="bag-purchase-date"
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !purchaseDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {purchaseDate ? (
                formatDate(
                  purchaseDate instanceof Date
                    ? purchaseDate.toISOString()
                    : new Date(purchaseDate).toISOString()
                )
              ) : (
                <span>Оберіть дату</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={purchaseDate}
              onSelect={(nextDate) => {
                setPurchaseDate(nextDate);
                setFormData((prev) => ({
                  ...prev,
                  purchase_date: nextDate ? dateToYYYYMMDD(nextDate) : "",
                }));
                if (nextDate) setDatePopoverOpen(false);
              }}
              locale={uk}
              initialFocus
            />
          </PopoverContent>
        </Popover>
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
