-- Атомарне закриття зміни: інвентар + транзакції + статус зміни в одній транзакції.
-- Усуває подвоєння залишку при частковому збої та повторному виклику (друга спроба — «вже завершена»).

CREATE OR REPLACE FUNCTION public.complete_shift_apply_production(p_shift_id integer)
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

  IF v_shift.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Зміна вже завершена'
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

    IF FOUND THEN
      UPDATE public.inventory
      SET
        quantity = COALESCE(v_curr, 0) + r.qty,
        updated_at = timezone('utc'::text, now())
      WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.inventory (
        product_id,
        quantity,
        created_at,
        updated_at
      )
      VALUES (
        r.product_id,
        r.qty,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
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
      r.product_id,
      r.qty,
      'production',
      p_shift_id,
      format(
        'Виробництво на зміні #%s (автоматичне додавання при закритті зміни)',
        p_shift_id
      ),
      v_wh_id,
      timezone('utc'::text, now())
    );
  END LOOP;

  UPDATE public.shifts
  SET
    status = 'completed',
    completed_at = timezone('utc'::text, now())
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

REVOKE ALL ON FUNCTION public.complete_shift_apply_production(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_shift_apply_production(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_shift_apply_production(integer) TO service_role;

COMMENT ON FUNCTION public.complete_shift_apply_production(integer) IS
  'Закриває зміну: додає виробництво в inventory, створює inventory_transactions (тригер на warehouse_inventory), виставляє shifts.status = completed — все атомарно.';
