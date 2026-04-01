"use client";

import type React from "react";
import { useState } from "react";
import type { PackingBagPurchase } from "@/app/packing-bags/actions";
import { updatePackingBagPurchase } from "@/app/packing-bags/actions";
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
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface EditPackingBagDialogProps {
  item: PackingBagPurchase;
  onUpdated?: () => Promise<void>;
}

export function EditPackingBagDialog({ item, onUpdated }: EditPackingBagDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    purchase_date: item.purchase_date,
    quantity: String(item.quantity),
    price_uah: String(item.price_uah),
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const result = await updatePackingBagPurchase(item.id, {
        purchase_date: formData.purchase_date,
        quantity: Number(formData.quantity),
        price_uah: Number(formData.price_uah),
      });

      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }

      toast.success("Запис оновлено", {
        description: "Покупку мішків успішно оновлено",
      });
      setOpen(false);
      await onUpdated?.();
    } catch (error) {
      console.error("Помилка оновлення покупки мішків:", error);
      toast.error("Помилка", {
        description: "Не вдалося оновити запис",
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редагування покупки мішків</DialogTitle>
          <DialogDescription>Оновіть дату, кількість та ціну.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Дата покупки *</Label>
            <Input
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, purchase_date: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Кількість *</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Ціна, грн *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.price_uah}
              onChange={(e) => setFormData((prev) => ({ ...prev, price_uah: e.target.value }))}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
