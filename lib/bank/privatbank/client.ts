import {
  getConfiguredPrivatAccounts,
  getPrivatApiCredentials,
} from "@/lib/bank/privatbank/config";
import type {
  BankAccountBalance,
  BankTransaction,
  PrivatAccount,
  PrivatApiMeta,
  PrivatBalancesResponse,
  PrivatRawBalance,
  PrivatRawTransaction,
  PrivatTransactionType,
  PrivatTransactionsResponse,
} from "@/lib/bank/privatbank/types";

export const PRIVAT_API_BASE = "https://acp.privatbank.ua/api";
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

function toPrivatDate(ymd: string): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Некоректна дата: ${ymd}`);
  }
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** DAT_OD часто як `09.10.2026` або `09.10.2026 00:00:00` → YYYY-MM-DD */
function parsePrivatDay(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})[.\-](\d{2})[.\-](\d{4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

function mapTransaction(
  raw: PrivatRawTransaction,
  account: PrivatAccount
): BankTransaction | null {
  const typeRaw = (raw.TRANTYPE ?? "").toUpperCase();
  if (typeRaw !== "C" && typeRaw !== "D") return null;

  const id =
    raw.TECHNICAL_TRANSACTION_ID?.trim() ||
    raw.ID?.trim() ||
    raw.REF?.trim() ||
    `${account.iban}-${raw.DATE_TIME_DAT_OD_TIM_P ?? ""}-${raw.SUM ?? ""}-${typeRaw}`;

  const date =
    parsePrivatDay(raw.DAT_OD) ||
    parsePrivatDay(raw.DATE_TIME_DAT_OD_TIM_P) ||
    dateToYmdLocal(new Date());

  return {
    id,
    accountIban: account.iban,
    accountLabel: account.label,
    date,
    dateTime: raw.DATE_TIME_DAT_OD_TIM_P?.trim() || null,
    amount: parseAmount(raw.SUM),
    amountUah: parseAmount(raw.SUM_E) || parseAmount(raw.SUM),
    currency: (raw.CCY ?? "UAH").trim() || "UAH",
    type: typeRaw as PrivatTransactionType,
    counterpartName: raw.AUT_CNTR_NAM?.trim() || null,
    counterpartIban: raw.AUT_CNTR_ACC?.trim() || null,
    counterpartEdrpou: raw.AUT_CNTR_CRF?.trim() || null,
    purpose: raw.OSND?.trim() || null,
    documentNumber: raw.NUM_DOC?.trim() || null,
    status: raw.PR_PR?.trim() || null,
  };
}

function dateToYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveResponseCharset(contentType: string | null): string {
  const match = contentType?.match(/charset\s*=\s*([^\s;]+)/i);
  const raw = match?.[1]?.trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (!raw) return "windows-1251";
  if (raw === "cp1251" || raw === "windows-1251" || raw === "x-cp1251") {
    return "windows-1251";
  }
  if (raw === "utf-8" || raw === "utf8") return "utf-8";
  return raw;
}

async function decodePrivatBody(res: Response): Promise<string> {
  const buffer = await res.arrayBuffer();
  const charset = resolveResponseCharset(res.headers.get("content-type"));
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    // Fallback: API майже завжди віддає cp1251
    return new TextDecoder("windows-1251").decode(buffer);
  }
}

async function privatGet<T extends PrivatApiMeta>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const { id, token } = getPrivatApiCredentials();
  const url = new URL(`${PRIVAT_API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      id,
      token,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await decodePrivatBody(res);
  let json: T | null = null;
  try {
    json = JSON.parse(text) as T;
  } catch {
    throw new Error(
      `PrivatBank API: некоректна відповідь (HTTP ${res.status})`
    );
  }

  if (!res.ok || (json.status && json.status !== "SUCCESS")) {
    const msg =
      json.message ||
      json.error ||
      json.errMsg ||
      json.status ||
      `HTTP ${res.status}`;
    throw new Error(`PrivatBank API: ${msg}`);
  }

  return json;
}

function pickLatestBalance(rows: PrivatRawBalance[]): PrivatRawBalance | null {
  if (rows.length === 0) return null;

  let best = rows[0];
  let bestDay = parsePrivatDay(best.dpd) ?? "";

  for (let i = 1; i < rows.length; i += 1) {
    const day = parsePrivatDay(rows[i].dpd) ?? "";
    if (day > bestDay) {
      best = rows[i];
      bestDay = day;
    }
  }

  return best;
}

async function fetchTransactionsPage(
  path: string,
  params: Record<string, string>
): Promise<PrivatRawTransaction[]> {
  const rows: PrivatRawTransaction[] = [];
  let followId = "";
  let pages = 0;

  while (pages < MAX_PAGES) {
    pages += 1;
    const query = { ...params };
    if (followId) query.followId = followId;

    const json = await privatGet<PrivatTransactionsResponse>(path, query);
    const batch = Array.isArray(json.transactions) ? json.transactions : [];
    rows.push(...batch);

    if (!json.exist_next_page || !json.next_page_id) break;
    followId = json.next_page_id;
  }

  return rows;
}

/**
 * Поточний залишок рахунку(ів) з interim-виписки (balanceOut за останній опердень).
 */
export async function fetchPrivatAccountBalances(input?: {
  accountIban?: string | null;
}): Promise<BankAccountBalance[]> {
  const accounts = getConfiguredPrivatAccounts();
  const selected = input?.accountIban
    ? accounts.filter((a) => a.iban === input.accountIban)
    : accounts;

  if (selected.length === 0) {
    throw new Error("Рахунок не знайдено в PRIVATBANK_ACCOUNTS");
  }

  const result: BankAccountBalance[] = [];

  for (const account of selected) {
    const json = await privatGet<PrivatBalancesResponse>(
      "/statements/balance/interim",
      {
        acc: account.iban,
        limit: "20",
      }
    );

    const rows = Array.isArray(json.balances) ? json.balances : [];
    const latest = pickLatestBalance(rows);

    if (!latest) {
      // Fallback: фінальний залишок останнього закритого дня
      const finalJson = await privatGet<PrivatBalancesResponse>(
        "/statements/balance/final",
        {
          acc: account.iban,
          limit: "1",
        }
      );
      const finalRows = Array.isArray(finalJson.balances)
        ? finalJson.balances
        : [];
      const finalLatest = pickLatestBalance(finalRows);
      if (!finalLatest) continue;

      result.push({
        accountIban: account.iban,
        accountLabel: account.label,
        currency: (finalLatest.currency ?? "UAH").trim() || "UAH",
        balance: parseAmount(finalLatest.balanceOut),
        asOfDate: parsePrivatDay(finalLatest.dpd),
      });
      continue;
    }

    result.push({
      accountIban: account.iban,
      accountLabel: account.label,
      currency: (latest.currency ?? "UAH").trim() || "UAH",
      balance: parseAmount(latest.balanceOut),
      asOfDate: parsePrivatDay(latest.dpd),
    });
  }

  return result;
}

function ymdInInclusiveRange(ymd: string, startYmd: string, endYmd: string): boolean {
  return ymd >= startYmd && ymd <= endYmd;
}

/**
 * Виписка за період [startYmd, endYmd] включно (YYYY-MM-DD).
 * Для поточного дня додатково підтягує interim-операції.
 */
export async function fetchPrivatTransactionsForPeriod(input: {
  startYmd: string;
  endYmd: string;
  accountIban?: string | null;
}): Promise<BankTransaction[]> {
  const accounts = getConfiguredPrivatAccounts();
  const selected = input.accountIban
    ? accounts.filter((a) => a.iban === input.accountIban)
    : accounts;

  if (selected.length === 0) {
    throw new Error("Рахунок не знайдено в PRIVATBANK_ACCOUNTS");
  }

  if (input.startYmd > input.endYmd) {
    throw new Error("Початкова дата не може бути пізніше кінцевої");
  }

  const todayYmd = dateToYmdLocal(new Date());
  const includesToday =
    ymdInInclusiveRange(todayYmd, input.startYmd, input.endYmd);

  // Історичний діапазон без «сьогодні» — через /transactions
  let historyEnd = input.endYmd;
  if (includesToday) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    historyEnd = dateToYmdLocal(yesterday);
  }

  const result: BankTransaction[] = [];
  const seen = new Set<string>();

  for (const account of selected) {
    if (input.startYmd <= historyEnd) {
      const rawRows = await fetchTransactionsPage("/statements/transactions", {
        acc: account.iban,
        startDate: toPrivatDate(input.startYmd),
        endDate: toPrivatDate(historyEnd),
        limit: String(PAGE_LIMIT),
      });

      for (const raw of rawRows) {
        const mapped = mapTransaction(raw, account);
        if (!mapped) continue;
        if (!ymdInInclusiveRange(mapped.date, input.startYmd, input.endYmd)) {
          continue;
        }
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        result.push(mapped);
      }
    }

    if (includesToday) {
      const interimRows = await fetchTransactionsPage(
        "/statements/transactions/interim",
        {
          acc: account.iban,
          limit: String(PAGE_LIMIT),
        }
      );

      for (const raw of interimRows) {
        const mapped = mapTransaction(raw, account);
        if (!mapped) continue;
        if (!ymdInInclusiveRange(mapped.date, input.startYmd, input.endYmd)) {
          continue;
        }
        if (seen.has(mapped.id)) continue;
        seen.add(mapped.id);
        result.push(mapped);
      }
    }
  }

  result.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.dateTime ?? "").localeCompare(a.dateTime ?? "");
  });

  return result;
}

export function listPrivatAccounts(): PrivatAccount[] {
  return getConfiguredPrivatAccounts();
}
