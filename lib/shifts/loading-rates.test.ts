import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SHIFT_LOADING_RATES,
  parseShiftLoadingRates,
} from "@/lib/shifts/loading-rates";

test("parseShiftLoadingRates: defaults when row missing", () => {
  assert.deepEqual(parseShiftLoadingRates(null), DEFAULT_SHIFT_LOADING_RATES);
});

test("parseShiftLoadingRates: reads valid values", () => {
  assert.deepEqual(
    parseShiftLoadingRates({
      loading_count_rate_uah: 1.25,
      product_loading_rate_uah: 2,
    }),
    { loadingCountRateUah: 1.25, productLoadingRateUah: 2 }
  );
});

test("parseShiftLoadingRates: falls back on invalid values", () => {
  assert.deepEqual(
    parseShiftLoadingRates({
      loading_count_rate_uah: -3,
      product_loading_rate_uah: "x",
    }),
    DEFAULT_SHIFT_LOADING_RATES
  );
});
