"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireMiniAppAccess } from "@/lib/telegram/mini-app-session";
import { resolveSupplierDeliveryPayableAmount } from "@/lib/suppliers/delivery-payable-amount";
import { syncSupplierDeliveryExpenseToKeepin } from "@/lib/crm/keepincrm/sync-supplier-delivery-expense";
import { calculateTripMetrics } from "@/lib/trips/calc";
import { tripFormSchema } from "@/lib/trips/schemas";
import { TYPE_DEFAULTS } from "@/lib/trips/constants";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Product, Supplier, Warehouse } from "@/lib/types";

const DEFAULT_RAW_DRIVER_PAY_UAH = 1000;
const DEFAULT_RAW_TRIP_NAME = "Доставка сировини";

export type MiniAppFormBootstrap = {
  accessName: string;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  materials: Product[];
  packingMaterials: Product[];
  vehicles: Vehicle[];
  lastVehicleId: string | null;
};

export async function getMiniAppFormBootstrap(): Promise<MiniAppFormBootstrap | null> {
  const auth = await requireMiniAppAccess();
  if (!auth.ok) return null;

  const supabase = createServiceRoleClient();

  const [
    suppliersRes,
    warehousesRes,
    materialsRes,
    categoriesRes,
    vehiclesRes,
    lastTripRes,
  ] = await Promise.all([
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("warehouses").select("*").order("name"),
    supabase
      .from("products")
      .select("*, category:product_categories(*)")
      .eq("product_type", "material")
      .order("name"),
    supabase.from("product_categories").select("id").eq("name", "Матеріали"),
    supabase
      .from("vehicles")
      .select(
        "id, user_id, name, type, default_fuel_consumption_l_per_100km, default_depreciation_uah_per_km, default_daily_taxes_uah, created_at"
      )
      .order("name"),
    supabase
      .from("trips")
      .select("vehicle_id")
      .eq("created_by_access_id", auth.access.id)
      .order("trip_start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const categoryIds = (categoriesRes.data ?? []).map((c) => c.id);
  let packingMaterials: Product[] = [];
  if (categoryIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("*, category:product_categories(*)")
      .in("category_id", categoryIds)
      .order("name");
    packingMaterials = (data ?? []) as Product[];
  }

  return {
    accessName: auth.access.display_name,
    suppliers: (suppliersRes.data ?? []) as Supplier[],
    warehouses: (warehousesRes.data ?? []) as Warehouse[],
    materials: (materialsRes.data ?? []) as Product[],
    packingMaterials,
    vehicles: (vehiclesRes.data ?? []) as Vehicle[],
    lastVehicleId: lastTripRes.data?.vehicle_id
      ? String(lastTripRes.data.vehicle_id)
      : null,
  };
}

export async function createFieldSupplier(name: string): Promise<
  { ok: true; supplier: Supplier } | { ok: false; error: string }
> {
  const auth = await requireMiniAppAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Назва постачальника обовʼязкова" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name: trimmed })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Не вдалося створити постачальника" };
  }
  return { ok: true, supplier: data as Supplier };
}

export type FieldDeliveryTripInput = {
  supplierId: number;
  productId: number;
  warehouseId: number;
  quantity: number;
  pricePerUnit: number | null;
  deliveryDate: string;
  materialProductId: number | null;
  materialQuantity: number | null;
  vehicleId: string;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  extraCostsUah: number | null;
  notes: string | null;
};

async function syncSupplierAdvanceFromLedger(
  supabase: ReturnType<typeof createServiceRoleClient>,
  supplierId: number
) {
  const { data: advances } = await supabase
    .from("supplier_advance_transactions")
    .select("amount")
    .eq("supplier_id", supplierId);
  const advancesSum = (advances ?? []).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  );
  const { data: deliveries } = await supabase
    .from("supplier_deliveries")
    .select("advance_used")
    .eq("supplier_id", supplierId);
  const usedSum = (deliveries ?? []).reduce(
    (s, r) => s + Number(r.advance_used ?? 0),
    0
  );
  const advance = Math.max(0, Math.round((advancesSum - usedSum) * 100) / 100);
  await supabase.from("suppliers").update({ advance }).eq("id", supplierId);
}

export async function createFieldDeliveryAndTrip(
  input: FieldDeliveryTripInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMiniAppAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (
    !input.supplierId ||
    !input.productId ||
    !input.warehouseId ||
    !input.quantity ||
    input.quantity <= 0
  ) {
    return { ok: false, error: "Заповніть обовʼязкові поля закупівлі" };
  }

  const bags = Math.floor(input.quantity);
  if (bags < 1) {
    return { ok: false, error: "Кількість має бути не менше 1" };
  }

  const supabase = createServiceRoleClient();
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select(
      "id, type, default_fuel_consumption_l_per_100km, default_depreciation_uah_per_km, default_daily_taxes_uah"
    )
    .eq("id", input.vehicleId)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    return { ok: false, error: "Оберіть транспорт" };
  }

  const defaults = TYPE_DEFAULTS[vehicle.type as "van" | "truck"] ?? TYPE_DEFAULTS.van;
  const day = input.deliveryDate.slice(0, 10);

  const insertPayload: Record<string, unknown> = {
    supplier_id: input.supplierId,
    product_id: input.productId,
    warehouse_id: input.warehouseId,
    quantity: input.quantity,
    price_per_unit: input.pricePerUnit,
    actual_paid: null,
    created_at: new Date(`${day}T12:00:00.000Z`).toISOString(),
    created_by_access_id: auth.access.id,
  };
  if (
    input.materialProductId != null &&
    input.materialQuantity != null &&
    input.materialQuantity > 0
  ) {
    insertPayload.material_product_id = input.materialProductId;
    insertPayload.material_quantity = input.materialQuantity;
  }

  const { data: delivery, error: deliveryError } = await supabase
    .from("supplier_deliveries")
    .insert(insertPayload)
    .select(
      `
      *,
      supplier:suppliers(*),
      product:products!supplier_deliveries_product_id_fkey(*, category:product_categories(*))
    `
    )
    .single();

  if (deliveryError || !delivery) {
    return {
      ok: false,
      error: deliveryError?.message ?? "Не вдалося зберегти закупівлю",
    };
  }

  const materialQty = Number(input.materialQuantity ?? 0);
  const materialPid = input.materialProductId ?? 0;
  if (materialQty > 0 && materialPid) {
    const { error: txError } = await supabase.from("inventory_transactions").insert({
      product_id: materialPid,
      quantity: materialQty,
      transaction_type: "shipment",
      reference_id: delivery.id,
      warehouse_id: input.warehouseId,
      notes: `Видача матеріалів постачальнику (поставка #${delivery.id}, Mini App)`,
    });
    if (txError) {
      return {
        ok: false,
        error: "Закупівлю збережено, але не вдалося списати матеріали зі складу",
      };
    }
    const { data: supplierRow } = await supabase
      .from("suppliers")
      .select("materials_balance")
      .eq("id", input.supplierId)
      .single();
    const currentBalance = Number(supplierRow?.materials_balance ?? 0);
    await supabase
      .from("suppliers")
      .update({ materials_balance: currentBalance + (materialQty - input.quantity) })
      .eq("id", input.supplierId);
  }

  const purchaseAmount = resolveSupplierDeliveryPayableAmount({
    quantity: input.quantity,
    pricePerUnit: input.pricePerUnit,
    actualPaid: null,
  });

  if (purchaseAmount > 0 && delivery.id) {
    const advanceCutoffIso = `${day}T23:59:59.999Z`;
    const { data: advances } = await supabase
      .from("supplier_advance_transactions")
      .select("amount")
      .eq("supplier_id", input.supplierId)
      .lte("created_at", advanceCutoffIso);
    const advancesSum = (advances ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0
    );
    const { data: allDeliveriesForPool } = await supabase
      .from("supplier_deliveries")
      .select("advance_used, created_at, id")
      .eq("supplier_id", input.supplierId);
    const advanceUsedSum = (allDeliveriesForPool ?? [])
      .filter((d) => {
        if (d.id === delivery.id) return false;
        const dDay = String(d.created_at ?? "").slice(0, 10);
        return dDay < day || (dDay === day && Number(d.id) < Number(delivery.id));
      })
      .reduce((s, r) => s + Number(r.advance_used ?? 0), 0);
    const availableAdvance = Math.max(
      0,
      Math.round((advancesSum - advanceUsedSum) * 100) / 100
    );
    const deductRounded =
      Math.round(Math.min(purchaseAmount, availableAdvance) * 100) / 100;
    await supabase
      .from("supplier_deliveries")
      .update({ advance_used: deductRounded })
      .eq("id", delivery.id);
    await syncSupplierAdvanceFromLedger(supabase, input.supplierId);

    try {
      const paymentId = await syncSupplierDeliveryExpenseToKeepin({
        deliveryId: delivery.id as number,
        amount: purchaseAmount,
        atYmd: day,
        supplierName: (delivery as { supplier?: { name?: string } }).supplier?.name ?? "",
        productName: (delivery as { product?: { name?: string } }).product?.name ?? "",
        quantity: input.quantity,
      });
      if (paymentId != null) {
        await supabase
          .from("supplier_deliveries")
          .update({ keepin_payment_id: paymentId })
          .eq("id", delivery.id);
      }
    } catch (crmError) {
      console.error("KeepinCRM from Mini App:", crmError);
    }
  }

  const tripParsed = tripFormSchema.safeParse({
    name: DEFAULT_RAW_TRIP_NAME,
    trip_start_date: day,
    trip_end_date: day,
    vehicle_id: input.vehicleId,
    trip_type: "raw",
    distance_input_mode: "odometer",
    start_odometer_km: input.startOdometerKm,
    end_odometer_km: input.endOdometerKm,
    fuel_consumption_l_per_100km:
      vehicle.default_fuel_consumption_l_per_100km ?? defaults.fuel,
    fuel_price_uah_per_l: null,
    depreciation_uah_per_km:
      vehicle.default_depreciation_uah_per_km ?? defaults.depreciation,
    days_count: 1,
    daily_taxes_uah: vehicle.default_daily_taxes_uah ?? defaults.dailyTaxes,
    freight_uah: 0,
    driver_pay_mode: "per_trip",
    driver_pay_uah: DEFAULT_RAW_DRIVER_PAY_UAH,
    extra_costs_uah: input.extraCostsUah ?? 0,
    bags_count: bags,
    notes: input.notes,
  });

  if (!tripParsed.success) {
    const first = tripParsed.error.flatten().fieldErrors;
    const msg =
      first.bags_count?.[0] ??
      first.end_odometer_km?.[0] ??
      first.vehicle_id?.[0] ??
      tripParsed.error.message;
    return {
      ok: false,
      error: `Закупівлю збережено, поїздку — ні: ${msg}`,
    };
  }

  const d = tripParsed.data;
  let metrics;
  try {
    metrics = calculateTripMetrics({ ...d, user_id: auth.access.created_by });
  } catch (err) {
    return {
      ok: false,
      error: `Закупівлю збережено, поїздку — ні: ${
        err instanceof Error ? err.message : "помилка розрахунку"
      }`,
    };
  }

  const { error: tripError } = await supabase.from("trips").insert({
    user_id: auth.access.created_by,
    vehicle_id: d.vehicle_id,
    name: d.name ?? null,
    trip_date: d.trip_start_date,
    trip_start_date: d.trip_start_date,
    trip_end_date: d.trip_end_date,
    trip_type: d.trip_type,
    start_odometer_km: d.start_odometer_km ?? null,
    end_odometer_km: d.end_odometer_km ?? null,
    total_distance_km: d.total_distance_km ?? null,
    fuel_consumption_l_per_100km: d.fuel_consumption_l_per_100km ?? null,
    fuel_price_uah_per_l: d.fuel_price_uah_per_l ?? null,
    depreciation_uah_per_km: d.depreciation_uah_per_km ?? null,
    days_count: d.days_count,
    daily_taxes_uah: d.daily_taxes_uah ?? 150,
    freight_uah: 0,
    driver_pay_mode: d.driver_pay_mode,
    driver_pay_uah: d.driver_pay_uah ?? 0,
    driver_pay_uah_per_day: d.driver_pay_uah_per_day ?? 0,
    driver_pay_percent_of_freight: d.driver_pay_percent_of_freight ?? null,
    extra_costs_uah: d.extra_costs_uah ?? 0,
    bags_count: d.bags_count ?? null,
    notes: d.notes ?? null,
    distance_km: metrics.distance_km,
    fuel_used_l: metrics.fuel_used_l,
    fuel_cost_uah: metrics.fuel_cost_uah,
    depreciation_cost_uah: metrics.depreciation_cost_uah,
    taxes_cost_uah: metrics.taxes_cost_uah,
    driver_cost_uah: metrics.driver_cost_uah,
    total_costs_uah: metrics.total_costs_uah,
    profit_uah: metrics.profit_uah,
    profit_per_km_uah: metrics.profit_per_km_uah,
    roi_percent: metrics.roi_percent,
    created_by_access_id: auth.access.id,
  });

  if (tripError) {
    return {
      ok: false,
      error: `Закупівлю збережено, поїздку — ні: ${tripError.message}`,
    };
  }

  revalidatePath("/transactions/suppliers");
  revalidatePath("/trips");
  revalidatePath("/suppliers");

  return { ok: true };
}
