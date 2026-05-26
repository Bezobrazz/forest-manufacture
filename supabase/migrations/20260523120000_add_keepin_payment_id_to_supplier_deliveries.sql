ALTER TABLE public.supplier_deliveries
  ADD COLUMN IF NOT EXISTS keepin_payment_id integer;

COMMENT ON COLUMN public.supplier_deliveries.keepin_payment_id IS
  'ID платежу (витрати) в KeepinCRM, створеного при закупівлі сировини';
