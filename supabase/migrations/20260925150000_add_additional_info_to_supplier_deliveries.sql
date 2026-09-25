ALTER TABLE public.supplier_deliveries
  ADD COLUMN IF NOT EXISTS additional_info text;

COMMENT ON COLUMN public.supplier_deliveries.additional_info IS
  'Додаткова інформація до закупівлі (з Mini App або ERP).';
