"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTrip } from "@/app/trips/actions";
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

interface DeleteTripButtonProps {
  tripId: string;
  tripName?: string | null;
  tripType?: string | null;
  /** icon — у списку; button — на сторінці редагування */
  variant?: "icon" | "button";
  onDeleted?: () => void | Promise<void>;
}

export function DeleteTripButton({
  tripId,
  tripName,
  tripType,
  variant = "icon",
  onDeleted,
}: DeleteTripButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const hasName = Boolean(tripName?.trim());

  async function handleDelete() {
    setIsPending(true);
    try {
      const result = await deleteTrip(tripId);
      if (!result.ok) {
        toast.error("Помилка", {
          description: result.error || "Неможливо видалити рейс",
        });
        return;
      }

      toast.success("Рейс видалено");
      setOpen(false);

      if (onDeleted) {
        await onDeleted();
      } else {
        const tab =
          tripType === "raw" || tripType === "commerce" ? tripType : "commerce";
        router.push(`/trips?tab=${tab}`);
        router.refresh();
      }
    } catch (error) {
      console.error("Помилка видалення рейсу:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні рейсу",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === "button" ? (
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
            Видалити поїздку
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={(e) => e.stopPropagation()}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="sr-only">Видалити рейс</span>
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити рейс?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasName
              ? `Ви впевнені, що хочете видалити рейс «${tripName!.trim()}»? Цю дію неможливо скасувати.`
              : "Ви впевнені, що хочете видалити цей рейс? Цю дію неможливо скасувати."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Скасувати</AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            aria-busy={isPending}
            variant="destructive"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Видалення…
              </>
            ) : (
              "Видалити"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
