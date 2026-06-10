import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_BAG_MARGIN_USD,
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
    "USD"
  );

  assert.deepEqual(result, {
    rate: 41.5,
    exchangeDate: "10.06.2026",
    source: "nbu",
  });
});

test("suggestedSellingPriceUah adds minimum margin in UAH", () => {
  assert.equal(suggestedSellingPriceUah(85.42, 41.5, MIN_BAG_MARGIN_USD), 126.92);
});

test("convertUahToEur divides by EUR/UAH rate", () => {
  assert.equal(convertUahToEur(126.92, 52.1), 126.92 / 52.1);
});
