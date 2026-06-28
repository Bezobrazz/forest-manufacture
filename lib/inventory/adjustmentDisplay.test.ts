import test from "node:test";
import assert from "node:assert";
import {
  computeInventoryAdjustmentDelta,
  getAdjustmentDisplayValues,
  isNegligibleAdjustment,
} from "./adjustmentDisplay";

test("computeInventoryAdjustmentDelta — зменшення залишку", () => {
  assert.strictEqual(computeInventoryAdjustmentDelta(80, 100), -20);
});

test("computeInventoryAdjustmentDelta — збільшення залишку", () => {
  assert.strictEqual(computeInventoryAdjustmentDelta(150, 100), 50);
});

test("computeInventoryAdjustmentDelta — новий продукт без запису", () => {
  assert.strictEqual(computeInventoryAdjustmentDelta(50, null), 50);
  assert.strictEqual(computeInventoryAdjustmentDelta(50, undefined), 50);
});

test("computeInventoryAdjustmentDelta — без змін", () => {
  assert.strictEqual(computeInventoryAdjustmentDelta(100, 100), 0);
});

test("isNegligibleAdjustment — ігнорує мікроскопічну різницю float", () => {
  assert.strictEqual(isNegligibleAdjustment(0), true);
  assert.strictEqual(isNegligibleAdjustment(1e-12), true);
  assert.strictEqual(isNegligibleAdjustment(0.01), false);
});

test("getAdjustmentDisplayValues — з balance_after у транзакції", () => {
  const values = getAdjustmentDisplayValues(
    { id: 1, quantity: -20, balance_after: 80 },
    new Map()
  );
  assert.deepStrictEqual(values, {
    before: 100,
    entered: 80,
    after: 80,
    delta: -20,
  });
});

test("getAdjustmentDisplayValues — обчислює after з ledger", () => {
  const balanceByTxId = new Map([[5, 150]]);
  const values = getAdjustmentDisplayValues(
    { id: 5, quantity: 50, balance_after: null },
    balanceByTxId
  );
  assert.deepStrictEqual(values, {
    before: 100,
    entered: 150,
    after: 150,
    delta: 50,
  });
});
