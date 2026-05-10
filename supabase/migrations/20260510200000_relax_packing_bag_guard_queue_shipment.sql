-- Дозволити списання «Мішок Пакувальний (кора)» з черги відвантажень (позначка в notes).

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

  IF COALESCE(NEW.notes, '') NOT ILIKE 'Списання мішків (кора) за виробництво на зміні #%'
     AND COALESCE(NEW.notes, '') NOT ILIKE 'Відвантаження черги:%'
  THEN
    RAISE EXCEPTION
      'Списання "%": дозволено лише при закритті зміні або з черги відвантажень.',
      v_product_name;
  END IF;

  RETURN NEW;
END;
$$;
