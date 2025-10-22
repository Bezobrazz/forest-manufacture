"use client"

import type React from "react"

import { useState } from "react"
import { createProduct } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ProductCategory } from "@/lib/types"

interface ProductFormProps {
  categories: ProductCategory[]
  onProductAdded?: () => Promise<void>
}

export function ProductForm({ categories = [], onProductAdded }: ProductFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category_id: "none",
    reward: "",
  })

  // Обробник зміни полів форми
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Обробник зміни категорії
  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category_id: value }))
  }

  // Функція для відправки форми
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)

    try {
      // Перевіряємо, що винагорода є числом, якщо вона вказана
      if (formData.reward && isNaN(Number(formData.reward))) {
        toast.error("Помилка", {
          description: "Винагорода повинна бути числом",
        })
        setIsPending(false)
        return
      }

      // Створюємо FormData для відправки
      const submitFormData = new FormData()
      submitFormData.append("name", formData.name)
      submitFormData.append("description", formData.description)

      // Обробка категорії
      if (formData.category_id === "none") {
        submitFormData.append("category_id", "")
      } else {
        submitFormData.append("category_id", formData.category_id)
      }

      // Обробка винагороди
      submitFormData.append("reward", formData.reward)

      console.log("Відправляємо дані нового продукту:", {
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id === "none" ? "" : formData.category_id,
        reward: formData.reward,
      })

      // Викликаємо серверну дію
      const result = await createProduct(submitFormData)

      if (result.success) {
        toast.success("Продукт додано", {
          description: "Новий продукт успішно додано до системи",
        })

        // Очищаємо форму
        setFormData({
          name: "",
          description: "",
          category_id: "none",
          reward: "",
        })

        // Оновлюємо список продуктів без перезавантаження сторінки
        if (onProductAdded) {
          try {
            await onProductAdded()
          } catch (refreshError) {
            console.error("Помилка при оновленні списку продуктів:", refreshError)
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося додати продукт",
        })
      }
    } catch (error) {
      console.error("Помилка при додаванні продукту:", error)
      toast.error("Помилка", {
        description: "Сталася помилка при додаванні продукту",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Назва продукту</Label>
        <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category_id">Категорія</Label>
        <Select value={formData.category_id} onValueChange={handleCategoryChange}>
          <SelectTrigger id="category_id">
            <SelectValue placeholder="Виберіть категорію" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без категорії</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reward">Винагорода</Label>
        <Input
          id="reward"
          name="reward"
          type="number"
          step="0.01"
          min="0"
          value={formData.reward}
          onChange={handleChange}
          placeholder="Введіть суму винагороди (необов'язково)"
        />
        <p className="text-xs text-muted-foreground">Сума винагороди за виготовлення одиниці продукції</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Опис</Label>
        <Textarea id="description" name="description" rows={3} value={formData.description} onChange={handleChange} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Додавання..." : "Додати продукт"}
      </Button>
    </form>
  )
}

