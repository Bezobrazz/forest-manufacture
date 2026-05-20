"use server";

import { createServerSupabaseClient, getServerUser } from "@/lib/supabase/server-auth";
import { packingBagPurchaseSchema } from "@/lib/packing-bags/schemas";
import { revalidatePath } from "next/cache";

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

type SavePayload = {
  purchase_date: string;
  quantity: number;
  price_uah: number;
};

const PACKING_BAG_PRODUCT_NAME = "Мішок Пакувальний (кора)";
const PACKING_BAG_NOTES_PREFIX = "Packing bag purchase #";

export async function getPackingBagPurchases(): Promise<PackingBagPurchase[]> {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("packing_bag_purchases")
    .select("*")
    .eq("user_id", user.id)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching packing bag purchases:", error);
    return [];
  }

  return (data ?? []) as PackingBagPurchase[];
}

function validatePayload(payload: SavePayload) {
  const parsed = packingBagPurchaseSchema.safeParse(payload);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      ok: false as const,
      error:
        fields.purchase_date?.[0] ??
        fields.quantity?.[0] ??
        fields.price_uah?.[0] ??
        parsed.error.message,
    };
  }
  return { ok: true as const, data: parsed.data };
}

function calculateTotalUah(quantity: number, priceUah: number) {
  return Math.round(quantity * priceUah * 100) / 100;
}

async function getMainWarehouseId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: mainWarehouse } = await supabase
    .from("warehouses")
    .select("id")
    .ilike("name", "%main%")
    .limit(1)
    .maybeSingle();

  if (mainWarehouse?.id) return Number(mainWarehouse.id);

  const { data: anyWarehouse } = await supabase
    .from("warehouses")
    .select("id")
    .order("id")
    .limit(1)
    .maybeSingle();

  return anyWarehouse?.id ? Number(anyWarehouse.id) : null;
}

async function ensurePackingBagProductId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  priceUah: number
) {
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("name", PACKING_BAG_PRODUCT_NAME)
    .eq("product_type", "material")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("products").update({ cost: priceUah }).eq("id", existing.id);
    return Number(existing.id);
  }

  const { data: category } = await supabase
    .from("product_categories")
    .select("id")
    .eq("name", "Матеріали")
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: PACKING_BAG_PRODUCT_NAME,
      description: "Пакувальні мішки для кори",
      category_id: category?.id ?? null,
      cost: priceUah,
      product_type: "material",
      reward: null,
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error(error?.message || "Не вдалося створити продукт мішків");
  }

  return Number(created.id);
}

async function getPurchaseIncomeTx(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  purchaseId: number
) {
  const { data } = await supabase
    .from("inventory_transactions")
    .select("id, product_id, quantity, warehouse_id")
    .eq("transaction_type", "income")
    .eq("reference_id", purchaseId)
    .ilike("notes", `${PACKING_BAG_NOTES_PREFIX}%`)
    .maybeSingle();

  return data ?? null;
}

async function adjustWarehouseInventory(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  warehouseId: number,
  productId: number,
  delta: number
) {
  const { data: current } = await supabase
    .from("warehouse_inventory")
    .select("quantity")
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId)
    .maybeSingle();

  if (current) {
    const nextQuantity = Math.max(0, Number(current.quantity) + delta);
    await supabase
      .from("warehouse_inventory")
      .update({ quantity: nextQuantity, updated_at: new Date().toISOString() })
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

function revalidateBagPages() {
  revalidatePath("/transactions/suppliers");
  revalidatePath("/inventory");
  revalidatePath("/materials");
}

export async function createPackingBagPurchase(payload: SavePayload) {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();
  if (!user) return { ok: false, error: "Необхідно авторизуватися" };

  const validated = validatePayload(payload);
  if (!validated.ok) return validated;

  const warehouseId = await getMainWarehouseId(supabase);
  if (!warehouseId) return { ok: false, error: "Не знайдено склад для обліку мішків" };

  let productId: number;
  try {
    productId = await ensurePackingBagProductId(supabase, validated.data.price_uah);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не вдалося підготувати продукт мішків",
    };
  }

  const { data: purchase, error } = await supabase
    .from("packing_bag_purchases")
    .insert({
      user_id: user.id,
      purchase_date: validated.data.purchase_date,
      quantity: validated.data.quantity,
      price_uah: validated.data.price_uah,
      total_uah: calculateTotalUah(validated.data.quantity, validated.data.price_uah),
    })
    .select("id")
    .single();

  if (error || !purchase?.id) return { ok: false, error: error?.message || "Не вдалося створити покупку" };

  const { error: txError } = await supabase.from("inventory_transactions").insert({
    product_id: productId,
    quantity: validated.data.quantity,
    transaction_type: "income",
    reference_id: purchase.id,
    warehouse_id: warehouseId,
    notes: `${PACKING_BAG_NOTES_PREFIX}${purchase.id}`,
    created_at: new Date(`${validated.data.purchase_date}T12:00:00.000Z`).toISOString(),
  });

  if (txError) {
    await supabase.from("packing_bag_purchases").delete().eq("id", purchase.id).eq("user_id", user.id);
    return { ok: false, error: txError.message };
  }

  revalidateBagPages();
  return { ok: true };
}

export async function updatePackingBagPurchase(id: number, payload: SavePayload) {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();
  if (!user) return { ok: false, error: "Необхідно авторизуватися" };

  const validated = validatePayload(payload);
  if (!validated.ok) return validated;

  const warehouseId = await getMainWarehouseId(supabase);
  if (!warehouseId) return { ok: false, error: "Не знайдено склад для обліку мішків" };

  let productId: number;
  try {
    productId = await ensurePackingBagProductId(supabase, validated.data.price_uah);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Не вдалося підготувати продукт мішків",
    };
  }

  const { data: existingPurchase, error: existingError } = await supabase
    .from("packing_bag_purchases")
    .select("id, quantity")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError || !existingPurchase) {
    return { ok: false, error: "Покупку мішків не знайдено" };
  }

  const existingTx = await getPurchaseIncomeTx(supabase, id);
  if (existingTx?.warehouse_id && existingTx.product_id) {
    await adjustWarehouseInventory(
      supabase,
      Number(existingTx.warehouse_id),
      Number(existingTx.product_id),
      -Number(existingTx.quantity)
    );
    await adjustWarehouseInventory(supabase, warehouseId, productId, Number(validated.data.quantity));
  }

  const { error } = await supabase
    .from("packing_bag_purchases")
    .update({
      purchase_date: validated.data.purchase_date,
      quantity: validated.data.quantity,
      price_uah: validated.data.price_uah,
      total_uah: calculateTotalUah(validated.data.quantity, validated.data.price_uah),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  if (existingTx?.id) {
    const { error: txUpdateError } = await supabase
      .from("inventory_transactions")
      .update({
        product_id: productId,
        quantity: validated.data.quantity,
        warehouse_id: warehouseId,
        notes: `${PACKING_BAG_NOTES_PREFIX}${id}`,
        created_at: new Date(`${validated.data.purchase_date}T12:00:00.000Z`).toISOString(),
      })
      .eq("id", existingTx.id);

    if (txUpdateError) return { ok: false, error: txUpdateError.message };
  } else {
    const { error: txInsertError } = await supabase.from("inventory_transactions").insert({
      product_id: productId,
      quantity: validated.data.quantity,
      transaction_type: "income",
      reference_id: id,
      warehouse_id: warehouseId,
      notes: `${PACKING_BAG_NOTES_PREFIX}${id}`,
      created_at: new Date(`${validated.data.purchase_date}T12:00:00.000Z`).toISOString(),
    });
    if (txInsertError) return { ok: false, error: txInsertError.message };
  }

  revalidateBagPages();
  return { ok: true };
}

export async function deletePackingBagPurchase(id: number) {
  const supabase = await createServerSupabaseClient();
  const user = await getServerUser();
  if (!user) return { ok: false, error: "Необхідно авторизуватися" };

  const existingTx = await getPurchaseIncomeTx(supabase, id);

  if (existingTx?.warehouse_id && existingTx.product_id) {
    await adjustWarehouseInventory(
      supabase,
      Number(existingTx.warehouse_id),
      Number(existingTx.product_id),
      -Number(existingTx.quantity)
    );
    await supabase.from("inventory_transactions").delete().eq("id", existingTx.id);
  }

  const { error } = await supabase
    .from("packing_bag_purchases")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidateBagPages();
  return { ok: true };
}
