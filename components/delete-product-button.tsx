"use client"

import { useState } from "react"
import { deleteProduct } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
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

interface DeleteProductButtonProps {
  productId: number
  onProductDeleted?: () => void // Callback для оновлення списку продуктів
}

export function DeleteProductButton({ productId, onProductDeleted }: DeleteProductButtonProps) {
  const [isPending, setIsPending] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    console.log("Починаємо видалення продукту:", productId)
    setIsPending(true)

    try {
      const result = await deleteProduct(productId)
      console.log("Результат видалення продукту:", result)

      if (result.success) {
        toast({
          title: "Продукт видалено",
          description: "Продукт успішно видалено з системи",
        })

        // Закриваємо діалог
        setOpen(false)

        // Оновлюємо список продуктів без перезавантаження сторінки
        if (onProductDeleted) {
          try {
            onProductDeleted()
          } catch (refreshError) {
            console.error("Помилка при оновленні списку продуктів:", refreshError)
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast({
          title: "Помилка",
          description: result.error || "Неможливо видалити продукт. Можливо, він використовується у виробництві.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Помилка видалення продукту:", error)
      toast({
        title: "Помилка",
        description: "Сталася помилка при видаленні продукту",
        variant: "destructive",
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
          <AlertDialogTitle>Видалити продукт?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити цей продукт? Цю дію неможливо скасувати. Продукт можна видалити лише якщо
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

