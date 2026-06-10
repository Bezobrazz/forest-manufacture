import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_BAG_MARGIN_USD,
  parseNbuUsdRate,
  suggestedSellingPriceUah,
} from "./usd-uah";

test("parseNbuUsdRate extracts USD row", () => {
  const result = parseNbuUsdRate([
    { cc: "EUR", rate: 45 },
    { cc: "USD", rate: "41.5", exchangedate: "10.06.2026" },
  ]);

  assert.deepEqual(result, {
    rate: 41.5,
    exchangeDate: "10.06.2026",
    source: "nbu",
  });
});

test("suggestedSellingPriceUah adds minimum margin in UAH", () => {
  assert.equal(suggestedSellingPriceUah(85.42, 41.5, MIN_BAG_MARGIN_USD), 126.92);
});
