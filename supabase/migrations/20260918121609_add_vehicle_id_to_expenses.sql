ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS vehicle_id uuid
  REFERENCES public.vehicles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.expenses.vehicle_id IS
  'Транспорт для погашень доставки сировини; NULL = нерозподілене';
