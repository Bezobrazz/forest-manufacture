"use client"

import { useState } from "react"
import { EditMaterialDialog } from "@/components/edit-material-dialog"
import { DeleteMaterialButton } from "@/components/delete-material-button"
import { Box } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Product, ProductCategory } from "@/lib/types"

interface MaterialListProps {
  initialMaterials: Product[]
  categories: ProductCategory[]
  onRefresh?: () => Promise<void>
}

export function MaterialList({ initialMaterials, categories, onRefresh }: MaterialListProps) {
  const [isLoading, setIsLoading] = useState(false)

  // Функція для оновлення списку матеріалів
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsLoading(true)
      try {
        await onRefresh()
      } catch (error) {
        console.error("Помилка при оновленні списку матеріалів:", error)
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

      {initialMaterials.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-muted-foreground">Немає зареєстрованих матеріалів</p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialMaterials.map((material) => (
            <div key={material.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{material.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {material.category && (
                      <Badge variant="outline" className="text-xs">
                        {material.category.name}
                      </Badge>
                    )}
                    {material.cost !== null && (
                      <Badge variant="secondary" className="text-xs">
                        Вартість: {material.cost}
                      </Badge>
                    )}
                    {material.description && <div className="text-xs text-muted-foreground">{material.description}</div>}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <EditMaterialDialog material={material} categories={categories} onMaterialUpdated={handleRefresh} />
                <DeleteMaterialButton materialId={material.id} onMaterialDeleted={handleRefresh} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

