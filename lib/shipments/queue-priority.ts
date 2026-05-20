import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isLocalShipmentOrderCrmId,
  mergeShipmentQueueByGlobalRank,
  mapPlanningOrderRowToCrmShape,
  parseQueueCreatedAtMs,
  type ShipmentPlanningOrderDb,
} from "@/lib/shipments/local-shipment";
import type { CrmOrderWithDetails } from "@/lib/types";

export type ShipmentQueueSnapshotRow = {
  crm_id: string;
  crm_created_at: string;
  queue_rank: number;
};

export function toShipmentQueueSnapshot(order: CrmOrderWithDetails): ShipmentQueueSnapshotRow {
  return {
    crm_id: order.crm_id,
    crm_created_at: order.crm_created_at,
    queue_rank: order.queue_rank,
  };
}

/**
 * Індекс у поточній черзі (за queue_rank), куди вставити нову CRM-угоду за датою створення.
 * Локальні картки, уже зміщені вниз перетягуванням, не зміщуються.
 */
export function findCrmQueueInsertIndex(
  mergedInQueueOrder: Pick<ShipmentQueueSnapshotRow, "crm_id" | "crm_created_at">[],
  crmCreatedAt: string
): number {
  const t = parseQueueCreatedAtMs(crmCreatedAt);
  for (let i = 0; i < mergedInQueueOrder.length; i++) {
    const o = mergedInQueueOrder[i];
    if (!isLocalShipmentOrderCrmId(o.crm_id) && parseQueueCreatedAtMs(o.crm_created_at) > t) {
      return i;
    }
  }
  return mergedInQueueOrder.length;
}

export async function fetchMergedShipmentQueueSnapshot(
  supabase: SupabaseClient
): Promise<ShipmentQueueSnapshotRow[]> {
  const { data: planningRows, error: planningErr } = await supabase
    .from("shipment_planning_orders")
    .select("id, title, queue_rank, created_at, updated_at")
    .order("queue_rank", { ascending: true })
    .order("id", { ascending: true });

  if (planningErr) {
    console.error("fetchMergedShipmentQueueSnapshot planning:", planningErr);
  }

  const { data: crmRows, error: crmErr } = await supabase
    .from("crm_orders")
    .select("crm_id, queue_rank, crm_created_at")
    .order("queue_rank", { ascending: true })
    .order("crm_created_at", { ascending: true });

  if (crmErr) {
    console.error("fetchMergedShipmentQueueSnapshot crm:", crmErr);
    return [];
  }

  const localOrders = (planningRows ?? []).map((row) =>
    mapPlanningOrderRowToCrmShape({
      ...(row as ShipmentPlanningOrderDb),
      title: (row as { title?: string }).title ?? "",
      items: [],
    })
  );
  const crmOrders = (crmRows ?? []).map((row) => ({
    id: 0,
    crm_id: String(row.crm_id),
    customer_id: 0,
    crm_status: null,
    crm_created_at: String(row.crm_created_at),
    queue_rank: Number(row.queue_rank),
    notes: null,
    synced_at: "",
    created_at: "",
    customer: {
      id: 0,
      crm_id: "",
      name: "",
      phone: null,
      email: null,
      synced_at: "",
      created_at: "",
    },
    items: [],
  })) as CrmOrderWithDetails[];

  return mergeShipmentQueueByGlobalRank(localOrders, crmOrders).map(toShipmentQueueSnapshot);
}

/** Зсуває queue_rank >= minRank на +1 (локальні та CRM). */
export async function bumpShipmentQueueRanksFrom(
  supabase: SupabaseClient,
  minRank: number
): Promise<{ error?: string }> {
  const now = new Date().toISOString();

  const { data: plans, error: pErr } = await supabase
    .from("shipment_planning_orders")
    .select("id, queue_rank")
    .gte("queue_rank", minRank)
    .order("queue_rank", { ascending: false });

  if (pErr) return { error: pErr.message };

  for (const row of plans ?? []) {
    const { error } = await supabase
      .from("shipment_planning_orders")
      .update({ queue_rank: Number(row.queue_rank) + 1, updated_at: now })
      .eq("id", row.id);
    if (error) return { error: error.message };
  }

  const { data: crms, error: cErr } = await supabase
    .from("crm_orders")
    .select("crm_id, queue_rank")
    .gte("queue_rank", minRank)
    .order("queue_rank", { ascending: false });

  if (cErr) return { error: cErr.message };

  for (const row of crms ?? []) {
    const { error } = await supabase
      .from("crm_orders")
      .update({ queue_rank: Number(row.queue_rank) + 1 })
      .eq("crm_id", row.crm_id);
    if (error) return { error: error.message };
  }

  return {};
}

export async function allocateQueueRankForNewCrmOrder(
  supabase: SupabaseClient,
  crmCreatedAt: string
): Promise<{ rank: number; error?: string }> {
  const merged = await fetchMergedShipmentQueueSnapshot(supabase);
  const rank = findCrmQueueInsertIndex(merged, crmCreatedAt);
  const bump = await bumpShipmentQueueRanksFrom(supabase, rank);
  if (bump.error) return { rank, error: bump.error };
  return { rank };
}

export async function allocateQueueRankForNewLocalCard(
  supabase: SupabaseClient
): Promise<{ error?: string }> {
  return bumpShipmentQueueRanksFrom(supabase, 0);
}
