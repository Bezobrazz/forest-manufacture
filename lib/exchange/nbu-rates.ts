const nbuCurrencyUrl = (currencyCode: string) =>
  `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${currencyCode}&json`;

export const SUGGESTED_PRICE_MARKUP_PERCENT = 45;

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
  const row = rows.find((item) => item.cc === currencyCode);
  if (!row) return null;

  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return {
    rate,
    exchangeDate: row.exchangedate ?? null,
    source: "nbu",
  };
}

async function fetchNbuCurrencyRate(
  currencyCode: string
): Promise<NbuRateSnapshot> {
  const response = await fetch(nbuCurrencyUrl(currencyCode), {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`NBU API responded with ${response.status} for ${currencyCode}`);
  }

  const data = (await response.json()) as NbuRateRow[];
  const snapshot = parseNbuRate(data, currencyCode);

  if (!snapshot) {
    throw new Error(`NBU API returned no valid ${currencyCode} rate`);
  }

  return snapshot;
}

export async function fetchNbuEurRate(): Promise<NbuRateSnapshot> {
  return fetchNbuCurrencyRate("EUR");
}

export async function fetchNbuUsdRate(): Promise<NbuRateSnapshot> {
  return fetchNbuCurrencyRate("USD");
}

export async function fetchNbuDebtCurrencyRates(): Promise<{
  USD: NbuRateSnapshot;
  EUR: NbuRateSnapshot;
}> {
  const [usd, eur] = await Promise.all([
    fetchNbuUsdRate(),
    fetchNbuEurRate(),
  ]);
  return { USD: usd, EUR: eur };
}

export function suggestedSellingPriceUah(
  costPerBagUah: number,
  markupPercent: number = SUGGESTED_PRICE_MARKUP_PERCENT
): number {
  return Math.ceil(costPerBagUah * (1 + markupPercent / 100));
}

export function convertUahToEur(uah: number, eurUahRate: number): number {
  return uah / eurUahRate;
}
