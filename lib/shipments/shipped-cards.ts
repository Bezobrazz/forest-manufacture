export type ShipmentQueueNotesRef =
  | { kind: "crm"; crmId: string }
  | { kind: "local"; planningOrderId: number };

export type ShippedCardLine = {
  productId: number;
  productName: string;
  quantity: number;
  balanceAfter: number | null;
};

export type ShippedCardGroup = {
  notes: string;
  created_at: string;
  totalQuantity: number;
  rowsCount: number;
  lines: ShippedCardLine[];
  isPartial: boolean | null;
};

type RawShipmentTx = {
  id?: number;
  notes: string | null;
  created_at: string;
  quantity: number | string;
  product_id: number | null;
  balance_after?: number | string | null;
  product?: { name?: string | null } | null;
};

type LedgerRow = {
  id: number;
  product_id: number;
  quantity: number | string;
  created_at: string;
};

export type InventoryLedgerRow = LedgerRow;

const LEDGER_PAGE_SIZE = 1000;

/** Завантажує повний ledger по товарах з пагінацією (Supabase повертає max 1000 рядків). */
export async function loadAllInventoryLedgerRows(
  loadPage: (range: { from: number; to: number }) => Promise<LedgerRow[]>
): Promise<LedgerRow[]> {
  const all: LedgerRow[] = [];
  let from = 0;
  while (true) {
    const page = await loadPage({ from, to: from + LEDGER_PAGE_SIZE - 1 });
    if (!page.length) break;
    all.push(...page);
    if (page.length < LEDGER_PAGE_SIZE) break;
    from += LEDGER_PAGE_SIZE;
  }
  return all;
}

type OrderItemForPartial = {
  product_id: number | null;
  quantity: number | string;
};

const QUEUE_SHIPMENT_PREFIX = /^Відвантаження черги:\s*/i;

export function stripQueueShipmentNotesPrefix(notes: string): string {
  return notes.replace(QUEUE_SHIPMENT_PREFIX, "").trim();
}

export function parseShipmentQueueNotesRef(notes: string): ShipmentQueueNotesRef | null {
  const localMatch = notes.match(/\(локальна картка #(\d+)\)/i);
  if (localMatch) {
    const planningOrderId = Number(localMatch[1]);
    if (Number.isFinite(planningOrderId) && planningOrderId > 0) {
      return { kind: "local", planningOrderId: Math.trunc(planningOrderId) };
    }
  }

  const crmMatch = notes.match(/,\s*угода\s+(\S+)\s*$/i);
  if (crmMatch) {
    const crmId = crmMatch[1].trim();
    if (crmId) return { kind: "crm", crmId };
  }

  return null;
}

export function computeShipmentFulfillmentPartial(
  lines: ShippedCardLine[],
  orderItems: OrderItemForPartial[]
): boolean | null {
  if (orderItems.length === 0) return null;

  const shippedByProduct = new Map<number, number>();
  for (const line of lines) {
    shippedByProduct.set(
      line.productId,
      (shippedByProduct.get(line.productId) ?? 0) + line.quantity
    );
  }

  let hasComparableItem = false;
  for (const item of orderItems) {
    const pid = item.product_id != null ? Number(item.product_id) : null;
    if (pid == null || pid <= 0) continue;
    hasComparableItem = true;
    const ordered = Number(item.quantity);
    if (!Number.isFinite(ordered) || ordered <= 0) continue;
    const shipped = shippedByProduct.get(pid) ?? 0;
    if (shipped < ordered) return true;
  }

  if (!hasComparableItem) return null;
  return false;
}

/** Залишок після операції: зворотний прохід від поточного `inventory` (джерело правди для готової продукції). */
export function computeBalanceAfterByTransactionIdFromInventory(args: {
  currentInventoryByProduct: Record<number, number>;
  ledger: LedgerRow[];
}): Map<number, number> {
  const { currentInventoryByProduct, ledger } = args;
  const byProduct = new Map<number, LedgerRow[]>();
  for (const row of ledger) {
    const pid = Number(row.product_id);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const list = byProduct.get(pid) ?? [];
    list.push(row);
    byProduct.set(pid, list);
  }

  const result = new Map<number, number>();

  for (const [pid, txs] of byProduct) {
    const sorted = [...txs].sort((a, b) => {
      const t = Date.parse(b.created_at) - Date.parse(a.created_at);
      if (t !== 0) return t;
      return b.id - a.id;
    });

    let remaining = currentInventoryByProduct[pid] ?? 0;
    for (const tx of sorted) {
      result.set(tx.id, remaining);
      const q = Number(tx.quantity);
      if (Number.isFinite(q)) remaining -= q;
    }
  }

  return result;
}

export function enrichQueueShipmentRowsWithBalance(
  rows: RawShipmentTx[],
  balanceByTxId: Map<number, number>
): RawShipmentTx[] {
  return rows.map((row) => {
    if (row.balance_after != null && Number.isFinite(Number(row.balance_after))) {
      return row;
    }
    const id = row.id != null ? Number(row.id) : NaN;
    if (!Number.isFinite(id)) return row;
    const computed = balanceByTxId.get(id);
    if (computed == null) return row;
    return { ...row, balance_after: computed };
  });
}

function mergeLineIntoGroup(
  group: Omit<ShippedCardGroup, "isPartial">,
  row: RawShipmentTx
): void {
  const productId = row.product_id != null ? Number(row.product_id) : null;
  const qty = Math.abs(Number(row.quantity) || 0);
  const balanceRaw = row.balance_after;
  const balanceAfter =
    balanceRaw != null && Number.isFinite(Number(balanceRaw)) ? Number(balanceRaw) : null;
  const productName =
    typeof row.product?.name === "string" && row.product.name.trim()
      ? row.product.name.trim()
      : productId != null
        ? `Товар #${productId}`
        : "—";

  group.totalQuantity += qty;
  group.rowsCount += 1;

  if (productId != null && productId > 0) {
    const existing = group.lines.find((l) => l.productId === productId);
    if (existing) {
      existing.quantity += qty;
      if (balanceAfter != null) existing.balanceAfter = balanceAfter;
    } else {
      group.lines.push({
        productId,
        productName,
        quantity: qty,
        balanceAfter,
      });
    }
  }
}

export function groupQueueShipmentTransactions(rows: RawShipmentTx[]): Omit<ShippedCardGroup, "isPartial">[] {
  const grouped = new Map<string, Omit<ShippedCardGroup, "isPartial">>();

  for (const row of rows) {
    const notes =
      typeof row.notes === "string" ? row.notes.trim() : "Відвантаження черги";
    const createdAt =
      typeof row.created_at === "string" ? row.created_at : new Date().toISOString();
    const dayKey = createdAt.slice(0, 10);
    const key = `${dayKey}|${notes}`;

    let group = grouped.get(key);
    if (!group) {
      group = {
        notes,
        created_at: createdAt,
        totalQuantity: 0,
        rowsCount: 0,
        lines: [],
      };
      grouped.set(key, group);
    }

    mergeLineIntoGroup(group, row);
    if (Date.parse(createdAt) > Date.parse(group.created_at)) {
      group.created_at = createdAt;
    }
  }

  for (const group of grouped.values()) {
    group.lines.sort((a, b) => a.productName.localeCompare(b.productName, "uk"));
  }

  return [...grouped.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
