-- Add cost column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2);

-- Add comment to the column
COMMENT ON COLUMN public.products.cost IS 'Вартість одиниці продукції';
