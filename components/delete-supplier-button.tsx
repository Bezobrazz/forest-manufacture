"use client";

import { useState } from "react";
import { deleteSupplier } from "@/app/actions";
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

interface DeleteSupplierButtonProps {
  supplierId: number;
  supplierName: string;
  onSupplierDeleted?: () => void;
}

export function DeleteSupplierButton({
  supplierId,
  supplierName,
  onSupplierDeleted,
}: DeleteSupplierButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setIsPending(true);

    try {
      const result = await deleteSupplier(supplierId);

      if (result.success) {
        toast.success("Постачальника видалено", {
          description: "Постачальника успішно видалено з системи",
        });

        setOpen(false);

        if (onSupplierDeleted) {
          try {
            onSupplierDeleted();
          } catch (refreshError) {
            console.error(
              "Помилка при оновленні списку постачальників:",
              refreshError
            );
          }
        }
      } else {
        toast.error("Помилка", {
          description:
            result.error ||
            "Неможливо видалити постачальника. Можливо, він використовується в поставках.",
        });
      }
    } catch (error) {
      console.error("Помилка видалення постачальника:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні постачальника",
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
          <AlertDialogTitle>Видалити постачальника?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити постачальника "{supplierName}"? Цю
            дію неможливо скасувати. Постачальника можна видалити лише якщо він
            не використовується в поставках.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground"
          >
            {isPending ? "Видалення..." : "Видалити"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

