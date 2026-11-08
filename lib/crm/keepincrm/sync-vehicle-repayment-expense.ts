import {
  createKeepinExpensePayment,
  deleteKeepinPayment,
  findKeepinExpensePaymentByExpenseId,
  isKeepinSupplierExpenseSyncEnabled,
  resolveKeepinExpenseCategoryIdByName,
  resolveKeepinExpensePurseId,
  vehicleRepaymentExpenseCommentMarker,
} from "@/lib/crm/keepincrm/payments";

export type VehicleRepaymentExpenseKind = "fuel" | "repair" | "maintenance";

export type VehicleRepaymentExpenseSyncInput = {
  expenseId: number;
  amount: number;
  atYmd: string;
  vehicleName: string;
  kind: VehicleRepaymentExpenseKind;
  /** Деталі для коментаря: «40 л × 55 ₴/л» або вільний текст */
  detail?: string | null;
  purseId?: number;
};

const CRM_SYNC_ATTEMPTS = 3;
const CRM_SYNC_RETRY_DELAY_MS = 400;

const KIND_LABEL: Record<VehicleRepaymentExpenseKind, string> = {
  fuel: "Паливо",
  repair: "Ремонт",
  maintenance: "Обслуговування",
};

/**
 * Канонічні категорії KeepinCRM для фури (перевірено через API 08.11.2026):
 * Паливо Фура=94, Ремонт Фура=104, Обслуговування Фура=90.
 */
const DEFAULT_KEEPIN_CATEGORY_ID_BY_KIND: Record<
  VehicleRepaymentExpenseKind,
  number
> = {
  fuel: 94,
  repair: 104,
  maintenance: 90,
};

const DEFAULT_KEEPIN_CATEGORY_NAME_BY_KIND: Record<
  VehicleRepaymentExpenseKind,
  string
> = {
  fuel: "Паливо Фура",
  repair: "Ремонт Фура",
  maintenance: "Обслуговування Фура",
};

const CATEGORY_ID_ENV_BY_KIND: Record<VehicleRepaymentExpenseKind, string> = {
  fuel: "KEEPINCRM_TRUCK_FUEL_CATEGORY_ID",
  repair: "KEEPINCRM_TRUCK_REPAIR_CATEGORY_ID",
  maintenance: "KEEPINCRM_TRUCK_MAINTENANCE_CATEGORY_ID",
};

const CATEGORY_NAME_ENV_BY_KIND: Record<VehicleRepaymentExpenseKind, string> = {
  fuel: "KEEPINCRM_TRUCK_FUEL_CATEGORY_NAME",
  repair: "KEEPINCRM_TRUCK_REPAIR_CATEGORY_NAME",
  maintenance: "KEEPINCRM_TRUCK_MAINTENANCE_CATEGORY_NAME",
};

export function buildVehicleRepaymentExpenseComment(
  input: VehicleRepaymentExpenseSyncInput
): string {
  const vehicle = input.vehicleName.trim() || "—";
  const kindLabel = KIND_LABEL[input.kind];
  const detail = input.detail?.trim();
  const base = `${vehicleRepaymentExpenseCommentMarker(input.expenseId)} ${kindLabel} — ${vehicle}`;
  return detail ? `${base}, ${detail}` : base;
}

export function keepinCategoryNameForVehicleRepaymentKind(
  kind: VehicleRepaymentExpenseKind
): string {
  const fromEnv = process.env[CATEGORY_NAME_ENV_BY_KIND[kind]]?.trim();
  return fromEnv || DEFAULT_KEEPIN_CATEGORY_NAME_BY_KIND[kind];
}

function parseEnvId(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

async function resolveCategoryIdForKind(
  kind: VehicleRepaymentExpenseKind
): Promise<number> {
  const fromEnv = parseEnvId(CATEGORY_ID_ENV_BY_KIND[kind]);
  if (fromEnv) return fromEnv;

  // Primary: known KeepinCRM category IDs (stable). Name lookup — лише fallback.
  const defaultId = DEFAULT_KEEPIN_CATEGORY_ID_BY_KIND[kind];
  if (defaultId > 0) return defaultId;

  return resolveKeepinExpenseCategoryIdByName(
    keepinCategoryNameForVehicleRepaymentKind(kind)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Проводить погашення доставки (паливо / ремонт / ТО) у KeepinCRM.
 * Гаманець — як у закупівель (Петрович); категорія — окрема для кожного типу фури.
 */
export async function syncVehicleRepaymentExpenseToKeepin(
  input: VehicleRepaymentExpenseSyncInput
): Promise<number | null> {
  if (!isKeepinSupplierExpenseSyncEnabled()) {
    return null;
  }

  const amount = Math.round(input.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const atYmd = input.atYmd.slice(0, 10);
  try {
    const existingId = await findKeepinExpensePaymentByExpenseId(
      input.expenseId,
      atYmd
    );
    if (existingId != null) {
      return existingId;
    }
  } catch (error) {
    console.error("KeepinCRM find existing repayment expense:", error);
  }

  const [purseId, categoryId] = await Promise.all([
    input.purseId && input.purseId > 0
      ? Promise.resolve(input.purseId)
      : resolveKeepinExpensePurseId(),
    resolveCategoryIdForKind(input.kind),
  ]);

  let lastError: unknown;
  for (let attempt = 1; attempt <= CRM_SYNC_ATTEMPTS; attempt++) {
    try {
      return await createKeepinExpensePayment({
        amount,
        atYmd,
        comment: buildVehicleRepaymentExpenseComment(input),
        purseId,
        categoryId,
      });
    } catch (error) {
      lastError = error;
      if (attempt < CRM_SYNC_ATTEMPTS) {
        await sleep(CRM_SYNC_RETRY_DELAY_MS * attempt);
        try {
          const existingId = await findKeepinExpensePaymentByExpenseId(
            input.expenseId,
            atYmd
          );
          if (existingId != null) {
            return existingId;
          }
        } catch {
          // continue retry POST
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("KeepinCRM: не вдалося створити витрату погашення");
}

export async function syncVehicleRepaymentExpenseDeleteToKeepin(
  keepinPaymentId: number | null | undefined
): Promise<void> {
  if (!isKeepinSupplierExpenseSyncEnabled()) {
    return;
  }

  const id = Number(keepinPaymentId);
  if (!Number.isFinite(id) || id <= 0) {
    return;
  }

  await deleteKeepinPayment(id);
}
