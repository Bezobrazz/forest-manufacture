import { keepinJson, keepinRequest, type KeepinListResponse } from "@/lib/crm/keepincrm/client";

export type KeepinPurse = {
  id: number;
  name: string;
  currency?: string;
};

export type KeepinPaymentListItem = {
  id: number;
  kind: string;
  amount: number;
  at: string;
  comment: string | null;
  currency?: string;
  planned?: boolean;
  created_at?: string;
  purse?: KeepinPurse | null;
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

export type CreateKeepinFundTransferInput = {
  amount: number;
  atYmd: string;
  comment: string;
  fromPurseId: number;
  toPurseId: number;
  currency?: string;
};

export type UpdateKeepinFundTransferInput = {
  amount: number;
  atYmd: string;
  comment: string;
  fromPurseId: number;
  toPurseId: number;
  currency?: string;
};

const MAX_PAGES = 50;
const MAX_RECONCILE_PAGES = 120;
const KEEPIN_TRANSFER_KIND = "transfer";

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

function normalizePaymentAmount(value: number): number {
  const amount = Math.round(value * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("KeepinCRM: сума має бути більше нуля");
  }
  return amount;
}

function buildFundTransferPostBodies(
  input: CreateKeepinFundTransferInput
): Record<string, unknown>[] {
  const amount = normalizePaymentAmount(input.amount);
  const currency =
    input.currency?.trim() ||
    process.env.KEEPINCRM_SUPPLIER_EXPENSE_CURRENCY?.trim() ||
    "UAH";
  const base = {
    amount,
    kind: KEEPIN_TRANSFER_KIND,
    at: input.atYmd,
    comment: input.comment.trim().slice(0, 500),
    planned: false,
    currency,
  };

  return [
    {
      ...base,
      purse_id: input.toPurseId,
      source_purse_id: input.fromPurseId,
    },
    {
      ...base,
      purse_id: input.toPurseId,
      source_purse_attributes: { id: input.fromPurseId, currency },
    },
    {
      ...base,
      purse_id: input.toPurseId,
      source_purse: { id: input.fromPurseId, currency },
    },
  ];
}

/** Створює переміщення між гаманцями (POST /payments, kind=transfer). */
export async function createKeepinFundTransfer(
  input: CreateKeepinFundTransferInput
): Promise<number> {
  const bodies = buildFundTransferPostBodies(input);
  let lastError = "KeepinCRM: не вдалося створити переміщення";

  for (const body of bodies) {
    const res = await keepinRequest("/payments", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");

    if (res.ok) {
      let created: { id?: number } | null = null;
      try {
        created = text ? (JSON.parse(text) as { id?: number }) : null;
      } catch {
        created = null;
      }
      const paymentId = Number(created?.id);
      if (Number.isFinite(paymentId) && paymentId > 0) {
        return paymentId;
      }
      lastError = "KeepinCRM: не отримано ID створеного переміщення";
      continue;
    }

    lastError = text
      ? `KeepinCRM: ${text.slice(0, 300)}`
      : `KeepinCRM: HTTP ${res.status}`;
  }

  throw new Error(lastError);
}

export async function updateKeepinFundTransfer(
  keepinPaymentId: number,
  input: UpdateKeepinFundTransferInput
): Promise<void> {
  const amount = normalizePaymentAmount(input.amount);
  const currency =
    input.currency?.trim() ||
    process.env.KEEPINCRM_SUPPLIER_EXPENSE_CURRENCY?.trim() ||
    "UAH";

  const body = {
    amount,
    kind: KEEPIN_TRANSFER_KIND,
    at: input.atYmd,
    comment: input.comment.trim().slice(0, 500),
    planned: false,
    currency,
    purse_id: input.toPurseId,
    source_purse_id: input.fromPurseId,
  };

  const res = await keepinRequest(`/payments/${keepinPaymentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `KeepinCRM PATCH /payments/${keepinPaymentId} HTTP ${res.status}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`
    );
  }
}

export async function deleteKeepinFundTransfer(keepinPaymentId: number): Promise<void> {
  const res = await keepinRequest(`/payments/${keepinPaymentId}`, {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `KeepinCRM DELETE /payments/${keepinPaymentId} HTTP ${res.status}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`
    );
  }
}

export async function fetchKeepinPaymentsPage(
  page: number
): Promise<KeepinListResponse<KeepinPaymentListItem>> {
  return keepinJson<KeepinListResponse<KeepinPaymentListItem>>("/payments", {
    searchParams: { page },
  });
}

export async function fetchKeepinPaymentsSince(
  sinceYmd: string,
  maxPages = MAX_RECONCILE_PAGES
): Promise<KeepinPaymentListItem[]> {
  const merged: KeepinPaymentListItem[] = [];
  let page = 1;

  while (page <= maxPages) {
    const data = await fetchKeepinPaymentsPage(page);
    const chunk = Array.isArray(data.items) ? data.items : [];
    if (!chunk.length) break;

    merged.push(...chunk);

    const oldestOnPage = chunk.reduce((min, item) => {
      const at = item.at?.slice(0, 10) ?? "";
      return !min || (at && at < min) ? at : min;
    }, "");

    if (oldestOnPage && oldestOnPage < sinceYmd) {
      break;
    }

    const totalPages =
      typeof data.pagination?.total_pages === "number" && data.pagination.total_pages >= 1
        ? data.pagination.total_pages
        : null;

    if (totalPages !== null && page >= totalPages) break;
    page += 1;
  }

  return merged.filter((item) => (item.at?.slice(0, 10) ?? "") >= sinceYmd);
}

export function isKeepinTransferListItem(
  payment: KeepinPaymentListItem,
  toPurseId: number
): boolean {
  return (
    payment.kind === KEEPIN_TRANSFER_KIND &&
    typeof payment.purse?.id === "number" &&
    payment.purse.id === toPurseId
  );
}

export function mapKeepinTransferToLocalFields(payment: KeepinPaymentListItem): {
  amount: number;
  transferredAt: string;
  comment: string | null;
  keepinPaymentId: number;
} {
  return {
    amount: normalizePaymentAmount(Number(payment.amount)),
    transferredAt: payment.at?.length === 10 ? `${payment.at}T12:00:00.000Z` : payment.at,
    comment: payment.comment?.trim() || null,
    keepinPaymentId: payment.id,
  };
}
