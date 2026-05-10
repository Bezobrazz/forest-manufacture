-- Ручний пріоритет черги відвантажень (менше queue_rank = вище в черзі)

ALTER TABLE public.crm_orders ADD COLUMN IF NOT EXISTS queue_rank integer;

UPDATE public.crm_orders o
SET queue_rank = sub.rn
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (ORDER BY crm_created_at ASC) - 1)::integer AS rn
  FROM public.crm_orders
) sub
WHERE o.id = sub.id;

UPDATE public.crm_orders SET queue_rank = 0 WHERE queue_rank IS NULL;

ALTER TABLE public.crm_orders ALTER COLUMN queue_rank SET NOT NULL;
ALTER TABLE public.crm_orders ALTER COLUMN queue_rank SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_crm_orders_queue_rank ON public.crm_orders (queue_rank ASC, crm_created_at ASC);
