"use client"

import type React from "react"

import { useState } from "react"
import { createProductCategory } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

interface CategoryFormProps {
  onCategoryAdded?: () => Promise<void>
}

export function CategoryForm({ onCategoryAdded }: CategoryFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [name, setName] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)

    try {
      const formData = new FormData()
      formData.append("name", name)

      const result = await createProductCategory(formData)

      if (result.success) {
        toast.success("Категорію додано", {
          description: "Нову категорію продуктів успішно додано",
        })

        // Очищаємо форму
        setName("")

        // Оновлюємо список категорій без перезавантаження сторінки
        if (onCategoryAdded) {
          try {
            await onCategoryAdded()
          } catch (refreshError) {
            console.error("Помилка при оновленні списку категорій:", refreshError)
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося додати категорію",
        })
      }
    } catch (error) {
      console.error("Помилка при додаванні категорії:", error)
      toast.error("Помилка", {
        description: "Сталася помилка при додаванні категорії",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Назва категорії</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Додавання..." : "Додати категорію"}
      </Button>
    </form>
  )
}

