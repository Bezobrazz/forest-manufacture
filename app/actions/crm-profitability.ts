"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatisticsDateRange } from "@/app/actions";
import { fetchKeepinAgreementRaw } from "@/lib/crm/keepincrm/client";
import {
  crmDealMarginPercent,
  parseKeepinAgreement,
} from "@/lib/crm/keepincrm/mapper";
import { convertEurToUah } from "@/lib/exchange/nbu-rates";
import { parseShipmentQueueNotesRef } from "@/lib/shipments/shipped-cards";
import { getServerUser } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { dateToYYYYMMDD, getDateRangeForPeriod } from "@/lib/utils";

export type CrmShippedDealMetricRow = {
  id: number;
  crm_id: string;
  customer_name: string;
  total_amount: number;
  marge_amount: number;
  currency: string;
  margin_percent: number | null;
  shipment_date: string;
  shipped_at: string;
};

export type CrmDealProfitabilityStats = {
  dealsCount: number;
  /** Нативні суми без змішування валют */
  revenueUah: number;
  margeUah: number;
  revenueEur: number;
  margeEur: number;
  /** Еквівалент у грн: UAH + EUR×курс НБУ (якщо курс передано) */
  revenueUahEquivalent: number | null;
  margeUahEquivalent: number | null;
  marginPercentEquivalent: number | null;
  startDay: string;
  endDay: string;
  deals: CrmShippedDealMetricRow[];
};

export type BackfillCrmShippedDealMetricsResult = {
  success: boolean;
  inserted: number;
  updated: number;
  failed: number;
  error?: string;
};

function toMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function normalizeCurrency(value: unknown): string {
  if (typeof value === "string" && /^[A-Za-z]{3}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return "UAH";
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

function metricKey(crmId: string, shipmentDate: string): string {
  return `${crmId}|${shipmentDate}`;
}

async function listExistingMetricKeys(
  supabase: SupabaseClient,
  pairs: { crmId: string; shipmentDate: string }[]
): Promise<Set<string>> {
  const existing = new Set<string>();
  if (pairs.length === 0) return existing;

  const crmIds = [...new Set(pairs.map((p) => p.crmId))];
  const { data, error } = await supabase
    .from("crm_shipped_deal_metrics")
    .select("crm_id, shipment_date")
    .in("crm_id", crmIds);

  if (error) {
    console.error("listExistingMetricKeys:", error);
    return existing;
  }

  for (const row of data ?? []) {
    const crmId = typeof row.crm_id === "string" ? row.crm_id : "";
    const shipmentDate = String(row.shipment_date ?? "");
    if (crmId && shipmentDate) existing.add(metricKey(crmId, shipmentDate));
  }
  return existing;
}

/**
 * Збирає CRM-відвантаження з черги і upsert суми/маржі/валюти з KeepinCRM.
 */
export async function backfillCrmShippedDealMetrics(
  supabase: SupabaseClient
): Promise<Omit<BackfillCrmShippedDealMetricsResult, "success" | "error">> {
  const { data: rows, error } = await supabase
    .from("inventory_transactions")
    .select("notes, created_at")
    .eq("transaction_type", "shipment")
    .ilike("notes", "Відвантаження черги:%")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  type Candidate = {
    crmId: string;
    customerHint: string;
    shipmentDate: string;
    shippedAt: string;
  };

  const byKey = new Map<string, Candidate>();
  for (const row of rows ?? []) {
    const notes = typeof row.notes === "string" ? row.notes : "";
    const createdAt = typeof row.created_at === "string" ? row.created_at : "";
    if (!notes || !createdAt) continue;

    const ref = parseShipmentQueueNotesRef(notes);
    if (ref?.kind !== "crm") continue;

    const shipmentDate = createdAt.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shipmentDate)) continue;

    const key = metricKey(ref.crmId, shipmentDate);
    if (byKey.has(key)) continue;

    const customerHint = notes
      .replace(/^Відвантаження черги:\s*/i, "")
      .replace(/\s*,\s*угода\s+\S+\s*$/i, "")
      .replace(/\s*\[queue_rank:\d+\]\s*$/i, "")
      .trim();

    byKey.set(key, {
      crmId: ref.crmId,
      customerHint,
      shipmentDate,
      shippedAt: createdAt,
    });
  }

  const candidates = [...byKey.values()];
  const existing = await listExistingMetricKeys(
    supabase,
    candidates.map((c) => ({ crmId: c.crmId, shipmentDate: c.shipmentDate }))
  );

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const key = metricKey(candidate.crmId, candidate.shipmentDate);
    const alreadyExists = existing.has(key);

    try {
      const raw = await fetchKeepinAgreementRaw(candidate.crmId);
      if (!raw) {
        failed += 1;
        continue;
      }
      const parsed = parseKeepinAgreement(raw);
      if (!parsed) {
        failed += 1;
        continue;
      }

      const total_amount = parsed.total_amount ?? 0;
      const marge_amount = parsed.marge_amount ?? 0;
      const currency = parsed.currency || "UAH";
      const customer_name =
        parsed.customerName.trim() || candidate.customerHint || "";

      const { error: upsertErr } = await supabase.from("crm_shipped_deal_metrics").upsert(
        {
          crm_id: candidate.crmId,
          customer_name,
          total_amount,
          marge_amount,
          currency,
          shipment_date: candidate.shipmentDate,
          shipped_at: candidate.shippedAt,
        },
        { onConflict: "crm_id,shipment_date" }
      );

      if (upsertErr) {
        console.error("backfill upsert:", candidate.crmId, upsertErr.message);
        failed += 1;
        continue;
      }

      existing.add(key);
      if (alreadyExists) updated += 1;
      else inserted += 1;
    } catch (e) {
      console.error("backfill KeepinCRM:", candidate.crmId, e);
      failed += 1;
    }
  }

  return { inserted, updated, failed };
}

export async function backfillCrmShippedDealMetricsFromKeepinAction(): Promise<BackfillCrmShippedDealMetricsResult> {
  const user = await getServerUser();
  if (!user) {
    return {
      success: false,
      inserted: 0,
      updated: 0,
      failed: 0,
      error: "Потрібна авторизація",
    };
  }

  try {
    const supabase = await createServerClient();
    const result = await backfillCrmShippedDealMetrics(supabase);
    revalidatePath("/statistics");
    return { success: true, ...result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Не вдалося підтягнути угоди";
    return { success: false, inserted: 0, updated: 0, failed: 0, error: msg };
  }
}

export async function getCrmDealProfitabilityStats(
  period: "year" | "month" | "week" = "month",
  year?: number,
  dateRange?: StatisticsDateRange | null,
  eurUahRate?: number | null
): Promise<CrmDealProfitabilityStats> {
  const { startDay, endDay } = resolveRange(period, year, dateRange);
  const empty: CrmDealProfitabilityStats = {
    dealsCount: 0,
    revenueUah: 0,
    margeUah: 0,
    revenueEur: 0,
    margeEur: 0,
    revenueUahEquivalent: null,
    margeUahEquivalent: null,
    marginPercentEquivalent: null,
    startDay,
    endDay,
    deals: [],
  };

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("crm_shipped_deal_metrics")
    .select(
      "id, crm_id, customer_name, total_amount, marge_amount, currency, shipment_date, shipped_at"
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
      currency: normalizeCurrency(row.currency),
      margin_percent: crmDealMarginPercent(total_amount, marge_amount),
      shipment_date: String(row.shipment_date ?? ""),
      shipped_at: String(row.shipped_at ?? ""),
    };
  });

  let revenueUah = 0;
  let margeUah = 0;
  let revenueEur = 0;
  let margeEur = 0;

  for (const deal of deals) {
    if (deal.currency === "EUR") {
      revenueEur += deal.total_amount;
      margeEur += deal.marge_amount;
    } else {
      // UAH та інші поки агрегуємо як UAH (рідкісні валюти)
      revenueUah += deal.total_amount;
      margeUah += deal.marge_amount;
    }
  }

  revenueUah = Math.round(revenueUah * 100) / 100;
  margeUah = Math.round(margeUah * 100) / 100;
  revenueEur = Math.round(revenueEur * 100) / 100;
  margeEur = Math.round(margeEur * 100) / 100;

  const rate =
    eurUahRate != null && Number.isFinite(eurUahRate) && eurUahRate > 0
      ? eurUahRate
      : null;

  const revenueUahEquivalent =
    rate != null
      ? Math.round((revenueUah + convertEurToUah(revenueEur, rate)) * 100) / 100
      : null;
  const margeUahEquivalent =
    rate != null
      ? Math.round((margeUah + convertEurToUah(margeEur, rate)) * 100) / 100
      : null;

  return {
    dealsCount: deals.length,
    revenueUah,
    margeUah,
    revenueEur,
    margeEur,
    revenueUahEquivalent,
    margeUahEquivalent,
    marginPercentEquivalent: crmDealMarginPercent(
      revenueUahEquivalent,
      margeUahEquivalent
    ),
    startDay,
    endDay,
    deals,
  };
}
