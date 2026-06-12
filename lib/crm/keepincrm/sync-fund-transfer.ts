import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFundTransferAppComment,
  getFundTransferFromPurseId,
  getFundTransferToPurseId,
  isConfiguredFundTransferPair,
  isFundTransferPushEnabled,
  isFundTransferSyncEnabled,
  resolveFundTransferPurseIds,
} from "@/lib/crm/keepincrm/fund-transfer-config";
import type { KeepinFinanceWebhookPayload } from "@/lib/crm/keepincrm/fund-transfer-types";
import {
  createKeepinFundTransfer,
  deleteKeepinFundTransfer,
  fetchKeepinPaymentsSince,
  isKeepinTransferListItem,
  mapKeepinTransferToLocalFields,
  updateKeepinFundTransfer,
} from "@/lib/crm/keepincrm/payments";
import type { FundTransfer, FundTransferSource } from "@/lib/types";

const RECONCILE_LOOKBACK_DAYS = 120;
/** Повний reconcile (cron): до 120 сторінок KeepinCRM. */
const CRON_RECONCILE_MAX_PAGES = 120;
/** Pull з UI: лише перші сторінки, щоб вкластися в ліміт Vercel (~10s). */
export const PULL_RECONCILE_MAX_PAGES = 8;

export type ReconcileFundTransfersOptions = {
  maxPages?: number;
  removeMissing?: boolean;
};

function parsePositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const amount = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parseAtYmd(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

export function parseFinanceWebhookPursePair(payload: KeepinFinanceWebhookPayload): {
  fromPurseId: number | null;
  toPurseId: number | null;
} {
  const explicitSource = parsePositiveInt(payload.source_purse_id);
  const explicitTarget = parsePositiveInt(payload.target_purse_id);
  const purseId = parsePositiveInt(payload.purse_id);

  if (explicitSource && explicitTarget) {
    return { fromPurseId: explicitSource, toPurseId: explicitTarget };
  }

  if (explicitTarget && purseId) {
    return { fromPurseId: purseId, toPurseId: explicitTarget };
  }

  if (purseId && explicitSource) {
    return { fromPurseId: explicitSource, toPurseId: purseId };
  }

  return { fromPurseId: null, toPurseId: null };
}

export function parseFinanceWebhookPayload(
  payload: KeepinFinanceWebhookPayload,
  configured: { fromPurseId: number; toPurseId: number }
): {
  keepinPaymentId: number;
  amount: number;
  atYmd: string;
  comment: string | null;
  fromPurseId: number;
  toPurseId: number;
  event: string;
  kind: string | null;
} | null {
  const keepinPaymentId = parsePositiveInt(payload.id);
  const amount = parseAmount(payload.amount);
  const atYmd = parseAtYmd(payload.at);
  const { fromPurseId, toPurseId } = parseFinanceWebhookPursePair(payload);

  if (!keepinPaymentId || !amount || !atYmd || !fromPurseId || !toPurseId) {
    return null;
  }

  if (!isConfiguredFundTransferPair(fromPurseId, toPurseId, configured)) {
    return null;
  }

  const kind =
    typeof payload.kind === "string" && payload.kind.trim()
      ? payload.kind.trim().toLowerCase()
      : null;

  if (kind && kind !== "transfer") {
    return null;
  }

  const event =
    typeof payload.event === "string" && payload.event.trim()
      ? payload.event.trim().toLowerCase()
      : "created";

  return {
    keepinPaymentId,
    amount,
    atYmd,
    comment: parseComment(payload.comment),
    fromPurseId,
    toPurseId,
    event,
    kind,
  };
}

export async function syncFundTransferToKeepin(input: {
  localId: number;
  amount: number;
  atYmd: string;
  comment?: string | null;
}): Promise<number | null> {
  if (!isFundTransferSyncEnabled() || !isFundTransferPushEnabled()) {
    return null;
  }

  const { fromPurseId, toPurseId } = await resolveFundTransferPurseIds();
  const comment = buildFundTransferAppComment(input.localId, input.comment);

  try {
    return await createKeepinFundTransfer({
      amount: input.amount,
      atYmd: input.atYmd,
      comment,
      fromPurseId,
      toPurseId,
    });
  } catch (error) {
    console.warn(
      "syncFundTransferToKeepin:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function syncFundTransferUpdateToKeepin(input: {
  keepinPaymentId: number;
  amount: number;
  atYmd: string;
  comment?: string | null;
  localId: number;
}): Promise<void> {
  if (!isFundTransferSyncEnabled() || !isFundTransferPushEnabled()) {
    return;
  }

  try {
    const fromPurseId = await getFundTransferFromPurseId();
    const toPurseId = await getFundTransferToPurseId();
    await updateKeepinFundTransfer(input.keepinPaymentId, {
      amount: input.amount,
      atYmd: input.atYmd,
      comment: buildFundTransferAppComment(input.localId, input.comment),
      fromPurseId,
      toPurseId,
    });
  } catch (error) {
    console.warn(
      "syncFundTransferUpdateToKeepin:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function syncFundTransferDeleteToKeepin(
  keepinPaymentId: number | null | undefined
): Promise<void> {
  if (
    !isFundTransferSyncEnabled() ||
    !isFundTransferPushEnabled() ||
    !keepinPaymentId
  ) {
    return;
  }

  try {
    await deleteKeepinFundTransfer(keepinPaymentId);
  } catch (error) {
    console.warn(
      "syncFundTransferDeleteToKeepin:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function upsertFundTransferFromKeepin(
  supabase: SupabaseClient,
  input: {
    keepinPaymentId: number;
    amount: number;
    atYmd: string;
    comment?: string | null;
    fromPurseId: number;
    toPurseId: number;
    source?: FundTransferSource;
  }
): Promise<FundTransfer | null> {
  const transferredAt =
    input.atYmd.length === 10 ? `${input.atYmd}T12:00:00.000Z` : input.atYmd;

  const { data: existing } = await supabase
    .from("fund_transfers")
    .select("*")
    .eq("keepin_payment_id", input.keepinPaymentId)
    .maybeSingle();

  const row = {
    amount: input.amount,
    transferred_at: transferredAt,
    comment: input.comment?.trim() || null,
    from_purse_id: input.fromPurseId,
    to_purse_id: input.toPurseId,
    keepin_payment_id: input.keepinPaymentId,
    source: input.source ?? "crm",
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("fund_transfers")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as FundTransfer;
  }

  const { data, error } = await supabase
    .from("fund_transfers")
    .insert([{ ...row, created_at: new Date().toISOString() }])
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as FundTransfer;
}

export async function deleteFundTransferByKeepinPaymentId(
  supabase: SupabaseClient,
  keepinPaymentId: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("fund_transfers")
    .delete()
    .eq("keepin_payment_id", keepinPaymentId)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) && data.length > 0;
}

function reconcileSinceYmd(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - RECONCILE_LOOKBACK_DAYS);
  return date.toISOString().slice(0, 10);
}

export async function reconcileFundTransfersWithKeepin(
  supabase: SupabaseClient,
  options: ReconcileFundTransfersOptions = {}
): Promise<{ upserted: number; removed: number; scanned: number }> {
  if (!isFundTransferSyncEnabled()) {
    return { upserted: 0, removed: 0, scanned: 0 };
  }

  const configured = await resolveFundTransferPurseIds();
  const maxPages = options.maxPages ?? CRON_RECONCILE_MAX_PAGES;
  const removeMissing = options.removeMissing ?? true;
  const { fromPurseId, toPurseId } = configured;
  const sinceYmd = reconcileSinceYmd();
  const payments = await fetchKeepinPaymentsSince(sinceYmd, maxPages);

  const transferItems = payments.filter((payment) =>
    isKeepinTransferListItem(payment, toPurseId)
  );

  let upserted = 0;

  for (const payment of transferItems) {
    const mapped = mapKeepinTransferToLocalFields(payment);
    const existingByKeepin = await supabase
      .from("fund_transfers")
      .select("id, source")
      .eq("keepin_payment_id", mapped.keepinPaymentId)
      .maybeSingle();

    await upsertFundTransferFromKeepin(supabase, {
      keepinPaymentId: mapped.keepinPaymentId,
      amount: mapped.amount,
      atYmd: payment.at.slice(0, 10),
      comment: mapped.comment,
      fromPurseId,
      toPurseId,
      source: (existingByKeepin.data?.source as FundTransferSource | undefined) ?? "crm",
    });
    upserted += 1;
  }

  let removed = 0;

  if (removeMissing) {
    const crmIds = new Set(transferItems.map((item) => item.id));
    const { data: localRows, error: localError } = await supabase
      .from("fund_transfers")
      .select("id, keepin_payment_id, transferred_at")
      .not("keepin_payment_id", "is", null)
      .gte("transferred_at", `${sinceYmd}T00:00:00.000Z`);

    if (localError) {
      throw new Error(localError.message);
    }

    for (const row of localRows ?? []) {
      const keepinPaymentId = row.keepin_payment_id as number;
      if (!crmIds.has(keepinPaymentId)) {
        const { error } = await supabase.from("fund_transfers").delete().eq("id", row.id);
        if (error) {
          throw new Error(error.message);
        }
        removed += 1;
      }
    }
  }

  return { upserted, removed, scanned: transferItems.length };
}
