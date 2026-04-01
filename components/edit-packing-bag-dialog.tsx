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
import { Calendar as CalendarIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils";
import { uk } from "date-fns/locale";

interface EditPackingBagDialogProps {
  item: PackingBagPurchase;
  onUpdated?: () => Promise<void>;
}

export function EditPackingBagDialog({ item, onUpdated }: EditPackingBagDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(
    item.purchase_date ? new Date(`${item.purchase_date}T12:00:00.000Z`) : undefined
  );
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
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
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
