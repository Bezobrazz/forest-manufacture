import {
  createKeepinExpensePayment,
  deleteKeepinPayment,
  isKeepinSupplierExpenseSyncEnabled,
} from "@/lib/crm/keepincrm/payments";

export type SupplierDeliveryExpenseSyncInput = {
  deliveryId: number;
  amount: number;
  atYmd: string;
  supplierName: string;
  productName: string;
  quantity: number;
  purseId?: number;
  categoryId?: number;
};

const CRM_SYNC_ATTEMPTS = 3;
const CRM_SYNC_RETRY_DELAY_MS = 400;

export function buildSupplierDeliveryExpenseComment(
  input: SupplierDeliveryExpenseSyncInput
): string {
  const supplier = input.supplierName.trim() || "—";
  const product = input.productName.trim() || "—";
  const qty = Number.isFinite(input.quantity) ? input.quantity : 0;
  return `Закупівля сировини #${input.deliveryId}: ${supplier}, ${product}, ${qty}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Проводить витрату в KeepinCRM (гаманець Петрович, категорія закупівлі сировини).
 * Повертає null, якщо синхронізація вимкнена або сума ≤ 0.
 * При тимчасових збоях API робить кілька спроб.
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

  let lastError: unknown;
  for (let attempt = 1; attempt <= CRM_SYNC_ATTEMPTS; attempt++) {
    try {
      return await createKeepinExpensePayment({
        amount,
        atYmd: input.atYmd,
        comment: buildSupplierDeliveryExpenseComment(input),
        purseId: input.purseId && input.purseId > 0 ? input.purseId : 0,
        categoryId:
          input.categoryId && input.categoryId > 0 ? input.categoryId : 0,
      });
    } catch (error) {
      lastError = error;
      if (attempt < CRM_SYNC_ATTEMPTS) {
        await sleep(CRM_SYNC_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("KeepinCRM: не вдалося створити витрату");
}

/** Видаляє пов’язану витрату в KeepinCRM. Без keepin_payment_id — no-op. */
export async function syncSupplierDeliveryExpenseDeleteToKeepin(
  keepinPaymentId: number | null | undefined
): Promise<void> {
  if (!isKeepinSupplierExpenseSyncEnabled()) {
    return;
  }

  const id = Number(keepinPaymentId);
  if (!Number.isFinite(id) || id <= 0) {
    return;
  }

  await deleteKeepinPayment(id);
}
