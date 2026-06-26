import test from "node:test";
import assert from "node:assert";
import {
  buildShippedQueueCardKey,
  computeBalanceAfterByTransactionIdFromInventory,
  computeShipmentFulfillmentPartial,
  enrichQueueShipmentRowsWithBalance,
  formatQueueShipmentNotes,
  groupQueueShipmentTransactions,
  parseShipmentQueueNotesQueueRank,
  parseShipmentQueueNotesRef,
  parseShippedQueueCardKey,
  stripQueueShipmentNotesPrefix,
  stripShipmentQueueNotesMetadata,
} from "./shipped-cards";

test("parseShipmentQueueNotesRef — CRM with queue_rank metadata", () => {
  const ref = parseShipmentQueueNotesRef(
    "Відвантаження черги: Ольга, угода 33319515 [queue_rank:4]"
  );
  assert.deepStrictEqual(ref, { kind: "crm", crmId: "33319515" });
  assert.strictEqual(
    parseShipmentQueueNotesQueueRank("Відвантаження черги: Ольга, угода 33319515 [queue_rank:4]"),
    4
  );
});

test("formatQueueShipmentNotes appends queue rank suffix", () => {
  const notes = formatQueueShipmentNotes("Відвантаження черги: Тест, угода 1", 3);
  assert.strictEqual(notes, "Відвантаження черги: Тест, угода 1 [queue_rank:3]");
  assert.strictEqual(stripShipmentQueueNotesMetadata(notes), "Відвантаження черги: Тест, угода 1");
  assert.strictEqual(stripQueueShipmentNotesPrefix(notes), "Тест, угода 1");
});

test("parseShipmentQueueNotesRef — CRM", () => {
  const ref = parseShipmentQueueNotesRef(
    "Відвантаження черги: Ольга, угода 33319515"
  );
  assert.deepStrictEqual(ref, { kind: "crm", crmId: "33319515" });
});

test("parseShipmentQueueNotesRef — local", () => {
  const ref = parseShipmentQueueNotesRef(
    "Відвантаження черги: Харків (локальна картка #2)"
  );
  assert.deepStrictEqual(ref, { kind: "local", planningOrderId: 2 });
});

test("groupQueueShipmentTransactions merges lines by day and notes", () => {
  const grouped = groupQueueShipmentTransactions([
    {
      id: 101,
      notes: "Відвантаження черги: Клієнт, угода 1",
      created_at: "2026-06-13T10:00:00.000Z",
      quantity: -100,
      product_id: 21,
      balance_after: 1550,
      product: { name: "Кора Дрібна" },
    },
    {
      id: 102,
      notes: "Відвантаження черги: Клієнт, угода 1",
      created_at: "2026-06-13T10:01:00.000Z",
      quantity: -50,
      product_id: 23,
      balance_after: 2805,
      product: { name: "Кора Крупна" },
    },
  ]);

  assert.strictEqual(grouped.length, 1);
  assert.strictEqual(grouped[0].cardKey, "2026-06-13|Відвантаження черги: Клієнт, угода 1");
  assert.deepStrictEqual(grouped[0].transactionIds, [101, 102]);
  assert.strictEqual(grouped[0].totalQuantity, 150);
  assert.strictEqual(grouped[0].rowsCount, 2);
  assert.strictEqual(grouped[0].lines.length, 2);
  assert.strictEqual(grouped[0].lines.find((l) => l.productId === 21)?.quantity, 100);
  assert.strictEqual(grouped[0].lines.find((l) => l.productId === 21)?.balanceAfter, 1550);
});

test("parseShippedQueueCardKey rejects empty input", () => {
  assert.strictEqual(parseShippedQueueCardKey(undefined), null);
  assert.strictEqual(parseShippedQueueCardKey(null), null);
  assert.strictEqual(parseShippedQueueCardKey(""), null);
});

test("buildShippedQueueCardKey and parseShippedQueueCardKey round-trip", () => {
  const notes = "Відвантаження черги: Клієнт, угода 1";
  const key = buildShippedQueueCardKey(notes, "2026-06-13T12:00:00.000Z");
  assert.strictEqual(key, "2026-06-13|Відвантаження черги: Клієнт, угода 1");
  assert.deepStrictEqual(parseShippedQueueCardKey(key), {
    dayKey: "2026-06-13",
    notes,
  });
});

test("computeShipmentFulfillmentPartial — full when all lines match order", () => {
  const partial = computeShipmentFulfillmentPartial(
    [
      { productId: 21, productName: "A", quantity: 800, balanceAfter: 850 },
      { productId: 23, productName: "B", quantity: 545, balanceAfter: 2310 },
    ],
    [
      { product_id: 21, quantity: 800 },
      { product_id: 23, quantity: 545 },
    ]
  );
  assert.strictEqual(partial, false);
});

test("computeShipmentFulfillmentPartial — partial when qty below order", () => {
  const partial = computeShipmentFulfillmentPartial(
    [{ productId: 21, productName: "A", quantity: 500, balanceAfter: 1150 }],
    [{ product_id: 21, quantity: 800 }]
  );
  assert.strictEqual(partial, true);
});

test("stripQueueShipmentNotesPrefix", () => {
  assert.strictEqual(
    stripQueueShipmentNotesPrefix("Відвантаження черги: Тест, угода 1"),
    "Тест, угода 1"
  );
});

test("computeBalanceAfterByTransactionIdFromInventory — reverse walk from inventory", () => {
  const map = computeBalanceAfterByTransactionIdFromInventory({
    currentInventoryByProduct: { 21: 850 },
    ledger: [
      { id: 1, product_id: 21, quantity: 1000, created_at: "2026-06-01T10:00:00.000Z" },
      { id: 2, product_id: 21, quantity: -800, created_at: "2026-06-12T12:00:00.000Z" },
      { id: 3, product_id: 21, quantity: 650, created_at: "2026-06-13T10:00:00.000Z" },
    ],
  });
  assert.strictEqual(map.get(3), 850);
  assert.strictEqual(map.get(2), 200);
  assert.strictEqual(map.get(1), 1000);
});

test("enrichQueueShipmentRowsWithBalance fills missing balance_after", () => {
  const balanceByTxId = new Map([[2, 400]]);
  const enriched = enrichQueueShipmentRowsWithBalance(
    [
      {
        id: 2,
        notes: "Відвантаження черги: A, угода 1",
        created_at: "2026-06-12T12:00:00.000Z",
        quantity: -600,
        product_id: 21,
        balance_after: null,
      },
    ],
    balanceByTxId
  );
  assert.strictEqual(enriched[0].balance_after, 400);
});
