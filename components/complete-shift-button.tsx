"use client";

import { useState } from "react";
import { completeShift } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
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

    try {
      const result = await completeShift(shift.id);

      if (result.success) {
        toast({
          title: "Зміну завершено",
          description: "Зміну успішно завершено",
        });
        setIsPending(false);
        setOpen(false);
        router.refresh();
      } else {
        toast({
          title: "Помилка",
          description: result.error,
          variant: "destructive",
        });
        setIsPending(false);
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Сталася помилка при завершенні зміни",
        variant: "destructive",
      });
      setIsPending(false);
    }
  }

  if (shift.status !== "active") {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="gap-2">
          <CheckCircle className="h-4 w-4" />
          <span>Завершити зміну</span>
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
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
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
