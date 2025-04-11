"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { InventoryTransaction } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 border rounded-lg bg-card"
        >
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface InventoryTransactionListProps {
  transactions: InventoryTransaction[];
}

export function InventoryTransactionList({
  transactions,
}: InventoryTransactionListProps) {
  const [isLoading, setIsLoading] = useState(true);

  console.log("InventoryTransactionList rendered", { transactions, isLoading });

  useEffect(() => {
    console.log("InventoryTransactionList useEffect", {
      transactions,
      isLoading,
    });
    // Імітуємо завантаження даних
    const timer = setTimeout(() => {
      setIsLoading(false);
      console.log("Loading finished", { transactions });
    }, 500);
    return () => clearTimeout(timer);
  }, [transactions]);

  if (isLoading) {
    console.log("Rendering loading skeleton");
    return <LoadingSkeleton />;
  }

  console.log("Rendering transactions list", { transactions });
  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-4 border rounded-lg bg-card"
        >
          <div className="space-y-1">
            <h3 className="font-medium">
              {transaction.product?.name || "Невідомий продукт"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {transaction.notes || "Немає приміток"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {transaction.quantity < 0 ? "-" : "+"}
              {Math.abs(transaction.quantity)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(transaction.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
