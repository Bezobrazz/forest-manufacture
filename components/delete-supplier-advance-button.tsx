"use client";

import { useState } from "react";
import { deleteSupplierAdvanceTransaction } from "@/app/actions";
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
import type { SupplierAdvanceTransaction } from "@/lib/types";

interface DeleteSupplierAdvanceButtonProps {
  advance: SupplierAdvanceTransaction;
  onAdvanceDeleted?: () => void;
}

export function DeleteSupplierAdvanceButton({
  advance,
  onAdvanceDeleted,
}: DeleteSupplierAdvanceButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setIsPending(true);

    try {
      const result = await deleteSupplierAdvanceTransaction(advance.id);

      if (result.success) {
        toast.success("Аванс видалено", {
          description: "Операцію авансу успішно видалено",
        });

        setOpen(false);

        if (onAdvanceDeleted) {
          try {
            await onAdvanceDeleted();
          } catch (refreshError) {
            console.error(
              "Помилка при оновленні списку транзакцій:",
              refreshError,
            );
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Неможливо видалити аванс",
        });
      }
    } catch (error) {
      console.error("Помилка видалення авансу:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні авансу",
      });
    } finally {
      setIsPending(false);
    }
  }

  const amount = Math.round(Number(advance.amount) * 100) / 100;

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
          <span className="sr-only">Видалити аванс</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити аванс?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити аванс{" "}
            {advance.supplier?.name ? (
              <>постачальнику &quot;{advance.supplier.name}&quot;</>
            ) : (
              ""
            )}{" "}
            на суму {amount.toFixed(2)} ₴? Цю дію неможливо скасувати. Баланс
            постачальника буде зменшено відповідно.
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
