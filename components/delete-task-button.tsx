"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface DeleteTaskButtonProps {
  taskId: number;
  taskTitle: string;
  onTaskDeleted?: () => void;
}

export function DeleteTaskButton({
  taskId,
  taskTitle,
  onTaskDeleted,
}: DeleteTaskButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setIsPending(true);

    try {
      const result = await deleteTask(taskId);

      if (result.success) {
        toast.success("Задачу видалено", {
          description: "Задачу успішно видалено",
        });
        router.refresh();
        onTaskDeleted?.();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні задачі",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити задачу</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити задачу "{taskTitle}"? Цю дію
            неможливо скасувати.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending ? "Видалення..." : "Видалити"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
