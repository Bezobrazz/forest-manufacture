CREATE TABLE IF NOT EXISTS public.packing_bag_purchases (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_date date NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  price_uah numeric NOT NULL CHECK (price_uah >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS packing_bag_purchases_user_id_idx
  ON public.packing_bag_purchases(user_id);

CREATE INDEX IF NOT EXISTS packing_bag_purchases_purchase_date_idx
  ON public.packing_bag_purchases(purchase_date DESC);

ALTER TABLE public.packing_bag_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own packing bag purchases" ON public.packing_bag_purchases;
CREATE POLICY "Users can read own packing bag purchases"
  ON public.packing_bag_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own packing bag purchases" ON public.packing_bag_purchases;
CREATE POLICY "Users can insert own packing bag purchases"
  ON public.packing_bag_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own packing bag purchases" ON public.packing_bag_purchases;
CREATE POLICY "Users can update own packing bag purchases"
  ON public.packing_bag_purchases
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own packing bag purchases" ON public.packing_bag_purchases;
CREATE POLICY "Users can delete own packing bag purchases"
  ON public.packing_bag_purchases
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_packing_bag_purchases_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_packing_bag_purchases_updated_at ON public.packing_bag_purchases;
CREATE TRIGGER trg_set_packing_bag_purchases_updated_at
BEFORE UPDATE ON public.packing_bag_purchases
FOR EACH ROW
EXECUTE FUNCTION public.set_packing_bag_purchases_updated_at();
