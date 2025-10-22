"use client"

import { useState } from "react"
import { deleteProductCategory } from "@/app/actions"
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

interface DeleteCategoryButtonProps {
  categoryId: number
  categoryName?: string
  onCategoryDeleted?: () => Promise<void>
}

export function DeleteCategoryButton({
  categoryId,
  categoryName = "цю категорію",
  onCategoryDeleted,
}: DeleteCategoryButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    console.log("Починаємо видалення категорії:", categoryId, categoryName)
    setIsPending(true)

    try {
      const result = await deleteProductCategory(categoryId)
      console.log("Результат видалення категорії:", result)

      if (result.success) {
        let message = `Категорію "${categoryName}" успішно видалено з системи`
        if (result.updatedProducts > 0) {
          message += `. ${result.updatedProducts} продуктів переміщено в "без категорії"`
        }

        toast.success("Категорію видалено", {
          description: message,
        })
        setOpen(false)

        // Оновлюємо список категорій без перезавантаження сторінки
        if (onCategoryDeleted) {
          try {
            await onCategoryDeleted()
          } catch (refreshError) {
            console.error("Помилка при оновленні списку категорій:", refreshError)
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Неможливо видалити категорію",
        })
      }
    } catch (error) {
      console.error("Помилка видалення категорії:", error)
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні категорії",
      })
    } finally {
      setIsPending(false)
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
          <AlertDialogTitle>Видалити категорію "{categoryName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити цю категорію? Цю дію неможливо скасувати.
            <br />
            <br />
            Якщо в цій категорії є продукти, вони будуть автоматично переміщені в "без категорії".
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <Button
            onClick={handleDelete}
            type="button"
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

