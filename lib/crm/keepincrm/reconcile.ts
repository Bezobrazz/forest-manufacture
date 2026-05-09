import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAllKeepinAgreements,
  fetchKeepinAgreementRaw,
} from "@/lib/crm/keepincrm/client";
import {
  parseKeepinAgreement,
  normalizeProductKey,
  isAgreementInActiveStages,
  type ParsedKeepinAgreement,
} from "@/lib/crm/keepincrm/mapper";

async function loadProductLookup(
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase.from("products").select("id, name");

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    if (row?.id != null && typeof row.name === "string") {
      map.set(normalizeProductKey(row.name), Number(row.id));
    }
  }
  return map;
}

async function upsertParsedAgreement(
  supabase: SupabaseClient,
  parsed: ParsedKeepinAgreement,
  productByName: Map<string, number>
): Promise<void> {
  const now = new Date().toISOString();

  const { data: custRow, error: custErr } = await supabase
    .from("crm_customers")
    .upsert(
      {
        crm_id: parsed.customerCrmId,
        name: parsed.customerName,
        phone: parsed.customerPhone,
        email: parsed.customerEmail,
        synced_at: now,
      },
      { onConflict: "crm_id" }
    )
    .select("id")
    .single();

  if (custErr || !custRow) {
    throw new Error(custErr?.message ?? "crm_customers upsert failed");
  }

  const customerId = Number(custRow.id);

  const { data: ordRow, error: ordErr } = await supabase
    .from("crm_orders")
    .upsert(
      {
        crm_id: parsed.crm_id,
        customer_id: customerId,
        crm_status: parsed.crm_status,
        crm_created_at: parsed.crm_created_at_iso,
        notes: parsed.notes,
        synced_at: now,
      },
      { onConflict: "crm_id" }
    )
    .select("id")
    .single();

  if (ordErr || !ordRow) {
    throw new Error(ordErr?.message ?? "crm_orders upsert failed");
  }

  const orderId = Number(ordRow.id);

  await supabase.from("crm_order_items").delete().eq("order_id", orderId);

  const itemRows =
    parsed.lines?.map((line) => {
      const pk = normalizeProductKey(line.title);
      const product_id = productByName.get(pk) ?? null;
      const ref = line.sku
        ? `${line.title} (SKU ${line.sku})`
        : line.title;
      return {
        order_id: orderId,
        product_id,
        crm_product_ref: ref,
        quantity: line.quantity,
      };
    }) ?? [];

  if (itemRows.length > 0) {
    const { error: insErr } = await supabase.from("crm_order_items").insert(itemRows);
    if (insErr) throw new Error(insErr.message);
  }
}

export async function removeCrmOrderByCrmId(
  supabase: SupabaseClient,
  crmId: string
): Promise<void> {
  await supabase.from("crm_orders").delete().eq("crm_id", crmId);
}

export async function syncKeepinOrdersWithSupabase(
  supabase: SupabaseClient
): Promise<{ upserted: number; removed: number }> {
  const rows = await fetchAllKeepinAgreements();
  const productByName = await loadProductLookup(supabase);
  const seen = new Set<string>();

  let upserted = 0;
  for (const row of rows) {
    const parsed = parseKeepinAgreement(row);
    if (!parsed) continue;
    if (!isAgreementInActiveStages(parsed)) continue;
    seen.add(parsed.crm_id);
    await upsertParsedAgreement(supabase, parsed, productByName);
    upserted += 1;
  }

  const { data: existing, error: exErr } = await supabase
    .from("crm_orders")
    .select("crm_id");

  if (exErr) throw new Error(exErr.message);

  let removed = 0;
  for (const r of existing ?? []) {
    const cid = r?.crm_id != null ? String(r.crm_id) : "";
    if (!cid || seen.has(cid)) continue;
    await removeCrmOrderByCrmId(supabase, cid);
    removed += 1;
  }

  return { upserted, removed };
}

/** Одинична угода (webhook). Якщо не входить у дозволені етапи — видаляємо з БД. */
export async function syncSingleKeepinAgreement(
  supabase: SupabaseClient,
  crmId: string
): Promise<"upserted" | "removed" | "missing"> {
  const raw = await fetchKeepinAgreementRaw(crmId);
  if (!raw) {
    await removeCrmOrderByCrmId(supabase, crmId);
    return "missing";
  }
  const parsed = parseKeepinAgreement(raw);
  if (!parsed) {
    await removeCrmOrderByCrmId(supabase, crmId);
    return "missing";
  }
  if (!isAgreementInActiveStages(parsed)) {
    await removeCrmOrderByCrmId(supabase, crmId);
    return "removed";
  }
  const productByName = await loadProductLookup(supabase);
  await upsertParsedAgreement(supabase, parsed, productByName);
  return "upserted";
}
