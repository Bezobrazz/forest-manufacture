"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/server-auth";
import { syncKeepinOrdersWithSupabase } from "@/lib/crm/keepincrm/reconcile";
import {
  getKeepinSyncJob,
  startKeepinSyncJob,
  type KeepinSyncJobStatus,
} from "@/lib/crm/keepincrm/sync-job";
import type { CrmOrderWithDetails, Product } from "@/lib/types";
import { dateToYYYYMMDD } from "@/lib/utils";
import type { AvgDailyByProduct } from "@/lib/shipments/eta";

export async function getShipmentQueue(): Promise<CrmOrderWithDetails[]> {
  const supabase = await createServerClient();

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

  return (data ?? []) as CrmOrderWithDetails[];
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

  const seen = new Set<string>();
  for (const id of crmIdsInOrder) {
    const k = id.trim();
    if (!k) return { success: false, error: "Порожній ідентифікатор угоди" };
    if (seen.has(k)) return { success: false, error: "Дублікат у списку" };
    seen.add(k);
  }

  const supabase = await createServerClient();

  for (let i = 0; i < crmIdsInOrder.length; i++) {
    const crmId = crmIdsInOrder[i].trim();
    const { error } = await supabase
      .from("crm_orders")
      .update({ queue_rank: i })
      .eq("crm_id", crmId);
    if (error) {
      return { success: false, error: error.message };
    }
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
