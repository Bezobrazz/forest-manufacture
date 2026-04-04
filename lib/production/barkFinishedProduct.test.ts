import test from "node:test";
import assert from "node:assert";
import { isBarkFinishedProductName } from "./barkFinishedProduct";

test("isBarkFinishedProductName: готова кора", () => {
  assert.strictEqual(isBarkFinishedProductName("Кора сосна 50л"), true);
});

test("isBarkFinishedProductName: мішок не рахується як кора", () => {
  assert.strictEqual(
    isBarkFinishedProductName("Мішок Пакувальний (кора)"),
    false
  );
});

test("isBarkFinishedProductName: пакувальний у назві", () => {
  assert.strictEqual(isBarkFinishedProductName("Щось пакувальне кора"), false);
});

test("isBarkFinishedProductName: без кори", () => {
  assert.strictEqual(isBarkFinishedProductName("Дошка"), false);
});
