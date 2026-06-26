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
import { allocateQueueRankForNewCrmOrder, bumpShipmentQueueRanksFrom } from "@/lib/shipments/queue-priority";

async function loadProductLookup(
  supabase: SupabaseClient
): Promise<{ exact: Map<string, number>; rows: { id: number; name: string; description: string | null }[] }> {
  const exact = new Map<string, number>();
  const rows: { id: number; name: string; description: string | null }[] = [];
  const { data, error } = await supabase.from("products").select("id, name, description");

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    if (row?.id != null && typeof row.name === "string") {
      const parsed = {
        id: Number(row.id),
        name: row.name,
        description: typeof row.description === "string" ? row.description : null,
      };
      rows.push(parsed);
      exact.set(normalizeProductKey(row.name), parsed.id);
    }
  }
  return { exact, rows };
}

async function loadCrmMappings(
  supabase: SupabaseClient
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase
    .from("crm_product_mappings")
    .select("crm_product_ref, product_id")
    .not("product_id", "is", null);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const refRaw = row?.crm_product_ref;
    const pid = row?.product_id;
    if (typeof refRaw === "string" && pid != null) {
      map.set(normalizeProductKey(refRaw), Number(pid));
    }
  }

  return map;
}

function resolveProductId(
  title: string,
  sku: string | null,
  products: { exact: Map<string, number>; rows: { id: number; name: string; description: string | null }[] },
  crmMappings: Map<string, number>
): number | null {
  const key = normalizeProductKey(title);
  const mapped = crmMappings.get(key);
  if (mapped != null) return mapped;

  const exactHit = products.exact.get(key);
  if (exactHit != null) return exactHit;

  if (sku) {
    const skuKey = sku.trim().toLowerCase();
    const bySku = products.rows.find((p) =>
      `${p.name} ${p.description ?? ""}`.toLowerCase().includes(skuKey)
    );
    if (bySku) return bySku.id;
  }

  const byContains = products.rows.find((p) => {
    const pn = normalizeProductKey(p.name);
    return pn.includes(key) || key.includes(pn);
  });

  return byContains?.id ?? null;
}

async function upsertParsedAgreement(
  supabase: SupabaseClient,
  parsed: ParsedKeepinAgreement,
  products: { exact: Map<string, number>; rows: { id: number; name: string; description: string | null }[] },
  crmMappings: Map<string, number>,
  forcedQueueRank?: number
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

  const { data: existingOrder } = await supabase
    .from("crm_orders")
    .select("queue_rank")
    .eq("crm_id", parsed.crm_id)
    .maybeSingle();

  let queue_rank = existingOrder?.queue_rank;
  if (forcedQueueRank != null && Number.isFinite(forcedQueueRank)) {
    queue_rank = Math.max(0, Math.trunc(forcedQueueRank));
  } else if (typeof queue_rank !== "number" || !Number.isFinite(queue_rank)) {
    const allocated = await allocateQueueRankForNewCrmOrder(supabase, parsed.crm_created_at_iso);
    if (allocated.error) {
      throw new Error(allocated.error);
    }
    queue_rank = allocated.rank;
  }

  const { data: ordRow, error: ordErr } = await supabase
    .from("crm_orders")
    .upsert(
      {
        crm_id: parsed.crm_id,
        customer_id: customerId,
        crm_status: parsed.crm_status,
        crm_created_at: parsed.crm_created_at_iso,
        queue_rank,
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
      const product_id = resolveProductId(line.title, line.sku, products, crmMappings);
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

/** Повертає CRM-угоду в локальну чергу без зміни етапу в KeepinCRM. */
export async function restoreCrmAgreementToQueueAtRank(
  supabase: SupabaseClient,
  crmId: string,
  queueRank: number | null
): Promise<{ error?: string }> {
  const key = crmId.trim();
  if (!key) return { error: "Некоректний ідентифікатор угоди" };

  const { data: existing } = await supabase
    .from("crm_orders")
    .select("crm_id, queue_rank")
    .eq("crm_id", key)
    .maybeSingle();

  if (existing) {
    if (queueRank == null) return {};
    const targetRank = Math.max(0, Math.trunc(queueRank));
    const currentRank = Number(existing.queue_rank);
    if (currentRank === targetRank) return {};
    const bump = await bumpShipmentQueueRanksFrom(supabase, targetRank);
    if (bump.error) return { error: bump.error };
    const { error } = await supabase
      .from("crm_orders")
      .update({ queue_rank: targetRank })
      .eq("crm_id", key);
    if (error) return { error: error.message };
    return {};
  }

  const raw = await fetchKeepinAgreementRaw(key);
  if (!raw) return { error: "Угоду не знайдено в CRM" };
  const parsed = parseKeepinAgreement(raw);
  if (!parsed) return { error: "Не вдалося розібрати угоду з CRM" };

  let targetRank = queueRank;
  if (targetRank == null) {
    const allocated = await allocateQueueRankForNewCrmOrder(supabase, parsed.crm_created_at_iso);
    if (allocated.error) return { error: allocated.error };
    targetRank = allocated.rank;
  } else {
    targetRank = Math.max(0, Math.trunc(targetRank));
    const bump = await bumpShipmentQueueRanksFrom(supabase, targetRank);
    if (bump.error) return { error: bump.error };
  }

  try {
    const products = await loadProductLookup(supabase);
    const crmMappings = await loadCrmMappings(supabase);
    await upsertParsedAgreement(supabase, parsed, products, crmMappings, targetRank);
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не вдалося відновити угоду в черзі";
    return { error: msg };
  }
}

export async function syncKeepinOrdersWithSupabase(
  supabase: SupabaseClient,
  onProgress?: (progress: { total: number; processed: number }) => void
): Promise<{ upserted: number; removed: number }> {
  const rows = await fetchAllKeepinAgreements();
  const products = await loadProductLookup(supabase);
  const crmMappings = await loadCrmMappings(supabase);
  const seen = new Set<string>();
  const parsedRows = rows
    .map((row) => parseKeepinAgreement(row))
    .filter((p): p is ParsedKeepinAgreement => Boolean(p))
    .filter((p) => isAgreementInActiveStages(p));

  const total = parsedRows.length;
  let processed = 0;
  onProgress?.({ total, processed });

  let upserted = 0;
  for (const parsed of parsedRows) {
    seen.add(parsed.crm_id);
    await upsertParsedAgreement(supabase, parsed, products, crmMappings);
    upserted += 1;
    processed += 1;
    onProgress?.({ total, processed });
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
  const products = await loadProductLookup(supabase);
  const crmMappings = await loadCrmMappings(supabase);
  await upsertParsedAgreement(supabase, parsed, products, crmMappings);
  return "upserted";
}
