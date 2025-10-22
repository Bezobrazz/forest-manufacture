"use client"

import type React from "react"

import { useState, useEffect } from "react"
import type { Product, ProductCategory } from "@/lib/types"
import { updateProduct } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EditProductDialogProps {
  product: Product
  categories: ProductCategory[]
  onProductUpdated?: () => void // Callback для оновлення списку продуктів
}

export function EditProductDialog({ product, categories = [], onProductUpdated }: EditProductDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [formData, setFormData] = useState({
    id: product.id,
    name: product.name,
    description: product.description || "",
    category_id: product.category_id ? product.category_id.toString() : "none",
    reward: product.reward !== null ? product.reward.toString() : "",
  })

  // Оновлюємо стан форми при зміні продукту
  useEffect(() => {
    setFormData({
      id: product.id,
      name: product.name,
      description: product.description || "",
      category_id: product.category_id ? product.category_id.toString() : "none",
      reward: product.reward !== null ? product.reward.toString() : "",
    })
  }, [product])

  // Обробник зміни полів форми
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Обробник зміни категорії
  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category_id: value }))
  }

  // Функція для оновлення списку продуктів
  const refreshProducts = async () => {
    if (onProductUpdated) {
      onProductUpdated()
    }
  }

  // Функція для відправки форми
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)

    try {
      // Створюємо FormData для відправки
      const submitFormData = new FormData()
      submitFormData.append("id", formData.id.toString())
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

      console.log("Відправляємо дані:", {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        category_id: formData.category_id === "none" ? "" : formData.category_id,
        reward: formData.reward,
      })

      // Викликаємо серверну дію
      const result = await updateProduct(submitFormData)

      if (result.success) {
        setOpen(false)
        toast.success("Продукт оновлено", {
          description: "Інформацію про продукт та винагороду успішно оновлено",
        })

        // Оновлюємо список продуктів без перезавантаження сторінки
        if (onProductUpdated) {
          try {
            await onProductUpdated()
          } catch (refreshError) {
            console.error("Помилка при оновленні списку продуктів:", refreshError)
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося оновити продукт",
        })
      }
    } catch (error) {
      console.error("Помилка при оновленні продукту:", error)
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні продукту",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Редагувати</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редагування продукту</DialogTitle>
          <DialogDescription>Змініть інформацію про продукт та натисніть "Зберегти зміни"</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${product.id}`}>Назва продукту</Label>
            <Input id={`name-${product.id}`} name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`category-${product.id}`}>Категорія</Label>
            <Select value={formData.category_id} onValueChange={handleCategoryChange}>
              <SelectTrigger id={`category-${product.id}`}>
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
            <Label htmlFor={`description-${product.id}`}>Опис</Label>
            <Textarea
              id={`description-${product.id}`}
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reward-${product.id}`}>Винагорода</Label>
            <Input
              id={`reward-${product.id}`}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Збереження..." : "Зберегти зміни"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

