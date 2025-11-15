ALTER TABLE public.inventory_transactions 
ADD COLUMN warehouse_id integer REFERENCES public.warehouses(id);

UPDATE public.inventory_transactions 
SET warehouse_id = (SELECT id FROM public.warehouses WHERE name = 'Main warehouse' LIMIT 1);

CREATE INDEX inventory_transactions_warehouse_id_idx ON public.inventory_transactions(warehouse_id);

