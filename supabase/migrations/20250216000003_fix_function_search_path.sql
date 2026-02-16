-- Фіксація search_path для функцій (усуває function_search_path_mutable).
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.create_inventory_transaction_on_delivery() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_warehouse_inventory() SET search_path = public;

-- Якщо є функція в app_auth (Supabase/кастомна схема):
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION app_auth.update_updated_at_column() SET search_path = app_auth';
EXCEPTION
  WHEN undefined_function OR undefined_object THEN NULL;
END $$;
