import { getMiniAppFormBootstrap } from "@/app/m/actions";
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
  const bootstrap = await getMiniAppFormBootstrap();

  if (!bootstrap) {
    return (
      <div className="space-y-2 p-4 pt-6 text-center text-sm text-muted-foreground">
        Очікування сесії Mini App…
      </div>
    );
  }

  const warehouseId = String(
    bootstrap.warehouses.find((w) => w.name.toLowerCase().includes("main"))
      ?.id ??
      bootstrap.warehouses[0]?.id ??
      ""
  );
  const rawMaterials = bootstrap.materials.filter(
    (m) => m.category?.name === "Сировина"
  );
  const productId = findIdByName(
    rawMaterials.length > 0 ? rawMaterials : bootstrap.materials,
    DEFAULT_RAW_MATERIAL_NAME
  );
  const defaultPackingProductId = findIdByName(
    bootstrap.packingMaterials,
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
      ) : !defaultPackingProductId ? (
        <p className="text-sm text-destructive">
          Немає продукту «Мішок для сировини (білий)». Зверніться до офісу.
        </p>
      ) : (
        <FieldDeliveryForm
          accessName={bootstrap.accessName}
          suppliers={bootstrap.suppliers}
          warehouseId={warehouseId}
          productId={productId}
          packingProductId={defaultPackingProductId}
          vehicles={bootstrap.vehicles}
          lastVehicleId={bootstrap.lastVehicleId}
        />
      )}
    </div>
  );
}
