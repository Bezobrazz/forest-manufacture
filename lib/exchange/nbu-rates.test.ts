import assert from "node:assert/strict";
import test from "node:test";
import {
  SUGGESTED_PRICE_MARKUP_PERCENT,
  convertUahToEur,
  parseNbuRate,
  suggestedSellingPriceUah,
} from "./nbu-rates";

test("parseNbuRate extracts currency row", () => {
  const result = parseNbuRate(
    [
      { cc: "EUR", rate: "52.1", exchangedate: "10.06.2026" },
      { cc: "USD", rate: "41.5", exchangedate: "10.06.2026" },
    ],
    "EUR"
  );

  assert.deepEqual(result, {
    rate: 52.1,
    exchangeDate: "10.06.2026",
    source: "nbu",
  });
});

test("suggestedSellingPriceUah adds markup and rounds up", () => {
  assert.equal(suggestedSellingPriceUah(85.42, SUGGESTED_PRICE_MARKUP_PERCENT), 124);
  assert.equal(suggestedSellingPriceUah(100, SUGGESTED_PRICE_MARKUP_PERCENT), 145);
  assert.equal(suggestedSellingPriceUah(100.01, SUGGESTED_PRICE_MARKUP_PERCENT), 146);
});

test("convertUahToEur divides by EUR/UAH rate", () => {
  assert.equal(convertUahToEur(107, 52.1), 107 / 52.1);
});
