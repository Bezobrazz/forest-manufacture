import type { InventoryTransaction } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export type AdjustmentDisplayValues = {
  before: number | null;
  entered: number | null;
  after: number | null;
  delta: number | null;
};

export function getTransactionBalanceAfter(
  transaction: Pick<InventoryTransaction, "id" | "balance_after">,
  balanceByTxId: Map<number, number>
): number | null {
  if (
    transaction.balance_after != null &&
    Number.isFinite(Number(transaction.balance_after))
  ) {
    return Number(transaction.balance_after);
  }
  return balanceByTxId.get(transaction.id) ?? null;
}

export function getAdjustmentDisplayValues(
  transaction: Pick<InventoryTransaction, "id" | "quantity" | "balance_after">,
  balanceByTxId: Map<number, number>
): AdjustmentDisplayValues {
  const after = getTransactionBalanceAfter(transaction, balanceByTxId);
  const delta = Number(transaction.quantity);

  if (after == null || !Number.isFinite(delta)) {
    return {
      before: null,
      entered: after,
      after,
      delta: Number.isFinite(delta) ? delta : null,
    };
  }

  return {
    before: after - delta,
    entered: after,
    after,
    delta,
  };
}

export function formatAdjustmentDelta(delta: number): string {
  if (delta > 0) {
    return `Додано: +${formatNumber(delta)} шт`;
  }
  if (delta < 0) {
    return `Віднято: ${formatNumber(Math.abs(delta))} шт`;
  }
  return "Без змін: 0 шт";
}

/** Обчислює дельту коригування: нова абсолютна кількість мінус поточна. */
export function computeInventoryAdjustmentDelta(
  newQuantity: number,
  currentQuantity: number | null | undefined
): number {
  if (currentQuantity == null) {
    return newQuantity;
  }
  return newQuantity - currentQuantity;
}

export function isNegligibleAdjustment(delta: number): boolean {
  return Math.abs(delta) < 1e-9;
}
