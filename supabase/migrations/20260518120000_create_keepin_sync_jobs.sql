-- Статус ручної синхронізації KeepinCRM (спільний між serverless-інстансами)

CREATE TABLE IF NOT EXISTS public.keepin_sync_jobs (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'done', 'error')),
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  upserted integer NOT NULL DEFAULT 0,
  removed integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_keepin_sync_jobs_started_at
  ON public.keepin_sync_jobs (started_at DESC);

ALTER TABLE public.keepin_sync_jobs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.keepin_sync_jobs TO service_role;
