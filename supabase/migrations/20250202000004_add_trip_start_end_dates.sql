ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_start_date date,
  ADD COLUMN IF NOT EXISTS trip_end_date date;

UPDATE public.trips
  SET trip_start_date = trip_date,
      trip_end_date = trip_date
  WHERE trip_start_date IS NULL OR trip_end_date IS NULL;

ALTER TABLE public.trips
  ALTER COLUMN trip_start_date SET NOT NULL,
  ALTER COLUMN trip_start_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN trip_end_date SET NOT NULL,
  ALTER COLUMN trip_end_date SET DEFAULT CURRENT_DATE;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_trip_end_after_start
  CHECK (trip_end_date >= trip_start_date);

CREATE INDEX IF NOT EXISTS trips_trip_start_date_idx ON public.trips(trip_start_date);
