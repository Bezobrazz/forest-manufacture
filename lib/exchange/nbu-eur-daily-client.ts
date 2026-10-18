import { getKyivDateString } from "@/lib/datetime/kyiv";

/** v3: курс НБУ на київський «завтра». */
export const NBU_EUR_DAILY_STORAGE_KEY = "statistics:nbu-eur-rate:v3";

export type CachedNbuEurRate = {
  rate: number;
  exchangeDate: string | null;
  /** YYYY-MM-DD у Europe/Kyiv — день першого підтягування */
  fetchedOn: string;
};

export function readNbuEurRateForToday(
  now: Date = new Date()
): CachedNbuEurRate | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(NBU_EUR_DAILY_STORAGE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as Partial<CachedNbuEurRate>;
    const rate = Number(cached.rate);
    if (
      cached.fetchedOn !== getKyivDateString(now) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return null;
    }

    return {
      rate,
      exchangeDate:
        typeof cached.exchangeDate === "string" ? cached.exchangeDate : null,
      fetchedOn: cached.fetchedOn,
    };
  } catch {
    return null;
  }
}

export function writeNbuEurRateForToday(
  rate: number,
  exchangeDate: string | null,
  now: Date = new Date()
): void {
  if (typeof window === "undefined") return;

  const payload: CachedNbuEurRate = {
    rate,
    exchangeDate,
    fetchedOn: getKyivDateString(now),
  };

  try {
    window.localStorage.setItem(
      NBU_EUR_DAILY_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // ignore quota / private mode
  }
}
