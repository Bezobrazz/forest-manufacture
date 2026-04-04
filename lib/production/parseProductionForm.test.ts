import test from "node:test";
import assert from "node:assert";
import { parseProductionFormData } from "./parseProductionForm";

test("parseProductionFormData: валідні дані", () => {
  const fd = new FormData();
  fd.set("shift_id", "5");
  fd.set("product_id", "12");
  fd.set("quantity", "100.5");

  const r = parseProductionFormData(fd);
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.strictEqual(r.shiftId, 5);
    assert.strictEqual(r.productId, 12);
    assert.strictEqual(r.quantity, 100.5);
  }
});

test("parseProductionFormData: відсутня зміна", () => {
  const fd = new FormData();
  fd.set("shift_id", "");
  fd.set("product_id", "1");
  fd.set("quantity", "10");

  const r = parseProductionFormData(fd);
  assert.strictEqual(r.ok, false);
});

test("parseProductionFormData: некоректна кількість", () => {
  const fd = new FormData();
  fd.set("shift_id", "1");
  fd.set("product_id", "1");
  fd.set("quantity", "abc");

  const r = parseProductionFormData(fd);
  assert.strictEqual(r.ok, false);
});

test("parseProductionFormData: кількість 0 дозволена", () => {
  const fd = new FormData();
  fd.set("shift_id", "1");
  fd.set("product_id", "2");
  fd.set("quantity", "0");

  const r = parseProductionFormData(fd);
  assert.strictEqual(r.ok, true);
  if (r.ok) assert.strictEqual(r.quantity, 0);
});
