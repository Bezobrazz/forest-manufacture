CREATE TABLE public.suppliers (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.supplier_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  supplier_id integer NOT NULL,
  product_id integer NOT NULL,
  warehouse_id integer NOT NULL,
  quantity numeric NOT NULL,
  price_per_unit numeric,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT supplier_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_deliveries_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id),
  CONSTRAINT supplier_deliveries_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT supplier_deliveries_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id)
);

CREATE INDEX supplier_deliveries_supplier_id_idx ON public.supplier_deliveries(supplier_id);
CREATE INDEX supplier_deliveries_product_id_idx ON public.supplier_deliveries(product_id);
CREATE INDEX supplier_deliveries_warehouse_id_idx ON public.supplier_deliveries(warehouse_id);

