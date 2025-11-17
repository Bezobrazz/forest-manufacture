"use client"

import { useState } from "react"
import { deleteMaterial } from "@/app/actions"
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

interface DeleteMaterialButtonProps {
  materialId: number
  onMaterialDeleted?: () => void // Callback для оновлення списку матеріалів
}

export function DeleteMaterialButton({ materialId, onMaterialDeleted }: DeleteMaterialButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    console.log("Починаємо видалення матеріалу:", materialId)
    setIsPending(true)

    try {
      const result = await deleteMaterial(materialId)
      console.log("Результат видалення матеріалу:", result)

      if (result.success) {
        toast.success("Матеріал видалено", {
          description: "Матеріал успішно видалено з системи",
        })

        // Закриваємо діалог
        setOpen(false)

        // Оновлюємо список матеріалів без перезавантаження сторінки
        if (onMaterialDeleted) {
          try {
            onMaterialDeleted()
          } catch (refreshError) {
            console.error("Помилка при оновленні списку матеріалів:", refreshError)
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast.error("Помилка", {
          description:
            result.error || "Неможливо видалити матеріал. Можливо, він використовується у виробництві.",
        })
      }
    } catch (error) {
      console.error("Помилка видалення матеріалу:", error)
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні матеріалу",
      })
    } finally {
      setIsPending(false)
    }
  }

  async function handleDeleteAndClose() {
    await handleDelete()
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
          <AlertDialogTitle>Видалити матеріал?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити цей матеріал? Цю дію неможливо скасувати. Матеріал можна видалити лише якщо
            він не використовується у виробництві.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <Button
            onClick={handleDeleteAndClose}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground"
          >
            {isPending ? "Видалення..." : "Видалити"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

