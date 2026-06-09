ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false;
