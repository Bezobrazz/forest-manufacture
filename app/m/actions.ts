"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireMiniAppAccess } from "@/lib/telegram/mini-app-session";
import { resolveSupplierDeliveryPayableAmount } from "@/lib/suppliers/delivery-payable-amount";
import { syncSupplierDeliveryExpenseToKeepin } from "@/lib/crm/keepincrm/sync-supplier-delivery-expense";
import { calculateTripMetrics } from "@/lib/trips/calc";
import { tripFormSchema } from "@/lib/trips/schemas";
import { TYPE_DEFAULTS } from "@/lib/trips/constants";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Vehicle } from "@/app/vehicles/actions";
import type { Product, Supplier, Warehouse } from "@/lib/types";

const DEFAULT_RAW_DRIVER_PAY_UAH = 1000;
const DEFAULT_RAW_TRIP_NAME = "Доставка сировини";

function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatMoneyUa(amount: number): string {
  return `${amount.toLocaleString("uk-UA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₴`;
}

async function notifyFieldDeliveriesSubmitted(params: {
  accessName: string;
  day: string;
  purchases: FieldPurchaseLineInput[];
  vehicleName: string;
  startOdometerKm: number;
  endOdometerKm: number;
  bagsTotal: number;
  supabase: ReturnType<typeof createServiceRoleClient>;
}) {
  const supplierIds = [
    ...new Set(params.purchases.map((p) => p.supplierId).filter(Boolean)),
  ];
  const { data: suppliers } = supplierIds.length
    ? await params.supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds)
    : { data: [] as { id: number; name: string }[] };
  const nameById = new Map(
    (suppliers ?? []).map((s) => [Number(s.id), String(s.name ?? "")])
  );

  const purchaseLines = params.purchases.map((p, i) => {
    const name =
      nameById.get(p.supplierId)?.trim() || `Постачальник #${p.supplierId}`;
    const payable = resolveSupplierDeliveryPayableAmount({
      quantity: p.quantity,
      pricePerUnit: p.pricePerUnit,
      actualPaid: p.actualPaid,
    });
    const bags = Math.floor(p.quantity);
    return `${i + 1}. ${escapeTelegramHtml(name)} — <b>${bags}</b> мішк., ${escapeTelegramHtml(formatMoneyUa(payable))}`;
  });

  const distanceKm = Math.round(
    (params.endOdometerKm - params.startOdometerKm) * 100
  ) / 100;

  const message = [
    `📦 <b>Mini App: закупівлі і поїздка</b>`,
    ``,
    `Хто: <b>${escapeTelegramHtml(params.accessName)}</b>`,
    `Дата: <b>${escapeTelegramHtml(params.day)}</b>`,
    ``,
    `<b>Закупівлі (${params.purchases.length})</b>`,
    ...purchaseLines,
    ``,
    `<b>Поїздка</b>`,
    `Транспорт: ${escapeTelegramHtml(params.vehicleName)}`,
    `Одометр: ${params.startOdometerKm} → ${params.endOdometerKm} (${distanceKm} км)`,
    `Мішків у поїздці: <b>${params.bagsTotal}</b>`,
  ].join("\n");

  try {
    await sendTelegramMessage(message);
  } catch (error) {
    console.error("Mini App Telegram notify failed:", error);
  }
}

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

export type FieldPurchaseLineInput = {
  supplierId: number;
  quantity: number;
  pricePerUnit: number;
  actualPaid: number | null;
  materialProductId: number | null;
  materialQuantity: number | null;
};

export type FieldDeliveriesAndTripInput = {
  purchases: FieldPurchaseLineInput[];
  productId: number;
  warehouseId: number;
  deliveryDate: string;
  vehicleId: string;
  startOdometerKm: number;
  endOdometerKm: number;
  fuelPriceUahPerL: number;
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

async function insertFieldPurchaseDelivery(params: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  accessId: string;
  purchase: FieldPurchaseLineInput;
  productId: number;
  warehouseId: number;
  day: string;
  lineIndex: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    supabase,
    accessId,
    purchase,
    productId,
    warehouseId,
    day,
    lineIndex,
  } = params;
  const lineLabel = `Закупівля #${lineIndex + 1}`;

  if (!purchase.supplierId || !purchase.quantity || purchase.quantity <= 0) {
    return { ok: false, error: `${lineLabel}: заповніть обовʼязкові поля` };
  }
  if (
    purchase.pricePerUnit == null ||
    !Number.isFinite(purchase.pricePerUnit) ||
    purchase.pricePerUnit < 0
  ) {
    return { ok: false, error: `${lineLabel}: вкажіть ціну за одиницю` };
  }
  if (Math.floor(purchase.quantity) < 1) {
    return { ok: false, error: `${lineLabel}: кількість має бути не менше 1` };
  }

  const insertPayload: Record<string, unknown> = {
    supplier_id: purchase.supplierId,
    product_id: productId,
    warehouse_id: warehouseId,
    quantity: purchase.quantity,
    price_per_unit: purchase.pricePerUnit,
    actual_paid: purchase.actualPaid,
    created_at: new Date(`${day}T12:00:00.000Z`).toISOString(),
    created_by_access_id: accessId,
  };
  if (
    purchase.materialProductId != null &&
    purchase.materialQuantity != null &&
    purchase.materialQuantity > 0
  ) {
    insertPayload.material_product_id = purchase.materialProductId;
    insertPayload.material_quantity = purchase.materialQuantity;
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
      error:
        deliveryError?.message ??
        `${lineLabel}: не вдалося зберегти закупівлю`,
    };
  }

  const materialQty = Number(purchase.materialQuantity ?? 0);
  const materialPid = purchase.materialProductId ?? 0;
  if (materialQty > 0 && materialPid) {
    const { error: txError } = await supabase
      .from("inventory_transactions")
      .insert({
        product_id: materialPid,
        quantity: materialQty,
        transaction_type: "shipment",
        reference_id: delivery.id,
        warehouse_id: warehouseId,
        notes: `Видача матеріалів постачальнику (поставка #${delivery.id}, Mini App)`,
      });
    if (txError) {
      return {
        ok: false,
        error: `${lineLabel}: збережено, але не вдалося списати матеріали зі складу`,
      };
    }
    const { data: supplierRow } = await supabase
      .from("suppliers")
      .select("materials_balance")
      .eq("id", purchase.supplierId)
      .single();
    const currentBalance = Number(supplierRow?.materials_balance ?? 0);
    await supabase
      .from("suppliers")
      .update({
        materials_balance:
          currentBalance + (materialQty - purchase.quantity),
      })
      .eq("id", purchase.supplierId);
  }

  const purchaseAmount = resolveSupplierDeliveryPayableAmount({
    quantity: purchase.quantity,
    pricePerUnit: purchase.pricePerUnit,
    actualPaid: purchase.actualPaid,
  });

  if (purchaseAmount > 0 && delivery.id) {
    const advanceCutoffIso = `${day}T23:59:59.999Z`;
    const { data: advances } = await supabase
      .from("supplier_advance_transactions")
      .select("amount")
      .eq("supplier_id", purchase.supplierId)
      .lte("created_at", advanceCutoffIso);
    const advancesSum = (advances ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0
    );
    const { data: allDeliveriesForPool } = await supabase
      .from("supplier_deliveries")
      .select("advance_used, created_at, id")
      .eq("supplier_id", purchase.supplierId);
    const advanceUsedSum = (allDeliveriesForPool ?? [])
      .filter((d) => {
        if (d.id === delivery.id) return false;
        const dDay = String(d.created_at ?? "").slice(0, 10);
        return (
          dDay < day || (dDay === day && Number(d.id) < Number(delivery.id))
        );
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
    await syncSupplierAdvanceFromLedger(supabase, purchase.supplierId);

    try {
      const paymentId = await syncSupplierDeliveryExpenseToKeepin({
        deliveryId: delivery.id as number,
        amount: purchaseAmount,
        atYmd: day,
        supplierName:
          (delivery as { supplier?: { name?: string } }).supplier?.name ?? "",
        productName:
          (delivery as { product?: { name?: string } }).product?.name ?? "",
        quantity: purchase.quantity,
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

  return { ok: true };
}

export async function createFieldDeliveriesAndTrip(
  input: FieldDeliveriesAndTripInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireMiniAppAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!input.purchases?.length) {
    return { ok: false, error: "Додайте хоча б одну закупівлю" };
  }
  if (!input.productId || !input.warehouseId) {
    return { ok: false, error: "Немає складу або сировини в довідниках" };
  }
  if (
    input.startOdometerKm == null ||
    input.endOdometerKm == null ||
    input.endOdometerKm < input.startOdometerKm
  ) {
    return { ok: false, error: "Вкажіть коректний одометр початок і кінець" };
  }
  if (
    input.fuelPriceUahPerL == null ||
    !Number.isFinite(input.fuelPriceUahPerL) ||
    input.fuelPriceUahPerL < 0
  ) {
    return { ok: false, error: "Вкажіть вартість пального за літр" };
  }

  const bagsTotal = input.purchases.reduce(
    (sum, p) => sum + Math.floor(Number(p.quantity) || 0),
    0
  );
  if (bagsTotal < 1) {
    return { ok: false, error: "Загальна кількість мішків має бути не менше 1" };
  }

  const supabase = createServiceRoleClient();
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select(
      "id, name, type, default_fuel_consumption_l_per_100km, default_depreciation_uah_per_km, default_daily_taxes_uah"
    )
    .eq("id", input.vehicleId)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    return { ok: false, error: "Оберіть транспорт" };
  }

  const defaults =
    TYPE_DEFAULTS[vehicle.type as "van" | "truck"] ?? TYPE_DEFAULTS.van;
  const day = input.deliveryDate.slice(0, 10);

  let savedCount = 0;
  for (let i = 0; i < input.purchases.length; i++) {
    const result = await insertFieldPurchaseDelivery({
      supabase,
      accessId: auth.access.id,
      purchase: input.purchases[i],
      productId: input.productId,
      warehouseId: input.warehouseId,
      day,
      lineIndex: i,
    });
    if (!result.ok) {
      if (savedCount > 0) {
        return {
          ok: false,
          error: `${result.error}. Збережено закупівель: ${savedCount}, поїздку не створено`,
        };
      }
      return result;
    }
    savedCount += 1;
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
    fuel_price_uah_per_l: input.fuelPriceUahPerL,
    depreciation_uah_per_km:
      vehicle.default_depreciation_uah_per_km ?? defaults.depreciation,
    days_count: 1,
    daily_taxes_uah: vehicle.default_daily_taxes_uah ?? defaults.dailyTaxes,
    freight_uah: 0,
    driver_pay_mode: "per_trip",
    driver_pay_uah: DEFAULT_RAW_DRIVER_PAY_UAH,
    extra_costs_uah: 0,
    bags_count: bagsTotal,
    notes: null,
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
      error: `Закупівлі збережено (${savedCount}), поїздку — ні: ${msg}`,
    };
  }

  const d = tripParsed.data;
  let metrics;
  try {
    metrics = calculateTripMetrics({ ...d, user_id: auth.access.created_by });
  } catch (err) {
    return {
      ok: false,
      error: `Закупівлі збережено (${savedCount}), поїздку — ні: ${
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
      error: `Закупівлі збережено (${savedCount}), поїздку — ні: ${tripError.message}`,
    };
  }

  await notifyFieldDeliveriesSubmitted({
    accessName: auth.access.display_name,
    day,
    purchases: input.purchases,
    vehicleName: String(
      (vehicle as { name?: string | null }).name ?? "—"
    ),
    startOdometerKm: input.startOdometerKm,
    endOdometerKm: input.endOdometerKm,
    bagsTotal,
    supabase,
  });

  revalidatePath("/transactions/suppliers");
  revalidatePath("/trips");
  revalidatePath("/suppliers");

  return { ok: true };
}
