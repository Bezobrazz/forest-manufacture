-- Валюта угоди KeepinCRM для черги відвантажень і рентабельності

ALTER TABLE public.crm_orders
  ADD COLUMN IF NOT EXISTS currency text;

COMMENT ON COLUMN public.crm_orders.currency IS
  'Валюта угоди KeepinCRM (UAH, EUR, …)';

ALTER TABLE public.crm_shipped_deal_metrics
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UAH';

COMMENT ON COLUMN public.crm_shipped_deal_metrics.currency IS
  'Валюта суми/маржі з KeepinCRM (UAH, EUR, …)';

-- Один знімок на угоду+дату відвантаження
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_shipped_deal_metrics_crm_date
  ON public.crm_shipped_deal_metrics (crm_id, shipment_date);
