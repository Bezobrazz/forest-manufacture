"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumberWithUnit } from "@/lib/utils";

type Props = {
  priceId?: string;
  litersId?: string;
  sumId?: string;
  price: string;
  liters: string;
  sum: number | null;
  onPriceChange: (value: string) => void;
  onLitersChange: (value: string) => void;
  showOptionalHint?: boolean;
};

export function FieldFuelExpenseFields({
  priceId = "fuel_expense_price",
  litersId = "fuel_expense_liters",
  sumId = "fuel_expense_sum",
  price,
  liters,
  sum,
  onPriceChange,
  onLitersChange,
  showOptionalHint = true,
}: Props) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div>
        <div className="text-sm font-semibold">Витрати на паливо</div>
        {showOptionalHint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Необовʼязково</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor={priceId}>Ціна, ₴/л</Label>
          <Input
            id={priceId}
            inputMode="decimal"
            className="h-11 text-base"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor={litersId}>Кількість, л</Label>
          <Input
            id={litersId}
            inputMode="decimal"
            className="h-11 text-base"
            value={liters}
            onChange={(e) => onLitersChange(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={sumId}>Сума витрат на пальне, ₴</Label>
        <Input
          id={sumId}
          className="h-11 text-base font-semibold tabular-nums"
          value={sum != null ? formatNumberWithUnit(sum, "₴") : ""}
          placeholder="—"
          readOnly
          disabled
        />
      </div>
    </div>
  );
}
