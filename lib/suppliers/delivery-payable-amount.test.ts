import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupplierDeliveryPayableAmount } from "./delivery-payable-amount";

test("resolveSupplierDeliveryPayableAmount: actual_paid має пріоритет", () => {
  assert.equal(
    resolveSupplierDeliveryPayableAmount({
      quantity: 10,
      pricePerUnit: 5,
      actualPaid: 40,
    }),
    40,
  );
});

test("resolveSupplierDeliveryPayableAmount: без actual_paid — quantity * price", () => {
  assert.equal(
    resolveSupplierDeliveryPayableAmount({
      quantity: 10,
      pricePerUnit: 5,
      actualPaid: null,
    }),
    50,
  );
});

test("resolveSupplierDeliveryPayableAmount: actual_paid = 0 дозволено", () => {
  assert.equal(
    resolveSupplierDeliveryPayableAmount({
      quantity: 10,
      pricePerUnit: 5,
      actualPaid: 0,
    }),
    0,
  );
});
