const NBU_USD_URL =
  "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json";

export const MIN_BAG_MARGIN_USD = 1;

type NbuUsdRow = {
  cc?: string;
  rate?: number | string;
  exchangedate?: string;
};

export type UsdUahRateSnapshot = {
  rate: number;
  exchangeDate: string | null;
  source: "nbu";
};

export function parseNbuUsdRate(rows: NbuUsdRow[]): UsdUahRateSnapshot | null {
  const row = rows.find((item) => item.cc === "USD");
  if (!row) return null;

  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  return {
    rate,
    exchangeDate: row.exchangedate ?? null,
    source: "nbu",
  };
}

export async function fetchNbuUsdUahRate(): Promise<UsdUahRateSnapshot> {
  const response = await fetch(NBU_USD_URL, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`NBU API responded with ${response.status}`);
  }

  const data = (await response.json()) as NbuUsdRow[];
  const snapshot = parseNbuUsdRate(data);

  if (!snapshot) {
    throw new Error("NBU API returned no valid USD rate");
  }

  return snapshot;
}

export function suggestedSellingPriceUah(
  costPerBagUah: number,
  usdUahRate: number,
  minMarginUsd: number = MIN_BAG_MARGIN_USD
): number {
  return costPerBagUah + minMarginUsd * usdUahRate;
}
