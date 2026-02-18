"use client";

import type React from "react";

import { useState, useEffect } from "react";
import type { Supplier } from "@/lib/types";
import { updateSupplier, addSupplierAdvance } from "@/app/actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Pencil, Calendar as CalendarIcon } from "lucide-react";
import { formatDate, dateToYYYYMMDD } from "@/lib/utils";
import { uk } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface EditSupplierDialogProps {
  supplier: Supplier;
  onSupplierUpdated?: () => void;
}

export function EditSupplierDialog({
  supplier,
  onSupplierUpdated,
}: EditSupplierDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone || "",
    notes: supplier.notes || "",
    advanceAmount: "",
    advanceDate: new Date(),
  });

  useEffect(() => {
    setFormData({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone || "",
      notes: supplier.notes || "",
      advanceAmount: "",
      advanceDate: new Date(),
    });
  }, [supplier]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append("id", formData.id.toString());
      submitFormData.append("name", formData.name);
      submitFormData.append("phone", formData.phone);
      submitFormData.append("notes", formData.notes);

      const result = await updateSupplier(submitFormData);

      if (!result.success) {
        toast.error("Помилка", {
          description: result.error || "Не вдалося оновити постачальника",
        });
        return;
      }

      const advanceAmt = Number(formData.advanceAmount);
      if (advanceAmt > 0) {
        const advanceFormData = new FormData();
        advanceFormData.append("supplier_id", formData.id.toString());
        advanceFormData.append("advance", formData.advanceAmount);
        advanceFormData.append("delivery_date", dateToYYYYMMDD(formData.advanceDate));
        const advanceResult = await addSupplierAdvance(advanceFormData);
        if (!advanceResult.success) {
          toast.error("Помилка", {
            description: advanceResult.error || "Не вдалося додати аванс",
          });
        }
      }

      setOpen(false);
      toast.success("Постачальника оновлено", {
        description: "Інформацію про постачальника успішно оновлено",
      });

      if (onSupplierUpdated) {
        try {
          await onSupplierUpdated();
        } catch (refreshError) {
          console.error(
            "Помилка при оновленні списку постачальників:",
            refreshError
          );
        }
      }
    } catch (error) {
      console.error("Помилка при оновленні постачальника:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні постачальника",
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редагування постачальника</DialogTitle>
          <DialogDescription>
            Змініть інформацію про постачальника та натисніть "Зберегти зміни"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${supplier.id}`}>Назва постачальника *</Label>
            <Input
              id={`name-${supplier.id}`}
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`phone-${supplier.id}`}>Телефон</Label>
            <Input
              id={`phone-${supplier.id}`}
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+380XXXXXXXXX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`notes-${supplier.id}`}>Примітки</Label>
            <Textarea
              id={`notes-${supplier.id}`}
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Додаткова інформація про постачальника"
            />
          </div>
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor={`advance-${supplier.id}`}>Додати аванс (₴)</Label>
            <div className="flex gap-2">
              <Input
                id={`advance-${supplier.id}`}
                name="advanceAmount"
                type="number"
                placeholder="0.00"
                value={formData.advanceAmount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, advanceAmount: e.target.value }))
                }
                min="0"
                step="0.01"
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-[120px] justify-start"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDate(formData.advanceDate.toISOString())}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.advanceDate}
                    onSelect={(d) => d && setFormData((prev) => ({ ...prev, advanceDate: d }))}
                    locale={uk}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {typeof supplier.advance === "number" && supplier.advance !== 0 && (
              <p className="text-xs text-muted-foreground">
                Поточний баланс: {supplier.advance.toFixed(2)} ₴
              </p>
            )}
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
      </DialogContent>
    </Dialog>
  );
}

