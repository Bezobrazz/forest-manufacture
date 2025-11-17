ALTER TABLE public.products 
ADD COLUMN product_type text NOT NULL DEFAULT 'finished';

ALTER TABLE public.products 
ADD CONSTRAINT products_product_type_check 
CHECK (product_type IN ('finished', 'raw', 'material'));

