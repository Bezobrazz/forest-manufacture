-- Увімкнення RLS для таблиць, виявлених лінтером (rls_disabled_in_public)
ALTER TABLE public.supplier_advance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Доступ тільки для авторизованих користувачів (anon не бачать/не змінюють дані)
CREATE POLICY "Allow all for authenticated only" ON public.supplier_advance_transactions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.suppliers
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.supplier_deliveries
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.vehicles
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.warehouse_inventory
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.warehouses
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated only" ON public.trips
    FOR ALL USING (auth.role() = 'authenticated');
