"use server";

import {
  fetchPrivatAccountBalances,
  fetchPrivatTransactionsForPeriod,
  listPrivatAccounts,
} from "@/lib/bank/privatbank/client";
import type {
  BankAccountBalance,
  BankTransaction,
  PrivatAccount,
} from "@/lib/bank/privatbank/types";

export type GetBankTransactionsResult =
  | {
      ok: true;
      transactions: BankTransaction[];
      balances: BankAccountBalance[];
      accounts: PrivatAccount[];
    }
  | {
      ok: false;
      error: string;
      balances: BankAccountBalance[];
      accounts: PrivatAccount[];
    };

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function getPrivatBankAccounts(): Promise<
  | { ok: true; accounts: PrivatAccount[] }
  | { ok: false; error: string; accounts: PrivatAccount[] }
> {
  try {
    return { ok: true, accounts: listPrivatAccounts() };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не вдалося прочитати рахунки";
    return { ok: false, error: message, accounts: [] };
  }
}

export async function getBankTransactions(input: {
  startYmd: string;
  endYmd: string;
  accountIban?: string | null;
}): Promise<GetBankTransactionsResult> {
  let accounts: PrivatAccount[] = [];
  try {
    accounts = listPrivatAccounts();
  } catch {
    accounts = [];
  }

  let balances: BankAccountBalance[] = [];
  try {
    balances = await fetchPrivatAccountBalances({
      accountIban: input.accountIban ?? null,
    });
  } catch (error) {
    console.error("[getBankTransactions] balances", error);
  }

  try {
    if (!isYmd(input.startYmd) || !isYmd(input.endYmd)) {
      return {
        ok: false,
        error: "Некоректний формат дати (очікується YYYY-MM-DD)",
        balances,
        accounts,
      };
    }

    const transactions = await fetchPrivatTransactionsForPeriod({
      startYmd: input.startYmd,
      endYmd: input.endYmd,
      accountIban: input.accountIban ?? null,
    });

    return {
      ok: true,
      transactions,
      balances,
      accounts: accounts.length > 0 ? accounts : listPrivatAccounts(),
    };
  } catch (error) {
    console.error("[getBankTransactions]", error);
    const message =
      error instanceof Error
        ? error.message
        : "Не вдалося завантажити банківські транзакції";
    return { ok: false, error: message, balances, accounts };
  }
}
