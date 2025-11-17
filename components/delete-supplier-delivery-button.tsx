"use client";

import { useState } from "react";
import { deleteSupplierDelivery } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import type { SupplierDelivery } from "@/lib/types";

interface DeleteSupplierDeliveryButtonProps {
  delivery: SupplierDelivery;
  onDeliveryDeleted?: () => void;
}

export function DeleteSupplierDeliveryButton({
  delivery,
  onDeliveryDeleted,
}: DeleteSupplierDeliveryButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setIsPending(true);

    try {
      const result = await deleteSupplierDelivery(delivery.id);

      if (result.success) {
        toast.success("Транзакцію видалено", {
          description: "Транзакцію успішно видалено з системи",
        });

        setOpen(false);

        if (onDeliveryDeleted) {
          try {
            await onDeliveryDeleted();
          } catch (refreshError) {
            console.error(
              "Помилка при оновленні списку транзакцій:",
              refreshError
            );
          }
        }
      } else {
        toast.error("Помилка", {
          description:
            result.error ||
            "Неможливо видалити транзакцію",
        });
      }
    } catch (error) {
      console.error("Помилка видалення транзакції:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні транзакції",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          disabled={isPending}
        >
          {isPending ? (
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="sr-only">Видалити</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити транзакцію?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити транзакцію від постачальника "
            {delivery.supplier?.name || "Невідомий"}" на продукт "
            {delivery.product?.name || "Невідомий"}"? Цю дію неможливо скасувати.
            Кількість матеріалів на складі буде зменшена відповідно.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            variant="destructive"
          >
            {isPending ? "Видалення..." : "Видалити"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

