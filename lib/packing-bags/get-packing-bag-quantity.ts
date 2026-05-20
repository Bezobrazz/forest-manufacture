import type { SupabaseClient } from "@supabase/supabase-js";
import { PACKING_BAG_PRODUCT_NAME } from "@/lib/packing-bags/packing-bag-purchase";

export async function getPackingBagQuantity(
  supabase: SupabaseClient
): Promise<number | null> {
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("name", PACKING_BAG_PRODUCT_NAME)
    .eq("product_type", "material")
    .limit(1)
    .maybeSingle();

  if (!product?.id) return null;

  const { data: rows, error } = await supabase
    .from("warehouse_inventory")
    .select("quantity")
    .eq("product_id", product.id);

  if (error) return null;

  return (rows ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
}
