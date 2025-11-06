-- ============================================
-- Додавання RLS для таблиці users
-- ============================================
-- Це виправляє проблему з доступом до таблиці users в middleware

-- Увімкнути RLS на таблиці users (якщо ще не увімкнено)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Видалити ВСІ існуючі політики (якщо вони є конфліктуючі)
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own data" ON public.users;
DROP POLICY IF EXISTS "Allow all operations for anon users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to read all users" ON public.users;
DROP POLICY IF EXISTS "auth_users_select" ON public.users;
DROP POLICY IF EXISTS "owner_full_access" ON public.users;

-- Політика: Користувачі можуть читати свої власні дані
CREATE POLICY "Users can read their own data" ON public.users
    FOR SELECT
    USING (auth.uid() = id);

-- Політика: Користувачі можуть оновлювати свої власні дані (опціонально)
CREATE POLICY "Users can update their own data" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Політика: Система може створювати записи користувачів (для тригера)
-- Використовуємо SECURITY DEFINER в тригері, тому це не потрібно,
-- але додамо для безпеки
CREATE POLICY "Allow system to create users" ON public.users
    FOR INSERT
    WITH CHECK (true);

-- Політика: Авторизовані користувачі можуть читати всі дані користувачів
-- Це необхідно для роботи middleware, який перевіряє ролі
-- Використовуємо auth.uid() для перевірки, що користувач авторизований
-- auth.uid() повертає id користувача з auth.users, якщо він авторизований
-- ВАЖЛИВО: auth.role() повертає роль з auth.users.role ('authenticated', 'anon', 'service_role')
-- а НЕ роль з public.users.role ('owner', 'admin', 'worker')
CREATE POLICY "Allow authenticated users to read all users" ON public.users
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
    
-- Політика: Власники мають повний доступ (для майбутнього використання)
-- Це дозволяє owner робити все з таблицею users
CREATE POLICY "Owner full access to users" ON public.users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'owner'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND u.role = 'owner'
        )
    );

