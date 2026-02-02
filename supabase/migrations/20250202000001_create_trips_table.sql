CREATE TABLE public.trips (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL,
  trip_date date NOT NULL,
  start_odometer_km numeric,
  end_odometer_km numeric,
  fuel_consumption_l_per_100km numeric,
  fuel_price_uah_per_l numeric,
  depreciation_uah_per_km numeric,
  days_count integer NOT NULL DEFAULT 1,
  daily_taxes_uah numeric DEFAULT 150,
  freight_uah numeric DEFAULT 0,
  driver_pay_mode text NOT NULL DEFAULT 'per_trip' CHECK (driver_pay_mode IN ('per_trip', 'per_day')),
  driver_pay_uah numeric DEFAULT 0,
  driver_pay_uah_per_day numeric DEFAULT 0,
  extra_costs_uah numeric DEFAULT 0,
  notes text,
  distance_km numeric,
  fuel_used_l numeric,
  fuel_cost_uah numeric,
  depreciation_cost_uah numeric,
  taxes_cost_uah numeric,
  driver_cost_uah numeric,
  total_costs_uah numeric,
  profit_uah numeric,
  profit_per_km_uah numeric,
  roi_percent numeric,
  CONSTRAINT trips_pkey PRIMARY KEY (id),
  CONSTRAINT trips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT trips_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE
);

CREATE INDEX trips_user_id_idx ON public.trips(user_id);
CREATE INDEX trips_vehicle_id_idx ON public.trips(vehicle_id);
CREATE INDEX trips_trip_date_idx ON public.trips(trip_date);
