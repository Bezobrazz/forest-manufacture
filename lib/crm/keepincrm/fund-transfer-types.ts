export type FundTransferSource = "app" | "crm";

export interface FundTransfer {
  id: number;
  amount: number;
  transferred_at: string;
  comment: string | null;
  from_purse_id: number;
  to_purse_id: number;
  keepin_payment_id: number | null;
  source: FundTransferSource;
  created_at: string;
  updated_at: string;
}

export type FundTransferInput = {
  amount: number;
  transferredAt: string;
  comment?: string | null;
};

export type KeepinFinanceWebhookPayload = {
  id?: unknown;
  amount?: unknown;
  at?: unknown;
  comment?: unknown;
  purse_id?: unknown;
  target_purse_id?: unknown;
  source_purse_id?: unknown;
  event?: unknown;
  kind?: unknown;
};
