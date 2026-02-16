-- Заміна політик USING (true) на auth.role() = 'authenticated' (усуває rls_policy_always_true).
-- Таблиці: shifts, shift_employees, employees, production, products, product_categories,
-- inventory, inventory_transactions, tasks, expense_categories, expenses, settings.

DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.shifts;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.shift_employees;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.employees;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.production;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.products;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.product_categories;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.inventory;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.tasks;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.expense_categories;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.expenses;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.settings;

CREATE POLICY "Allow all for authenticated only" ON public.shifts
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.shift_employees
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.employees
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.production
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.products
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.product_categories
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.inventory
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.inventory_transactions
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.tasks
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.expense_categories
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.expenses
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated only" ON public.settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Політика INSERT для users: не WITH CHECK (true), а лише для запису з id = auth.uid() (тригер створює запис під поточним користувачем).
DROP POLICY IF EXISTS "Allow system to create users" ON public.users;
CREATE POLICY "Allow system to create users" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);
