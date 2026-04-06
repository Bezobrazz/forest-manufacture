import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";
import { PACKING_BAG_PRODUCT_NAME } from "@/lib/packing-bags/packing-bag-purchase";

const PACKING_BAG_LOW_STOCK_THRESHOLD = 2000;
const KYIV_TZ = "Europe/Kyiv";

type CheckOptions = {
  trigger: "immediate" | "morning";
  supabase?: ReturnType<typeof createClient>;
};

type AlertState = {
  id: string;
  packing_bag_low_alert_active: boolean | null;
  packing_bag_last_morning_alert_date: string | null;
};

function getTodayInKyiv() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${y}-${m}-${d}`;
}

function getKyivHour() {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: KYIV_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(new Date());

  return Number(hour);
}

function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getCurrentPackingBagQuantity(
  supabase: ReturnType<typeof createClient>
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

async function getOrCreateAlertState(
  supabase: ReturnType<typeof createClient>
): Promise<AlertState | null> {
  const { data: state, error } = await supabase
    .from("settings")
    .select("id, packing_bag_low_alert_active, packing_bag_last_morning_alert_date")
    .limit(1)
    .maybeSingle();

  if (error) return null;
  if (state?.id) return state as AlertState;

  const { data: created, error: insertError } = await supabase
    .from("settings")
    .insert({
      packing_bag_low_alert_active: false,
      packing_bag_last_morning_alert_date: null,
    })
    .select("id, packing_bag_low_alert_active, packing_bag_last_morning_alert_date")
    .single();

  if (insertError || !created?.id) return null;
  return created as AlertState;
}

export async function checkPackingBagLowStockAndNotify(options: CheckOptions) {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  if (!supabase) return { ok: false as const, reason: "supabase_admin_missing" };

  const state = await getOrCreateAlertState(supabase);
  if (!state) return { ok: false as const, reason: "alert_state_unavailable" };

  const quantity = await getCurrentPackingBagQuantity(supabase);
  if (quantity === null) return { ok: false as const, reason: "quantity_unavailable" };

  const isLow = quantity <= PACKING_BAG_LOW_STOCK_THRESHOLD;
  const todayKyiv = getTodayInKyiv();

  if (!isLow) {
    if (state.packing_bag_low_alert_active || state.packing_bag_last_morning_alert_date) {
      await supabase
        .from("settings")
        .update({
          packing_bag_low_alert_active: false,
          packing_bag_last_morning_alert_date: null,
        })
        .eq("id", state.id);
    }

    return { ok: true as const, notified: false, quantity };
  }

  if (options.trigger === "morning") {
    if (getKyivHour() !== 9) return { ok: true as const, notified: false, quantity };
    if (state.packing_bag_last_morning_alert_date === todayKyiv) {
      return { ok: true as const, notified: false, quantity };
    }

    const message = `⚠️ <b>Низький залишок мішків</b>\n\n«${PACKING_BAG_PRODUCT_NAME}»: <b>${quantity} шт</b>\nПоріг: ≤ ${PACKING_BAG_LOW_STOCK_THRESHOLD} шт\n\nНагадування на 09:00 (Київ).`;
    const sent = await sendTelegramMessage(message);
    if (!sent) return { ok: false as const, reason: "telegram_send_failed" };

    await supabase
      .from("settings")
      .update({
        packing_bag_low_alert_active: true,
        packing_bag_last_morning_alert_date: todayKyiv,
      })
      .eq("id", state.id);

    return { ok: true as const, notified: true, quantity };
  }

  if (state.packing_bag_low_alert_active) {
    return { ok: true as const, notified: false, quantity };
  }

  const message = `⚠️ <b>Низький залишок мішків</b>\n\n«${PACKING_BAG_PRODUCT_NAME}»: <b>${quantity} шт</b>\nПоріг: ≤ ${PACKING_BAG_LOW_STOCK_THRESHOLD} шт\n\nСповіщення надіслано одразу після досягнення порогу.`;
  const sent = await sendTelegramMessage(message);
  if (!sent) return { ok: false as const, reason: "telegram_send_failed" };

  await supabase
    .from("settings")
    .update({
      packing_bag_low_alert_active: true,
      packing_bag_last_morning_alert_date: null,
    })
    .eq("id", state.id);

  return { ok: true as const, notified: true, quantity };
}
