"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShiftWithDetails } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ShiftListProps {
  shifts: ShiftWithDetails[];
}

export function ShiftList({ shifts }: ShiftListProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Імітуємо завантаження даних
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4">
      {shifts.map((shift) => (
        <div key={shift.id} className="p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">
              Зміна {shift.id} - {formatDate(shift.shift_date)}
            </h3>
            <span className="text-sm text-muted-foreground">
              {shift.status === "active" ? "Активна" : "Завершена"}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Вироблено:{" "}
              {shift.production?.reduce(
                (acc, item) => acc + item.quantity,
                0
              ) || 0}{" "}
              одиниць
            </p>
            <p className="text-sm text-muted-foreground">
              {shift.notes || "Немає приміток"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
