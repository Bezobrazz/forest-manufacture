import { keepinJson, type KeepinListResponse } from "@/lib/crm/keepincrm/client";

export type KeepinPurse = {
  id: number;
  name: string;
};

export type KeepinPaymentCategory = {
  id: number;
  name: string;
  kind: string;
  parent_id?: number | null;
};

export type CreateKeepinPaymentInput = {
  amount: number;
  atYmd: string;
  comment: string;
  purseId: number;
  categoryId: number;
  currency?: string;
};

const MAX_PAGES = 50;

const DEFAULT_PURSE_NAME = "Петрович";
const DEFAULT_CATEGORY_NAME = "Закупівля Кора Сировина";
/** У KeepinCRM категорії витрат (закупівлі) мають kind=credit, доходи — debit. */
const KEEPIN_EXPENSE_KIND = "credit";

let cachedPurseId: number | null | undefined;
let cachedCategoryId: number | null | undefined;

function normalizeLookupName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isKeepinSupplierExpenseSyncEnabled(): boolean {
  return Boolean(process.env.KEEPINCRM_API_KEY?.trim());
}

async function fetchAllKeepinListItems<T>(
  path: string
): Promise<T[]> {
  const merged: T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const data = await keepinJson<KeepinListResponse<T>>(path, {
      searchParams: { page },
    });
    const chunk = Array.isArray(data.items) ? data.items : [];
    merged.push(...chunk);

    if (!chunk.length) break;

    const totalPages =
      typeof data.pagination?.total_pages === "number" && data.pagination.total_pages >= 1
        ? data.pagination.total_pages
        : null;

    if (totalPages !== null && page >= totalPages) break;
    page += 1;
  }

  return merged;
}

export async function fetchAllKeepinPurses(): Promise<KeepinPurse[]> {
  const rows = await fetchAllKeepinListItems<KeepinPurse>("/payments/purses");
  return rows.filter((row) => typeof row.id === "number" && typeof row.name === "string");
}

export async function fetchAllKeepinPaymentCategories(): Promise<KeepinPaymentCategory[]> {
  const rows = await fetchAllKeepinListItems<KeepinPaymentCategory>(
    "/payments/categories"
  );
  return rows.filter(
    (row) =>
      typeof row.id === "number" &&
      typeof row.name === "string" &&
      typeof row.kind === "string"
  );
}

function parseEnvId(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

async function resolvePurseId(): Promise<number> {
  const fromEnv = parseEnvId("KEEPINCRM_SUPPLIER_EXPENSE_PURSE_ID");
  if (fromEnv) return fromEnv;

  if (cachedPurseId !== undefined) {
    if (cachedPurseId === null) {
      throw new Error("KeepinCRM: гаманець не знайдено (кеш)");
    }
    return cachedPurseId;
  }

  const targetName = normalizeLookupName(
    process.env.KEEPINCRM_SUPPLIER_EXPENSE_PURSE_NAME?.trim() || DEFAULT_PURSE_NAME
  );
  const purses = await fetchAllKeepinPurses();
  const match = purses.find((p) => normalizeLookupName(p.name) === targetName);

  if (!match) {
    cachedPurseId = null;
    throw new Error(
      `KeepinCRM: гаманець «${process.env.KEEPINCRM_SUPPLIER_EXPENSE_PURSE_NAME?.trim() || DEFAULT_PURSE_NAME}» не знайдено`
    );
  }

  cachedPurseId = match.id;
  return match.id;
}

async function resolveExpenseCategoryId(): Promise<number> {
  const fromEnv = parseEnvId("KEEPINCRM_SUPPLIER_EXPENSE_CATEGORY_ID");
  if (fromEnv) return fromEnv;

  if (cachedCategoryId !== undefined) {
    if (cachedCategoryId === null) {
      throw new Error("KeepinCRM: категорію витрат не знайдено (кеш)");
    }
    return cachedCategoryId;
  }

  const targetName = normalizeLookupName(
    process.env.KEEPINCRM_SUPPLIER_EXPENSE_CATEGORY_NAME?.trim() ||
      DEFAULT_CATEGORY_NAME
  );
  const categories = await fetchAllKeepinPaymentCategories();
  const match = categories.find(
    (c) =>
      normalizeLookupName(c.name) === targetName &&
      normalizeLookupName(c.kind) === KEEPIN_EXPENSE_KIND
  );

  if (!match) {
    cachedCategoryId = null;
    throw new Error(
      `KeepinCRM: категорію витрат «${process.env.KEEPINCRM_SUPPLIER_EXPENSE_CATEGORY_NAME?.trim() || DEFAULT_CATEGORY_NAME}» не знайдено`
    );
  }

  cachedCategoryId = match.id;
  return match.id;
}

/** Створює витрату в KeepinCRM (POST /payments). */
export async function createKeepinExpensePayment(
  input: CreateKeepinPaymentInput
): Promise<number> {
  const purseId = input.purseId > 0 ? input.purseId : await resolvePurseId();
  const categoryId =
    input.categoryId > 0 ? input.categoryId : await resolveExpenseCategoryId();

  const amount = Math.round(input.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("KeepinCRM: сума витрати має бути більше нуля");
  }

  const body: Record<string, unknown> = {
    amount,
    kind: KEEPIN_EXPENSE_KIND,
    purse_id: purseId,
    category_id: categoryId,
    at: input.atYmd,
    comment: input.comment.trim().slice(0, 500),
    planned: false,
  };

  const currency = input.currency?.trim() || process.env.KEEPINCRM_SUPPLIER_EXPENSE_CURRENCY?.trim();
  if (currency) {
    body.currency = currency;
  }

  const created = await keepinJson<{ id?: number }>("/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const paymentId = Number(created?.id);
  if (!Number.isFinite(paymentId) || paymentId <= 0) {
    throw new Error("KeepinCRM: не отримано ID створеного платежу");
  }

  return paymentId;
}
