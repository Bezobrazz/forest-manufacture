export type VehicleType = "van" | "truck";

export type DriverPayMode = "per_trip" | "per_day";

export type TripInput = {
  id?: string;
  user_id: string;
  vehicle_id: string;
  name?: string | null;
  trip_date: string;
  start_odometer_km: number | null;
  end_odometer_km: number | null;
  fuel_consumption_l_per_100km: number | null;
  fuel_price_uah_per_l: number | null;
  depreciation_uah_per_km: number | null;
  days_count?: number | null;
  daily_taxes_uah?: number | null;
  freight_uah?: number | null;
  driver_pay_mode?: DriverPayMode | null;
  driver_pay_uah?: number | null;
  driver_pay_uah_per_day?: number | null;
  extra_costs_uah?: number | null;
  notes?: string | null;
};

export type TripStatus = "profit" | "breakeven" | "loss";

export type TripMetrics = {
  distance_km: number;
  fuel_used_l: number;
  fuel_cost_uah: number;
  depreciation_cost_uah: number;
  taxes_cost_uah: number;
  driver_cost_uah: number;
  total_costs_uah: number;
  profit_uah: number;
  profit_per_km_uah: number;
  roi_percent: number;
  status: TripStatus;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const ensureNonNegative = (value: number | null | undefined): number =>
  Math.max(0, value ?? 0);

export function calculateTripMetrics(input: TripInput): TripMetrics {
  const start = input.start_odometer_km ?? 0;
  const end = input.end_odometer_km ?? 0;

  if (end < start) {
    throw new Error("end_odometer_km cannot be less than start_odometer_km");
  }

  const daysCount = (input.days_count ?? 0) < 1 ? 1 : (input.days_count ?? 1);
  const fuelConsumption = ensureNonNegative(
    input.fuel_consumption_l_per_100km
  );
  const fuelPrice = ensureNonNegative(input.fuel_price_uah_per_l);
  const depreciationPerKm = ensureNonNegative(input.depreciation_uah_per_km);
  const dailyTaxes = ensureNonNegative(input.daily_taxes_uah);
  const freightUah = ensureNonNegative(input.freight_uah);
  const driverPayUah = ensureNonNegative(input.driver_pay_uah);
  const driverPayUahPerDay = ensureNonNegative(input.driver_pay_uah_per_day);
  const extraCosts = ensureNonNegative(input.extra_costs_uah);

  const distanceKm = round2(end - start);
  const fuelUsedL = round2((distanceKm * fuelConsumption) / 100);
  const fuelCostUah = round2(fuelUsedL * fuelPrice);
  const depreciationCostUah = round2(distanceKm * depreciationPerKm);
  const taxesCostUah = round2(dailyTaxes * daysCount);
  const incomeUah = freightUah;

  const driverPayMode = input.driver_pay_mode ?? "per_trip";
  const driverCostUah =
    driverPayMode === "per_trip"
      ? driverPayUah
      : round2(driverPayUahPerDay * daysCount);
  const driverCostUahRounded = round2(driverCostUah);

  const totalCostsUah = round2(
    fuelCostUah +
      depreciationCostUah +
      taxesCostUah +
      driverCostUahRounded +
      extraCosts
  );

  const profitUah = round2(incomeUah - totalCostsUah);
  const profitPerKmUah =
    distanceKm > 0 ? round2(profitUah / distanceKm) : 0;
  const roiPercent =
    totalCostsUah > 0 ? round2((profitUah / totalCostsUah) * 100) : 0;

  let status: TripStatus;
  if (profitUah > 0) status = "profit";
  else if (profitUah === 0) status = "breakeven";
  else status = "loss";

  return {
    distance_km: distanceKm,
    fuel_used_l: fuelUsedL,
    fuel_cost_uah: fuelCostUah,
    depreciation_cost_uah: depreciationCostUah,
    taxes_cost_uah: taxesCostUah,
    driver_cost_uah: driverCostUahRounded,
    total_costs_uah: totalCostsUah,
    profit_uah: profitUah,
    profit_per_km_uah: profitPerKmUah,
    roi_percent: roiPercent,
    status,
  };
}
