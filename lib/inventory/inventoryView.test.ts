import test from "node:test";
import assert from "node:assert";
import {
  isFinishedProductRow,
  mergeInventoryForDisplay,
  type InventorySourceRow,
} from "./inventoryView";

const defaultProduct: NonNullable<InventorySourceRow["product"]> = {
  id: 10,
  name: "P",
  description: null,
  category_id: 1,
  reward: null,
  cost: null,
  product_type: "finished",
  created_at: "2026-01-01T00:00:00.000Z",
};

const baseRow = (
  overrides: Partial<Omit<InventorySourceRow, "product">> & {
    product?: Partial<NonNullable<InventorySourceRow["product"]>>;
  }
): InventorySourceRow => {
  const { product: po, ...rest } = overrides;
  return {
    id: 1,
    product_id: 10,
    quantity: 5,
    updated_at: "2026-01-01T00:00:00.000Z",
    product: { ...defaultProduct, ...po },
    ...rest,
  };
};

test("isFinishedProductRow: готова продукція (finished)", () => {
  assert.strictEqual(
    isFinishedProductRow(baseRow({ product: { product_type: "finished" } })),
    true
  );
});

test("isFinishedProductRow: legacy без типу, але з reward", () => {
  assert.strictEqual(
    isFinishedProductRow(
      baseRow({
        product: {
          product_type: null,
          reward: 12,
        },
      })
    ),
    true
  );
});

test("isFinishedProductRow: матеріал не показується як готова продукція", () => {
  assert.strictEqual(
    isFinishedProductRow(
      baseRow({
        product: { product_type: "material", reward: 99 },
      })
    ),
    false
  );
});

test("isFinishedProductRow: сировина (raw) не в готовій продукції", () => {
  assert.strictEqual(
    isFinishedProductRow(
      baseRow({
        product: { product_type: "raw", reward: 1 },
      })
    ),
    false
  );
});

test("mergeInventoryForDisplay: готова з legacy + матеріал лише з warehouse", () => {
  const legacyFinished = baseRow({
    id: 1,
    product_id: 1,
    product: { product_type: "finished", id: 1, name: "A" },
  });
  const legacyMaterial = baseRow({
    id: 2,
    product_id: 2,
    product: { product_type: "material", id: 2, name: "M-legacy" },
  });
  const whMaterial = baseRow({
    id: 100,
    product_id: 3,
    product: { product_type: "material", id: 3, name: "M-wh" },
  });
  const whFinished = baseRow({
    id: 101,
    product_id: 4,
    product: { product_type: "finished", id: 4, name: "F-wh" },
  });

  const merged = mergeInventoryForDisplay(
    [legacyFinished, legacyMaterial],
    [whMaterial, whFinished]
  );

  const ids = merged.map((r) => r.product_id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [1, 3]);
});

test("mergeInventoryForDisplay: готова лише в warehouse_inventory не потрапляє в список (інваріант поточної моделі)", () => {
  const onlyWhFinished = baseRow({
    id: 200,
    product_id: 99,
    product: { product_type: "finished", id: 99, name: "Ghost" },
  });

  const merged = mergeInventoryForDisplay([], [onlyWhFinished]);
  assert.strictEqual(merged.length, 0);
});
