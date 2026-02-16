-- Історія операцій авансу постачальникам
CREATE TABLE public.supplier_advance_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  supplier_id integer NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT supplier_advance_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_advance_transactions_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);

CREATE INDEX supplier_advance_transactions_supplier_id_idx ON public.supplier_advance_transactions(supplier_id);
CREATE INDEX supplier_advance_transactions_created_at_idx ON public.supplier_advance_transactions(created_at DESC);
