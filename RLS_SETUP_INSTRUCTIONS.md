# Інструкції для налаштування RLS (Row Level Security)

## Проблема

Усі таблиці в схемі `public` не мають увімкненого Row Level Security (RLS), що є серйозною проблемою безпеки.

## Рішення

### Варіант 1: Через Supabase Dashboard (Рекомендовано)

1. Відкрийте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейдіть до розділу **SQL Editor**
3. Виконайте наступний SQL код:

```sql
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
```

### Варіант 2: Через Supabase CLI

Якщо ви хочете налаштувати Supabase CLI:

1. Встановіть Supabase CLI:

```bash
npm install -g supabase
```

2. Увійдіть в Supabase:

```bash
supabase login
```

3. Підключіть проект:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

4. Застосуйте міграцію:

```bash
supabase db push
```

## Що роблять ці політики?

- **ENABLE ROW LEVEL SECURITY**: Увімкнює RLS для кожної таблиці
- **CREATE POLICY**: Створює політики, які дозволяють всім користувачам (включаючи анонімних) виконувати всі операції (SELECT, INSERT, UPDATE, DELETE) з таблицями
- **USING (true)**: Означає, що політика завжди дозволяє доступ (для додатків без авторизації)

## Перевірка

Після застосування міграції:

1. Перейдіть до розділу **Database** → **Linter** в Supabase Dashboard
2. Перевірте, що всі помилки RLS зникли
3. Протестуйте ваш додаток, щоб переконатися, що все працює правильно

## Важливо

- Ці політики дозволяють доступ всім користувачам (включаючи анонімних) - ідеально для додатків без авторизації
- Якщо вам потрібні більш складні правила доступу, ви можете модифікувати політики відповідно до ваших потреб
- Рекомендується протестувати додаток після застосування цих змін
- Якщо в майбутньому ви додасте авторизацію, можна буде оновити політики для більш строгого контролю доступу
