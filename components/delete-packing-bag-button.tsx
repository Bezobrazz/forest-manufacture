"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePackingBagPurchase } from "@/app/packing-bags/actions";
import { Button } from "@/components/ui/button";

interface DeletePackingBagButtonProps {
  id: number;
  onDeleted?: () => Promise<void>;
}

export function DeletePackingBagButton({ id, onDeleted }: DeletePackingBagButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Видалити запис про покупку мішків?")) return;
    setIsPending(true);
    try {
      const result = await deletePackingBagPurchase(id);
      if (!result.ok) {
        toast.error("Помилка", { description: result.error });
        return;
      }
      toast.success("Запис видалено");
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
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDelete} disabled={isPending}>
      <Trash2 className="h-4 w-4 text-destructive" />
      <span className="sr-only">Видалити</span>
    </Button>
  );
}
