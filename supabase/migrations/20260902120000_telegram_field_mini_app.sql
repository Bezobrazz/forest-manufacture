-- Польове внесення через Telegram Mini App: прив’язка telegram_id до ERP-користувача

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telegram_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_id_unique
  ON public.users (telegram_id)
  WHERE telegram_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_link_codes_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS telegram_link_codes_user_id_idx
  ON public.telegram_link_codes (user_id);

CREATE INDEX IF NOT EXISTS telegram_link_codes_expires_at_idx
  ON public.telegram_link_codes (expires_at);

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own telegram link codes" ON public.telegram_link_codes;
CREATE POLICY "Users manage own telegram link codes"
  ON public.telegram_link_codes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON COLUMN public.users.telegram_id IS 'Telegram user id після прив’язки через бота (/start КОД)';
COMMENT ON TABLE public.telegram_link_codes IS 'Одноразові коди прив’язки Telegram (10 хв)';

CREATE OR REPLACE FUNCTION public.protect_users_telegram_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.telegram_id IS DISTINCT FROM OLD.telegram_id THEN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'telegram_id can only be changed by the service role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_users_telegram_id ON public.users;
CREATE TRIGGER protect_users_telegram_id
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_users_telegram_id();
