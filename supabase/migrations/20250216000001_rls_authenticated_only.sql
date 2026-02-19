-- Заміна політик на доступ тільки для authenticated (ідемпотентно).
-- Видаляємо обидва варіанти назв, щоб не падало при повторному запуску.
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.supplier_advance_transactions;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.supplier_advance_transactions;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.supplier_deliveries;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.supplier_deliveries;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.vehicles;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.vehicles;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.warehouse_inventory;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.warehouse_inventory;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.warehouses;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.warehouses;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.trips;
DROP POLICY IF EXISTS "Allow all for authenticated only" ON public.trips;

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
