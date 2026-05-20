import test from "node:test";
import assert from "node:assert";
import {
  compareShipmentQueueDefault,
  dedupeShipmentQueueOrderIds,
  mergeShipmentQueueByGlobalRank,
} from "./local-shipment";
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

test("compareShipmentQueueDefault: locals before CRM, CRM by crm_created_at asc", () => {
  const local = { crm_id: "local:1", crm_created_at: "2026-05-01T00:00:00.000Z" };
  const crmOld = { crm_id: "k1", crm_created_at: "2026-01-01T00:00:00.000Z" };
  const crmNew = { crm_id: "k2", crm_created_at: "2026-03-01T00:00:00.000Z" };
  assert.ok(compareShipmentQueueDefault(local, crmOld) < 0);
  assert.ok(compareShipmentQueueDefault(crmOld, crmNew) < 0);
});

test("mergeShipmentQueueByGlobalRank tie-break uses default date order", () => {
  const a = base(0, "k-new", 1);
  a.crm_created_at = "2026-03-01T00:00:00.000Z";
  const b = base(0, "k-old", 2);
  b.crm_created_at = "2026-01-01T00:00:00.000Z";
  const merged = mergeShipmentQueueByGlobalRank([], [a, b]);
  assert.deepStrictEqual(merged.map((o) => o.crm_id), ["k-old", "k-new"]);
});
