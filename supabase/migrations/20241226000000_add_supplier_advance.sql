-- Аванс постачальника (сума передоплати)
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS advance numeric NOT NULL DEFAULT 0;
