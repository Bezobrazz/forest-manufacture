CREATE TABLE IF NOT EXISTS public.raw_additional_debts (
  id serial PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  date_from date NOT NULL,
  date_to date NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT raw_additional_debts_date_range_chk CHECK (date_to >= date_from)
);

COMMENT ON TABLE public.raw_additional_debts IS
  'Додаткові борги за доставку сировини (не дублюються в debts; входять у залишок погашення по транспорту).';

COMMENT ON COLUMN public.raw_additional_debts.date_from IS
  'Початок періоду боргу (або єдина дата, якщо date_to = date_from).';

COMMENT ON COLUMN public.raw_additional_debts.date_to IS
  'Кінець періоду боргу.';

CREATE INDEX IF NOT EXISTS raw_additional_debts_vehicle_id_idx
  ON public.raw_additional_debts (vehicle_id);

CREATE INDEX IF NOT EXISTS raw_additional_debts_date_from_idx
  ON public.raw_additional_debts (date_from DESC);

ALTER TABLE public.raw_additional_debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated only" ON public.raw_additional_debts
  FOR ALL USING (auth.role() = 'authenticated');
