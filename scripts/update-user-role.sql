-- ============================================
-- ОНОВЛЕННЯ РОЛІ КОРИСТУВАЧА В БД
-- ============================================
-- Цей скрипт показує, як додати або оновити роль користувача
-- Ролі: 'owner', 'admin', 'worker'

-- КРОК 1: Перевірка всіх користувачів та їх ролей
SELECT 
    u.id,
    u.email,
    u.role,
    u.created_at,
    au.email as auth_email
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
ORDER BY u.created_at DESC;

-- КРОК 2: Знайти користувача за email (якщо знаєте email)
-- Замініть 'user@example.com' на email користувача
SELECT 
    u.id,
    u.email,
    u.role
FROM public.users u
WHERE u.email = 'user@example.com';

-- КРОК 3: Оновити роль користувача за ID
-- Замініть 'USER_ID_HERE' на ID користувача
-- Замініть 'admin' на потрібну роль: 'owner', 'admin' або 'worker'
UPDATE public.users
SET role = 'admin'  -- 'owner', 'admin' або 'worker'
WHERE id = 'USER_ID_HERE';

-- КРОК 4: Оновити роль користувача за email
-- Замініть 'user@example.com' на email користувача
-- Замініть 'admin' на потрібну роль: 'owner', 'admin' або 'worker'
UPDATE public.users
SET role = 'admin'  -- 'owner', 'admin' або 'worker'
WHERE email = 'user@example.com';

-- КРОК 5: Перевірка після оновлення
SELECT 
    id,
    email,
    role,
    updated_at
FROM public.users
WHERE id = 'USER_ID_HERE';  -- або WHERE email = 'user@example.com'

-- КРОК 6: Створити запис користувача з роллю (якщо запису немає)
-- Використовуйте це, якщо користувач існує в auth.users, але немає в public.users
-- Замініть 'USER_ID_HERE' на ID з auth.users
-- Замініть 'user@example.com' на email користувача
-- Замініть 'admin' на потрібну роль
INSERT INTO public.users (id, email, role)
VALUES (
    'USER_ID_HERE',
    'user@example.com',
    'admin'  -- 'owner', 'admin' або 'worker'
)
ON CONFLICT (id) DO UPDATE
SET 
    role = EXCLUDED.role,
    email = COALESCE(EXCLUDED.email, public.users.email);

-- КРОК 7: Масове оновлення ролей (обережно!)
-- Наприклад, зробити всіх користувачів 'worker' (крім owner)
-- UPDATE public.users
-- SET role = 'worker'
-- WHERE role IS NULL OR role = '';

-- КРОК 8: Перевірка статистики ролей
SELECT 
    role,
    COUNT(*) as count
FROM public.users
GROUP BY role
ORDER BY 
    CASE role
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'worker' THEN 3
        ELSE 4
    END;





