-- Баланс матеріалів у постачальника (кількість "Матеріалів" на балансі)
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS materials_balance numeric NOT NULL DEFAULT 0;

-- У поставці: матеріали, передані постачальнику (категорія "Матеріали")
ALTER TABLE public.supplier_deliveries
ADD COLUMN IF NOT EXISTS material_product_id integer REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS material_quantity numeric;

CREATE INDEX IF NOT EXISTS supplier_deliveries_material_product_id_idx
ON public.supplier_deliveries(material_product_id);
