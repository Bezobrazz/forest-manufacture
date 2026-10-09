"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatDate, formatNumberWithUnit } from "@/lib/utils";

export type DubrovytsiaBalanceEntry = {
  id: number;
  bank_transaction_id: string;
  amount: number;
  currency: string;
  transaction_type: "C" | "D";
  transaction_date: string;
  counterpart_name: string | null;
  purpose: string | null;
  comment: string;
  account_iban: string | null;
  account_label: string | null;
  telegram_sent: boolean;
  created_at: string;
};

export type SubmitBankTxToDubrovytsiaInput = {
  bankTransactionId: string;
  amount: number;
  currency: string;
  transactionType: "C" | "D";
  transactionDate: string;
  counterpartName?: string | null;
  purpose?: string | null;
  comment: string;
  accountIban?: string | null;
  accountLabel?: string | null;
};

export type SubmitBankTxToDubrovytsiaResult =
  | { ok: true; entry: DubrovytsiaBalanceEntry; telegramSent: boolean }
  | { ok: false; error: string };

function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseAmount(value: number): number {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Сума має бути більше нуля");
  }
  return amount;
}

export async function getDubrovytsiaBalanceEntries(): Promise<
  DubrovytsiaBalanceEntry[]
> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("dubrovytsia_balance_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message ?? "Не вдалося завантажити записи Дубровиця");
  }

  return (data ?? []) as DubrovytsiaBalanceEntry[];
}

export async function submitBankTransactionToDubrovytsia(
  input: SubmitBankTxToDubrovytsiaInput
): Promise<SubmitBankTxToDubrovytsiaResult> {
  try {
    const comment = input.comment.trim();
    if (!comment) {
      return { ok: false, error: "Вкажіть коментар" };
    }

    const bankTransactionId = input.bankTransactionId.trim();
    if (!bankTransactionId) {
      return { ok: false, error: "Немає ID банківської транзакції" };
    }

    const amount = parseAmount(input.amount);
    const transactionType =
      input.transactionType === "C" || input.transactionType === "D"
        ? input.transactionType
        : null;
    if (!transactionType) {
      return { ok: false, error: "Некоректний тип операції" };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) {
      return { ok: false, error: "Некоректна дата операції" };
    }

    const supabase = await createServerClient();

    const { data: existing } = await supabase
      .from("dubrovytsia_balance_entries")
      .select("id")
      .eq("bank_transaction_id", bankTransactionId)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error: "Цю транзакцію вже додано до балансу Дубровиця",
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("dubrovytsia_balance_entries")
      .insert({
        bank_transaction_id: bankTransactionId,
        amount,
        currency: input.currency?.trim() || "UAH",
        transaction_type: transactionType,
        transaction_date: input.transactionDate,
        counterpart_name: input.counterpartName?.trim() || null,
        purpose: input.purpose?.trim() || null,
        comment: comment.slice(0, 1000),
        account_iban: input.accountIban?.trim() || null,
        account_label: input.accountLabel?.trim() || null,
        telegram_sent: false,
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      if (insertError?.code === "23505") {
        return {
          ok: false,
          error: "Цю транзакцію вже додано до балансу Дубровиця",
        };
      }
      return {
        ok: false,
        error: insertError?.message ?? "Не вдалося зберегти запис",
      };
    }

    const entry = inserted as DubrovytsiaBalanceEntry;
    const typeLabel = transactionType === "C" ? "Надходження" : "Списання";
    const amountLabel = formatNumberWithUnit(amount, "₴");
    const dateLabel = formatDate(`${input.transactionDate}T12:00:00`);

    const message = [
      `🏛 <b>Баланс Дубровиця</b>`,
      ``,
      `Сума: <b>${escapeTelegramHtml(amountLabel)}</b>`,
      `Тип: ${escapeTelegramHtml(typeLabel)}`,
      `Дата: <b>${escapeTelegramHtml(dateLabel)}</b>`,
      `Коментар: ${escapeTelegramHtml(comment)}`,
      input.counterpartName?.trim()
        ? `Контрагент: ${escapeTelegramHtml(input.counterpartName.trim())}`
        : null,
      input.accountLabel?.trim()
        ? `Рахунок: ${escapeTelegramHtml(input.accountLabel.trim())}`
        : null,
      input.purpose?.trim()
        ? `Призначення: ${escapeTelegramHtml(input.purpose.trim().slice(0, 200))}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    let telegramSent = false;
    try {
      telegramSent = await sendTelegramMessage(message);
      if (!telegramSent) {
        console.error(
          "[dubrovytsia] sendTelegramMessage returned false for entry",
          entry.id
        );
      }
    } catch (error) {
      console.error("[dubrovytsia] telegram notify failed:", error);
    }

    if (telegramSent) {
      await supabase
        .from("dubrovytsia_balance_entries")
        .update({ telegram_sent: true })
        .eq("id", entry.id);
      entry.telegram_sent = true;
    }

    revalidatePath("/expenses");

    return { ok: true, entry, telegramSent };
  } catch (error) {
    console.error("[submitBankTransactionToDubrovytsia]", error);
    const message =
      error instanceof Error ? error.message : "Не вдалося відправити";
    return { ok: false, error: message };
  }
}
