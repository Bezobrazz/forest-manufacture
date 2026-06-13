ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS balance_after numeric;

COMMENT ON COLUMN public.inventory_transactions.balance_after IS
  'Залишок на складі після операції (для відвантажень з черги).';
