-- Керовані доступи Mini App (робітники без ERP-логіна)

CREATE TABLE IF NOT EXISTS public.mini_app_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  telegram_id bigint,
  telegram_username text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'blocked')),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  linked_at timestamptz,
  blocked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS mini_app_accesses_telegram_id_unique
  ON public.mini_app_accesses (telegram_id)
  WHERE telegram_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mini_app_accesses_status_idx
  ON public.mini_app_accesses (status);

CREATE TABLE IF NOT EXISTS public.mini_app_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.mini_app_accesses (id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mini_app_invite_codes_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS mini_app_invite_codes_access_id_idx
  ON public.mini_app_invite_codes (access_id);

ALTER TABLE public.supplier_deliveries
  ADD COLUMN IF NOT EXISTS created_by_access_id uuid
    REFERENCES public.mini_app_accesses (id) ON DELETE SET NULL;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS created_by_access_id uuid
    REFERENCES public.mini_app_accesses (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS supplier_deliveries_created_by_access_id_idx
  ON public.supplier_deliveries (created_by_access_id);

CREATE INDEX IF NOT EXISTS trips_created_by_access_id_idx
  ON public.trips (created_by_access_id);

ALTER TABLE public.mini_app_accesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mini_app_invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage mini_app_accesses" ON public.mini_app_accesses;
CREATE POLICY "Admins manage mini_app_accesses"
  ON public.mini_app_accesses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Authenticated read mini_app_accesses" ON public.mini_app_accesses;
CREATE POLICY "Authenticated read mini_app_accesses"
  ON public.mini_app_accesses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage mini_app_invite_codes" ON public.mini_app_invite_codes;
CREATE POLICY "Admins manage mini_app_invite_codes"
  ON public.mini_app_invite_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE public.mini_app_accesses IS 'Іменовані доступи до Telegram Mini App без логіна ERP';
COMMENT ON COLUMN public.supplier_deliveries.created_by_access_id IS 'Хто вніс через Mini App';
COMMENT ON COLUMN public.trips.created_by_access_id IS 'Хто вніс через Mini App';
