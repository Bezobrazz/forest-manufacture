import test from "node:test";
import assert from "node:assert";
import { findCrmQueueInsertIndex } from "./queue-priority";

test("findCrmQueueInsertIndex places CRM by crm_created_at among CRM rows", () => {
  const merged = [
    { crm_id: "local:1", crm_created_at: "2026-05-01T00:00:00.000Z" },
    { crm_id: "k-old", crm_created_at: "2026-01-01T00:00:00.000Z" },
    { crm_id: "k-new", crm_created_at: "2026-03-01T00:00:00.000Z" },
  ];
  assert.strictEqual(
    findCrmQueueInsertIndex(merged, "2026-02-01T00:00:00.000Z"),
    2
  );
  assert.strictEqual(
    findCrmQueueInsertIndex(merged, "2026-04-01T00:00:00.000Z"),
    3
  );
  assert.strictEqual(
    findCrmQueueInsertIndex(merged, "2025-12-01T00:00:00.000Z"),
    1
  );
});

test("findCrmQueueInsertIndex respects local card dragged below CRM", () => {
  const merged = [
    { crm_id: "local:1", crm_created_at: "2026-05-01T00:00:00.000Z" },
    { crm_id: "k-a", crm_created_at: "2026-02-01T00:00:00.000Z" },
    { crm_id: "local:2", crm_created_at: "2026-05-02T00:00:00.000Z" },
    { crm_id: "k-b", crm_created_at: "2026-04-01T00:00:00.000Z" },
  ];
  assert.strictEqual(
    findCrmQueueInsertIndex(merged, "2026-03-01T00:00:00.000Z"),
    3
  );
});
