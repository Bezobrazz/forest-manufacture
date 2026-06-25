import test from "node:test";
import assert from "node:assert";
import {
  averageMonthlyProductionBags,
  monthlyOverheadPerBag,
  type ShiftProductionLike,
} from "./fixed-overhead";
import {
  DEFAULT_FIXED_OVERHEAD_SETTINGS,
  parseFixedOverheadSettings,
  parseMonthlyOverheadInput,
} from "./fixed-overhead-settings";

const makeShift = (
  shift_date: string,
  quantities: number[]
): ShiftProductionLike => ({
  shift_date,
  status: "completed",
  production: quantities.map((quantity) => ({ quantity })),
});

test("averageMonthlyProductionBags: averages months with production", () => {
  const shifts: ShiftProductionLike[] = [
    makeShift("2026-06-10", [1000]),
    makeShift("2026-05-15", [2000]),
    makeShift("2026-04-20", [3000]),
  ];

  const result = averageMonthlyProductionBags(shifts, "2026-06-30", 3);
  assert.strictEqual(result, 2000);
});

test("averageMonthlyProductionBags: skips months without production", () => {
  const shifts: ShiftProductionLike[] = [makeShift("2026-06-10", [1500])];

  const result = averageMonthlyProductionBags(shifts, "2026-06-30", 6);
  assert.strictEqual(result, 1500);
});

test("averageMonthlyProductionBags: empty shifts returns null", () => {
  assert.strictEqual(averageMonthlyProductionBags([], "2026-06-30"), null);
});

test("monthlyOverheadPerBag: divides monthly amount by average production", () => {
  assert.strictEqual(monthlyOverheadPerBag(13000, 2500), 5.2);
  assert.strictEqual(monthlyOverheadPerBag(0, 2500), 0);
  assert.strictEqual(monthlyOverheadPerBag(13000, null), 0);
  assert.strictEqual(monthlyOverheadPerBag(13000, 0), 0);
});

test("parseMonthlyOverheadInput: parses localized numbers", () => {
  assert.strictEqual(parseMonthlyOverheadInput("5000"), 5000);
  assert.strictEqual(parseMonthlyOverheadInput("13 000"), 13000);
  assert.strictEqual(parseMonthlyOverheadInput("12,5"), 12.5);
  assert.strictEqual(parseMonthlyOverheadInput(""), 0);
});

test("parseFixedOverheadSettings: falls back to defaults", () => {
  assert.deepStrictEqual(parseFixedOverheadSettings(null), {
    ...DEFAULT_FIXED_OVERHEAD_SETTINGS,
  });
  assert.deepStrictEqual(
    parseFixedOverheadSettings('{"monthlyTaxesUah":7000,"monthlyElectricityUah":14000}'),
    { monthlyTaxesUah: 7000, monthlyElectricityUah: 14000 }
  );
});
