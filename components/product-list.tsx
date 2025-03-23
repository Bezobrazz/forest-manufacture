"use client"

import { useState } from "react"
import { EditProductDialog } from "@/components/edit-product-dialog"
import { DeleteProductButton } from "@/components/delete-product-button"
import { Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Product, ProductCategory } from "@/lib/types"

interface ProductListProps {
  initialProducts: Product[]
  categories: ProductCategory[]
  onRefresh?: () => Promise<void>
}

export function ProductList({ initialProducts, categories, onRefresh }: ProductListProps) {
  const [isLoading, setIsLoading] = useState(false)

  // Функція для оновлення списку продуктів
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsLoading(true)
      try {
        await onRefresh()
      } catch (error) {
        console.error("Помилка при оновленні списку продуктів:", error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <>
      {isLoading && (
        <div className="text-center py-2 mb-2">
          <div className="inline-block animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2"></div>
          <span className="text-sm text-muted-foreground">Оновлення списку...</span>
        </div>
      )}

      {initialProducts.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-muted-foreground">Немає зареєстрованої продукції</p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialProducts.map((product) => (
            <div key={product.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {product.category && (
                      <Badge variant="outline" className="text-xs">
                        {product.category.name}
                      </Badge>
                    )}
                    {product.reward !== null && (
                      <Badge variant="secondary" className="text-xs">
                        Винагорода: {product.reward}
                      </Badge>
                    )}
                    {product.description && <div className="text-xs text-muted-foreground">{product.description}</div>}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <EditProductDialog product={product} categories={categories} onProductUpdated={handleRefresh} />
                <DeleteProductButton productId={product.id} onProductDeleted={handleRefresh} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

