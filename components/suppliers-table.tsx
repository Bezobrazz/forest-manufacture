"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditSupplierDialog } from "@/components/edit-supplier-dialog";
import { DeleteSupplierButton } from "@/components/delete-supplier-button";
import { Phone, FileText, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Supplier } from "@/lib/types";

interface SuppliersTableProps {
  suppliers: Supplier[];
  onRefresh?: () => Promise<void>;
}

export function SuppliersTable({
  suppliers,
  onRefresh,
}: SuppliersTableProps) {
  const [isLoading, setIsLoading] = useState(false);

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

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Немає постачальників, які відповідають критеріям пошуку
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
          <div className="inline-block animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
        </div>
      )}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] sm:w-[250px]">Назва</TableHead>
              <TableHead className="min-w-[140px] sm:w-[180px]">Телефон</TableHead>
              <TableHead className="min-w-[150px]">Примітки</TableHead>
              <TableHead className="min-w-[120px] text-right">Матеріали на балансі</TableHead>
              <TableHead className="min-w-[80px] w-[100px] text-right">Дії</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium min-w-[200px] sm:w-[250px]">
                  <div className="break-words">{supplier.name}</div>
                </TableCell>
                <TableCell className="min-w-[140px] sm:w-[180px]">
                  {supplier.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="break-all text-sm sm:text-base">{supplier.phone}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[150px]">
                  {supplier.notes ? (
                    <div className="flex items-start gap-2 max-w-md">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-xs sm:text-sm text-muted-foreground line-clamp-2 break-words">
                        {supplier.notes}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[120px] text-right">
                  {typeof supplier.materials_balance === "number" &&
                  supplier.materials_balance !== 0 ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium tabular-nums">
                        {supplier.materials_balance}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right min-w-[80px] w-[100px]">
                  <div className="flex items-center justify-end gap-1">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

