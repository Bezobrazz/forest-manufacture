ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS bags_count integer;
