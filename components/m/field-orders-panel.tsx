"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  getMiniAppFinishedInventory,
  getMiniAppShipmentQueue,
} from "@/app/m/actions";
import { calculateForecast } from "@/lib/shipments/eta";
import { isLocalShipmentOrderCrmId } from "@/lib/shipments/local-shipment";
import type { CrmOrderWithDetails, Inventory } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FieldOrdersPanelProps = {
  active?: boolean;
};

export function FieldOrdersPanel({ active = true }: FieldOrdersPanelProps) {
  const [queue, setQueue] = useState<CrmOrderWithDetails[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void (async () => {
      const [queueResult, inventoryResult] = await Promise.all([
        getMiniAppShipmentQueue(),
        getMiniAppFinishedInventory(),
      ]);
      if (cancelled) return;

      if (!queueResult.ok) {
        setError(queueResult.error);
        setQueue([]);
        setInventory([]);
        setIsLoading(false);
        return;
      }

      setQueue(queueResult.queue);
      setInventory(inventoryResult.ok ? inventoryResult.inventory : []);
      if (!inventoryResult.ok) {
        setError(inventoryResult.error);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, reloadKey]);

  const forecasts = useMemo(() => {
    const inventoryByProduct: Record<number, number> = {};
    for (const item of inventory) {
      if (item.product_id != null) {
        inventoryByProduct[item.product_id] = item.quantity ?? 0;
      }
    }

    return calculateForecast({
      queue,
      inventory: inventoryByProduct,
      avgDailyProduction: {},
      today: new Date(),
    });
  }, [queue, inventory]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Завантаження…"
            : `У черзі: ${forecasts.length}`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 touch-manipulation"
          disabled={isLoading}
          onClick={() => setReloadKey((k) => k + 1)}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Оновити</span>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {isLoading && forecasts.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : forecasts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Черга відвантаження порожня
        </p>
      ) : (
        <ol className="space-y-3">
          {forecasts.map((f, index) => {
            const crmId = f.order.crm_id;
            const totalQty = f.order.items.reduce(
              (sum, item) => sum + (Number(item.quantity) || 0),
              0
            );
            const isLocal = isLocalShipmentOrderCrmId(crmId);

            return (
              <li
                key={crmId}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="space-y-2 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {index + 1}
                        </span>
                        <h2 className="truncate text-base font-semibold">
                          {f.order.customer?.name ?? "Без клієнта"}
                        </h2>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isLocal
                          ? "Локальна картка"
                          : `Угода #${crmId} · ${formatDate(f.order.crm_created_at)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {f.isReady ? (
                        <Badge variant="default">Готово</Badge>
                      ) : (
                        <Badge variant="secondary">Очікує</Badge>
                      )}
                      <Badge variant="outline">{totalQty} шт</Badge>
                    </div>
                  </div>

                  <ul className="space-y-1 border-t pt-2 text-sm">
                    {f.order.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex justify-between gap-2"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {item.product?.name ??
                            item.crm_product_ref ??
                            "—"}
                        </span>
                        <span className="shrink-0">{item.quantity} шт</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
