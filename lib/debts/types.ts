import type { DebtCurrency } from "@/lib/debts/currency";

export type DebtDirection = "we_owe" | "owed_to_us";

export type { DebtCurrency };

export interface Debt {
  id: number;
  counterparty: string;
  amount: number;
  original_amount: number;
  currency: DebtCurrency;
  exchange_rate: number;
  direction: DebtDirection;
  debt_date: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtRepayment {
  id: number;
  debt_id: number;
  amount: number;
  repayment_date: string;
  comment: string | null;
  created_at: string;
}

export interface DebtWithRepayments extends Debt {
  repayments: DebtRepayment[];
  repaid_amount: number;
  remaining_amount: number;
  remaining_original_amount: number;
  is_closed: boolean;
}
