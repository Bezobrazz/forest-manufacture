import type { VehicleType } from "@/lib/trips/calc";

export const TYPE_DEFAULTS: Record<
  VehicleType,
  { fuel: number; dailyTaxes: number; depreciation: number }
> = {
  van: { fuel: 12, dailyTaxes: 150, depreciation: 1.2 },
  truck: { fuel: 30, dailyTaxes: 300, depreciation: 7 },
};
