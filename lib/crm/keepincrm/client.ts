export const DEFAULT_KEEPIN_BASE = "https://api.keepincrm.com/v1";

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

export type KeepinPagination = {
  total_pages?: number;
  current_page?: number;
  total_count?: number;
};

export type KeepinListResponse<T> = {
  items: T[];
  pagination?: KeepinPagination;
};

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

  return fetch(url, { ...init, headers });
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

export async function fetchAllKeepinAgreements(): Promise<Record<string, unknown>[]> {
  const merged: Record<string, unknown>[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= MAX_PAGES) {
    const data = await fetchKeepinAgreementListPage(page);
    const chunk = Array.isArray(data.items) ? data.items : [];
    merged.push(...chunk);
    totalPages =
      typeof data.pagination?.total_pages === "number" && data.pagination.total_pages >= 1
        ? data.pagination.total_pages
        : page;
    if (!chunk.length) break;
    page += 1;
  }
  return merged;
}
