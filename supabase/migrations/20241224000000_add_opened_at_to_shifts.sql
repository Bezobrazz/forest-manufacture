-- Додаємо поле opened_at в таблицю shifts для зберігання дати відкриття зміни
ALTER TABLE public.shifts 
ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- Встановлюємо opened_at = created_at для існуючих записів
UPDATE public.shifts 
SET opened_at = created_at 
WHERE opened_at IS NULL;

