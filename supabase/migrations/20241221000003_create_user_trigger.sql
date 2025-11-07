-- ============================================
-- Створення тригера для автоматичного створення запису в public.users
-- ============================================
-- Цей тригер автоматично створює запис в public.users з роллю 'worker'
-- після створення користувача в auth.users

-- Функція тригера, яка створює запис в public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Створюємо запис в public.users з роллю за замовчуванням 'worker'
  -- Використовуємо ON CONFLICT для уникнення помилок, якщо запис вже існує
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    'worker' -- Роль за замовчуванням
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = COALESCE(EXCLUDED.email, public.users.email),
    -- Оновлюємо роль тільки якщо вона NULL або порожня
    role = CASE 
      WHEN public.users.role IS NULL OR public.users.role = '' 
      THEN EXCLUDED.role 
      ELSE public.users.role 
    END;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Логуємо помилку, але не блокуємо створення користувача в auth.users
    RAISE WARNING 'Error creating user record in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер виконується після створення користувача в auth.users
-- Використовуємо AFTER INSERT, щоб гарантувати, що користувач вже створений
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Коментар для документації
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Автоматично створює запис в public.users з роллю worker після створення користувача в auth.users';

