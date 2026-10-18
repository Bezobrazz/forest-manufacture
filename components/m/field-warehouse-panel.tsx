"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, RefreshCw } from "lucide-react";
import { getMiniAppFinishedInventory } from "@/app/m/actions";
import { isFinishedProductRow } from "@/lib/inventory/inventoryView";
import type { Inventory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getFractionNumber(productDescription?: string): number {
  if (!productDescription) return Number.POSITIVE_INFINITY;
  const match = productDescription.match(/(\d+[.,]?\d*)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const n = Number(match[1].replace(",", "."));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

type FieldWarehousePanelProps = {
  active?: boolean;
};

export function FieldWarehousePanel({
  active = true,
}: FieldWarehousePanelProps) {
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
      const result = await getMiniAppFinishedInventory();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setInventory([]);
        setIsLoading(false);
        return;
      }
      setInventory(result.inventory);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, reloadKey]);

  const byCategory = useMemo(() => {
    const finished = inventory.filter(isFinishedProductRow);
    const map = new Map<string, Inventory[]>();

    for (const item of finished) {
      const categoryName = item.product?.category?.name || "Без категорії";
      const list = map.get(categoryName) ?? [];
      list.push(item);
      map.set(categoryName, list);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "uk"))
      .map(([category, items]) => ({
        category,
        items: items.slice().sort(
          (a, b) =>
            getFractionNumber(a.product?.description ?? undefined) -
            getFractionNumber(b.product?.description ?? undefined)
        ),
      }));
  }, [inventory]);

  const totalQty = useMemo(
    () =>
      byCategory.reduce(
        (sum, group) =>
          sum + group.items.reduce((s, item) => s + (item.quantity || 0), 0),
        0
      ),
    [byCategory]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Завантаження…" : `Усього: ${totalQty} шт`}
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

      {isLoading && byCategory.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : byCategory.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Немає даних про готову продукцію
        </p>
      ) : (
        <div className="space-y-4">
          {byCategory.map(({ category, items }) => (
            <section
              key={category}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="border-b bg-muted/40 px-3 py-2">
                <h2 className="text-sm font-semibold">{category}</h2>
              </div>
              <ul className="divide-y">
                {items.map((item) => (
                  <li
                    key={item.id ? item.id : `product-${item.product_id}`}
                    className="flex items-center justify-between gap-3 px-3 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {item.product?.name ?? "—"}
                        </div>
                        {item.product?.description ? (
                          <div className="text-xs text-muted-foreground">
                            {item.product.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <Badge
                      variant={item.quantity > 0 ? "default" : "destructive"}
                      className="shrink-0"
                    >
                      {item.quantity} шт
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
