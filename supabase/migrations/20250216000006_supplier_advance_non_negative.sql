-- Баланс авансу не може бути від'ємним
-- Спочатку виправляємо існуючі від'ємні значення
UPDATE public.suppliers
SET advance = 0
WHERE advance < 0;

ALTER TABLE public.suppliers
ADD CONSTRAINT suppliers_advance_non_negative
CHECK (advance >= 0);
