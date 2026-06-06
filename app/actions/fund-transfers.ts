"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { dateToYYYYMMDD } from "@/lib/utils";
import {
  getFundTransferFromPurseId,
  getFundTransferToPurseId,
  isFundTransferPushEnabled,
  isFundTransferSyncEnabled,
} from "@/lib/crm/keepincrm/fund-transfer-config";
import {
  reconcileFundTransfersWithKeepin,
  syncFundTransferDeleteToKeepin,
  syncFundTransferToKeepin,
  syncFundTransferUpdateToKeepin,
} from "@/lib/crm/keepincrm/sync-fund-transfer";
import type { FundTransfer } from "@/lib/types";

function parseAmount(value: number): number {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Сума має бути більше нуля");
  }
  return amount;
}

function parseTransferredAt(date?: string): { iso: string; ymd: string } {
  const ymdMatch = date?.match(/^(\d{4}-\d{2}-\d{2})/);
  let ymd = ymdMatch?.[1] ?? null;

  if (!ymd && date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Некоректна дата переміщення");
    }
    ymd = dateToYYYYMMDD(parsed);
  }

  if (!ymd) {
    ymd = dateToYYYYMMDD(new Date());
  }

  const todayYmd = dateToYYYYMMDD(new Date());
  if (ymd > todayYmd) {
    throw new Error("Дата переміщення не може бути в майбутньому");
  }

  const iso = `${ymd}T12:00:00.000Z`;
  return { iso, ymd };
}

function normalizeComment(comment?: string | null): string | null {
  if (!comment?.trim()) return null;
  return comment.trim().slice(0, 500);
}

export async function getFundTransfers(): Promise<FundTransfer[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("fund_transfers")
    .select("*")
    .order("transferred_at", { ascending: false });

  if (error) {
    console.error("getFundTransfers:", error);
    throw error;
  }

  return (data ?? []) as FundTransfer[];
}

export async function pullFundTransfersFromKeepin(): Promise<{
  upserted: number;
  removed: number;
  scanned: number;
}> {
  if (!isFundTransferSyncEnabled()) {
    return { upserted: 0, removed: 0, scanned: 0 };
  }

  const supabase = await createServerClient();
  const result = await reconcileFundTransfersWithKeepin(supabase);
  revalidatePath("/expenses");
  return result;
}

export async function createFundTransfer(input: {
  amount: number;
  date?: string;
  comment?: string | null;
}): Promise<{ transfer: FundTransfer; keepinSyncFailed: boolean }> {
  const supabase = await createServerClient();
  const amount = parseAmount(input.amount);
  const { iso, ymd } = parseTransferredAt(input.date);
  const comment = normalizeComment(input.comment);
  const fromPurseId = getFundTransferFromPurseId();
  const toPurseId = getFundTransferToPurseId();

  const { data: inserted, error: insertError } = await supabase
    .from("fund_transfers")
    .insert([
      {
        amount,
        transferred_at: iso,
        comment,
        from_purse_id: fromPurseId,
        to_purse_id: toPurseId,
        source: "app",
        keepin_payment_id: null,
      },
    ])
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Не вдалося створити переміщення");
  }

  let keepinPaymentId: number | null = null;
  let keepinSyncFailed = false;

  if (isFundTransferSyncEnabled() && isFundTransferPushEnabled()) {
    keepinPaymentId = await syncFundTransferToKeepin({
      localId: inserted.id,
      amount,
      atYmd: ymd,
      comment,
    });
    keepinSyncFailed = !keepinPaymentId;
  }

  if (keepinPaymentId) {
    const { data: linked, error: linkError } = await supabase
      .from("fund_transfers")
      .update({
        keepin_payment_id: keepinPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (linkError || !linked) {
      throw new Error(linkError?.message ?? "Не вдалося зберегти ID KeepinCRM");
    }

    revalidatePath("/expenses");
    return { transfer: linked as FundTransfer, keepinSyncFailed: false };
  }

  revalidatePath("/expenses");
  return { transfer: inserted as FundTransfer, keepinSyncFailed };
}

export async function updateFundTransfer(input: {
  id: number;
  amount: number;
  date?: string;
  comment?: string | null;
}): Promise<FundTransfer> {
  const supabase = await createServerClient();
  const amount = parseAmount(input.amount);
  const { iso, ymd } = parseTransferredAt(input.date);
  const comment = normalizeComment(input.comment);
  const fromPurseId = getFundTransferFromPurseId();
  const toPurseId = getFundTransferToPurseId();

  const { data: current, error: currentError } = await supabase
    .from("fund_transfers")
    .select("*")
    .eq("id", input.id)
    .single();

  if (currentError || !current) {
    throw new Error("Переміщення не знайдено");
  }

  const previous = current as FundTransfer;

  if (isFundTransferSyncEnabled() && previous.keepin_payment_id) {
    await syncFundTransferUpdateToKeepin({
      keepinPaymentId: previous.keepin_payment_id,
      amount,
      atYmd: ymd,
      comment,
      localId: previous.id,
    });
  }

  const { data, error } = await supabase
    .from("fund_transfers")
    .update({
      amount,
      transferred_at: iso,
      comment,
      from_purse_id: fromPurseId,
      to_purse_id: toPurseId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не вдалося оновити переміщення");
  }

  revalidatePath("/expenses");
  return data as FundTransfer;
}

export async function deleteFundTransfer(id: number): Promise<void> {
  const supabase = await createServerClient();

  const { data: current, error: currentError } = await supabase
    .from("fund_transfers")
    .select("*")
    .eq("id", id)
    .single();

  if (currentError || !current) {
    throw new Error("Переміщення не знайдено");
  }

  const row = current as FundTransfer;

  if (isFundTransferSyncEnabled() && row.keepin_payment_id) {
    await syncFundTransferDeleteToKeepin(row.keepin_payment_id);
  }

  const { error } = await supabase.from("fund_transfers").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/expenses");
}
