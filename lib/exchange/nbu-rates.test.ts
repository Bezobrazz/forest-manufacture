import assert from "node:assert/strict";
import test from "node:test";
import {
  SUGGESTED_PRICE_MARKUP_PERCENT,
  convertUahToEur,
  convertEurToUah,
  parseNbuRate,
  suggestedSellingPriceFromEurPerBag,
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

test("suggestedSellingPriceFromEurPerBag adds EUR markup to cost and rounds up", () => {
  assert.equal(suggestedSellingPriceFromEurPerBag(100, 3, 52.1), 257);
  assert.equal(suggestedSellingPriceFromEurPerBag(100, 2.5, 40), 200);
});

test("convertUahToEur divides by EUR/UAH rate", () => {
  assert.equal(convertUahToEur(107, 52.1), 107 / 52.1);
});

test("convertEurToUah multiplies by EUR/UAH rate", () => {
  assert.equal(convertEurToUah(10, 52.1), 10 * 52.1);
});
