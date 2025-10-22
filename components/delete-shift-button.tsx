"use client"

import { useState } from "react"
import { deleteShift } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Shift } from "@/lib/types"

interface DeleteShiftButtonProps {
  shift: Shift
}

export function DeleteShiftButton({ shift }: DeleteShiftButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Перевіряємо, чи зміна закрита
  if (shift.status !== "completed") {
    return null
  }

  async function handleDelete() {
    setIsPending(true)

    try {
      const result = await deleteShift(shift.id)

      if (result.success) {
        toast.success("Зміну видалено", {
          description: "Зміну успішно видалено з системи",
        })
        setOpen(false)
        // Перенаправляємо на головну сторінку
        router.push("/shifts")
      } else {
        toast.error("Помилка", {
          description: result.error || "Неможливо видалити зміну",
        })
      }
    } catch (error) {
      console.error("Помилка видалення зміни:", error)
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні зміни",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" />
          <span>Видалити зміну</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити зміну #{shift.id}?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити цю зміну? Ця дія видалить всі дані про зміну, включаючи інформацію про
            працівників та вироблену продукцію. Цю дію неможливо скасувати.
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
  )
}

