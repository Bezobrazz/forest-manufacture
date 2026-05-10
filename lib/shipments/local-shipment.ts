import type { CrmCustomer, CrmOrder, CrmOrderItem, CrmOrderWithDetails, Product } from "@/lib/types";

/** Префікс crm_id для локальних карток (не з KeepinCRM). */
export const LOCAL_SHIPMENT_CRM_PREFIX = "local:";

export function isLocalShipmentOrderCrmId(crmId: string): boolean {
  return crmId.startsWith(LOCAL_SHIPMENT_CRM_PREFIX);
}

export function parseLocalShipmentOrderId(crmId: string): number | null {
  if (!isLocalShipmentOrderCrmId(crmId)) return null;
  const n = Number(crmId.slice(LOCAL_SHIPMENT_CRM_PREFIX.length));
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

type PlanningItemRow = CrmOrderItem & {
  product?: Product | null;
};

export type ShipmentPlanningOrderDb = {
  id: number;
  title: string;
  queue_rank: number;
  created_at: string;
  updated_at: string;
  items: PlanningItemRow[];
};

/** Прибирає дублікати й порожні id; порядок як після drag-and-drop. */
export function dedupeShipmentQueueOrderIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const k = raw.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Об’єднує дві черги за єдиним глобальним queue_rank (менше = вище пріоритет). */
export function mergeShipmentQueueByGlobalRank(
  localOrders: CrmOrderWithDetails[],
  crmOrders: CrmOrderWithDetails[]
): CrmOrderWithDetails[] {
  const combined = [
    ...localOrders.map((order) => ({ rank: order.queue_rank, order })),
    ...crmOrders.map((order) => ({ rank: order.queue_rank, order })),
  ];
  combined.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.order.id !== b.order.id) return a.order.id - b.order.id;
    return a.order.crm_id.localeCompare(b.order.crm_id);
  });
  return combined.map((x) => x.order);
}

export function mapPlanningOrderRowToCrmShape(row: ShipmentPlanningOrderDb): CrmOrderWithDetails {
  const crmId = `${LOCAL_SHIPMENT_CRM_PREFIX}${row.id}`;
  const syntheticId = -Math.abs(row.id);
  const now = new Date().toISOString();
  const cust: CrmCustomer = {
    id: syntheticId,
    crm_id: `${LOCAL_SHIPMENT_CRM_PREFIX}cust:${row.id}`,
    name: row.title,
    phone: null,
    email: null,
    synced_at: row.updated_at ?? now,
    created_at: row.created_at,
  };

  const items: CrmOrderItem[] = (row.items ?? []).map((it) => ({
    id: it.id,
    order_id: syntheticId,
    product_id: it.product_id,
    crm_product_ref: it.product?.name ?? null,
    quantity: it.quantity,
    created_at: it.created_at,
    product: it.product ?? undefined,
  }));

  const order: CrmOrder = {
    id: syntheticId,
    crm_id: crmId,
    customer_id: syntheticId,
    crm_status: null,
    crm_created_at: row.created_at,
    queue_rank: row.queue_rank,
    notes: null,
    synced_at: row.updated_at ?? now,
    created_at: row.created_at,
  };

  return { ...order, customer: cust, items };
}
