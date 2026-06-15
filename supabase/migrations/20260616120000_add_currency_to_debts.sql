ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UAH'
    CHECK (currency IN ('UAH', 'USD', 'EUR')),
  ADD COLUMN IF NOT EXISTS original_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(12, 4) NOT NULL DEFAULT 1;

UPDATE public.debts
SET
  original_amount = amount,
  currency = 'UAH',
  exchange_rate = 1
WHERE original_amount IS NULL;

ALTER TABLE public.debts
  ALTER COLUMN original_amount SET NOT NULL;

COMMENT ON COLUMN public.debts.currency IS
  'Валюта боргу: UAH, USD або EUR.';

COMMENT ON COLUMN public.debts.original_amount IS
  'Сума боргу у вибраній валюті.';

COMMENT ON COLUMN public.debts.amount IS
  'Еквівалент боргу в гривні (для підсумків і погашень).';

COMMENT ON COLUMN public.debts.exchange_rate IS
  'Курс НБУ: скільки гривень за 1 одиницю валюти (1 для UAH).';
