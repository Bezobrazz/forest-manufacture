-- Enable RLS on all tables
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shifts table
CREATE POLICY "Allow all operations for anon users" ON public.shifts
    FOR ALL USING (true);

-- Create RLS policies for shift_employees table
CREATE POLICY "Allow all operations for anon users" ON public.shift_employees
    FOR ALL USING (true);

-- Create RLS policies for employees table
CREATE POLICY "Allow all operations for anon users" ON public.employees
    FOR ALL USING (true);

-- Create RLS policies for production table
CREATE POLICY "Allow all operations for anon users" ON public.production
    FOR ALL USING (true);

-- Create RLS policies for products table
CREATE POLICY "Allow all operations for anon users" ON public.products
    FOR ALL USING (true);

-- Create RLS policies for product_categories table
CREATE POLICY "Allow all operations for anon users" ON public.product_categories
    FOR ALL USING (true);

-- Create RLS policies for inventory table
CREATE POLICY "Allow all operations for anon users" ON public.inventory
    FOR ALL USING (true);

-- Create RLS policies for inventory_transactions table
CREATE POLICY "Allow all operations for anon users" ON public.inventory_transactions
    FOR ALL USING (true);

-- Create RLS policies for tasks table
CREATE POLICY "Allow all operations for anon users" ON public.tasks
    FOR ALL USING (true);

-- Create RLS policies for expense_categories table
CREATE POLICY "Allow all operations for anon users" ON public.expense_categories
    FOR ALL USING (true);

-- Create RLS policies for expenses table
CREATE POLICY "Allow all operations for anon users" ON public.expenses
    FOR ALL USING (true);

-- Create RLS policies for settings table
CREATE POLICY "Allow all operations for anon users" ON public.settings
    FOR ALL USING (true);
