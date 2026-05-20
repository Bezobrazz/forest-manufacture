"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

import { getPackingBagStockQuantity } from "@/app/packing-bags/actions";
import { Button } from "@/components/ui/button";
import { PACKING_BAG_LOW_STOCK_THRESHOLD } from "@/lib/packing-bags/constants";
import { PACKING_BAG_PRODUCT_NAME } from "@/lib/packing-bags/packing-bag-purchase";
import { cn, formatNumber } from "@/lib/utils";

type PackingBagLowStockBannerProps = {
  /** Показати макет для узгодження дизайну (наприклад, на одній сторінці). */
  designPreview?: boolean;
  className?: string;
};

export function PackingBagLowStockBanner({
  designPreview = false,
  className,
}: PackingBagLowStockBannerProps) {
  const [quantity, setQuantity] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const loadQuantity = useCallback(async () => {
    const value = await getPackingBagStockQuantity();
    setQuantity(value);
    setReady(true);
  }, []);

  useEffect(() => {
    void loadQuantity();
  }, [loadQuantity]);

  const isLow =
    quantity != null && quantity <= PACKING_BAG_LOW_STOCK_THRESHOLD;
  const showBanner = ready && !dismissed && (isLow || designPreview);
  const displayQuantity =
    designPreview && !isLow ? 2_450 : quantity ?? 0;
  const isMock = designPreview && !isLow;

  if (!showBanner) return null;

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className={cn(
        "sticky top-0 z-50 w-full border-b border-amber-500/40 bg-amber-300 text-amber-950 shadow-sm",
        className
      )}
    >
      <div className="mx-auto flex min-h-9 max-w-screen-2xl items-center gap-2 px-3 py-1.5 sm:px-4">
        <AlertTriangle className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <p className="min-w-0 flex-1 text-center text-xs leading-snug sm:text-sm">
          <span className="font-semibold">Низький залишок упаковочних мішків:</span>{" "}
          <span className="tabular-nums font-medium">
            {formatNumber(displayQuantity)} шт
          </span>
          {isMock ? (
            <span className="text-amber-800/80"> (приклад для перегляду)</span>
          ) : null}
          <span className="hidden md:inline text-amber-900/85">
            {" "}
            · «{PACKING_BAG_PRODUCT_NAME}»
          </span>
          <Link
            href="/transactions/suppliers"
            className="ml-1 font-medium underline underline-offset-2 hover:text-amber-950"
          >
            Закупівлі
          </Link>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-amber-950 hover:bg-amber-400/80 hover:text-amber-950"
          onClick={handleDismiss}
          aria-label="Закрити сповіщення"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
