CREATE TABLE IF NOT EXISTS public.fund_transfers (
  id serial PRIMARY KEY,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  transferred_at timestamptz NOT NULL,
  comment text,
  from_purse_id integer NOT NULL,
  to_purse_id integer NOT NULL,
  keepin_payment_id integer UNIQUE,
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'crm')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fund_transfers IS
  'Переміщення коштів між гаманцями KeepinCRM (дзеркало CRM + локальні записи).';

COMMENT ON COLUMN public.fund_transfers.keepin_payment_id IS
  'ID платежу kind=transfer у KeepinCRM; ключ ідемпотентності для синхронізації.';

CREATE INDEX IF NOT EXISTS fund_transfers_transferred_at_idx
  ON public.fund_transfers (transferred_at DESC);

CREATE INDEX IF NOT EXISTS fund_transfers_keepin_payment_id_idx
  ON public.fund_transfers (keepin_payment_id)
  WHERE keepin_payment_id IS NOT NULL;

ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated only" ON public.fund_transfers
  FOR ALL USING (auth.role() = 'authenticated');
