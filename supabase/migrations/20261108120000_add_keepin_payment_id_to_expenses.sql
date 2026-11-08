ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS keepin_payment_id integer;

COMMENT ON COLUMN public.expenses.keepin_payment_id IS
  'ID витрати (payment) у KeepinCRM після синхронізації погашення доставки з Mini App';

CREATE INDEX IF NOT EXISTS expenses_keepin_payment_id_idx
  ON public.expenses (keepin_payment_id)
  WHERE keepin_payment_id IS NOT NULL;
