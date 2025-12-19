CREATE OR REPLACE FUNCTION public.update_warehouse_inventory()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.warehouse_inventory (warehouse_id, product_id, quantity, updated_at)
  VALUES (NEW.warehouse_id, NEW.product_id, 0, NOW())
  ON CONFLICT (warehouse_id, product_id) DO NOTHING;

  IF NEW.transaction_type = 'production' THEN
    UPDATE public.warehouse_inventory
    SET quantity = quantity + NEW.quantity,
        updated_at = NOW()
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id;
  ELSIF NEW.transaction_type = 'shipment' THEN
    UPDATE public.warehouse_inventory
    SET quantity = quantity - NEW.quantity,
        updated_at = NOW()
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id;
  ELSIF NEW.transaction_type = 'adjustment' THEN
    UPDATE public.warehouse_inventory
    SET quantity = quantity + NEW.quantity,
        updated_at = NOW()
    WHERE warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_transactions_update_warehouse_inventory
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_warehouse_inventory();




