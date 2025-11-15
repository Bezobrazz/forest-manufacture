"use client";

import type React from "react";

import { useState, useEffect } from "react";
import type { Supplier } from "@/lib/types";
import { updateSupplier } from "@/app/actions";
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
import { toast } from "sonner";
import { Pencil } from "lucide-react";

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
  });

  // Оновлюємо стан форми при зміні постачальника
  useEffect(() => {
    setFormData({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone || "",
      notes: supplier.notes || "",
    });
  }, [supplier]);

  // Обробник зміни полів форми
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Функція для оновлення списку постачальників
  const refreshSuppliers = async () => {
    if (onSupplierUpdated) {
      onSupplierUpdated();
    }
  };

  // Функція для відправки форми
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    try {
      // Створюємо FormData для відправки
      const submitFormData = new FormData();
      submitFormData.append("id", formData.id.toString());
      submitFormData.append("name", formData.name);
      submitFormData.append("phone", formData.phone);
      submitFormData.append("notes", formData.notes);

      // Викликаємо серверну дію
      const result = await updateSupplier(submitFormData);

      if (result.success) {
        setOpen(false);
        toast.success("Постачальника оновлено", {
          description: "Інформацію про постачальника успішно оновлено",
        });

        // Оновлюємо список постачальників без перезавантаження сторінки
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
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося оновити постачальника",
        });
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

