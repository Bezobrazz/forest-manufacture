"use client";

import type { PackingBagPurchase } from "@/app/packing-bags/actions";
import { Badge } from "@/components/ui/badge";
import { EditPackingBagDialog } from "@/components/edit-packing-bag-dialog";
import { DeletePackingBagButton } from "@/components/delete-packing-bag-button";

interface PackingBagListProps {
  items: PackingBagPurchase[];
  onRefresh?: () => Promise<void>;
}

export function PackingBagList({ items, onRefresh }: PackingBagListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">Немає записів про покупки мішків</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <div className="font-medium">{item.purchase_date}</div>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">Кількість: {item.quantity}</Badge>
              <Badge variant="secondary">Ціна: {item.price_uah} грн</Badge>
              <Badge variant="secondary">
                Сума: {(item.total_uah ?? item.quantity * item.price_uah).toFixed(2)} грн
              </Badge>
            </div>
          </div>
          <div className="flex items-center">
            <EditPackingBagDialog item={item} onUpdated={onRefresh} />
            <DeletePackingBagButton
              id={item.id}
              purchaseDate={item.purchase_date}
              totalUah={item.total_uah ?? item.quantity * item.price_uah}
              onDeleted={onRefresh}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
