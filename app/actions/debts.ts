"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import type {
  Debt,
  DebtDirection,
  DebtRepayment,
  DebtWithRepayments,
} from "@/lib/debts/types";
import {
  convertDebtAmountToUah,
  convertUahToDebtCurrency,
  parseDebtCurrency,
  roundMoney,
  type DebtCurrency,
} from "@/lib/debts/currency";
import { fetchNbuDebtCurrencyRates } from "@/lib/exchange/nbu-rates";
import { dateToYYYYMMDD } from "@/lib/utils";

function parseAmount(value: number): number {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Сума має бути більше нуля");
  }
  return amount;
}

function parseDebtDate(date?: string): { iso: string; ymd: string } {
  const ymdMatch = date?.match(/^(\d{4}-\d{2}-\d{2})/);
  let ymd = ymdMatch?.[1] ?? null;

  if (!ymd && date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Некоректна дата");
    }
    ymd = dateToYYYYMMDD(parsed);
  }

  if (!ymd) {
    ymd = dateToYYYYMMDD(new Date());
  }

  const todayYmd = dateToYYYYMMDD(new Date());
  if (ymd > todayYmd) {
    throw new Error("Дата не може бути в майбутньому");
  }

  const iso = `${ymd}T12:00:00.000Z`;
  return { iso, ymd };
}

function normalizeCounterparty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Вкажіть контрагента");
  }
  return trimmed.slice(0, 200);
}

function normalizeComment(comment?: string | null): string | null {
  if (!comment?.trim()) return null;
  return comment.trim().slice(0, 500);
}

function parseDirection(value: string): DebtDirection {
  if (value === "we_owe" || value === "owed_to_us") {
    return value;
  }
  throw new Error("Некоректний тип боргу");
}

function mapDebtWithRepayments(
  debt: Debt,
  repayments: DebtRepayment[]
): DebtWithRepayments {
  const repaidAmount = repayments.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );
  const roundedRepaid = roundMoney(repaidAmount);
  const amountUah = roundMoney(Number(debt.amount));
  const remainingAmount = Math.max(0, roundMoney(amountUah - roundedRepaid));
  const currency = debt.currency ?? "UAH";
  const exchangeRate = Number(debt.exchange_rate ?? 1);

  return {
    ...debt,
    amount: amountUah,
    original_amount: roundMoney(Number(debt.original_amount ?? debt.amount)),
    currency,
    exchange_rate: exchangeRate,
    repayments,
    repaid_amount: roundedRepaid,
    remaining_amount: remainingAmount,
    remaining_original_amount: convertUahToDebtCurrency(
      remainingAmount,
      currency,
      exchangeRate
    ),
    is_closed: remainingAmount <= 0,
  };
}

async function resolveDebtAmounts(input: {
  originalAmount: number;
  currency: DebtCurrency;
}): Promise<{
  originalAmount: number;
  amountUah: number;
  exchangeRate: number;
}> {
  const originalAmount = parseAmount(input.originalAmount);
  const currency = parseDebtCurrency(input.currency);

  if (currency === "UAH") {
    return {
      originalAmount,
      amountUah: originalAmount,
      exchangeRate: 1,
    };
  }

  const rates = await fetchNbuDebtCurrencyRates();
  const snapshot = rates[currency];
  const amountUah = convertDebtAmountToUah(
    originalAmount,
    currency,
    snapshot.rate
  );

  return {
    originalAmount,
    amountUah,
    exchangeRate: snapshot.rate,
  };
}

export async function getDebtsWithRepayments(): Promise<DebtWithRepayments[]> {
  const supabase = await createServerClient();

  const { data: debts, error: debtsError } = await supabase
    .from("debts")
    .select("*")
    .order("debt_date", { ascending: false });

  if (debtsError) {
    console.error("getDebtsWithRepayments:", debtsError);
    throw new Error(debtsError.message ?? "Не вдалося завантажити борги");
  }

  const debtRows = (debts ?? []) as Debt[];
  if (debtRows.length === 0) {
    return [];
  }

  const debtIds = debtRows.map((row) => row.id);
  const { data: repayments, error: repaymentsError } = await supabase
    .from("debt_repayments")
    .select("*")
    .in("debt_id", debtIds)
    .order("repayment_date", { ascending: false });

  if (repaymentsError) {
    console.error("getDebtsWithRepayments repayments:", repaymentsError);
    throw new Error(
      repaymentsError.message ?? "Не вдалося завантажити погашення боргів"
    );
  }

  const repaymentsByDebt = new Map<number, DebtRepayment[]>();
  for (const row of (repayments ?? []) as DebtRepayment[]) {
    const list = repaymentsByDebt.get(row.debt_id) ?? [];
    list.push(row);
    repaymentsByDebt.set(row.debt_id, list);
  }

  return debtRows.map((debt) =>
    mapDebtWithRepayments(debt, repaymentsByDebt.get(debt.id) ?? [])
  );
}

export async function createDebt(input: {
  counterparty: string;
  amount: number;
  currency?: DebtCurrency;
  direction: DebtDirection;
  date?: string;
  comment?: string | null;
}): Promise<DebtWithRepayments> {
  const supabase = await createServerClient();
  const counterparty = normalizeCounterparty(input.counterparty);
  const direction = parseDirection(input.direction);
  const { iso } = parseDebtDate(input.date);
  const comment = normalizeComment(input.comment);
  const { originalAmount, amountUah, exchangeRate } = await resolveDebtAmounts({
    originalAmount: input.amount,
    currency: input.currency ?? "UAH",
  });

  const { data, error } = await supabase
    .from("debts")
    .insert([
      {
        counterparty,
        amount: amountUah,
        original_amount: originalAmount,
        currency: input.currency ?? "UAH",
        exchange_rate: exchangeRate,
        direction,
        debt_date: iso,
        comment,
      },
    ])
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не вдалося створити борг");
  }

  revalidatePath("/expenses");
  return mapDebtWithRepayments(data as Debt, []);
}

export async function updateDebt(input: {
  id: number;
  counterparty: string;
  amount: number;
  currency?: DebtCurrency;
  direction: DebtDirection;
  date?: string;
  comment?: string | null;
}): Promise<DebtWithRepayments> {
  const supabase = await createServerClient();
  const counterparty = normalizeCounterparty(input.counterparty);
  const direction = parseDirection(input.direction);
  const { iso } = parseDebtDate(input.date);
  const comment = normalizeComment(input.comment);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", input.id)
    .single();

  if (debtError || !debt) {
    throw new Error("Борг не знайдено");
  }

  const { data: repayments, error: repaymentsError } = await supabase
    .from("debt_repayments")
    .select("*")
    .eq("debt_id", input.id);

  if (repaymentsError) {
    throw new Error(repaymentsError.message);
  }

  const current = mapDebtWithRepayments(
    debt as Debt,
    (repayments ?? []) as DebtRepayment[]
  );

  const currency = input.currency ?? current.currency;
  const { originalAmount, amountUah, exchangeRate } = await resolveDebtAmounts({
    originalAmount: input.amount,
    currency,
  });

  if (amountUah < current.repaid_amount) {
    throw new Error(
      `Сума не може бути меншою за уже погашене (${current.repaid_amount.toFixed(2)} ₴)`
    );
  }

  const { data, error } = await supabase
    .from("debts")
    .update({
      counterparty,
      amount: amountUah,
      original_amount: originalAmount,
      currency,
      exchange_rate: exchangeRate,
      direction,
      debt_date: iso,
      comment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Не вдалося оновити борг");
  }

  revalidatePath("/expenses");
  return mapDebtWithRepayments(data as Debt, current.repayments);
}

export async function createDebtRepayment(input: {
  debtId: number;
  amount: number;
  date?: string;
  comment?: string | null;
}): Promise<DebtWithRepayments> {
  const supabase = await createServerClient();
  const amount = parseAmount(input.amount);
  const { iso } = parseDebtDate(input.date);
  const comment = normalizeComment(input.comment);

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", input.debtId)
    .single();

  if (debtError || !debt) {
    throw new Error("Борг не знайдено");
  }

  const { data: repayments, error: repaymentsError } = await supabase
    .from("debt_repayments")
    .select("*")
    .eq("debt_id", input.debtId);

  if (repaymentsError) {
    throw new Error(repaymentsError.message);
  }

  const current = mapDebtWithRepayments(
    debt as Debt,
    (repayments ?? []) as DebtRepayment[]
  );

  if (current.is_closed) {
    throw new Error("Борг уже повністю погашено");
  }

  if (amount > current.remaining_amount) {
    throw new Error(
      `Сума перевищує залишок (${current.remaining_amount.toFixed(2)} ₴)`
    );
  }

  const { error: insertError } = await supabase.from("debt_repayments").insert([
    {
      debt_id: input.debtId,
      amount,
      repayment_date: iso,
      comment,
    },
  ]);

  if (insertError) {
    throw new Error(insertError.message ?? "Не вдалося записати погашення");
  }

  await supabase
    .from("debts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.debtId);

  const updated = await getDebtsWithRepayments();
  const result = updated.find((row) => row.id === input.debtId);
  if (!result) {
    throw new Error("Не вдалося оновити дані боргу");
  }

  revalidatePath("/expenses");
  return result;
}

export async function deleteDebt(id: number): Promise<void> {
  const supabase = await createServerClient();

  const { data: repayments, error: repaymentsError } = await supabase
    .from("debt_repayments")
    .select("id")
    .eq("debt_id", id)
    .limit(1);

  if (repaymentsError) {
    throw new Error(repaymentsError.message);
  }

  if ((repayments ?? []).length > 0) {
    throw new Error("Неможливо видалити борг із записами погашення");
  }

  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/expenses");
}

export async function deleteDebtRepayment(id: number): Promise<void> {
  const supabase = await createServerClient();

  const { data: repayment, error: repaymentError } = await supabase
    .from("debt_repayments")
    .select("debt_id")
    .eq("id", id)
    .single();

  if (repaymentError || !repayment) {
    throw new Error("Запис погашення не знайдено");
  }

  const { error } = await supabase.from("debt_repayments").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("debts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", repayment.debt_id);

  revalidatePath("/expenses");
}
