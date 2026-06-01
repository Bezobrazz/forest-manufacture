-- Симетричне видалення завершеної зміни: відкат inventory + warehouse_inventory (тригер)
-- і повернення мішків (кора), як при complete_shift_apply_production — атомарно.

CREATE OR REPLACE FUNCTION public.delete_shift_atomic(p_shift_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_wh_id integer;
  r record;
  v_inv_id integer;
  v_curr numeric;
  v_bark_qty numeric;
  v_bag_id integer;
BEGIN
  SELECT * INTO v_shift
  FROM public.shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Зміну не знайдено'
    );
  END IF;

  IF v_shift.status IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Можна видалити лише завершену зміну'
    );
  END IF;

  SELECT w.id
  INTO v_wh_id
  FROM public.warehouses w
  WHERE w.name ILIKE '%main%'
  ORDER BY w.id
  LIMIT 1;

  FOR r IN
    SELECT
      pr.product_id,
      pr.quantity::numeric AS qty
    FROM public.production pr
    INNER JOIN public.products p ON p.id = pr.product_id
    WHERE pr.shift_id = p_shift_id
  LOOP
    SELECT i.id, i.quantity
    INTO v_inv_id, v_curr
    FROM public.inventory i
    WHERE i.product_id = r.product_id
    ORDER BY i.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',
        format(
          'Немає запису inventory для продукту id=%s (зміна #%s)',
          r.product_id,
          p_shift_id
        )
      );
    END IF;

    UPDATE public.inventory
    SET
      quantity = COALESCE(v_curr, 0) - r.qty,
      updated_at = timezone('utc'::text, now())
    WHERE id = v_inv_id;

    INSERT INTO public.inventory_transactions (
      product_id,
      quantity,
      transaction_type,
      reference_id,
      notes,
      warehouse_id,
      created_at
    )
    VALUES (
      r.product_id,
      -r.qty,
      'adjustment',
      p_shift_id,
      format(
        'Видалення зміни #%s (відкат виробництва при видаленні зміни)',
        p_shift_id
      ),
      v_wh_id,
      timezone('utc'::text, now())
    );
  END LOOP;

  SELECT COALESCE(SUM(pr.quantity), 0)::numeric
  INTO v_bark_qty
  FROM public.production pr
  INNER JOIN public.products p ON p.id = pr.product_id
  WHERE pr.shift_id = p_shift_id
    AND (p.product_type = 'finished' OR p.product_type IS NULL)
    AND lower(p.name) LIKE '%кора%'
    AND lower(p.name) NOT LIKE '%мішок%'
    AND lower(p.name) NOT LIKE '%пакувальн%';

  IF v_bark_qty > 0 THEN
    SELECT p.id
    INTO v_bag_id
    FROM public.products p
    WHERE lower(p.name) = lower('Мішок Пакувальний (кора)')
      AND p.product_type = 'material'
    ORDER BY p.id
    LIMIT 1;

    IF v_bag_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',
        'Не знайдено матеріал «Мішок Пакувальний (кора)» для повернення на склад.'
      );
    END IF;

    IF v_wh_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error',
        'Не знайдено головний склад для повернення мішків.'
      );
    END IF;

    INSERT INTO public.inventory_transactions (
      product_id,
      quantity,
      transaction_type,
      reference_id,
      notes,
      warehouse_id,
      created_at
    )
    VALUES (
      v_bag_id,
      v_bark_qty,
      'adjustment',
      p_shift_id,
      format(
        'Повернення мішків (кора) при видаленні зміни #%s: %s шт',
        p_shift_id,
        v_bark_qty
      ),
      v_wh_id,
      timezone('utc'::text, now())
    );
  END IF;

  DELETE FROM public.production
  WHERE shift_id = p_shift_id;

  DELETE FROM public.shift_employees
  WHERE shift_id = p_shift_id;

  DELETE FROM public.shifts
  WHERE id = p_shift_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',
      SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_shift_atomic(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_shift_atomic(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_shift_atomic(integer) TO service_role;

COMMENT ON FUNCTION public.delete_shift_atomic(integer) IS
  'Видаляє завершену зміну: відкат inventory + adjustment tx (тригер warehouse_inventory), повернення мішків (кора), видалення production/shift_employees/shifts — атомарно.';
