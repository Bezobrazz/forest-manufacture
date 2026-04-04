export const PACKING_BAG_PRODUCT_NAME = "Мішок Пакувальний (кора)";

export type PackingBagPurchase = {
  id: number;
  user_id: string;
  purchase_date: string;
  quantity: number;
  price_uah: number;
  total_uah: number;
  created_at: string;
  updated_at: string;
};
