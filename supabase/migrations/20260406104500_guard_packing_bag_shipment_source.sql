-- Guard: "Мішок Пакувальний (кора)" can be shipped only by shift completion flow.
-- This prevents accidental future deductions from trips or other custom flows.

CREATE OR REPLACE FUNCTION public.guard_packing_bag_shipment_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_name text;
BEGIN
  IF NEW.transaction_type IS DISTINCT FROM 'shipment' THEN
    RETURN NEW;
  END IF;

  SELECT p.name
  INTO v_product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF lower(COALESCE(v_product_name, '')) <> lower('Мішок Пакувальний (кора)') THEN
    RETURN NEW;
  END IF;

  -- Allowed only from complete_shift_apply_production flow.
  IF COALESCE(NEW.notes, '') NOT ILIKE 'Списання мішків (кора) за виробництво на зміні #%'
  THEN
    RAISE EXCEPTION
      'Списання "%": дозволено лише при закритті зміни. Поїздки не повинні списувати пакувальні мішки.',
      v_product_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_packing_bag_shipment_source ON public.inventory_transactions;

CREATE TRIGGER trg_guard_packing_bag_shipment_source
BEFORE INSERT OR UPDATE ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.guard_packing_bag_shipment_source();
