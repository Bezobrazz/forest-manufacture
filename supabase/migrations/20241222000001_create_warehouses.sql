CREATE TABLE public.warehouses (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT warehouses_pkey PRIMARY KEY (id)
);

CREATE TABLE public.warehouse_inventory (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  warehouse_id integer NOT NULL,
  product_id integer NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT warehouse_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_inventory_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE,
  CONSTRAINT warehouse_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT warehouse_inventory_warehouse_id_product_id_key UNIQUE (warehouse_id, product_id)
);

INSERT INTO public.warehouses (name) VALUES ('Main warehouse');

