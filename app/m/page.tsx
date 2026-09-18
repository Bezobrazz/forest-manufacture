import {
  getMaterials,
  getProductsByCategoryName,
  getSuppliers,
  getWarehouses,
} from "@/app/actions";
import { getLastUsedVehicleId } from "@/app/trips/actions";
import { getVehicles } from "@/app/vehicles/actions";
import { FieldDeliveryForm } from "@/components/m/field-delivery-form";

const DEFAULT_RAW_MATERIAL_NAME = "Кора Сировина";
const DEFAULT_PACKING_MATERIAL_NAME = "Мішок для сировини (білий)";

function findIdByName<T extends { id: number; name: string }>(
  items: T[],
  name: string
): string {
  const normalized = name.toLowerCase().trim();
  const found = items.find(
    (item) => item.name.toLowerCase().trim() === normalized
  );
  return found ? String(found.id) : items[0] ? String(items[0].id) : "";
}

export default async function MiniAppHomePage() {
  const [suppliers, warehouses, materials, packingMaterials, vehicles, lastVehicleId] =
    await Promise.all([
      getSuppliers(),
      getWarehouses(),
      getMaterials(),
      getProductsByCategoryName("Матеріали"),
      getVehicles(),
      getLastUsedVehicleId(),
    ]);

  const warehouseId = String(
    warehouses.find((w) => w.name.toLowerCase().includes("main"))?.id ??
      warehouses[0]?.id ??
      ""
  );
  const rawMaterials = materials.filter((m) => m.category?.name === "Сировина");
  const productId = findIdByName(
    rawMaterials.length > 0 ? rawMaterials : materials,
    DEFAULT_RAW_MATERIAL_NAME
  );
  const defaultPackingProductId = findIdByName(
    packingMaterials,
    DEFAULT_PACKING_MATERIAL_NAME
  );

  return (
    <div className="space-y-4 p-4 pt-6">
      <div>
        <h1 className="text-2xl font-semibold">Польове внесення</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Закупівля і поїздка сировини одним збереженням
        </p>
      </div>
      {!warehouseId || !productId ? (
        <p className="text-sm text-destructive">
          Немає складу або сировини в довідниках. Зверніться до офісу.
        </p>
      ) : (
        <FieldDeliveryForm
          suppliers={suppliers}
          warehouseId={warehouseId}
          productId={productId}
          packingMaterials={packingMaterials}
          defaultPackingProductId={defaultPackingProductId}
          vehicles={vehicles}
          lastVehicleId={lastVehicleId}
        />
      )}
    </div>
  );
}
