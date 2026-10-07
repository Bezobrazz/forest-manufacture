import assert from "node:assert/strict";
import test from "node:test";
import { sumProductionRewardMetrics } from "@/lib/statistics/production-reward";

test("sumProductionRewardMetrics weights reward by produced bags", () => {
  const metrics = sumProductionRewardMetrics(
    [
      {
        status: "completed",
        shift_date: "2026-10-03",
        production: [
          { quantity: 100, product: { reward: 5 } },
          { quantity: 50, product: { reward: 7 } },
        ],
      },
      {
        status: "completed",
        shift_date: "2026-09-01",
        production: [{ quantity: 200, product: { reward: 7 } }],
      },
    ],
    "2026-10-01",
    "2026-10-31"
  );

  assert.equal(metrics.totalBags, 150);
  assert.equal(metrics.totalRewardUah, 100 * 5 + 50 * 7);
  assert.equal(metrics.averagePerBag, (500 + 350) / 150);
});

test("sumProductionRewardMetrics prefers reward_override", () => {
  const metrics = sumProductionRewardMetrics(
    [
      {
        status: "completed",
        shift_date: "2026-10-03",
        production: [
          { quantity: 10, reward_override: 9, product: { reward: 5 } },
        ],
      },
    ],
    "2026-10-01",
    "2026-10-31"
  );

  assert.equal(metrics.averagePerBag, 9);
});
