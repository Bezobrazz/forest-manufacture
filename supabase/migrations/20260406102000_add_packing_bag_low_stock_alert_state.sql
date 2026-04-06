ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS packing_bag_low_alert_active boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS packing_bag_last_morning_alert_date date NULL;
