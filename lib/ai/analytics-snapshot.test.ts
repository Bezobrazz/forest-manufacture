import assert from "node:assert/strict";
import test from "node:test";
import type { StatisticsPageData } from "@/app/statistics/actions";
import {
  buildAnalyticsSnapshot,
  enforceSnapshotSize,
} from "@/lib/ai/analytics-snapshot";

const baseData: StatisticsPageData = {
  shifts: [
    {
      id: 1,
      shift_date: "2026-07-10",
      status: "completed",
      created_at: "2026-07-10T08:00:00Z",
      completed_at: "2026-07-10T18:00:00Z",
      production: [
        { quantity: 100, product_id: 1 },
        { quantity: 50, product_id: 2 },
      ],
    } as StatisticsPageData["shifts"][number],
    {
      id: 2,
      shift_date: "2026-06-20",
      status: "completed",
      created_at: "2026-06-20T08:00:00Z",
      completed_at: "2026-06-20T18:00:00Z",
      production: [{ quantity: 80, product_id: 1 }],
    } as StatisticsPageData["shifts"][number],
  ],
  products: [
    {
      id: 1,
      name: "Кора фракція A",
      reward: 5,
      category: { id: 1, name: "Кора" },
    } as StatisticsPageData["products"][number],
    {
      id: 2,
      name: "Кора фракція B",
      reward: 5,
      category: { id: 1, name: "Кора" },
    } as StatisticsPageData["products"][number],
  ],
  categories: [{ id: 1, name: "Кора", created_at: "2026-01-01T00:00:00Z" }],
  expenses: [
    {
      amount: 3000,
      date: "2026-07-11",
      category: { name: "З.П. Погодинна" },
    },
    {
      amount: 1000,
      date: "2026-07-12",
      category: { name: "Паливо" },
    },
  ],
  supplierDeliveries: [
    {
      quantity: 200,
      price_per_unit: 40,
      created_at: "2026-07-05T10:00:00Z",
    },
  ],
  trips: [
    {
      id: "t1",
      name: "Рейс сировина",
      trip_date: "2026-07-06",
      trip_start_date: "2026-07-06",
      trip_end_date: "2026-07-06",
      trip_type: "raw",
      vehicle_id: "v1",
      vehicle: { name: "КАМАЗ" },
      distance_km: 100,
      freight_uah: 0,
      fuel_cost_uah: 2000,
      driver_cost_uah: 1000,
      total_costs_uah: 3000,
      profit_uah: -500,
      profit_per_km_uah: null,
      roi_percent: null,
      bags_count: 100,
    },
    {
      id: "t2",
      name: "Рейс комерція",
      trip_date: "2026-07-08",
      trip_start_date: "2026-07-08",
      trip_end_date: "2026-07-08",
      trip_type: "commerce",
      vehicle_id: "v1",
      vehicle: { name: "КАМАЗ" },
      distance_km: 200,
      freight_uah: 15000,
      fuel_cost_uah: 3000,
      driver_cost_uah: 2000,
      total_costs_uah: 5000,
      profit_uah: 10000,
      profit_per_km_uah: 50,
      roi_percent: 200,
      bags_count: null,
    },
  ],
  employees: [
    {
      id: 1,
      name: "Керівник",
      is_manager: true,
      salary: 30000,
    } as StatisticsPageData["employees"][number],
  ],
  latestPackingBagPriceUah: 12,
};

test("buildAnalyticsSnapshot aggregates production and costs for period", () => {
  const snapshot = buildAnalyticsSnapshot(baseData, {
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    periodLabel: "Липень 2026",
    monthlyTaxesUah: 6000,
    monthlyElectricityUah: 3000,
    includeManagementSalaryInCost: true,
  });

  assert.equal(snapshot.production.totalBags, 150);
  assert.equal(snapshot.production.previousTotalBags, 80);
  assert.equal(snapshot.production.shiftsCount, 1);
  assert.ok(snapshot.production.changePercent != null);
  assert.equal(snapshot.expenses.hourlyWageUah, 3000);
  assert.equal(snapshot.trips.rawCount, 1);
  assert.equal(snapshot.trips.commerceCount, 1);
  assert.equal(snapshot.trips.lossCount, 1);
  assert.equal(snapshot.trips.profitableCount, 1);
  assert.equal(snapshot.purchases.bags, 200);
  assert.ok(snapshot.costPerBag.totalUah != null);
  assert.ok(snapshot.costPerBag.structure.length > 0);
});

test("enforceSnapshotSize keeps object shape", () => {
  const snapshot = buildAnalyticsSnapshot(baseData, {
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    periodLabel: "Липень 2026",
  });
  const enforced = enforceSnapshotSize(snapshot);
  assert.equal(enforced.period.label, "Липень 2026");
  assert.ok(Array.isArray(enforced.production.topProducts));
});
