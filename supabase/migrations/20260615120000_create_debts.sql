CREATE TABLE IF NOT EXISTS public.debts (
  id serial PRIMARY KEY,
  counterparty text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  direction text NOT NULL CHECK (direction IN ('we_owe', 'owed_to_us')),
  debt_date timestamptz NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.debts IS
  'Облік боргів: ми винні або нам винні.';

COMMENT ON COLUMN public.debts.direction IS
  'we_owe — ми винні; owed_to_us — нам винні.';

CREATE INDEX IF NOT EXISTS debts_debt_date_idx
  ON public.debts (debt_date DESC);

CREATE TABLE IF NOT EXISTS public.debt_repayments (
  id serial PRIMARY KEY,
  debt_id integer NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  repayment_date timestamptz NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.debt_repayments IS
  'Повернення (погашення) боргів — часткові або повні.';

CREATE INDEX IF NOT EXISTS debt_repayments_debt_id_idx
  ON public.debt_repayments (debt_id);

CREATE INDEX IF NOT EXISTS debt_repayments_repayment_date_idx
  ON public.debt_repayments (repayment_date DESC);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated only" ON public.debts
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.debt_repayments
  FOR ALL USING (auth.role() = 'authenticated');
