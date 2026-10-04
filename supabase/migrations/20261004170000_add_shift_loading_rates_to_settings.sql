-- Ставки витрат за підрахунок/завантаження на зміні (грн/мішок)
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS loading_count_rate_uah numeric(10, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS product_loading_rate_uah numeric(10, 2) NOT NULL DEFAULT 1.5;

COMMENT ON COLUMN public.settings.loading_count_rate_uah IS
  'Ставка підрахунку завантаження, грн за мішок';
COMMENT ON COLUMN public.settings.product_loading_rate_uah IS
  'Ставка завантаження продукції, грн за мішок';
