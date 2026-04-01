ALTER TABLE public.packing_bag_purchases
ADD COLUMN IF NOT EXISTS total_uah numeric;

UPDATE public.packing_bag_purchases
SET total_uah = ROUND((COALESCE(quantity, 0) * COALESCE(price_uah, 0))::numeric, 2)
WHERE total_uah IS NULL;

ALTER TABLE public.packing_bag_purchases
ALTER COLUMN total_uah SET NOT NULL;
