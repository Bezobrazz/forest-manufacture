"use client"

import type React from "react"

import { useState } from "react"
import { updateInventoryQuantity } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Product } from "@/lib/types"

export function InventoryAdjustForm({ products }: { products: Product[] }) {
  const [isPending, setIsPending] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [quantity, setQuantity] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  // Групуємо продукти за категоріями для зручності вибору
  const productsByCategory: Record<string, Product[]> = {}

  products.forEach((product) => {
    const categoryName = product.category?.name || "Без категорії"
    if (!productsByCategory[categoryName]) {
      productsByCategory[categoryName] = []
    }
    productsByCategory[categoryName].push(product)
  })

  // Сортуємо категорії за алфавітом
  const sortedCategories = Object.keys(productsByCategory).sort()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsPending(true)

    try {
      if (!selectedProduct || !quantity) {
        toast({
          title: "Помилка",
          description: "Виберіть продукт та вкажіть кількість",
          variant: "destructive",
        })
        return
      }

      const productId = Number.parseInt(selectedProduct)
      const quantityValue = Number.parseFloat(quantity)

      if (isNaN(quantityValue)) {
        toast({
          title: "Помилка",
          description: "Кількість повинна бути числом",
          variant: "destructive",
        })
        return
      }

      const result = await updateInventoryQuantity(productId, quantityValue, notes)

      if (result.success) {
        toast({
          title: "Успішно",
          description: "Кількість на складі успішно оновлено",
        })

        // Очищаємо форму
        setSelectedProduct("")
        setQuantity("")
        setNotes("")
      } else {
        toast({
          title: "Помилка",
          description: result.error || "Не вдалося оновити кількість на складі",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Сталася помилка при оновленні кількості на складі",
        variant: "destructive",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product">Продукт</Label>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger id="product">
            <SelectValue placeholder="Виберіть продукт" />
          </SelectTrigger>
          <SelectContent>
            {sortedCategories.map((category) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-sm font-semibold">{category}</div>
                {productsByCategory[category].map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.name}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Нова кількість</Label>
        <Input
          id="quantity"
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Введіть нову кількість"
        />
        <p className="text-xs text-muted-foreground">
          Вкажіть загальну кількість продукції, яка повинна бути на складі
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Примітки</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Причина коригування кількості"
          rows={3}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Оновлення..." : "Оновити кількість"}
      </Button>
    </form>
  )
}

