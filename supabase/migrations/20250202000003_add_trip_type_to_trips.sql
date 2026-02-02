ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_type text;

UPDATE public.trips
  SET trip_type = 'raw'
  WHERE trip_type IS NULL;

ALTER TABLE public.trips
  ALTER COLUMN trip_type SET NOT NULL,
  ALTER COLUMN trip_type SET DEFAULT 'raw';

ALTER TABLE public.trips
  ADD CONSTRAINT trips_trip_type_check
  CHECK (trip_type IN ('raw', 'commerce'));
