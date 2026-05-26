import {
  createKeepinExpensePayment,
  isKeepinSupplierExpenseSyncEnabled,
} from "@/lib/crm/keepincrm/payments";

export type SupplierDeliveryExpenseSyncInput = {
  deliveryId: number;
  amount: number;
  atYmd: string;
  supplierName: string;
  productName: string;
  quantity: number;
};

export function buildSupplierDeliveryExpenseComment(
  input: SupplierDeliveryExpenseSyncInput
): string {
  const supplier = input.supplierName.trim() || "—";
  const product = input.productName.trim() || "—";
  const qty = Number.isFinite(input.quantity) ? input.quantity : 0;
  return `Закупівля сировини #${input.deliveryId}: ${supplier}, ${product}, ${qty}`;
}

/**
 * Проводить витрату в KeepinCRM (гаманець Петрович, категорія закупівлі сировини).
 * Повертає null, якщо синхронізація вимкнена або сума ≤ 0.
 */
export async function syncSupplierDeliveryExpenseToKeepin(
  input: SupplierDeliveryExpenseSyncInput
): Promise<number | null> {
  if (!isKeepinSupplierExpenseSyncEnabled()) {
    return null;
  }

  const amount = Math.round(input.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const paymentId = await createKeepinExpensePayment({
    amount,
    atYmd: input.atYmd,
    comment: buildSupplierDeliveryExpenseComment(input),
    purseId: 0,
    categoryId: 0,
  });

  return paymentId;
}
