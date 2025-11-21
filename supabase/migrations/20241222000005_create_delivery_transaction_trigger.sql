ALTER TABLE public.inventory_transactions 
DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE public.inventory_transactions 
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type = ANY (ARRAY['production'::text, 'shipment'::text, 'adjustment'::text, 'income'::text]));

CREATE OR REPLACE FUNCTION public.create_inventory_transaction_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.inventory_transactions (
    product_id,
    quantity,
    transaction_type,
    reference_id,
    warehouse_id,
    notes,
    created_at
  )
  VALUES (
    NEW.product_id,
    NEW.quantity,
    'income',
    CAST(NEW.id AS integer),
    NEW.warehouse_id,
    CONCAT('Supplier delivery #', NEW.id),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_deliveries_create_inventory_transaction
AFTER INSERT ON public.supplier_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.create_inventory_transaction_on_delivery();


