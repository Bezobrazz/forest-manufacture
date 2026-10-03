"use server";

import { createServerClient } from "@/lib/supabase/server";
import { crmDealMarginPercent } from "@/lib/crm/keepincrm/mapper";
import { dateToYYYYMMDD, getDateRangeForPeriod } from "@/lib/utils";
import type { StatisticsDateRange } from "@/app/actions";

export type CrmShippedDealMetricRow = {
  id: number;
  crm_id: string;
  customer_name: string;
  total_amount: number;
  marge_amount: number;
  margin_percent: number | null;
  shipment_date: string;
  shipped_at: string;
};

export type CrmDealProfitabilityStats = {
  dealsCount: number;
  revenueTotal: number;
  margeTotal: number;
  marginPercent: number | null;
  startDay: string;
  endDay: string;
  deals: CrmShippedDealMetricRow[];
};

function toMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function resolveRange(
  period: "year" | "month" | "week",
  year?: number,
  dateRange?: StatisticsDateRange | null
): { startDay: string; endDay: string } {
  if (dateRange?.start && dateRange?.end) {
    return { startDay: dateRange.start, endDay: dateRange.end };
  }
  const { startDate, endDate } = getDateRangeForPeriod(period, year);
  return {
    startDay: dateToYYYYMMDD(startDate),
    endDay: dateToYYYYMMDD(endDate),
  };
}

export async function getCrmDealProfitabilityStats(
  period: "year" | "month" | "week" = "month",
  year?: number,
  dateRange?: StatisticsDateRange | null
): Promise<CrmDealProfitabilityStats> {
  const { startDay, endDay } = resolveRange(period, year, dateRange);
  const empty: CrmDealProfitabilityStats = {
    dealsCount: 0,
    revenueTotal: 0,
    margeTotal: 0,
    marginPercent: null,
    startDay,
    endDay,
    deals: [],
  };

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("crm_shipped_deal_metrics")
    .select(
      "id, crm_id, customer_name, total_amount, marge_amount, shipment_date, shipped_at"
    )
    .gte("shipment_date", startDay)
    .lte("shipment_date", endDay)
    .order("shipment_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("getCrmDealProfitabilityStats:", error);
    return empty;
  }

  const deals: CrmShippedDealMetricRow[] = (data ?? []).map((row) => {
    const total_amount = toMoney(row.total_amount);
    const marge_amount = toMoney(row.marge_amount);
    return {
      id: Number(row.id),
      crm_id: String(row.crm_id ?? ""),
      customer_name: typeof row.customer_name === "string" ? row.customer_name : "",
      total_amount,
      marge_amount,
      margin_percent: crmDealMarginPercent(total_amount, marge_amount),
      shipment_date: String(row.shipment_date ?? ""),
      shipped_at: String(row.shipped_at ?? ""),
    };
  });

  const revenueTotal = deals.reduce((acc, d) => acc + d.total_amount, 0);
  const margeTotal = deals.reduce((acc, d) => acc + d.marge_amount, 0);

  return {
    dealsCount: deals.length,
    revenueTotal: Math.round(revenueTotal * 100) / 100,
    margeTotal: Math.round(margeTotal * 100) / 100,
    marginPercent: crmDealMarginPercent(revenueTotal, margeTotal),
    startDay,
    endDay,
    deals,
  };
}
