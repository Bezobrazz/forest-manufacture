-- Кількість працівників на зміні (замість вибору конкретних осіб)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS employee_count integer;

COMMENT ON COLUMN public.shifts.employee_count IS 'Кількість працівників на зміні (1–5).';

UPDATE public.shifts AS s
SET employee_count = LEAST(sub.cnt, 5)
FROM (
  SELECT shift_id, COUNT(*)::integer AS cnt
  FROM public.shift_employees
  GROUP BY shift_id
) AS sub
WHERE s.id = sub.shift_id
  AND s.employee_count IS NULL;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_employee_count_range;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_employee_count_range
  CHECK (employee_count IS NULL OR (employee_count >= 1 AND employee_count <= 5));
