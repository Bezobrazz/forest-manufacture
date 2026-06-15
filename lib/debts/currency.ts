import type { Debt, DebtWithRepayments } from "@/lib/debts/types";

export type DebtCurrency = "UAH" | "USD" | "EUR";

export const DEBT_CURRENCIES: DebtCurrency[] = ["UAH", "USD", "EUR"];

export const DEBT_CURRENCY_LABELS: Record<DebtCurrency, string> = {
  UAH: "Гривня (₴)",
  USD: "Долар ($)",
  EUR: "Євро (€)",
};

export const DEBT_CURRENCY_SYMBOLS: Record<DebtCurrency, string> = {
  UAH: "₴",
  USD: "$",
  EUR: "€",
};

export function roundMoney(value: number): number {
  return Math.round(Number(value) * 100) / 100;
}

export function parseDebtCurrency(value: string): DebtCurrency {
  if (value === "UAH" || value === "USD" || value === "EUR") {
    return value;
  }
  throw new Error("Некоректна валюта");
}

export function convertDebtAmountToUah(
  originalAmount: number,
  currency: DebtCurrency,
  exchangeRate: number
): number {
  if (currency === "UAH") {
    return roundMoney(originalAmount);
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error("Некоректний курс валюти");
  }
  return roundMoney(originalAmount * exchangeRate);
}

export function convertUahToDebtCurrency(
  amountUah: number,
  currency: DebtCurrency,
  exchangeRate: number
): number {
  if (currency === "UAH") {
    return roundMoney(amountUah);
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error("Некоректний курс валюти");
  }
  return roundMoney(amountUah / exchangeRate);
}

export function formatDebtCurrencyAmount(
  amount: number,
  currency: DebtCurrency
): string {
  const symbol = DEBT_CURRENCY_SYMBOLS[currency];
  const formatted = roundMoney(amount).toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "UAH" ? `${formatted} ${symbol}` : `${formatted} ${symbol}`;
}

export function getDebtOriginalAmount(debt: Pick<Debt, "original_amount" | "amount" | "currency">): number {
  return Number(debt.original_amount ?? debt.amount);
}

export function getDebtRemainingOriginal(debt: DebtWithRepayments): number {
  return convertUahToDebtCurrency(
    debt.remaining_amount,
    debt.currency,
    debt.exchange_rate
  );
}

export function getDebtRepaidOriginal(debt: DebtWithRepayments): number {
  return convertUahToDebtCurrency(
    debt.repaid_amount,
    debt.currency,
    debt.exchange_rate
  );
}
