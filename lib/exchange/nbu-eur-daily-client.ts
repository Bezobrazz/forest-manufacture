import { getKyivDateString } from "@/lib/datetime/kyiv";

/** v3: курс НБУ на київський «завтра» (з fallback на сервері). */
export const NBU_EUR_DAILY_STORAGE_KEY = "statistics:nbu-eur-rate:v3";

export type CachedNbuEurRate = {
  rate: number;
  exchangeDate: string | null;
  /** YYYY-MM-DD у Europe/Kyiv — день першого підтягування */
  fetchedOn: string;
};

function parseCachedNbuEurRate(raw: string): CachedNbuEurRate | null {
  try {
    const cached = JSON.parse(raw) as Partial<CachedNbuEurRate>;
    const rate = Number(cached.rate);
    if (
      typeof cached.fetchedOn !== "string" ||
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

/** Будь-який валідний збережений курс (у т.ч. вчорашній). */
export function readStoredNbuEurRate(): CachedNbuEurRate | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(NBU_EUR_DAILY_STORAGE_KEY);
    if (!raw) return null;
    return parseCachedNbuEurRate(raw);
  } catch {
    return null;
  }
}

export function readNbuEurRateForToday(
  now: Date = new Date()
): CachedNbuEurRate | null {
  const cached = readStoredNbuEurRate();
  if (!cached || cached.fetchedOn !== getKyivDateString(now)) {
    return null;
  }
  return cached;
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
