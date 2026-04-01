"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePackingBagPurchase } from "@/app/packing-bags/actions";
import { Button } from "@/components/ui/button";
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

interface DeletePackingBagButtonProps {
  id: number;
  purchaseDate: string;
  totalUah: number;
  onDeleted?: () => Promise<void>;
}

export function DeletePackingBagButton({
  id,
  purchaseDate,
  totalUah,
  onDeleted,
}: DeletePackingBagButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setIsPending(true);
    try {
      const result = await deletePackingBagPurchase(id);
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Запис видалено");
      setOpen(false);
      await onDeleted?.();
    } catch (error) {
      console.error("Помилка видалення покупки мішків:", error);
      toast.error("Помилка", {
        description: "Не вдалося видалити запис",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="sr-only">Видалити</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити транзакцію покупки мішків?</AlertDialogTitle>
          <AlertDialogDescription>
            Буде видалено запис від {purchaseDate} на суму {totalUah.toFixed(2)} грн.
            Цю дію неможливо скасувати.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <Button onClick={handleDelete} disabled={isPending} variant="destructive">
            {isPending ? "Видалення..." : "Видалити"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
