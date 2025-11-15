-- ============================================
-- ТЕСТУВАННЯ ДОСТУПУ ДО ТАБЛИЦІ users
-- ============================================
-- Виконайте від імені авторизованого користувача
-- (в Supabase Dashboard це автоматично від імені service_role)

-- Перевірка, чи можна прочитати дані
SELECT 
    id,
    email,
    role,
    created_at
FROM public.users
LIMIT 5;

-- Перевірка auth.uid() - повинен повернути ваш ID якщо ви авторизовані
SELECT 
    auth.uid() as current_user_id,
    auth.role() as current_auth_role;

-- Перевірка, чи auth.uid() не NULL
SELECT 
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'Авторизований'
        ELSE 'Не авторизований'
    END as auth_status;





