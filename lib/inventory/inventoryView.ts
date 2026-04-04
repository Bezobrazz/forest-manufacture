import type { Inventory, Product } from "@/lib/types";

/** Рядки з legacy `inventory` + `warehouse_inventory`, як на вході merge. */
export type InventorySourceRow = Pick<
  Inventory,
  "id" | "product_id" | "quantity" | "updated_at"
> & {
  product?: Product;
};

/**
 * Готова продукція для відображення на складі: узгоджено з merge у getInventory.
 * Виключає матеріали та сирі позиції без ознак готової продукції.
 */
export function isFinishedProductRow(item: InventorySourceRow): boolean {
  const t = item.product?.product_type;
  const reward = item.product?.reward;
  return (
    t !== "material" &&
    (t === "finished" || (t === null && reward != null))
  );
}

/**
 * Збирає список для UI складу: готова продукція з legacy `inventory`,
 * матеріали з `warehouse_inventory` головного складу (як у getInventory).
 */
export function mergeInventoryForDisplay(
  oldInventoryRows: InventorySourceRow[],
  warehouseInventoryRows: InventorySourceRow[]
): Inventory[] {
  const result: Inventory[] = [];

  const finishedFromLegacy = oldInventoryRows.filter(isFinishedProductRow);
  result.push(...(finishedFromLegacy as Inventory[]));

  const materialsFromWarehouse = warehouseInventoryRows
    .filter((item) => item.product?.product_type === "material")
    .map(
      (item) =>
        ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          updated_at: item.updated_at,
          product: item.product,
        }) as Inventory
    );

  result.push(...materialsFromWarehouse);

  return result;
}
