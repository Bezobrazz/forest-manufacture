import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchKeepinPaymentsSince,
  isKeepinSupplierExpenseSyncEnabled,
  parseSupplierDeliveryIdFromExpenseComment,
  resolveKeepinSupplierExpenseRefs,
} from "@/lib/crm/keepincrm/payments";
import { syncSupplierDeliveryExpenseToKeepin } from "@/lib/crm/keepincrm/sync-supplier-delivery-expense";
import { resolveSupplierDeliveryPayableAmount } from "@/lib/suppliers/delivery-payable-amount";
import { sendTelegramMessage } from "@/lib/telegram";

const RECONCILE_LOOKBACK_DAYS = 30;
const CRON_RECONCILE_MAX_PAGES = 120;

export type ReconcileSupplierDeliveryExpensesResult = {
  scanned: number;
  linkedExisting: number;
  created: number;
  failed: number;
  failures: string[];
};

function reconcileSinceYmd(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - RECONCILE_LOOKBACK_DAYS);
  return date.toISOString().slice(0, 10);
}

function relationName(
  value: { name?: string } | { name?: string }[] | null | undefined
): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name?.trim() ?? "";
  return value.name?.trim() ?? "";
}

function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function notifyReconcileFailures(failures: string[]): Promise<void> {
  if (!failures.length) return;
  const message = [
    `⚠️ <b>KeepinCRM: пропущені витрати закупівель</b>`,
    ``,
    `Reconcile не зміг провести:`,
    ...failures.map((f) => `• ${escapeTelegramHtml(f)}`),
  ].join("\n");
  try {
    await sendTelegramMessage(message);
  } catch (error) {
    console.error("[reconcile supplier expenses] telegram:", error);
  }
}

/**
 * Добовий safety net: поставки без keepin_payment_id → link existing / POST expense.
 */
export async function reconcileSupplierDeliveryExpensesWithKeepin(
  supabase: SupabaseClient
): Promise<ReconcileSupplierDeliveryExpensesResult> {
  if (!isKeepinSupplierExpenseSyncEnabled()) {
    return {
      scanned: 0,
      linkedExisting: 0,
      created: 0,
      failed: 0,
      failures: [],
    };
  }

  const sinceYmd = reconcileSinceYmd();
  const sinceIso = `${sinceYmd}T00:00:00.000Z`;

  const { data: rows, error } = await supabase
    .from("supplier_deliveries")
    .select(
      `
      id, quantity, price_per_unit, actual_paid, created_at, keepin_payment_id,
      supplier:suppliers(name),
      product:products!supplier_deliveries_product_id_fkey(name)
    `
    )
    .is("keepin_payment_id", null)
    .gte("created_at", sinceIso)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const candidates = (rows ?? []).filter((row) => {
    const amount = resolveSupplierDeliveryPayableAmount({
      quantity: Number(row.quantity),
      pricePerUnit:
        row.price_per_unit == null ? null : Number(row.price_per_unit),
      actualPaid: row.actual_paid == null ? null : Number(row.actual_paid),
    });
    return amount > 0;
  });

  if (!candidates.length) {
    return {
      scanned: 0,
      linkedExisting: 0,
      created: 0,
      failed: 0,
      failures: [],
    };
  }

  let keepinRefs: { purseId: number; categoryId: number } | null = null;
  try {
    keepinRefs = await resolveKeepinSupplierExpenseRefs();
  } catch (refsError) {
    console.error("[reconcile supplier expenses] refs:", refsError);
  }

  const payments = await fetchKeepinPaymentsSince(
    sinceYmd,
    CRON_RECONCILE_MAX_PAGES
  );
  const paymentIdByDeliveryId = new Map<number, number>();
  for (const payment of payments) {
    const deliveryId = parseSupplierDeliveryIdFromExpenseComment(payment.comment);
    if (deliveryId == null) continue;
    if (!paymentIdByDeliveryId.has(deliveryId)) {
      paymentIdByDeliveryId.set(deliveryId, payment.id);
    }
  }

  let linkedExisting = 0;
  let created = 0;
  const failures: string[] = [];

  for (const row of candidates) {
    const deliveryId = Number(row.id);
    const amount = resolveSupplierDeliveryPayableAmount({
      quantity: Number(row.quantity),
      pricePerUnit:
        row.price_per_unit == null ? null : Number(row.price_per_unit),
      actualPaid: row.actual_paid == null ? null : Number(row.actual_paid),
    });
    const atYmd = String(row.created_at ?? "").slice(0, 10) || sinceYmd;
    const existingPaymentId = paymentIdByDeliveryId.get(deliveryId);

    try {
      let paymentId = existingPaymentId ?? null;
      let didCreate = false;

      if (paymentId == null) {
        paymentId = await syncSupplierDeliveryExpenseToKeepin({
          deliveryId,
          amount,
          atYmd,
          supplierName: relationName(
            row.supplier as { name?: string } | { name?: string }[] | null
          ),
          productName: relationName(
            row.product as { name?: string } | { name?: string }[] | null
          ),
          quantity: Number(row.quantity),
          purseId: keepinRefs?.purseId,
          categoryId: keepinRefs?.categoryId,
        });
        didCreate = paymentId != null;
      }

      if (paymentId == null) {
        failures.push(`#${deliveryId}: sync вимкнено або сума ≤ 0`);
        continue;
      }

      const { error: linkError } = await supabase
        .from("supplier_deliveries")
        .update({ keepin_payment_id: paymentId })
        .eq("id", deliveryId)
        .is("keepin_payment_id", null);

      if (linkError) {
        failures.push(`#${deliveryId}: ${linkError.message}`);
        continue;
      }

      if (existingPaymentId != null) {
        linkedExisting += 1;
      } else if (didCreate) {
        created += 1;
      }
    } catch (syncError) {
      console.error(
        `[reconcile supplier expenses] #${deliveryId}:`,
        syncError
      );
      const detail =
        syncError instanceof Error ? syncError.message : "невідома помилка";
      failures.push(`#${deliveryId}: ${detail}`);
    }
  }

  await notifyReconcileFailures(failures);

  return {
    scanned: candidates.length,
    linkedExisting,
    created,
    failed: failures.length,
    failures,
  };
}
