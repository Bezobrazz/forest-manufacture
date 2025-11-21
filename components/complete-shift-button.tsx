"use client";

import { useState } from "react";
import { completeShift } from "@/app/actions";
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
import { CheckCircle } from "lucide-react";
import type { Shift } from "@/lib/types";
import { useRouter } from "next/navigation";

interface CompleteShiftButtonProps {
  shift: Shift;
}

export function CompleteShiftButton({ shift }: CompleteShiftButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleComplete() {
    setIsPending(true);
    console.log("Starting shift completion for shift ID:", shift.id);

    try {
      const result = await completeShift(shift.id);

      console.log("Shift completion result:", result);

      if (result.success) {
        toast.success("Зміну завершено", {
          description: "Зміну успішно завершено",
        });
        setIsPending(false);
        setOpen(false);
        router.refresh();
        
        // Відправляємо повідомлення для оновлення інших сторінок
        if (typeof window !== "undefined") {
          const channel = new BroadcastChannel("inventory-update");
          channel.postMessage({ type: "inventory-updated" });
          channel.close();
        }
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
        setIsPending(false);
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при завершенні зміни",
      });
      setIsPending(false);
    }
  }

  if (shift.status !== "active") {
    return null;
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!isPending) {
          setOpen(newOpen);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button className="gap-2" disabled={isPending}>
          {isPending ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              <span>Завершення...</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>Завершити зміну</span>
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Завершити зміну?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете завершити цю зміну? Після завершення зміни ви
            не зможете додавати працівників або змінювати дані про вироблену
            продукцію.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Скасувати</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleComplete}
            disabled={isPending}
            className="bg-primary text-primary-foreground"
          >
            {isPending ? (
              <div className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                <span>Завершення...</span>
              </div>
            ) : (
              "Завершити зміну"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
