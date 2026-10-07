"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireMiniAppAccess } from "@/lib/telegram/mini-app-session";
import { resolveSupplierDeliveryPayableAmount } from "@/lib/suppliers/delivery-payable-amount";
import {
  syncSupplierDeliveryExpenseDeleteToKeepin,
  syncSupplierDeliveryExpenseToKeepin,
} from "@/lib/crm/keepincrm/sync-supplier-delivery-expense";
import { resolveKeepinSupplierExpenseRefs } from "@/lib/crm/keepincrm/payments";
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
  crmFailures: string[];
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
    const base = `${i + 1}. ${escapeTelegramHtml(name)} — <b>${bags}</b> мішк., ${escapeTelegramHtml(formatMoneyUa(payable))}`;
    const info = p.additionalInfo?.trim();
    if (!info) return base;
    return `${base}\n   └ ${escapeTelegramHtml(info)}`;
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
    ...(params.crmFailures.length
      ? [
          ``,
          `⚠️ <b>KeepinCRM</b>`,
          ...params.crmFailures.map((f) => escapeTelegramHtml(f)),
        ]
      : []),
  ].join("\n");

  try {
    const sent = await sendTelegramMessage(message);
    if (!sent) {
      console.error("Mini App Telegram notify failed: sendTelegramMessage returned false");
    }
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
  additionalInfo: string | null;
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

async function adjustWarehouseInventory(params: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  warehouseId: number;
  productId: number;
  delta: number;
}): Promise<void> {
  const { supabase, warehouseId, productId, delta } = params;
  if (!Number.isFinite(delta) || delta === 0) return;

  const { error: rpcError } = await supabase.rpc(
    "update_warehouse_inventory_on_delete",
    {
      p_warehouse_id: warehouseId,
      p_product_id: productId,
      p_quantity: delta,
    }
  );
  if (!rpcError) return;

  const { data: currentInventory } = await supabase
    .from("warehouse_inventory")
    .select("quantity")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();

  if (currentInventory) {
    const newQuantity = Math.max(
      0,
      Number(currentInventory.quantity) + delta
    );
    await supabase
      .from("warehouse_inventory")
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId);
    return;
  }

  if (delta > 0) {
    await supabase.from("warehouse_inventory").insert({
      warehouse_id: warehouseId,
      product_id: productId,
      quantity: delta,
      updated_at: new Date().toISOString(),
    });
  }
}

/** Відкат закупівель Mini App, якщо поїздка/наступна закупівля не збереглись. */
async function rollbackFieldPurchaseDeliveries(
  supabase: ReturnType<typeof createServiceRoleClient>,
  deliveryIds: number[]
): Promise<void> {
  const uniqueIds = [...new Set(deliveryIds.filter((id) => id > 0))];
  if (!uniqueIds.length) return;

  const supplierIds = new Set<number>();

  for (const deliveryId of uniqueIds) {
    const { data: delivery, error } = await supabase
      .from("supplier_deliveries")
      .select(
        "id, quantity, product_id, warehouse_id, supplier_id, material_product_id, material_quantity, keepin_payment_id"
      )
      .eq("id", deliveryId)
      .maybeSingle();

    if (error || !delivery) {
      console.error("rollbackFieldPurchaseDeliveries load:", deliveryId, error);
      continue;
    }

    const supplierId = Number(delivery.supplier_id);
    if (Number.isFinite(supplierId) && supplierId > 0) {
      supplierIds.add(supplierId);
    }

    try {
      await syncSupplierDeliveryExpenseDeleteToKeepin(
        delivery.keepin_payment_id as number | null
      );
    } catch (crmError) {
      console.error(
        "rollbackFieldPurchaseDeliveries CRM:",
        deliveryId,
        crmError
      );
    }

    const { data: inventoryRows } = await supabase
      .from("inventory_transactions")
      .select("id, product_id, quantity, transaction_type, warehouse_id")
      .eq("reference_id", deliveryId)
      .in("transaction_type", ["income", "shipment"]);

    let hadMaterialShipment = false;
    for (const tx of inventoryRows ?? []) {
      const qty = Number(tx.quantity);
      const warehouseId = Number(tx.warehouse_id ?? delivery.warehouse_id);
      const productId = Number(tx.product_id);
      if (!Number.isFinite(qty) || !warehouseId || !productId) continue;

      if (tx.transaction_type === "shipment") {
        hadMaterialShipment = true;
      }

      // income: було +, відкат −; shipment: було −, відкат +
      const delta =
        tx.transaction_type === "income" ? -Math.abs(qty) : Math.abs(qty);
      await adjustWarehouseInventory({
        supabase,
        warehouseId,
        productId,
        delta,
      });
      await supabase.from("inventory_transactions").delete().eq("id", tx.id);
    }

    const materialQty = Number(delivery.material_quantity ?? 0);
    const rawQty = Number(delivery.quantity ?? 0);
    // materials_balance оновлюється лише після успішного shipment — відкат теж лише тоді
    if (
      hadMaterialShipment &&
      materialQty > 0 &&
      Number.isFinite(supplierId) &&
      supplierId > 0
    ) {
      const { data: supplierRow } = await supabase
        .from("suppliers")
        .select("materials_balance")
        .eq("id", supplierId)
        .maybeSingle();
      const currentBalance = Number(supplierRow?.materials_balance ?? 0);
      // insert: balance += (materialQty - rawQty); reverse that
      await supabase
        .from("suppliers")
        .update({
          materials_balance: currentBalance - (materialQty - rawQty),
        })
        .eq("id", supplierId);
    }

    const { error: deleteError } = await supabase
      .from("supplier_deliveries")
      .delete()
      .eq("id", deliveryId);
    if (deleteError) {
      console.error(
        "rollbackFieldPurchaseDeliveries delete:",
        deliveryId,
        deleteError
      );
    }
  }

  for (const supplierId of supplierIds) {
    await syncSupplierAdvanceFromLedger(supabase, supplierId);
  }
}

async function insertFieldPurchaseDelivery(params: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  accessId: string;
  purchase: FieldPurchaseLineInput;
  productId: number;
  warehouseId: number;
  day: string;
  lineIndex: number;
  keepinRefs: { purseId: number; categoryId: number } | null;
  /** CRM лише після успішної поїздки — щоб не лишати orphan payments при rollback. */
  syncCrm?: boolean;
}): Promise<
  | { ok: true; deliveryId: number; crmError?: string }
  | { ok: false; error: string; deliveryId?: number }
> {
  const {
    supabase,
    accessId,
    purchase,
    productId,
    warehouseId,
    day,
    lineIndex,
    keepinRefs,
    syncCrm = true,
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
  const additionalInfo = purchase.additionalInfo?.trim();
  if (additionalInfo) {
    insertPayload.additional_info = additionalInfo;
  }
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
        deliveryId: delivery.id as number,
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

    if (syncCrm) {
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
          purseId: keepinRefs?.purseId,
          categoryId: keepinRefs?.categoryId,
        });
        if (paymentId != null) {
          const { error: crmLinkError } = await supabase
            .from("supplier_deliveries")
            .update({ keepin_payment_id: paymentId })
            .eq("id", delivery.id);
          if (crmLinkError) {
            console.error("keepin_payment_id update:", crmLinkError);
            return {
              ok: true,
              deliveryId: delivery.id as number,
              crmError: `${lineLabel} (#${delivery.id}): витрату створено в CRM, але не привʼязано в ERP`,
            };
          }
        }
      } catch (crmError) {
        console.error("KeepinCRM from Mini App:", crmError);
        const detail =
          crmError instanceof Error ? crmError.message : "невідома помилка";
        return {
          ok: true,
          deliveryId: delivery.id as number,
          crmError: `${lineLabel} (#${delivery.id}): ${detail}`,
        };
      }
    }
  }

  return { ok: true, deliveryId: delivery.id as number };
}

const FINAL_CRM_RETRY_DELAY_MS = 600;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function relationName(
  value: { name?: string } | { name?: string }[] | null | undefined
): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.name?.trim() ?? "";
  return value.name?.trim() ?? "";
}

/** Фінальна хвиля sync для поставок цього submit без keepin_payment_id. */
async function retryUnsyncedFieldDeliveryExpenses(params: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  deliveryIds: number[];
  day: string;
  keepinRefs: { purseId: number; categoryId: number } | null;
}): Promise<string[]> {
  const { supabase, deliveryIds, day, keepinRefs } = params;
  if (!deliveryIds.length) return [];

  await sleepMs(FINAL_CRM_RETRY_DELAY_MS);

  const { data: rows, error } = await supabase
    .from("supplier_deliveries")
    .select(
      `
      id, quantity, price_per_unit, actual_paid, keepin_payment_id,
      supplier:suppliers(name),
      product:products!supplier_deliveries_product_id_fkey(name)
    `
    )
    .in("id", deliveryIds)
    .is("keepin_payment_id", null);

  if (error) {
    console.error("Mini App final CRM retry select:", error);
    return [`не вдалося перевірити CRM-синк: ${error.message}`];
  }

  const unsynced = rows ?? [];
  if (!unsynced.length) return [];

  const failures: string[] = [];
  for (const row of unsynced) {
    const deliveryId = Number(row.id);
    const amount = resolveSupplierDeliveryPayableAmount({
      quantity: Number(row.quantity),
      pricePerUnit:
        row.price_per_unit == null ? null : Number(row.price_per_unit),
      actualPaid: row.actual_paid == null ? null : Number(row.actual_paid),
    });
    if (amount <= 0) continue;

    try {
      const paymentId = await syncSupplierDeliveryExpenseToKeepin({
        deliveryId,
        amount,
        atYmd: day,
        supplierName: relationName(
          row.supplier as { name?: string } | { name?: string }[] | null
        ),
        productName: relationName(
          row.product as { name?: string } | { name?: string }[] | null
        ),
        quantity: Number(row.quantity),
        purseId: keepinRefs?.purseId,
        categoryId: keepinRefs?.categoryId,
      });
      if (paymentId == null) {
        failures.push(`#${deliveryId}: sync вимкнено або сума ≤ 0`);
        continue;
      }
      const { error: linkError } = await supabase
        .from("supplier_deliveries")
        .update({ keepin_payment_id: paymentId })
        .eq("id", deliveryId);
      if (linkError) {
        failures.push(
          `#${deliveryId}: витрату створено в CRM, але не привʼязано в ERP`
        );
      }
    } catch (crmError) {
      console.error("Mini App final CRM retry:", crmError);
      const detail =
        crmError instanceof Error ? crmError.message : "невідома помилка";
      failures.push(`#${deliveryId}: ${detail}`);
    }
  }

  return failures;
}

export async function createFieldDeliveriesAndTrip(
  input: FieldDeliveriesAndTripInput
): Promise<
  { ok: true; crmWarning?: string } | { ok: false; error: string }
> {
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

  // Поїздку валідуємо ДО будь-яких записів у БД — інакше можливі orphan-закупівлі.
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
    return { ok: false, error: msg };
  }

  const d = tripParsed.data;
  let metrics;
  try {
    metrics = calculateTripMetrics({ ...d, user_id: auth.access.created_by });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Помилка розрахунку поїздки",
    };
  }

  let keepinRefs: { purseId: number; categoryId: number } | null = null;
  try {
    keepinRefs = await resolveKeepinSupplierExpenseRefs();
  } catch (error) {
    console.error("KeepinCRM refs resolve (Mini App):", error);
  }

  const savedDeliveryIds: number[] = [];
  const USER_SAVE_FAILURE_MESSAGE =
    "Внесіть дані ще раз — стався збій програми. Нічого не збережено.";

  const failAndRollback = async (technicalError: string) => {
    console.error("Mini App save failed, rolling back:", technicalError, {
      deliveryIds: savedDeliveryIds,
    });
    try {
      await rollbackFieldPurchaseDeliveries(supabase, savedDeliveryIds);
    } catch (rollbackError) {
      console.error("Mini App rollback after failure:", rollbackError);
      return {
        ok: false as const,
        error:
          "Внесіть дані ще раз — стався збій програми. Перевірте вкладку «Операції», чи немає дубля.",
      };
    }
    return { ok: false as const, error: USER_SAVE_FAILURE_MESSAGE };
  };

  for (let i = 0; i < input.purchases.length; i++) {
    const result = await insertFieldPurchaseDelivery({
      supabase,
      accessId: auth.access.id,
      purchase: input.purchases[i],
      productId: input.productId,
      warehouseId: input.warehouseId,
      day,
      lineIndex: i,
      keepinRefs,
      syncCrm: false,
    });
    if (result.deliveryId) {
      savedDeliveryIds.push(result.deliveryId);
    }
    if (!result.ok) {
      return failAndRollback(result.error);
    }
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
    return failAndRollback(
      `Не вдалося зберегти поїздку: ${tripError.message}`
    );
  }

  // CRM лише після успішної пари «закупівлі + поїздка».
  const crmFailures = await retryUnsyncedFieldDeliveryExpenses({
    supabase,
    deliveryIds: savedDeliveryIds,
    day,
    keepinRefs,
  });

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
    crmFailures,
    supabase,
  });

  revalidatePath("/transactions/suppliers");
  revalidatePath("/trips");
  revalidatePath("/suppliers");
  revalidatePath("/m");

  if (crmFailures.length > 0) {
    return {
      ok: true,
      crmWarning: `Закупівлі і поїздку збережено, але в KeepinCRM не проведено: ${crmFailures.join("; ")}`,
    };
  }

  return { ok: true };
}

export type MiniAppOperation = {
  id: number;
  created_at: string;
  quantity: number;
  price_per_unit: number | null;
  actual_paid: number | null;
  additional_info: string | null;
  material_quantity: number | null;
  supplier_name: string;
  product_name: string;
  access_name: string | null;
  payable_amount: number;
};

export type MiniAppTripOperation = {
  id: string;
  trip_date: string;
  vehicle_name: string;
  start_odometer_km: number | null;
  end_odometer_km: number | null;
  distance_km: number | null;
  bags_count: number | null;
  fuel_cost_uah: number | null;
  total_costs_uah: number | null;
  access_name: string | null;
};

export async function getMiniAppOperations(
  fromYmd: string,
  toYmd: string
): Promise<
  | {
      ok: true;
      operations: MiniAppOperation[];
      trips: MiniAppTripOperation[];
    }
  | { ok: false; error: string }
> {
  const auth = await requireMiniAppAccess();
  if (!auth.ok) return { ok: false, error: auth.error };

  const from = fromYmd.slice(0, 10);
  const to = toYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: "Некоректний період" };
  }
  if (from > to) {
    return { ok: false, error: "Дата початку пізніше кінця" };
  }

  const supabase = createServiceRoleClient();
  const [deliveriesRes, tripsRes] = await Promise.all([
    supabase
      .from("supplier_deliveries")
      .select(
        `
      id,
      created_at,
      quantity,
      price_per_unit,
      actual_paid,
      additional_info,
      material_quantity,
      supplier:suppliers(name),
      product:products!supplier_deliveries_product_id_fkey(name),
      created_by_access:mini_app_accesses(display_name)
    `
      )
      .not("created_by_access_id", "is", null)
      .gte("created_at", `${from}T00:00:00.000Z`)
      .lte("created_at", `${to}T23:59:59.999Z`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("trips")
      .select(
        `
      id,
      trip_start_date,
      trip_date,
      start_odometer_km,
      end_odometer_km,
      distance_km,
      bags_count,
      fuel_cost_uah,
      total_costs_uah,
      vehicle:vehicles(name),
      created_by_access:mini_app_accesses(display_name)
    `
      )
      .not("created_by_access_id", "is", null)
      .gte("trip_start_date", from)
      .lte("trip_start_date", to)
      .order("trip_start_date", { ascending: false }),
  ]);

  if (deliveriesRes.error) {
    return { ok: false, error: deliveriesRes.error.message };
  }
  if (tripsRes.error) {
    return { ok: false, error: tripsRes.error.message };
  }

  const operations: MiniAppOperation[] = (deliveriesRes.data ?? []).map(
    (row) => {
      const quantity = Number(row.quantity ?? 0);
      const pricePerUnit =
        row.price_per_unit != null ? Number(row.price_per_unit) : null;
      const actualPaid =
        row.actual_paid != null ? Number(row.actual_paid) : null;
      const supplier = row.supplier as { name?: string } | null;
      const product = row.product as { name?: string } | null;
      const access = row.created_by_access as {
        display_name?: string;
      } | null;

      return {
        id: Number(row.id),
        created_at: String(row.created_at ?? ""),
        quantity,
        price_per_unit: pricePerUnit,
        actual_paid: actualPaid,
        additional_info:
          row.additional_info != null ? String(row.additional_info) : null,
        material_quantity:
          row.material_quantity != null
            ? Number(row.material_quantity)
            : null,
        supplier_name: supplier?.name?.trim() || "Невідомий постачальник",
        product_name: product?.name?.trim() || "Невідомий продукт",
        access_name: access?.display_name?.trim() || null,
        payable_amount: resolveSupplierDeliveryPayableAmount({
          quantity,
          pricePerUnit,
          actualPaid,
        }),
      };
    }
  );

  const trips: MiniAppTripOperation[] = (tripsRes.data ?? []).map((row) => {
    const vehicle = row.vehicle as { name?: string } | null;
    const access = row.created_by_access as { display_name?: string } | null;
    const tripDate = String(
      row.trip_start_date ?? row.trip_date ?? ""
    ).slice(0, 10);

    return {
      id: String(row.id),
      trip_date: tripDate,
      vehicle_name: vehicle?.name?.trim() || "Транспорт",
      start_odometer_km:
        row.start_odometer_km != null ? Number(row.start_odometer_km) : null,
      end_odometer_km:
        row.end_odometer_km != null ? Number(row.end_odometer_km) : null,
      distance_km: row.distance_km != null ? Number(row.distance_km) : null,
      bags_count: row.bags_count != null ? Number(row.bags_count) : null,
      fuel_cost_uah:
        row.fuel_cost_uah != null ? Number(row.fuel_cost_uah) : null,
      total_costs_uah:
        row.total_costs_uah != null ? Number(row.total_costs_uah) : null,
      access_name: access?.display_name?.trim() || null,
    };
  });

  return { ok: true, operations, trips };
}
