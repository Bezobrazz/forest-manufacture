"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/server-auth";
import { syncKeepinOrdersWithSupabase, syncSingleKeepinAgreement } from "@/lib/crm/keepincrm/reconcile";
import { updateKeepinAgreementStage } from "@/lib/crm/keepincrm/client";
import {
  getKeepinSyncJob,
  startKeepinSyncJob,
  type KeepinSyncJobStatus,
} from "@/lib/crm/keepincrm/sync-job";
import type { CrmOrderWithDetails, Product } from "@/lib/types";
import { dateToYYYYMMDD } from "@/lib/utils";
import type { AvgDailyByProduct } from "@/lib/shipments/eta";
import {
  isLocalShipmentOrderCrmId,
  mapPlanningOrderRowToCrmShape,
  mergeShipmentQueueByGlobalRank,
  parseLocalShipmentOrderId,
  type ShipmentPlanningOrderDb,
} from "@/lib/shipments/local-shipment";

async function compactGlobalShipmentQueueRanks(
  supabase: SupabaseClient
): Promise<{ error?: string }> {
  const { data: plans, error: pErr } = await supabase
    .from("shipment_planning_orders")
    .select("id, queue_rank")
    .order("queue_rank", { ascending: true })
    .order("id", { ascending: true });
  if (pErr) return { error: pErr.message };

  const { data: crms, error: cErr } = await supabase
    .from("crm_orders")
    .select("crm_id, queue_rank")
    .order("queue_rank", { ascending: true })
    .order("crm_created_at", { ascending: true });
  if (cErr) return { error: cErr.message };

  type Entry = { rank: number; kind: "p" | "c"; planId: number; crmId: string | null };
  const entries: Entry[] = [];
  for (const p of plans ?? []) {
    entries.push({ kind: "p", rank: Number(p.queue_rank), planId: p.id, crmId: null });
  }
  for (const c of crms ?? []) {
    entries.push({ kind: "c", rank: Number(c.queue_rank), planId: 0, crmId: c.crm_id });
  }
  entries.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.kind !== b.kind) return a.kind === "p" ? -1 : 1;
    if (a.kind === "p") return a.planId - b.planId;
    return String(a.crmId).localeCompare(String(b.crmId));
  });

  const now = new Date().toISOString();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.kind === "p") {
      const { error } = await supabase
        .from("shipment_planning_orders")
        .update({ queue_rank: i, updated_at: now })
        .eq("id", e.planId);
      if (error) return { error: error.message };
    } else if (e.crmId) {
      const { error } = await supabase.from("crm_orders").update({ queue_rank: i }).eq("crm_id", e.crmId);
      if (error) return { error: error.message };
    }
  }
  return {};
}

function getPostShipmentStageId(): number {
  const raw = process.env.KEEPINCRM_POST_SHIPMENT_STAGE_ID?.trim();
  if (!raw) return 6;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 6;
}

type AppliedShipmentStep = {
  productId: number;
  previousInventoryQty: number;
  transactionId: number;
};

async function getMainWarehouseId(supabase: SupabaseClient): Promise<number | null> {
  const { data } = await supabase
    .from("warehouses")
    .select("id")
    .ilike("name", "%main%")
    .limit(1)
    .maybeSingle();
  return typeof data?.id === "number" ? data.id : null;
}

async function deductInventoryForQueueShipment(
  supabase: SupabaseClient,
  args: {
    productId: number;
    quantity: number;
    notes: string;
    warehouseId: number | null;
  }
): Promise<{ ok: true; step: AppliedShipmentStep } | { ok: false; error: string }> {
  const { productId, quantity, notes, warehouseId } = args;
  const { data: currentRow, error: gErr } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("product_id", productId)
    .maybeSingle();
  if (gErr) return { ok: false, error: gErr.message };

  const currentQuantity = Number(currentRow?.quantity ?? 0);
  if (currentQuantity < quantity) {
    return {
      ok: false,
      error: `Недостатньо на складі. Потрібно ${quantity}, доступно ${currentQuantity}`,
    };
  }

  const previousInventoryQty = currentQuantity;
  const newQty = currentQuantity - quantity;
  const { error: uErr } = await supabase
    .from("inventory")
    .update({
      quantity: newQty,
      updated_at: new Date().toISOString(),
    })
    .eq("product_id", productId);

  if (uErr) return { ok: false, error: uErr.message };

  const txPayload: Record<string, unknown> = {
    product_id: productId,
    quantity: -quantity,
    transaction_type: "shipment",
    notes,
  };
  if (warehouseId != null) {
    txPayload.warehouse_id = warehouseId;
  }

  const { data: txRow, error: txErr } = await supabase
    .from("inventory_transactions")
    .insert(txPayload)
    .select("id")
    .single();

  if (txErr || txRow?.id == null) {
    await supabase
      .from("inventory")
      .update({ quantity: previousInventoryQty, updated_at: new Date().toISOString() })
      .eq("product_id", productId);
    return { ok: false, error: txErr?.message ?? "Не вдалося записати операцію" };
  }

  return {
    ok: true,
    step: {
      productId,
      previousInventoryQty,
      transactionId: Number(txRow.id),
    },
  };
}

async function rollbackAppliedShipmentSteps(
  supabase: SupabaseClient,
  steps: AppliedShipmentStep[]
): Promise<void> {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    await supabase.from("inventory_transactions").delete().eq("id", s.transactionId);
    await supabase
      .from("inventory")
      .update({
        quantity: s.previousInventoryQty,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", s.productId);
  }
}

export type QueueFulfillmentLine = { itemId: number; quantity: number };

export async function fulfillQueueShipmentAction(
  orderCrmId: string,
  lines: QueueFulfillmentLine[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user) return { success: false, error: "Потрібна авторизація" };

  const crmKey = orderCrmId.trim();
  if (!crmKey) return { success: false, error: "Не вказано угоду" };

  const supabase = await createServerClient();
  const warehouseId = await getMainWarehouseId(supabase);

  const filtered = lines
    .map((l) => ({
      itemId: Math.trunc(Number(l.itemId)),
      quantity: Number(l.quantity),
    }))
    .filter((l) => Number.isFinite(l.itemId) && l.itemId > 0 && Number.isFinite(l.quantity) && l.quantity > 0);

  if (filtered.length === 0) {
    return { success: false, error: "Вкажіть кількість хоча б для однієї позиції" };
  }

  const applied: AppliedShipmentStep[] = [];

  try {
    if (isLocalShipmentOrderCrmId(crmKey)) {
      const planId = parseLocalShipmentOrderId(crmKey);
      if (planId == null) return { success: false, error: "Некоректна локальна картка" };

      const { data: orderRow, error: oErr } = await supabase
        .from("shipment_planning_orders")
        .select("id, title")
        .eq("id", planId)
        .maybeSingle();
      if (oErr || !orderRow) {
        return { success: false, error: oErr?.message ?? "Локальну картку не знайдено" };
      }

      const customerLabel = String(orderRow.title ?? "Локальна картка");

      for (const line of filtered) {
        const { data: itemRow, error: iErr } = await supabase
          .from("shipment_planning_order_items")
          .select("id, order_id, product_id, quantity")
          .eq("id", line.itemId)
          .maybeSingle();
        if (iErr || !itemRow) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: iErr?.message ?? "Позицію не знайдено" };
        }
        if (Number(itemRow.order_id) !== planId) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: "Позиція не належить цій картці" };
        }
        const pid = itemRow.product_id != null ? Number(itemRow.product_id) : null;
        if (pid == null || pid <= 0) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: "Позиція без прив’язки до товару" };
        }
        const maxLine = Number(itemRow.quantity);
        if (line.quantity > maxLine) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: `Кількість більша за замовлення (макс. ${maxLine})` };
        }

        const notes = `Відвантаження черги: ${customerLabel} (локальна картка #${planId})`;
        const res = await deductInventoryForQueueShipment(supabase, {
          productId: pid,
          quantity: line.quantity,
          notes,
          warehouseId,
        });
        if (!res.ok) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: res.error };
        }
        applied.push(res.step);
      }
    } else {
      const { data: ord, error: ordErr } = await supabase
        .from("crm_orders")
        .select("id, crm_id, customer_id")
        .eq("crm_id", crmKey)
        .maybeSingle();

      if (ordErr || !ord) {
        return { success: false, error: ordErr?.message ?? "Угоду не знайдено в базі" };
      }

      const orderId = Number(ord.id);
      const { data: custRow } = await supabase
        .from("crm_customers")
        .select("name")
        .eq("id", ord.customer_id)
        .maybeSingle();
      const customerName = typeof custRow?.name === "string" ? custRow.name : "";

      for (const line of filtered) {
        const { data: itemRow, error: iErr } = await supabase
          .from("crm_order_items")
          .select("id, order_id, product_id, quantity")
          .eq("id", line.itemId)
          .maybeSingle();
        if (iErr || !itemRow) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: iErr?.message ?? "Позицію не знайдено" };
        }
        if (Number(itemRow.order_id) !== orderId) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: "Позиція не належить цій угоді" };
        }
        const pid = itemRow.product_id != null ? Number(itemRow.product_id) : null;
        if (pid == null || pid <= 0) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: "Потрібен мапінг товару CRM перед відвантаженням" };
        }
        const maxLine = Number(itemRow.quantity);
        if (line.quantity > maxLine) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: `Кількість більша за в угоді (макс. ${maxLine})` };
        }

        const notes = `Відвантаження черги: ${customerName || "клієнт"}, угода ${crmKey}`;
        const res = await deductInventoryForQueueShipment(supabase, {
          productId: pid,
          quantity: line.quantity,
          notes,
          warehouseId,
        });
        if (!res.ok) {
          await rollbackAppliedShipmentSteps(supabase, applied);
          return { success: false, error: res.error };
        }
        applied.push(res.step);
      }

      const stageId = getPostShipmentStageId();
      try {
        await updateKeepinAgreementStage(crmKey, stageId);
      } catch (e) {
        await rollbackAppliedShipmentSteps(supabase, applied);
        const msg = e instanceof Error ? e.message : "Помилка KeepinCRM";
        return { success: false, error: msg };
      }

      try {
        await syncSingleKeepinAgreement(supabase, crmKey);
      } catch (syncErr) {
        console.error("fulfillQueueShipmentAction syncSingleKeepinAgreement:", syncErr);
      }
    }

    revalidatePath("/shipments");
    revalidatePath("/inventory");
    return { success: true };
  } catch (e) {
    await rollbackAppliedShipmentSteps(supabase, applied);
    const msg = e instanceof Error ? e.message : "Помилка відвантаження";
    return { success: false, error: msg };
  }
}

export async function getShipmentQueue(): Promise<CrmOrderWithDetails[]> {
  const supabase = await createServerClient();

  const { data: planningRows, error: planningErr } = await supabase
    .from("shipment_planning_orders")
    .select(
      `
      *,
      items:shipment_planning_order_items(
        *,
        product:products(
          *,
          category:product_categories(*)
        )
      )
    `
    )
    .order("queue_rank", { ascending: true })
    .order("id", { ascending: true });

  if (planningErr) {
    console.error("getShipmentQueue planning:", planningErr);
  }

  const { data, error } = await supabase
    .from("crm_orders")
    .select(
      `
      *,
      customer:crm_customers(*),
      items:crm_order_items(
        *,
        product:products(
          *,
          category:product_categories(*)
        )
      )
    `
    )
    .order("queue_rank", { ascending: true })
    .order("crm_created_at", { ascending: true });

  if (error) {
    console.error("getShipmentQueue:", error);
    return [];
  }

  const localOrders = (planningRows ?? []).map((row) =>
    mapPlanningOrderRowToCrmShape(row as ShipmentPlanningOrderDb)
  );
  const crmOrders = (data ?? []) as CrmOrderWithDetails[];

  return mergeShipmentQueueByGlobalRank(localOrders, crmOrders);
}

export async function getAvgDailyProductionByProduct(
  daysBack: number = 30
): Promise<AvgDailyByProduct> {
  const supabase = await createServerClient();

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);

  const startStr = dateToYYYYMMDD(start);
  const endStr = dateToYYYYMMDD(end);

  const { data: shifts, error: shiftErr } = await supabase
    .from("shifts")
    .select("id")
    .eq("status", "completed")
    .gte("shift_date", startStr)
    .lte("shift_date", endStr);

  if (shiftErr || !shifts?.length) {
    if (shiftErr) console.error("getAvgDailyProductionByProduct shifts:", shiftErr);
    return {};
  }

  const shiftIds = shifts.map((s) => s.id);

  const { data: rows, error: prodErr } = await supabase
    .from("production")
    .select("product_id, quantity")
    .in("shift_id", shiftIds);

  if (prodErr || !rows) {
    if (prodErr) console.error("getAvgDailyProductionByProduct production:", prodErr);
    return {};
  }

  const sumByProduct: Record<number, number> = {};
  for (const row of rows) {
    const pid = row.product_id;
    if (pid == null) continue;
    const q = Number(row.quantity);
    if (!Number.isFinite(q)) continue;
    sumByProduct[pid] = (sumByProduct[pid] ?? 0) + q;
  }

  const divisor = Math.max(daysBack, 1);
  const avg: AvgDailyByProduct = {};
  for (const [k, total] of Object.entries(sumByProduct)) {
    avg[Number(k)] = total / divisor;
  }

  return avg;
}

/** Ручна синхронізація з авторизованого сеансу. */
export async function reconcileCrmOrdersAction(): Promise<{
  success: boolean;
  error?: string;
  upserted?: number;
  removed?: number;
}> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Потрібна авторизація" };
  }

  try {
    const supabase = await createServerClient();
    const { upserted, removed } = await syncKeepinOrdersWithSupabase(supabase);
    revalidatePath("/shipments");
    return { success: true, upserted, removed };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Не вдалося синхронізувати";
    console.error("reconcileCrmOrdersAction", e);
    return { success: false, error: msg };
  }
}

export async function startKeepinSyncJobAction(): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Потрібна авторизація" };
  }
  const job = startKeepinSyncJob();
  return { success: true, jobId: job.id };
}

export async function getKeepinSyncJobStatusAction(
  jobId: string
): Promise<{ success: boolean; status?: KeepinSyncJobStatus; error?: string }> {
  const user = await getServerUser();
  if (!user) {
    return { success: false, error: "Потрібна авторизація" };
  }
  const status = getKeepinSyncJob(jobId);
  if (!status) {
    return { success: false, error: "Job not found" };
  }
  if (status.status === "done") {
    revalidatePath("/shipments");
  }
  return { success: true, status };
}

export async function getCrmUnmappedProductsAction(): Promise<
  { crm_product_ref: string; count: number }[]
> {
  const supabase = await createServerClient();

  const { data: rows, error } = await supabase
    .from("crm_order_items")
    .select("crm_product_ref, product_id");
  if (error || !rows) return [];

  const { data: mappings } = await supabase
    .from("crm_product_mappings")
    .select("crm_product_ref, product_id");

  const mappedRefs = new Set(
    (mappings ?? [])
      .filter((m) => m.product_id != null)
      .map((m) => String(m.crm_product_ref).trim().toLowerCase())
  );

  const counts = new Map<string, { crm_product_ref: string; count: number }>();
  for (const row of rows) {
    const ref =
      typeof row.crm_product_ref === "string" ? row.crm_product_ref.trim() : "";
    if (!ref) continue;
    const refKey = ref.toLowerCase();
    if (row.product_id != null) continue;
    if (mappedRefs.has(refKey)) continue;
    const old = counts.get(refKey);
    if (old) old.count += 1;
    else counts.set(refKey, { crm_product_ref: ref, count: 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export async function getShipmentProductsAction(): Promise<
  Pick<Product, "id" | "name" | "description">[]
> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description")
    .order("name");
  if (error || !data) return [];
  return data as Pick<Product, "id" | "name" | "description">[];
}

export async function reorderShipmentQueueAction(
  crmIdsInOrder: string[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user) return { success: false, error: "Потрібна авторизація" };

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const raw of crmIdsInOrder) {
    const k = raw.trim();
    if (!k) return { success: false, error: "Порожній ідентифікатор угоди" };
    if (seen.has(k)) return { success: false, error: "Дублікат у списку" };
    seen.add(k);
    ordered.push(k);
  }

  const supabase = await createServerClient();

  const now = new Date().toISOString();
  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i].trim();
    const localNumeric = parseLocalShipmentOrderId(id);
    if (localNumeric != null) {
      const { error } = await supabase
        .from("shipment_planning_orders")
        .update({ queue_rank: i, updated_at: now })
        .eq("id", localNumeric);
      if (error) {
        return { success: false, error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("crm_orders")
        .update({ queue_rank: i })
        .eq("crm_id", id);
      if (error) {
        return { success: false, error: error.message };
      }
    }
  }

  revalidatePath("/shipments");
  return { success: true };
}

export async function createLocalShipmentCardAction(
  title: string,
  lines: { product_id: number; quantity: number }[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user) return { success: false, error: "Потрібна авторизація" };

  const name = title.trim();
  if (!name) {
    return { success: false, error: "Вкажіть назву картки" };
  }

  const cleanLines = lines
    .map((l) => ({
      product_id: l.product_id,
      quantity: Number(l.quantity),
    }))
    .filter((l) => Number.isFinite(l.product_id) && l.product_id > 0 && Number.isFinite(l.quantity) && l.quantity > 0);

  if (cleanLines.length === 0) {
    return { success: false, error: "Додайте хоча б одну позицію з кількістю" };
  }

  const supabase = await createServerClient();

  const nowTs = new Date().toISOString();

  const { data: planBump, error: planBumpErr } = await supabase
    .from("shipment_planning_orders")
    .select("id, queue_rank")
    .order("queue_rank", { ascending: false });

  if (planBumpErr) {
    return { success: false, error: planBumpErr.message };
  }

  for (const row of planBump ?? []) {
    const { error: bumpErr } = await supabase
      .from("shipment_planning_orders")
      .update({ queue_rank: row.queue_rank + 1, updated_at: nowTs })
      .eq("id", row.id);
    if (bumpErr) {
      return { success: false, error: bumpErr.message };
    }
  }

  const { data: crmBump, error: crmBumpErr } = await supabase
    .from("crm_orders")
    .select("crm_id, queue_rank")
    .order("queue_rank", { ascending: false });

  if (crmBumpErr) {
    return { success: false, error: crmBumpErr.message };
  }

  for (const row of crmBump ?? []) {
    const { error: bumpErr } = await supabase
      .from("crm_orders")
      .update({ queue_rank: row.queue_rank + 1 })
      .eq("crm_id", row.crm_id);
    if (bumpErr) {
      return { success: false, error: bumpErr.message };
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("shipment_planning_orders")
    .insert({ title: name, queue_rank: 0, updated_at: nowTs })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    return { success: false, error: insErr?.message ?? "Не вдалося створити картку" };
  }

  const orderId = Number(inserted.id);
  const itemRows = cleanLines.map((l) => ({
    order_id: orderId,
    product_id: l.product_id,
    quantity: l.quantity,
  }));

  const { error: itemsErr } = await supabase.from("shipment_planning_order_items").insert(itemRows);
  if (itemsErr) {
    await supabase.from("shipment_planning_orders").delete().eq("id", orderId);
    return { success: false, error: itemsErr.message };
  }

  revalidatePath("/shipments");
  return { success: true };
}

export async function deleteLocalShipmentCardAction(planningOrderId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getServerUser();
  if (!user) return { success: false, error: "Потрібна авторизація" };

  if (!Number.isFinite(planningOrderId) || planningOrderId <= 0) {
    return { success: false, error: "Некоректний ідентифікатор" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("shipment_planning_orders").delete().eq("id", planningOrderId);

  if (error) {
    return { success: false, error: error.message };
  }

  const compactRes = await compactGlobalShipmentQueueRanks(supabase);
  if (compactRes.error) {
    return { success: false, error: compactRes.error };
  }

  revalidatePath("/shipments");
  return { success: true };
}

export async function saveCrmProductMappingAction(
  crmProductRef: string,
  productId: number
): Promise<{ success: boolean; error?: string }> {
  const user = await getServerUser();
  if (!user) return { success: false, error: "Потрібна авторизація" };

  const ref = crmProductRef.trim();
  if (!ref || !Number.isFinite(productId) || productId <= 0) {
    return { success: false, error: "Некоректні дані мапінгу" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("crm_product_mappings").upsert(
    {
      crm_product_ref: ref,
      product_id: productId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "crm_product_ref" }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/shipments");
  return { success: true };
}
