-- Залишаємо тільки один запис "Мішок Пакувальний (кора)" типу material (найстаріший за id)
WITH duplicates AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY lower(name), product_type
        ORDER BY id
      ) AS rn
    FROM public.products
    WHERE product_type = 'material'
      AND lower(name) = lower('Мішок Пакувальний (кора)')
  ) t
  WHERE t.rn > 1
)
DELETE FROM public.products p
USING duplicates d
WHERE p.id = d.id;

-- Гарантуємо, що цей продукт більше не буде дублюватися
CREATE UNIQUE INDEX IF NOT EXISTS products_unique_packing_bag_material_idx
ON public.products ((lower(name)))
WHERE product_type = 'material'
  AND lower(name) = lower('Мішок Пакувальний (кора)');
