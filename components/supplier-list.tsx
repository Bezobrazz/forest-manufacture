"use client";

import { useState } from "react";
import { EditSupplierDialog } from "@/components/edit-supplier-dialog";
import { DeleteSupplierButton } from "@/components/delete-supplier-button";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Supplier } from "@/lib/types";

interface SupplierListProps {
  initialSuppliers: Supplier[];
  onRefresh?: () => Promise<void>;
}

export function SupplierList({
  initialSuppliers,
  onRefresh,
}: SupplierListProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Функція для оновлення списку постачальників
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsLoading(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Помилка при оновленні списку постачальників:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      {isLoading && (
        <div className="text-center py-2 mb-2">
          <div className="inline-block animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2"></div>
          <span className="text-sm text-muted-foreground">
            Оновлення списку...
          </span>
        </div>
      )}

      {initialSuppliers.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-muted-foreground">
            Немає постачальників, які відповідають критеріям пошуку
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-2 flex-1">
                <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{supplier.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {supplier.phone && (
                      <Badge variant="outline" className="text-xs">
                        {supplier.phone}
                      </Badge>
                    )}
                    {supplier.notes && (
                      <div className="text-xs text-muted-foreground truncate">
                        {supplier.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <EditSupplierDialog
                  supplier={supplier}
                  onSupplierUpdated={handleRefresh}
                />
                <DeleteSupplierButton
                  supplierId={supplier.id}
                  supplierName={supplier.name}
                  onSupplierDeleted={handleRefresh}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

