import { getKyivDateString } from "@/lib/datetime/kyiv";

/** NBU `date` query: YYYYMMDD (київський календарний день). */
export function toNbuDateParam(dateYmd: string): string {
  return dateYmd.replaceAll("-", "");
}

export function shiftKyivDateYmd(dateYmd: string, days: number): string {
  const [year, month, day] = dateYmd
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Бажана дата курсу — київський завтра (часто вже опублікований). */
export function nbuRateDateYmd(now: Date = new Date()): string {
  return shiftKyivDateYmd(getKyivDateString(now), 1);
}

export const nbuCurrencyUrl = (
  currencyCode: string,
  dateYmd?: string | null
) => {
  const base = `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${currencyCode}`;
  if (dateYmd) {
    return `${base}&date=${toNbuDateParam(dateYmd)}&json`;
  }
  return `${base}&json`;
};

export const SUGGESTED_PRICE_MARKUP_PERCENT = 35;
export const SUGGESTED_EUR_PER_BAG = 0.06;

type NbuRateRow = {
  cc?: string;
  rate?: number | string;
  exchangedate?: string;
};

export type NbuRateSnapshot = {
  rate: number;
  exchangeDate: string | null;
  source: "nbu";
};

export function parseNbuRate(
  rows: NbuRateRow[],
  currencyCode: string
): NbuRateSnapshot | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows.find((item) => item.cc === currencyCode) ?? rows[0];
  if (!row) return null;

  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return {
    rate,
    exchangeDate: row.exchangedate ?? null,
    source: "nbu",
  };
}

async function fetchNbuCurrencyRateOnce(
  currencyCode: string,
  dateYmd?: string | null
): Promise<NbuRateSnapshot | null> {
  const response = await fetch(nbuCurrencyUrl(currencyCode, dateYmd), {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as NbuRateRow[];
  return parseNbuRate(data, currencyCode);
}

/**
 * Порядок: завтра → сьогодні → «поточний» без дати → вчора.
 * Порожня відповідь НБУ (напр. завтра ще не опубліковане) не є помилкою.
 */
async function fetchNbuCurrencyRate(
  currencyCode: string,
  now: Date = new Date()
): Promise<NbuRateSnapshot> {
  const today = getKyivDateString(now);
  const candidates: Array<string | null> = [
    shiftKyivDateYmd(today, 1),
    today,
    null,
    shiftKyivDateYmd(today, -1),
  ];

  for (const dateYmd of candidates) {
    try {
      const snapshot = await fetchNbuCurrencyRateOnce(currencyCode, dateYmd);
      if (snapshot) return snapshot;
    } catch {
      // спробувати наступний кандидат
    }
  }

  throw new Error(`NBU API returned no valid ${currencyCode} rate`);
}

export async function fetchNbuEurRate(
  now: Date = new Date()
): Promise<NbuRateSnapshot> {
  return fetchNbuCurrencyRate("EUR", now);
}

export async function fetchNbuUsdRate(
  now: Date = new Date()
): Promise<NbuRateSnapshot> {
  return fetchNbuCurrencyRate("USD", now);
}

export async function fetchNbuDebtCurrencyRates(
  now: Date = new Date()
): Promise<{
  USD: NbuRateSnapshot;
  EUR: NbuRateSnapshot;
}> {
  const [usd, eur] = await Promise.all([
    fetchNbuUsdRate(now),
    fetchNbuEurRate(now),
  ]);
  return { USD: usd, EUR: eur };
}

export function suggestedSellingPriceUah(
  costPerBagUah: number,
  markupPercent: number = SUGGESTED_PRICE_MARKUP_PERCENT
): number {
  return Math.ceil(costPerBagUah * (1 + markupPercent / 100));
}

/** Ціна з % прибутку + додаткові € на мішок (у грн), округлення вгору. */
export function suggestedSellingPriceFromEurPerBag(
  costPerBagUah: number,
  eurMarkupPerBag: number,
  eurUahRate: number,
  markupPercent: number = SUGGESTED_PRICE_MARKUP_PERCENT
): number {
  const baseWithMarkup = suggestedSellingPriceUah(costPerBagUah, markupPercent);
  return Math.ceil(
    baseWithMarkup + convertEurToUah(eurMarkupPerBag, eurUahRate)
  );
}

export function convertUahToEur(uah: number, eurUahRate: number): number {
  return uah / eurUahRate;
}

export function convertEurToUah(eur: number, eurUahRate: number): number {
  return eur * eurUahRate;
}
