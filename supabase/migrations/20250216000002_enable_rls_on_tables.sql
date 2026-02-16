-- Увімкнення RLS на таблицях (політики вже створені в 20250216000001).
-- Ідемпотентно: увімкнення лише якщо RLS ще не увімкнено.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'supplier_advance_transactions', 'suppliers', 'supplier_deliveries',
    'vehicles', 'warehouse_inventory', 'warehouses', 'trips'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
