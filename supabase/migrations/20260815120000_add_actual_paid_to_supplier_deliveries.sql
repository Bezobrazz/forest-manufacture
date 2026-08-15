ALTER TABLE public.supplier_deliveries
  ADD COLUMN IF NOT EXISTS actual_paid numeric;

COMMENT ON COLUMN public.supplier_deliveries.actual_paid IS
  'Фактично сплачена сума. Якщо заповнена — пріоритетна над quantity * price_per_unit для витрат CRM і списання авансу.';
