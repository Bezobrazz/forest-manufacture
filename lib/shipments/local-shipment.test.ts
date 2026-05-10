import test from "node:test";
import assert from "node:assert";
import { dedupeShipmentQueueOrderIds, mergeShipmentQueueByGlobalRank } from "./local-shipment";
import type { CrmOrderWithDetails } from "@/lib/types";

const base = (rank: number, crmId: string, id: number): CrmOrderWithDetails => ({
  id,
  crm_id: crmId,
  customer_id: 1,
  crm_status: null,
  crm_created_at: "2026-01-01T00:00:00.000Z",
  queue_rank: rank,
  notes: null,
  synced_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  customer: {
    id: 1,
    crm_id: "c",
    name: "X",
    phone: null,
    email: null,
    synced_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  items: [],
});

test("dedupeShipmentQueueOrderIds keeps order and skips duplicates", () => {
  const a = dedupeShipmentQueueOrderIds(["a", " local:1 ", "a", "b"]);
  assert.deepStrictEqual(a, ["a", "local:1", "b"]);
});

test("mergeShipmentQueueByGlobalRank sorts by global queue_rank", () => {
  const local = [base(2, "local:1", -1)];
  const crm = [base(0, "k1", 1), base(1, "k2", 2)];
  const merged = mergeShipmentQueueByGlobalRank(local, crm);
  assert.deepStrictEqual(
    merged.map((o) => o.crm_id),
    ["k1", "k2", "local:1"]
  );
});
