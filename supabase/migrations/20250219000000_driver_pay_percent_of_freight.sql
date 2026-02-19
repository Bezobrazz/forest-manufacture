ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_driver_pay_mode_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_driver_pay_mode_check
  CHECK (driver_pay_mode IN ('per_trip', 'per_day', 'percent_of_freight'));

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS driver_pay_percent_of_freight numeric;
