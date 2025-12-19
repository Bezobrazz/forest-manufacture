-- Прямий SQL запит для видалення користувача
-- Використайте цей SQL в Supabase Dashboard → SQL Editor
-- АБО через Supabase CLI з Service Role Key

DELETE FROM auth.users 
WHERE id = '9bf55386-9d41-412a-85ce-e7bbbd226ccb'
AND confirmation_token IS NULL;

-- Перевірка після видалення
SELECT COUNT(*) as deleted_count
FROM auth.users 
WHERE id = '9bf55386-9d41-412a-85ce-e7bbbd226ccb';








