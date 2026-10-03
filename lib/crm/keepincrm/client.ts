import {
  isAgreementInActiveStages,
  parseKeepinAgreement,
} from "@/lib/crm/keepincrm/mapper";

export const DEFAULT_KEEPIN_BASE = "https://api.keepincrm.com/v1";

/** KeepinCRM дозволяє 100 req/min — тримаємо запас і серіалізуємо запити. */
const KEEPIN_MAX_REQUESTS_PER_MINUTE = 90;
const KEEPIN_MIN_INTERVAL_MS = Math.ceil(60_000 / KEEPIN_MAX_REQUESTS_PER_MINUTE);
const KEEPIN_429_MAX_RETRIES = 6;

let keepinLastRequestAt = 0;
let keepinRequestQueue: Promise<void> = Promise.resolve();

function getBaseUrl(): string {
  const raw = process.env.KEEPINCRM_BASE_URL?.trim();
  if (raw && raw.length > 0) {
    return raw.replace(/\/+$/, "");
  }
  return DEFAULT_KEEPIN_BASE;
}

function getApiKey(): string {
  const key = process.env.KEEPINCRM_API_KEY?.trim();
  if (!key) {
    throw new Error("KEEPINCRM_API_KEY is not set");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForKeepinRateLimitSlot(): Promise<void> {
  const run = async () => {
    const now = Date.now();
    const waitMs = Math.max(0, keepinLastRequestAt + KEEPIN_MIN_INTERVAL_MS - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    keepinLastRequestAt = Date.now();
  };

  const next = keepinRequestQueue.then(run, run);
  keepinRequestQueue = next.then(
    () => undefined,
    () => undefined
  );
  await next;
}

function parseRetryAfterMs(res: Response, attempt: number): number {
  const raw = res.headers.get("retry-after")?.trim();
  if (raw) {
    const asSeconds = Number(raw);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return Math.min(120_000, Math.max(1_000, Math.ceil(asSeconds * 1000)));
    }
    const asDate = Date.parse(raw);
    if (Number.isFinite(asDate)) {
      return Math.min(120_000, Math.max(1_000, asDate - Date.now()));
    }
  }
  return Math.min(60_000, 2_000 * 2 ** attempt);
}

export type KeepinPagination = {
  total_pages?: number;
  current_page?: number;
  total_count?: number;
};

export type KeepinListResponse<T> = {
  items: T[];
  pagination?: KeepinPagination;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function getAgreementTitle(row: Record<string, unknown>): string {
  const root = asRecord(row.agreement) ?? asRecord(row.data) ?? asRecord(row.item) ?? row;
  const direct =
    typeof root.title === "string"
      ? root.title
      : typeof root.dealtitle === "string"
        ? root.dealtitle
        : "";
  return direct.trim();
}

function getAgreementCreatedAt(row: Record<string, unknown>): number {
  const root = asRecord(row.agreement) ?? asRecord(row.data) ?? asRecord(row.item) ?? row;
  const raw =
    (typeof root.created_at === "string" && root.created_at) ||
    (typeof root.created === "string" && root.created) ||
    "";
  const ts = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(ts) ? ts : 0;
}

function getAgreementId(row: Record<string, unknown>): string | null {
  const root = asRecord(row.agreement) ?? asRecord(row.data) ?? asRecord(row.item) ?? row;
  const id = root.id ?? root.agreement_id;
  if (id === undefined || id === null) return null;
  const value = String(id).trim();
  return value.length > 0 ? value : null;
}

export async function keepinRequest(
  pathWithLeadingSlash: string,
  init?: RequestInit & { searchParams?: Record<string, string | number | undefined> }
): Promise<Response> {
  const base = getBaseUrl();
  const key = getApiKey();

  const url = new URL(`${base}${pathWithLeadingSlash}`);
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Auth-Token", key);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { searchParams: _sp, ...fetchInit } = init ?? {};

  let lastRes: Response | null = null;
  for (let attempt = 0; attempt <= KEEPIN_429_MAX_RETRIES; attempt++) {
    await waitForKeepinRateLimitSlot();
    const res = await fetch(url, { ...fetchInit, headers });
    if (res.status !== 429) {
      return res;
    }
    lastRes = res;
    await res.text().catch(() => "");
    if (attempt >= KEEPIN_429_MAX_RETRIES) break;
    await sleep(parseRetryAfterMs(res, attempt));
  }

  return (
    lastRes ??
    new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  );
}

export async function keepinJson<T>(
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string | number | undefined> }
): Promise<T> {
  const res = await keepinRequest(path, init);
  if (res.status === 404) {
    throw Object.assign(new Error("Not Found"), { status: 404 });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `KeepinCRM ${path} HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`
    );
  }
  return (await res.json()) as T;
}

export async function fetchKeepinAgreementListPage(
  page: number,
  params?: Record<string, string | number | undefined>
): Promise<KeepinListResponse<Record<string, unknown>>> {
  return keepinJson<KeepinListResponse<Record<string, unknown>>>("/agreements", {
    searchParams: { page, ...params },
  });
}

/** Оновити етап угоди (наприклад після відвантаження — «Чекаємо оплату»). */
export async function updateKeepinAgreementStage(
  crmId: string,
  stageId: number
): Promise<void> {
  const id = encodeURIComponent(crmId);
  await keepinJson<unknown>(`/agreements/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ stage_id: stageId }),
  });
}

export async function fetchKeepinAgreementRaw(
  crmId: string
): Promise<Record<string, unknown> | null> {
  const res = await keepinRequest(`/agreements/${encodeURIComponent(crmId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `KeepinCRM agreements/${crmId} HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

const MAX_PAGES = 200;

async function fetchAgreementPages(
  params?: Record<string, string | number | undefined>
): Promise<Record<string, unknown>[]> {
  const merged: Record<string, unknown>[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const data = await fetchKeepinAgreementListPage(page, params);
    const chunk = Array.isArray(data.items) ? data.items : [];
    merged.push(...chunk);

    if (!chunk.length) break;

    const totalPages =
      typeof data.pagination?.total_pages === "number" && data.pagination.total_pages >= 1
        ? data.pagination.total_pages
        : null;

    if (totalPages !== null && page >= totalPages) {
      break;
    }

    page += 1;
  }

  return merged;
}

/**
 * Угоди для синхронізації черги відвантажень.
 * API `q[stage_id_eq]` у KeepinCRM ненадійний — тягнемо відкриті (`result_null`)
 * і відсіюємо клієнтськи за `stage_id` (дефолт id=5 «Доставка ОПТ»).
 */
export async function fetchKeepinAgreementsForSync(): Promise<Record<string, unknown>[]> {
  const openRows = await fetchAgreementPages({ "q[result_null]": "true" });
  return openRows.filter((row) => {
    const parsed = parseKeepinAgreement(row);
    return parsed != null && isAgreementInActiveStages(parsed);
  });
}

export async function fetchAllKeepinAgreements(): Promise<Record<string, unknown>[]> {
  return fetchAgreementPages();
}

export async function findKeepinAgreementIdByDealTitle(
  dealTitle: string
): Promise<string | null> {
  const needle = dealTitle.trim();
  if (!needle) return null;

  const rows = await fetchAgreementPages({
    "q[title_eq]": needle,
  });
  const matches = rows.filter(
    (row) => getAgreementTitle(row).toLowerCase() === needle.toLowerCase()
  );

  if (matches.length === 0) {
    // Fallback: частковий пошук, якщо exact title filter нічого не дав.
    const contRows = await fetchAgreementPages({
      "q[title_i_cont]": needle,
    });
    const contMatches = contRows.filter(
      (row) => getAgreementTitle(row).toLowerCase() === needle.toLowerCase()
    );
    if (contMatches.length === 0) return null;
    contMatches.sort((a, b) => getAgreementCreatedAt(b) - getAgreementCreatedAt(a));
    return getAgreementId(contMatches[0]);
  }

  // Якщо є дублікати назви, беремо найновішу за датою створення.
  matches.sort((a, b) => getAgreementCreatedAt(b) - getAgreementCreatedAt(a));
  return getAgreementId(matches[0]);
}
