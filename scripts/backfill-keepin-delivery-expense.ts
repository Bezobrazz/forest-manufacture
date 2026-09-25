/**
 * One-off: sync missing Keepin expense for a supplier_delivery.
 *
 *   npx tsx scripts/backfill-keepin-delivery-expense.ts 181
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { syncSupplierDeliveryExpenseToKeepin } from "../lib/crm/keepincrm/sync-supplier-delivery-expense";
import { resolveSupplierDeliveryPayableAmount } from "../lib/suppliers/delivery-payable-amount";

function loadEnvLocal(): void {
  for (const file of [".env.local", ".env"]) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

function relationName(
  value: { name?: string } | { name?: string }[] | null | undefined
): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name?.trim() ?? "";
  return value.name?.trim() ?? "";
}

async function main() {
  loadEnvLocal();

  const deliveryId = Number(process.argv[2]);
  if (!Number.isFinite(deliveryId) || deliveryId <= 0) {
    console.error("Usage: npx tsx scripts/backfill-keepin-delivery-expense.ts <deliveryId>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: delivery, error } = await supabase
    .from("supplier_deliveries")
    .select(
      `
      id, quantity, price_per_unit, actual_paid, keepin_payment_id, created_at,
      supplier:suppliers(name),
      product:products!supplier_deliveries_product_id_fkey(name)
    `
    )
    .eq("id", deliveryId)
    .single();

  if (error || !delivery) {
    console.error("Delivery not found:", error?.message);
    process.exit(1);
  }

  if (delivery.keepin_payment_id) {
    console.log(`Already synced: keepin_payment_id=${delivery.keepin_payment_id}`);
    return;
  }

  const amount = resolveSupplierDeliveryPayableAmount({
    quantity: Number(delivery.quantity),
    pricePerUnit:
      delivery.price_per_unit == null ? null : Number(delivery.price_per_unit),
    actualPaid:
      delivery.actual_paid == null ? null : Number(delivery.actual_paid),
  });
  const day = String(delivery.created_at).slice(0, 10);
  const supplierName = relationName(
    delivery.supplier as { name?: string } | { name?: string }[] | null
  );
  const productName = relationName(
    delivery.product as { name?: string } | { name?: string }[] | null
  );

  console.log({
    deliveryId: delivery.id,
    amount,
    day,
    supplierName,
    productName,
  });

  const paymentId = await syncSupplierDeliveryExpenseToKeepin({
    deliveryId: delivery.id,
    amount,
    atYmd: day,
    supplierName,
    productName,
    quantity: Number(delivery.quantity),
  });

  if (paymentId == null) {
    console.error("Sync returned null (disabled or amount ≤ 0)");
    process.exit(1);
  }

  const { error: updErr } = await supabase
    .from("supplier_deliveries")
    .update({ keepin_payment_id: paymentId })
    .eq("id", delivery.id);

  if (updErr) {
    console.error("Failed to link payment id:", updErr.message);
    process.exit(1);
  }

  console.log(`Synced and linked keepin_payment_id=${paymentId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
