const nbuCurrencyUrl = (currencyCode: string) =>
  `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=${currencyCode}&json`;

export const MIN_BAG_MARGIN_USD = 1;

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

export type NbuUsdEurRates = {
  usd: NbuRateSnapshot;
  eur: NbuRateSnapshot;
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

export async function fetchNbuUsdEurRates(): Promise<NbuUsdEurRates> {
  const [usd, eur] = await Promise.all([
    fetchNbuCurrencyRate("USD"),
    fetchNbuCurrencyRate("EUR"),
  ]);

  return { usd, eur };
}

export function suggestedSellingPriceUah(
  costPerBagUah: number,
  usdUahRate: number,
  minMarginUsd: number = MIN_BAG_MARGIN_USD
): number {
  return costPerBagUah + minMarginUsd * usdUahRate;
}

export function convertUahToEur(uah: number, eurUahRate: number): number {
  return uah / eurUahRate;
}
