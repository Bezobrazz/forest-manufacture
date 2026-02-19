-- Сума авансу, використана для цієї поставки (враховується лише аванс, внесений до дати поставки)
ALTER TABLE public.supplier_deliveries
ADD COLUMN IF NOT EXISTS advance_used numeric NOT NULL DEFAULT 0;

-- Для існуючих поставок: вважаємо, що було використано повну суму (стара логіка)
UPDATE public.supplier_deliveries
SET advance_used = quantity * COALESCE(price_per_unit, 0)
WHERE advance_used = 0;
