export const DEFAULT_LOADING_COUNT_RATE_UAH = 1;
export const DEFAULT_PRODUCT_LOADING_RATE_UAH = 1.5;

export type ShiftLoadingRates = {
  loadingCountRateUah: number;
  productLoadingRateUah: number;
};

export const DEFAULT_SHIFT_LOADING_RATES: ShiftLoadingRates = {
  loadingCountRateUah: DEFAULT_LOADING_COUNT_RATE_UAH,
  productLoadingRateUah: DEFAULT_PRODUCT_LOADING_RATE_UAH,
};

const normalizeRate = (value: unknown, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
};

export const parseShiftLoadingRates = (row: {
  loading_count_rate_uah?: unknown;
  product_loading_rate_uah?: unknown;
} | null): ShiftLoadingRates => {
  if (!row) return { ...DEFAULT_SHIFT_LOADING_RATES };
  return {
    loadingCountRateUah: normalizeRate(
      row.loading_count_rate_uah,
      DEFAULT_LOADING_COUNT_RATE_UAH
    ),
    productLoadingRateUah: normalizeRate(
      row.product_loading_rate_uah,
      DEFAULT_PRODUCT_LOADING_RATE_UAH
    ),
  };
};
