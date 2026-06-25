export const DEFAULT_MONTHLY_TAXES_UAH = 5000;
export const DEFAULT_MONTHLY_ELECTRICITY_UAH = 13000;
export const STATISTICS_FIXED_OVERHEAD_STORAGE_KEY =
  "statisticsFixedOverheadMonthlyUah";

export type FixedOverheadMonthlySettings = {
  monthlyTaxesUah: number;
  monthlyElectricityUah: number;
};

export const DEFAULT_FIXED_OVERHEAD_SETTINGS: FixedOverheadMonthlySettings = {
  monthlyTaxesUah: DEFAULT_MONTHLY_TAXES_UAH,
  monthlyElectricityUah: DEFAULT_MONTHLY_ELECTRICITY_UAH,
};

export function parseMonthlyOverheadInput(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseFixedOverheadSettings(
  raw: string | null
): FixedOverheadMonthlySettings {
  if (!raw) return { ...DEFAULT_FIXED_OVERHEAD_SETTINGS };

  try {
    const parsed = JSON.parse(raw) as Partial<FixedOverheadMonthlySettings>;
    return {
      monthlyTaxesUah:
        parsePositiveNumber(parsed.monthlyTaxesUah) ??
        DEFAULT_FIXED_OVERHEAD_SETTINGS.monthlyTaxesUah,
      monthlyElectricityUah:
        parsePositiveNumber(parsed.monthlyElectricityUah) ??
        DEFAULT_FIXED_OVERHEAD_SETTINGS.monthlyElectricityUah,
    };
  } catch {
    return { ...DEFAULT_FIXED_OVERHEAD_SETTINGS };
  }
}

export function serializeFixedOverheadSettings(
  settings: FixedOverheadMonthlySettings
): string {
  return JSON.stringify(settings);
}
