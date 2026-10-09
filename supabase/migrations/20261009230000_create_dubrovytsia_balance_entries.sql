CREATE TABLE IF NOT EXISTS public.dubrovytsia_balance_entries (
  id serial PRIMARY KEY,
  bank_transaction_id text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'UAH',
  transaction_type text NOT NULL CHECK (transaction_type IN ('C', 'D')),
  transaction_date date NOT NULL,
  counterpart_name text,
  purpose text,
  comment text NOT NULL,
  account_iban text,
  account_label text,
  telegram_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dubrovytsia_balance_entries_bank_tx_unique UNIQUE (bank_transaction_id)
);

COMMENT ON TABLE public.dubrovytsia_balance_entries IS
  'Операції з банківської виписки, відправлені на баланс Дубровиця.';

COMMENT ON COLUMN public.dubrovytsia_balance_entries.bank_transaction_id IS
  'ID транзакції ПриватБанку (ідемпотентність повторної відправки).';

CREATE INDEX IF NOT EXISTS dubrovytsia_balance_entries_created_at_idx
  ON public.dubrovytsia_balance_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS dubrovytsia_balance_entries_transaction_date_idx
  ON public.dubrovytsia_balance_entries (transaction_date DESC);

ALTER TABLE public.dubrovytsia_balance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated only" ON public.dubrovytsia_balance_entries
  FOR ALL USING (auth.role() = 'authenticated');
