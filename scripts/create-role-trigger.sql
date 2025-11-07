-- ============================================
-- СТВОРЕННЯ ТРИГЕРА ДЛЯ АВТОМАТИЧНОГО ВСТАНОВЛЕННЯ РОЛІ
-- ============================================
-- ВИКОНАЙТЕ ПІСЛЯ ПЕРЕВІРКИ CHECK ОБМЕЖЕННЯ!

-- КРОК 1: Спочатку перевірте визначення CHECK обмеження
-- Виконайте це перед створенням тригера!
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid, true) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass
AND conname = 'users_role_check';

-- КРОК 2: Перевірте, чи існує вже тригер для ролі
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
AND (trigger_name LIKE '%role%' OR action_statement LIKE '%role%');

-- КРОК 3: Створення функції тригера
-- Ця функція автоматично встановлює роль 'authenticated' при створенні користувача
CREATE OR REPLACE FUNCTION auth.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Встановлюємо роль 'authenticated' якщо вона NULL або порожня
  -- Примітка: Перевірте визначення CHECK обмеження, щоб використати правильне значення
  -- Зазвичай для зареєстрованих користувачів це 'authenticated'
  IF NEW.role IS NULL OR NEW.role = '' OR NEW.role NOT IN ('authenticated', 'service_role', 'anon') THEN
    NEW.role := 'authenticated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- КРОК 4: Створення тригера
-- Тригер виконується ПЕРЕД вставкою нового користувача
CREATE TRIGGER set_user_role_on_insert
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.handle_new_user_role();

-- КРОК 5: Перевірка, що тригер створено
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
AND trigger_name = 'set_user_role_on_insert';

-- КРОК 6: Тестування (опціонально)
-- Спробуйте створити користувача через реєстрацію
-- Або перевірте, чи працює тригер:
-- SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- КРОК 7: Якщо потрібно видалити тригер (якщо щось пішло не так)
/*
DROP TRIGGER IF EXISTS set_user_role_on_insert ON auth.users;
DROP FUNCTION IF EXISTS auth.handle_new_user_role();
*/

