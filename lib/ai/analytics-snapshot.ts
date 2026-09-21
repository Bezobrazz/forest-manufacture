import { z } from "zod";
import type { StatisticsPageData } from "@/app/statistics/actions";
import {
  prorateMonthlyAmountForDateRange,
  sumManagerMonthlySalaries,
} from "@/lib/statistics/management-salary";
import {
  averageMonthlyProductionBags,
  monthlyOverheadPerBag,
} from "@/lib/statistics/fixed-overhead";

/** Обрізання довгих списків у snapshot (етап 4). */
export const SNAPSHOT_LIMITS = {
  topProducts: 12,
  topExpenseCategories: 10,
  topTrips: 8,
  maxJsonChars: 28_000,
} as const;

export const analyticsSnapshotInputSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodLabel: z.string().min(1).max(120),
  monthlyTaxesUah: z.number().finite().min(0).optional(),
  monthlyElectricityUah: z.number().finite().min(0).optional(),
  includeManagementSalaryInCost: z.boolean().optional(),
  latestPackingBagPriceUah: z.number().finite().min(0).optional(),
});

export type AnalyticsSnapshotInput = z.infer<typeof analyticsSnapshotInputSchema>;

export type NamedAmount = {
  name: string;
  amount: number;
  sharePercent: number | null;
};

export type AnalyticsSnapshot = {
  period: {
    start: string;
    end: string;
    label: string;
    previousStart: string;
    previousEnd: string;
  };
  production: {
    totalBags: number;
    previousTotalBags: number;
    changePercent: number | null;
    shiftsCount: number;
    averagePerShift: number | null;
    byCategory: NamedAmount[];
    topProducts: NamedAmount[];
  };
  costPerBag: {
    totalUah: number | null;
    previousTotalUah: number | null;
    changePercent: number | null;
    structure: Array<{ label: string; uah: number; sharePercent: number | null }>;
    purchaseCostPerBag: number | null;
    tripCostPerBag: number | null;
    hourlyWagePerBag: number | null;
    taxesPerBag: number | null;
    electricityPerBag: number | null;
    managementSalaryPerBag: number | null;
    packingBagUah: number;
    fixedRewardPerBag: number;
  };
  expenses: {
    totalUah: number;
    byCategory: NamedAmount[];
    hourlyWageUah: number;
  };
  trips: {
    rawCount: number;
    commerceCount: number;
    rawTotalCostUah: number;
    commerceProfitUah: number;
    profitableCount: number;
    lossCount: number;
    topByAbsProfit: Array<{
      name: string;
      type: string;
      profitUah: number;
      costsUah: number;
      bags: number | null;
    }>;
  };
  purchases: {
    bags: number;
    totalCostUah: number;
    avgCostPerBag: number | null;
  };
  context: {
    averageMonthlyProductionBags: number | null;
    includeManagementSalaryInCost: boolean;
  };
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundQty(value: number): number {
  return Math.round(value);
}

function toDayKey(value?: string | null): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isDayInRange(day: string, startDay: string, endDay: string): boolean {
  if (!day) return false;
  return day >= startDay && day <= endDay;
}

function changePercent(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return roundMoney(((current - previous) / previous) * 100);
}

function previousPeriodRange(
  startYmd: string,
  endYmd: string
): { prevStart: string; prevEnd: string } {
  const [ys, ms, ds] = startYmd.split("-").map((x) => Number.parseInt(x, 10));
  const [ye, me, de] = endYmd.split("-").map((x) => Number.parseInt(x, 10));
  const start = new Date(ys, ms - 1, ds, 0, 0, 0, 0);
  const end = new Date(ye, me - 1, de, 0, 0, 0, 0);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const rangeDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - rangeDays + 1);

  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return { prevStart: ymd(prevStart), prevEnd: ymd(prevEnd) };
}

function share(amount: number, total: number): number | null {
  if (total <= 0) return null;
  return roundMoney((amount / total) * 100);
}

function topNamedAmounts(
  map: Record<string, number>,
  limit: number
): NamedAmount[] {
  const total = Object.values(map).reduce((sum, v) => sum + v, 0);
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, amount]) => ({
      name,
      amount: roundMoney(amount),
      sharePercent: share(amount, total),
    }));
}

/**
 * Будує компактний детермінований snapshot для LLM (без сирих таблиць).
 */
export function buildAnalyticsSnapshot(
  data: StatisticsPageData,
  input: AnalyticsSnapshotInput
): AnalyticsSnapshot {
  const startDay = input.periodStart;
  const endDay = input.periodEnd;
  const { prevStart, prevEnd } = previousPeriodRange(startDay, endDay);
  const monthlyTaxesUah = input.monthlyTaxesUah ?? 0;
  const monthlyElectricityUah = input.monthlyElectricityUah ?? 0;
  const includeManagementSalary =
    input.includeManagementSalaryInCost ?? true;
  const packingBagUah =
    input.latestPackingBagPriceUah ?? data.latestPackingBagPriceUah ?? 0;

  const productNameById = new Map(
    data.products.map((p) => [p.id, p.name ?? `product:${p.id}`])
  );
  const productCategoryById = new Map(
    data.products.map((p) => [p.id, p.category?.name ?? "Без категорії"])
  );
  const fixedRewardPerBag = (() => {
    const first = data.products.find((p) => Number(p.reward ?? 0) > 0);
    return first ? Number(first.reward ?? 0) : 0;
  })();
  const managementSalaryMonthlyTotal = sumManagerMonthlySalaries(data.employees);

  const sumProduced = (from: string, to: string) => {
    let total = 0;
    for (const shift of data.shifts) {
      if (shift.status !== "completed") continue;
      const day = toDayKey(shift.shift_date);
      if (!isDayInRange(day, from, to)) continue;
      for (const item of shift.production ?? []) {
        total += Number(item.quantity ?? 0);
      }
    }
    return total;
  };

  const productionMaps = (from: string, to: string) => {
    const byCategory: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    let shiftsCount = 0;

    for (const shift of data.shifts) {
      if (shift.status !== "completed") continue;
      const day = toDayKey(shift.shift_date);
      if (!isDayInRange(day, from, to)) continue;
      shiftsCount += 1;
      for (const item of shift.production ?? []) {
        const qty = Number(item.quantity ?? 0);
        if (!Number.isFinite(qty) || qty === 0) continue;
        const productName =
          productNameById.get(item.product_id) ?? `product:${item.product_id}`;
        const categoryName =
          productCategoryById.get(item.product_id) ?? "Без категорії";
        byProduct[productName] = (byProduct[productName] ?? 0) + qty;
        byCategory[categoryName] = (byCategory[categoryName] ?? 0) + qty;
      }
    }

    return { byCategory, byProduct, shiftsCount };
  };

  const currentProduction = productionMaps(startDay, endDay);
  const totalBags = roundQty(sumProduced(startDay, endDay));
  const previousTotalBags = roundQty(sumProduced(prevStart, prevEnd));
  const averagePerShift =
    currentProduction.shiftsCount > 0
      ? roundMoney(totalBags / currentProduction.shiftsCount)
      : null;

  const avgMonthlyProduction = averageMonthlyProductionBags(
    data.shifts,
    endDay
  );

  const getAveragePurchaseCostPerBag = (from: string, to: string) => {
    let totalCost = 0;
    let totalBagsLocal = 0;
    for (const delivery of data.supplierDeliveries) {
      const day = toDayKey(delivery.created_at);
      if (!isDayInRange(day, from, to)) continue;
      const quantity = Number(delivery.quantity ?? 0);
      const price = Number(delivery.price_per_unit ?? 0);
      if (quantity <= 0 || !Number.isFinite(price) || price <= 0) continue;
      totalCost += quantity * price;
      totalBagsLocal += quantity;
    }
    if (totalBagsLocal <= 0) return null;
    return totalCost / totalBagsLocal;
  };

  const getAverageTripCostPerBag = (from: string, to: string) => {
    let totalCost = 0;
    let totalBagsLocal = 0;
    for (const trip of data.trips) {
      if (trip.trip_type !== "raw") continue;
      const day = toDayKey(trip.trip_start_date || trip.trip_date);
      if (!isDayInRange(day, from, to)) continue;
      const bags = Number(trip.bags_count ?? 0);
      const costs = Number(trip.total_costs_uah ?? 0);
      if (bags < 1 || !Number.isFinite(costs) || costs <= 0) continue;
      totalCost += costs;
      totalBagsLocal += bags;
    }
    if (totalBagsLocal <= 0) return null;
    return totalCost / totalBagsLocal;
  };

  const sumHourlyWage = (from: string, to: string) =>
    data.expenses.reduce((sum, expense) => {
      const day = toDayKey(expense.date);
      if (!isDayInRange(day, from, to)) return sum;
      const categoryName = String(expense.category?.name ?? "").trim();
      if (categoryName !== "З.П. Погодинна") return sum;
      return sum + Number(expense.amount ?? 0);
    }, 0);

  const computeTotalCostPerBag = (from: string, to: string): number | null => {
    const hourlyWageCosts = sumHourlyWage(from, to);
    const producedQuantity = sumProduced(from, to);
    const managementSalaryCosts = prorateMonthlyAmountForDateRange(
      managementSalaryMonthlyTotal,
      from,
      to
    );
    const avgProduction = averageMonthlyProductionBags(data.shifts, to);
    const taxesPerBag = monthlyOverheadPerBag(monthlyTaxesUah, avgProduction);
    const electricityPerBag = monthlyOverheadPerBag(
      monthlyElectricityUah,
      avgProduction
    );
    const purchaseCostPerBag = getAveragePurchaseCostPerBag(from, to);
    const tripCostPerBag = getAverageTripCostPerBag(from, to);
    if (purchaseCostPerBag == null || tripCostPerBag == null) return null;

    const hourlyWagePerBag =
      producedQuantity > 0 ? hourlyWageCosts / producedQuantity : 0;
    const managementSalaryPerBag =
      producedQuantity > 0 ? managementSalaryCosts / producedQuantity : 0;

    return (
      purchaseCostPerBag +
      tripCostPerBag +
      fixedRewardPerBag +
      hourlyWagePerBag +
      taxesPerBag +
      electricityPerBag +
      (includeManagementSalary ? managementSalaryPerBag : 0) +
      packingBagUah
    );
  };

  // Якщо за обраний період ще немає закупок або поїздок «Сировина» — беремо попередній.
  let costStartDay = startDay;
  let costEndDay = endDay;
  const hasCostInputs =
    getAveragePurchaseCostPerBag(startDay, endDay) != null &&
    getAverageTripCostPerBag(startDay, endDay) != null;
  if (!hasCostInputs) {
    const prevHasCostInputs =
      getAveragePurchaseCostPerBag(prevStart, prevEnd) != null &&
      getAverageTripCostPerBag(prevStart, prevEnd) != null;
    if (prevHasCostInputs) {
      costStartDay = prevStart;
      costEndDay = prevEnd;
    }
  }
  const costPrevious = previousPeriodRange(costStartDay, costEndDay);
  const costAvgMonthlyProduction = averageMonthlyProductionBags(
    data.shifts,
    costEndDay
  );

  const purchaseCostPerBag = getAveragePurchaseCostPerBag(
    costStartDay,
    costEndDay
  );
  const tripCostPerBag = getAverageTripCostPerBag(costStartDay, costEndDay);
  const costHourlyWageCosts = sumHourlyWage(costStartDay, costEndDay);
  const producedQuantity = sumProduced(costStartDay, costEndDay);
  const managementSalaryCosts = prorateMonthlyAmountForDateRange(
    managementSalaryMonthlyTotal,
    costStartDay,
    costEndDay
  );
  const hourlyWagePerBag =
    producedQuantity > 0 ? costHourlyWageCosts / producedQuantity : 0;
  const managementSalaryPerBag =
    producedQuantity > 0 ? managementSalaryCosts / producedQuantity : 0;
  const taxesPerBag = monthlyOverheadPerBag(
    monthlyTaxesUah,
    costAvgMonthlyProduction
  );
  const electricityPerBag = monthlyOverheadPerBag(
    monthlyElectricityUah,
    costAvgMonthlyProduction
  );
  const totalCostPerBag = computeTotalCostPerBag(costStartDay, costEndDay);
  const previousTotalCostPerBag = computeTotalCostPerBag(
    costPrevious.prevStart,
    costPrevious.prevEnd
  );

  const structureBase = [
    {
      label: "Закупка сировини",
      uah: purchaseCostPerBag ?? 0,
    },
    {
      label: "Поїздки (сировина)",
      uah: tripCostPerBag ?? 0,
    },
    {
      label: "Винагорода на мішок",
      uah: fixedRewardPerBag,
    },
    {
      label: "Погодинна З.П.",
      uah: hourlyWagePerBag,
    },
    {
      label: "Податки",
      uah: taxesPerBag,
    },
    {
      label: "Електроенергія",
      uah: electricityPerBag,
    },
    {
      label: "Оклади керівництва",
      uah: includeManagementSalary ? managementSalaryPerBag : 0,
    },
    {
      label: "Пакувальний мішок",
      uah: packingBagUah,
    },
  ];
  const structureTotal = structureBase.reduce((sum, row) => sum + row.uah, 0);
  const structure = structureBase
    .map((row) => ({
      label: row.label,
      uah: roundMoney(row.uah),
      sharePercent: share(row.uah, structureTotal),
    }))
    .sort((a, b) => b.uah - a.uah);

  const expensesByCategory: Record<string, number> = {};
  let expensesTotal = 0;
  for (const expense of data.expenses) {
    const day = toDayKey(expense.date);
    if (!isDayInRange(day, startDay, endDay)) continue;
    const amount = Number(expense.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const name = String(expense.category?.name ?? "Без категорії").trim() || "Без категорії";
    expensesByCategory[name] = (expensesByCategory[name] ?? 0) + amount;
    expensesTotal += amount;
  }

  let purchaseBags = 0;
  let purchaseCost = 0;
  for (const delivery of data.supplierDeliveries) {
    const day = toDayKey(delivery.created_at);
    if (!isDayInRange(day, startDay, endDay)) continue;
    const quantity = Number(delivery.quantity ?? 0);
    const price = Number(delivery.price_per_unit ?? 0);
    if (quantity > 0) purchaseBags += quantity;
    if (quantity > 0 && Number.isFinite(price) && price > 0) {
      purchaseCost += quantity * price;
    }
  }

  let rawCount = 0;
  let commerceCount = 0;
  let rawTotalCostUah = 0;
  let commerceProfitUah = 0;
  let profitableCount = 0;
  let lossCount = 0;
  const tripRows: AnalyticsSnapshot["trips"]["topByAbsProfit"] = [];

  for (const trip of data.trips) {
    const day = toDayKey(trip.trip_start_date || trip.trip_date);
    if (!isDayInRange(day, startDay, endDay)) continue;
    const type = trip.trip_type === "commerce" ? "commerce" : "raw";
    const profit = Number(trip.profit_uah ?? 0);
    const costs = Number(trip.total_costs_uah ?? 0);
    const bags =
      trip.bags_count == null ? null : Number(trip.bags_count ?? 0);

    if (type === "raw") {
      rawCount += 1;
      rawTotalCostUah += Number.isFinite(costs) ? costs : 0;
    } else {
      commerceCount += 1;
      commerceProfitUah += Number.isFinite(profit) ? profit : 0;
    }

    if (Number.isFinite(profit)) {
      if (profit > 0) profitableCount += 1;
      if (profit < 0) lossCount += 1;
    }

    tripRows.push({
      name: trip.name?.trim() || trip.vehicle?.name || `Рейс ${trip.id.slice(0, 8)}`,
      type,
      profitUah: roundMoney(Number.isFinite(profit) ? profit : 0),
      costsUah: roundMoney(Number.isFinite(costs) ? costs : 0),
      bags: bags != null && Number.isFinite(bags) ? roundQty(bags) : null,
    });
  }

  tripRows.sort((a, b) => Math.abs(b.profitUah) - Math.abs(a.profitUah));

  return {
    period: {
      start: startDay,
      end: endDay,
      label: input.periodLabel,
      previousStart: prevStart,
      previousEnd: prevEnd,
    },
    production: {
      totalBags,
      previousTotalBags,
      changePercent: changePercent(totalBags, previousTotalBags),
      shiftsCount: currentProduction.shiftsCount,
      averagePerShift,
      byCategory: topNamedAmounts(
        currentProduction.byCategory,
        SNAPSHOT_LIMITS.topProducts
      ),
      topProducts: topNamedAmounts(
        currentProduction.byProduct,
        SNAPSHOT_LIMITS.topProducts
      ),
    },
    costPerBag: {
      totalUah: totalCostPerBag == null ? null : roundMoney(totalCostPerBag),
      previousTotalUah:
        previousTotalCostPerBag == null
          ? null
          : roundMoney(previousTotalCostPerBag),
      changePercent: changePercent(totalCostPerBag, previousTotalCostPerBag),
      structure,
      purchaseCostPerBag:
        purchaseCostPerBag == null ? null : roundMoney(purchaseCostPerBag),
      tripCostPerBag:
        tripCostPerBag == null ? null : roundMoney(tripCostPerBag),
      hourlyWagePerBag: roundMoney(hourlyWagePerBag),
      taxesPerBag: roundMoney(taxesPerBag),
      electricityPerBag: roundMoney(electricityPerBag),
      managementSalaryPerBag: roundMoney(
        includeManagementSalary ? managementSalaryPerBag : 0
      ),
      packingBagUah: roundMoney(packingBagUah),
      fixedRewardPerBag: roundMoney(fixedRewardPerBag),
    },
    expenses: {
      totalUah: roundMoney(expensesTotal),
      byCategory: topNamedAmounts(
        expensesByCategory,
        SNAPSHOT_LIMITS.topExpenseCategories
      ),
      hourlyWageUah: roundMoney(sumHourlyWage(startDay, endDay)),
    },
    trips: {
      rawCount,
      commerceCount,
      rawTotalCostUah: roundMoney(rawTotalCostUah),
      commerceProfitUah: roundMoney(commerceProfitUah),
      profitableCount,
      lossCount,
      topByAbsProfit: tripRows.slice(0, SNAPSHOT_LIMITS.topTrips),
    },
    purchases: {
      bags: roundQty(purchaseBags),
      totalCostUah: roundMoney(purchaseCost),
      avgCostPerBag: (() => {
        const avg = getAveragePurchaseCostPerBag(startDay, endDay);
        return avg == null ? null : roundMoney(avg);
      })(),
    },
    context: {
      averageMonthlyProductionBags:
        avgMonthlyProduction == null ? null : roundMoney(avgMonthlyProduction),
      includeManagementSalaryInCost: includeManagementSalary,
    },
  };
}

/** Обрізає snapshot, якщо JSON занадто великий для промпту. */
export function enforceSnapshotSize(snapshot: AnalyticsSnapshot): AnalyticsSnapshot {
  let json = JSON.stringify(snapshot);
  if (json.length <= SNAPSHOT_LIMITS.maxJsonChars) return snapshot;

  const trimmed: AnalyticsSnapshot = {
    ...snapshot,
    production: {
      ...snapshot.production,
      byCategory: snapshot.production.byCategory.slice(0, 6),
      topProducts: snapshot.production.topProducts.slice(0, 6),
    },
    expenses: {
      ...snapshot.expenses,
      byCategory: snapshot.expenses.byCategory.slice(0, 5),
    },
    trips: {
      ...snapshot.trips,
      topByAbsProfit: snapshot.trips.topByAbsProfit.slice(0, 4),
    },
    costPerBag: {
      ...snapshot.costPerBag,
      structure: snapshot.costPerBag.structure.slice(0, 6),
    },
  };

  json = JSON.stringify(trimmed);
  if (json.length <= SNAPSHOT_LIMITS.maxJsonChars) return trimmed;

  return {
    ...trimmed,
    production: {
      ...trimmed.production,
      byCategory: [],
      topProducts: trimmed.production.topProducts.slice(0, 3),
    },
    expenses: { ...trimmed.expenses, byCategory: trimmed.expenses.byCategory.slice(0, 3) },
    trips: { ...trimmed.trips, topByAbsProfit: [] },
  };
}
